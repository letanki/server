import { ClanNotifierData } from "@/features/profile/profile.packets";
import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/** Staff clan moderation: inspect a clan, force-remove a member, or disband an abusive clan. */
export default class ClanCommand implements ICommand {
    name = "clan";
    description = "Moderação de clã: info <tag>, kick <username>, disband <tag>, block <tag> [motivo], unblock <tag>. Uso: /clan [info/kick/disband/block/unblock] <alvo>.";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.ADMINISTRATOR;
    usage = "[info/kick/disband/block/unblock] <alvo> [motivo]";
    example = "/clan block LGC Clã punido por trapaça";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const { server } = context;
        const action = (args[0] ?? "").toLowerCase();
        const target = args[1];
        if (!target || !["info", "kick", "disband", "block", "unblock"].includes(action)) {
            context.reply("Uso: /clan [info/kick/disband/block/unblock] <alvo> (kick = username; demais = tag).");
            return;
        }

        if (action === "block" || action === "unblock") {
            const reason = args.slice(2).join(" ");
            const clan = await server.clanService.staffSetClanBlocked(target, action === "block", reason);
            if (!clan) {
                context.reply(`Clã "${target}" não encontrado.`);
                return;
            }
            context.reply(action === "block"
                ? `Clã [${clan.tag}] bloqueado${reason ? ` (motivo: ${reason})` : ""}.`
                : `Clã [${clan.tag}] desbloqueado.`);
            return;
        }

        if (action === "info") {
            const clan = await server.clanService.getClanByTag(target);
            if (!clan) {
                context.reply(`Clã "${target}" não encontrado.`);
                return;
            }
            const leader = await server.clanService.getLeaderUsername(clan);
            const members = await server.clanService.getMembers(clan);
            context.reply(`=== [${clan.tag}] ${clan.name} ===`);
            context.reply(`Líder: ${leader ?? "?"} | Membros: ${members.length} | Rating: ${clan.rating ?? 0} | Recrutando: ${clan.recruiting ? "sim" : "não"}`);
            context.reply(`Membros: ${members.map((m) => m.username).join(", ")}`);
            return;
        }

        if (action === "kick") {
            const result = await server.clanService.staffRemoveMember(target);
            if (result === "leader") {
                context.reply(`${target} é o líder do clã — use /clan disband <tag> ou peça a transferência.`);
                return;
            }
            if (!result) {
                context.reply(`Usuário "${target}" não está em um clã.`);
                return;
            }
            const online = server.findClientByUsername(result.target.username);
            if (online?.user) {
                online.user.clanId = null;
                online.sendPacket(new ClanNotifierData(online.user.username, null));
            }
            context.reply(`${result.target.username} removido do clã [${result.clan.tag}].`);
            return;
        }

        // disband
        const result = await server.clanService.staffDisbandClan(target);
        if (!result) {
            context.reply(`Clã "${target}" não encontrado.`);
            return;
        }
        for (const member of result.members) {
            const online = server.findClientByUsername(member.username);
            if (online?.user) {
                online.user.clanId = null;
                online.sendPacket(new ClanNotifierData(online.user.username, null));
            }
        }
        context.reply(`Clã [${result.tag}] dissolvido (${result.members.length} membro(s) liberados).`);
    }
}
