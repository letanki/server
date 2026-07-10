import { BasePacket } from "@/packets/base.packet";
import { packetClass } from "@/packets/packet-class";
import { defs, encodeBody } from "protanki-protocol";
import { DailyQuestData } from "./quests.service";

// IDs e schemas em `protanki-protocol` (defs.quests.*).

export const RequestQuestsWindow = packetClass(defs.quests.RequestQuestsWindow);
export type RequestQuestsWindow = InstanceType<typeof RequestQuestsWindow>;

export const ShowQuestsWindow = packetClass(defs.quests.ShowQuestsWindow);
export type ShowQuestsWindow = InstanceType<typeof ShowQuestsWindow>;

/**
 * S->C: the daily-missions SUMMARY, sent instead of ShowQuestsWindow when there are NO active missions to list.
 * Codec manual (monta a partir de DailyQuestData; read é no-op).
 */
export class QuestSummaryWindow extends BasePacket {
    constructor(private readonly data?: DailyQuestData) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer {
        return encodeBody(defs.quests.QuestSummaryWindow, {
            currentQuestLevel: this.data?.currentQuestLevel ?? 0,
            currentQuestStreak: this.data?.currentQuestStreak ?? 0,
            doneForToday: this.data?.doneForToday ?? false,
            questImage: this.data?.questImage ?? 0,
            rewardImage: this.data?.rewardImage ?? 0,
        });
    }
    static getId(): number { return defs.quests.QuestSummaryWindow.id; }
}

export const SkipQuestFree = packetClass(defs.quests.SkipQuestFree);
export type SkipQuestFree = InstanceType<typeof SkipQuestFree>;

export const SkipQuestPaid = packetClass(defs.quests.SkipQuestPaid);
export type SkipQuestPaid = InstanceType<typeof SkipQuestPaid>;

export const ReplaceQuest = packetClass(defs.quests.ReplaceQuest);
export type ReplaceQuest = InstanceType<typeof ReplaceQuest>;

export const QuestCompletedNotification = packetClass(defs.quests.QuestCompletedNotification);
export type QuestCompletedNotification = InstanceType<typeof QuestCompletedNotification>;

export const CollectQuestReward = packetClass(defs.quests.CollectQuestReward);
export type CollectQuestReward = InstanceType<typeof CollectQuestReward>;

/** S->C: confirms a quest reward was collected (client removes the quest). Codec manual (private questId). */
export class QuestRewardCollected extends BasePacket {
    constructor(private readonly questId: number = 0) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return encodeBody(defs.quests.QuestRewardCollected, { questId: this.questId }); }
    static getId(): number { return defs.quests.QuestRewardCollected.id; }
}

export const NotifyDailyQuestGeneratedPacket = packetClass(defs.quests.NotifyDailyQuestGenerated);
export type NotifyDailyQuestGeneratedPacket = InstanceType<typeof NotifyDailyQuestGeneratedPacket>;
