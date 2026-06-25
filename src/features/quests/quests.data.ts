import { ResourceId } from "@/generated/resourceTypes";

export type QuestType = "KILLS" | "SCORE" | "CRYSTALS";
export type QuestDifficulty = "easy" | "medium" | "hard";

export interface IQuestVariant {
    difficulty: QuestDifficulty;
    baseCriteria: number;
    criteriaPerRank: number;
    baseReward: number;
    rewardPerRank: number;
}

export interface IQuestDefinition {
    type: QuestType;
    description: string;
    imageResource: ResourceId;
    variants: IQuestVariant[];
    skipCost: number;
}

export const QuestDefinitions: IQuestDefinition[] = [
    {
        type: "KILLS",
        description: "Destrua %n inimigos",
        imageResource: "ui/quests/icons/kill_enemies",
        variants: [
            { difficulty: "easy", baseCriteria: 10, criteriaPerRank: 2, baseReward: 100, rewardPerRank: 10 },
            { difficulty: "medium", baseCriteria: 25, criteriaPerRank: 5, baseReward: 250, rewardPerRank: 25 },
            { difficulty: "hard", baseCriteria: 50, criteriaPerRank: 10, baseReward: 500, rewardPerRank: 50 },
        ],
        skipCost: 644,
    },
    {
        type: "SCORE",
        description: "Ganhe %n de pontuação nas batalhas",
        imageResource: "ui/quests/icons/battle_score",
        variants: [
            { difficulty: "easy", baseCriteria: 100, criteriaPerRank: 20, baseReward: 100, rewardPerRank: 10 },
            { difficulty: "medium", baseCriteria: 250, criteriaPerRank: 50, baseReward: 250, rewardPerRank: 25 },
            { difficulty: "hard", baseCriteria: 500, criteriaPerRank: 100, baseReward: 500, rewardPerRank: 50 },
        ],
        skipCost: 644,
    },
    {
        type: "CRYSTALS",
        description: "Colete %n cristais em batalhas",
        imageResource: "ui/quests/icons/get_crystal",
        variants: [
            { difficulty: "easy", baseCriteria: 50, criteriaPerRank: 10, baseReward: 100, rewardPerRank: 10 },
            { difficulty: "medium", baseCriteria: 150, criteriaPerRank: 25, baseReward: 250, rewardPerRank: 25 },
            { difficulty: "hard", baseCriteria: 350, criteriaPerRank: 50, baseReward: 500, rewardPerRank: 50 },
        ],
        skipCost: 644,
    },
];