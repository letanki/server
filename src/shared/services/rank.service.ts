import { Rank, Ranks } from "@/config/rank.data";
import { UserDocument } from "@/shared/models/user.model";
import logger from "@/utils/logger";

export class RankService {
    private ranksById: Map<number, Rank> = new Map();
    private sortedRanks: Rank[] = [];

    constructor() {
        this.sortedRanks = [...Ranks].sort((a, b) => a.minScore - b.minScore);
        this.sortedRanks.forEach((rank) => this.ranksById.set(rank.id, rank));
    }

    public getRankById(id: number): Rank | undefined {
        return this.ranksById.get(id);
    }

    public getRankForExperience(experience: number): Rank {
        let currentRank: Rank = this.sortedRanks[0];
        for (const rank of this.sortedRanks) {
            if (experience >= rank.minScore) {
                currentRank = rank;
            } else {
                break;
            }
        }
        return currentRank;
    }

    public getInitialRankData(): { rank: number; score: number; nextRankScore: number } {
        const initialRank = this.sortedRanks[0];
        const nextRank = this.sortedRanks[1];
        return {
            rank: initialRank.id,
            score: 0,
            nextRankScore: nextRank.minScore,
        };
    }

    public updateRank(user: UserDocument): boolean {
        const originalRankId = user.rank;
        const newRank = this.getRankForExperience(user.experience);

        if (newRank.id !== user.rank) {
            user.rank = newRank.id;
            logger.info(`User ${user.username} ranked up to ${newRank.name}!`);
        }

        const nextRankInfo = this.getRankById(user.rank + 1);
        if (nextRankInfo) {
            user.nextRankScore = nextRankInfo.minScore;
        } else {
            // Max rank: there is no next threshold, so the client shows score/0 (not score/score).
            user.nextRankScore = 0;
        }

        return originalRankId !== newRank.id;
    }
}