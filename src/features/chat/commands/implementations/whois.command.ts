import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel, chatModeratorLevelName } from "@/shared/models/enums/chat-moderator-level.enum";

/** Staff info card about a user: rank, cargo, clan, crystals, punishment, connection/battle. */
export default class WhoisCommand implements ICommand {
    name = "whois";
    description = "Mostra informações de um usuário (rank, cargo, clã, conexão, batalha). Uso: /whois <username>.";
    permissionLevel = ChatModeratorLevel.MODERATOR;
    usage = "<username>";
    example = "/whois Joao";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        if (args.length < 1) {
            context.reply("Uso: /whois <username>.");
            return;
        }
        const online = context.server.findClientByUsername(args[0]);
        const user = online?.user ?? (await context.server.userService.findUserByUsername(args[0]));
        if (!user) {
            context.reply(`Usuário "${args[0]}" não encontrado.`);
            return;
        }

        const clanTag = await context.server.clanService.getTagForUser(user);
        context.reply(`=== ${user.username} ===`);
        context.reply(`Rank: ${user.rank} | XP: ${user.experience} | Cristais: ${user.crystals}`);
        context.reply(`Cargo: ${chatModeratorLevelName(user.chatModeratorLevel)} | Clã: ${clanTag ?? "nenhum"}`);
        if (user.isPunished && user.punishmentExpiresAt && user.punishmentExpiresAt > new Date()) {
            context.reply(`PUNIDO até ${user.punishmentExpiresAt.toISOString()} — motivo: ${user.punishmentReason ?? "não informado"}`);
        }
        if (online) {
            const battle = online.currentBattle ? `batalha ${online.currentBattle.battleId}${online.isSpectator ? " (espectador)" : ""}` : "fora de batalha";
            context.reply(`Online — IP ${online.getRemoteAddress()} — ${battle}.`);
        } else {
            context.reply(`Offline — último login: ${user.lastLogin ? user.lastLogin.toISOString() : "nunca"}.`);
        }
    }
}
