import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/** Fun: rolls a random number 1..max (default 100). */
export default class RollCommand implements ICommand {
    name = "roll";
    description = "Sorteia um número de 1 a max (padrão 100). Uso: /roll [max].";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.NONE;
    usage = "[max]";
    example = "/roll 6";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const max = Math.max(2, Math.floor(Number(args[0]) || 100));
        const value = 1 + Math.floor(Math.random() * max);
        context.reply(`${context.executor.user?.username} rolou ${value} (1-${max}).`);
    }
}
