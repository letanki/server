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

/** Cancels /flyto height lock. Returns true if something was active. */
export function stopFly(client: GameClient): boolean {
    const was = client.flyZTarget !== null || client.flyTimer !== null;
    client.flyZTarget = null;
    if (client.flyTimer) {
        clearInterval(client.flyTimer);
        client.flyTimer = null;
    }
    return was;
}

/**
 * Locks/glides only the tank's Z (height) to `targetZ` at `speed` u/s. XY keep coming from the
 * client's Move/FullMove (see battle.handlers — Z is overwritten there). A tick keeps climbing even
 * while standing still. Replaces any previous /flyto on this client.
 */
export function flyTankToZ(client: GameClient, targetZ: number, speed = DEFAULT_FLY_SPEED): void {
    const battle = client.currentBattle;
    if (!client.user || !battle || !client.battlePosition) return;
    const battleId = battle.battleId;
    stopFly(client);
    client.flyZTarget = targetZ;
    client.flyZSpeed = speed;

    const tick = (): void => {
        const b = client.currentBattle;
        const target = client.flyZTarget;
        if (!client.user || !b || b.battleId !== battleId || !client.battlePosition || target === null) {
            stopFly(client);
            return;
        }
        const pos = client.battlePosition;
        const dz = target - pos.z;
        if (Math.abs(dz) <= FLY_ARRIVE) {
            if (pos.z !== target) {
                const locked = { x: pos.x, y: pos.y, z: target };
                b.broadcast(new MovePacket({
                    nickname: client.user.username,
                    angularVelocity: ZERO,
                    control: 0,
                    linearVelocity: ZERO,
                    orientation: client.battleOrientation ?? ZERO,
                    position: locked,
                }));
                client.battlePosition = locked;
            }
            // Stay locked: keep the timer so idle clients don't sink; Move handler also forces Z.
            return;
        }
        const step = Math.min(client.flyZSpeed * (FLY_TICK_MS / 1000), Math.abs(dz));
        const nextZ = pos.z + Math.sign(dz) * step;
        const next = { x: pos.x, y: pos.y, z: nextZ };
        const vz = Math.sign(dz) * client.flyZSpeed;
        b.broadcast(new MovePacket({
            nickname: client.user.username,
            angularVelocity: ZERO,
            control: 0,
            linearVelocity: { x: 0, y: 0, z: vz },
            orientation: client.battleOrientation ?? ZERO,
            position: next,
        }));
        client.battlePosition = next;
    };

    tick();
    client.flyTimer = setInterval(tick, FLY_TICK_MS);
}

/** Effective Z while /flyto is active (locked target, or current if still climbing). */
export function flyZOr(client: GameClient, fallbackZ: number): number {
    if (client.flyZTarget === null) return fallbackZ;
    return client.battlePosition?.z ?? client.flyZTarget;
}

