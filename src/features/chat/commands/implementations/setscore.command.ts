import { SetCtfScorePacket } from "@/features/battle/battle.packets";
import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/** Sets the team scores of the current battle (team modes; RED=0, BLUE=1 on the wire). */
export default class SetScoreCommand implements ICommand {
    name = "setscore";
    description = "Define o placar dos times da partida atual (modos de time). Uso: /setscore <red> <blue>.";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.ADMINISTRATOR;
    usage = "<red> <blue>";
    example = "/setscore 5 3";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const battle = context.executor.currentBattle;
        if (!context.executor.user || !battle) {
            context.reply("Você precisa estar em uma batalha.");
            return;
        }
        if (!battle.isTeamMode()) {
            context.reply("Esta batalha não é de times.");
            return;
        }
        const red = parseInt(args[0], 10);
        const blue = parseInt(args[1], 10);
        if (isNaN(red) || isNaN(blue) || red < 0 || blue < 0) {
            context.reply("Uso: /setscore <red> <blue> (números >= 0).");
            return;
        }

        battle.scoreRed = red;
        battle.scoreBlue = blue;
        battle.broadcast(new SetCtfScorePacket(0, red));
        battle.broadcast(new SetCtfScorePacket(1, blue));
        context.reply(`Placar definido: vermelho ${red} × ${blue} azul.`);
    }
}
