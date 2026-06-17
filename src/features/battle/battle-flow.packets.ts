import { BasePacket } from "@/packets/base.packet";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import * as BattleTypes from "./battle.types";

export class BattleChatMessagePacket extends BasePacket implements BattleTypes.IBattleChatMessage {
    nickname: string | null;
    message: string | null;
    team: number;
    constructor(data?: BattleTypes.IBattleChatMessageData) { super(); this.nickname = data?.nickname ?? null; this.message = data?.message ?? null; this.team = data?.team ?? 2; }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.nickname = r.readOptionalString(); this.message = r.readOptionalString(); this.team = r.readInt32BE(); }
    write(): Buffer { const w = new BufferWriter(); w.writeOptionalString(this.nickname); w.writeOptionalString(this.message); w.writeInt32BE(this.team); return w.getBuffer(); }
    static getId(): number { return 1259981343; }
}

export class BattleChatTeamMessagePacket extends BasePacket implements BattleTypes.IBattleChatMessage {
    nickname: string | null;
    message: string | null;
    team: number;
    constructor(data?: BattleTypes.IBattleChatMessageData) { super(); this.nickname = data?.nickname ?? null; this.message = data?.message ?? null; this.team = data?.team ?? 2; }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.nickname = r.readOptionalString(); this.message = r.readOptionalString(); this.team = r.readInt32BE(); }
    write(): Buffer { const w = new BufferWriter(); w.writeOptionalString(this.nickname); w.writeOptionalString(this.message); w.writeInt32BE(this.team); return w.getBuffer(); }
    static getId(): number { return -449356094; }
}

export class EnterBattlePacket extends BasePacket implements BattleTypes.IEnterBattle {
    battleTeam: number = 0;
    read(buffer: Buffer): void { this.battleTeam = new BufferReader(buffer).readInt32BE(); }
    write(): Buffer { return new BufferWriter().writeInt32BE(this.battleTeam).getBuffer(); }
    static getId(): number { return -1284211503; }
}

export class EnterBattleAsSpectatorPacket extends BasePacket implements BattleTypes.IEnterBattleAsSpectator {
    read(buffer: Buffer): void { }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return -1315002220; }
}

export class EquipmentChangedPacket extends BasePacket implements BattleTypes.IEquipmentChanged {
    nickname: string | null;
    constructor(nickname: string | null = null) { super(); this.nickname = nickname; }
    read(buffer: Buffer): void { this.nickname = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.nickname).getBuffer(); }
    static getId(): number { return -1767633906; }
}

export class ExitFromBattlePacket extends BasePacket implements BattleTypes.IExitFromBattle {
    layout: number = 0;
    read(buffer: Buffer): void { this.layout = new BufferReader(buffer).readInt32BE(); }
    write(): Buffer { return new BufferWriter().writeInt32BE(this.layout).getBuffer(); }
    static getId(): number { return 377959142; }
}

export class SendBattleChatMessagePacket extends BasePacket implements BattleTypes.ISendBattleChatMessage {
    message: string | null; team: boolean;
    constructor(message: string | null = null, team: boolean = false) { super(); this.message = message; this.team = team; }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.message = r.readOptionalString(); this.team = r.readUInt8() === 1; }
    write(): Buffer { const w = new BufferWriter(); w.writeOptionalString(this.message); w.writeUInt8(this.team ? 1 : 0); return w.getBuffer(); }
    static getId(): number { return 945463181; }
}

export class TimeCheckerPacket extends BasePacket implements BattleTypes.ITimeChecker {
    value1: number; value2: number;
    constructor(value1: number = 0, value2: number = 0) { super(); this.value1 = value1; this.value2 = value2; }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.value1 = r.readInt32BE(); this.value2 = r.readInt32BE(); }
    write(): Buffer { const w = new BufferWriter(); w.writeInt32BE(this.value1); w.writeInt32BE(this.value2); return w.getBuffer(); }
    static getId(): number { return 34068208; }
}

export class TimeCheckerResponsePacket extends BasePacket implements BattleTypes.ITimeCheckerResponse {
    clientTime: number; serverTime: number;
    constructor(clientTime: number = 0, serverTime: number = 0) { super(); this.clientTime = clientTime; this.serverTime = serverTime; }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.clientTime = r.readInt32BE(); this.serverTime = r.readInt32BE(); }
    write(): Buffer { const w = new BufferWriter(); w.writeInt32BE(this.clientTime); w.writeInt32BE(this.serverTime); return w.getBuffer(); }
    static getId(): number { return 2074243318; }
}

export class UpdateBattleUserDMPacket extends BasePacket implements BattleTypes.IUpdateBattleUserDM {
    deaths: number; kills: number; score: number; nickname: string | null;
    constructor(data?: BattleTypes.IUpdateBattleUserDMData) { super(); this.deaths = data?.deaths ?? 0; this.kills = data?.kills ?? 0; this.score = data?.score ?? 0; this.nickname = data?.nickname ?? null; }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.deaths = r.readInt16BE(); this.kills = r.readInt16BE(); this.score = r.readInt32BE(); this.nickname = r.readOptionalString(); }
    write(): Buffer { const w = new BufferWriter(); w.writeInt16BE(this.deaths); w.writeInt16BE(this.kills); w.writeInt32BE(this.score); w.writeOptionalString(this.nickname); return w.getBuffer(); }
    static getId(): number { return 696140460; }
}

export class UpdateBattleUserTeamPacket extends BasePacket implements BattleTypes.IUpdateBattleUserTeam {
    deaths: number; kills: number; score: number; nickname: string | null; team: number;
    constructor(data?: BattleTypes.IUpdateBattleUserTeamData) { super(); this.deaths = data?.deaths ?? 0; this.kills = data?.kills ?? 0; this.score = data?.score ?? 0; this.nickname = data?.nickname ?? null; this.team = data?.team ?? 2; }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.deaths = r.readInt16BE(); this.kills = r.readInt16BE(); this.score = r.readInt32BE(); this.nickname = r.readOptionalString(); this.team = r.readInt32BE(); }
    write(): Buffer { const w = new BufferWriter(); w.writeInt16BE(this.deaths); w.writeInt16BE(this.kills); w.writeInt32BE(this.score); w.writeOptionalString(this.nickname); w.writeInt32BE(this.team); return w.getBuffer(); }
    static getId(): number { return -497293992; }
}

export class UpdateSpectatorListPacket extends BasePacket implements BattleTypes.IUpdateSpectatorList {
    spectatorList: string | null;
    constructor(spectatorList: string | null = null) { super(); this.spectatorList = spectatorList; }
    read(buffer: Buffer): void { this.spectatorList = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.spectatorList).getBuffer(); }
    static getId(): number { return -1331361684; }
}

export class UserConnectDMPacket extends BasePacket implements BattleTypes.IUserConnectDM {
    nickname: string | null; usersInfo: BattleTypes.IBattleUserInfo[];
    constructor(nickname: string | null, usersInfo: BattleTypes.IBattleUserInfo[]) { super(); this.nickname = nickname; this.usersInfo = usersInfo; }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.nickname = r.readOptionalString(); const c = r.readInt32BE(); this.usersInfo = []; for (let i = 0; i < c; i++) { this.usersInfo.push({ ChatModeratorLevel: r.readInt32BE(), deaths: r.readInt16BE(), kills: r.readInt16BE(), rank: r.readUInt8(), score: r.readInt32BE(), nickname: r.readOptionalString() }); } }
    write(): Buffer { const w = new BufferWriter(); w.writeOptionalString(this.nickname); w.writeInt32BE(this.usersInfo.length); for (const u of this.usersInfo) { w.writeInt32BE(u.ChatModeratorLevel); w.writeInt16BE(u.deaths); w.writeInt16BE(u.kills); w.writeUInt8(u.rank); w.writeInt32BE(u.score); w.writeOptionalString(u.nickname); } return w.getBuffer(); }
    static getId(): number { return 862913394; }
}

export class UserDisconnectedDmPacket extends BasePacket implements BattleTypes.IUserDisconnectedDm {
    nickname: string | null;
    constructor(nickname: string | null = null) { super(); this.nickname = nickname; }
    read(buffer: Buffer): void { this.nickname = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.nickname).getBuffer(); }
    static getId(): number { return -1689876764; }
}
