import { GameClient } from "@/server/game.client";
import { UserDocument } from "@/shared/models/user.model";
import { IVector3 } from "@/shared/types/geom/ivector3";
import { hullCollision } from "@/generated/hullCollision";
import logger from "@/utils/logger";
import { Battle, BattleMode } from "./battle.model";
import { BattleEvents } from "./battle-events";
import { CollisionService } from "./collision.service";
import { CaptureFlagPacket, DropFlagPacket, ReturnFlagPacket, SetCtfScorePacket, TakeFlagPacket } from "./battle.packets";

// Flag pickup/capture proximity, built from the REAL hull collision box (generated from the .3ds
// models — mammoth's box is bigger than wasp's) oriented by the tank, plus an occlusion check so a
// flag can't be grabbed through a wall or from another pavement.
const FLAG_PICKUP_MARGIN = 100; // slack beyond the hull edge — flag has its own footprint
// Vertical reach, asymmetric: the flag can be well BELOW the tank (you ramp/jump over it and still
// touch it), only a little ABOVE. Cross-level grabs are stopped by occlusion, not by a tight bound.
const FLAG_PICKUP_DOWN = 600;
const FLAG_PICKUP_UP = 160;
// Tweak if testing shows the box is rotated 90° (depends on the tank yaw convention vs the model's
// forward axis): 0 = model +Y is forward, Math.PI/2 swaps width/length.
const HULL_YAW_OFFSET = 0;
const HULL_FALLBACK = { halfX: 165, halfY: 270, zMin: 0, zMax: 180 };
const CAPTURE_SCORE_PER_ENEMY = 10; // capturing a flag is worth this much per player on the enemy team
const FLAG_RETURN_DELAY_MS = 30000; // a dropped flag auto-returns to base after this
const FLAG_PICKUP_COOLDOWN_MS = 5000; // can't re-grab a flag you just dropped, for this long

/**
 * Capture-the-flag mechanics: take/drop/capture/return + the auto-return timers and the proximity
 * test. Reacts to a kill via the bus (a victim's carried flag drops where they died) and emits
 * `flagCaptured` on a capture so the lobby preview / score-limit listeners pick it up. Extracted from
 * BattleService; depends only on map geometry (CollisionService) and the bus — no back-references.
 */
export class CtfService {
    constructor(private readonly events: BattleEvents, private readonly collision: CollisionService) {
        // A flag the victim was carrying drops where they died.
        this.events.on("kill", ({ battle, victimClient }) => {
            if (victimClient.user && victimClient.battlePosition) {
                this.dropFlag(victimClient.user, battle, victimClient.battlePosition);
            }
        });
    }

    /** CTF interactions for a tank's current position: pick up the enemy flag, return your dropped
     *  flag, or score by bringing the enemy flag to your base. No-op outside CTF / when not active. */
    public checkFlagInteractions(client: GameClient): void {
        const { user, currentBattle } = client;
        if (!user || !currentBattle) return;
        if (currentBattle.settings.battleMode !== BattleMode.CTF) return;
        if (client.battleState !== "active") return;

        const isOnRedTeam = currentBattle.usersRed.some((u) => u.id === user.id);
        const isOnBlueTeam = currentBattle.usersBlue.some((u) => u.id === user.id);

        if (isOnRedTeam) {
            // Stepping on your own dropped flag returns it; reaching your base with the enemy flag scores.
            if (currentBattle.flagPositionRed && currentBattle.flagBasePositionRed && currentBattle.flagPositionRed.x !== currentBattle.flagBasePositionRed.x && this._nearFlag(client, currentBattle.flagPositionRed)) {
                this.returnFlagToBase(currentBattle, "RED", user);
            }
            if (currentBattle.flagCarrierBlue?.id === user.id && this._isOwnFlagAtBase(currentBattle, "RED") && currentBattle.flagBasePositionRed && this._nearFlag(client, currentBattle.flagBasePositionRed)) {
                this.captureFlag(client, currentBattle, "BLUE");
            }
        } else if (isOnBlueTeam) {
            if (currentBattle.flagPositionBlue && currentBattle.flagBasePositionBlue && currentBattle.flagPositionBlue.x !== currentBattle.flagBasePositionBlue.x && this._nearFlag(client, currentBattle.flagPositionBlue)) {
                this.returnFlagToBase(currentBattle, "BLUE", user);
            }
            if (currentBattle.flagCarrierRed?.id === user.id && this._isOwnFlagAtBase(currentBattle, "BLUE") && currentBattle.flagBasePositionBlue && this._nearFlag(client, currentBattle.flagBasePositionBlue)) {
                this.captureFlag(client, currentBattle, "RED");
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

    public takeFlag(user: UserDocument, battle: Battle, flagTeam: "RED" | "BLUE"): void {
        const now = Date.now();
        const lastDroppedByRed = battle.flagLastDroppedByRed;
        const lastDroppedByBlue = battle.flagLastDroppedByBlue;

        if (flagTeam === "BLUE" && lastDroppedByBlue && lastDroppedByBlue.userId === user.id && now - lastDroppedByBlue.timestamp < FLAG_PICKUP_COOLDOWN_MS) {
            throw new Error("Cannot pick up the flag so soon after dropping it.");
        }
        if (flagTeam === "RED" && lastDroppedByRed && lastDroppedByRed.userId === user.id && now - lastDroppedByRed.timestamp < FLAG_PICKUP_COOLDOWN_MS) {
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

        const takeFlagPacket = new TakeFlagPacket({ nickname: user.username, team: teamId });
        battle.broadcast(takeFlagPacket);
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
        battle.broadcast(new DropFlagPacket({ position: groundPos, team: droppedTeamId }));

        battle.timers.set(`flagReturn:${teamName}`, FLAG_RETURN_DELAY_MS, () => this.returnFlagToBase(battle, teamName));
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

        battle.broadcast(new ReturnFlagPacket({ team: teamId, nickname }));
    }

    public captureFlag(client: GameClient, battle: Battle, capturedFlagTeam: "RED" | "BLUE"): void {
        const user = client.user;
        if (!user) return;
        const carrierProp = capturedFlagTeam === "RED" ? "flagCarrierRed" : "flagCarrierBlue";
        if (battle[carrierProp]?.id !== user.id) return;

        const capturingTeamId = capturedFlagTeam === "RED" ? 1 : 0;
        const capturingTeamName = capturingTeamId === 0 ? "RED" : "BLUE";

        // Classic CTF rule: you can only score the enemy flag while your OWN flag is home at base.
        if (!this._isOwnFlagAtBase(battle, capturingTeamName)) return;

        // Credit the capturer with battle score so captures count toward their individual share of the
        // end-of-round crystal payout. A capture is worth CAPTURE_SCORE_PER_ENEMY per CONNECTED player on
        // the enemy team (the team whose flag was captured) — e.g. 10 enemies => 100 points. Players who
        // closed the game without leaving are no longer in battle.clients, so they don't count.
        const enemyTeamId = capturedFlagTeam === "RED" ? 0 : 1;
        const enemyCount = [...battle.clients].filter((c) => !c.isDestroyed && c.user && battle.teamOf(c.user) === enemyTeamId).length;
        client.battleScore += CAPTURE_SCORE_PER_ENEMY * enemyCount;

        logger.info(`Team ${capturingTeamName} (${user.username}) captured the ${capturedFlagTeam} flag in battle ${battle.battleId}`);

        battle.broadcast(new CaptureFlagPacket({ team: capturingTeamId, nickname: user.username }));

        // Update and broadcast the capturing team's flag score (CTF scoreboard).
        if (capturingTeamName === "RED") {
            battle.scoreRed++;
        } else {
            battle.scoreBlue++;
        }
        const newScore = capturingTeamName === "RED" ? battle.scoreRed : battle.scoreBlue;
        battle.broadcast(new SetCtfScorePacket({ team: capturingTeamId, score: newScore }));

        this._resetFlagState(battle, capturedFlagTeam);

        // Preview + score-limit reactions are decoupled via the bus.
        this.events.emit("flagCaptured", { battle, capturingTeamId, newScore });
    }

    /** Clears both flags' pending auto-return timers (e.g. when the battle empties out). */
    public clearReturnTimers(battle: Battle): void {
        this._clearFlagReturnTimer(battle, "RED");
        this._clearFlagReturnTimer(battle, "BLUE");
    }

    private _clearFlagReturnTimer(battle: Battle, flagTeam: "RED" | "BLUE"): void {
        battle.timers.clear(`flagReturn:${flagTeam}`);
    }

    /** A team's OWN flag is home: at its base position and not carried by anyone (required to score). */
    private _isOwnFlagAtBase(battle: Battle, team: "RED" | "BLUE"): boolean {
        const pos = team === "RED" ? battle.flagPositionRed : battle.flagPositionBlue;
        const base = team === "RED" ? battle.flagBasePositionRed : battle.flagBasePositionBlue;
        const carrier = team === "RED" ? battle.flagCarrierRed : battle.flagCarrierBlue;
        return !carrier && !!pos && !!base && pos.x === base.x && pos.y === base.y;
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
}
