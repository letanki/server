import { BasePacket } from "@/packets/base.packet";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import * as FlamethrowerTypes from "./flamethrower.types";

/**
 * C→S: a Firebird flame tick hit a tank. Body = clientTime, int, byte, target nick (+ trailing hit vecs).
 * Sent repeatedly (~2/s) while the flame touches a target. We only need the target nickname.
 */
export class FirebirdHitCommandPacket extends BasePacket {
    public target: string | null = null;
    public read(buffer: Buffer): void {
        const r = new BufferReader(buffer);
        r.readInt32BE();   // clientTime
        r.readInt32BE();   // unknown
        r.readInt8();      // unknown
        try { this.target = r.readOptionalString(); } catch { this.target = null; }
    }
    public write(): Buffer { throw new Error("This is a client-to-server packet only."); }
    public static getId(): number { return 1395251766; }
}

export class StartShootingFlamethrowerCommandPacket extends BasePacket implements FlamethrowerTypes.IStartShootingFlamethrowerCommand {
    public clientTime: number = 0;
    public read(buffer: Buffer): void {
        this.clientTime = new BufferReader(buffer).readInt32BE();
    }
    public write(): Buffer {
        return new BufferWriter().writeInt32BE(this.clientTime).getBuffer();
    }
    public static getId(): number {
        return -1986638927;
    }
}

export class StartShootingFlamethrowerPacket extends BasePacket implements FlamethrowerTypes.IStartShootingFlamethrowerPacket {
    public nickname: string | null;
    constructor(nickname: string | null = null) {
        super();
        this.nickname = nickname;
    }
    public read(buffer: Buffer): void {
        this.nickname = new BufferReader(buffer).readOptionalString();
    }
    public write(): Buffer {
        return new BufferWriter().writeOptionalString(this.nickname).getBuffer();
    }
    public static getId(): number {
        return 1212381771;
    }
}

export class StopShootingFlamethrowerCommandPacket extends BasePacket implements FlamethrowerTypes.IStopShootingFlamethrowerCommand {
    public clientTime: number = 0;
    public read(buffer: Buffer): void {
        this.clientTime = new BufferReader(buffer).readInt32BE();
    }
    public write(): Buffer {
        return new BufferWriter().writeInt32BE(this.clientTime).getBuffer();
    }
    public static getId(): number {
        return -1300958299;
    }
}

export class StopShootingFlamethrowerPacket extends BasePacket implements FlamethrowerTypes.IStopShootingFlamethrowerPacket {
    public nickname: string | null;
    constructor(nickname: string | null = null) {
        super();
        this.nickname = nickname;
    }
    public read(buffer: Buffer): void {
        this.nickname = new BufferReader(buffer).readOptionalString();
    }
    public write(): Buffer {
        return new BufferWriter().writeOptionalString(this.nickname).getBuffer();
    }
    public static getId(): number {
        return 1333088437;
    }
}