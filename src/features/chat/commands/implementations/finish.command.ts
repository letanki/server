import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/**
 * Force-ends a battle (results screen). No argument = the battle the caller is currently in or spectating;
 * `/finish <id>` ends a specific battle by its id (works from anywhere, e.g. the battle list).
 */
export default class FinishBattleCommand implements ICommand {
    name = "finish";
    description = "Finaliza a partida (a atual/que você assiste, ou a de um id). Uso: /finish [id].";
    permissionLevel = ChatModeratorLevel.ADMINISTRATOR;
    usage = "[id]";
    example = "/finish";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const { server } = context;

        let battle = context.executor.currentBattle ?? null;
        if (args.length >= 1) {
            battle = server.lobbyService.getBattleById(args[0]) ?? null;
            if (!battle) {
                context.reply(`Batalha "${args[0]}" não encontrada.`);
                return;
            }
        }
        if (!battle) {
            context.reply("Você precisa estar em uma batalha ou informar o id. Uso: /finish [id].");
            return;
        }

        const ended = server.battleService.finishBattle(battle);
        context.reply(
            ended ? `Partida ${battle.battleId} finalizada.` : `A partida ${battle.battleId} já está finalizando.`
        );
    }
}
