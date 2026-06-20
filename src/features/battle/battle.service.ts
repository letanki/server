import * as LobbyPackets from "@/features/lobby/lobby.packets";
import { LobbyService } from "@/features/lobby/lobby.service";
import { IPacket } from "@/packets/packet.interfaces";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { UserDocument } from "@/shared/models/user.model";
import { IVector3 } from "@/shared/types/geom/ivector3";
import { CollisionService } from "./collision.service";
import { SpawnService } from "./spawn.service";
import { BattleEvents } from "./battle-events";
import { CombatService } from "./combat.service";
import { CtfService } from "./ctf.service";
import { RoundService } from "./round.service";
import { BonusService } from "./bonus.service";
import { mapGeometries } from "@/types/mapGeometries";
import logger from "@/utils/logger";
import { Battle, BattleMode, BattleRoundState } from "./battle.model";
import { DestroyTankPacket, RemoveTankPacket, UpdateSpectatorListPacket, UserDisconnectedDmPacket, UserDisconnectTeamPacket } from "./battle.packets";

const EMPTY_BATTLE_REMOVAL_MS = 60000; // a player-created battle left empty this long is removed

interface IDisconnectedPlayerInfo {
    battleId: string;
    timeoutId: NodeJS.Timeout;
}

export class BattleService {
    /**
     * Hard ceiling on active tanks per battle. The client's BattlefieldModel stores tanks in a
     * fixed-length Vector(60); the 61st tank overflows it (RangeError #1125), corrupting the battle
     * for everyone. We cap below any battle's configured maxPeopleCount so no config can exceed it.
     */
    public static readonly MAX_TANKS_PER_BATTLE = 60;

    private disconnectedPlayers = new Map<string, IDisconnectedPlayerInfo>();
    private readonly collision = new CollisionService();
    private readonly events = new BattleEvents();
    private readonly combat = new CombatService(this.events);
    private readonly ctf = new CtfService(this.events, this.collision);
    private readonly spawn: SpawnService;
    private readonly round: RoundService;
    public readonly bonus: BonusService;
    private server: GameServer;
    private lobbyService: LobbyService;

    constructor(server: GameServer, lobbyService: LobbyService) {
        this.server = server;
        this.spawn = new SpawnService(server);
        this.round = new RoundService(server, this.events, this.ctf, this.spawn);
        this.bonus = new BonusService(server);
        this.lobbyService = lobbyService;
    }

    private broadcastToBattle(battle: Battle, packet: IPacket): void {
        // Serialize once and skip clients still loading (they'd deref null on a packet that
        // references a player/tank they haven't registered yet — #1009).
        battle.broadcast(packet);
    }

    /**
     * Applies `realDamage` (garage HP units) from a weapon hit to a target. Health is tracked on
     * the client's normalized 0-10000 scale, so we convert by RULE OF 3 against the target's hull
     * HP: normalizedDamage = realDamage * 10000 / hullHP. Broadcasts SetHealth + the damage number,
     * and runs the kill flow when health drops to 0. Shared by all weapons (railgun, thunder, ...).
     */
    public applyDamage(battle: Battle, shooterClient: GameClient, targetClient: GameClient, realDamage: number): Promise<void> {
        return this.combat.applyDamage(battle, shooterClient, targetClient, realDamage);
    }

    /**
     * Area (splash) damage from an explosion at `center` (world position). Every active tank —
     * INCLUDING the shooter (you can blow yourself up) — within `minRadius` takes damage: full up
     * to `maxRadius`, then linearly down to `minPercent`% at `minRadius`, nothing beyond. World
     * distance is scaled by SPLASH_WORLD_SCALE so a direct hit (~150u from center) stays inside
     * maxRadius and the splash reaches ~nearby tanks — calibrate this if the radius feels off.
     */
    public applySplashDamage(battle: Battle, shooterClient: GameClient, center: IVector3, baseDamage: number, maxRadius: number, minRadius: number, minPercent: number): Promise<void> {
        return this.combat.applySplashDamage(battle, shooterClient, center, baseDamage, maxRadius, minRadius, minPercent);
    }

    /** A death with no killer (self-destruct, void). Delegates to CombatService. */
    public registerSuicideDeath(battle: Battle, client: GameClient): void {
        this.combat.registerSuicideDeath(battle, client);
    }

    public async checkPlayerPosition(client: GameClient): Promise<void> {
        const { user, currentBattle, battlePosition } = client;
        if (!user || !currentBattle || !battlePosition) return;

        // Anti-clip: a tank inside a solid wall/structure shouldn't happen — log on enter/leave (debug
        // + a hook for wall-hack / building-clip detection). Logged on state change to avoid spam.
        const obstacle = this.collision.obstacleAt(currentBattle.mapResourceId, battlePosition);
        if (obstacle !== client.insideObstacle) {
            if (obstacle) logger.warn(`[collision] ${user.username} is INSIDE collision ${obstacle} at (${battlePosition.x | 0},${battlePosition.y | 0},${battlePosition.z | 0})`);
            else logger.info(`[collision] ${user.username} left collision at (${battlePosition.x | 0},${battlePosition.y | 0},${battlePosition.z | 0})`);
            client.insideObstacle = obstacle;
        }

        // During the round-finish freeze nobody may pick up the flag or trigger kill/void zones — the
        // carrier's flag just fell right under them and would otherwise be re-grabbed instantly.
        if (currentBattle.roundState === BattleRoundState.FINISHED) return;

        this.ctf.checkFlagInteractions(client);
        this.bonus.checkPickup(client);

        const geometries = mapGeometries[currentBattle.mapResourceId];
        if (!geometries) return;

        for (const box of geometries) {
            const isInside =
                battlePosition.x >= box.minX &&
                battlePosition.x <= box.maxX &&
                battlePosition.y >= box.minY &&
                battlePosition.y <= box.maxY &&
                battlePosition.z >= box.minZ &&
                battlePosition.z <= box.maxZ;

            if (isInside) {
                await this.handleSpecialGeometryAction(client, box.action);
                break;
            }
        }
    }

    private async handleSpecialGeometryAction(client: GameClient, action: "kill" | "kick"): Promise<void> {
        const { user, currentBattle } = client;
        if (!user || !currentBattle) return;

        logger.info(`User ${user.username} entered a special geometry zone with action: ${action}`);

        if (action === "kill") {
            if (currentBattle.flagCarrierRed?.id === user.id) {
                this.ctf.returnFlagToBase(currentBattle, "RED");
            }
            if (currentBattle.flagCarrierBlue?.id === user.id) {
                this.ctf.returnFlagToBase(currentBattle, "BLUE");
            }
            if (client.battleState === "suicide") return;

            client.battleState = "suicide";
            client.battleIncarnation++;

            // Falling into the void destroys the tank — counts as a death on the scoreboard.
            this.registerSuicideDeath(currentBattle, client);

            const destroyPacket = new DestroyTankPacket(user.username, 3000);

            const allParticipants = currentBattle.getAllParticipants();
            allParticipants.forEach((p: UserDocument) => {
                const pClient = this.server.findClientByUsername(p.username);
                if (pClient && pClient.currentBattle?.battleId === currentBattle.battleId) {
                    pClient.sendPacket(destroyPacket);
                }
            });
        } else if (action === "kick") {
            logger.warn(`Usuário ${user.username} foi kickado por entrar em uma área proibida.`);
            setTimeout(() => client.closeConnection(), 100);
        }
    }

    public broadcastSpectatorListUpdate(battle: Battle, excludeClient?: GameClient): void {
        const spectatorNames = battle.spectators.map((s) => s.username);
        const spectatorListString = spectatorNames.join("\n");
        const packet = new UpdateSpectatorListPacket(spectatorListString);

        for (const spectator of battle.spectators) {
            if (excludeClient && spectator.id === excludeClient.user?.id) {
                continue;
            }
            const spectatorClient = this.server.findClientByUsername(spectator.username);
            if (spectatorClient && spectatorClient.isSpectator) {
                spectatorClient.sendPacket(packet);
            }
        }
        logger.info(`Broadcasted spectator list update for battle ${battle.battleId}`);
    }

    public announceTankRemoval(user: UserDocument, battle: Battle, lastPosition: IVector3 | null): void {
        this.dropFlag(user, battle, lastPosition);

        // Notify remaining players that this user left the battle (shown in the stats list),
        // then remove their tank object. Team modes (TDM/CTF/CP) use a different "left"
        // packet id than DM. The official server sends the "left" notice before the removal.
        const disconnectPacket: IPacket = battle.isTeamMode()
            ? new UserDisconnectTeamPacket(user.username)
            : new UserDisconnectedDmPacket(user.username);
        const removeTankPacket = new RemoveTankPacket(user.username);

        // Established clients only: a still-loading client never received this tank, and its
        // entry snapshot already excludes the departed player.
        battle.broadcast(disconnectPacket, user.id);
        battle.broadcast(removeTankPacket, user.id);
    }

    public async finalizeBattleExit(user: UserDocument, battle: Battle, friendsToNotify?: string[], isSpectator: boolean = false): Promise<void> {
        if (!isSpectator) {
            const battleDetailWatchers = this.server.getClients().filter((c) => (c.getState() === "chat_lobby" || c.getState() === "battle_lobby") && c.lastViewedBattleId === battle.battleId);
            if (battleDetailWatchers.length > 0) {
                const removeUserPacket = new LobbyPackets.RemoveUserFromBattleLobbyPacket({ battleId: battle.battleId, nickname: user.username });
                for (const watcher of battleDetailWatchers) {
                    watcher.sendPacket(removeUserPacket);
                }
            }

            if (battle.settings.battleMode === BattleMode.DM) {
                this.server.broadcastToBattleList(new LobbyPackets.ReleasePlayerSlotDmPacket({ battleId: battle.battleId, nickname: user.username }));
            } else {
                this.server.broadcastToBattleList(new LobbyPackets.OnReleaseSlotTeamPacket(battle.battleId, user.username));
            }
        }

        let friends: string[] = friendsToNotify || [];
        if (!friendsToNotify) {
            const populatedUser = await user.populate<{ friends: UserDocument[] }>("friends");
            friends = populatedUser.friends.map((f) => f.username);
        }

        if (friends.length > 0) {
            const userNotInBattlePacket = new LobbyPackets.UserNotInBattlePacket(user.username);
            for (const friendUsername of friends) {
                const friendClient = this.server.findClientByUsername(friendUsername);
                if (friendClient) {
                    friendClient.sendPacket(userNotInBattlePacket);
                }
            }
        }

        this.removeUserFromBattle(user, battle);
    }

    public handlePlayerDisconnection(client: GameClient): void {
        const { user, currentBattle, isSpectator, battlePosition } = client;
        if (!user || !currentBattle) return;

        if (isSpectator) {
            logger.info(`Spectator ${user.username} disconnected from battle ${currentBattle.battleId}. Finalizing immediately.`);
            this.finalizeDisconnection(user, currentBattle, isSpectator);
        } else {
            logger.info(`Player ${user.username} disconnected from battle ${currentBattle.battleId}. Starting 1-minute reconnect timer.`);
            this.announceTankRemoval(user, currentBattle, battlePosition);

            const timeoutId = setTimeout(() => {
                logger.info(`Reconnect timer for ${user.username} expired. Finalizing disconnection.`);
                this.disconnectedPlayers.delete(user.id);
                this.finalizeDisconnection(user, currentBattle, isSpectator);
            }, 60000);

            this.disconnectedPlayers.set(user.id, { battleId: currentBattle.battleId, timeoutId });
        }
    }

    public handlePlayerReconnection(user: UserDocument): { battleId: string } | null {
        const disconnectedInfo = this.disconnectedPlayers.get(user.id);
        if (disconnectedInfo) {
            logger.info(`Player ${user.username} reconnected in time.`);
            clearTimeout(disconnectedInfo.timeoutId);
            this.disconnectedPlayers.delete(user.id);
            return { battleId: disconnectedInfo.battleId };
        }
        return null;
    }

    private async finalizeDisconnection(user: UserDocument, battle: Battle, isSpectator: boolean): Promise<void> {
        await this.finalizeBattleExit(user, battle, undefined, isSpectator);
    }

    /** Start the empty-battle removal countdown (a player-created battle nobody is in is removed after
     *  EMPTY_BATTLE_REMOVAL_MS). Called at creation (so a never-joined battle expires) and whenever a
     *  battle becomes empty. System battles ("Batalha para Novatos") are kept. Cancelled on join. */
    public scheduleEmptyRemoval(battle: Battle): void {
        if (battle.isSystem || battle.timers.has("emptyRemoval")) return;
        battle.timers.set("emptyRemoval", EMPTY_BATTLE_REMOVAL_MS, () => this._removeEmptyBattle(battle));
    }

    /** Empty player-created battle that stayed empty for the timeout: remove it from the list + state. */
    private _removeEmptyBattle(battle: Battle): void {
        if (battle.isSystem) return;
        if ([...battle.users, ...battle.usersBlue, ...battle.usersRed].length > 0) return; // someone rejoined
        logger.info(`Removing empty battle ${battle.battleId} after ${EMPTY_BATTLE_REMOVAL_MS / 1000}s idle.`);
        battle.timers.clearAll(); // no dangling timers once the battle is gone
        // Remove it from everyone's battle list, and close the detail panel for anyone previewing it
        // (else they'd try to join a battle that no longer exists).
        this.server.broadcastToBattleList(new LobbyPackets.RemoveBattleFromListPacket(battle.battleId));
        const hidePacket = new LobbyPackets.HideBattleInfoPacket(battle.battleId);
        for (const c of this.server.getClients()) {
            if ((c.getState() === "chat_lobby" || c.getState() === "battle_lobby") && c.lastViewedBattleId === battle.battleId) {
                c.sendPacket(hidePacket);
                c.lastViewedBattleId = null;
            }
        }
        this.lobbyService.removeBattle(battle.battleId);
    }

    public addUserToBattle(user: UserDocument, battleId: string, teamIndex: number): Battle {
        const battle = this.lobbyService.getBattleById(battleId);
        if (!battle) throw new Error("A batalha selecionada não existe mais.");

        // Someone joined — cancel any pending empty-battle removal.
        battle.timers.clear("emptyRemoval");

        const settings = battle.settings;
        if (user.rank < settings.minRank || user.rank > settings.maxRank) {
            throw new Error("Seu rank não é compatível com esta batalha.");
        }

        const allParticipants = battle.getAllParticipants();
        const isAlreadyInBattle = allParticipants.some((p) => p.id === user.id);

        if (isAlreadyInBattle) {
            throw new Error("Você já está nesta batalha.");
        }

        const activePlayersCount = battle.users.length + battle.usersBlue.length + battle.usersRed.length;
        const capacity = Math.min(settings.maxPeopleCount, BattleService.MAX_TANKS_PER_BATTLE);
        if (activePlayersCount >= capacity) {
            throw new Error("Esta batalha está cheia.");
        }

        if (battle.isTeamMode()) {
            if (teamIndex === 0) battle.usersRed.push(user);
            else if (teamIndex === 1) battle.usersBlue.push(user);
            else throw new Error("Time inválido selecionado.");
        } else {
            battle.users.push(user);
        }

        if ([...battle.users, ...battle.usersBlue, ...battle.usersRed].length === 1 && !battle.roundStarted) {
            battle.roundStartTime = Date.now();
            this.round.startRoundTimer(battle); // -> RUNNING
            logger.info(`Round started for battle ${battle.battleId}.`);
        }

        logger.info(`User ${user.username} added to battle ${battle.battleId}`);
        return battle;
    }

    public addSpectatorToBattle(user: UserDocument, battleId: string): Battle {
        const battle = this.lobbyService.getBattleById(battleId);
        if (!battle) throw new Error("A batalha selecionada não existe mais.");

        const allParticipants = battle.getAllParticipants();
        const isAlreadyInBattle = allParticipants.some((p) => p.id === user.id);

        if (isAlreadyInBattle) {
            throw new Error("Você já está nesta batalha.");
        }

        battle.spectators.push(user);
        logger.info(`User ${user.username} added to battle ${battle.battleId} as a spectator`);

        return battle;
    }

    public removeUserFromBattle(user: UserDocument, battle: Battle): void {
        const userId = user.id;

        const wasSpectator = battle.spectators.some((s) => s.id === userId);

        battle.users = battle.users.filter((u) => u.id !== userId);
        battle.usersBlue = battle.usersBlue.filter((u) => u.id !== userId);
        battle.usersRed = battle.usersRed.filter((u) => u.id !== userId);
        battle.spectators = battle.spectators.filter((u) => u.id !== userId);

        if (wasSpectator) {
            this.broadcastSpectatorListUpdate(battle);
        }

        if ([...battle.users, ...battle.usersBlue, ...battle.usersRed].length === 0) {
            battle.roundState = BattleRoundState.WAITING;
            battle.roundStartTime = null;
            this.ctf.clearReturnTimers(battle);
            battle.timers.clear("round");
            battle.timers.clear("finish");
            logger.info(`Battle ${battle.battleId} is now empty. Round stopped and timer reset.`);

            this.scheduleEmptyRemoval(battle);
        }

        logger.info(`User ${user.username} removed from battle ${battle.battleId}`);
    }

    /** Delegates to SpawnService — kept on BattleService so existing callers (the spawn handler and
     *  restartRound) keep working through the facade. */
    public prepareRespawn(client: GameClient): void {
        this.spawn.prepareRespawn(client);
    }

    /** Drops the flag the user is carrying onto the ground beneath them (CtfService). Kept on the
     *  facade because the disconnect/exit handlers and the garage workflow call it. */
    public dropFlag(user: UserDocument, battle: Battle, dropPosition: IVector3 | null): void {
        this.ctf.dropFlag(user, battle, dropPosition);
    }
}