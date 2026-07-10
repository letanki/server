import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { GarageWorkflow } from "@/features/garage/garage.workflow";
import { UpdateRankPacket, UpdateScorePacket } from "@/features/profile/profile.packets";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";
import User from "@/shared/models/user.model";

/**
 * Community-manager command: resets the rank/experience of EVERY account back to the first rank.
 * Updates the database in one bulk write, then refreshes any online players live (so they don't need
 * to relog to see score 0). Uso: /resetrank
 */
export default class ResetRankCommand implements ICommand {
    name: string = "resetrank";
    description: string = "Reseta o rank e a experiência de TODOS os usuários para o nível inicial. Uso: /resetrank";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.COMMUNITY_MANAGER;
    example = "/resetrank";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const initial = context.server.rankService.getInitialRankData(); // rank 1, score 0, nextRankScore
        const initialRankInfo = context.server.rankService.getRankById(initial.rank);
        const currentRankScore = initialRankInfo?.minScore ?? 0;

        // One bulk write covers every account (online or not).
        const result = await User.updateMany(
            {},
            { $set: { experience: initial.score, rank: initial.rank, nextRankScore: initial.nextRankScore } },
        );

        // Refresh online players in place so the reset shows without a relog.
        for (const client of context.server.getClients()) {
            const user = client.user;
            if (!user) continue;
            const rankChanged = user.rank !== initial.rank;
            user.experience = initial.score;
            user.rank = initial.rank;
            user.nextRankScore = initial.nextRankScore;
            client.sendPacket(new UpdateScorePacket({ score: initial.score }));
            client.sendPacket(new UpdateRankPacket({
                rank: initial.rank,
                score: initial.score,
                currentRankScore,
                nextRankScore: initial.nextRankScore,
                reward: 0,
            }));
            // Rank-dependent garage lists don't rebuild in place — reload for anyone with it open.
            if (rankChanged) GarageWorkflow.reloadGarage(client, context.server);
        }

        context.reply(`Rank resetado para ${result.modifiedCount} usuário(s). Jogadores online foram atualizados.`);
    }
}
