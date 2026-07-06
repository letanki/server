import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/** Lifts a user's chat mute. */
export default class UnmuteCommand implements ICommand {
    name = "unmute";
    description = "Remove o silenciamento do chat de um usuário. Uso: /unmute <username>.";
    permissionLevel = ChatModeratorLevel.MODERATOR;
    usage = "<username>";
    example = "/unmute Joao";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        if (args.length < 1) {
            context.reply("Uso: /unmute <username>.");
            return;
        }
        const online = context.server.findClientByUsername(args[0]);
        const user = online?.user ?? (await context.server.userService.findUserByUsername(args[0]));
        if (!user) {
            context.reply(`Usuário "${args[0]}" não encontrado.`);
            return;
        }
        if (!user.mutedUntil || user.mutedUntil <= new Date()) {
            context.reply(`${user.username} não está silenciado.`);
            return;
        }
        user.mutedUntil = null;
        await user.save();
        if (online?.user && online.user !== user) online.user.mutedUntil = null;
        context.reply(`Silenciamento de ${user.username} removido.`);
    }
}
