import { BasePacket } from "@/packets/base.packet";
import { defs } from "protanki-protocol";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import * as FreezeTypes from "./freeze.types";

/**
 * C→S: a Freeze beam tick. Same shape as the Firebird hit packet (the beam cone can touch several tanks at
 * once): clientTime(i32), targets(Vector<String>), then a Vector<short> + two Vector<Vector3> we don't need.
 * Sent ~2/s while the beam touches anyone.
 */
export class FreezeHitCommandPacket extends BasePacket {
    public targets: string[] = [];
    public read(buffer: Buffer): void {
        const r = new BufferReader(buffer);
        try {
            r.readInt32BE();                 // clientTime
            this.targets = r.readStringArray();
        } catch { this.targets = []; }
    }
    public write(): Buffer { throw new Error("This is a client-to-server packet only."); }
    public static getId(): number { return defs.weapons.FreezeHitCommand.id; }
}

export class StartShootingFreezeCommandPacket extends BasePacket implements FreezeTypes.IStartShootingFreezeCommand {
    public clientTime: number = 0;
    public read(buffer: Buffer): void {
        this.clientTime = new BufferReader(buffer).readInt32BE();
    }
    public write(): Buffer {
        return new BufferWriter().writeInt32BE(this.clientTime).getBuffer();
    }
    public static getId(): number {
        return defs.weapons.StartShootingFreezeCommand.id;
    }
}

export class StartShootingFreezePacket extends BasePacket implements FreezeTypes.IStartShootingFreezePacket {
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
        return defs.weapons.StartShootingFreeze.id;
    }
}

export class StopShootingFreezeCommandPacket extends BasePacket implements FreezeTypes.IStopShootingFreezeCommand {
    public clientTime: number = 0;
    public read(buffer: Buffer): void {
        this.clientTime = new BufferReader(buffer).readInt32BE();
    }
    public write(): Buffer {
        return new BufferWriter().writeInt32BE(this.clientTime).getBuffer();
    }
    public static getId(): number {
        return defs.weapons.StopShootingFreezeCommand.id;
    }
}

export class StopShootingFreezePacket extends BasePacket implements FreezeTypes.IStopShootingFreezePacket {
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
        return defs.weapons.StopShootingFreeze.id;
    }
}