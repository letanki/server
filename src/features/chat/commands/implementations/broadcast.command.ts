import { BattleChatMessagePacket } from "@/features/battle/battle.packets";
import { ChatHistory } from "@/features/chat/chat.packets";
import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/** Sends a system message to EVERYONE — lobby/garage chat listeners get the system chat entry, players
 *  currently in a battle get it on the battle chat (nickname-less general message). */
export default class BroadcastCommand implements ICommand {
    name = "broadcast";
    description = "Envia uma mensagem de sistema para todos os jogadores. Uso: /broadcast <mensagem>.";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.ADMINISTRATOR;
    usage = "<mensagem>";
    example = "/broadcast Manutenção em 10 minutos";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const message = args.join(" ").trim();
        if (!message) {
            context.reply("Uso: /broadcast <mensagem>.");
            return;
        }

        context.server.broadcastToLobbyChat(
            new ChatHistory([{ message, isSystem: true, isWarning: true, source: null, target: null }])
        );
        for (const client of context.server.getClients()) {
            if (client.user && client.currentBattle) {
                client.sendPacket(new BattleChatMessagePacket({ nickname: null, message, team: 2 }));
            }
        }
        context.reply("Mensagem enviada a todos.");
    }
}
