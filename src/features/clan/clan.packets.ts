import { BasePacket } from "@/packets/base.packet";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import { ResourceManager } from "@/utils/resource.manager";
import { defs } from "protanki-protocol";

// ---- C->S (incoming) ----

/** Leader kicks a member out of the clan. Body = optionalString(username). */
export class KickClanMemberPacket extends BasePacket {
    username: string | null = null;
    read(buffer: Buffer): void { this.username = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.KickClanMember.id; }
}

/** Owner/officer changes a member's clan position ("cargo"). Body = optionalString(nick) + int32(position 0-6). */
export class SetClanMemberPositionPacket extends BasePacket {
    username: string | null = null;
    position: number = 6;
    read(buffer: Buffer): void {
        const r = new BufferReader(buffer);
        this.username = r.readOptionalString();
        this.position = r.readInt32BE();
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.username).writeInt32BE(this.position).getBuffer();
    }
    static getId(): number { return defs.clan.SetClanMemberPosition.id; }
}

/** Uploads a new clan logo image (part of "edit clan settings"). Body = int32(byteLength) + raw image bytes
 *  (JPEG/PNG, ~81×100 px). The int32 prefix is a serialized Vector.<int> length. */
export class SetClanLogoPacket extends BasePacket {
    image: Buffer = Buffer.alloc(0);
    read(buffer: Buffer): void {
        const len = new BufferReader(buffer).readInt32BE();
        this.image = buffer.subarray(4, 4 + len);
    }
    write(): Buffer {
        return new BufferWriter().writeInt32BE(this.image.length).writeBuffer(this.image).getBuffer();
    }
    static getId(): number { return defs.clan.SetClanLogo.id; }
}

/** Member leaves the clan. Empty body. */
export class LeaveClanPacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.LeaveClan.id; }
}

/** The recipient's own clan permission flags (drives the client's clan UI). Sent on clan open and whenever
 *  the recipient's position changes. Body = int32 count + count×int32 permissionFlagValue. */
export class ClanPermissionsPacket extends BasePacket {
    constructor(private readonly flags: number[]) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer {
        const w = new BufferWriter().writeInt32BE(this.flags.length);
        for (const f of this.flags) w.writeInt32BE(f);
        return w.getBuffer();
    }
    static getId(): number { return defs.clan.ClanPermissions.id; }
}

/** Post-leave cooldown shown in the not-in-clan modal. Body = int(seconds remaining, e.g. 86400 = 24h). */
export class ClanCooldownPacket extends BasePacket {
    constructor(private readonly seconds: number) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeInt32BE(this.seconds).getBuffer(); }
    static getId(): number { return defs.clan.ClanCooldown.id; }
}

/** Real-time removal of a member from the owner's clan window. Body = optionalString(username). */
export class RemoveClanMemberPacket extends BasePacket {
    constructor(private readonly username: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.username).getBuffer(); }
    static getId(): number { return defs.clan.RemoveClanMember.id; }
}

/** Generic member status notify (clears the "new" badge): sent on member add/leave and as the reply to
 *  MarkMemberSeen. Body = optionalString(username). */
export class MemberStatusNotifyPacket extends BasePacket {
    constructor(private readonly username: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.username).getBuffer(); }
    static getId(): number { return defs.clan.MemberStatusNotify.id; }
}

/** Owner viewed a member/notification → clear its "new" badge. Body = optionalString(username). Server
 *  replies MemberStatusNotify(username). */
export class MarkMemberSeenPacket extends BasePacket {
    username: string | null = null;
    read(buffer: Buffer): void { this.username = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.MarkMemberSeen.id; }
}

/** A clan MEMBER/owner opens their clan window → server replies MyClanWindow (-8296541). Empty body. */
export class OpenMyClanWindowPacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.OpenMyClanWindow.id; }
}

/** Real-time notify to the online owner: a new join request arrived. Body = optionalString(username). */
export class NotifyJoinRequestPacket extends BasePacket {
    constructor(private readonly username: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.username).getBuffer(); }
    static getId(): number { return defs.clan.NotifyJoinRequest.id; }
}

/** Real-time notify to the online owner: add the request card to the list. Body = optionalString(username). */
export class AddJoinRequestPacket extends BasePacket {
    constructor(private readonly username: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.username).getBuffer(); }
    static getId(): number { return defs.clan.AddJoinRequest.id; }
}

/** Owner ACCEPTS a pending join request → the requester becomes a member. Body = optionalString(username). */
export class AcceptJoinRequestPacket extends BasePacket {
    username: string | null = null;
    read(buffer: Buffer): void { this.username = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.AcceptJoinRequest.id; }
}

/** Owner selected/opened a pending request (sent before accept AND decline). Body = optionalString(username).
 *  No state change — handled as a no-op so it doesn't log as an unknown packet. */
export class SelectJoinRequestPacket extends BasePacket {
    username: string | null = null;
    read(buffer: Buffer): void { this.username = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.SelectJoinRequest.id; }
}

/** Owner DECLINES ALL pending join requests for the clan. Empty body. */
export class DeclineAllJoinRequestsPacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.DeclineAllJoinRequests.id; }
}

/** Owner DECLINES a pending join request. Body = optionalString(requester username). */
export class DeclineJoinRequestPacket extends BasePacket {
    username: string | null = null;
    read(buffer: Buffer): void { this.username = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.DeclineJoinRequest.id; }
}

/** Reply to a decline: drop the request card for `username`. Body = optionalString(username). */
export class JoinRequestDeclinedPacket extends BasePacket {
    constructor(private readonly username: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.username).getBuffer(); }
    static getId(): number { return defs.clan.JoinRequestDeclined.id; }
}

/** Reply to a decline: remove `username` from the requests list. Body = optionalString(username). */
export class RemoveJoinRequestPacket extends BasePacket {
    constructor(private readonly username: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.username).getBuffer(); }
    static getId(): number { return defs.clan.RemoveJoinRequest.id; }
}

/** Client opened the clan view while NOT in a clan → server replies ShowNotInClanWindow. Empty body. */
export class ShowNotInClanPanelPacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.ShowNotInClanPanel.id; }
}

/** Close the clan window. Empty body — sent C->S, and the server echoes the SAME packet back to
 *  confirm so the client actually closes the view. */
export class CloseClanWindowPacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.CloseClanWindow.id; }
}

/** Client closed the not-in-clan panel. Empty body. */
export class HideNotInClanPanelPacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.HideNotInClanPanel.id; }
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
    static getId(): number { return defs.clan.GetClanRatingsData.id; }
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
    static getId(): number { return defs.clan.SetClanRatingsData.id; }
}

/** Client wants to view another clan by its tag. Body = optionalString(tag). */
export class ShowForeignClanPacket extends BasePacket {
    clanTag: string | null = null;
    read(buffer: Buffer): void { this.clanTag = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.ShowForeignClan.id; }
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
    static getId(): number { return defs.clan.CreateClan.id; }
}

/** Live availability check as the user types the clan TAG in the create form. Body = optionalString(tag). */
export class CheckClanTagPacket extends BasePacket {
    tag: string | null = null;
    read(buffer: Buffer): void { this.tag = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.CheckClanTag.id; }
}

/** Live availability check for the clan NAME. Body = optionalString(name). */
export class CheckClanNamePacket extends BasePacket {
    name: string | null = null;
    read(buffer: Buffer): void { this.name = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.CheckClanName.id; }
}

/** Live check (as the leader types) of whether a username can be invited — toggles the invite button.
 *  Body = optionalString(username). Server replies InviteUserValid or InviteUserInvalid (both empty). */
export class CheckInviteUserPacket extends BasePacket {
    username: string | null = null;
    read(buffer: Buffer): void { this.username = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.CheckInviteUser.id; }
}

/** Reply to CheckInviteUser: the username CAN be invited (exists, not in a clan) → enables the button. */
export class InviteUserValidPacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.InviteUserValid.id; }
}

/** Reply to CheckInviteUser: the username CANNOT be invited (no account / already in a clan) → keeps button disabled. */
export class InviteUserInvalidPacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.InviteUserInvalid.id; }
}

/** Owner edits the clan DESCRIPTION. Body = optionalString(description). Server echoes it back. */
export class SetClanDescriptionPacket extends BasePacket {
    description: string | null = null;
    constructor(description: string | null = null) { super(); this.description = description; }
    read(buffer: Buffer): void { this.description = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.description).getBuffer(); }
    static getId(): number { return defs.clan.SetClanDescription.id; }
}

/** Owner edits the MINIMUM RANK to request to join. Body = 1 signed byte (rank 1-30, or -1 = no minimum).
 *  The client uses -1 as the "no restriction" sentinel, so this must be signed (readInt8/writeInt8). */
export class SetClanMinRankPacket extends BasePacket {
    minRank: number = -1;
    read(buffer: Buffer): void { this.minRank = new BufferReader(buffer).readInt8(); }
    write(): Buffer { return new BufferWriter().writeInt8(this.minRank).getBuffer(); }
    static getId(): number { return defs.clan.SetClanMinRank.id; }
}

/** Owner toggles RECRUITING (open/closed). Body = 1 byte bool (1=open/recruiting, 0=closed). */
export class SetClanRecruitingPacket extends BasePacket {
    recruiting: boolean = true;
    read(buffer: Buffer): void { this.recruiting = new BufferReader(buffer).readUInt8() !== 0; }
    write(): Buffer { return new BufferWriter().writeUInt8(this.recruiting ? 1 : 0).getBuffer(); }
    static getId(): number { return defs.clan.SetClanRecruiting.id; }
}

/** Owner SENDS a clan invite to a user. Body = optionalString(username). */
export class SendClanInvitePacket extends BasePacket {
    username: string | null = null;
    read(buffer: Buffer): void { this.username = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.SendClanInvite.id; }
}

/** Ack to the owner that the invite was sent. Body = optionalString(username). */
export class ClanInviteSentAckPacket extends BasePacket {
    constructor(private readonly username: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.username).getBuffer(); }
    static getId(): number { return defs.clan.ClanInviteSentAck.id; }
}

/** Owner CANCELS a pending clan invite. Body = optionalString(username). */
export class CancelClanInvitePacket extends BasePacket {
    username: string | null = null;
    read(buffer: Buffer): void { this.username = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.CancelClanInvite.id; }
}

/** Ack to the owner that the invite was cancelled. Body = optionalString(username). */
export class ClanInviteCancelledAckPacket extends BasePacket {
    constructor(private readonly username: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.username).getBuffer(); }
    static getId(): number { return defs.clan.ClanInviteCancelledAck.id; }
}

/** Invited user opens the clan attached to an invite. Body = optionalString(tag) → server echoes tag. */
export class ViewInviteClanPacket extends BasePacket {
    tag: string | null = null;
    read(buffer: Buffer): void { this.tag = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.ViewInviteClan.id; }
}

/** Response to ViewInviteClan. Body = optionalString(tag). */
export class ViewInviteClanResponsePacket extends BasePacket {
    constructor(private readonly tag: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.tag).getBuffer(); }
    static getId(): number { return defs.clan.ViewInviteClanResponse.id; }
}

/** Invited user ACCEPTS the invite. Body = optionalString(clan tag). */
export class AcceptClanInvitePacket extends BasePacket {
    tag: string | null = null;
    read(buffer: Buffer): void { this.tag = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.AcceptClanInvite.id; }
}

/** Invited user DECLINES the invite. Body = optionalString(clan tag). */
export class DeclineClanInvitePacket extends BasePacket {
    tag: string | null = null;
    read(buffer: Buffer): void { this.tag = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.DeclineClanInvite.id; }
}

/** Notifies the invited user: "you've been invited to clan <tag>". Body = optionalString(tag). */
export class ClanInviteNotifyPacket extends BasePacket {
    constructor(private readonly tag: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.tag).getBuffer(); }
    static getId(): number { return defs.clan.ClanInviteNotify.id; }
}

/** Ack to an invite accept/decline. Body = optionalString(tag). */
export class ClanInviteAckPacket extends BasePacket {
    constructor(private readonly tag: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.tag).getBuffer(); }
    static getId(): number { return defs.clan.ClanInviteAck.id; }
}

/** Client asks to JOIN a clan (the "request to join" button). Body = optionalString(tag). */
export class JoinClanRequestPacket extends BasePacket {
    tag: string | null = null;
    read(buffer: Buffer): void { this.tag = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.JoinClanRequest.id; }
}

/** Search/list panel: live check that a clan with the typed NAME exists. Body = optionalString(name).
 *  Server replies ClanSearchFound (empty) when a clan matches → enables the "request to join" button. */
export class SearchClanByNamePacket extends BasePacket {
    name: string | null = null;
    read(buffer: Buffer): void { this.name = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.SearchClanByName.id; }
}

/** Reply to SearchClanByName: a clan with that name exists AND accepts requests (empty body) → enable button. */
export class ClanSearchFoundPacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.ClanSearchFound.id; }
}

/** Reply to SearchClanByName: no joinable clan with that name (doesn't exist OR isn't recruiting) → keep disabled. */
export class ClanSearchUnavailablePacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.ClanSearchUnavailable.id; }
}

/** Client asks to JOIN a clan from the search/list panel, by NAME. Body = optionalString(name). */
export class JoinClanByNamePacket extends BasePacket {
    name: string | null = null;
    read(buffer: Buffer): void { this.name = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.JoinClanByName.id; }
}

/** Client CANCELS a pending join request from the foreign-clan window. Body = optionalString(tag). */
export class CancelJoinClanRequestPacket extends BasePacket {
    tag: string | null = null;
    read(buffer: Buffer): void { this.tag = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.CancelJoinClanRequest.id; }
}

/** Client CANCELS a pending join request from the "sent requests" modal. Body = optionalString(tag). */
export class CancelJoinRequestFromModalPacket extends BasePacket {
    tag: string | null = null;
    read(buffer: Buffer): void { this.tag = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.CancelJoinRequestFromModal.id; }
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
    w.writeInt32BE(m.secondsInClan).writeInt32BE(m.deaths).writeInt32BE(m.kills);
    long(m.lastOnlineDate);
    w.writeInt32BE(m.permission).writeInt32BE(m.score);
    w.writeOptionalString(m.nick);
    w.writeInt32BE(m.minesUsed).writeInt32BE(m.clanScore).writeInt32BE(m.weeklyClanScore);
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
        // 3,4,5) #3 = ALL members (the rendered member list), #4 = received join requests, #5 = SENT
        // invites (the client labels list5 "Convites enviados"; putting members there showed them as invites).
        presVec(v.members.map((m) => m.nick), (s) => w.writeOptionalString(s));
        presVec(v.joinRequests, (s) => w.writeOptionalString(s));
        presVec(v.sentInvites, (s) => w.writeOptionalString(s));
        return w.getBuffer();
    }
    static getId(): number { return defs.clan.MyClanWindow.id; }
}

/** Sent with the my-clan window: the clan tag (8-byte body, optionalString). */
export class ClanTagNotifyPacket extends BasePacket {
    constructor(private readonly tag: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.tag).getBuffer(); }
    static getId(): number { return defs.clan.ClanTagNotify.id; }
}

/** Sent when joining a clan: the clan display name (sets the clan name in the UI). Body = optString(name). */
export class ClanNameNotifyPacket extends BasePacket {
    constructor(private readonly name: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.name).getBuffer(); }
    static getId(): number { return defs.clan.ClanNameNotify.id; }
}

/** Real-time add of a new member to the owner's open clan window. Body = the 10-field MemberModel. */
export class AddClanMemberPacket extends BasePacket {
    constructor(private readonly member: ClanMemberView) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { const w = new BufferWriter(); writeMemberModel(w, this.member); return w.getBuffer(); }
    static getId(): number { return defs.clan.AddClanMember.id; }
}

/** Aux notify sent with a member add (officially follows AddClanMember). Body = optString(username). */
export class MemberAddedNotifyPacket extends BasePacket {
    constructor(private readonly username: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.username).getBuffer(); }
    static getId(): number { return defs.clan.MemberAddedNotify.id; }
}

/** Sent with the my-clan window: the leader/owner nick. */
export class ClanLeaderNotifyPacket extends BasePacket {
    constructor(private readonly nick: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.nick).getBuffer(); }
    static getId(): number { return defs.clan.ClanLeaderNotify.id; }
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
    static getId(): number { return defs.clan.JoinRequestModel.id; }
}

/** Ack: a join request for `tag` is now pending. Body = optionalString(tag). */
export class JoinRequestSentPacket extends BasePacket {
    constructor(private readonly tag: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.tag).getBuffer(); }
    static getId(): number { return defs.clan.JoinRequestSent.id; }
}

/** Ack: the pending join request for `tag` was withdrawn. Body = optionalString(tag). */
export class JoinRequestCancelledPacket extends BasePacket {
    constructor(private readonly tag: string) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.tag).getBuffer(); }
    static getId(): number { return defs.clan.JoinRequestCancelled.id; }
}

// Availability results are EMPTY packets — the client distinguishes available vs taken by the id.
export class ClanTagAvailablePacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.ClanTagAvailable.id; }
}
export class ClanTagTakenPacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.ClanTagTaken.id; }
}
export class ClanNameAvailablePacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.ClanNameAvailable.id; }
}
export class ClanNameTakenPacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.ClanNameTaken.id; }
}

/**
 * The "you're not in a clan" window (create for CLAN_CREATION_COST / join). Body = 2 resources: the
 * clan-system intro illustration and the clan card (own dedicated images, matching the official).
 */
export class ShowNotInClanWindowPacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer {
        const intro = ResourceManager.getIdlowById("clan/intro");
        const card = ResourceManager.getIdlowById("clan/card");
        return new BufferWriter().writeResource(intro).writeResource(card).getBuffer();
    }
    static getId(): number { return defs.clan.ShowNotInClanWindow.id; }
}

export interface ClanMemberView {
    lastOnlineDate: Buffer; // 8-byte Long — member's last-online time in ms (client shows "last seen")
    nick: string;
    deaths: number; kills: number; score: number; clanScore: number; weeklyClanScore: number;
    permission: number; // clan position ordinal (0=Supreme Commander .. 6=Novice)
    secondsInClan: number; // client shows as "time in clan" (its `.date` field)
    minesUsed: number; // client sums these across members → the "CLAN_USED_MINES" clan stat
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
    joinRequests: string[]; // usernames with a pending join request — received (my-clan window list #4)
    sentInvites: string[]; // usernames the clan invited — sent invites (my-clan window list #5)
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
            w.writeInt32BE(m.secondsInClan).writeInt32BE(m.deaths).writeInt32BE(m.kills);
            long(m.lastOnlineDate);
            w.writeInt32BE(m.permission).writeInt32BE(m.score);
            w.writeOptionalString(m.nick);
            w.writeInt32BE(m.minesUsed).writeInt32BE(m.clanScore).writeInt32BE(m.weeklyClanScore);
        }
        w.writeOptionalString(c.logo);
        w.writeInt32BE(c.rating);
        return w.getBuffer();
    }
    static getId(): number { return defs.clan.ShowForeignClanWindow.id; }
}

export interface ClanMissionView {
    id: number;
    icon: number; // icon resource idLow (sent as an 8-byte Resource)
    description: string;
    prizes: { count: number; name: string }[];
    criteria: number; // clan-wide target
    progress: number; // clan-wide progress (clamped to criteria on the wire)
    secondsToReset: number; // countdown until the mission set resets
    completed: boolean; // drives the client's GET PRIZE vs PRIZE_CLAIMED (we auto-claim, so completed == claimed)
}

/** C->S: open the clan missions ("DAILY_QUEST_MISSIONS") tab. Empty body. */
export class OpenClanMissionsPacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.clan.OpenClanMissions.id; }
}

/** S->C: the clan mission list (also pushed on progress change). Body = int32 count + count × mission
 *  (int32 id, Resource icon, optString description, int32 prizeCount + prizes{int32 count, optString name},
 *  int32 criteria, int32 progress, int32 secondsToReset, bool completed). */
export class ShowClanMissionsPacket extends BasePacket {
    constructor(private readonly missions: ClanMissionView[]) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer {
        const w = new BufferWriter().writeInt32BE(this.missions.length);
        for (const m of this.missions) {
            w.writeInt32BE(m.id).writeResource(m.icon).writeOptionalString(m.description);
            w.writeInt32BE(m.prizes.length);
            for (const p of m.prizes) w.writeInt32BE(p.count).writeOptionalString(p.name);
            w.writeInt32BE(m.criteria).writeInt32BE(m.progress).writeInt32BE(m.secondsToReset);
            w.writeUInt8(m.completed ? 1 : 0);
        }
        return w.getBuffer();
    }
    static getId(): number { return defs.clan.ShowClanMissions.id; }
}
