import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel, chatModeratorPower } from "@/shared/models/enums/chat-moderator-level.enum";

/** Silences a user's chat (lobby + battle) for N minutes; commands keep working. Persisted, so it
 *  survives relogin. Hierarchy guard like /kick. */
export default class MuteCommand implements ICommand {
    name = "mute";
    description = "Silencia o chat de um usuário por N minutos (comandos continuam). Uso: /mute <username> <min>.";
    permissionLevel = ChatModeratorLevel.MODERATOR;
    usage = "<username> <min>";
    example = "/mute Joao 30";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const minutes = parseFloat(args[1]);
        if (args.length < 2 || isNaN(minutes) || minutes <= 0) {
            context.reply("Uso: /mute <username> <min>.");
            return;
        }

        const online = context.server.findClientByUsername(args[0]);
        const user = online?.user ?? (await context.server.userService.findUserByUsername(args[0]));
        if (!user) {
            context.reply(`Usuário "${args[0]}" não encontrado.`);
            return;
        }
        if (user.id === context.executor.user!.id) {
            context.reply("Você não pode se silenciar.");
            return;
        }
        if (chatModeratorPower(user.chatModeratorLevel) >= chatModeratorPower(context.executor.user!.chatModeratorLevel)) {
            context.reply(`Você não pode silenciar ${user.username} (cargo igual ou superior ao seu).`);
            return;
        }

        user.mutedUntil = new Date(Date.now() + minutes * 60000);
        await user.save();
        if (online?.user && online.user !== user) online.user.mutedUntil = user.mutedUntil;
        context.reply(`${user.username} silenciado por ${minutes} minuto(s).`);
    }
}
