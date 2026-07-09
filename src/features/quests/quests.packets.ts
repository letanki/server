import { BasePacket } from "@/packets/base.packet";
import { readSchema, writeSchema } from "@/packets/packet-schema";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import { defs } from "protanki-protocol";
import { DailyQuestData } from "./quests.service";
import { INotifyDailyQuestGenerated, IQuest, IReplaceQuest, IRequestQuestsWindow, IShowQuestsWindow, ISkipQuest } from "./quests.types";

// IDs e schemas em `protanki-protocol` (defs.quests.*).

export class RequestQuestsWindow extends BasePacket implements IRequestQuestsWindow {
    read(buffer: Buffer): void { readSchema(this, defs.quests.RequestQuestsWindow.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.quests.RequestQuestsWindow.schema!); }
    static getId(): number { return defs.quests.RequestQuestsWindow.id; }
}

function createDefaultQuest(): IQuest {
    return {
        canSkipForFree: false,
        description: "",
        finishCriteria: 0,
        image: 0,
        prizes: [],
        progress: 0,
        questId: 0,
        skipCost: 0,
    };
}

export class ShowQuestsWindow extends BasePacket implements IShowQuestsWindow {
    quests: IQuest[] = [];
    currentQuestLevel: number = 0;
    currentQuestStreak: number = 0;
    doneForToday: boolean = false;
    questImage: number = 0;
    rewardImage: number = 0;
    constructor(data?: DailyQuestData) {
        super();
        if (data) {
            this.quests = data.quests;
            this.currentQuestLevel = data.currentQuestLevel;
            this.currentQuestStreak = data.currentQuestStreak;
            this.doneForToday = data.doneForToday;
            this.questImage = data.questImage;
            this.rewardImage = data.rewardImage;
        }
    }
    read(buffer: Buffer): void { readSchema(this, defs.quests.ShowQuestsWindow.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.quests.ShowQuestsWindow.schema!); }
    static getId(): number { return defs.quests.ShowQuestsWindow.id; }
}

/**
 * S->C: the daily-missions SUMMARY, sent instead of ShowQuestsWindow when there are NO active missions to list.
 * Codec manual (monta a partir de DailyQuestData; read é no-op).
 */
export class QuestSummaryWindow extends BasePacket {
    constructor(private readonly data?: DailyQuestData) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer {
        const w = new BufferWriter();
        w.writeInt32BE(this.data?.currentQuestLevel ?? 0);
        w.writeInt32BE(this.data?.currentQuestStreak ?? 0);
        w.writeUInt8(this.data?.doneForToday ? 1 : 0);
        w.writeResource(this.data?.questImage ?? 0);
        w.writeResource(this.data?.rewardImage ?? 0);
        return w.getBuffer();
    }
    static getId(): number { return defs.quests.QuestSummaryWindow.id; }
}

export class SkipQuestFree extends BasePacket implements ISkipQuest {
    missionId: number = 0;
    read(buffer: Buffer): void { readSchema(this, defs.quests.SkipQuestFree.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.quests.SkipQuestFree.schema!); }
    static getId(): number { return defs.quests.SkipQuestFree.id; }
}

export class SkipQuestPaid extends BasePacket implements ISkipQuest {
    missionId: number = 0;
    read(buffer: Buffer): void { readSchema(this, defs.quests.SkipQuestPaid.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.quests.SkipQuestPaid.schema!); }
    static getId(): number { return defs.quests.SkipQuestPaid.id; }
}

export class ReplaceQuest extends BasePacket implements IReplaceQuest {
    missionToReplaceId: number = 0;
    newQuest: IQuest = createDefaultQuest();
    constructor(missionToReplaceId?: number, newQuest?: IQuest) {
        super();
        if (missionToReplaceId !== undefined) {
            this.missionToReplaceId = missionToReplaceId;
        }
        if (newQuest) {
            this.newQuest = newQuest;
        }
    }
    read(buffer: Buffer): void { readSchema(this, defs.quests.ReplaceQuest.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.quests.ReplaceQuest.schema!); }
    static getId(): number { return defs.quests.ReplaceQuest.id; }
}

/** S->C: a daily mission just reached its target (real-time popup + raises the unviewed flag). Empty body. */
export class QuestCompletedNotification extends BasePacket {
    read(buffer: Buffer): void { readSchema(this, defs.quests.QuestCompletedNotification.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.quests.QuestCompletedNotification.schema!); }
    static getId(): number { return defs.quests.QuestCompletedNotification.id; }
}

/** C->S: the player clicks "collect" on a completed quest (progress == finishCriteria). Body = int32 questId. */
export class CollectQuestReward extends BasePacket {
    questId: number = 0;
    read(buffer: Buffer): void { readSchema(this, defs.quests.CollectQuestReward.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.quests.CollectQuestReward.schema!); }
    static getId(): number { return defs.quests.CollectQuestReward.id; }
}

/** S->C: confirms a quest reward was collected (client removes the quest). Codec manual (private questId). */
export class QuestRewardCollected extends BasePacket {
    constructor(private readonly questId: number = 0) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer {
        return new BufferWriter().writeInt32BE(this.questId).getBuffer();
    }
    static getId(): number { return defs.quests.QuestRewardCollected.id; }
}

export class NotifyDailyQuestGeneratedPacket extends BasePacket implements INotifyDailyQuestGenerated {
    read(buffer: Buffer): void { readSchema(this, defs.quests.NotifyDailyQuestGenerated.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.quests.NotifyDailyQuestGenerated.schema!); }
    static getId(): number { return defs.quests.NotifyDailyQuestGenerated.id; }
}
