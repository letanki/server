import { MAX_EXPERIENCE } from "@/config/rank.data";
import { QuestDifficulty, QuestType } from "@/features/quests/quests.data";
import bcrypt from "bcrypt";
import mongoose, { Document, Schema, model } from "mongoose";
import { ChatModeratorLevel } from "./enums/chat-moderator-level.enum";

export interface IUserQuest {
    questId: number;
    questType: QuestType;
    difficulty: QuestDifficulty;
    progress: number;
    finishCriteria: number;
    prizes: { itemName: string; itemCount: number }[];
    isCompleted: boolean;
    canSkipForFree: boolean;
}

const UserQuestSchema = new Schema<IUserQuest>(
    {
        questId: { type: Number, required: true },
        questType: { type: String, required: true, enum: ["KILLS", "SCORE", "CRYSTALS"] },
        difficulty: { type: String, required: true, enum: ["easy", "medium", "hard"] },
        progress: { type: Number, default: 0 },
        finishCriteria: { type: Number, required: true },
        prizes: [{ itemName: { type: String, required: true }, itemCount: { type: Number, required: true } }],
        isCompleted: { type: Boolean, default: false },
        canSkipForFree: { type: Boolean, default: true },
    },
    { _id: false }
);

export interface UserAttributes {
    username: string; // display name (original casing)
    login: string; // lowercase of username — the unique, indexed key used for authentication
    password: string;
    email?: string | null;
    emailConfirmed: boolean;
    crystals: number;
    experience: number;
    clanId: import("mongoose").Types.ObjectId | null; // the clan this user belongs to (null = no clan)
    clanCooldownUntil: Date | null; // after leaving a clan, can't create/join another until this time
    isActive: boolean;
    isPunished: boolean;
    punishmentExpiresAt: Date | null;
    punishmentReason: string | null;
    hasDoubleCrystal: boolean;
    premiumExpiresAt: Date | null;
    rank: number;
    nextRankScore: number;
    crystalAbonementExpiresAt: Date | null;
    friends: mongoose.Types.ObjectId[];
    friendRequestsSent: mongoose.Types.ObjectId[];
    friendRequestsReceived: mongoose.Types.ObjectId[];
    newFriends: mongoose.Types.ObjectId[];
    newFriendRequests: mongoose.Types.ObjectId[];
    unlockedAchievements: number[];
    referralHash: string;
    referredBy: mongoose.Types.ObjectId | null;
    chatModeratorLevel: ChatModeratorLevel;
    lastMessageTimestamp: Date | null;
    notificationsEnabled: boolean;
    dailyQuests: IUserQuest[];
    questLevel: number;
    questStreak: number;
    lastQuestCompletedDate: Date | null;
    lastQuestGeneratedDate: Date | null;
    loginToken: string | null;
    hulls: Map<string, number>;
    turrets: Map<string, number>;
    paints: string[];
    supplies: Map<string, number>;
    equippedTurret: string;
    equippedHull: string;
    equippedPaint: string;
    createdAt?: Date;
    lastLogin?: Date | null;
}

export interface UserDocument extends UserAttributes, Document {
    verifyPassword(password: string, callback: (error: Error | undefined, isMatch?: boolean) => void): void;
}

const UserSchema = new Schema<UserDocument>({
    username: { type: String, required: true, trim: true, minlength: 3, maxlength: 50, match: /^[a-zA-Z0-9]+$/ },
    login: { type: String, required: true, unique: true, lowercase: true, index: true }, // derived from username (pre-validate); the case-insensitive identity
    password: { type: String, required: true, minlength: 3 },
    email: { type: String, trim: true, lowercase: true, default: null },
    emailConfirmed: { type: Boolean, default: false },
    crystals: { type: Number, default: 0, min: 0 },
    experience: { type: Number, default: 0, min: 0 },
    clanId: { type: Schema.Types.ObjectId, ref: "Clan", default: null },
    clanCooldownUntil: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    isPunished: { type: Boolean, default: false },
    punishmentExpiresAt: { type: Date, default: null },
    punishmentReason: { type: String, default: null },
    hasDoubleCrystal: { type: Boolean, default: false },
    premiumExpiresAt: { type: Date, default: null },
    rank: { type: Number, default: 1 },
    nextRankScore: { type: Number, default: 100 },
    crystalAbonementExpiresAt: { type: Date, default: null },
    friends: [{ type: Schema.Types.ObjectId, ref: "User" }],
    friendRequestsSent: [{ type: Schema.Types.ObjectId, ref: "User" }],
    friendRequestsReceived: [{ type: Schema.Types.ObjectId, ref: "User" }],
    newFriends: [{ type: Schema.Types.ObjectId, ref: "User" }],
    newFriendRequests: [{ type: Schema.Types.ObjectId, ref: "User" }],
    unlockedAchievements: { type: [Number], default: [] },
    referralHash: { type: String, required: true, unique: true },
    referredBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    chatModeratorLevel: { type: Number, enum: [0, 1, 2, 3, 4], default: ChatModeratorLevel.NONE },
    lastMessageTimestamp: { type: Date, default: null },
    notificationsEnabled: { type: Boolean, default: true },
    dailyQuests: { type: [UserQuestSchema], default: [] },
    questLevel: { type: Number, default: 1 },
    questStreak: { type: Number, default: 0 },
    lastQuestCompletedDate: { type: Date, default: null },
    lastQuestGeneratedDate: { type: Date, default: null },
    loginToken: { type: String, default: null },
    hulls: { type: Map, of: Number, default: () => new Map([["wasp", 0]]) },
    turrets: { type: Map, of: Number, default: () => new Map([["smoky", 0]]) },
    paints: { type: [String], default: ["green", "holiday"] },
    supplies: {
        type: Map,
        of: Number,
        default: () =>
            new Map([
                ["health", 0],
                ["armor", 0],
                ["double_damage", 0],
                ["n2o", 0],
                ["mine", 0],
            ]),
    },
    equippedTurret: { type: String, default: "smoky" },
    equippedHull: { type: String, default: "wasp" },
    equippedPaint: { type: String, default: "holiday" },
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date, default: null },
});

UserSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } });
UserSchema.index({ loginToken: 1 }, { unique: true, partialFilterExpression: { loginToken: { $type: "string" } } });

// Keep `login` (the unique, indexed auth key) in sync with `username`. Runs before validation so the
// required `login` is always set, including on the first save.
UserSchema.pre<UserDocument>("validate", function (next: (error?: Error) => void) {
    if (this.username) this.login = this.username.toLowerCase();
    // Hard cap experience at the top rank's threshold so a kill / XP item can't overflow the client's
    // score field on a maxed-out account (the `min: 0` schema rule guards the bottom).
    if (this.experience > MAX_EXPERIENCE) this.experience = MAX_EXPERIENCE;
    next();
});

UserSchema.pre<UserDocument>("save", function (next: (error?: Error) => void) {
    if (!this.isModified("password")) {
        return next();
    }
    bcrypt.hash(this.password, 10, (err: Error | undefined, hash: string) => {
        if (err) return next(err);
        this.password = hash;
        next();
    });
});

UserSchema.methods.verifyPassword = function (password: string, callback: (error: Error | undefined, isMatch?: boolean) => void): void {
    bcrypt.compare(password, this.password, (error: Error | undefined, isMatch: boolean) => {
        if (error) return callback(error);
        callback(undefined, isMatch);
    });
};

const User = model<UserDocument>("User", UserSchema);

export type UserDocumentWithFriends = Omit<UserDocument, "friends"> & {
    friends: UserDocument[];
};

export default User;