import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { UpdateCrystals } from "@/features/profile/profile.packets";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

export default class AddCrystalsCommand implements ICommand {
    name: string = "addcry";
    description: string = "Adiciona ou remove cristais da sua conta. Uso: /addcry <amount> (negativo remove).";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.NONE;
    usage = "<amount>";
    example = "/addcry 50000";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        if (args.length < 1) {
            context.reply("Uso: /addcry <amount>");
            return;
        }

        const amount = parseInt(args[0], 10);

        if (isNaN(amount)) {
            context.reply("Erro: A quantidade deve ser um número.");
            return;
        }

        const user = context.executor.user;
        if (!user) {
            context.reply("Erro: Usuário não encontrado.");
            return;
        }

        const currentCrystals = user.crystals;
        let newCrystals = currentCrystals + amount;

        const MAX_CRYSTALS = 99_999_999;
        const MIN_CRYSTALS = 0;
        newCrystals = Math.max(MIN_CRYSTALS, Math.min(newCrystals, MAX_CRYSTALS));

        try {
            const updatedUser = await context.server.userService.updateResources(user.id, {
                crystals: newCrystals,
            });

            context.executor.user = updatedUser;

            context.executor.sendPacket(new UpdateCrystals({ crystals: updatedUser.crystals }));
            context.reply(`Cristais atualizados para: ${updatedUser.crystals}.`);
        } catch (error: any) {
            context.reply(`Erro ao atualizar os cristais: ${error.message}`);
        }
    }
}