import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/** Shows the caller's current battle coordinates (handy for /tp and /bonus). */
export default class PosCommand implements ICommand {
    name = "pos";
    description = "Mostra suas coordenadas atuais na batalha. Uso: /pos.";
    permissionLevel = ChatModeratorLevel.MODERATOR;
    example = "/pos";

    async execute(context: CommandContext, _args: string[]): Promise<void> {
        const pos = context.executor.battlePosition;
        if (!context.executor.currentBattle || !pos) {
            context.reply("Você precisa estar em uma batalha, em campo.");
            return;
        }
        context.reply(`Posição: x=${Math.round(pos.x)} y=${Math.round(pos.y)} z=${Math.round(pos.z)}`);
    }
}
