import * as LobbyPackets from "@/features/lobby/lobby.packets";
import { LobbyService } from "@/features/lobby/lobby.service";
import * as ProfilePackets from "@/features/profile/profile.packets";
import { IPacket } from "@/packets/packet.interfaces";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { UserDocument } from "@/shared/models/user.model";
import { IVector3 } from "@/shared/types/geom/ivector3";
import { hullCollision } from "@/types/hullCollision";
import { mapCollision } from "@/types/mapCollision";
import { mapGeometries } from "@/types/mapGeometries";
import { mapSpawns } from "@/types/mapSpawns";
import { ItemUtils } from "@/utils/item.utils";
import logger from "@/utils/logger";
import { Battle, BattleMode } from "./battle.model";
import { CaptureFlagPacket, DamageIndicatorPacket, DestroyTankPacket, DropFlagPacket, KillPacket, RemoveTankPacket, ReturnFlagPacket, SetCtfScorePacket, SetHealthPacket, TakeFlagPacket, UpdateBattleUserDMPacket, UpdateBattleUserTeamPacket, UpdateSpectatorListPacket, UserDisconnectedDmPacket, UserDisconnectTeamPacket } from "./battle.packets";

const KILL_RESPAWN_MS = 3000;
// Flag pickup/capture proximity, built from the REAL hull collision box (generated from the .3ds
// models — mammoth's box is bigger than wasp's) oriented by the tank, plus an occlusion check so a
// flag can't be grabbed through a wall or from another pavement.
const FLAG_PICKUP_MARGIN = 100; // slack beyond the hull edge — flag has its own footprint
// Vertical reach, asymmetric: the flag can be well BELOW the tank (you ramp/jump over it and still
// touch it), only a little ABOVE. Cross-level grabs are stopped by occlusion, not by a tight bound.
const FLAG_PICKUP_DOWN = 300;
const FLAG_PICKUP_UP = 160;
// When checking if collision is BETWEEN tank and flag, trim this much off each end of the line so
// the surface the flag rests on (and the floor under the tank) — touched only at the endpoints —
// don't count as "in between". Only collision genuinely between the two blocks the pickup.
const OCCLUSION_TRIM = 40;
// Tweak if testing shows the box is rotated 90° (depends on the tank yaw convention vs the model's
// forward axis): 0 = model +Y is forward, Math.PI/2 swaps width/length.
const HULL_YAW_OFFSET = 0;
const HULL_FALLBACK = { halfX: 165, halfY: 270, zMin: 0, zMax: 180 };
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

        this._resetFlagState(battle, capturedFlagTeam);
    }

    /** Is there ANY collision (floor, wall, structure, anything solid) genuinely BETWEEN the tank
     *  and the flag? The straight line is trimmed at both ends (OCCLUSION_TRIM) so the surface the
     *  flag rests on and the floor under the tank — only touched at the endpoints — don't count;
     *  only a box the line passes THROUGH blocks. Single rule for every kind of collision. */
    private _blockedBetween(mapResourceId: string, tankPos: IVector3, flagPos: IVector3): boolean {
        const boxes = mapCollision[mapResourceId];
        if (!boxes) return false;
        const dx = flagPos.x - tankPos.x, dy = flagPos.y - tankPos.y, dz = flagPos.z - tankPos.z;
        const len = Math.hypot(dx, dy, dz);
        const e = len > 0 ? Math.min(0.45, OCCLUSION_TRIM / len) : 0; // trim fraction off each end
        const o = [tankPos.x + dx * e, tankPos.y + dy * e, tankPos.z + dz * e];
        const dir = [dx * (1 - 2 * e), dy * (1 - 2 * e), dz * (1 - 2 * e)];
        for (const b of boxes) {
            const lo = [b.minX, b.minY, b.minZ], hi = [b.maxX, b.maxY, b.maxZ];
            let tmin = 0, tmax = 1, hit = true;
            for (let a = 0; a < 3; a++) {
                if (Math.abs(dir[a]) < 1e-6) {
                    if (o[a] < lo[a] || o[a] > hi[a]) { hit = false; break; }
                } else {
                    let t1 = (lo[a] - o[a]) / dir[a], t2 = (hi[a] - o[a]) / dir[a];
                    if (t1 > t2) [t1, t2] = [t2, t1];
                    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
                    if (tmin > tmax) { hit = false; break; }
                }
            }
            if (hit) return true;
        }
        return false;
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

        return !this._blockedBetween(client.currentBattle.mapResourceId, tankPos, flagPos);
    }

    public async checkPlayerPosition(client: GameClient): Promise<void> {
        const { user, currentBattle, battlePosition } = client;
        if (!user || !currentBattle || !battlePosition) return;

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

    /** Highest floor surface z at (x,y) that is at/below `fromZ` (the ground under the tank), or
     *  null if there's no floor there — i.e. over the void. Used to drop flags onto the ground. */
    private raycastGroundZ(mapResourceId: string, x: number, y: number, fromZ: number): number | null {
        const boxes = mapCollision[mapResourceId];
        if (!boxes) return null;
        let best: number | null = null;
        const ceiling = fromZ + 1; // tiny slack: the tank rests ~89 above its floor, so the top <= fromZ
        for (const b of boxes) {
            if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY || b.maxZ > ceiling) continue;
            if (best === null || b.maxZ > best) best = b.maxZ;
        }
        return best;
    }

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
        const groundZ = this.raycastGroundZ(battle.mapResourceId, dropPosition.x, dropPosition.y, dropPosition.z);
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