import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { UpdateCrystals } from "@/features/profile/profile.packets";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

const MAX_CRYSTALS = 99_999_999;

/** Sets (not adds) the caller's crystal count — sandbox sibling of /addcry. */
export default class SetCrystalsCommand implements ICommand {
    name = "setcry";
    description = "Define (não soma) a quantidade de cristais da sua conta. Uso: /setcry <amount>.";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.NONE;
    usage = "<amount>";
    example = "/setcry 1000000";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const amount = parseInt(args[0], 10);
        if (isNaN(amount)) {
            context.reply("Uso: /setcry <amount>.");
            return;
        }
        const user = context.executor.user;
        if (!user) return;

        const crystals = Math.max(0, Math.min(amount, MAX_CRYSTALS));
        try {
            const updated = await context.server.userService.updateResources(user.id, { crystals });
            context.executor.user = updated;
            context.executor.sendPacket(new UpdateCrystals(updated.crystals));
            context.reply(`Cristais definidos para ${updated.crystals}.`);
        } catch (error: any) {
            context.reply(`Erro: ${error.message}`);
        }
    }
}
