import { BasePacket } from "@/packets/base.packet";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import { DailyQuestData } from "./quests.service";
import { INotifyDailyQuestGenerated, IQuest, IReplaceQuest, IRequestQuestsWindow, IShowQuestsWindow, ISkipQuest } from "./quests.types";

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

    read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        const questsCount = reader.readInt32BE();
        this.quests = [];
        for (let i = 0; i < questsCount; i++) {
            const quest: IQuest = {
                canSkipForFree: reader.readUInt8() === 1,
                description: reader.readOptionalString(),
                finishCriteria: reader.readInt32BE(),
                image: reader.readResource(),
                prizes: [],
                progress: 0,
                questId: 0,
                skipCost: 0,
            };

            const prizesCount = reader.readInt32BE();
            for (let j = 0; j < prizesCount; j++) {
                quest.prizes.push({
                    itemCount: reader.readInt32BE(),
                    itemName: reader.readOptionalString() ?? "",
                });
            }

            quest.progress = reader.readInt32BE();
            quest.questId = reader.readInt32BE();
            quest.skipCost = reader.readInt32BE();
            this.quests.push(quest);
        }

        this.currentQuestLevel = reader.readInt32BE();
        this.currentQuestStreak = reader.readInt32BE();
        this.doneForToday = reader.readUInt8() === 1;
        this.questImage = reader.readResource();
        this.rewardImage = reader.readResource();
    }

    write(): Buffer {
        const writer = new BufferWriter();

        writer.writeInt32BE(this.quests.length);
        for (const quest of this.quests) {
            writer.writeUInt8(quest.canSkipForFree ? 1 : 0);
            writer.writeOptionalString(quest.description);
            writer.writeInt32BE(quest.finishCriteria);
            writer.writeResource(quest.image);

            writer.writeInt32BE(quest.prizes.length);
            for (const prize of quest.prizes) {
                writer.writeInt32BE(prize.itemCount);
                writer.writeOptionalString(prize.itemName);
            }

            writer.writeInt32BE(quest.progress);
            writer.writeInt32BE(quest.questId);
            writer.writeInt32BE(quest.skipCost);
        }

        writer.writeInt32BE(this.currentQuestLevel);
        writer.writeInt32BE(this.currentQuestStreak);
        writer.writeUInt8(this.doneForToday ? 1 : 0);
        writer.writeResource(this.questImage);
        writer.writeResource(this.rewardImage);

        return writer.getBuffer();
    }

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

    read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        this.missionToReplaceId = reader.readInt32BE();

        const newQuestData = createDefaultQuest();
        newQuestData.canSkipForFree = reader.readUInt8() === 1;
        newQuestData.description = reader.readOptionalString();
        newQuestData.finishCriteria = reader.readInt32BE();
        newQuestData.image = reader.readResource();

        const prizesCount = reader.readInt32BE();
        newQuestData.prizes = [];
        for (let i = 0; i < prizesCount; i++) {
            newQuestData.prizes.push({
                itemCount: reader.readInt32BE(),
                itemName: reader.readOptionalString() ?? "",
            });
        }

        newQuestData.progress = reader.readInt32BE();
        newQuestData.questId = reader.readInt32BE();
        newQuestData.skipCost = reader.readInt32BE();

        this.newQuest = newQuestData;
    }

    write(): Buffer {
        const writer = new BufferWriter();

        writer.writeInt32BE(this.missionToReplaceId);

        const quest = this.newQuest;
        writer.writeUInt8(quest.canSkipForFree ? 1 : 0);
        writer.writeOptionalString(quest.description);
        writer.writeInt32BE(quest.finishCriteria);
        writer.writeResource(quest.image);

        writer.writeInt32BE(quest.prizes.length);
        for (const prize of quest.prizes) {
            writer.writeInt32BE(prize.itemCount);
            writer.writeOptionalString(prize.itemName);
        }

        writer.writeInt32BE(quest.progress);
        writer.writeInt32BE(quest.questId);
        writer.writeInt32BE(quest.skipCost);

        return writer.getBuffer();
    }

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