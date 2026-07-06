import { BattleChatMessagePacket } from "@/features/battle/battle.packets";
import { ChatHistory } from "@/features/chat/chat.packets";
import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/** Sends a private SYSTEM message to one player (formal staff warning without muting). Delivered on the
 *  chat the target is currently looking at (battle chat when in a battle, lobby chat otherwise). */
export default class MsgCommand implements ICommand {
    name = "msg";
    description = "Envia uma mensagem de sistema privada para um jogador. Uso: /msg <username> <texto>.";
    permissionLevel = ChatModeratorLevel.MODERATOR;
    usage = "<username> <texto>";
    example = "/msg Joao evite spam no chat";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const message = args.slice(1).join(" ").trim();
        if (args.length < 2 || !message) {
            context.reply("Uso: /msg <username> <texto>.");
            return;
        }
        const target = context.server.findClientByUsername(args[0]);
        if (!target?.user) {
            context.reply(`Jogador "${args[0]}" não está online.`);
            return;
        }

        const tagged = `[STAFF] ${message}`;
        if (target.currentBattle) {
            target.sendPacket(new BattleChatMessagePacket({ nickname: null, message: tagged, team: 2 }));
        } else {
            target.sendPacket(new ChatHistory([{ message: tagged, isSystem: true, isWarning: true, source: null, target: null }]));
        }
        context.reply(`Mensagem enviada para ${target.user.username}.`);
    }
}
