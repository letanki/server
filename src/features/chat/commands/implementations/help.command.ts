import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import {
    ChatModeratorLevel,
    chatModeratorLevelName,
    hasModeratorPower,
} from "@/shared/models/enums/chat-moderator-level.enum";

/** Cargo groups shown by /help, from highest to lowest. */
const GROUP_ORDER: ChatModeratorLevel[] = [
    ChatModeratorLevel.COMMUNITY_MANAGER,
    ChatModeratorLevel.ADMINISTRATOR,
    ChatModeratorLevel.MODERATOR,
    ChatModeratorLevel.CANDIDATE,
    ChatModeratorLevel.NONE,
];

const GROUP_LABEL: Record<ChatModeratorLevel, string> = {
    [ChatModeratorLevel.COMMUNITY_MANAGER]: "COMMUNITY MANAGER",
    [ChatModeratorLevel.ADMINISTRATOR]: "ADMINISTRADOR",
    [ChatModeratorLevel.MODERATOR]: "MODERADOR",
    [ChatModeratorLevel.CANDIDATE]: "CANDIDATO",
    [ChatModeratorLevel.NONE]: "PÚBLICO (todos os jogadores)",
};

/** The usage now lives in `usage`, so drop any "Uso: ..." tail from the description to avoid duplication. */
function whatItDoes(description: string): string {
    return description.replace(/\s*Uso:.*$/i, "").trim();
}

/** e.g. "/setcargo <nick> [none/candidato/...] — Define o cargo de staff de um usuário." */
function listLine(cmd: ICommand): string {
    const params = cmd.usage ? " " + cmd.usage : "";
    return `/${cmd.name}${params} — ${whatItDoes(cmd.description)}`;
}

/**
 * /help [comando] — lists the commands the caller can use, GROUPED by cargo (highest first, header per
 * group), each with its parameters (hardcoded options shown as [a/b/c]). `/help <comando>` shows the
 * detail of one command with a concrete example.
 */
export default class HelpCommand implements ICommand {
    name = "help";
    description = "Lista os comandos disponíveis. Uso: /help [comando].";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.NONE;
    usage = "[comando]";
    example = "/help setcargo";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const level = context.executor.user!.chatModeratorLevel;
        const service = context.server.commandService;

        // /help <comando> — detalhe de um comando específico.
        if (args.length >= 1) {
            const name = args[0].replace(/^\//, "").toLowerCase();
            const cmd = service.getCommand(name);
            if (!cmd) {
                context.reply(`Comando "/${name}" não encontrado. Use /help para ver a lista.`);
                return;
            }
            if (!hasModeratorPower(level, cmd.permissionLevel)) {
                context.reply(`Você não tem permissão para usar /${cmd.name}.`);
                return;
            }
            context.reply(`/${cmd.name}${cmd.usage ? " " + cmd.usage : ""}`);
            context.reply(whatItDoes(cmd.description));
            if (cmd.example) {
                context.reply(`Exemplo: ${cmd.example}`);
            }
            context.reply(
                cmd.permissionLevel === ChatModeratorLevel.NONE
                    ? "Acesso: todos os jogadores."
                    : `Cargo mínimo: ${chatModeratorLevelName(cmd.permissionLevel)}.`
            );
            return;
        }

        // /help — lista agrupada por cargo (só os grupos/comandos que o jogador pode usar).
        const accessible = service.getCommands().filter((c) => hasModeratorPower(level, c.permissionLevel));

        context.reply("=== Comandos disponíveis — use /help <comando> para ver um exemplo ===");
        for (const group of GROUP_ORDER) {
            const inGroup = accessible
                .filter((c) => c.permissionLevel === group)
                .sort((a, b) => a.name.localeCompare(b.name));
            if (inGroup.length === 0) continue;

            context.reply(`— ${GROUP_LABEL[group]} —`);
            for (const cmd of inGroup) {
                context.reply(listLine(cmd));
            }
        }
    }
}
