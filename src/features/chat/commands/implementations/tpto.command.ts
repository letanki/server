import { teleportTank } from "@/features/battle/teleport.util";
import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/** Teleports the caller to another player's position. Uso: /tpto <username> (case-insensitive). */
export default class TpToCommand implements ICommand {
    name = "tpto";
    description = "Teleporta você até a posição de outro jogador. Uso: /tpto <username>.";
    permissionLevel = ChatModeratorLevel.MODERATOR;
    usage = "<username>";
    example = "/tpto Joao";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const client = context.executor;
        const { server } = context;
        if (!client.user || !client.currentBattle) {
            context.reply("Você precisa estar em uma batalha.");
            return;
        }

        if (args.length < 1) {
            context.reply("Uso: /tpto <username>.");
            return;
        }

        const target = server.findClientByUsername(args[0]);
        if (!target || target.currentBattle?.battleId !== client.currentBattle.battleId) {
            context.reply(`Jogador "${args[0]}" não está nesta batalha.`);
            return;
        }
        if (!target.battlePosition) {
            context.reply(`"${target.user?.username}" não está em campo.`);
            return;
        }

        teleportTank(client, target.battlePosition);
        context.reply(`Teleportando até ${target.user?.username}...`);
    }
}
