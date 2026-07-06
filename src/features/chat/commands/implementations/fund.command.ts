import { ChangeFundPacket } from "@/features/battle/battle.packets";
import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/** Sets the current battle's crystal fund (the pool shown in the stats panel). */
export default class FundCommand implements ICommand {
    name = "fund";
    description = "Define o fundo de cristais da partida atual. Uso: /fund <valor>.";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.ADMINISTRATOR;
    usage = "<valor>";
    example = "/fund 10000";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const battle = context.executor.currentBattle;
        if (!context.executor.user || !battle) {
            context.reply("Você precisa estar em uma batalha.");
            return;
        }
        const value = parseInt(args[0], 10);
        if (isNaN(value) || value < 0) {
            context.reply("Uso: /fund <valor> (número >= 0).");
            return;
        }

        battle.fund = value;
        battle.broadcast(new ChangeFundPacket(value));
        context.reply(`Fundo da partida definido para ${value}.`);
    }
}
