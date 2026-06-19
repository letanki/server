import { MovePacket } from "@/features/battle/battle.packets";
import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

const ZERO = { x: 0, y: 0, z: 0 };

/** Teleports the caller's own tank to (x,y,z) — all three required — by sending it a MovePacket
 *  (id -64696933). The client clamps how far its own tank may jump per move, so we re-send the same
 *  target a few times on a short cadence to converge. Stops early if the player leaves the battle. */
export default class TpCommand implements ICommand {
    name = "tp";
    description = "Teleporta seu tanque para (x,y,z). Uso: /tp <x> <y> <z>.";
    permissionLevel = ChatModeratorLevel.NONE;

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const client = context.executor;
        if (!client.user || !client.currentBattle) {
            context.reply("Você precisa estar em uma batalha.");
            return;
        }

        if (args.length < 3) {
            context.reply("Uso: /tp <x> <y> <z>.");
            return;
        }

        const x = Number(args[0]);
        const y = Number(args[1]);
        const z = Number(args[2]);
        if ([x, y, z].some((n) => Number.isNaN(n))) {
            context.reply("Coordenadas inválidas. Uso: /tp <x> <y> <z>.");
            return;
        }

        const target = { x, y, z };
        const battleId = client.currentBattle.battleId;

        const SEND_COUNT = 15;
        const SEND_INTERVAL_MS = 10;

        const sendOnce = (): boolean => {
            const battle = client.currentBattle;
            if (!client.user || !battle || battle.battleId !== battleId) return false;
            client.sendPacket(new MovePacket({
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
            if (sent >= SEND_COUNT || !sendOnce()) {
                clearInterval(interval);
                return;
            }
            sent++;
        }, SEND_INTERVAL_MS);

        context.reply(`Teleportando para (${x}, ${y}, ${z})...`);
    }
}
