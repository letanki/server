import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel, chatModeratorPower } from "@/shared/models/enums/chat-moderator-level.enum";
import { RemoveUserChatMessagesPacket } from "@/features/chat/chat.packets";

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

        // Limpa o spam já enviado do usuário silenciado: apaga do histórico (DB) e remove das telas de
        // todos (não só silencia o futuro) — assim não reaparece para quem recarregar o chat.
        await context.server.chatService.removeUserMessages(user);
        const removePacket = new RemoveUserChatMessagesPacket({ nickname: user.username });
        for (const c of context.server.getClients()) c.sendPacket(removePacket);

        context.reply(`${user.username} silenciado por ${minutes} minuto(s).`);
    }
}
