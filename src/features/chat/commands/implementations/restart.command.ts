import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/** Restarts the current battle's round on the spot (scores/flags/fund reset, sides swap, everyone respawns). */
export default class RestartCommand implements ICommand {
    name = "restart";
    description = "Reinicia o round da partida atual (placar zera, todos respawnam). Uso: /restart.";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.ADMINISTRATOR;
    example = "/restart";

    async execute(context: CommandContext, _args: string[]): Promise<void> {
        const battle = context.executor.currentBattle;
        if (!context.executor.user || !battle) {
            context.reply("Você precisa estar em uma batalha.");
            return;
        }
        context.server.battleService.restartBattle(battle);
        context.reply(`Round da partida ${battle.battleId} reiniciado.`);
    }
}
