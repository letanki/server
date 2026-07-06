import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/** Freezes the battle's gameplay interactions: no damage/kills, no flag/mine/zone triggers. Movement
 *  still relays and the round clock keeps ticking. Undo with /resume. */
export default class PauseCommand implements ICommand {
    name = "pause";
    description = "Pausa o combate da partida atual (sem dano/kills/bandeira/minas). Uso: /pause.";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.ADMINISTRATOR;
    example = "/pause";

    async execute(context: CommandContext, _args: string[]): Promise<void> {
        const battle = context.executor.currentBattle;
        if (!context.executor.user || !battle) {
            context.reply("Você precisa estar em uma batalha.");
            return;
        }
        if (battle.paused) {
            context.reply("A partida já está pausada. Use /resume para retomar.");
            return;
        }
        battle.paused = true;
        context.reply(`Partida ${battle.battleId} PAUSADA (combate congelado; movimento continua).`);
    }
}
