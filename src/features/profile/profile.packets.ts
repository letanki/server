import { BasePacket } from "@/packets/base.packet";
import { Achievement } from "@/shared/models/enums/achievement.enum";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import * as ProfileTypes from "./profile.types";

export class GetUserInfo extends BasePacket implements ProfileTypes.IGetUserInfo {
    nickname: string | null;

    constructor(nickname: string | null = null) {
        super();
        this.nickname = nickname;
    }

    read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        this.nickname = reader.readOptionalString();
    }

    write(): Buffer {
        const writer = new BufferWriter();
        writer.writeOptionalString(this.nickname);
        return writer.getBuffer();
    }

    static getId(): number {
        return 1774907609;
    }
}

export class OnlineNotifierData extends BasePacket implements ProfileTypes.IOnlineNotifierData {
    isOnline: boolean = false;
    server: number = 0;
    nickname: string = "";

    constructor(isOnline?: boolean, server?: number, nickname?: string) {
        super();
        if (isOnline !== undefined) this.isOnline = isOnline;
        if (server !== undefined) this.server = server;
        if (nickname) this.nickname = nickname;
    }

    read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        this.isOnline = reader.readUInt8() === 1;
        this.server = reader.readInt32BE();
        this.nickname = reader.readOptionalString() ?? "";
    }

    write(): Buffer {
        const writer = new BufferWriter();
        writer.writeUInt8(this.isOnline ? 1 : 0);
        writer.writeInt32BE(this.server);
        writer.writeOptionalString(this.nickname);
        return writer.getBuffer();
    }
    static getId(): number {
        return 2041598093;
    }
}

export class RankNotifierData extends BasePacket implements ProfileTypes.IRankNotifierData {
    rank: number = 0;
    nickname: string = "";

    constructor(rank?: number, nickname?: string) {
        super();
        if (rank !== undefined) this.rank = rank;
        if (nickname) this.nickname = nickname;
    }

    read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        this.rank = reader.readUInt8();
        this.nickname = reader.readOptionalString() ?? "";
    }

    write(): Buffer {
        const writer = new BufferWriter();
        writer.writeUInt8(this.rank);
        writer.writeOptionalString(this.nickname);
        return writer.getBuffer();
    }
    static getId(): number {
        return -962759489;
    }
}

export class PremiumNotifierData extends BasePacket implements ProfileTypes.IPremiumNotifierData {
    premiumTimeLeftInSeconds: number = 0;
    nickname: string = "";

    constructor(premiumTimeLeftInSeconds?: number, nickname?: string) {
        super();
        if (premiumTimeLeftInSeconds !== undefined) this.premiumTimeLeftInSeconds = premiumTimeLeftInSeconds;
        if (nickname) this.nickname = nickname;
    }

    read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        this.premiumTimeLeftInSeconds = reader.readInt32BE();
        this.nickname = reader.readOptionalString() ?? "";
    }

    write(): Buffer {
        const writer = new BufferWriter();
        writer.writeInt32BE(this.premiumTimeLeftInSeconds);
        writer.writeOptionalString(this.nickname);
        return writer.getBuffer();
    }
    static getId(): number {
        return -2069508071;
    }
}

export class ClanNotifierData extends BasePacket implements ProfileTypes.IClanNotifierData {
    inClan: boolean = false;
    clanTag: string | null = null;
    nickname: string = "";

    constructor(nickname?: string, clanTag?: string | null) {
        super();
        if (nickname) this.nickname = nickname;
        if (clanTag) {
            this.clanTag = clanTag;
            this.inClan = true;
        }
    }

    read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        this.inClan = reader.readUInt8() === 1;
        this.clanTag = reader.readOptionalString();
        this.nickname = reader.readOptionalString() ?? "";
    }

    write(): Buffer {
        const writer = new BufferWriter();
        writer.writeUInt8(this.inClan ? 1 : 0);
        writer.writeOptionalString(this.clanTag);
        writer.writeOptionalString(this.nickname);
        return writer.getBuffer();
    }
    static getId(): number {
        return -117055417;
    }
}

export class AchievementTips extends BasePacket implements ProfileTypes.IAchievementTips {
    achievementIds: Achievement[] = [];

    constructor(achievementIds?: Achievement[]) {
        super();
        if (achievementIds) {
            this.achievementIds = achievementIds;
        }
    }

    read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        const count = reader.readInt32BE();
        this.achievementIds = [];
        for (let i = 0; i < count; i++) {
            this.achievementIds.push(reader.readInt32BE());
        }
    }

    write(): Buffer {
        const writer = new BufferWriter();
        writer.writeInt32BE(this.achievementIds.length);
        this.achievementIds.forEach((id) => {
            writer.writeInt32BE(id);
        });
        return writer.getBuffer();
    }
    static getId(): number {
        return -1481254568;
    }
}

export class EmailInfo extends BasePacket implements ProfileTypes.IEmailInfo {
    email: string | null = null;
    emailConfirmed: boolean = false;

    constructor(email?: string | null, emailConfirmed?: boolean) {
        super();
        if (email) this.email = email;
        if (emailConfirmed) this.emailConfirmed = emailConfirmed;
    }

    read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        this.email = reader.readOptionalString();
        this.emailConfirmed = reader.readUInt8() === 1;
    }

    write(): Buffer {
        const writer = new BufferWriter();
        writer.writeOptionalString(this.email);
        writer.writeUInt8(this.emailConfirmed ? 1 : 0);
        return writer.getBuffer();
    }
    static getId(): number {
        return 613462801;
    }
}

export class PremiumInfo extends BasePacket implements ProfileTypes.IPremiumInfo {
    needShowNotificationCompletionPremium: boolean = false;
    needShowWelcomeAlert: boolean = false;
    reminderCompletionPremiumTime: number = 0;
    wasShowAlertForFirstPurchasePremium: boolean = false;
    wasShowReminderCompletionPremium: boolean = false;
    lifeTimeInSeconds: number = 0;

    constructor(lifeTimeInSeconds?: number, needShowNotification?: boolean, needShowWelcome?: boolean) {
        super();
        if (lifeTimeInSeconds !== undefined) this.lifeTimeInSeconds = lifeTimeInSeconds;
        if (needShowNotification !== undefined) this.needShowNotificationCompletionPremium = needShowNotification;
        if (needShowWelcome !== undefined) this.needShowWelcomeAlert = needShowWelcome;
    }

    read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        this.needShowNotificationCompletionPremium = reader.readUInt8() === 1;
        this.needShowWelcomeAlert = reader.readUInt8() === 1;
        this.reminderCompletionPremiumTime = reader.readFloatBE();
        this.wasShowAlertForFirstPurchasePremium = reader.readUInt8() === 1;
        this.wasShowReminderCompletionPremium = reader.readUInt8() === 1;
        this.lifeTimeInSeconds = reader.readInt32BE();
    }

    write(): Buffer {
        const writer = new BufferWriter();
        writer.writeUInt8(this.needShowNotificationCompletionPremium ? 1 : 0);
        writer.writeUInt8(this.needShowWelcomeAlert ? 1 : 0);
        writer.writeFloatBE(this.reminderCompletionPremiumTime);
        writer.writeUInt8(this.wasShowAlertForFirstPurchasePremium ? 1 : 0);
        writer.writeUInt8(this.wasShowReminderCompletionPremium ? 1 : 0);
        writer.writeInt32BE(this.lifeTimeInSeconds);
        return writer.getBuffer();
    }
    static getId(): number {
        return 1405859779;
    }
}

export class UpdateCrystals extends BasePacket implements ProfileTypes.IUpdateCrystals {
    crystals: number = 0;

    constructor(crystals?: number) {
        super();
        if (crystals !== undefined) {
            this.crystals = crystals;
        }
    }

    read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        this.crystals = reader.readInt32BE();
    }

    write(): Buffer {
        const writer = new BufferWriter();
        writer.writeInt32BE(this.crystals);
        return writer.getBuffer();
    }
    static getId(): number {
        return -593513288;
    }
}

export class UpdateScorePacket extends BasePacket implements ProfileTypes.IUpdateScore {
    score: number;

    constructor(score: number = 0) {
        super();
        this.score = score;
    }

    read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        this.score = reader.readInt32BE();
    }

    write(): Buffer {
        const writer = new BufferWriter();
        writer.writeInt32BE(this.score);
        return writer.getBuffer();
    }
    static getId(): number {
        return 2116086491;
    }
}

export class UpdateRankPacket extends BasePacket implements ProfileTypes.IUpdateRank {
    rank: number;
    score: number;
    currentRankScore: number;
    nextRankScore: number;
    reward: number;

    constructor(data?: ProfileTypes.IUpdateRankData) {
        super();
        this.rank = data?.rank ?? 0;
        this.score = data?.score ?? 0;
        this.currentRankScore = data?.currentRankScore ?? 0;
        this.nextRankScore = data?.nextRankScore ?? 0;
        this.reward = data?.reward ?? 0;
    }

    read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        this.rank = reader.readInt32BE();
        this.score = reader.readInt32BE();
        this.currentRankScore = reader.readInt32BE();
        this.nextRankScore = reader.readInt32BE();
        this.reward = reader.readInt32BE();
    }

    write(): Buffer {
        const writer = new BufferWriter();
        writer.writeInt32BE(this.rank);
        writer.writeInt32BE(this.score);
        writer.writeInt32BE(this.currentRankScore);
        writer.writeInt32BE(this.nextRankScore);
        writer.writeInt32BE(this.reward);
        return writer.getBuffer();
    }
    static getId(): number {
        return 1989173907;
    }
}

export class UpdatePremiumTimePacket extends BasePacket implements ProfileTypes.IUpdatePremiumTime {
    timeLeft: number = 0;

    constructor(timeLeft?: number) {
        super();
        if (timeLeft !== undefined) {
            this.timeLeft = timeLeft;
        }
    }

    read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        this.timeLeft = reader.readInt32BE();
    }

    write(): Buffer {
        const writer = new BufferWriter();
        writer.writeInt32BE(this.timeLeft);
        return writer.getBuffer();
    }
    static getId(): number {
        return 1391146385;
    }
}