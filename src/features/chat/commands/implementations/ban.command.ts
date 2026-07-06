import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel, chatModeratorPower } from "@/shared/models/enums/chat-moderator-level.enum";

/** Punishes a user for N hours (blocks login via the existing punishment flow) and drops them if online. */
export default class BanCommand implements ICommand {
    name = "ban";
    description = "Bane um usuário por N horas (com motivo opcional). Uso: /ban <username> <horas> [motivo].";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.ADMINISTRATOR;
    usage = "<username> <horas> [motivo]";
    example = "/ban Joao 24 uso de macro";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const hours = parseFloat(args[1]);
        if (args.length < 2 || isNaN(hours) || hours <= 0) {
            context.reply("Uso: /ban <username> <horas> [motivo].");
            return;
        }
        const reason = args.slice(2).join(" ").trim() || null;

        const online = context.server.findClientByUsername(args[0]);
        const target = online?.user ?? (await context.server.userService.findUserByUsername(args[0]));
        if (!target) {
            context.reply(`Usuário "${args[0]}" não encontrado.`);
            return;
        }
        if (target.id === context.executor.user!.id) {
            context.reply("Você não pode se banir.");
            return;
        }
        // Hierarchy guard: only someone with strictly LESS power can be banned.
        if (chatModeratorPower(target.chatModeratorLevel) >= chatModeratorPower(context.executor.user!.chatModeratorLevel)) {
            context.reply(`Você não pode banir ${target.username} (cargo igual ou superior ao seu).`);
            return;
        }

        try {
            const punished = await context.server.userService.punishUser(target.username, hours * 60 * 60 * 1000, reason);
            online?.closeConnection();
            context.reply(`${punished.username} banido por ${hours}h${reason ? ` — motivo: ${reason}` : ""}.`);
        } catch (error: any) {
            context.reply(`Erro: ${error.message}`);
        }
    }
}
