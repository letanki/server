import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { BattleWorkflow } from "@/features/battle/battle.workflow";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";
import User from "@/shared/models/user.model";

/** Debug: adds mines straight to your inventory (no garage, no cap). Uso: /comprarminas <quantidade>. */
export default class BuyMinesCommand implements ICommand {
    name = "comprarminas";
    description = "Adiciona minas ao inventário, sem ir à garagem e sem limite. Uso: /comprarminas <quantidade>.";
    permissionLevel = ChatModeratorLevel.MODERATOR;
    usage = "<quantidade>";
    example = "/comprarminas 100";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const client = context.executor;
        const user = client.user;
        if (!user) {
            context.reply("Usuário não encontrado.");
            return;
        }

        const amount = parseInt(args[0], 10);
        if (isNaN(amount) || amount <= 0) {
            context.reply("Uso: /comprarminas <quantidade> (número positivo).");
            return;
        }

        // In-memory (drives the panel) + atomic $inc (persist; race-safe vs concurrent mine use, no save clobber).
        const newCount = (user.supplies.get("mine") ?? 0) + amount;
        user.supplies.set("mine", newCount);
        try {
            await User.updateOne({ _id: user._id }, { $inc: { "supplies.mine": amount } });
        } catch (error: any) {
            context.reply(`Erro ao salvar: ${error.message}`);
            return;
        }

        // Refresh the in-battle supply panel so the new count shows immediately (loads it if it wasn't up).
        if (client.currentBattle) BattleWorkflow.sendConsumables(client, client.currentBattle);

        context.reply(`+${amount} mina(s). Total: ${newCount}.`);
    }
}
