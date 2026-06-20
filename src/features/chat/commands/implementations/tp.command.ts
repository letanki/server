import { teleportTank } from "@/features/battle/teleport.util";
import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/** Teleports the caller's own tank to (x,y,z) — all three coordinates required. */
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

        teleportTank(client, { x, y, z });
        context.reply(`Teleportando para (${x}, ${y}, ${z})...`);
    }
}
