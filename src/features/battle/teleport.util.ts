import { GameClient } from "@/server/game.client";
import { IVector3 } from "@/shared/types/geom/ivector3";
import { MovePacket } from "./battle.packets";

const ZERO = { x: 0, y: 0, z: 0 };
const DEFAULT_SEND_COUNT = 15;
const DEFAULT_INTERVAL_MS = 10;

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
