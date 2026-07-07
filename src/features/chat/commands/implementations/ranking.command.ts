import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/** /ranking — mostra a classificação da ranqueada (XP/BP): sua posição + o top 10. */
export default class RankingCommand implements ICommand {
    name = "ranking";
    description = "Mostra a classificação da Partida Competitiva (sua posição + top 10).";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.NONE;

    async execute(context: CommandContext, _args: string[]): Promise<void> {
        const svc = context.server.rankedService;
        if (!svc) {
            context.reply("Ranqueada indisponível.");
            return;
        }
        const userId = context.executor.user?.id;
        const [top, you] = await Promise.all([
            svc.getLeaderboard(10),
            userId ? svc.getPlayerPosition(userId) : Promise.resolve(null),
        ]);

        context.reply("=== Classificação · XP/BP ===");
        if (you) context.reply(`Você: #${you.rank} de ${you.total} · MMR ${you.mmr}`);
        else context.reply("Você ainda não está classificado (jogue uma partida ranqueada).");

        if (top.length === 0) {
            context.reply("Ninguém classificado ainda.");
            return;
        }
        top.forEach((p, i) => {
            context.reply(`#${i + 1} ${p.username} — ${p.mmr} MMR (${p.wins}V/${p.losses}D)`);
        });
    }
}
