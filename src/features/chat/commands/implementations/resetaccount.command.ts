import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { GarageWorkflow } from "@/features/garage/garage.workflow";
import { UpdateCrystals, UpdateRankPacket, UpdateScorePacket } from "@/features/profile/profile.packets";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";
import { resetGarageInventory } from "./resetgarage.command";

/** Full account reset: rank 1 / 0 XP, 0 crystals, default garage, no supplies, stats wiped, fresh daily
 *  missions. Login/friends/clan/punishments are kept. */
export default class ResetAccountCommand implements ICommand {
    name = "resetaccount";
    description = "Reseta a conta de um usuário (rank, cristais, garagem, suprimentos, stats, missões). Uso: /resetaccount <username>.";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.COMMUNITY_MANAGER;
    usage = "<username>";
    example = "/resetaccount Joao";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        if (args.length < 1) {
            context.reply("Uso: /resetaccount <username>.");
            return;
        }
        const { server } = context;
        const online = server.findClientByUsername(args[0]);
        const user = online?.user ?? (await server.userService.findUserByUsername(args[0]));
        if (!user) {
            context.reply(`Usuário "${args[0]}" não encontrado.`);
            return;
        }

        // Progress + economy.
        const initial = server.rankService.getInitialRankData();
        user.experience = initial.score;
        user.rank = initial.rank;
        user.nextRankScore = initial.nextRankScore;
        user.crystals = 0;

        // Garage + supplies.
        resetGarageInventory(user);
        user.supplies = new Map();

        // Long-term stats.
        user.stats.counters.clear();
        user.stats.maxKillsInBattle = 0;
        user.stats.maxDeathsInBattle = 0;
        user.stats.maxCrystalsInBattle = 0;
        user.stats.maxXpInBattle = 0;
        user.stats.maxDamageInBattle = 0;
        user.stats.currentWinStreak = 0;
        user.stats.maxWinStreak = 0;
        user.stats.currentLossStreak = 0;
        user.stats.maxLossStreak = 0;
        user.markModified("stats");
        await user.save();

        // Fresh daily missions (persists on its own).
        await server.questService.resetDailyQuests(user);

        // Live refresh for an online target.
        if (online) {
            const rankInfo = server.rankService.getRankById(user.rank);
            online.sendPacket(new UpdateCrystals(user.crystals));
            online.sendPacket(new UpdateScorePacket(user.experience));
            online.sendPacket(new UpdateRankPacket({
                rank: user.rank,
                score: user.experience,
                currentRankScore: rankInfo?.minScore ?? 0,
                nextRankScore: user.nextRankScore,
                reward: 0,
            }));
            GarageWorkflow.reloadGarage(online, server);
        }

        context.reply(`Conta de ${user.username} resetada (rank ${user.rank}, 0 cristais, garagem padrão).`);
    }
}
