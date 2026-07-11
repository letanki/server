import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IVector3 } from "@/shared/types/geom/ivector3";
import { BattleEvents } from "./battle-events";
import { Battle, BattleMode, IDomPointState } from "./battle.model";
import { PointCaptureStartedPacket, PointCaptureStoppedPacket, PointScoreChangedPacket, PointStateChangedPacket, PointTankEnteredPacket, PointTankLeftPacket, SetCtfScorePacket } from "./battle.packets";
import { RoundService } from "./round.service";
import { pointCaptureScore } from "./scoring";
import { awardScore } from "./score-award";
import logger from "@/utils/logger";

const DOM_TICK_MS = 1000; // capture loop interval (1s)
const CAPTURE_RATE = 20; // meter change per second PER net player (matches official). net = blue - red
const DECAY_RATE = 5; // when a partially-captured point is left empty, it drifts back to neutral this fast
const DOM_SCORE_INTERVAL_MS = 10000; // each owned point gives its team +1 score every 10s
const STATE_RED = 0;
const STATE_BLUE = 1;
const STATE_NEUTRAL = 2;

/**
 * Domination (Control Point) runtime: tracks which tanks stand on each point (enter/leave packets) and
 * runs the capture loop — a point held by one team alone fills toward that team, flips owner at 100,
 * neutralizes an enemy-held point at 0. Point definitions/state live on battle.domPoints (built from
 * mapDomKeypoints when a CP battle is created). Team scoring/win is not wired yet.
 */
export class DominationService {
    constructor(private readonly server: GameServer, private readonly round: RoundService, events: BattleEvents) {
        events.on("roundRestarted", ({ battle }) => this.resetRound(battle));
        events.on("tankDestroyed", ({ battle, client }) => {
            if (client.user) this.removeTankFromPoints(battle, client.user.username);
        });
    }

    /** Starts the per-battle capture + team-scoring loops (CP battles only). */
    public startLoop(battle: Battle): void {
        if (battle.settings.battleMode !== BattleMode.CP || battle.domPoints.length === 0) return;
        battle.timers.set("domTick", DOM_TICK_MS, () => this._tick(battle));
        battle.timers.set("domScore", DOM_SCORE_INTERVAL_MS, () => this._scoreTick(battle));
    }

    public stopLoop(battle: Battle): void {
        battle.timers.clear("domTick");
        battle.timers.clear("domScore");
    }

    /** On round restart: reset every point to neutral and the team scores to 0, and tell the clients. */
    public resetRound(battle: Battle): void {
        if (battle.settings.battleMode !== BattleMode.CP) return;
        for (const point of battle.domPoints) {
            point.state = STATE_NEUTRAL;
            point.score = 0;
            point.scoreChangeRate = 0;
            point.tanksOnPoint = [];
            battle.broadcast(new PointStateChangedPacket({ pointId: point.id, state: STATE_NEUTRAL }));
            battle.broadcast(new PointScoreChangedPacket({ pointId: point.id, score: 0, scoreChangeRate: 0 }));
        }
        battle.scoreRed = 0;
        battle.scoreBlue = 0;
        battle.broadcast(new SetCtfScorePacket({ team: STATE_RED, score: 0 }));
        battle.broadcast(new SetCtfScorePacket({ team: STATE_BLUE, score: 0 }));
    }

    /** Awards +1 to each owned point's team, broadcasts the team scores, and ends the round on the limit. */
    private _scoreTick(battle: Battle): void {
        let redGained = 0;
        let blueGained = 0;
        for (const point of battle.domPoints) {
            if (point.state === STATE_RED) redGained++;
            else if (point.state === STATE_BLUE) blueGained++;
        }
        if (redGained > 0) { battle.scoreRed += redGained; battle.broadcast(new SetCtfScorePacket({ team: STATE_RED, score: battle.scoreRed })); }
        if (blueGained > 0) { battle.scoreBlue += blueGained; battle.broadcast(new SetCtfScorePacket({ team: STATE_BLUE, score: battle.scoreBlue })); }

        const limit = battle.settings.scoreLimit;
        if (limit > 0 && (battle.scoreRed >= limit || battle.scoreBlue >= limit)) {
            this.round.finishRound(battle);
            return; // round is finishing; stop the scoring loop
        }
        battle.timers.set("domScore", DOM_SCORE_INTERVAL_MS, () => this._scoreTick(battle)); // re-arm
    }

    /** Per-position update: emit enter/leave as the tank crosses a point's radius (for the client display). */
    public checkPointOccupancy(client: GameClient): void {
        const { user, currentBattle: battle, battlePosition } = client;
        if (!user || !battle || !battlePosition || battle.settings.battleMode !== BattleMode.CP || client.battleState !== "active") return;

        for (const point of battle.domPoints) {
            const within = this._inRange(point, battlePosition);
            const idx = point.tanksOnPoint.findIndex((u) => u.id === user.id);
            if (within && idx === -1) {
                point.tanksOnPoint.push(user);
                battle.broadcast(new PointTankEnteredPacket({ pointId: point.id, nickname: user.username }));
            } else if (!within && idx !== -1) {
                point.tanksOnPoint.splice(idx, 1);
                battle.broadcast(new PointTankLeftPacket({ pointId: point.id, nickname: user.username }));
            }
        }
    }

    /** Removes a tank from every point it was on (on death/leave), emitting the leave packets. */
    public removeTankFromPoints(battle: Battle, username: string): void {
        for (const point of battle.domPoints) {
            const idx = point.tanksOnPoint.findIndex((u) => u.username === username);
            if (idx !== -1) {
                point.tanksOnPoint.splice(idx, 1);
                battle.broadcast(new PointTankLeftPacket({ pointId: point.id, nickname: username }));
            }
        }
    }

    private _tick(battle: Battle): void {
        for (const point of battle.domPoints) {
            this._tickPoint(battle, point);
        }
        battle.timers.set("domTick", DOM_TICK_MS, () => this._tick(battle)); // re-arm
    }

    private _tickPoint(battle: Battle, point: IDomPointState): void {
        // ACTIVE tanks of each team actually standing on the point right now (kept as client lists so a
        // capture/neutralization can split its reward among the allies who were on the point).
        const redClients: GameClient[] = [];
        const blueClients: GameClient[] = [];
        for (const c of battle.clients) {
            if (c.isDestroyed || c.battleState !== "active" || !c.user || !c.battlePosition) continue;
            if (!this._inRange(point, c.battlePosition)) continue;
            const team = battle.teamOf(c.user);
            if (team === STATE_RED) redClients.push(c);
            else if (team === STATE_BLUE) blueClients.push(c);
        }
        const red = redClients.length;
        const blue = blueClients.length;

        const prev = point.score;
        let targetRate: number;
        if (red === 0 && blue === 0) {
            // Empty point: a PARTIALLY-captured meter slowly drifts back to neutral. A fully-owned point
            // (±100) and an already-neutral point (0) just hold; a contested point (handled below) freezes.
            if (prev > 0 && prev < 100) targetRate = -DECAY_RATE;
            else if (prev < 0 && prev > -100) targetRate = DECAY_RATE;
            else targetRate = 0;
        } else {
            // Net imbalance drives the meter toward that team (negative = red, positive = blue), at a speed
            // proportional to the difference: 1 extra player = normal, equal counts = frozen (rate 0).
            targetRate = (blue - red) * CAPTURE_RATE;
        }

        let next = Math.max(-100, Math.min(100, prev + targetRate)); // tick is 1s
        if (red === 0 && blue === 0) {
            // Don't let the decay overshoot past neutral.
            if (prev > 0) next = Math.max(0, next);
            else if (prev < 0) next = Math.min(0, next);
        }
        point.score = next;
        const moved = point.score - prev;

        // Owner changes only at the thresholds: -100 = red, +100 = blue, crossing 0 = neutral.
        let newState = point.state;
        if (point.score <= -100) newState = STATE_RED;
        else if (point.score >= 100) newState = STATE_BLUE;
        else if (prev < 0 && point.score >= 0) newState = STATE_NEUTRAL;
        else if (prev > 0 && point.score <= 0) newState = STATE_NEUTRAL;
        if (newState !== point.state) {
            // Which team performed this? Capture → the new owner; neutralization (crossing 0) → the team
            // pushing across it (opposite of the previous owner side). Split 2×enemy among that team's
            // allies who were on the point. A decay-driven neutral (nobody on point) awards no one.
            const actingTeam = newState === STATE_RED ? STATE_RED : newState === STATE_BLUE ? STATE_BLUE : (prev < 0 ? STATE_BLUE : STATE_RED);
            this._awardPointCapture(battle, actingTeam, actingTeam === STATE_RED ? redClients : blueClients);

            point.state = newState as 0 | 1 | 2;
            battle.broadcast(new PointStateChangedPacket({ pointId: point.id, state: point.state }));
        }

        // The client extrapolates the bar from the last (score, rate), so only re-send when the rate
        // changes (occupancy change) or the meter hit a cap (animation must stop).
        const broadcastRate = moved === targetRate ? targetRate : 0; // capped at ±100 => 0
        if (broadcastRate !== point.scoreChangeRate) {
            // Capture start/stop sounds: fire when the meter starts or stops moving, tagged with the
            // team it's moving toward (negative = red, positive = blue).
            if (point.scoreChangeRate === 0 && broadcastRate !== 0) {
                battle.broadcast(new PointCaptureStartedPacket({ team: broadcastRate < 0 ? STATE_RED : STATE_BLUE }));
            } else if (point.scoreChangeRate !== 0 && broadcastRate === 0) {
                battle.broadcast(new PointCaptureStoppedPacket({ team: point.scoreChangeRate < 0 ? STATE_RED : STATE_BLUE }));
            }
            point.scoreChangeRate = broadcastRate;
            battle.broadcast(new PointScoreChangedPacket({ pointId: point.id, score: point.score, scoreChangeRate: broadcastRate }));
        }
    }

    /**
     * On a capture/neutralization, splits `2 × enemy` (enemy = connected enemy-team players) among the
     * acting team's allies who were on the point — `pointCaptureScore` gives the per-ally share. Each
     * gets Score + XP via the shared funnel. No allies (decay-driven neutral) or no enemies → no award.
     */
    private _awardPointCapture(battle: Battle, actingTeam: number, allies: GameClient[]): void {
        if (allies.length === 0) return;
        const enemyTeamId = actingTeam === STATE_RED ? STATE_BLUE : STATE_RED;
        const enemyCount = [...battle.clients].filter((c) => !c.isDestroyed && c.user && battle.teamOf(c.user) === enemyTeamId).length;
        const per = Math.round(pointCaptureScore(enemyCount, allies.length));
        if (per <= 0) return;
        for (const c of allies) awardScore(battle, c, per).catch((e) => logger.error(`Point capture award failed: ${e}`));
    }

    private _inRange(point: IDomPointState, pos: IVector3): boolean {
        const dx = point.position.x - pos.x;
        const dy = point.position.y - pos.y;
        const dz = point.position.z - pos.z;
        return dx * dx + dy * dy + dz * dz <= point.radius * point.radius;
    }
}
