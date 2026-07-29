import { GameClient } from "@/server/game.client";
import { IVector3 } from "@/shared/types/geom/ivector3";
import { MovePacket } from "./battle.packets";

const ZERO = { x: 0, y: 0, z: 0 };
const DEFAULT_SEND_COUNT = 15;
const DEFAULT_INTERVAL_MS = 10;
const FLY_TICK_MS = 50;
const FLY_ARRIVE = 5; // units — snap + stop when this close
const DEFAULT_FLY_SPEED = 800; // units/sec (~walk-fast through air)

/** Who receives the MovePacket burst that snaps the tank on screen. */
export type TeleportAudience = "all" | "others" | "self";

export interface TeleportOptions {
    sendCount?: number;
    intervalMs?: number;
    /** Default `all` — same view for everyone, including the moved client. */
    audience?: TeleportAudience;
    /**
     * Whether to write `client.battlePosition` to the target. Default true for `all` (real TP);
     * visual-only audiences (`others`/`self`) default to false so server combat stays on the real track.
     */
    updateServerPosition?: boolean;
}

/**
 * Teleports `client`'s tank to `target` via MovePackets (id -64696933). The moved client clamps how
 * far its own tank may jump per move, so the same target is re-sent a few times on a short cadence
 * to converge regardless of distance. Stops early if the player leaves the battle.
 *
 * - `all` (default): everyone including self — real teleport.
 * - `others`: only other clients — visual offset for them; your screen unchanged.
 * - `self`: only you — your screen jumps; others keep the old position.
 */
export function teleportTank(client: GameClient, target: IVector3, options: TeleportOptions = {}): void {
    const battle = client.currentBattle;
    if (!client.user || !battle) return;
    const battleId = battle.battleId;
    const audience = options.audience ?? "all";
    const sendCount = options.sendCount ?? DEFAULT_SEND_COUNT;
    const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
    const updateServerPosition = options.updateServerPosition ?? audience === "all";

    const sendOnce = (): boolean => {
        const b = client.currentBattle;
        if (!client.user || !b || b.battleId !== battleId) return false;
        const packet = new MovePacket({
            nickname: client.user.username,
            angularVelocity: ZERO,
            control: 0,
            linearVelocity: ZERO,
            orientation: client.battleOrientation ?? ZERO,
            position: target,
        });
        if (audience === "self") {
            client.sendPacket(packet);
        } else if (audience === "others") {
            b.broadcast(packet, client.user.id);
        } else {
            b.broadcast(packet);
        }
        if (updateServerPosition) client.battlePosition = target;
        return true;
    };

    sendOnce();
    let sent = 1;
    const interval = setInterval(() => {
        if (sent >= sendCount || !sendOnce()) {
            clearInterval(interval);
            return;
        }
        sent++;
    }, intervalMs);
}

/** Cancels an in-progress /flyto glide. */
export function stopFly(client: GameClient): boolean {
    if (!client.flyTimer) return false;
    clearInterval(client.flyTimer);
    client.flyTimer = null;
    return true;
}

/**
 * Glides the tank toward `target` at `speed` units/sec, stepping every FLY_TICK_MS with MovePackets
 * (velocity + position) so it looks like walking through the air. While active, client Move/FullMove
 * are ignored (see battle.handlers). Replaces any previous fly on this client.
 */
export function flyTankTo(client: GameClient, target: IVector3, speed = DEFAULT_FLY_SPEED): void {
    const battle = client.currentBattle;
    if (!client.user || !battle || !client.battlePosition) return;
    const battleId = battle.battleId;
    stopFly(client);

    const tick = (): void => {
        const b = client.currentBattle;
        if (!client.user || !b || b.battleId !== battleId || !client.battlePosition) {
            stopFly(client);
            return;
        }
        const pos = client.battlePosition;
        const dx = target.x - pos.x;
        const dy = target.y - pos.y;
        const dz = target.z - pos.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist <= FLY_ARRIVE) {
            b.broadcast(new MovePacket({
                nickname: client.user.username,
                angularVelocity: ZERO,
                control: 0,
                linearVelocity: ZERO,
                orientation: client.battleOrientation ?? ZERO,
                position: { ...target },
            }));
            client.battlePosition = { ...target };
            stopFly(client);
            return;
        }
        const step = Math.min(speed * (FLY_TICK_MS / 1000), dist);
        const inv = 1 / dist;
        const vx = dx * inv * speed;
        const vy = dy * inv * speed;
        const vz = dz * inv * speed;
        const next = { x: pos.x + dx * inv * step, y: pos.y + dy * inv * step, z: pos.z + dz * inv * step };
        b.broadcast(new MovePacket({
            nickname: client.user.username,
            angularVelocity: ZERO,
            control: 0,
            linearVelocity: { x: vx, y: vy, z: vz },
            orientation: client.battleOrientation ?? ZERO,
            position: next,
        }));
        client.battlePosition = next;
    };

    tick();
    client.flyTimer = setInterval(tick, FLY_TICK_MS);
}
