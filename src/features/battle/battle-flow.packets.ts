import { BasePacket } from "@/packets/base.packet";
import { readSchema, writeSchema } from "@/packets/packet-schema";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
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

export class EnterBattlePacket extends BasePacket implements BattleTypes.IEnterBattle {
    battleTeam: number = 0;
    read(buffer: Buffer): void { this.battleTeam = new BufferReader(buffer).readInt32BE(); }
    write(): Buffer { return new BufferWriter().writeInt32BE(this.battleTeam).getBuffer(); }
    static getId(): number { return defs.battle.EnterBattle.id; }
}

/**
 * Server→client: refuses a battle join because the player's equipment doesn't satisfy the battle's
 * equipment-constraint mode (XP/BP — hornet/wasp + railgun >= m2). Body = optionalString(battleId) of
 * the battle the player tried to enter; the client keeps the player in the lobby and shows the
 * "equipment not allowed" message. Captured from the official server (id -10847382).
 */
export class EquipmentNotAllowedPacket extends BasePacket {
    constructor(private readonly battleId: string | null = null) { super(); }
    read(): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.battleId).getBuffer(); }
    static getId(): number { return defs.battle.EquipmentNotAllowed.id; }
}

/**
 * Server→client: SYSTEM message line in the battle chat (id 606668848, body = optionalString(message)).
 * Confirmed IN-GAME (2026-07-06): renders as a system notice — the right channel for command replies,
 * /broadcast, /msg and any server→player notice while in a battle.
 */
export class BattleSystemMessagePacket extends BasePacket {
    constructor(private readonly message: string | null = null) { super(); }
    read(): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.message).getBuffer(); }
    static getId(): number { return defs.battle.BattleSystemMessage.id; }
}

/**
 * Server→client: a SPECTATOR chat line (id 1532749363, body = optionalString(uid) + optionalString
 * (message)). The client renders it with the yellow "Espectador:" (SPECTATOR_NAME) prefix — the line
 * ctor receives isSpectator=true — so this is how the OFFICIAL relays spectator messages, NOT a generic
 * system channel (a first read mistook it for one; staff text should use the nickname-null
 * BattleChatMessagePacket instead). Kept for a future spectator-chat rework (see spectator-chat memory).
 */
export class BattleSpectatorMessagePacket extends BasePacket {
    constructor(private readonly message: string | null = null, private readonly uid: string | null = "") { super(); }
    read(): void {}
    write(): Buffer { return new BufferWriter().writeOptionalString(this.uid).writeOptionalString(this.message).getBuffer(); }
    static getId(): number { return defs.battle.BattleSpectatorMessage.id; }
}

export class EnterBattleAsSpectatorPacket extends BasePacket implements BattleTypes.IEnterBattleAsSpectator {
    read(buffer: Buffer): void { }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.battle.EnterBattleAsSpectator.id; }
}

export class EquipmentChangedPacket extends BasePacket implements BattleTypes.IEquipmentChanged {
    nickname: string | null;
    constructor(nickname: string | null = null) { super(); this.nickname = nickname; }
    read(buffer: Buffer): void { this.nickname = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.nickname).getBuffer(); }
    static getId(): number { return defs.battle.EquipmentChanged.id; }
}

export class ExitFromBattlePacket extends BasePacket implements BattleTypes.IExitFromBattle {
    layout: number = 0;
    read(buffer: Buffer): void { this.layout = new BufferReader(buffer).readInt32BE(); }
    write(): Buffer { return new BufferWriter().writeInt32BE(this.layout).getBuffer(); }
    static getId(): number { return defs.battle.ExitFromBattle.id; }
}

export class SendBattleChatMessagePacket extends BasePacket implements BattleTypes.ISendBattleChatMessage {
    static readonly schema = defs.battle.SendBattleChatMessage.schema!;
    message: string | null; team: boolean;
    constructor(message: string | null = null, team: boolean = false) { super(); this.message = message; this.team = team; }
    read(buffer: Buffer): void { readSchema(this, SendBattleChatMessagePacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, SendBattleChatMessagePacket.schema); }
    static getId(): number { return defs.battle.SendBattleChatMessage.id; }
}

export class TimeCheckerPacket extends BasePacket implements BattleTypes.ITimeChecker {
    static readonly schema = defs.battle.TimeChecker.schema!;
    value1: number; value2: number;
    constructor(value1: number = 0, value2: number = 0) { super(); this.value1 = value1; this.value2 = value2; }
    read(buffer: Buffer): void { readSchema(this, TimeCheckerPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, TimeCheckerPacket.schema); }
    static getId(): number { return defs.battle.TimeChecker.id; }
}

export class TimeCheckerResponsePacket extends BasePacket implements BattleTypes.ITimeCheckerResponse {
    static readonly schema = defs.battle.TimeCheckerResponse.schema!;
    clientTime: number; serverTime: number;
    constructor(clientTime: number = 0, serverTime: number = 0) { super(); this.clientTime = clientTime; this.serverTime = serverTime; }
    read(buffer: Buffer): void { readSchema(this, TimeCheckerResponsePacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, TimeCheckerResponsePacket.schema); }
    static getId(): number { return defs.battle.TimeCheckerResponse.id; }
}

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

export class UpdateSpectatorListPacket extends BasePacket implements BattleTypes.IUpdateSpectatorList {
    spectatorList: string | null;
    constructor(spectatorList: string | null = null) { super(); this.spectatorList = spectatorList; }
    read(buffer: Buffer): void { this.spectatorList = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.spectatorList).getBuffer(); }
    static getId(): number { return defs.battle.UpdateSpectatorList.id; }
}

export class UserConnectDMPacket extends BasePacket implements BattleTypes.IUserConnectDM {
    static readonly schema = defs.battle.UserConnectDM.schema!;
    nickname: string | null; usersInfo: BattleTypes.IBattleUserInfo[];
    constructor(nickname: string | null, usersInfo: BattleTypes.IBattleUserInfo[]) { super(); this.nickname = nickname; this.usersInfo = usersInfo; }
    read(buffer: Buffer): void { readSchema(this, UserConnectDMPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, UserConnectDMPacket.schema); }
    static getId(): number { return defs.battle.UserConnectDM.id; }
}

// Team-battle variant of UserConnectDM: registers a joining player (and the user list)
// in the existing players' team statistics model. Identical to the DM packet plus a
// per-user `team` field. Sending the DM variant in a team battle crashes with #1009.
// Per the client model: nickname (joiner) + Vector<entry> + a SINGLE trailing team (the joiner's
// team). `usersInfo` is the joiner's whole team column (entries have NO per-entry team); the client
// rebuilds that team's column from it. (A per-entry team only coincides for a 1-entry list and
// corrupts 2+ entries → the same-team join bug.)
export class UserConnectTeamPacket extends BasePacket {
    static readonly schema = defs.battle.UserConnectTeam.schema!;
    nickname: string | null; usersInfo: BattleTypes.IBattleUserInfo[]; team: number;
    constructor(nickname: string | null, usersInfo: BattleTypes.IBattleUserInfo[], team: number = 0) { super(); this.nickname = nickname; this.usersInfo = usersInfo; this.team = team; }
    read(buffer: Buffer): void { readSchema(this, UserConnectTeamPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, UserConnectTeamPacket.schema); }
    static getId(): number { return defs.battle.UserConnectTeam.id; }
}

export class UserDisconnectedDmPacket extends BasePacket implements BattleTypes.IUserDisconnectedDm {
    nickname: string | null;
    constructor(nickname: string | null = null) { super(); this.nickname = nickname; }
    read(buffer: Buffer): void { this.nickname = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.nickname).getBuffer(); }
    static getId(): number { return defs.battle.UserDisconnectedDm.id; }
}

// ===== Battle invite system =====

// C->S: a player invites another to their battle.
export class SendBattleInvitePacket extends BasePacket {
    static readonly schema = defs.battle.SendBattleInvite.schema!;
    targetNickname: string | null = null;
    battleId: string | null = null;
    read(buffer: Buffer): void { readSchema(this, SendBattleInvitePacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, SendBattleInvitePacket.schema); }
    static getId(): number { return defs.battle.SendBattleInvite.id; }
}

// S->C: the invite popup shown to the invited player.
export class ShowBattleInvitePacket extends BasePacket {
    static readonly schema = defs.battle.ShowBattleInvite.schema!;
    inviterNickname: string | null = null;
    flag1 = false; flag2 = false;
    battleId: string | null = null;
    battleName: string | null = null;
    battleMode = 0;
    flag3 = false; flag4 = false;
    constructor(data?: Partial<ShowBattleInvitePacket>) { super(); if (data) Object.assign(this, data); }
    read(buffer: Buffer): void { readSchema(this, ShowBattleInvitePacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, ShowBattleInvitePacket.schema); }
    static getId(): number { return defs.battle.ShowBattleInvite.id; }
}

// C->S: invited player declines.
export class DeclineBattleInvitePacket extends BasePacket {
    inviterNickname: string | null = null;
    read(buffer: Buffer): void { this.inviterNickname = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.inviterNickname).getBuffer(); }
    static getId(): number { return defs.battle.DeclineBattleInvite.id; }
}

// S->C: tells the inviter their invite was declined (by `targetNickname`).
export class BattleInviteDeclinedPacket extends BasePacket {
    targetNickname: string | null;
    constructor(targetNickname: string | null = null) { super(); this.targetNickname = targetNickname; }
    read(buffer: Buffer): void { this.targetNickname = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.targetNickname).getBuffer(); }
    static getId(): number { return defs.battle.BattleInviteDeclined.id; }
}

// C->S: invited player accepts.
export class AcceptBattleInvitePacket extends BasePacket {
    inviterNickname: string | null = null;
    read(buffer: Buffer): void { this.inviterNickname = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.inviterNickname).getBuffer(); }
    static getId(): number { return defs.battle.AcceptBattleInvite.id; }
}

// S->C: tells the inviter their invite was accepted (by `targetNickname`).
export class BattleInviteAcceptedPacket extends BasePacket {
    targetNickname: string | null;
    constructor(targetNickname: string | null = null) { super(); this.targetNickname = targetNickname; }
    read(buffer: Buffer): void { this.targetNickname = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.targetNickname).getBuffer(); }
    static getId(): number { return defs.battle.BattleInviteAccepted.id; }
}

// C->S: invited player asks to enter the battle (handshake before RequestBattleByLink).
export class RequestBattleEntrancePacket extends BasePacket {
    battleId: string | null = null;
    read(buffer: Buffer): void { this.battleId = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.battleId).getBuffer(); }
    static getId(): number { return defs.battle.RequestBattleEntrance.id; }
}

// S->C: acks the entrance request so the client proceeds to open the battle.
export class BattleEntranceAckPacket extends BasePacket {
    battleId: string | null;
    constructor(battleId: string | null = null) { super(); this.battleId = battleId; }
    read(buffer: Buffer): void { this.battleId = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.battleId).getBuffer(); }
    static getId(): number { return defs.battle.BattleEntranceAck.id; }
}

// Team-battle variant of the "user left battle" notification (removes the player from
// the existing players' team statistics list / shows "X left"). DM uses -1689876764.
export class UserDisconnectTeamPacket extends BasePacket {
    nickname: string | null;
    constructor(nickname: string | null = null) { super(); this.nickname = nickname; }
    read(buffer: Buffer): void { this.nickname = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.nickname).getBuffer(); }
    static getId(): number { return defs.battle.UserDisconnectTeam.id; }
}
