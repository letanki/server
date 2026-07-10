import { Document, Schema, model, Types } from "mongoose";

/** One active clan mission (a daily collective goal). Progress is summed across all members. */
export interface IClanMission {
    id: number; // unique within the current daily set; drives the client row + auto-claim state
    icon: number; // icon resource id (idLow)
    metricKey: string; // kills | battleScore | crystals | goldBox (see clan.missions.data)
    criteria: number; // clan-wide target
    progress: number; // clan-wide progress (may briefly exceed criteria under concurrency; clamped on the wire)
    completed: boolean; // true once progress reached criteria and prizes were auto-granted to all members
}

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
    blocked: boolean; // staff-blocked clan: the foreign-clan window hides the join button and shows blockReason
    blockReason: string; // message shown when blocked=true (staff moderation note)
    logo: string; // CDN-relative resource path to the clan logo image (e.g. /clanlogo/<id>/<v>/BIG); "" = none
    missions: IClanMission[]; // the current daily clan-mission set (regenerated when missionResetAt passes)
    missionResetAt: Date | null; // when the current mission set expires and regenerates
    clanScore: Map<string, number>; // userId -> lifetime clan-mission contribution points (member panel column)
    weeklyClanScore: Map<string, number>; // userId -> this week's contribution points (resets weekly)
    weeklyResetAt: Date | null; // when weeklyClanScore resets
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
    blocked: { type: Boolean, default: false },
    blockReason: { type: String, default: "" },
    logo: { type: String, default: "" },
    missions: {
        type: [
            new Schema<IClanMission>(
                {
                    id: { type: Number, required: true },
                    icon: { type: Number, required: true },
                    metricKey: { type: String, required: true },
                    criteria: { type: Number, required: true },
                    progress: { type: Number, default: 0 },
                    completed: { type: Boolean, default: false },
                },
                { _id: false }
            ),
        ],
        default: [],
    },
    missionResetAt: { type: Date, default: null },
    clanScore: { type: Map, of: Number, default: () => new Map() },
    weeklyClanScore: { type: Map, of: Number, default: () => new Map() },
    weeklyResetAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
});

const Clan = model<ClanDocument>("Clan", ClanSchema);
export default Clan;
