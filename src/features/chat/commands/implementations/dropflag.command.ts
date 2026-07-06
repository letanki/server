import { BattleMode } from "@/features/battle/battle.model";
import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/** Drops any flag currently being carried in the caller's battle (CTF). */
export default class DropFlagCommand implements ICommand {
    name = "dropflag";
    description = "Derruba a(s) bandeira(s) que estiverem sendo carregadas (CTF). Uso: /dropflag.";
    permissionLevel = ChatModeratorLevel.MODERATOR;
    example = "/dropflag";

    async execute(context: CommandContext, _args: string[]): Promise<void> {
        const client = context.executor;
        const battle = client.currentBattle;
        if (!client.user || !battle) {
            context.reply("Você precisa estar em uma batalha.");
            return;
        }
        if (battle.settings.battleMode !== BattleMode.CTF) {
            context.reply("Esta batalha não é Capture the Flag.");
            return;
        }

        const dropped = context.server.battleService.dropCarriedFlags(battle);
        context.reply(dropped > 0 ? `${dropped} bandeira(s) derrubada(s).` : "Nenhuma bandeira está sendo carregada.");
    }
}
