import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import {
    ChatModeratorLevel,
    chatModeratorLevelName,
    parseChatModeratorLevel,
} from "@/shared/models/enums/chat-moderator-level.enum";

/**
 * /setcargo <usuário> <cargo> — assigns a staff cargo to a user. Restricted to Community Manager (the top
 * cargo). Persists to the DB (works on offline users) and, if the target is online, updates their live
 * session immediately so command permissions and the chat tag reflect without a relogin. The very first
 * Community Manager is bootstrapped with `npm run set-cargo` (see scripts/setCargo.ts).
 */
export default class SetCargoCommand implements ICommand {
    name = "setcargo";
    description = "Define o cargo de staff de um usuário. Uso: /setcargo <usuário> <cargo>.";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.COMMUNITY_MANAGER;
    usage = "<nick> [none/candidato/moderador/administrador/cm]";
    example = "/setcargo Joao moderador";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        if (args.length < 2) {
            context.reply("Uso: /setcargo <usuário> <cargo>. Cargos: none, candidato, moderador, administrador, cm.");
            return;
        }

        const targetName = args[0];
        const level = parseChatModeratorLevel(args[1]);
        if (level === null) {
            context.reply(`Cargo inválido "${args[1]}". Válidos: none, candidato, moderador, administrador, cm.`);
            return;
        }

        try {
            const updated = await context.server.userService.setChatModeratorLevel(targetName, level);

            // Reflete na sessão online (permissões de comando + tag no chat) sem precisar relogar.
            const online = context.server.findClientByUsername(updated.username);
            if (online?.user) {
                online.user.chatModeratorLevel = level;
            }

            context.reply(`Cargo de ${updated.username} definido para ${chatModeratorLevelName(level)}.`);
        } catch (error: any) {
            context.reply(`Erro: ${error.message}`);
        }
    }
}
