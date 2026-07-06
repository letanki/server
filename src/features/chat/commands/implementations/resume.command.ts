import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/** Resumes a battle frozen by /pause. */
export default class ResumeCommand implements ICommand {
    name = "resume";
    description = "Retoma uma partida pausada com /pause. Uso: /resume.";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.ADMINISTRATOR;
    example = "/resume";

    async execute(context: CommandContext, _args: string[]): Promise<void> {
        const battle = context.executor.currentBattle;
        if (!context.executor.user || !battle) {
            context.reply("Você precisa estar em uma batalha.");
            return;
        }
        if (!battle.paused) {
            context.reply("A partida não está pausada.");
            return;
        }
        battle.paused = false;
        context.reply(`Partida ${battle.battleId} retomada.`);
    }
}
