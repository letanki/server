import { teleportTank } from "@/features/battle/teleport.util";
import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/** Visual TP: moves your tank for OTHER clients only — your own screen stays put. Pair with /relay off
 *  so the next MoveCommand doesn't snap them back to your real position. */
export default class TpOthersCommand implements ICommand {
    name = "tpothers";
    description = "TP visual: move seu tanque só para os outros (não para você). Uso: /tpothers <x> <y> <z>.";
    permissionLevel = ChatModeratorLevel.MODERATOR;
    usage = "<x> <y> <z>";
    example = "/tpothers 100 0 200";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const client = context.executor;
        if (!client.user || !client.currentBattle) {
            context.reply("Você precisa estar em uma batalha.");
            return;
        }
        if (args.length < 3) {
            context.reply("Uso: /tpothers <x> <y> <z>.");
            return;
        }

        const x = Number(args[0]);
        const y = Number(args[1]);
        const z = Number(args[2]);
        if ([x, y, z].some((n) => Number.isNaN(n))) {
            context.reply("Coordenadas inválidas. Uso: /tpothers <x> <y> <z>.");
            return;
        }

        teleportTank(client, { x, y, z }, { audience: "others" });
        const hint = client.relayPosition
            ? " Relay ainda LIGADO — use /relay off para o offset não voltar quando você se mover."
            : "";
        context.reply(`TP visual para os outros em (${x}, ${y}, ${z}).${hint}`);
    }
}
