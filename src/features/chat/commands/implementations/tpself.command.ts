import { teleportTank } from "@/features/battle/teleport.util";
import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/** Visual TP: moves your tank only on YOUR screen — others keep the old position. Pair with /relay off
 *  if you stay at the new spot without wanting others to catch up via MoveCommands. */
export default class TpSelfCommand implements ICommand {
    name = "tpself";
    description = "TP visual: move seu tanque só para você (não para os outros). Uso: /tpself <x> <y> <z>.";
    permissionLevel = ChatModeratorLevel.MODERATOR;
    usage = "<x> <y> <z>";
    example = "/tpself 100 0 200";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const client = context.executor;
        if (!client.user || !client.currentBattle) {
            context.reply("Você precisa estar em uma batalha.");
            return;
        }
        if (args.length < 3) {
            context.reply("Uso: /tpself <x> <y> <z>.");
            return;
        }

        const x = Number(args[0]);
        const y = Number(args[1]);
        const z = Number(args[2]);
        if ([x, y, z].some((n) => Number.isNaN(n))) {
            context.reply("Coordenadas inválidas. Uso: /tpself <x> <y> <z>.");
            return;
        }

        teleportTank(client, { x, y, z }, { audience: "self" });
        const hint = client.relayPosition
            ? " Relay ainda LIGADO — use /relay off se não quiser que os outros vejam sua posição real ao se mover."
            : "";
        context.reply(`TP visual só para você em (${x}, ${y}, ${z}).${hint}`);
    }
}
