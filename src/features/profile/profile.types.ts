import { IPacket } from "@/packets/packet.interfaces";
import { Achievement } from "@/shared/models/enums/achievement.enum";

export interface IGetUserInfo extends IPacket {
    nickname: string | null;
}

export interface IOnlineNotifierData extends IPacket {
    isOnline: boolean;
    server: number;
    nickname: string;
}

export interface IRankNotifierData extends IPacket {
    rank: number;
    nickname: string;
}

export interface IPremiumNotifierData extends IPacket {
    premiumTimeLeftInSeconds: number;
    nickname: string;
}

export interface IClanNotifierData extends IPacket {
    inClan: boolean;
    clanTag: string | null;
    nickname: string;
}

export interface IAchievementTips extends IPacket {
    achievementIds: Achievement[];
}

export interface IEmailInfo extends IPacket {
    email: string | null;
    emailConfirmed: boolean;
}

export interface IPremiumInfo extends IPacket {
    needShowNotificationCompletionPremium: boolean;
    needShowWelcomeAlert: boolean;
    reminderCompletionPremiumTime: number;
    wasShowAlertForFirstPurchasePremium: boolean;
    wasShowReminderCompletionPremium: boolean;
    lifeTimeInSeconds: number;
}

export interface IUpdateCrystals extends IPacket {
    crystals: number;
}

export interface IUpdateScore extends IPacket {
    score: number;
}

export interface IUpdateRankData {
    rank: number;
    score: number;
    currentRankScore: number;
    nextRankScore: number;
    reward: number;
}
export interface IUpdateRank extends IPacket, IUpdateRankData { }

export interface IUpdatePremiumTime extends IPacket {
    timeLeft: number;
}