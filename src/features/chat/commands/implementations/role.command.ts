import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import {
    ChatModeratorLevel,
    chatModeratorLevelName,
    parseChatModeratorLevel,
} from "@/shared/models/enums/chat-moderator-level.enum";

/**
 * /role <usuário> <cargo> — assigns a staff cargo to a user. Restricted to Community Manager (the top
 * cargo). Persists to the DB (works on offline users) and, if the target is online, updates their live
 * session immediately so command permissions and the chat tag reflect without a relogin. The very first
 * Community Manager is bootstrapped with `npm run set-role` (see scripts/setRole.ts).
 */
export default class RoleCommand implements ICommand {
    name = "role";
    description = "Define o cargo de staff de um usuário. Uso: /role <usuário> <cargo>.";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.COMMUNITY_MANAGER;
    usage = "<nick> [none/candidate/moderator/administrator/cm]";
    example = "/role Joao moderator";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        if (args.length < 2) {
            context.reply("Uso: /role <usuário> <cargo>. Cargos: none, candidate, moderator, administrator, cm.");
            return;
        }

        const targetName = args[0];
        const level = parseChatModeratorLevel(args[1]);
        if (level === null) {
            context.reply(`Cargo inválido "${args[1]}". Válidos: none, candidate, moderator, administrator, cm.`);
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
