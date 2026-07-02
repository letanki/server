import { Document, Schema, model, Types } from "mongoose";

export interface ClanAttributes {
    name: string; // display name, unique
    tag: string; // short tag shown next to nicknames, unique
    description: string; // rich text (the client allows <font>/<a> HTML)
    leaderId: Types.ObjectId; // founder / owner (a User)
    members: Types.ObjectId[]; // member Users (includes the leader)
    positions: Map<string, number>; // userId (string) -> ClanPosition (0=Supreme Commander .. 6=Novice). Leader=0; new members default to Novice (absent = Novice).
    memberSince: Map<string, Date>; // userId (string) -> when they joined; drives the "time in clan" display
    joinRequests: Types.ObjectId[]; // Users who asked to join (pending leader approval)
    invites: Types.ObjectId[]; // Users the clan invited (pending their accept/decline)
    rating: number; // ranking score (clan leaderboard)
    recruiting: boolean; // accepts join requests ("open"); false = "closed"
    minRank: number; // minimum rank (1-30) required to request to join, or -1 = no minimum
    createdAt: Date;
}

export interface ClanDocument extends ClanAttributes, Document {}

const ClanSchema = new Schema<ClanDocument>({
    name: { type: String, required: true, unique: true, trim: true },
    tag: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: "" },
    leaderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: [{ type: Schema.Types.ObjectId, ref: "User" }],
    positions: { type: Map, of: Number, default: () => new Map() },
    memberSince: { type: Map, of: Date, default: () => new Map() },
    joinRequests: [{ type: Schema.Types.ObjectId, ref: "User" }],
    invites: [{ type: Schema.Types.ObjectId, ref: "User" }],
    rating: { type: Number, default: 0 },
    recruiting: { type: Boolean, default: true },
    minRank: { type: Number, default: -1 },
    createdAt: { type: Date, default: Date.now },
});

const Clan = model<ClanDocument>("Clan", ClanSchema);
export default Clan;
