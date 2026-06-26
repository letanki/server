import { BasePacket } from "@/packets/base.packet";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import { ResourceManager } from "@/utils/resource.manager";

// ---- C->S (incoming) ----

/** Member leaves the clan. Empty body. */
export class LeaveClanPacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return -1298483664; }
}

/** Post-leave cooldown shown in the not-in-clan modal. Body = int(seconds remaining, e.g. 86400 = 24h). */
export class ClanCooldownPacket extends BasePacket {
    constructor(private readonly seconds: number) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeInt32BE(this.seconds).getBuffer(); }
    static getId(): number { return -745085341; }
}

/** Real-time removal of a member from the owner's clan window. Body = optionalString(username). */
export class RemoveClanMemberPacket extends BasePacket {
    constructor(private readonly username: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.username).getBuffer(); }
    static getId(): number { return 1039356886; }
}

/** Aux notify accompanying a member leave (sent to both sides). Body = optionalString(username). */
export class MemberLeftNotifyPacket extends BasePacket {
    constructor(private readonly username: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.username).getBuffer(); }
    static getId(): number { return 1059383280; }
}

/** A clan MEMBER/owner opens their clan window → server replies MyClanWindow (-8296541). Empty body. */
export class OpenMyClanWindowPacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return 2073319841; }
}

/** Real-time notify to the online owner: a new join request arrived. Body = optionalString(username). */
export class NotifyJoinRequestPacket extends BasePacket {
    constructor(private readonly username: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.username).getBuffer(); }
    static getId(): number { return 1321902609; }
}

/** Real-time notify to the online owner: add the request card to the list. Body = optionalString(username). */
export class AddJoinRequestPacket extends BasePacket {
    constructor(private readonly username: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.username).getBuffer(); }
    static getId(): number { return 273571175; }
}

/** Owner DECLINES a pending join request. Body = optionalString(requester username). */
export class DeclineJoinRequestPacket extends BasePacket {
    username: string | null = null;
    read(buffer: Buffer): void { this.username = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return 1327826221; }
}

/** Reply to a decline: drop the request card for `username`. Body = optionalString(username). */
export class JoinRequestDeclinedPacket extends BasePacket {
    constructor(private readonly username: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.username).getBuffer(); }
    static getId(): number { return -1735563082; }
}

/** Reply to a decline: remove `username` from the requests list. Body = optionalString(username). */
export class RemoveJoinRequestPacket extends BasePacket {
    constructor(private readonly username: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.username).getBuffer(); }
    static getId(): number { return 1452773298; }
}

/** Client opened the clan view while NOT in a clan → server replies ShowNotInClanWindow. Empty body. */
export class ShowNotInClanPanelPacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return -1123511676; }
}

/** Close the clan window. Empty body — sent C->S, and the server echoes the SAME packet back to
 *  confirm so the client actually closes the view. */
export class CloseClanWindowPacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return 924070374; }
}

/** Client closed the not-in-clan panel. Empty body. */
export class HideNotInClanPanelPacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return -2002206647; }
}

/** Client requests a page of the clan leaderboard. Body = int(startIndex) + int(count) — paginates as
 *  the user scrolls, e.g. (0,40) then (40,10), (50,10)... */
export class GetClanRatingsDataPacket extends BasePacket {
    startIndex: number = 0;
    count: number = 0;
    read(buffer: Buffer): void {
        const r = new BufferReader(buffer);
        this.startIndex = r.readInt32BE();
        this.count = r.readInt32BE();
    }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return -2080893689; }
}

/** Clan leaderboard page. Body = int(startIndex) + Vector<light clan model> (sorted by rating, desc). */
export class SetClanRatingsDataPacket extends BasePacket {
    constructor(private readonly startIndex: number, private readonly clans: ClanView[]) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer {
        const w = new BufferWriter();
        w.writeInt32BE(this.startIndex);
        w.writeInt32BE(this.clans.length);
        for (const c of this.clans) writeLightClanModel(w, c);
        return w.getBuffer();
    }
    static getId(): number { return 134406915; }
}

/** Client wants to view another clan by its tag. Body = optionalString(tag). */
export class ShowForeignClanPacket extends BasePacket {
    clanTag: string | null = null;
    read(buffer: Buffer): void { this.clanTag = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return 947733823; }
}

/**
 * Client submits the create-clan form. Body = optionalString(name) + optionalString(tag).
 * Confirmed in-game (log 2026-06-26: name="ALFA", tag="A").
 */
export class CreateClanPacket extends BasePacket {
    name: string | null = null;
    tag: string | null = null;
    read(buffer: Buffer): void {
        const r = new BufferReader(buffer);
        this.name = r.readOptionalString();
        this.tag = r.readOptionalString();
    }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return -1267250495; }
}

/** Live availability check as the user types the clan TAG in the create form. Body = optionalString(tag). */
export class CheckClanTagPacket extends BasePacket {
    tag: string | null = null;
    read(buffer: Buffer): void { this.tag = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return -1879289905; }
}

/** Live availability check for the clan NAME. Body = optionalString(name). */
export class CheckClanNamePacket extends BasePacket {
    name: string | null = null;
    read(buffer: Buffer): void { this.name = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return 1591528838; }
}

/** Live check (as the leader types) of whether a username can be invited — toggles the invite button.
 *  Body = optionalString(username). Server replies InviteUserValid or InviteUserInvalid (both empty). */
export class CheckInviteUserPacket extends BasePacket {
    username: string | null = null;
    read(buffer: Buffer): void { this.username = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return 819097883; }
}

/** Reply to CheckInviteUser: the username CAN be invited (exists, not in a clan) → enables the button. */
export class InviteUserValidPacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return 1796904481; }
}

/** Reply to CheckInviteUser: the username CANNOT be invited (no account / already in a clan) → keeps button disabled. */
export class InviteUserInvalidPacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return -616439158; }
}

/** Owner edits the clan DESCRIPTION. Body = optionalString(description). Server echoes it back. */
export class SetClanDescriptionPacket extends BasePacket {
    description: string | null = null;
    constructor(description: string | null = null) { super(); this.description = description; }
    read(buffer: Buffer): void { this.description = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.description).getBuffer(); }
    static getId(): number { return -1752335888; }
}

/** Owner edits the MINIMUM RANK to request to join. Body = 1 signed byte (rank 1-30, or -1 = no minimum).
 *  The client uses -1 as the "no restriction" sentinel, so this must be signed (readInt8/writeInt8). */
export class SetClanMinRankPacket extends BasePacket {
    minRank: number = -1;
    read(buffer: Buffer): void { this.minRank = new BufferReader(buffer).readInt8(); }
    write(): Buffer { return new BufferWriter().writeInt8(this.minRank).getBuffer(); }
    static getId(): number { return -1145619463; }
}

/** Owner toggles RECRUITING (open/closed). Body = 1 byte bool (1=open/recruiting, 0=closed). */
export class SetClanRecruitingPacket extends BasePacket {
    recruiting: boolean = true;
    read(buffer: Buffer): void { this.recruiting = new BufferReader(buffer).readUInt8() !== 0; }
    write(): Buffer { return new BufferWriter().writeUInt8(this.recruiting ? 1 : 0).getBuffer(); }
    static getId(): number { return -614563927; }
}

/** Owner SENDS a clan invite to a user. Body = optionalString(username). */
export class SendClanInvitePacket extends BasePacket {
    username: string | null = null;
    read(buffer: Buffer): void { this.username = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return -2053489715; }
}

/** Ack to the owner that the invite was sent. Body = optionalString(username). */
export class ClanInviteSentAckPacket extends BasePacket {
    constructor(private readonly username: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.username).getBuffer(); }
    static getId(): number { return 1921140979; }
}

/** Owner CANCELS a pending clan invite. Body = optionalString(username). */
export class CancelClanInvitePacket extends BasePacket {
    username: string | null = null;
    read(buffer: Buffer): void { this.username = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return 2041223590; }
}

/** Ack to the owner that the invite was cancelled. Body = optionalString(username). */
export class ClanInviteCancelledAckPacket extends BasePacket {
    constructor(private readonly username: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.username).getBuffer(); }
    static getId(): number { return 112423798; }
}

/** Invited user opens the clan attached to an invite. Body = optionalString(tag) → server echoes tag. */
export class ViewInviteClanPacket extends BasePacket {
    tag: string | null = null;
    read(buffer: Buffer): void { this.tag = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return 405171321; }
}

/** Response to ViewInviteClan. Body = optionalString(tag). */
export class ViewInviteClanResponsePacket extends BasePacket {
    constructor(private readonly tag: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.tag).getBuffer(); }
    static getId(): number { return 781410259; }
}

/** Invited user ACCEPTS the invite. Body = optionalString(clan tag). */
export class AcceptClanInvitePacket extends BasePacket {
    tag: string | null = null;
    read(buffer: Buffer): void { this.tag = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return 1533026019; }
}

/** Invited user DECLINES the invite. Body = optionalString(clan tag). */
export class DeclineClanInvitePacket extends BasePacket {
    tag: string | null = null;
    read(buffer: Buffer): void { this.tag = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return 1010729260; }
}

/** Notifies the invited user: "you've been invited to clan <tag>". Body = optionalString(tag). */
export class ClanInviteNotifyPacket extends BasePacket {
    constructor(private readonly tag: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.tag).getBuffer(); }
    static getId(): number { return 134379747; }
}

/** Ack to an invite accept/decline. Body = optionalString(tag). */
export class ClanInviteAckPacket extends BasePacket {
    constructor(private readonly tag: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.tag).getBuffer(); }
    static getId(): number { return 1901058987; }
}

/** Client asks to JOIN a clan (the "request to join" button). Body = optionalString(tag). */
export class JoinClanRequestPacket extends BasePacket {
    tag: string | null = null;
    read(buffer: Buffer): void { this.tag = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return -1137965580; }
}

/** Search/list panel: live check that a clan with the typed NAME exists. Body = optionalString(name).
 *  Server replies ClanSearchFound (empty) when a clan matches → enables the "request to join" button. */
export class SearchClanByNamePacket extends BasePacket {
    name: string | null = null;
    read(buffer: Buffer): void { this.name = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return -378947621; }
}

/** Reply to SearchClanByName: a clan with that name exists AND accepts requests (empty body) → enable button. */
export class ClanSearchFoundPacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return 1726541163; }
}

/** Reply to SearchClanByName: no joinable clan with that name (doesn't exist OR isn't recruiting) → keep disabled. */
export class ClanSearchUnavailablePacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return -866005248; }
}

/** Client asks to JOIN a clan from the search/list panel, by NAME. Body = optionalString(name). */
export class JoinClanByNamePacket extends BasePacket {
    name: string | null = null;
    read(buffer: Buffer): void { this.name = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return -705969616; }
}

/** Client CANCELS a pending join request from the foreign-clan window. Body = optionalString(tag). */
export class CancelJoinClanRequestPacket extends BasePacket {
    tag: string | null = null;
    read(buffer: Buffer): void { this.tag = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return 1913571122; }
}

/** Client CANCELS a pending join request from the "sent requests" modal. Body = optionalString(tag). */
export class CancelJoinRequestFromModalPacket extends BasePacket {
    tag: string | null = null;
    read(buffer: Buffer): void { this.tag = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return -930926299; }
}

// ---- S->C (outgoing) ----

/**
 * The "my clan" / owner management window (sent after creating a clan and when a member opens the clan
 * view). Aggregate of 6 fields, decoded from the client codec and round-trip validated byte-for-byte
 * against the official capture (LeTanki[LGC], 199 bytes):
 *   0) light clan model (leader/name/tag/recruiting + member nicks)
 *   1) Vector<Member> (full member objects)   2) Vector<perm-ordinal> = [0..7]
 *   3,4,5) three Vector<String> (role/permission member lists; only #3 = [leader] for a fresh clan)
 * Vector presence bytes: light-model nicks + lists 3/4/5 HAVE a presence byte; members + perms do NOT.
 * f6/f7/f8 (3000/16/8) are the values the official sent for a brand-new clan; kept as-is.
 */
/**
 * The "§static catch catch§" LIGHT clan model, shared by the my-clan window (field 0), the join-request
 * card, and the clan ratings list. Field order decoded from the client codec, validated byte-perfect:
 * f1 bool, Long id, leader, description, f5=recruiting, f6 int(3000), f7 int(16), f8 byte=minRank, name,
 * s10(null), f11(1), tag, Vector<String> member nicks (presence byte), logo, rating.
 */
export function writeLightClanModel(w: BufferWriter, v: ClanView): void {
    const long = (b: Buffer) => w.writeInt32BE(b.readInt32BE(0)).writeInt32BE(b.readInt32BE(4));
    w.writeUInt8(0); long(v.clanId); w.writeOptionalString(v.leader); w.writeOptionalString(v.description);
    w.writeUInt8(v.recruiting ? 1 : 0); w.writeInt32BE(3000); w.writeInt32BE(16); w.writeInt8(v.minRank);
    w.writeOptionalString(v.name); w.writeOptionalString(null); w.writeUInt8(1); w.writeOptionalString(v.tag);
    w.writeUInt8(0); w.writeInt32BE(v.members.length); v.members.forEach((m) => w.writeOptionalString(m.nick));
    w.writeOptionalString(v.logo ?? ""); w.writeInt32BE(v.rating);
}

/** The 10-field clan MemberModel — shared by the my-clan window member vector and the add-member packet. */
export function writeMemberModel(w: BufferWriter, m: ClanMemberView): void {
    const long = (b: Buffer) => w.writeInt32BE(b.readInt32BE(0)).writeInt32BE(b.readInt32BE(4));
    w.writeInt32BE(m.field1).writeInt32BE(m.deaths).writeInt32BE(m.kills);
    long(m.userId);
    w.writeInt32BE(m.permission).writeInt32BE(m.score);
    w.writeOptionalString(m.nick);
    w.writeInt32BE(m.field8).writeInt32BE(m.clanScore).writeInt32BE(m.weeklyClanScore);
}

export class MyClanWindowPacket extends BasePacket {
    constructor(private readonly v: ClanView) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer {
        const w = new BufferWriter();
        const presVec = <T>(arr: T[], el: (x: T) => void) => { w.writeUInt8(0); w.writeInt32BE(arr.length); arr.forEach(el); };
        const vec = <T>(arr: T[], el: (x: T) => void) => { w.writeInt32BE(arr.length); arr.forEach(el); };
        const v = this.v;
        // 0) light clan model
        writeLightClanModel(w, v);
        // 1) Vector<Member> (no presence)
        vec(v.members, (m) => writeMemberModel(w, m));
        // 2) Vector<perm ordinal> (no presence)
        vec([0, 1, 2, 3, 4, 5, 6, 7], (x) => w.writeInt32BE(x));
        // 3,4,5) member lists (presence): #3 = ALL members (the rendered member list), #4 = pending join
        // requests, #5 = non-leader members. (Decoded from a 2-member window: list3=[leader,member],
        // list5=[member].)
        const memberNicks = v.members.map((m) => m.nick);
        presVec(memberNicks, (s) => w.writeOptionalString(s));
        presVec(v.joinRequests, (s) => w.writeOptionalString(s));
        presVec(memberNicks.filter((n) => n !== v.leader), (s) => w.writeOptionalString(s));
        return w.getBuffer();
    }
    static getId(): number { return -8296541; }
}

/** Sent with the my-clan window: the clan tag (8-byte body, optionalString). */
export class ClanTagNotifyPacket extends BasePacket {
    constructor(private readonly tag: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.tag).getBuffer(); }
    static getId(): number { return -88976442; }
}

/** Sent when joining a clan: the clan display name (sets the clan name in the UI). Body = optString(name). */
export class ClanNameNotifyPacket extends BasePacket {
    constructor(private readonly name: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.name).getBuffer(); }
    static getId(): number { return -1673544562; }
}

/** Real-time add of a new member to the owner's open clan window. Body = the 10-field MemberModel. */
export class AddClanMemberPacket extends BasePacket {
    constructor(private readonly member: ClanMemberView) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { const w = new BufferWriter(); writeMemberModel(w, this.member); return w.getBuffer(); }
    static getId(): number { return 1741285576; }
}

/** Aux notify sent with a member add (officially follows AddClanMember). Body = optString(username). */
export class MemberAddedNotifyPacket extends BasePacket {
    constructor(private readonly username: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.username).getBuffer(); }
    static getId(): number { return 385150953; }
}

/** Sent with the my-clan window: the leader/owner nick. */
export class ClanLeaderNotifyPacket extends BasePacket {
    constructor(private readonly nick: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.nick).getBuffer(); }
    static getId(): number { return -915300943; }
}

/**
 * Sent right after a join request (and to repopulate the "sent requests" modal): the pending request
 * card. Body = optionalString(tag) + a LIGHT clan model. Round-trip validated byte-for-byte against the
 * official capture (LeTanki[LGC], 88 bytes). f6/f7/f8/f9 (1/3000/16/8) are the official's brand-new-clan
 * constants; f11/f12 bools = 1; nicks vector has a presence byte, logo = "".
 */
export class JoinRequestModelPacket extends BasePacket {
    constructor(private readonly v: ClanView) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer {
        const w = new BufferWriter();
        const long = (b: Buffer) => w.writeInt32BE(b.readInt32BE(0)).writeInt32BE(b.readInt32BE(4));
        const v = this.v;
        w.writeOptionalString(v.tag);                 // outer tag
        w.writeUInt8(0);                              // f1 bool
        long(v.clanId);                               // clan id (Long)
        w.writeOptionalString(v.leader);              // leader nick
        w.writeUInt8(v.recruiting ? 1 : 0);           // f5 bool: recruiting
        w.writeUInt8(1);                              // f6 bool
        w.writeInt32BE(3000);                         // f7 int
        w.writeInt32BE(16);                           // f8 int
        w.writeInt8(v.minRank);                       // f9 byte = minimum rank
        w.writeOptionalString(v.name);
        w.writeUInt8(1);                              // f11 bool
        w.writeUInt8(1);                              // f12 bool
        w.writeOptionalString(v.tag);
        w.writeUInt8(0); w.writeInt32BE(v.members.length); // nicks vector (presence byte)
        v.members.forEach((m) => w.writeOptionalString(m.nick));
        w.writeOptionalString("");                    // logo
        w.writeInt32BE(v.rating);
        return w.getBuffer();
    }
    static getId(): number { return 325031295; }
}

/** Ack: a join request for `tag` is now pending. Body = optionalString(tag). */
export class JoinRequestSentPacket extends BasePacket {
    constructor(private readonly tag: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.tag).getBuffer(); }
    static getId(): number { return -905757704; }
}

/** Ack: the pending join request for `tag` was withdrawn. Body = optionalString(tag). */
export class JoinRequestCancelledPacket extends BasePacket {
    constructor(private readonly tag: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.tag).getBuffer(); }
    static getId(): number { return -2007179326; }
}

// Availability results are EMPTY packets — the client distinguishes available vs taken by the id.
export class ClanTagAvailablePacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return -965581529; }
}
export class ClanTagTakenPacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return 1873830541; }
}
export class ClanNameAvailablePacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return -148282578; }
}
export class ClanNameTakenPacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return -253044119; }
}

/**
 * The "you're not in a clan" window (create for CLAN_CREATION_COST / join). Body = 2 resources (the
 * window's icons). We send our own clan resource as a placeholder for both until dedicated icons exist.
 */
export class ShowNotInClanWindowPacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer {
        // The official sends two distinct images: the clan-system intro illustration and the clan card.
        const intro = ResourceManager.getIdlowById("clan/intro");
        const card = ResourceManager.getIdlowById("clan/card");
        return new BufferWriter().writeResource(intro).writeResource(card).getBuffer();
    }
    static getId(): number { return 560344632; }
}

export interface ClanMemberView {
    userId: Buffer; // 8-byte Long
    nick: string;
    deaths: number; kills: number; score: number; clanScore: number; weeklyClanScore: number;
    permission: number; // clan role ordinal (0-6)
    field1: number; field8: number;
}

export interface ClanView {
    clanId: Buffer; // 8-byte Long
    leader: string;
    description: string;
    name: string;
    tag: string;
    rating: number;
    logo: string | null;
    recruiting: boolean; // f5: true => the client shows "Request to join" instead of "not recruiting"
    minRank: number; // f8 byte: minimum rank to join (1-30, or -1 = no minimum)
    joinRequests: string[]; // usernames with a pending join request (my-clan window list #4)
    members: ClanMemberView[];
}

/**
 * Full clan-details window (also used as the read-only view of any clan). Wraps ONE "ClanModel"
 * serialized in the EXACT order decoded from the client codec and round-trip validated byte-for-byte
 * against the official FaZe capture (2036 bytes). Field meanings that are unknown are sent as the
 * FaZe-observed defaults (0/empty) — harmless for a read-only view.
 */
export class ShowForeignClanWindowPacket extends BasePacket {
    constructor(private readonly clan: ClanView) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer {
        const w = new BufferWriter();
        const long = (b: Buffer) => w.writeInt32BE(b.readInt32BE(0)).writeInt32BE(b.readInt32BE(4));
        const c = this.clan;
        w.writeUInt8(0);                 // f1 bool
        long(c.clanId);                  // clanId (Long)
        w.writeOptionalString(c.leader); // leader nick
        w.writeOptionalString(c.description);
        w.writeUInt8(c.recruiting ? 1 : 0); // f5 bool: "accepts join requests" (FaZe=0 closed, MRAK=1 open)
        w.writeInt32BE(0);               // f6 int (unknown; FaZe=15/MRAK=16, near member count)
        w.writeUInt8(0);                 // f7 bool
        w.writeUInt8(0);                 // f8 byte (unknown; FaZe=23)
        w.writeOptionalString(c.name);
        w.writeOptionalString(null);     // f10 (unknown string)
        w.writeUInt8(0);                 // f11 bool
        w.writeUInt8(0);                 // f12 bool
        w.writeOptionalString(c.tag);
        w.writeInt32BE(c.members.length);
        for (const m of c.members) {
            w.writeInt32BE(m.field1).writeInt32BE(m.deaths).writeInt32BE(m.kills);
            long(m.userId);
            w.writeInt32BE(m.permission).writeInt32BE(m.score);
            w.writeOptionalString(m.nick);
            w.writeInt32BE(m.field8).writeInt32BE(m.clanScore).writeInt32BE(m.weeklyClanScore);
        }
        w.writeOptionalString(c.logo);
        w.writeInt32BE(c.rating);
        return w.getBuffer();
    }
    static getId(): number { return -1855118498; }
}
