import User, { IUserQuest, UserDocument } from "@/shared/models/user.model";
import { ResourceId } from "@/generated/resourceTypes";
import { ResourceManager } from "@/utils/resource.manager";
import {
    changeCost,
    GOLDBOX_DEFINITION,
    GOLDBOX_REROLL_CHANCE,
    IQuestDefinition,
    PRIZE_ITEM_BY_NAME,
    QuestDefinitions,
    QuestType,
    rollPrize,
} from "./quests.data";
import { IQuest } from "./quests.types";

export interface DailyQuestData {
    quests: IQuest[];
    currentQuestLevel: number;
    currentQuestStreak: number;
    doneForToday: boolean;
    questImage: number;
    rewardImage: number;
}

/** A per-event quest progress delta (only the metrics that changed this event). */
export interface QuestProgressDelta {
    kills?: number;
    score?: number;
    crystals?: number;
    goldBox?: number;
}

const DIFFICULTY_BY_SLOT: ("easy" | "medium" | "hard")[] = ["easy", "medium", "hard"];

/**
 * Applies a progress delta to a user's active quests IN MEMORY (no DB write): caps each at finishCriteria and
 * raises the unviewed-completion flag on a newly-finished quest. Returns {changed, completed} — `completed`
 * lets the caller push the real-time completion notification; the caller persists the user (via its own save,
 * or via QuestService.applyQuestEvent).
 */
export function advanceQuestsInMemory(user: UserDocument, delta: QuestProgressDelta): { changed: boolean; completed: boolean } {
    const byType: Record<string, number> = {
        KILLS: delta.kills ?? 0,
        SCORE: delta.score ?? 0,
        CRYSTALS: delta.crystals ?? 0,
        GOLDBOX: delta.goldBox ?? 0,
    };
    let changed = false;
    let completed = false;
    for (const q of user.dailyQuests) {
        if (q.isCompleted) continue; // already claimed
        const d = byType[q.questType] ?? 0;
        if (d <= 0) continue;
        const capped = Math.min(q.finishCriteria, q.progress + d);
        if (capped !== q.progress) {
            if (q.progress < q.finishCriteria && capped >= q.finishCriteria) completed = true;
            q.progress = capped;
            changed = true;
        }
    }
    if (completed) user.questCompletionUnviewed = true;
    return { changed, completed };
}

export class QuestService {
    private isSameDay(d1: Date, d2: Date): boolean {
        return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
    }

    private definitionFor(type: QuestType): IQuestDefinition {
        return type === "GOLDBOX" ? GOLDBOX_DEFINITION : QuestDefinitions.find((d) => d.type === type) ?? QuestDefinitions[0];
    }

    /** The single free mission change is per DAY (shared across all 3): available until used, restored daily. */
    public freeSkipAvailable(user: UserDocument): boolean {
        return !user.freeQuestSkipUsedDate || !this.isSameDay(user.freeQuestSkipUsedDate, new Date());
    }

    /** The day's id base (day number × 1000): today's quest ids live in (base, base+1000). Grows each day,
     *  so ids are monotonic across days too, and stays well within int32. */
    private questIdBase(): number {
        return Math.floor(Date.now() / 86_400_000) * 1000;
    }

    /** The NEXT quest id = the newest existing id + 1 (monotonically increasing). The client keys quests by id
     *  and expects a replacement/new quest to be "newer" (higher) than what it had — a lower/random id makes it
     *  ignore the change. Distinct ids also stop two identical objectives from colliding. */
    private nextQuestId(existing: number[]): number {
        const base = this.questIdBase();
        const todays = existing.filter((id) => id > base && id <= base + 999); // ignore stale/legacy ids
        return (todays.length ? Math.max(...todays) : base) + 1;
    }

    /** Builds a normal quest at a difficulty (0=easy,1=medium,2=hard) with a caller-supplied unique id. */
    private makeNormalQuest(user: UserDocument, difficulty: number, def: IQuestDefinition, id: number): IUserQuest {
        const criteria = def.criteria[difficulty];
        return {
            questId: id,
            questType: def.type,
            difficulty: DIFFICULTY_BY_SLOT[difficulty],
            progress: 0,
            finishCriteria: criteria,
            prizes: rollPrize(user.rank, difficulty),
            isCompleted: false,
            canSkipForFree: false, // derived per-day at view time
        };
    }

    /** Builds the gold-box quest (catch one gold box; the dedicated "gold" prize tier) with a unique id. */
    private makeGoldBoxQuest(user: UserDocument, id: number): IUserQuest {
        return {
            questId: id,
            questType: "GOLDBOX",
            difficulty: "hard",
            progress: 0,
            finishCriteria: 1,
            prizes: rollPrize(user.rank, 3), // gold-box prize column
            isCompleted: false,
            canSkipForFree: false,
        };
    }

    private randomNormalDefinition(exclude: QuestType[] = []): IQuestDefinition {
        const pool = QuestDefinitions.filter((d) => !exclude.includes(d.type));
        return pool[Math.floor(Math.random() * pool.length)] ?? QuestDefinitions[0];
    }

    private async _generateNewDailyQuests(user: UserDocument): Promise<void> {
        const usedTypes: QuestType[] = [];
        const quests: IUserQuest[] = [];
        for (let slot = 0; slot < 3; slot++) {
            const id = this.nextQuestId(quests.map((q) => q.questId));
            // Any slot can be a gold box (at most one), otherwise a distinct normal type at the slot's difficulty.
            if (!usedTypes.includes("GOLDBOX") && Math.random() < GOLDBOX_REROLL_CHANCE) {
                usedTypes.push("GOLDBOX");
                quests.push(this.makeGoldBoxQuest(user, id));
                continue;
            }
            const def = this.randomNormalDefinition(usedTypes);
            usedTypes.push(def.type);
            quests.push(this.makeNormalQuest(user, slot, def, id));
        }
        user.dailyQuests = quests;
        user.lastQuestGeneratedDate = new Date();
        user.freeQuestSkipUsedDate = null; // new day → the free change is available again
        await user.save();
    }

    /** Debug/testing: regenerate today's daily missions from scratch (fresh, uncompleted, free change restored). */
    public async resetDailyQuests(user: UserDocument): Promise<void> {
        user.questCompletionUnviewed = false;
        await this._generateNewDailyQuests(user); // fresh quests + freeQuestSkipUsedDate=null; persists the doc
    }

    /** Wire view of a stored quest (progress is kept live in real time, so it's shown as stored). */
    public buildQuestView(user: UserDocument, q: IUserQuest): IQuest {
        const def = this.definitionFor(q.questType as QuestType);
        return {
            canSkipForFree: this.freeSkipAvailable(user),
            description: def.description.replace("%n", q.finishCriteria.toString()),
            finishCriteria: q.finishCriteria,
            image: ResourceManager.getIdlowById(def.imageResource),
            progress: q.progress,
            questId: q.questId,
            skipCost: changeCost(user.rank),
            prizes: q.prizes,
        };
    }

    /**
     * Rerolls one daily quest into a fresh random objective (random difficulty + type; the 3rd slot may roll a
     * gold box) with a newly rolled reward — matching the official capture, where a reroll that lands on the
     * same type+criteria keeps its questId and a different objective gets a different id (questId is derived).
     * The free path consumes the day's single free change; the paid path charges the rank-scaled cost.
     */
    public async rerollQuest(user: UserDocument, questIdToReplace: number, isPaid: boolean): Promise<{ oldQuestId: number; newQuest: IUserQuest }> {
        const idx = user.dailyQuests.findIndex((q) => q.questId === questIdToReplace);
        if (idx === -1) throw new Error("Missão não encontrada.");

        if (isPaid) {
            const cost = changeCost(user.rank);
            if (user.crystals < cost) throw new Error("Cristais insuficientes.");
            user.crystals -= cost;
        } else {
            if (!this.freeSkipAvailable(user)) throw new Error("A troca gratuita do dia já foi usada.");
            user.freeQuestSkipUsedDate = new Date(); // consume the day's free change
        }

        // A fresh id = newest current id + 1 (monotonic; distinct from the other quests). Any slot can reroll
        // into any objective (incl. a gold box) at a random difficulty.
        const id = this.nextQuestId(user.dailyQuests.map((q) => q.questId));
        const newQuest =
            Math.random() < GOLDBOX_REROLL_CHANCE
                ? this.makeGoldBoxQuest(user, id)
                : this.makeNormalQuest(user, Math.floor(Math.random() * 3), this.randomNormalDefinition(), id);

        user.dailyQuests[idx] = newQuest;
        await user.save();
        return { oldQuestId: questIdToReplace, newQuest };
    }

    /**
     * Applies a per-event quest progress delta AND persists it — for callers that don't already save the user
     * (gold-box pickup, crystal drops, fund payout). Returns whether any quest just completed, so the caller
     * can send the QuestCompletedNotification. (Combat folds progress into its existing killer.save() via the
     * standalone advanceQuestsInMemory instead, to avoid an extra write per kill.)
     */
    public async applyQuestEvent(user: UserDocument, delta: QuestProgressDelta): Promise<boolean> {
        const { changed, completed } = advanceQuestsInMemory(user, delta);
        if (changed) {
            await User.updateOne(
                { _id: user._id },
                { $set: { dailyQuests: user.dailyQuests, ...(completed ? { questCompletionUnviewed: true } : {}) } }
            );
        }
        return completed;
    }

    /** Whether the player has a completed-but-unseen mission (drives the login auto-open). */
    public hasUnviewedCompletion(user: UserDocument): boolean {
        return !!user.questCompletionUnviewed;
    }

    /**
     * Collects a COMPLETED (progress == finishCriteria), not-yet-claimed quest's reward: grants crystals/supplies,
     * marks it claimed (`isCompleted`, so it drops from the list), and advances the daily-completion streak.
     * Returns the crystals granted (for the balance packet), or null if the quest isn't collectable.
     */
    public async collectReward(user: UserDocument, questId: number): Promise<{ crystalsGranted: number } | null> {
        const q = user.dailyQuests.find((x) => x.questId === questId);
        if (!q || q.isCompleted || q.progress < q.finishCriteria) return null;

        const supplyGrants: Record<string, number> = {};
        const crystalsGranted = this._grantQuestPrize(user, q, supplyGrants);
        q.isCompleted = true; // = reward claimed
        this._advanceStreak(user);

        const inc: Record<string, number> = {};
        if (crystalsGranted > 0) inc.crystals = crystalsGranted;
        for (const [id, count] of Object.entries(supplyGrants)) inc[`supplies.${id}`] = count;
        await User.updateOne(
            { _id: user._id },
            {
                $set: {
                    dailyQuests: user.dailyQuests,
                    questStreak: user.questStreak,
                    questLevel: user.questLevel,
                    lastQuestCompletedDate: user.lastQuestCompletedDate,
                },
                ...(Object.keys(inc).length ? { $inc: inc } : {}),
            }
        );
        return { crystalsGranted };
    }

    /** Tallies a completed quest's reward (crystals + supplies) into the in-memory user + the grant maps. */
    private _grantQuestPrize(user: UserDocument, quest: IUserQuest, supplyGrants: Record<string, number>): number {
        let crystals = 0;
        for (const prize of quest.prizes) {
            const item = PRIZE_ITEM_BY_NAME[prize.itemName];
            if (item === "crystals") {
                user.crystals += prize.itemCount; // in-memory (drives the UpdateCrystals packet); persisted via $inc
                crystals += prize.itemCount;
            } else if (item) {
                user.supplies.set(item, (user.supplies.get(item) ?? 0) + prize.itemCount);
                supplyGrants[item] = (supplyGrants[item] ?? 0) + prize.itemCount;
            }
        }
        return crystals;
    }

    /** Bumps the consecutive-day completion streak on the first quest completed each day (drives the weekly chain). */
    private _advanceStreak(user: UserDocument): void {
        const now = new Date();
        if (user.lastQuestCompletedDate && this.isSameDay(user.lastQuestCompletedDate, now)) return; // already counted today
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const continued = user.lastQuestCompletedDate && this.isSameDay(user.lastQuestCompletedDate, yesterday);
        user.questStreak = continued ? user.questStreak + 1 : 1;
        user.questLevel = Math.max(1, Math.min(4, Math.ceil(user.questStreak / 7))); // week 1-4 of the chain
        user.lastQuestCompletedDate = now;
    }

    public async getQuestsForUser(user: UserDocument): Promise<DailyQuestData> {
        const now = new Date();
        const base = this.questIdBase();
        // Regenerate on a new day OR when the stored ids don't fit today's monotonic range (migrates the old
        // random/hash ids to clean increasing ones so changes register on the client).
        const stale =
            !user.lastQuestGeneratedDate ||
            !this.isSameDay(user.lastQuestGeneratedDate, now) ||
            user.dailyQuests.length !== 3 ||
            user.dailyQuests.some((q) => q.questId <= base || q.questId > base + 999);
        if (stale) {
            await this._generateNewDailyQuests(user);
        }

        // Opening the window marks any completed missions as viewed (clears the login auto-open flag).
        if (user.questCompletionUnviewed) {
            user.questCompletionUnviewed = false;
            await User.updateOne({ _id: user._id }, { $set: { questCompletionUnviewed: false } });
        }

        const quests = user.dailyQuests.filter((q) => !q.isCompleted).map((q) => this.buildQuestView(user, q));
        const doneForToday = user.lastQuestCompletedDate ? this.isSameDay(user.lastQuestCompletedDate, now) : false;

        const weekLevel = Math.max(1, Math.min(user.questLevel, 4));
        const questChainPath = `ui/quests/window/week${weekLevel}/quest_chain` as ResourceId;
        const finalRewardPath = `ui/quests/window/week${weekLevel}/final_reward` as ResourceId;

        return {
            quests,
            currentQuestLevel: user.questLevel,
            currentQuestStreak: user.questStreak,
            doneForToday,
            questImage: ResourceManager.getIdlowById(questChainPath),
            rewardImage: ResourceManager.getIdlowById(finalRewardPath),
        };
    }
}
