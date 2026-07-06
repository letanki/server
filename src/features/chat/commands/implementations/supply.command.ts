import { BattleWorkflow } from "@/features/battle/battle.workflow";
import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";
import User from "@/shared/models/user.model";

const SUPPLY_TYPES = ["health", "armor", "double_damage", "n2o", "mine"] as const;

/** Adds any supply to the caller's inventory (replaces the old /buymines): no garage trip, no cap. */
export default class SupplyCommand implements ICommand {
    name = "supply";
    description = "Adiciona suprimentos ao seu inventário, sem garagem e sem limite. Uso: /supply <tipo> <amount>.";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.NONE;
    usage = `[${SUPPLY_TYPES.join("/")}] <amount>`;
    example = "/supply n2o 100";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const client = context.executor;
        const user = client.user;
        if (!user) return;

        const type = (args[0] ?? "").toLowerCase();
        if (!(SUPPLY_TYPES as readonly string[]).includes(type)) {
            context.reply(`Tipo inválido. Use um de: ${SUPPLY_TYPES.join(", ")}.`);
            return;
        }
        const amount = parseInt(args[1], 10);
        if (isNaN(amount) || amount <= 0) {
            context.reply("Uso: /supply <tipo> <amount> (número positivo).");
            return;
        }

        // In-memory (drives the panel) + atomic $inc (race-safe vs concurrent supply use, no save clobber).
        const newCount = (user.supplies.get(type) ?? 0) + amount;
        user.supplies.set(type, newCount);
        try {
            await User.updateOne({ _id: user._id }, { $inc: { [`supplies.${type}`]: amount } });
        } catch (error: any) {
            context.reply(`Erro ao salvar: ${error.message}`);
            return;
        }

        // Refresh the in-battle supply panel so the new count shows immediately (loads it if it wasn't up).
        if (client.currentBattle) BattleWorkflow.sendConsumables(client, client.currentBattle);
        context.reply(`+${amount} ${type}. Total: ${newCount}.`);
    }
}
