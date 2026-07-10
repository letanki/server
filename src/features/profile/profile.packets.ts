import { BasePacket } from "@/packets/base.packet";
import { packetClass } from "@/packets/packet-class";
import { readSchema, writeSchema } from "@/packets/packet-schema";
import { Achievement } from "@/shared/models/enums/achievement.enum";
import { defs, encodeBody, decodeBody } from "protanki-protocol";
import * as ProfileTypes from "./profile.types";

// IDs e schemas em `protanki-protocol` (defs.profile.*).

export const GetUserInfo = packetClass(defs.profile.GetUserInfo);
export type GetUserInfo = InstanceType<typeof GetUserInfo>;

export const OnlineNotifierData = packetClass(defs.profile.OnlineNotifierData);
export type OnlineNotifierData = InstanceType<typeof OnlineNotifierData>;

export const RankNotifierData = packetClass(defs.profile.RankNotifierData);
export type RankNotifierData = InstanceType<typeof RankNotifierData>;

export const PremiumNotifierData = packetClass(defs.profile.PremiumNotifierData);
export type PremiumNotifierData = InstanceType<typeof PremiumNotifierData>;

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
    // Lógica: a classe guarda number[]; o wire é uma list de { id }. O map fica aqui, os bytes na lib.
    read(buffer: Buffer): void {
        const { fields } = decodeBody(defs.profile.AchievementTips, buffer);
        this.achievementIds = fields.achievementIds.map((x) => x.id);
    }
    write(): Buffer {
        return encodeBody(defs.profile.AchievementTips, {
            achievementIds: this.achievementIds.map((id) => ({ id })),
        });
    }
    static getId(): number { return defs.profile.AchievementTips.id; }
}

export const EmailInfo = packetClass(defs.profile.EmailInfo);
export type EmailInfo = InstanceType<typeof EmailInfo>;

export const PremiumInfo = packetClass(defs.profile.PremiumInfo);
export type PremiumInfo = InstanceType<typeof PremiumInfo>;

export const UpdateCrystals = packetClass(defs.profile.UpdateCrystals);
export type UpdateCrystals = InstanceType<typeof UpdateCrystals>;

export const UpdateScorePacket = packetClass(defs.profile.UpdateScore);
export type UpdateScorePacket = InstanceType<typeof UpdateScorePacket>;

export const UpdateRankPacket = packetClass(defs.profile.UpdateRank);
export type UpdateRankPacket = InstanceType<typeof UpdateRankPacket>;

export const UpdatePremiumTimePacket = packetClass(defs.profile.UpdatePremiumTime);
export type UpdatePremiumTimePacket = InstanceType<typeof UpdatePremiumTimePacket>;
