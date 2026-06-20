import { teleportTank } from "@/features/battle/teleport.util";
import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/** Teleports another player to the caller's position. Uso: /tphere <username> (case-insensitive). */
export default class TpHereCommand implements ICommand {
    name = "tphere";
    description = "Traz outro jogador até a sua posição. Uso: /tphere <username>.";
    permissionLevel = ChatModeratorLevel.NONE;

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const client = context.executor;
        const { server } = context;
        if (!client.user || !client.currentBattle) {
            context.reply("Você precisa estar em uma batalha.");
            return;
        }

        if (args.length < 1) {
            context.reply("Uso: /tphere <username>.");
            return;
        }

        if (!client.battlePosition) {
            context.reply("Você não está em campo.");
            return;
        }

        const target = server.findClientByUsername(args[0]);
        if (!target || target.currentBattle?.battleId !== client.currentBattle.battleId) {
            context.reply(`Jogador "${args[0]}" não está nesta batalha.`);
            return;
        }

        teleportTank(target, client.battlePosition);
        context.reply(`Trazendo ${target.user?.username} até você...`);
    }
}
