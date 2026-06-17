import { BasePacket } from "@/packets/base.packet";
import { PacketSchema, readSchema, writeSchema } from "@/packets/packet-schema";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import * as BattleTypes from "./battle.types";

export class BattleChatMessagePacket extends BasePacket implements BattleTypes.IBattleChatMessage {
    static readonly schema: PacketSchema = [
        { name: "nickname", type: "string" },
        { name: "message", type: "string" },
        { name: "team", type: "i32" },
    ];
    nickname: string | null;
    message: string | null;
    team: number;
    constructor(data?: BattleTypes.IBattleChatMessageData) { super(); this.nickname = data?.nickname ?? null; this.message = data?.message ?? null; this.team = data?.team ?? 2; }
    read(buffer: Buffer): void { readSchema(this, BattleChatMessagePacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, BattleChatMessagePacket.schema); }
    static getId(): number { return 1259981343; }
}

export class BattleChatTeamMessagePacket extends BasePacket implements BattleTypes.IBattleChatMessage {
    static readonly schema: PacketSchema = [
        { name: "nickname", type: "string" },
        { name: "message", type: "string" },
        { name: "team", type: "i32" },
    ];
    nickname: string | null;
    message: string | null;
    team: number;
    constructor(data?: BattleTypes.IBattleChatMessageData) { super(); this.nickname = data?.nickname ?? null; this.message = data?.message ?? null; this.team = data?.team ?? 2; }
    read(buffer: Buffer): void { readSchema(this, BattleChatTeamMessagePacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, BattleChatTeamMessagePacket.schema); }
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
    static readonly schema: PacketSchema = [
        { name: "message", type: "string" },
        { name: "team", type: "bool" },
    ];
    message: string | null; team: boolean;
    constructor(message: string | null = null, team: boolean = false) { super(); this.message = message; this.team = team; }
    read(buffer: Buffer): void { readSchema(this, SendBattleChatMessagePacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, SendBattleChatMessagePacket.schema); }
    static getId(): number { return 945463181; }
}

export class TimeCheckerPacket extends BasePacket implements BattleTypes.ITimeChecker {
    static readonly schema: PacketSchema = [
        { name: "value1", type: "i32" },
        { name: "value2", type: "i32" },
    ];
    value1: number; value2: number;
    constructor(value1: number = 0, value2: number = 0) { super(); this.value1 = value1; this.value2 = value2; }
    read(buffer: Buffer): void { readSchema(this, TimeCheckerPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, TimeCheckerPacket.schema); }
    static getId(): number { return 34068208; }
}

export class TimeCheckerResponsePacket extends BasePacket implements BattleTypes.ITimeCheckerResponse {
    static readonly schema: PacketSchema = [
        { name: "clientTime", type: "i32" },
        { name: "serverTime", type: "i32" },
    ];
    clientTime: number; serverTime: number;
    constructor(clientTime: number = 0, serverTime: number = 0) { super(); this.clientTime = clientTime; this.serverTime = serverTime; }
    read(buffer: Buffer): void { readSchema(this, TimeCheckerResponsePacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, TimeCheckerResponsePacket.schema); }
    static getId(): number { return 2074243318; }
}

export class UpdateBattleUserDMPacket extends BasePacket implements BattleTypes.IUpdateBattleUserDM {
    static readonly schema: PacketSchema = [
        { name: "deaths", type: "i16" },
        { name: "kills", type: "i16" },
        { name: "score", type: "i32" },
        { name: "nickname", type: "string" },
    ];
    deaths: number; kills: number; score: number; nickname: string | null;
    constructor(data?: BattleTypes.IUpdateBattleUserDMData) { super(); this.deaths = data?.deaths ?? 0; this.kills = data?.kills ?? 0; this.score = data?.score ?? 0; this.nickname = data?.nickname ?? null; }
    read(buffer: Buffer): void { readSchema(this, UpdateBattleUserDMPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, UpdateBattleUserDMPacket.schema); }
    static getId(): number { return 696140460; }
}

export class UpdateBattleUserTeamPacket extends BasePacket implements BattleTypes.IUpdateBattleUserTeam {
    static readonly schema: PacketSchema = [
        { name: "deaths", type: "i16" },
        { name: "kills", type: "i16" },
        { name: "score", type: "i32" },
        { name: "nickname", type: "string" },
        { name: "team", type: "i32" },
    ];
    deaths: number; kills: number; score: number; nickname: string | null; team: number;
    constructor(data?: BattleTypes.IUpdateBattleUserTeamData) { super(); this.deaths = data?.deaths ?? 0; this.kills = data?.kills ?? 0; this.score = data?.score ?? 0; this.nickname = data?.nickname ?? null; this.team = data?.team ?? 2; }
    read(buffer: Buffer): void { readSchema(this, UpdateBattleUserTeamPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, UpdateBattleUserTeamPacket.schema); }
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
    static readonly schema: PacketSchema = [
        { name: "nickname", type: "string" },
        { name: "usersInfo", type: "list", of: [
            { name: "ChatModeratorLevel", type: "i32" },
            { name: "deaths", type: "i16" },
            { name: "kills", type: "i16" },
            { name: "rank", type: "u8" },
            { name: "score", type: "i32" },
            { name: "nickname", type: "string" },
        ] },
    ];
    nickname: string | null; usersInfo: BattleTypes.IBattleUserInfo[];
    constructor(nickname: string | null, usersInfo: BattleTypes.IBattleUserInfo[]) { super(); this.nickname = nickname; this.usersInfo = usersInfo; }
    read(buffer: Buffer): void { readSchema(this, UserConnectDMPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, UserConnectDMPacket.schema); }
    static getId(): number { return 862913394; }
}

export class UserDisconnectedDmPacket extends BasePacket implements BattleTypes.IUserDisconnectedDm {
    nickname: string | null;
    constructor(nickname: string | null = null) { super(); this.nickname = nickname; }
    read(buffer: Buffer): void { this.nickname = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.nickname).getBuffer(); }
    static getId(): number { return -1689876764; }
}
