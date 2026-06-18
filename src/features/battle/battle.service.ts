import * as LobbyPackets from "@/features/lobby/lobby.packets";
import { LobbyService } from "@/features/lobby/lobby.service";
import * as ProfilePackets from "@/features/profile/profile.packets";
import { IPacket } from "@/packets/packet.interfaces";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { UserDocument } from "@/shared/models/user.model";
import { IVector3 } from "@/shared/types/geom/ivector3";
import { mapGeometries } from "@/types/mapGeometries";
import { mapSpawns } from "@/types/mapSpawns";
import { ItemUtils } from "@/utils/item.utils";
import logger from "@/utils/logger";
import { Battle, BattleMode } from "./battle.model";
import { CaptureFlagPacket, DamageIndicatorPacket, DestroyTankPacket, DropFlagPacket, KillPacket, RemoveTankPacket, ReturnFlagPacket, SetCtfScorePacket, SetHealthPacket, TakeFlagPacket, UpdateBattleUserDMPacket, UpdateSpectatorListPacket, UserDisconnectedDmPacket, UserDisconnectTeamPacket } from "./battle.packets";

const KILL_RESPAWN_MS = 3000;
const KILL_SCORE = 10; // in-battle scoreboard points per kill (tune later)
const KILL_XP = 10; // rank experience per kill (tune later)

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
    private server: GameServer;
    private lobbyService: LobbyService;

    constructor(server: GameServer, lobbyService: LobbyService) {
        this.server = server;
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
    public async applyDamage(battle: Battle, shooterClient: GameClient, targetClient: GameClient, realDamage: number): Promise<void> {
        const targetUser = targetClient.user;
        if (!targetUser || targetClient.battleState !== "active" || realDamage <= 0) return;

        const hullHP = ItemUtils.getHullArmor(targetUser);
        targetClient.currentHealth -= (realDamage * 10000) / hullHP;

        this.broadcastToBattle(battle, new SetHealthPacket({ nickname: targetUser.username, health: Math.round(targetClient.currentHealth) }));
        this.broadcastToBattle(battle, new DamageIndicatorPacket(targetUser.username, Math.round(realDamage), 2));
        logger.info(`${shooterClient.user?.username} hit ${targetUser.username}: ${Math.round(realDamage)} dmg (hull ${hullHP}hp) -> ${Math.round(targetClient.currentHealth)}/10000`);

        if (targetClient.currentHealth <= 0) {
            await this._handleKill(battle, shooterClient, targetClient);
        }
    }

    /**
     * Area (splash) damage from an explosion at `center` (world position). Every active tank —
     * INCLUDING the shooter (you can blow yourself up) — within `minRadius` takes damage: full up
     * to `maxRadius`, then linearly down to `minPercent`% at `minRadius`, nothing beyond. World
     * distance is scaled by SPLASH_WORLD_SCALE so a direct hit (~150u from center) stays inside
     * maxRadius and the splash reaches ~nearby tanks — calibrate this if the radius feels off.
     */
    public async applySplashDamage(battle: Battle, shooterClient: GameClient, center: IVector3, baseDamage: number, maxRadius: number, minRadius: number, minPercent: number): Promise<void> {
        const SPLASH_WORLD_SCALE = 10;
        for (const targetClient of [...battle.clients]) {
            if (targetClient.isDestroyed || targetClient.battleState !== "active" || !targetClient.battlePosition) continue;
            const dx = targetClient.battlePosition.x - center.x;
            const dy = targetClient.battlePosition.y - center.y;
            const dz = targetClient.battlePosition.z - center.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) / SPLASH_WORLD_SCALE;

            let factor: number;
            if (distance <= maxRadius) factor = 1;
            else if (distance <= minRadius) factor = 1 - (1 - minPercent / 100) * ((distance - maxRadius) / (minRadius - maxRadius));
            else continue;

            await this.applyDamage(battle, shooterClient, targetClient, baseDamage * factor);
        }
    }

    private async _handleKill(battle: Battle, killerClient: GameClient, victimClient: GameClient): Promise<void> {
        const killer = killerClient.user;
        const victim = victimClient.user;
        if (!killer || !victim) return;

        victimClient.battleState = "suicide";

        // Kill notice (victim, killer, respawn delay) — drives the death on every client.
        this.broadcastToBattle(battle, new KillPacket(victim.username, killer.username, KILL_RESPAWN_MS));

        // Scoreboard: victim +1 death, killer +1 kill and score.
        victimClient.deaths++;
        this.broadcastToBattle(battle, new UpdateBattleUserDMPacket({ deaths: victimClient.deaths, kills: victimClient.kills, score: victimClient.battleScore, nickname: victim.username }));

        // No self/team-kill credit (relevant once team mode lands).
        if (killer.id !== victim.id) {
            killerClient.kills++;
            killerClient.battleScore += KILL_SCORE;
            killer.experience += KILL_XP;
            await killer.save();
            killerClient.sendPacket(new ProfilePackets.UpdateScorePacket(killer.experience));
        }
        this.broadcastToBattle(battle, new UpdateBattleUserDMPacket({ deaths: killerClient.deaths, kills: killerClient.kills, score: killerClient.battleScore, nickname: killer.username }));

        logger.info(`${killer.username} killed ${victim.username} in battle ${battle.battleId}.`);
    }

    private _clearFlagReturnTimer(battle: Battle, flagTeam: "RED" | "BLUE"): void {
        const timerProp = flagTeam === "RED" ? "flagReturnTimerRed" : "flagReturnTimerBlue";
        if (battle[timerProp]) {
            clearTimeout(battle[timerProp]!);
            battle[timerProp] = null;
            logger.info(`Cleared auto-return timer for ${flagTeam} flag in battle ${battle.battleId}`);
        }
    }

    private _resetFlagState(battle: Battle, flagTeam: "RED" | "BLUE"): void {
        const flagPositionProp = flagTeam === "RED" ? "flagPositionRed" : "flagPositionBlue";
        const flagBasePositionProp = flagTeam === "RED" ? "flagBasePositionRed" : "flagBasePositionBlue";
        const carrierProp = flagTeam === "RED" ? "flagCarrierRed" : "flagCarrierBlue";
        const lastDroppedProp = flagTeam === "RED" ? "flagLastDroppedByRed" : "flagLastDroppedByBlue";

        battle[flagPositionProp] = battle[flagBasePositionProp];
        battle[carrierProp] = null;
        battle[lastDroppedProp] = null;
        this._clearFlagReturnTimer(battle, flagTeam);
    }

    public returnFlagToBase(battle: Battle, flagTeam: "RED" | "BLUE", returningUser: UserDocument | null = null): void {
        const teamId = flagTeam === "RED" ? 0 : 1;
        const flagPositionProp = flagTeam === "RED" ? "flagPositionRed" : "flagPositionBlue";
        const flagBasePositionProp = flagTeam === "RED" ? "flagBasePositionRed" : "flagBasePositionBlue";
        const carrierProp = flagTeam === "RED" ? "flagCarrierRed" : "flagCarrierBlue";

        if (battle[flagPositionProp] === battle[flagBasePositionProp] && !battle[carrierProp]) {
            return;
        }

        this._resetFlagState(battle, flagTeam);

        const nickname = returningUser ? returningUser.username : null;
        logger.info(`${flagTeam} flag returned to base in battle ${battle.battleId}. Triggered by: ${nickname ?? "auto-timer/event"}`);

        const returnPacket = new ReturnFlagPacket({ team: teamId, nickname });
        this.broadcastToBattle(battle, returnPacket);
    }

    public captureFlag(user: UserDocument, battle: Battle, capturedFlagTeam: "RED" | "BLUE"): void {
        const carrierProp = capturedFlagTeam === "RED" ? "flagCarrierRed" : "flagCarrierBlue";
        if (battle[carrierProp]?.id !== user.id) return;

        const capturingTeamId = capturedFlagTeam === "RED" ? 1 : 0;
        const capturingTeamName = capturingTeamId === 0 ? "RED" : "BLUE";

        logger.info(`Team ${capturingTeamName} (${user.username}) captured the ${capturedFlagTeam} flag in battle ${battle.battleId}`);

        const capturePacket = new CaptureFlagPacket({ team: capturingTeamId, nickname: user.username });
        this.broadcastToBattle(battle, capturePacket);

        // Update and broadcast the capturing team's flag score (CTF scoreboard).
        if (capturingTeamName === "RED") {
            battle.scoreRed++;
        } else {
            battle.scoreBlue++;
        }
        const newScore = capturingTeamName === "RED" ? battle.scoreRed : battle.scoreBlue;
        this.broadcastToBattle(battle, new SetCtfScorePacket(capturingTeamId, newScore));

        this._resetFlagState(battle, capturedFlagTeam);
    }

    public async checkPlayerPosition(client: GameClient): Promise<void> {
        const { user, currentBattle, battlePosition } = client;
        if (!user || !currentBattle || !battlePosition) return;

        if (currentBattle.settings.battleMode === BattleMode.CTF) {
            if (client.battleState !== "active") return;

            const PICKUP_RADIUS_SQ = 500 * 500;
            const isOnRedTeam = currentBattle.usersRed.some((u) => u.id === user.id);
            const isOnBlueTeam = currentBattle.usersBlue.some((u) => u.id === user.id);

            if (isOnRedTeam) {
                if (currentBattle.flagPositionRed && currentBattle.flagBasePositionRed && currentBattle.flagPositionRed.x !== currentBattle.flagBasePositionRed.x) {
                    const dx = battlePosition.x - currentBattle.flagPositionRed.x;
                    const dy = battlePosition.y - currentBattle.flagPositionRed.y;
                    const dz = battlePosition.z - currentBattle.flagPositionRed.z;
                    if (dx * dx + dy * dy + dz * dz < PICKUP_RADIUS_SQ) {
                        this.returnFlagToBase(currentBattle, "RED", user);
                    }
                }
                if (currentBattle.flagCarrierBlue?.id === user.id && currentBattle.flagBasePositionRed) {
                    const dx = battlePosition.x - currentBattle.flagBasePositionRed.x;
                    const dy = battlePosition.y - currentBattle.flagBasePositionRed.y;
                    const dz = battlePosition.z - currentBattle.flagBasePositionRed.z;
                    if (dx * dx + dy * dy + dz * dz < PICKUP_RADIUS_SQ) {
                        this.captureFlag(user, currentBattle, "BLUE");
                    }
                }
            } else if (isOnBlueTeam) {
                if (currentBattle.flagPositionBlue && currentBattle.flagBasePositionBlue && currentBattle.flagPositionBlue.x !== currentBattle.flagBasePositionBlue.x) {
                    const dx = battlePosition.x - currentBattle.flagPositionBlue.x;
                    const dy = battlePosition.y - currentBattle.flagPositionBlue.y;
                    const dz = battlePosition.z - currentBattle.flagPositionBlue.z;
                    if (dx * dx + dy * dy + dz * dz < PICKUP_RADIUS_SQ) {
                        this.returnFlagToBase(currentBattle, "BLUE", user);
                    }
                }
                if (currentBattle.flagCarrierRed?.id === user.id && currentBattle.flagBasePositionBlue) {
                    const dx = battlePosition.x - currentBattle.flagBasePositionBlue.x;
                    const dy = battlePosition.y - currentBattle.flagBasePositionBlue.y;
                    const dz = battlePosition.z - currentBattle.flagBasePositionBlue.z;
                    if (dx * dx + dy * dy + dz * dz < PICKUP_RADIUS_SQ) {
                        this.captureFlag(user, currentBattle, "RED");
                    }
                }
            }

            if (currentBattle.flagPositionRed) {
                const dx = battlePosition.x - currentBattle.flagPositionRed.x;
                const dy = battlePosition.y - currentBattle.flagPositionRed.y;
                const dz = battlePosition.z - currentBattle.flagPositionRed.z;
                if (dx * dx + dy * dy + dz * dz < PICKUP_RADIUS_SQ) {
                    try {
                        this.takeFlag(user, currentBattle, "RED");
                    } catch (e: any) { }
                }
            }

            if (currentBattle.flagPositionBlue) {
                const dx = battlePosition.x - currentBattle.flagPositionBlue.x;
                const dy = battlePosition.y - currentBattle.flagPositionBlue.y;
                const dz = battlePosition.z - currentBattle.flagPositionBlue.z;
                if (dx * dx + dy * dy + dz * dz < PICKUP_RADIUS_SQ) {
                    try {
                        this.takeFlag(user, currentBattle, "BLUE");
                    } catch (e: any) { }
                }
            }
        }

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
                this.returnFlagToBase(currentBattle, "RED");
            }
            if (currentBattle.flagCarrierBlue?.id === user.id) {
                this.returnFlagToBase(currentBattle, "BLUE");
            }
            if (client.battleState === "suicide") return;

            client.battleState = "suicide";
            client.battleIncarnation++;

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

    public getSpawnPoint(battle: Battle, team: "DM" | "BLUE" | "RED"): { position: IVector3; rotation: IVector3 } {
        const allMapSpawns = mapSpawns[battle.mapResourceId];
        if (!allMapSpawns || allMapSpawns.length === 0) {
            logger.warn(`No spawn points found for map ${battle.mapResourceId}. Using fallback.`);
            return { position: { x: 0, y: 0, z: 200 }, rotation: { x: 0, y: 0, z: 0 } };
        }

        const teamType = team.toLowerCase();
        let candidateSpawns;

        if (battle.settings.battleMode === BattleMode.CP) {
            candidateSpawns = allMapSpawns.filter((sp) => sp.type.toLowerCase() === "dom");
        } else {
            candidateSpawns = allMapSpawns.filter((sp) => sp.type.toLowerCase() === teamType);
        }

        if (candidateSpawns.length === 0) {
            logger.warn(`No specific spawn points of type for this mode on map ${battle.mapResourceId}. Using all available as fallback.`);
            candidateSpawns = allMapSpawns;
        }

        const activePlayers = this.server.getClients().filter((c) => c.currentBattle?.battleId === battle.battleId && c.battleState === "active" && c.battlePosition);
        const occupiedPositions = activePlayers.map((p) => p.battlePosition!);

        const isOccupied = (spawnPos: IVector3) => {
            const MIN_SPAWN_DISTANCE_SQ = 100 * 100;
            for (const playerPos of occupiedPositions) {
                const dx = spawnPos.x - playerPos.x;
                const dy = spawnPos.y - playerPos.y;
                const dz = spawnPos.z - playerPos.z;
                if (dx * dx + dy * dy + dz * dz < MIN_SPAWN_DISTANCE_SQ) {
                    return true;
                }
            }
            return false;
        };

        let availableSpawns = candidateSpawns.filter((sp) => !isOccupied(sp.position));

        if (availableSpawns.length === 0) {
            logger.warn(`All candidate spawn points are occupied. Using any candidate as fallback.`);
            availableSpawns = candidateSpawns;
        }

        const randomIndex = Math.floor(Math.random() * availableSpawns.length);
        const chosenSpawn = availableSpawns[randomIndex];

        return { position: chosenSpawn.position, rotation: chosenSpawn.rotation };
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
                const releaseSlotPacket = new LobbyPackets.ReleasePlayerSlotDmPacket({ battleId: battle.battleId, nickname: user.username });
                this.server.broadcastToBattleList(releaseSlotPacket);
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

    public addUserToBattle(user: UserDocument, battleId: string, teamIndex: number): Battle {
        const battle = this.lobbyService.getBattleById(battleId);
        if (!battle) throw new Error("A batalha selecionada não existe mais.");

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
            battle.roundStarted = true;
            battle.roundStartTime = Date.now();
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
            battle.roundStarted = false;
            battle.roundStartTime = null;
            this._clearFlagReturnTimer(battle, "RED");
            this._clearFlagReturnTimer(battle, "BLUE");
            logger.info(`Battle ${battle.battleId} is now empty. Round stopped and timer reset.`);
        }

        logger.info(`User ${user.username} removed from battle ${battle.battleId}`);
    }

    public takeFlag(user: UserDocument, battle: Battle, flagTeam: "RED" | "BLUE"): void {
        const now = Date.now();
        const lastDroppedByRed = battle.flagLastDroppedByRed;
        const lastDroppedByBlue = battle.flagLastDroppedByBlue;

        if (flagTeam === "BLUE" && lastDroppedByBlue && lastDroppedByBlue.userId === user.id && now - lastDroppedByBlue.timestamp < 5000) {
            throw new Error("Cannot pick up the flag so soon after dropping it.");
        }
        if (flagTeam === "RED" && lastDroppedByRed && lastDroppedByRed.userId === user.id && now - lastDroppedByRed.timestamp < 5000) {
            throw new Error("Cannot pick up the flag so soon after dropping it.");
        }

        const teamId = flagTeam === "RED" ? 0 : 1;

        const isOnRedTeam = battle.usersRed.some((u) => u.id === user.id);
        const isOnBlueTeam = battle.usersBlue.some((u) => u.id === user.id);

        if ((flagTeam === "RED" && isOnRedTeam) || (flagTeam === "BLUE" && isOnBlueTeam)) {
            throw new Error("Cannot take your own team's flag.");
        }

        const flagPositionProp = flagTeam === "RED" ? "flagPositionRed" : "flagPositionBlue";
        if (battle[flagPositionProp]) {
            this._clearFlagReturnTimer(battle, flagTeam);
        }

        if (flagTeam === "RED") {
            if (battle.flagCarrierRed) throw new Error("Red flag is already taken.");
            battle.flagCarrierRed = user;
            battle.flagPositionRed = null;
        } else {
            if (battle.flagCarrierBlue) throw new Error("Blue flag is already taken.");
            battle.flagCarrierBlue = user;
            battle.flagPositionBlue = null;
        }

        logger.info(`User ${user.username} took the ${flagTeam} flag in battle ${battle.battleId}`);

        const takeFlagPacket = new TakeFlagPacket(user.username, teamId);
        this.broadcastToBattle(battle, takeFlagPacket);
    }

    public dropFlag(user: UserDocument, battle: Battle, dropPosition: IVector3 | null): void {
        if (!dropPosition) {
            logger.warn(`Attempted to drop flag for ${user.username} but no drop position was provided.`);
            return;
        }

        let droppedTeamId: number | null = null;
        let teamName: string | null = null;

        if (battle.flagCarrierRed?.id === user.id) {
            battle.flagCarrierRed = null;
            battle.flagPositionRed = dropPosition;
            battle.flagLastDroppedByRed = { userId: user.id, timestamp: Date.now() };
            droppedTeamId = 0;
            teamName = "RED";
        } else if (battle.flagCarrierBlue?.id === user.id) {
            battle.flagCarrierBlue = null;
            battle.flagPositionBlue = dropPosition;
            battle.flagLastDroppedByBlue = { userId: user.id, timestamp: Date.now() };
            droppedTeamId = 1;
            teamName = "BLUE";
        }

        if (droppedTeamId !== null) {
            logger.info(`User ${user.username} dropped the ${teamName} flag in battle ${battle.battleId} at ${JSON.stringify(dropPosition)}`);
            const dropFlagPacket = new DropFlagPacket(dropPosition, droppedTeamId);
            this.broadcastToBattle(battle, dropFlagPacket);

            const flagTeamTyped = teamName as "RED" | "BLUE";
            this._clearFlagReturnTimer(battle, flagTeamTyped);
            const timerProp = flagTeamTyped === "RED" ? "flagReturnTimerRed" : "flagReturnTimerBlue";

            battle[timerProp] = setTimeout(() => {
                this.returnFlagToBase(battle, flagTeamTyped);
            }, 30000);

            logger.info(`Started 30s auto-return timer for ${teamName} flag in battle ${battle.battleId}`);
        }
    }
}