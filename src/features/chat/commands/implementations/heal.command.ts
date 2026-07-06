import { HEAL_MAX_GIVEN } from "@/features/battle/supply.service";
import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/** Starts a free full repair-kit regen on a tank — yours by default, or another player's in the same battle. */
export default class HealCommand implements ICommand {
    name = "heal";
    description = "Cura um tanque (regeneração de kit completa, grátis; vazio = você). Uso: /heal [username].";
    permissionLevel = ChatModeratorLevel.MODERATOR;
    usage = "[username]";
    example = "/heal Joao";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const client = context.executor;
        const { server } = context;
        if (!client.user || !client.currentBattle) {
            context.reply("Você precisa estar em uma batalha.");
            return;
        }

        let target = client;
        if (args.length >= 1) {
            const found = server.findClientByUsername(args[0]);
            if (!found?.user || found.currentBattle?.battleId !== client.currentBattle.battleId) {
                context.reply(`Jogador "${args[0]}" não está nesta batalha.`);
                return;
            }
            target = found;
        }
        if (target.battleState !== "active") {
            context.reply(`${target.user?.username} não está com o tanque ativo em campo.`);
            return;
        }

        server.battleService.supply.startHealing(target, client.currentBattle, HEAL_MAX_GIVEN.INVENTORY);
        context.reply(`Curando ${target.user?.username}.`);
    }
}
