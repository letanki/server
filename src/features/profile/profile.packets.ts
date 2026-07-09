import { BasePacket } from "@/packets/base.packet";
import { readSchema, writeSchema } from "@/packets/packet-schema";
import { Achievement } from "@/shared/models/enums/achievement.enum";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import { defs } from "protanki-protocol";
import * as ProfileTypes from "./profile.types";

// IDs e schemas em `protanki-protocol` (defs.profile.*).

export class GetUserInfo extends BasePacket implements ProfileTypes.IGetUserInfo {
    nickname: string | null;
    constructor(nickname: string | null = null) { super(); this.nickname = nickname; }
    read(buffer: Buffer): void { readSchema(this, defs.profile.GetUserInfo.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.profile.GetUserInfo.schema!); }
    static getId(): number { return defs.profile.GetUserInfo.id; }
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
    read(buffer: Buffer): void { readSchema(this, defs.profile.OnlineNotifierData.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.profile.OnlineNotifierData.schema!); }
    static getId(): number { return defs.profile.OnlineNotifierData.id; }
}

export class RankNotifierData extends BasePacket implements ProfileTypes.IRankNotifierData {
    rank: number = 0;
    nickname: string = "";
    constructor(rank?: number, nickname?: string) {
        super();
        if (rank !== undefined) this.rank = rank;
        if (nickname) this.nickname = nickname;
    }
    read(buffer: Buffer): void { readSchema(this, defs.profile.RankNotifierData.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.profile.RankNotifierData.schema!); }
    static getId(): number { return defs.profile.RankNotifierData.id; }
}

export class PremiumNotifierData extends BasePacket implements ProfileTypes.IPremiumNotifierData {
    premiumTimeLeftInSeconds: number = 0;
    nickname: string = "";
    constructor(premiumTimeLeftInSeconds?: number, nickname?: string) {
        super();
        if (premiumTimeLeftInSeconds !== undefined) this.premiumTimeLeftInSeconds = premiumTimeLeftInSeconds;
        if (nickname) this.nickname = nickname;
    }
    read(buffer: Buffer): void { readSchema(this, defs.profile.PremiumNotifierData.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.profile.PremiumNotifierData.schema!); }
    static getId(): number { return defs.profile.PremiumNotifierData.id; }
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
    read(buffer: Buffer): void { readSchema(this, defs.profile.ClanNotifierData.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.profile.ClanNotifierData.schema!); }
    static getId(): number { return defs.profile.ClanNotifierData.id; }
}

export class AchievementTips extends BasePacket implements ProfileTypes.IAchievementTips {
    achievementIds: Achievement[] = [];
    constructor(achievementIds?: Achievement[]) {
        super();
        if (achievementIds) {
            this.achievementIds = achievementIds;
        }
    }
    // Codec manual: lista de i32 sem flag de vazio (não corresponde ao tipo `list` do schema).
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
    static getId(): number { return defs.profile.AchievementTips.id; }
}

export class EmailInfo extends BasePacket implements ProfileTypes.IEmailInfo {
    email: string | null = null;
    emailConfirmed: boolean = false;
    constructor(email?: string | null, emailConfirmed?: boolean) {
        super();
        if (email) this.email = email;
        if (emailConfirmed) this.emailConfirmed = emailConfirmed;
    }
    read(buffer: Buffer): void { readSchema(this, defs.profile.EmailInfo.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.profile.EmailInfo.schema!); }
    static getId(): number { return defs.profile.EmailInfo.id; }
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
    read(buffer: Buffer): void { readSchema(this, defs.profile.PremiumInfo.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.profile.PremiumInfo.schema!); }
    static getId(): number { return defs.profile.PremiumInfo.id; }
}

export class UpdateCrystals extends BasePacket implements ProfileTypes.IUpdateCrystals {
    crystals: number = 0;
    constructor(crystals?: number) { super(); if (crystals !== undefined) { this.crystals = crystals; } }
    read(buffer: Buffer): void { readSchema(this, defs.profile.UpdateCrystals.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.profile.UpdateCrystals.schema!); }
    static getId(): number { return defs.profile.UpdateCrystals.id; }
}

export class UpdateScorePacket extends BasePacket implements ProfileTypes.IUpdateScore {
    score: number;
    constructor(score: number = 0) { super(); this.score = score; }
    read(buffer: Buffer): void { readSchema(this, defs.profile.UpdateScore.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.profile.UpdateScore.schema!); }
    static getId(): number { return defs.profile.UpdateScore.id; }
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
    read(buffer: Buffer): void { readSchema(this, defs.profile.UpdateRank.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.profile.UpdateRank.schema!); }
    static getId(): number { return defs.profile.UpdateRank.id; }
}

export class UpdatePremiumTimePacket extends BasePacket implements ProfileTypes.IUpdatePremiumTime {
    timeLeft: number = 0;
    constructor(timeLeft?: number) { super(); if (timeLeft !== undefined) { this.timeLeft = timeLeft; } }
    read(buffer: Buffer): void { readSchema(this, defs.profile.UpdatePremiumTime.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.profile.UpdatePremiumTime.schema!); }
    static getId(): number { return defs.profile.UpdatePremiumTime.id; }
}
