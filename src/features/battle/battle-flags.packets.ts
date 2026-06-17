import { BasePacket } from "@/packets/base.packet";
import { PacketSchema, readSchema, writeSchema } from "@/packets/packet-schema";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import * as BattleTypes from "./battle.types";

export class TakeFlagPacket extends BasePacket implements BattleTypes.ITakeFlag {
    static readonly schema: PacketSchema = [
        { name: "nickname", type: "string" },
        { name: "team", type: "i32" },
    ];
    nickname: string | null;
    team: number;
    constructor(nickname: string | null = null, team: number = 0) { super(); this.nickname = nickname; this.team = team; }
    read(buffer: Buffer): void { readSchema(this, TakeFlagPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, TakeFlagPacket.schema); }
    static getId(): number { return -1282406496; }
}

export class DropFlagRequestPacket extends BasePacket implements BattleTypes.IDropFlagRequest {
    read(buffer: Buffer): void { }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return -1832611824; }
}

export class DropFlagPacket extends BasePacket implements BattleTypes.IDropFlag {
    static readonly schema: PacketSchema = [
        { name: "position", type: "vector3" },
        { name: "team", type: "i32" },
    ];
    position: BattleTypes.IVector3 | null;
    team: number;
    constructor(position: BattleTypes.IVector3 | null = null, team: number = 0) { super(); this.position = position; this.team = team; }
    read(buffer: Buffer): void { readSchema(this, DropFlagPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, DropFlagPacket.schema); }
    static getId(): number { return 1925237062; }
}

export class ReturnFlagPacket extends BasePacket implements BattleTypes.IReturnFlag {
    static readonly schema: PacketSchema = [
        { name: "team", type: "i32" },
        { name: "nickname", type: "string" },
    ];
    team: number;
    nickname: string | null;
    constructor(data?: BattleTypes.IReturnFlagData) {
        super();
        this.team = data?.team ?? 0;
        this.nickname = data?.nickname ?? null;
    }
    read(buffer: Buffer): void { readSchema(this, ReturnFlagPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, ReturnFlagPacket.schema); }
    static getId(): number {
        return -1026428589;
    }
}

// Sent after a CTF capture to update the capturing team's flag score (red = 0, blue = 1).
export class SetCtfScorePacket extends BasePacket {
    static readonly schema: PacketSchema = [
        { name: "team", type: "i32" },
        { name: "score", type: "i32" },
    ];
    team: number;
    score: number;
    constructor(team: number = 0, score: number = 0) { super(); this.team = team; this.score = score; }
    read(buffer: Buffer): void { readSchema(this, SetCtfScorePacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, SetCtfScorePacket.schema); }
    static getId(): number { return 561771020; }
}

export class CaptureFlagPacket extends BasePacket implements BattleTypes.ICaptureFlag {
    static readonly schema: PacketSchema = [
        { name: "team", type: "i32" },
        { name: "nickname", type: "string" },
    ];
    team: number;
    nickname: string | null;
    constructor(data?: BattleTypes.ICaptureFlagData) {
        super();
        this.team = data?.team ?? 0;
        this.nickname = data?.nickname ?? null;
    }
    read(buffer: Buffer): void { readSchema(this, CaptureFlagPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, CaptureFlagPacket.schema); }
    static getId(): number {
        return -1870108387;
    }
}
