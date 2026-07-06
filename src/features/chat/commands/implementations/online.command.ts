import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/** Lists everyone connected, with the battle each one is in (if any). */
export default class OnlineCommand implements ICommand {
    name = "online";
    description = "Lista os jogadores conectados e em qual batalha estão. Uso: /online.";
    permissionLevel = ChatModeratorLevel.MODERATOR;
    example = "/online";

    async execute(context: CommandContext, _args: string[]): Promise<void> {
        const authenticated = context.server.getClients().filter((c) => c.user);
        context.reply(`=== Online: ${authenticated.length} jogador(es) ===`);
        for (const c of authenticated) {
            const battle = c.currentBattle ? ` — batalha ${c.currentBattle.battleId}${c.isSpectator ? " (espectador)" : ""}` : "";
            context.reply(`${c.user!.username}${battle}`);
        }
    }
}
