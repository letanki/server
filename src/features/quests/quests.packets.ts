import { BasePacket } from "@/packets/base.packet";
import { PacketSchema, readSchema, writeSchema } from "@/packets/packet-schema";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import { DailyQuestData } from "./quests.service";
import { INotifyDailyQuestGenerated, IQuest, IReplaceQuest, IRequestQuestsWindow, IShowQuestsWindow, ISkipQuest } from "./quests.types";

// Quest fields shared by ShowQuestsWindow (as a list item) and ReplaceQuest (as a single object).
const QUEST_FIELDS: PacketSchema = [
    { name: "canSkipForFree", type: "bool" },
    { name: "description", type: "string" },
    { name: "finishCriteria", type: "i32" },
    { name: "image", type: "resource" },
    { name: "prizes", type: "list", of: [
        { name: "itemCount", type: "i32" },
        { name: "itemName", type: "string" },
    ] },
    { name: "progress", type: "i32" },
    { name: "questId", type: "i32" },
    { name: "skipCost", type: "i32" },
];

export class RequestQuestsWindow extends BasePacket implements IRequestQuestsWindow {
    read(buffer: Buffer): void { }
    write(): Buffer {
        return new BufferWriter().getBuffer();
    }
    static getId(): number {
        return 1227293080;
    }
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

    static readonly schema: PacketSchema = [
        { name: "quests", type: "list", of: QUEST_FIELDS },
        { name: "currentQuestLevel", type: "i32" },
        { name: "currentQuestStreak", type: "i32" },
        { name: "doneForToday", type: "bool" },
        { name: "questImage", type: "resource" },
        { name: "rewardImage", type: "resource" },
    ];

    read(buffer: Buffer): void { readSchema(this, ShowQuestsWindow.schema, buffer); }
    write(): Buffer { return writeSchema(this, ShowQuestsWindow.schema); }

    static getId(): number {
        return 809822533;
    }
}

export class SkipQuestFree extends BasePacket implements ISkipQuest {
    missionId: number = 0;
    read(buffer: Buffer): void {
        this.missionId = new BufferReader(buffer).readInt32BE();
    }
    write(): Buffer {
        return new BufferWriter().writeInt32BE(this.missionId).getBuffer();
    }
    static getId(): number {
        return 326032325;
    }
}

export class SkipQuestPaid extends BasePacket implements ISkipQuest {
    missionId: number = 0;
    read(buffer: Buffer): void {
        this.missionId = new BufferReader(buffer).readInt32BE();
    }
    write(): Buffer {
        return new BufferWriter().writeInt32BE(this.missionId).getBuffer();
    }
    static getId(): number {
        return 1642608662;
    }
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

    static readonly schema: PacketSchema = [
        { name: "missionToReplaceId", type: "i32" },
        { name: "newQuest", type: "object", of: QUEST_FIELDS },
    ];

    read(buffer: Buffer): void { readSchema(this, ReplaceQuest.schema, buffer); }
    write(): Buffer { return writeSchema(this, ReplaceQuest.schema); }

    static getId(): number {
        return -1266665816;
    }
}

export class NotifyDailyQuestGeneratedPacket extends BasePacket implements INotifyDailyQuestGenerated {
    read(buffer: Buffer): void { }
    write(): Buffer {
        return new BufferWriter().getBuffer();
    }
    static getId(): number {
        return 956252237;
    }
}