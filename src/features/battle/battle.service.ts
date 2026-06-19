import * as LobbyPackets from "@/features/lobby/lobby.packets";
import { LobbyService } from "@/features/lobby/lobby.service";
import { LobbyWorkflow } from "@/features/lobby/lobby.workflow";
import * as ProfilePackets from "@/features/profile/profile.packets";
import { IPacket } from "@/packets/packet.interfaces";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { UserDocument } from "@/shared/models/user.model";
import { IVector3 } from "@/shared/types/geom/ivector3";
import { hullCollision } from "@/types/hullCollision";
import { CollisionService } from "./collision.service";
import { mapGeometries } from "@/types/mapGeometries";
import { mapSpawns } from "@/types/mapSpawns";
import { ItemUtils } from "@/utils/item.utils";
import logger from "@/utils/logger";
import { Battle, BattleMode } from "./battle.model";
import { CaptureFlagPacket, DamageIndicatorPacket, DestroyTankPacket, DropFlagPacket, EffectStoppedPacket, FinishBattlePacket, KillPacket, PrepareToSpawnPacket, RemoveTankPacket, RestartRoundDmPacket, RestartRoundTeamPacket, ReturnFlagPacket, SetCtfScorePacket, SetHealthPacket, SetRoundTimePacket, TakeFlagPacket, TankSpecificationPacket, UpdateBattleUserDMPacket, UpdateBattleUserTeamPacket, UpdateSpectatorListPacket, UserDisconnectedDmPacket, UserDisconnectTeamPacket } from "./battle.packets";

const KILL_RESPAWN_MS = 3000;
// Flag pickup/capture proximity, built from the REAL hull collision box (generated from the .3ds
// models — mammoth's box is bigger than wasp's) oriented by the tank, plus an occlusion check so a
// flag can't be grabbed through a wall or from another pavement.
const FLAG_PICKUP_MARGIN = 100; // slack beyond the hull edge — flag has its own footprint
// Vertical reach, asymmetric: the flag can be well BELOW the tank (you ramp/jump over it and still
// touch it), only a little ABOVE. Cross-level grabs are stopped by occlusion, not by a tight bound.
const FLAG_PICKUP_DOWN = 300;
const FLAG_PICKUP_UP = 160;
// Tweak if testing shows the box is rotated 90° (depends on the tank yaw convention vs the model's
// forward axis): 0 = model +Y is forward, Math.PI/2 swaps width/length.
const HULL_YAW_OFFSET = 0;
const HULL_FALLBACK = { halfX: 165, halfY: 270, zMin: 0, zMax: 180 };
const KILL_SCORE = 10; // in-battle scoreboard points per kill (tune later)
const KILL_XP = 10; // rank experience per kill (tune later)
const EMPTY_BATTLE_REMOVAL_MS = 60000; // a player-created battle left empty this long is removed
const ROUND_FINISH_PAUSE_MS = 10000; // results screen before a finished round restarts

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
        if (battle.roundFinishTimer) return; // no damage/kills during the round-finish freeze

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

        // If the victim was carrying a flag (CTF), it drops where they died (dropFlag lowers it to
        // the ground at that spot).
        if (victimClient.battlePosition) {
            this.dropFlag(victim, battle, victimClient.battlePosition);
        }

        // Scoreboard: victim +1 death, killer +1 kill and score.
        victimClient.deaths++;
        this._broadcastUserStat(battle, victimClient, victim);

        // No self/team-kill credit.
        if (killer.id !== victim.id) {
            killerClient.kills++;
            killerClient.battleScore += KILL_SCORE;
            killer.experience += KILL_XP;
            await killer.save();
            killerClient.sendPacket(new ProfilePackets.UpdateScorePacket(killer.experience));
        }
        this._broadcastUserStat(battle, killerClient, killer);

        logger.info(`${killer.username} killed ${victim.username} in battle ${battle.battleId}.`);

        // Lobby preview watchers: the scorer's individual score, and (team modes) the team score.
        if (killer.id !== victim.id) {
            this._sendToWatchers(battle, new LobbyPackets.UpdateUserScorePacket(battle.battleId, killer.username, killerClient.battleScore));
        }

        // Kill-based score limit (DM = individual kills; team non-CTF = team's total kills).
        const limit = battle.settings.scoreLimit;
        if (killer.id !== victim.id && battle.settings.battleMode !== BattleMode.CTF) {
            const team = this._teamOf(battle, killer);
            const teamKills = battle.isTeamMode()
                ? [...battle.clients].filter((c) => c.user && this._teamOf(battle, c.user) === team).reduce((sum, c) => sum + c.kills, 0)
                : killerClient.kills;
            if (battle.isTeamMode()) {
                this._sendToWatchers(battle, new LobbyPackets.UpdateTeamScorePacket(battle.battleId, team, teamKills));
            }
            if (limit > 0 && teamKills >= limit) this.finishRound(battle);
        }
    }

    /** A death with no killer (self-destruct, void): +1 death on the scoreboard, no kill credit. */
    public registerSuicideDeath(battle: Battle, client: GameClient): void {
        if (!client.user) return;
        client.deaths++;
        this._broadcastUserStat(battle, client, client.user);
    }

    private _teamOf(battle: Battle, user: UserDocument): number {
        if (battle.usersRed.some((u) => u.id === user.id)) return 0;
        if (battle.usersBlue.some((u) => u.id === user.id)) return 1;
        return 2;
    }

    /** Broadcasts a player's kills/deaths/score using the DM or team scoreboard packet for the mode. */
    private _broadcastUserStat(battle: Battle, client: GameClient, user: UserDocument): void {
        const data = { deaths: client.deaths, kills: client.kills, score: client.battleScore, nickname: user.username };
        if (battle.isTeamMode()) {
            this.broadcastToBattle(battle, new UpdateBattleUserTeamPacket({ ...data, team: this._teamOf(battle, user) }));
        } else {
            this.broadcastToBattle(battle, new UpdateBattleUserDMPacket(data));
        }
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
        // Lobby preview watchers see the team score rise too.
        this._sendToWatchers(battle, new LobbyPackets.UpdateTeamScorePacket(battle.battleId, capturingTeamId, newScore));

        this._resetFlagState(battle, capturedFlagTeam);

        // Score limit reached -> end the round.
        if (battle.settings.scoreLimit > 0 && newScore >= battle.settings.scoreLimit) {
            this.finishRound(battle);
        }
    }

    /** Tank close enough to pick up / interact with a flag: the flag falls inside the tank's REAL
     *  hull collision box (per-hull, oriented by the tank yaw) plus a small margin, at roughly the
     *  same height, AND nothing solid is between the tank and the flag. Hull box from the .3ds
     *  models; collision from the map's <collision-geometry>. */
    private _nearFlag(client: GameClient, flagPos: IVector3): boolean {
        const tankPos = client.battlePosition;
        if (!tankPos || !client.currentBattle) return false;
        const dx = flagPos.x - tankPos.x;
        const dy = flagPos.y - tankPos.y;

        // Rotate the flag offset into the hull's local frame (yaw around z) and test the oriented box.
        const yaw = (client.battleOrientation?.z ?? 0) + HULL_YAW_OFFSET;
        const cos = Math.cos(yaw), sin = Math.sin(yaw);
        const localX = dx * cos + dy * sin;   // along hull width  (model X)
        const localY = -dx * sin + dy * cos;  // along hull length (model Y)
        const hull = hullCollision[client.user?.equippedHull ?? ""] ?? HULL_FALLBACK;
        if (Math.abs(localX) >= hull.halfX + FLAG_PICKUP_MARGIN) return false;
        if (Math.abs(localY) >= hull.halfY + FLAG_PICKUP_MARGIN) return false;
        const dz = tankPos.z - flagPos.z; // >0 = flag below the tank
        if (dz > FLAG_PICKUP_DOWN || dz < -FLAG_PICKUP_UP) return false;

        return !this.collision.isBlockedBetween(client.currentBattle.mapResourceId, tankPos, flagPos);
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
        if (currentBattle.roundFinishTimer) return;

        if (currentBattle.settings.battleMode === BattleMode.CTF) {
            if (client.battleState !== "active") return;

            const isOnRedTeam = currentBattle.usersRed.some((u) => u.id === user.id);
            const isOnBlueTeam = currentBattle.usersBlue.some((u) => u.id === user.id);

            if (isOnRedTeam) {
                // Stepping on your own dropped flag returns it; reaching your base with the enemy flag scores.
                if (currentBattle.flagPositionRed && currentBattle.flagBasePositionRed && currentBattle.flagPositionRed.x !== currentBattle.flagBasePositionRed.x && this._nearFlag(client, currentBattle.flagPositionRed)) {
                    this.returnFlagToBase(currentBattle, "RED", user);
                }
                if (currentBattle.flagCarrierBlue?.id === user.id && currentBattle.flagBasePositionRed && this._nearFlag(client, currentBattle.flagBasePositionRed)) {
                    this.captureFlag(user, currentBattle, "BLUE");
                }
            } else if (isOnBlueTeam) {
                if (currentBattle.flagPositionBlue && currentBattle.flagBasePositionBlue && currentBattle.flagPositionBlue.x !== currentBattle.flagBasePositionBlue.x && this._nearFlag(client, currentBattle.flagPositionBlue)) {
                    this.returnFlagToBase(currentBattle, "BLUE", user);
                }
                if (currentBattle.flagCarrierRed?.id === user.id && currentBattle.flagBasePositionBlue && this._nearFlag(client, currentBattle.flagBasePositionBlue)) {
                    this.captureFlag(user, currentBattle, "RED");
                }
            }

            // Touching the enemy flag picks it up.
            if (currentBattle.flagPositionRed && this._nearFlag(client, currentBattle.flagPositionRed)) {
                try { this.takeFlag(user, currentBattle, "RED"); } catch (e: any) { }
            }
            if (currentBattle.flagPositionBlue && this._nearFlag(client, currentBattle.flagPositionBlue)) {
                try { this.takeFlag(user, currentBattle, "BLUE"); } catch (e: any) { }
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
        if (battle.isSystem || battle.emptyRemovalTimer) return;
        battle.emptyRemovalTimer = setTimeout(() => this._removeEmptyBattle(battle), EMPTY_BATTLE_REMOVAL_MS);
    }

    /** Empty player-created battle that stayed empty for the timeout: remove it from the list + state. */
    private _removeEmptyBattle(battle: Battle): void {
        battle.emptyRemovalTimer = null;
        if (battle.isSystem) return;
        if ([...battle.users, ...battle.usersBlue, ...battle.usersRed].length > 0) return; // someone rejoined
        logger.info(`Removing empty battle ${battle.battleId} after ${EMPTY_BATTLE_REMOVAL_MS / 1000}s idle.`);
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
        if (battle.emptyRemovalTimer) {
            clearTimeout(battle.emptyRemovalTimer);
            battle.emptyRemovalTimer = null;
        }

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
            this._startRoundTimer(battle);
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
            if (battle.roundTimer) { clearTimeout(battle.roundTimer); battle.roundTimer = null; }
            if (battle.roundFinishTimer) { clearTimeout(battle.roundFinishTimer); battle.roundFinishTimer = null; }
            logger.info(`Battle ${battle.battleId} is now empty. Round stopped and timer reset.`);

            this.scheduleEmptyRemoval(battle);
        }

        logger.info(`User ${user.username} removed from battle ${battle.battleId}`);
    }

    /** Lobby clients currently watching this battle's preview (battle-details panel). */
    private _battleWatchers(battle: Battle): GameClient[] {
        return this.server.getClients().filter((c) => (c.getState() === "chat_lobby" || c.getState() === "battle_lobby") && c.lastViewedBattleId === battle.battleId);
    }
    private _sendToWatchers(battle: Battle, packet: IPacket): void {
        for (const w of this._battleWatchers(battle)) w.sendPacket(packet);
    }

    private _startRoundTimer(battle: Battle): void {
        if (battle.roundTimer) clearTimeout(battle.roundTimer);
        const limit = battle.settings.timeLimitInSec;
        this.broadcastToBattle(battle, new SetRoundTimePacket(limit));
        if (limit > 0) {
            battle.roundTimer = setTimeout(() => this.finishRound(battle), limit * 1000);
        }
    }

    /** End the round (time or score limit): broadcast final standings, then restart after the pause. */
    public finishRound(battle: Battle): void {
        if (battle.roundFinishTimer) return; // already finishing
        if (battle.roundTimer) { clearTimeout(battle.roundTimer); battle.roundTimer = null; }

        const nicknames = [...battle.clients].filter((c) => c.user && !c.isSpectator).map((c) => c.user!.username);
        this.broadcastToBattle(battle, new FinishBattlePacket(nicknames, ROUND_FINISH_PAUSE_MS / 1000));
        // Lobby preview watchers: the running timer they see should reset.
        this._sendToWatchers(battle, new LobbyPackets.RoundFinishPacket(battle.battleId));

        // Carried flags fall (CTF).
        if (battle.settings.battleMode === BattleMode.CTF) {
            for (const carrier of [battle.flagCarrierRed, battle.flagCarrierBlue]) {
                if (carrier) this.dropFlag(carrier, battle, this.server.findClientByUsername(carrier.username)?.battlePosition ?? null);
            }
        }
        // Active supply effects clear on every tank.
        for (const c of battle.clients) {
            if (!c.user) continue;
            for (const e of c.activeEffects) this.broadcastToBattle(battle, new EffectStoppedPacket(c.user.username, e.itemIndex));
            c.activeEffects = [];
        }

        logger.info(`Round finished in battle ${battle.battleId}.`);

        battle.roundFinishTimer = setTimeout(() => this.restartRound(battle), ROUND_FINISH_PAUSE_MS);
    }

    /** Restart a finished round: swap sides (team modes), reset scores/flags, respawn everyone, restart timer. */
    public restartRound(battle: Battle): void {
        battle.roundFinishTimer = null;
        if ([...battle.users, ...battle.usersBlue, ...battle.usersRed].length === 0) return; // emptied during the pause

        // Switch sides (team modes): swap the rosters, then re-send them so the client reassigns each
        // player's team in the scoreboard (RestartRoundTeamPacket = field0 red, field1 blue).
        if (battle.isTeamMode()) {
            const red = battle.usersRed;
            battle.usersRed = battle.usersBlue;
            battle.usersBlue = red;
        }

        battle.scoreRed = 0;
        battle.scoreBlue = 0;
        const active = [...battle.clients].filter((c) => c.user && !c.isSpectator);
        for (const c of active) { c.kills = 0; c.deaths = 0; c.battleScore = 0; }

        if (battle.settings.battleMode === BattleMode.CTF) {
            this.returnFlagToBase(battle, "RED");
            this.returnFlagToBase(battle, "BLUE");
            this.broadcastToBattle(battle, new SetCtfScorePacket(0, 0));
            this.broadcastToBattle(battle, new SetCtfScorePacket(1, 0));
        }

        // Rebuild the scoreboard rosters with reset stats + the new team assignment.
        if (battle.isTeamMode()) {
            this.broadcastToBattle(battle, new RestartRoundTeamPacket(battle.usersRed.map((u) => u.username), battle.usersBlue.map((u) => u.username)));
            // Update the battle-list per-team counts: each player moved to the other team's slot.
            for (let team = 0; team < 2; team++) {
                for (const u of (team === 0 ? battle.usersRed : battle.usersBlue)) {
                    this.server.broadcastToBattleList(new LobbyPackets.OnReleaseSlotTeamPacket(battle.battleId, u.username));
                    this.server.broadcastToBattleList(new LobbyPackets.OnReserveSlotTeamPacket(battle.battleId, u.username, team));
                }
            }
        } else {
            this.broadcastToBattle(battle, new RestartRoundDmPacket(battle.users.map((u) => u.username)));
        }

        for (const c of active) {
            this.prepareRespawn(c); // -> client replies ReadyToPlace -> normal spawn finishes the placement
        }

        battle.roundStartTime = Date.now();
        this._startRoundTimer(battle);

        // Refresh the lobby preview for watchers: hide + re-show the battle details. The per-event
        // packets don't refresh the preview panel itself, so the reset timer, reset score and the new
        // team rosters only show up after re-sending BattleDetails (computed from the fresh state).
        for (const w of this._battleWatchers(battle)) {
            w.sendPacket(new LobbyPackets.HideBattleInfoPacket(battle.battleId));
            void LobbyWorkflow.sendBattleDetails(w, this.server, battle);
        }

        logger.info(`Round restarted in battle ${battle.battleId}.`);
    }

    /** Send a player into the spawn flow (spec + PrepareToSpawn). The client replies ReadyToPlace,
     *  which the existing ReadyToPlaceHandler completes. Shared by the spawn handler and round restart. */
    public prepareRespawn(client: GameClient): void {
        const { user, currentBattle: battle } = client;
        if (!user || !battle) return;

        // During the round-finish freeze, hold the spawn — nobody (not even a player joining now) gets
        // PrepareToSpawn until restartRound spawns everyone. restartRound clears roundFinishTimer first,
        // so it isn't blocked by this guard.
        if (battle.roundFinishTimer) return;

        const specs = ItemUtils.getTankSpecifications(user);
        battle.broadcast(new TankSpecificationPacket({ ...specs, nickname: user.username, sequence: ++client.specSequence }));

        let teamType: "DM" | "BLUE" | "RED" = "DM";
        if (battle.isTeamMode()) {
            if (battle.usersBlue.some((u) => u.id === user.id)) teamType = "BLUE";
            if (battle.usersRed.some((u) => u.id === user.id)) teamType = "RED";
        }
        const spawnPoint = this.getSpawnPoint(battle, teamType);
        const finalSpawnPosition = { x: spawnPoint.position.x, y: spawnPoint.position.y, z: spawnPoint.position.z + 200 };
        client.pendingSpawnPoint = { position: finalSpawnPosition, rotation: spawnPoint.rotation };
        client.sendPacket(new PrepareToSpawnPacket(finalSpawnPosition, spawnPoint.rotation));
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

    /** Highest floor surface z at (x,y) that is at/below `fromZ` (the ground under the tank), or
     *  null if there's no floor there — i.e. over the void. Used to drop flags onto the ground. */
    public dropFlag(user: UserDocument, battle: Battle, dropPosition: IVector3 | null): void {
        if (!dropPosition) {
            logger.warn(`Attempted to drop flag for ${user.username} but no drop position was provided.`);
            return;
        }

        // Which flag (if any) is this user carrying?
        const teamName: "RED" | "BLUE" | null = battle.flagCarrierRed?.id === user.id ? "RED" : battle.flagCarrierBlue?.id === user.id ? "BLUE" : null;
        if (!teamName) return;

        // Raycast straight down to the floor under the tank (handles ramps/jumps — the flag lands on
        // the ground below, not in the air). No floor = over the void → the flag returns to base.
        const groundZ = this.collision.raycastGroundZ(battle.mapResourceId, dropPosition.x, dropPosition.y, dropPosition.z);
        if (groundZ === null) {
            logger.info(`${user.username} dropped the ${teamName} flag over the void; returning it to base.`);
            if (teamName === "RED") battle.flagCarrierRed = null;
            else battle.flagCarrierBlue = null;
            this.returnFlagToBase(battle, teamName);
            return;
        }

        const groundPos: IVector3 = { x: dropPosition.x, y: dropPosition.y, z: groundZ };
        const droppedTeamId = teamName === "RED" ? 0 : 1;
        if (teamName === "RED") {
            battle.flagCarrierRed = null;
            battle.flagPositionRed = groundPos;
            battle.flagLastDroppedByRed = { userId: user.id, timestamp: Date.now() };
        } else {
            battle.flagCarrierBlue = null;
            battle.flagPositionBlue = groundPos;
            battle.flagLastDroppedByBlue = { userId: user.id, timestamp: Date.now() };
        }

        logger.info(`User ${user.username} dropped the ${teamName} flag in battle ${battle.battleId} at ${JSON.stringify(groundPos)}`);
        this.broadcastToBattle(battle, new DropFlagPacket(groundPos, droppedTeamId));

        this._clearFlagReturnTimer(battle, teamName);
        const timerProp = teamName === "RED" ? "flagReturnTimerRed" : "flagReturnTimerBlue";
        battle[timerProp] = setTimeout(() => this.returnFlagToBase(battle, teamName), 30000);
    }
}