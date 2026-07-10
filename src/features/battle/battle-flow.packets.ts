import { BasePacket } from "@/packets/base.packet";
import { readSchema, writeSchema } from "@/packets/packet-schema";
import { packetClass } from "@/packets/packet-class";
import { defs } from "protanki-protocol";
import * as BattleTypes from "./battle.types";

// IDs e schemas em `protanki-protocol` (defs.battle.*). Corpos read/write com codec
// manual são mantidos verbatim; só id/schema referenciam a lib.

export class BattleChatMessagePacket extends BasePacket implements BattleTypes.IBattleChatMessage {
    static readonly schema = defs.battle.BattleChatMessage.schema!;
    nickname: string | null;
    message: string | null;
    team: number;
    constructor(data?: BattleTypes.IBattleChatMessageData) { super(); this.nickname = data?.nickname ?? null; this.message = data?.message ?? null; this.team = data?.team ?? 2; }
    read(buffer: Buffer): void { readSchema(this, BattleChatMessagePacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, BattleChatMessagePacket.schema); }
    static getId(): number { return defs.battle.BattleChatMessage.id; }
}

export class BattleChatTeamMessagePacket extends BasePacket implements BattleTypes.IBattleChatMessage {
    static readonly schema = defs.battle.BattleChatTeamMessage.schema!;
    nickname: string | null;
    message: string | null;
    team: number;
    constructor(data?: BattleTypes.IBattleChatMessageData) { super(); this.nickname = data?.nickname ?? null; this.message = data?.message ?? null; this.team = data?.team ?? 2; }
    read(buffer: Buffer): void { readSchema(this, BattleChatTeamMessagePacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, BattleChatTeamMessagePacket.schema); }
    static getId(): number { return defs.battle.BattleChatTeamMessage.id; }
}

export const EnterBattlePacket = packetClass(defs.battle.EnterBattle);
export type EnterBattlePacket = InstanceType<typeof EnterBattlePacket>;

/**
 * Server→client: refuses a battle join because the player's equipment doesn't satisfy the battle's
 * equipment-constraint mode (XP/BP — hornet/wasp + railgun >= m2). Body = optionalString(battleId) of
 * the battle the player tried to enter; the client keeps the player in the lobby and shows the
 * "equipment not allowed" message. Captured from the official server (id -10847382).
 */
export const EquipmentNotAllowedPacket = packetClass(defs.battle.EquipmentNotAllowed);
export type EquipmentNotAllowedPacket = InstanceType<typeof EquipmentNotAllowedPacket>;

/**
 * Server→client: SYSTEM message line in the battle chat (id 606668848, body = optionalString(message)).
 * Confirmed IN-GAME (2026-07-06): renders as a system notice — the right channel for command replies,
 * /broadcast, /msg and any server→player notice while in a battle.
 */
export const BattleSystemMessagePacket = packetClass(defs.battle.BattleSystemMessage);
export type BattleSystemMessagePacket = InstanceType<typeof BattleSystemMessagePacket>;

/**
 * Server→client: a SPECTATOR chat line (id 1532749363, body = optionalString(uid) + optionalString
 * (message)). The client renders it with the yellow "Espectador:" (SPECTATOR_NAME) prefix — the line
 * ctor receives isSpectator=true — so this is how the OFFICIAL relays spectator messages, NOT a generic
 * system channel (a first read mistook it for one; staff text should use the nickname-null
 * BattleChatMessagePacket instead). Kept for a future spectator-chat rework (see spectator-chat memory).
 */
export const BattleSpectatorMessagePacket = packetClass(defs.battle.BattleSpectatorMessage);
export type BattleSpectatorMessagePacket = InstanceType<typeof BattleSpectatorMessagePacket>;

export const EnterBattleAsSpectatorPacket = packetClass(defs.battle.EnterBattleAsSpectator);
export type EnterBattleAsSpectatorPacket = InstanceType<typeof EnterBattleAsSpectatorPacket>;

export const EquipmentChangedPacket = packetClass(defs.battle.EquipmentChanged);
export type EquipmentChangedPacket = InstanceType<typeof EquipmentChangedPacket>;

export const ExitFromBattlePacket = packetClass(defs.battle.ExitFromBattle);
export type ExitFromBattlePacket = InstanceType<typeof ExitFromBattlePacket>;

export const SendBattleChatMessagePacket = packetClass(defs.battle.SendBattleChatMessage);
export type SendBattleChatMessagePacket = InstanceType<typeof SendBattleChatMessagePacket>;

export const TimeCheckerPacket = packetClass(defs.battle.TimeChecker);
export type TimeCheckerPacket = InstanceType<typeof TimeCheckerPacket>;

export const TimeCheckerResponsePacket = packetClass(defs.battle.TimeCheckerResponse);
export type TimeCheckerResponsePacket = InstanceType<typeof TimeCheckerResponsePacket>;

export class UpdateBattleUserDMPacket extends BasePacket implements BattleTypes.IUpdateBattleUserDM {
    static readonly schema = defs.battle.UpdateBattleUserDM.schema!;
    deaths: number; kills: number; score: number; nickname: string | null;
    constructor(data?: BattleTypes.IUpdateBattleUserDMData) { super(); this.deaths = data?.deaths ?? 0; this.kills = data?.kills ?? 0; this.score = data?.score ?? 0; this.nickname = data?.nickname ?? null; }
    read(buffer: Buffer): void { readSchema(this, UpdateBattleUserDMPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, UpdateBattleUserDMPacket.schema); }
    static getId(): number { return defs.battle.UpdateBattleUserDM.id; }
}

export class UpdateBattleUserTeamPacket extends BasePacket implements BattleTypes.IUpdateBattleUserTeam {
    static readonly schema = defs.battle.UpdateBattleUserTeam.schema!;
    deaths: number; kills: number; score: number; nickname: string | null; team: number;
    constructor(data?: BattleTypes.IUpdateBattleUserTeamData) { super(); this.deaths = data?.deaths ?? 0; this.kills = data?.kills ?? 0; this.score = data?.score ?? 0; this.nickname = data?.nickname ?? null; this.team = data?.team ?? 2; }
    read(buffer: Buffer): void { readSchema(this, UpdateBattleUserTeamPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, UpdateBattleUserTeamPacket.schema); }
    static getId(): number { return defs.battle.UpdateBattleUserTeam.id; }
}

export const UpdateSpectatorListPacket = packetClass(defs.battle.UpdateSpectatorList);
export type UpdateSpectatorListPacket = InstanceType<typeof UpdateSpectatorListPacket>;

export const UserConnectDMPacket = packetClass(defs.battle.UserConnectDM);
export type UserConnectDMPacket = InstanceType<typeof UserConnectDMPacket>;

// Team-battle variant of UserConnectDM: registers a joining player (and the user list)
// in the existing players' team statistics model. Identical to the DM packet plus a
// per-user `team` field. Sending the DM variant in a team battle crashes with #1009.
// Per the client model: nickname (joiner) + Vector<entry> + a SINGLE trailing team (the joiner's
// team). `usersInfo` is the joiner's whole team column (entries have NO per-entry team); the client
// rebuilds that team's column from it. (A per-entry team only coincides for a 1-entry list and
// corrupts 2+ entries → the same-team join bug.)
export const UserConnectTeamPacket = packetClass(defs.battle.UserConnectTeam);
export type UserConnectTeamPacket = InstanceType<typeof UserConnectTeamPacket>;

export const UserDisconnectedDmPacket = packetClass(defs.battle.UserDisconnectedDm);
export type UserDisconnectedDmPacket = InstanceType<typeof UserDisconnectedDmPacket>;

// ===== Battle invite system =====

// C->S: a player invites another to their battle.
export const SendBattleInvitePacket = packetClass(defs.battle.SendBattleInvite);
export type SendBattleInvitePacket = InstanceType<typeof SendBattleInvitePacket>;

// S->C: the invite popup shown to the invited player.
export const ShowBattleInvitePacket = packetClass(defs.battle.ShowBattleInvite);
export type ShowBattleInvitePacket = InstanceType<typeof ShowBattleInvitePacket>;

// C->S: invited player declines.
export const DeclineBattleInvitePacket = packetClass(defs.battle.DeclineBattleInvite);
export type DeclineBattleInvitePacket = InstanceType<typeof DeclineBattleInvitePacket>;

// S->C: tells the inviter their invite was declined (by `targetNickname`).
export const BattleInviteDeclinedPacket = packetClass(defs.battle.BattleInviteDeclined);
export type BattleInviteDeclinedPacket = InstanceType<typeof BattleInviteDeclinedPacket>;

// C->S: invited player accepts.
export const AcceptBattleInvitePacket = packetClass(defs.battle.AcceptBattleInvite);
export type AcceptBattleInvitePacket = InstanceType<typeof AcceptBattleInvitePacket>;

// S->C: tells the inviter their invite was accepted (by `targetNickname`).
export const BattleInviteAcceptedPacket = packetClass(defs.battle.BattleInviteAccepted);
export type BattleInviteAcceptedPacket = InstanceType<typeof BattleInviteAcceptedPacket>;

// C->S: invited player asks to enter the battle (handshake before RequestBattleByLink).
export const RequestBattleEntrancePacket = packetClass(defs.battle.RequestBattleEntrance);
export type RequestBattleEntrancePacket = InstanceType<typeof RequestBattleEntrancePacket>;

// S->C: acks the entrance request so the client proceeds to open the battle.
export const BattleEntranceAckPacket = packetClass(defs.battle.BattleEntranceAck);
export type BattleEntranceAckPacket = InstanceType<typeof BattleEntranceAckPacket>;

// Team-battle variant of the "user left battle" notification (removes the player from
// the existing players' team statistics list / shows "X left"). DM uses -1689876764.
export const UserDisconnectTeamPacket = packetClass(defs.battle.UserDisconnectTeam);
export type UserDisconnectTeamPacket = InstanceType<typeof UserDisconnectTeamPacket>;
