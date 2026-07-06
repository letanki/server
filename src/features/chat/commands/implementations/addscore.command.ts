import { MAX_COMMAND_SCORE } from "@/config/rank.data";
import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { UpdateRankPacket, UpdateScorePacket } from "@/features/profile/profile.packets";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

export default class AddScoreCommand implements ICommand {
    name: string = "addscore";
    description: string = "Adiciona ou remove experiência da sua conta. Uso: /addscore <amount> (negativo remove).";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.NONE;
    usage = "<amount>";
    example = "/addscore 100000";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        if (args.length < 1) {
            context.reply("Uso: /addscore <amount>");
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

        const originalRank = user.rank;
        const currentScore = user.experience;
        let newScore = currentScore + amount;

        const MIN_SCORE = 0;
        newScore = Math.max(MIN_SCORE, Math.min(newScore, MAX_COMMAND_SCORE));

        try {
            const updatedUser = await context.server.userService.updateResources(user.id, {
                experience: newScore,
            });

            context.executor.user = updatedUser;

            context.executor.sendPacket(new UpdateScorePacket(updatedUser.experience));
            context.reply(`Pontuação atualizada para: ${updatedUser.experience}.`);

            if (updatedUser.rank !== originalRank) {
                const newRankInfo = context.server.rankService.getRankById(updatedUser.rank);
                if (newRankInfo) {
                    const rankPacket = new UpdateRankPacket({
                        rank: updatedUser.rank,
                        score: updatedUser.experience,
                        currentRankScore: newRankInfo.minScore,
                        nextRankScore: updatedUser.nextRankScore,
                        reward: 0,
                    });
                    context.executor.sendPacket(rankPacket);
                    context.reply(`Parabéns! Você alcançou o rank: ${newRankInfo.name}.`);
                }
            }
        } catch (error: any) {
            context.reply(`Erro ao atualizar a pontuação: ${error.message}`);
        }
    }
}