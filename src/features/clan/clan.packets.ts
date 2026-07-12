import { BasePacket } from "@/packets/base.packet";
import { packetClass } from "@/packets/packet-class";
import { ResourceManager } from "@/utils/resource.manager";
import { defs, encodeBody, decodeBody } from "protanki-protocol";
import { CLAN_MAX_MEMBERS, CLAN_MAX_DESCRIPTION } from "./clan.constants";

// IDs e schemas em `protanki-protocol` (defs.clan.*). A ESTRUTURA do fio (incl. o Long de 8 bytes =
// i64, os models e os vetores) fica na lib; o server só mapeia ClanView/MemberModel → campos.

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
    minRank: number; // minimum rank to join, EFETIVO (8-30, nunca -1 — já normalizado por effectiveMinRank)
    blocked: boolean; // clã bloqueado por staff → janela esconde o botão de entrada e mostra blockReason
    blockReason: string; // mensagem exibida quando blocked=true
    joinRequests: string[]; // usernames with a pending join request — received (my-clan window list #4)
    sentInvites: string[]; // usernames the clan invited — sent invites (my-clan window list #5)
    members: ClanMemberView[];
}

export interface ClanMissionView {
    id: number;
    icon: number; // icon resource idLow (sent as an 8-byte Resource)
    description: string;
    prizes: { count: number; name: string }[];
    criteria: number; // clan-wide target
    progress: number; // clan-wide progress (clamped to criteria on the wire)
    secondsToReset: number; // countdown until the mission set resets
    completed: boolean; // GET PRIZE vs PRIZE_CLAIMED (we auto-claim, so completed == claimed)
}

// ClanView/MemberView → objeto de campos do schema (o Long de 8 bytes vira bigint = i64).
const memberModel = (m: ClanMemberView) => ({
    secondsInClan: m.secondsInClan, deaths: m.deaths, kills: m.kills, lastOnlineDate: m.lastOnlineDate.readBigInt64BE(0),
    permission: m.permission, score: m.score, nick: m.nick, minesUsed: m.minesUsed, clanScore: m.clanScore, weeklyClanScore: m.weeklyClanScore,
});
// `editable` = flag do client p/ o clã ser editável; o oficial manda true (própria janela e ratings).
const lightClanModel = (v: ClanView, editable: boolean) => ({
    blocked: v.blocked,
    creationDate: v.clanId.readBigInt64BE(0), // ClanView.clanId já é msToLong(createdAt)
    founder: v.leader,
    description: v.description,
    recruiting: v.recruiting,
    maxDescriptionLength: CLAN_MAX_DESCRIPTION,
    maxMembers: CLAN_MAX_MEMBERS,
    minRank: v.minRank,
    name: v.name,
    blockReason: v.blockReason || null,
    editable,
    tag: v.tag,
    memberNicks: v.members.map((m) => m.nick),
    logo: v.logo ?? "",
    score: v.rating,
});

// ---- C->S (incoming): read pela lib; write é stub (o server só lê estes) ----

/** Leader kicks a member out of the clan. Body = optionalString(username). */
export const KickClanMemberPacket = packetClass(defs.clan.KickClanMember);
export type KickClanMemberPacket = InstanceType<typeof KickClanMemberPacket>;

/** Owner/officer changes a member's clan position. Body = optionalString(nick) + int32(position 0-6). */
export const SetClanMemberPositionPacket = packetClass(defs.clan.SetClanMemberPosition);
export type SetClanMemberPositionPacket = InstanceType<typeof SetClanMemberPositionPacket>;

/** Uploads a new clan logo image. Body = int32(byteLength) + raw image bytes (tipo `bytes`). */
export const SetClanLogoPacket = packetClass(defs.clan.SetClanLogo);
export type SetClanLogoPacket = InstanceType<typeof SetClanLogoPacket>;

/** Member leaves the clan. Empty body. */
export const LeaveClanPacket = packetClass(defs.clan.LeaveClan);
export type LeaveClanPacket = InstanceType<typeof LeaveClanPacket>;

/** The recipient's own clan permission flags. Body = int32 count + count×int32 permissionFlagValue. */
export class ClanPermissionsPacket extends BasePacket {
    constructor(private readonly flags: number[]) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return encodeBody(defs.clan.ClanPermissions, { flags: this.flags.map((flag) => ({ flag })) }); }
    static getId(): number { return defs.clan.ClanPermissions.id; }
}

/** Post-leave cooldown shown in the not-in-clan modal. Body = int(seconds remaining). */
export const ClanCooldownPacket = packetClass(defs.clan.ClanCooldown);
export type ClanCooldownPacket = InstanceType<typeof ClanCooldownPacket>;

/** Real-time removal of a member from the owner's clan window. Body = optionalString(username). */
export const RemoveClanMemberPacket = packetClass(defs.clan.RemoveClanMember);
export type RemoveClanMemberPacket = InstanceType<typeof RemoveClanMemberPacket>;

/** Generic member status notify (clears the "new" badge). Body = optionalString(username). */
export const MemberStatusNotifyPacket = packetClass(defs.clan.MemberStatusNotify);
export type MemberStatusNotifyPacket = InstanceType<typeof MemberStatusNotifyPacket>;

/** Owner viewed a member/notification → clear its "new" badge. Body = optionalString(username). */
export const MarkMemberSeenPacket = packetClass(defs.clan.MarkMemberSeen);
export type MarkMemberSeenPacket = InstanceType<typeof MarkMemberSeenPacket>;

/** A clan member/owner opens their clan window → server replies MyClanWindow. Empty body. */
export const OpenMyClanWindowPacket = packetClass(defs.clan.OpenMyClanWindow);
export type OpenMyClanWindowPacket = InstanceType<typeof OpenMyClanWindowPacket>;

/** Real-time notify to the online owner: a new join request arrived. Body = optionalString(username). */
export const NotifyJoinRequestPacket = packetClass(defs.clan.NotifyJoinRequest);
export type NotifyJoinRequestPacket = InstanceType<typeof NotifyJoinRequestPacket>;

/** Real-time notify to the online owner: add the request card to the list. Body = optionalString(username). */
export const AddJoinRequestPacket = packetClass(defs.clan.AddJoinRequest);
export type AddJoinRequestPacket = InstanceType<typeof AddJoinRequestPacket>;

/** Owner ACCEPTS a pending join request. Body = optionalString(username). */
export const AcceptJoinRequestPacket = packetClass(defs.clan.AcceptJoinRequest);
export type AcceptJoinRequestPacket = InstanceType<typeof AcceptJoinRequestPacket>;

/** Owner selected/opened a pending request (sent before accept AND decline). Body = optionalString(username). */
export const SelectJoinRequestPacket = packetClass(defs.clan.SelectJoinRequest);
export type SelectJoinRequestPacket = InstanceType<typeof SelectJoinRequestPacket>;

/** Owner DECLINES ALL pending join requests. Empty body. */
export const DeclineAllJoinRequestsPacket = packetClass(defs.clan.DeclineAllJoinRequests);
export type DeclineAllJoinRequestsPacket = InstanceType<typeof DeclineAllJoinRequestsPacket>;

/** Owner DECLINES a pending join request. Body = optionalString(requester username). */
export const DeclineJoinRequestPacket = packetClass(defs.clan.DeclineJoinRequest);
export type DeclineJoinRequestPacket = InstanceType<typeof DeclineJoinRequestPacket>;

/** Reply to a decline: drop the request card for `username`. Body = optionalString(username). */
export const JoinRequestDeclinedPacket = packetClass(defs.clan.JoinRequestDeclined);
export type JoinRequestDeclinedPacket = InstanceType<typeof JoinRequestDeclinedPacket>;

/** Reply to a decline: remove `username` from the requests list. Body = optionalString(username). */
export const RemoveJoinRequestPacket = packetClass(defs.clan.RemoveJoinRequest);
export type RemoveJoinRequestPacket = InstanceType<typeof RemoveJoinRequestPacket>;

/** Client opened the clan view while NOT in a clan → server replies ShowNotInClanWindow. Empty body. */
export const ShowNotInClanPanelPacket = packetClass(defs.clan.ShowNotInClanPanel);
export type ShowNotInClanPanelPacket = InstanceType<typeof ShowNotInClanPanelPacket>;

/** Close the clan window (empty body — C->S, and the server echoes the SAME packet back). */
export const CloseClanWindowPacket = packetClass(defs.clan.CloseClanWindow);
export type CloseClanWindowPacket = InstanceType<typeof CloseClanWindowPacket>;

/** Client closed the not-in-clan panel. Empty body. */
export const HideNotInClanPanelPacket = packetClass(defs.clan.HideNotInClanPanel);
export type HideNotInClanPanelPacket = InstanceType<typeof HideNotInClanPanelPacket>;

/** Client requests a page of the clan leaderboard. Body = int(startIndex) + int(count). */
export const GetClanRatingsDataPacket = packetClass(defs.clan.GetClanRatingsData);
export type GetClanRatingsDataPacket = InstanceType<typeof GetClanRatingsDataPacket>;

/** Clan leaderboard page. Body = int(startIndex) + Vector<light clan model>. */
export class SetClanRatingsDataPacket extends BasePacket {
    constructor(private readonly startIndex: number, private readonly clans: ClanView[]) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer {
        return encodeBody(defs.clan.SetClanRatingsData, { startIndex: this.startIndex, clans: this.clans.map((c) => lightClanModel(c, true)) }); // oficial manda editable=true também na lista
    }
    static getId(): number { return defs.clan.SetClanRatingsData.id; }
}

/** Client wants to view another clan by its tag. Body = optionalString(tag). */
export class ShowForeignClanPacket extends BasePacket {
    clanTag: string | null = null;
    // O schema usa `tag`; a classe expõe `clanTag` — mapeia pela lib.
    read(buffer: Buffer): void { this.clanTag = decodeBody(defs.clan.ShowForeignClan, buffer).fields.tag; }
    write(): Buffer { return encodeBody(defs.clan.ShowForeignClan, { tag: this.clanTag }); }
    static getId(): number { return defs.clan.ShowForeignClan.id; }
}

/** Client submits the create-clan form. Body = optionalString(name) + optionalString(tag). */
export const CreateClanPacket = packetClass(defs.clan.CreateClan);
export type CreateClanPacket = InstanceType<typeof CreateClanPacket>;

/** Live availability check for the clan TAG. Body = optionalString(tag). */
export const CheckClanTagPacket = packetClass(defs.clan.CheckClanTag);
export type CheckClanTagPacket = InstanceType<typeof CheckClanTagPacket>;

/** Live availability check for the clan NAME. Body = optionalString(name). */
export const CheckClanNamePacket = packetClass(defs.clan.CheckClanName);
export type CheckClanNamePacket = InstanceType<typeof CheckClanNamePacket>;

/** Live check whether a username can be invited. Body = optionalString(username). */
export const CheckInviteUserPacket = packetClass(defs.clan.CheckInviteUser);
export type CheckInviteUserPacket = InstanceType<typeof CheckInviteUserPacket>;

/** Reply to CheckInviteUser: username CAN be invited. Empty. */
export const InviteUserValidPacket = packetClass(defs.clan.InviteUserValid);
export type InviteUserValidPacket = InstanceType<typeof InviteUserValidPacket>;

/** Reply to CheckInviteUser: username CANNOT be invited. Empty. */
export const InviteUserInvalidPacket = packetClass(defs.clan.InviteUserInvalid);
export type InviteUserInvalidPacket = InstanceType<typeof InviteUserInvalidPacket>;

/** Owner edits the clan DESCRIPTION. Body = optionalString(description). Server echoes it back. */
export const SetClanDescriptionPacket = packetClass(defs.clan.SetClanDescription);
export type SetClanDescriptionPacket = InstanceType<typeof SetClanDescriptionPacket>;

/** Owner edits the MINIMUM RANK. Body = 1 signed byte (rank 1-30, or -1 = no minimum). */
export const SetClanMinRankPacket = packetClass(defs.clan.SetClanMinRank);
export type SetClanMinRankPacket = InstanceType<typeof SetClanMinRankPacket>;

/** Owner toggles RECRUITING. Body = 1 byte bool. */
export const SetClanRecruitingPacket = packetClass(defs.clan.SetClanRecruiting);
export type SetClanRecruitingPacket = InstanceType<typeof SetClanRecruitingPacket>;

/** Owner SENDS a clan invite. Body = optionalString(username). */
export const SendClanInvitePacket = packetClass(defs.clan.SendClanInvite);
export type SendClanInvitePacket = InstanceType<typeof SendClanInvitePacket>;

/** Ack to the owner that the invite was sent. Body = optionalString(username). */
export const ClanInviteSentAckPacket = packetClass(defs.clan.ClanInviteSentAck);
export type ClanInviteSentAckPacket = InstanceType<typeof ClanInviteSentAckPacket>;

/** Owner CANCELS a pending clan invite. Body = optionalString(username). */
export const CancelClanInvitePacket = packetClass(defs.clan.CancelClanInvite);
export type CancelClanInvitePacket = InstanceType<typeof CancelClanInvitePacket>;

/** Ack to the owner that the invite was cancelled. Body = optionalString(username). */
export const ClanInviteCancelledAckPacket = packetClass(defs.clan.ClanInviteCancelledAck);
export type ClanInviteCancelledAckPacket = InstanceType<typeof ClanInviteCancelledAckPacket>;

/** Invited user opens the clan attached to an invite. Body = optionalString(tag). */
export const ViewInviteClanPacket = packetClass(defs.clan.ViewInviteClan);
export type ViewInviteClanPacket = InstanceType<typeof ViewInviteClanPacket>;

/** Response to ViewInviteClan. Body = optionalString(tag). */
export const ViewInviteClanResponsePacket = packetClass(defs.clan.ViewInviteClanResponse);
export type ViewInviteClanResponsePacket = InstanceType<typeof ViewInviteClanResponsePacket>;

/** Invited user ACCEPTS the invite. Body = optionalString(clan tag). */
export const AcceptClanInvitePacket = packetClass(defs.clan.AcceptClanInvite);
export type AcceptClanInvitePacket = InstanceType<typeof AcceptClanInvitePacket>;

/** Invited user DECLINES the invite. Body = optionalString(clan tag). */
export const DeclineClanInvitePacket = packetClass(defs.clan.DeclineClanInvite);
export type DeclineClanInvitePacket = InstanceType<typeof DeclineClanInvitePacket>;

/** Notifies the invited user of a clan invite. Body = optionalString(tag). */
export const ClanInviteNotifyPacket = packetClass(defs.clan.ClanInviteNotify);
export type ClanInviteNotifyPacket = InstanceType<typeof ClanInviteNotifyPacket>;

/** Ack to an invite accept/decline. Body = optionalString(tag). */
export const ClanInviteAckPacket = packetClass(defs.clan.ClanInviteAck);
export type ClanInviteAckPacket = InstanceType<typeof ClanInviteAckPacket>;

/** Client asks to JOIN a clan. Body = optionalString(tag). */
export const JoinClanRequestPacket = packetClass(defs.clan.JoinClanRequest);
export type JoinClanRequestPacket = InstanceType<typeof JoinClanRequestPacket>;

/** Search/list panel: live check that a clan with the typed NAME exists. Body = optionalString(name). */
export const SearchClanByNamePacket = packetClass(defs.clan.SearchClanByName);
export type SearchClanByNamePacket = InstanceType<typeof SearchClanByNamePacket>;

/** Reply to SearchClanByName: a clan matches → enable button. Empty. */
export const ClanSearchFoundPacket = packetClass(defs.clan.ClanSearchFound);
export type ClanSearchFoundPacket = InstanceType<typeof ClanSearchFoundPacket>;

/** Reply to SearchClanByName: no joinable clan → keep disabled. Empty. */
export const ClanSearchUnavailablePacket = packetClass(defs.clan.ClanSearchUnavailable);
export type ClanSearchUnavailablePacket = InstanceType<typeof ClanSearchUnavailablePacket>;

/** Client asks to JOIN a clan by NAME. Body = optionalString(name). */
export const JoinClanByNamePacket = packetClass(defs.clan.JoinClanByName);
export type JoinClanByNamePacket = InstanceType<typeof JoinClanByNamePacket>;

/** Client CANCELS a pending join request from the foreign-clan window. Body = optionalString(tag). */
export const CancelJoinClanRequestPacket = packetClass(defs.clan.CancelJoinClanRequest);
export type CancelJoinClanRequestPacket = InstanceType<typeof CancelJoinClanRequestPacket>;

/** Client CANCELS a pending join request from the "sent requests" modal. Body = optionalString(tag). */
export const CancelJoinRequestFromModalPacket = packetClass(defs.clan.CancelJoinRequestFromModal);
export type CancelJoinRequestFromModalPacket = InstanceType<typeof CancelJoinRequestFromModalPacket>;

// ---- S->C (outgoing) ----

/** The "my clan" / owner management window. Aggregate: light model + members + perms + 3 string lists. */
export class MyClanWindowPacket extends BasePacket {
    constructor(private readonly v: ClanView) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer {
        const v = this.v;
        return encodeBody(defs.clan.MyClanWindow, {
            clanModel: lightClanModel(v, true), // própria janela → editável
            members: v.members.map(memberModel),
            perms: [0, 1, 2, 3, 4, 5, 6, 7].map((ordinal) => ({ ordinal })),
            memberNicks: v.members.map((m) => m.nick),
            joinRequests: v.joinRequests,
            sentInvites: v.sentInvites,
        });
    }
    static getId(): number { return defs.clan.MyClanWindow.id; }
}

/** Sent with the my-clan window: the clan tag. Body = optString(tag). */
export const ClanTagNotifyPacket = packetClass(defs.clan.ClanTagNotify);
export type ClanTagNotifyPacket = InstanceType<typeof ClanTagNotifyPacket>;

/** Sent when joining a clan: the clan display name. Body = optString(name). */
export const ClanNameNotifyPacket = packetClass(defs.clan.ClanNameNotify);
export type ClanNameNotifyPacket = InstanceType<typeof ClanNameNotifyPacket>;

/** Real-time add of a new member to the owner's open clan window. Body = the 10-field MemberModel. */
export class AddClanMemberPacket extends BasePacket {
    constructor(private readonly member: ClanMemberView) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return encodeBody(defs.clan.AddClanMember, memberModel(this.member)); }
    static getId(): number { return defs.clan.AddClanMember.id; }
}

/** Aux notify sent with a member add. Body = optString(username). */
export const MemberAddedNotifyPacket = packetClass(defs.clan.MemberAddedNotify);
export type MemberAddedNotifyPacket = InstanceType<typeof MemberAddedNotifyPacket>;

/** Sent with the my-clan window: the leader/owner nick. Body = optString(nick). */
export const ClanLeaderNotifyPacket = packetClass(defs.clan.ClanLeaderNotify);
export type ClanLeaderNotifyPacket = InstanceType<typeof ClanLeaderNotifyPacket>;

/** The pending join-request card. Body = optString(tag) + a LIGHT clan model (layout próprio). */
export class JoinRequestModelPacket extends BasePacket {
    constructor(private readonly v: ClanView) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer {
        return encodeBody(defs.clan.JoinRequestModel, {
            tag: this.v.tag, // tag externa do card de pedido
            clan: lightClanModel(this.v, true),
        });
    }
    static getId(): number { return defs.clan.JoinRequestModel.id; }
}

/** Ack: a join request for `tag` is now pending. Body = optString(tag). */
export const JoinRequestSentPacket = packetClass(defs.clan.JoinRequestSent);
export type JoinRequestSentPacket = InstanceType<typeof JoinRequestSentPacket>;

/** Ack: the pending join request for `tag` was withdrawn. Body = optString(tag). */
export const JoinRequestCancelledPacket = packetClass(defs.clan.JoinRequestCancelled);
export type JoinRequestCancelledPacket = InstanceType<typeof JoinRequestCancelledPacket>;

// Availability results are EMPTY packets — the client distinguishes available vs taken by the id.
export const ClanTagAvailablePacket = packetClass(defs.clan.ClanTagAvailable);
export type ClanTagAvailablePacket = InstanceType<typeof ClanTagAvailablePacket>;
export const ClanTagTakenPacket = packetClass(defs.clan.ClanTagTaken);
export type ClanTagTakenPacket = InstanceType<typeof ClanTagTakenPacket>;
export const ClanNameAvailablePacket = packetClass(defs.clan.ClanNameAvailable);
export type ClanNameAvailablePacket = InstanceType<typeof ClanNameAvailablePacket>;
export const ClanNameTakenPacket = packetClass(defs.clan.ClanNameTaken);
export type ClanNameTakenPacket = InstanceType<typeof ClanNameTakenPacket>;

/**
 * The "you're not in a clan" window. Body = 2 resources: the clan-system intro illustration and the clan
 * card. Os recursos são resolvidos em runtime (lógica); a lib escreve os bytes.
 */
export class ShowNotInClanWindowPacket extends BasePacket {
    read(_buffer: Buffer): void {}
    write(): Buffer {
        return encodeBody(defs.clan.ShowNotInClanWindow, {
            intro: ResourceManager.getIdlowById("clan/intro"),
            card: ResourceManager.getIdlowById("clan/card"),
        });
    }
    static getId(): number { return defs.clan.ShowNotInClanWindow.id; }
}

/** Flags relativos ao USUÁRIO que abre a janela (definem o estado do botão de entrada). */
export interface ForeignClanViewerFlags {
    joinHidden: boolean; // já é membro deste clã → esconde o botão
    invitedYou: boolean; // o clã convidou o viewer → botão "aceitar convite"
    requestSent: boolean; // o viewer já pediu entrada → botão "remover pedido"
}

/** Full clan-details window (read-only view of any clan). Wraps ONE ClanModel (layout próprio). */
export class ShowForeignClanWindowPacket extends BasePacket {
    constructor(private readonly clan: ClanView, private readonly viewer: ForeignClanViewerFlags) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer {
        const c = this.clan;
        return encodeBody(defs.clan.ShowForeignClanWindow, {
            blocked: c.blocked, creationDate: c.clanId.readBigInt64BE(0), founder: c.leader, description: c.description, recruiting: c.recruiting,
            maxMembers: CLAN_MAX_MEMBERS, joinHidden: this.viewer.joinHidden, minRank: c.minRank, name: c.name, blockReason: c.blockReason || null,
            invitedYou: this.viewer.invitedYou, requestSent: this.viewer.requestSent, tag: c.tag,
            members: c.members.map(memberModel), logo: c.logo, score: c.rating,
        });
    }
    static getId(): number { return defs.clan.ShowForeignClanWindow.id; }
}

/** C->S: open the clan missions tab. Empty body. */
export const OpenClanMissionsPacket = packetClass(defs.clan.OpenClanMissions);
export type OpenClanMissionsPacket = InstanceType<typeof OpenClanMissionsPacket>;

/** S->C: the clan mission list (also pushed on progress change). */
export class ShowClanMissionsPacket extends BasePacket {
    constructor(private readonly missions: ClanMissionView[]) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer {
        return encodeBody(defs.clan.ShowClanMissions, {
            missions: this.missions.map((m) => ({
                id: m.id, icon: m.icon, description: m.description,
                prizes: m.prizes.map((p) => ({ count: p.count, name: p.name })),
                criteria: m.criteria, progress: m.progress, secondsToReset: m.secondsToReset, completed: m.completed,
            })),
        });
    }
    static getId(): number { return defs.clan.ShowClanMissions.id; }
}
