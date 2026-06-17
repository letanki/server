import { BasePacket } from "@/packets/base.packet";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import * as BattleTypes from "./battle.types";

export class TakeFlagPacket extends BasePacket implements BattleTypes.ITakeFlag {
    nickname: string | null;
    team: number;
    constructor(nickname: string | null = null, team: number = 0) { super(); this.nickname = nickname; this.team = team; }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.nickname = r.readOptionalString(); this.team = r.readInt32BE(); }
    write(): Buffer { const w = new BufferWriter(); w.writeOptionalString(this.nickname); w.writeInt32BE(this.team); return w.getBuffer(); }
    static getId(): number { return -1282406496; }
}

export class DropFlagRequestPacket extends BasePacket implements BattleTypes.IDropFlagRequest {
    read(buffer: Buffer): void { }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return -1832611824; }
}

export class DropFlagPacket extends BasePacket implements BattleTypes.IDropFlag {
    position: BattleTypes.IVector3 | null;
    team: number;
    constructor(position: BattleTypes.IVector3 | null = null, team: number = 0) { super(); this.position = position; this.team = team; }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.position = r.readOptionalVector3(); this.team = r.readInt32BE(); }
    write(): Buffer { const w = new BufferWriter(); w.writeOptionalVector3(this.position); w.writeInt32BE(this.team); return w.getBuffer(); }
    static getId(): number { return 1925237062; }
}

export class ReturnFlagPacket extends BasePacket implements BattleTypes.IReturnFlag {
    team: number;
    nickname: string | null;
    constructor(data?: BattleTypes.IReturnFlagData) {
        super();
        this.team = data?.team ?? 0;
        this.nickname = data?.nickname ?? null;
    }
    read(buffer: Buffer): void {
        const r = new BufferReader(buffer);
        this.team = r.readInt32BE();
        this.nickname = r.readOptionalString();
    }
    write(): Buffer {
        const w = new BufferWriter();
        w.writeInt32BE(this.team);
        w.writeOptionalString(this.nickname);
        return w.getBuffer();
    }
    static getId(): number {
        return -1026428589;
    }
}

export class CaptureFlagPacket extends BasePacket implements BattleTypes.ICaptureFlag {
    team: number;
    nickname: string | null;
    constructor(data?: BattleTypes.ICaptureFlagData) {
        super();
        this.team = data?.team ?? 0;
        this.nickname = data?.nickname ?? null;
    }
    read(buffer: Buffer): void {
        const r = new BufferReader(buffer);
        this.team = r.readInt32BE();
        this.nickname = r.readOptionalString();
    }
    write(): Buffer {
        const w = new BufferWriter();
        w.writeInt32BE(this.team);
        w.writeOptionalString(this.nickname);
        return w.getBuffer();
    }
    static getId(): number {
        return -1870108387;
    }
}
