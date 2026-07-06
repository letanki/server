import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { HaltServerPacket } from "@/features/system/halt.packets";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/**
 * Admin command: broadcasts the "server is restarting in N seconds" warning (HaltServerPacket) to
 * everyone and opens the restart window on the server. While the window is open, creating or joining
 * a battle is refused (handled in the create/enter battle handlers). Uso: /update [seconds]
 */
export default class UpdateCommand implements ICommand {
    name: string = "update";
    description: string = "Anuncia o reinício do servidor e bloqueia entrar/criar partidas. Uso: /update [seconds]";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.ADMINISTRATOR;
    usage = "[seconds]";
    example = "/update 60";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const parsed = parseInt(args[0], 10);
        const seconds = isNaN(parsed) ? 60 : parsed;

        context.server.beginRestart(seconds);
        context.server.broadcastToAll(new HaltServerPacket(seconds));

        // End all battles right now (results screen). After the 10s finish pause, the restart guard in
        // RoundService.restartRound evacuates everyone to the battle list instead of recommencing.
        context.server.battleService.endAllBattlesForRestart();

        context.reply(`Reinício anunciado: ${seconds}s. Partidas encerradas; jogadores voltam à lista de batalhas em ~10s. Entrar/criar bloqueado.`);
    }
}
