import { BasePacket } from "@/packets/base.packet";
import { PacketSchema, readSchema, writeSchema } from "@/packets/packet-schema";
import { Achievement } from "@/shared/models/enums/achievement.enum";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import * as ProfileTypes from "./profile.types";

export class GetUserInfo extends BasePacket implements ProfileTypes.IGetUserInfo {
    static readonly schema: PacketSchema = [
        { name: "nickname", type: "string" },
    ];
    nickname: string | null;

    constructor(nickname: string | null = null) {
        super();
        this.nickname = nickname;
    }

    read(buffer: Buffer): void { readSchema(this, GetUserInfo.schema, buffer); }

    write(): Buffer { return writeSchema(this, GetUserInfo.schema); }

    static getId(): number {
        return 1774907609;
    }
}

export class OnlineNotifierData extends BasePacket implements ProfileTypes.IOnlineNotifierData {
    static readonly schema: PacketSchema = [
        { name: "isOnline", type: "bool" },
        { name: "server", type: "i32" },
        { name: "nickname", type: "string" },
    ];
    isOnline: boolean = false;
    server: number = 0;
    nickname: string = "";

    constructor(isOnline?: boolean, server?: number, nickname?: string) {
        super();
        if (isOnline !== undefined) this.isOnline = isOnline;
        if (server !== undefined) this.server = server;
        if (nickname) this.nickname = nickname;
    }

    read(buffer: Buffer): void { readSchema(this, OnlineNotifierData.schema, buffer); }
    write(): Buffer { return writeSchema(this, OnlineNotifierData.schema); }
    static getId(): number {
        return 2041598093;
    }
}

export class RankNotifierData extends BasePacket implements ProfileTypes.IRankNotifierData {
    static readonly schema: PacketSchema = [
        { name: "rank", type: "u8" },
        { name: "nickname", type: "string" },
    ];
    rank: number = 0;
    nickname: string = "";

    constructor(rank?: number, nickname?: string) {
        super();
        if (rank !== undefined) this.rank = rank;
        if (nickname) this.nickname = nickname;
    }

    read(buffer: Buffer): void { readSchema(this, RankNotifierData.schema, buffer); }
    write(): Buffer { return writeSchema(this, RankNotifierData.schema); }
    static getId(): number {
        return -962759489;
    }
}

export class PremiumNotifierData extends BasePacket implements ProfileTypes.IPremiumNotifierData {
    static readonly schema: PacketSchema = [
        { name: "premiumTimeLeftInSeconds", type: "i32" },
        { name: "nickname", type: "string" },
    ];
    premiumTimeLeftInSeconds: number = 0;
    nickname: string = "";

    constructor(premiumTimeLeftInSeconds?: number, nickname?: string) {
        super();
        if (premiumTimeLeftInSeconds !== undefined) this.premiumTimeLeftInSeconds = premiumTimeLeftInSeconds;
        if (nickname) this.nickname = nickname;
    }

    read(buffer: Buffer): void { readSchema(this, PremiumNotifierData.schema, buffer); }
    write(): Buffer { return writeSchema(this, PremiumNotifierData.schema); }
    static getId(): number {
        return -2069508071;
    }
}

export class ClanNotifierData extends BasePacket implements ProfileTypes.IClanNotifierData {
    static readonly schema: PacketSchema = [
        { name: "inClan", type: "bool" },
        { name: "clanTag", type: "string" },
        { name: "nickname", type: "string" },
    ];
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

    read(buffer: Buffer): void { readSchema(this, ClanNotifierData.schema, buffer); }
    write(): Buffer { return writeSchema(this, ClanNotifierData.schema); }
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
    static readonly schema: PacketSchema = [
        { name: "email", type: "string" },
        { name: "emailConfirmed", type: "bool" },
    ];
    email: string | null = null;
    emailConfirmed: boolean = false;

    constructor(email?: string | null, emailConfirmed?: boolean) {
        super();
        if (email) this.email = email;
        if (emailConfirmed) this.emailConfirmed = emailConfirmed;
    }

    read(buffer: Buffer): void { readSchema(this, EmailInfo.schema, buffer); }

    write(): Buffer { return writeSchema(this, EmailInfo.schema); }
    static getId(): number {
        return 613462801;
    }
}

export class PremiumInfo extends BasePacket implements ProfileTypes.IPremiumInfo {
    static readonly schema: PacketSchema = [
        { name: "needShowNotificationCompletionPremium", type: "bool" },
        { name: "needShowWelcomeAlert", type: "bool" },
        { name: "reminderCompletionPremiumTime", type: "f32" },
        { name: "wasShowAlertForFirstPurchasePremium", type: "bool" },
        { name: "wasShowReminderCompletionPremium", type: "bool" },
        { name: "lifeTimeInSeconds", type: "i32" },
    ];
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

    read(buffer: Buffer): void { readSchema(this, PremiumInfo.schema, buffer); }

    write(): Buffer { return writeSchema(this, PremiumInfo.schema); }
    static getId(): number {
        return 1405859779;
    }
}

export class UpdateCrystals extends BasePacket implements ProfileTypes.IUpdateCrystals {
    static readonly schema: PacketSchema = [
        { name: "crystals", type: "i32" },
    ];
    crystals: number = 0;

    constructor(crystals?: number) {
        super();
        if (crystals !== undefined) {
            this.crystals = crystals;
        }
    }

    read(buffer: Buffer): void { readSchema(this, UpdateCrystals.schema, buffer); }

    write(): Buffer { return writeSchema(this, UpdateCrystals.schema); }
    static getId(): number {
        return -593513288;
    }
}

export class UpdateScorePacket extends BasePacket implements ProfileTypes.IUpdateScore {
    static readonly schema: PacketSchema = [
        { name: "score", type: "i32" },
    ];
    score: number;

    constructor(score: number = 0) {
        super();
        this.score = score;
    }

    read(buffer: Buffer): void { readSchema(this, UpdateScorePacket.schema, buffer); }

    write(): Buffer { return writeSchema(this, UpdateScorePacket.schema); }
    static getId(): number {
        return 2116086491;
    }
}

export class UpdateRankPacket extends BasePacket implements ProfileTypes.IUpdateRank {
    static readonly schema: PacketSchema = [
        { name: "rank", type: "i32" },
        { name: "score", type: "i32" },
        { name: "currentRankScore", type: "i32" },
        { name: "nextRankScore", type: "i32" },
        { name: "reward", type: "i32" },
    ];
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

    read(buffer: Buffer): void { readSchema(this, UpdateRankPacket.schema, buffer); }

    write(): Buffer { return writeSchema(this, UpdateRankPacket.schema); }
    static getId(): number {
        return 1989173907;
    }
}

export class UpdatePremiumTimePacket extends BasePacket implements ProfileTypes.IUpdatePremiumTime {
    static readonly schema: PacketSchema = [
        { name: "timeLeft", type: "i32" },
    ];
    timeLeft: number = 0;

    constructor(timeLeft?: number) {
        super();
        if (timeLeft !== undefined) {
            this.timeLeft = timeLeft;
        }
    }

    read(buffer: Buffer): void { readSchema(this, UpdatePremiumTimePacket.schema, buffer); }

    write(): Buffer { return writeSchema(this, UpdatePremiumTimePacket.schema); }
    static getId(): number {
        return 1391146385;
    }
}