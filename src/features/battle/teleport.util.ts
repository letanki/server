import { GameClient } from "@/server/game.client";
import { IVector3 } from "@/shared/types/geom/ivector3";
import { MovePacket } from "./battle.packets";

const ZERO = { x: 0, y: 0, z: 0 };
const DEFAULT_SEND_COUNT = 15;
const DEFAULT_INTERVAL_MS = 10;

/**
 * Teleports `client`'s OWN tank to `target` by broadcasting MovePackets (id -64696933) for that tank
 * to EVERYONE in the battle (including the moved client and the caller), so the teleport looks the same
 * in every player's view. The moved client clamps how far its own tank may jump per move, so the same
 * target is re-sent a few times on a short cadence to converge regardless of distance. Stops early if
 * the player leaves the battle.
 */
export function teleportTank(client: GameClient, target: IVector3, sendCount = DEFAULT_SEND_COUNT, intervalMs = DEFAULT_INTERVAL_MS): void {
    const battle = client.currentBattle;
    if (!client.user || !battle) return;
    const battleId = battle.battleId;

    const sendOnce = (): boolean => {
        const b = client.currentBattle;
        if (!client.user || !b || b.battleId !== battleId) return false;
        b.broadcast(new MovePacket({
            nickname: client.user.username,
            angularVelocity: ZERO,
            control: 0,
            linearVelocity: ZERO,
            orientation: client.battleOrientation ?? ZERO,
            position: target,
        }));
        client.battlePosition = target;
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
