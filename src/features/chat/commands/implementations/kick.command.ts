import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel, chatModeratorPower } from "@/shared/models/enums/chat-moderator-level.enum";

/** Drops a player's connection. Staff can't kick someone of equal/higher cargo. */
export default class KickCommand implements ICommand {
    name = "kick";
    description = "Derruba a conexão de um jogador. Uso: /kick <username>.";
    permissionLevel = ChatModeratorLevel.MODERATOR;
    usage = "<username>";
    example = "/kick Joao";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        if (args.length < 1) {
            context.reply("Uso: /kick <username>.");
            return;
        }
        const target = context.server.findClientByUsername(args[0]);
        if (!target?.user) {
            context.reply(`Jogador "${args[0]}" não está online.`);
            return;
        }
        if (target === context.executor) {
            context.reply("Você não pode se kickar.");
            return;
        }
        // Hierarchy guard: only someone with strictly MORE power can be kicked.
        if (chatModeratorPower(target.user.chatModeratorLevel) >= chatModeratorPower(context.executor.user!.chatModeratorLevel)) {
            context.reply(`Você não pode kickar ${target.user.username} (cargo igual ou superior ao seu).`);
            return;
        }
        const name = target.user.username;
        target.closeConnection();
        context.reply(`${name} foi desconectado.`);
    }
}
