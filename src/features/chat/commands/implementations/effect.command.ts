import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

const EFFECT_TYPES = ["n2o", "double_damage", "armor"] as const;

/** Applies a supply buff for free (no inventory cost) — to yourself or another player in the battle. */
export default class EffectCommand implements ICommand {
    name = "effect";
    description = "Aplica um buff de suprimento grátis (vazio = você). Uso: /effect <tipo> [username].";
    permissionLevel = ChatModeratorLevel.MODERATOR;
    usage = `[${EFFECT_TYPES.join("/")}] [username]`;
    example = "/effect n2o Joao";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const client = context.executor;
        const { server } = context;
        if (!client.user || !client.currentBattle) {
            context.reply("Você precisa estar em uma batalha.");
            return;
        }

        const type = (args[0] ?? "").toLowerCase();
        if (!(EFFECT_TYPES as readonly string[]).includes(type)) {
            context.reply(`Tipo inválido. Use um de: ${EFFECT_TYPES.join(", ")}.`);
            return;
        }

        let target = client;
        if (args.length >= 2) {
            const found = server.findClientByUsername(args[1]);
            if (!found?.user || found.currentBattle?.battleId !== client.currentBattle.battleId) {
                context.reply(`Jogador "${args[1]}" não está nesta batalha.`);
                return;
            }
            target = found;
        }
        if (target.battleState !== "active") {
            context.reply(`${target.user?.username} não está com o tanque ativo em campo.`);
            return;
        }

        server.battleService.supply.applyEffect(target, client.currentBattle, type);
        context.reply(`Efeito ${type} aplicado em ${target.user?.username}.`);
    }
}
