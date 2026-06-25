import { IUserQuest, UserDocument } from "@/shared/models/user.model";
import { ResourceId } from "@/generated/resourceTypes";
import { ResourceManager } from "@/utils/resource.manager";
import { QuestDefinitions, QuestType } from "./quests.data";
import { IQuest } from "./quests.types";

export interface DailyQuestData {
    quests: IQuest[];
    currentQuestLevel: number;
    currentQuestStreak: number;
    doneForToday: boolean;
    questImage: number;
    rewardImage: number;
}

export class QuestService {
    private isSameDay(d1: Date, d2: Date): boolean {
        return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
    }

    private _generateNewQuest(user: UserDocument, existingQuestTypes: QuestType[]): IUserQuest {
        const availableDefinitions = QuestDefinitions.filter((def) => !existingQuestTypes.includes(def.type));
        if (availableDefinitions.length === 0) {
            throw new Error("Não há mais missões disponíveis para gerar.");
        }

        const definitionIndex = Math.floor(Math.random() * availableDefinitions.length);
        const definition = availableDefinitions[definitionIndex];

        const variantIndex = Math.floor(Math.random() * definition.variants.length);
        const variant = definition.variants[variantIndex];

        const finishCriteria = Math.floor(variant.baseCriteria + (user.rank - 1) * variant.criteriaPerRank);
        const rewardAmount = Math.floor(variant.baseReward + (user.rank - 1) * variant.rewardPerRank);

        return {
            questId: Math.floor(Math.random() * 1000000),
            questType: definition.type,
            difficulty: variant.difficulty,
            progress: 0,
            finishCriteria: finishCriteria,
            prizes: [{ itemName: "Cristais", itemCount: rewardAmount }],
            isCompleted: false,
            canSkipForFree: false,
        };
    }

    private async _generateNewDailyQuests(user: UserDocument): Promise<void> {
        const quests: IUserQuest[] = [];
        const existingQuestTypes: QuestType[] = [];

        for (let i = 0; i < 3; i++) {
            const newQuest = this._generateNewQuest(user, existingQuestTypes);
            quests.push(newQuest);
            existingQuestTypes.push(newQuest.questType);
        }

        user.dailyQuests = quests;
        user.dailyQuests[0].canSkipForFree = true;
        user.lastQuestGeneratedDate = new Date();
        await user.save();
    }

    public async rerollQuest(user: UserDocument, questIdToReplace: number, isPaid: boolean): Promise<{ oldQuestId: number; newQuest: IUserQuest }> {
        const questIndex = user.dailyQuests.findIndex((q) => q.questId === questIdToReplace);
        if (questIndex === -1) {
            throw new Error("Missão não encontrada.");
        }

        const questToReplace = user.dailyQuests[questIndex];
        const definition = QuestDefinitions.find((def) => def.type === questToReplace.questType);
        if (!definition) {
            throw new Error("Definição da missão não encontrada.");
        }

        if (isPaid) {
            if (user.crystals < definition.skipCost) {
                throw new Error("Cristais insuficientes.");
            }
            user.crystals -= definition.skipCost;
        } else {
            if (!questToReplace.canSkipForFree) {
                throw new Error("Esta missão não pode ser trocada gratuitamente.");
            }
        }

        const existingQuestTypes = user.dailyQuests.filter((q, index) => index !== questIndex).map((q) => q.questType);
        const newQuest = this._generateNewQuest(user, existingQuestTypes);
        newQuest.canSkipForFree = false;

        user.dailyQuests[questIndex] = newQuest;
        await user.save();

        return { oldQuestId: questIdToReplace, newQuest };
    }

    public async getQuestsForUser(user: UserDocument): Promise<DailyQuestData> {
        const now = new Date();
        if (!user.lastQuestGeneratedDate || !this.isSameDay(user.lastQuestGeneratedDate, now)) {
            await this._generateNewDailyQuests(user);
        }

        const questsForPacket: IQuest[] = user.dailyQuests
            .filter((q) => !q.isCompleted)
            .map((q) => {
                const definition = QuestDefinitions.find((def) => def.type === q.questType);
                if (!definition) {
                    return null;
                }

                const quest: IQuest = {
                    canSkipForFree: q.canSkipForFree,
                    description: definition.description.replace("%n", q.finishCriteria.toString()),
                    finishCriteria: q.finishCriteria,
                    image: ResourceManager.getIdlowById(definition.imageResource),
                    progress: q.progress,
                    questId: q.questId,
                    skipCost: definition.skipCost,
                    prizes: q.prizes,
                };
                return quest;
            })
            .filter((q): q is IQuest => q !== null);

        const doneForToday = user.lastQuestCompletedDate ? this.isSameDay(user.lastQuestCompletedDate, now) : false;

        const weekLevel = Math.max(1, Math.min(user.questLevel, 4));
        const questChainPath = `ui/quests/window/week${weekLevel}/quest_chain` as ResourceId;
        const finalRewardPath = `ui/quests/window/week${weekLevel}/final_reward` as ResourceId;

        return {
            quests: questsForPacket,
            currentQuestLevel: user.questLevel,
            currentQuestStreak: user.questStreak,
            doneForToday,
            questImage: ResourceManager.getIdlowById(questChainPath),
            rewardImage: ResourceManager.getIdlowById(finalRewardPath),
        };
    }
}