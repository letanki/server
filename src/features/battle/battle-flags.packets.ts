import { BasePacket } from "@/packets/base.packet";
import { readSchema, writeSchema } from "@/packets/packet-schema";
import { defs } from "protanki-protocol";
import * as BattleTypes from "./battle.types";

// IDs e schemas em `protanki-protocol` (defs.battle.*).

export class TakeFlagPacket extends BasePacket implements BattleTypes.ITakeFlag {
    static readonly schema = defs.battle.TakeFlag.schema!;
    nickname: string | null;
    team: number;
    constructor(nickname: string | null = null, team: number = 0) { super(); this.nickname = nickname; this.team = team; }
    read(buffer: Buffer): void { readSchema(this, TakeFlagPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, TakeFlagPacket.schema); }
    static getId(): number { return defs.battle.TakeFlag.id; }
}

export class DropFlagRequestPacket extends BasePacket implements BattleTypes.IDropFlagRequest {
    read(buffer: Buffer): void { }
    write(): Buffer { return writeSchema(this, defs.battle.DropFlagRequest.schema!); }
    static getId(): number { return defs.battle.DropFlagRequest.id; }
}

export class DropFlagPacket extends BasePacket implements BattleTypes.IDropFlag {
    static readonly schema = defs.battle.DropFlag.schema!;
    position: BattleTypes.IVector3 | null;
    team: number;
    constructor(position: BattleTypes.IVector3 | null = null, team: number = 0) { super(); this.position = position; this.team = team; }
    read(buffer: Buffer): void { readSchema(this, DropFlagPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, DropFlagPacket.schema); }
    static getId(): number { return defs.battle.DropFlag.id; }
}

export class ReturnFlagPacket extends BasePacket implements BattleTypes.IReturnFlag {
    static readonly schema = defs.battle.ReturnFlag.schema!;
    team: number;
    nickname: string | null;
    constructor(data?: BattleTypes.IReturnFlagData) {
        super();
        this.team = data?.team ?? 0;
        this.nickname = data?.nickname ?? null;
    }
    read(buffer: Buffer): void { readSchema(this, ReturnFlagPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, ReturnFlagPacket.schema); }
    static getId(): number { return defs.battle.ReturnFlag.id; }
}

// Sent after a CTF capture to update the capturing team's flag score (red = 0, blue = 1).
export class SetCtfScorePacket extends BasePacket {
    static readonly schema = defs.battle.SetCtfScore.schema!;
    team: number;
    score: number;
    constructor(team: number = 0, score: number = 0) { super(); this.team = team; this.score = score; }
    read(buffer: Buffer): void { readSchema(this, SetCtfScorePacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, SetCtfScorePacket.schema); }
    static getId(): number { return defs.battle.SetCtfScore.id; }
}

export class CaptureFlagPacket extends BasePacket implements BattleTypes.ICaptureFlag {
    static readonly schema = defs.battle.CaptureFlag.schema!;
    team: number;
    nickname: string | null;
    constructor(data?: BattleTypes.ICaptureFlagData) {
        super();
        this.team = data?.team ?? 0;
        this.nickname = data?.nickname ?? null;
    }
    read(buffer: Buffer): void { readSchema(this, CaptureFlagPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, CaptureFlagPacket.schema); }
    static getId(): number { return defs.battle.CaptureFlag.id; }
}
