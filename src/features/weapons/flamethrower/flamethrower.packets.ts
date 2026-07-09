import { BasePacket } from "@/packets/base.packet";
import { defs } from "protanki-protocol";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import * as FlamethrowerTypes from "./flamethrower.types";

/**
 * C→S: a Firebird flame tick. The flame cone can touch SEVERAL tanks at once, so the body carries parallel
 * arrays: clientTime(i32), targets(Vector<String>), then Vector<short> (per-target incarnation) and two
 * Vector<Vector3> (origin + hit position) we don't need. Sent ~2/s while the flame touches anyone. We pull
 * the full target list — the old single-target read only ever saw the first nick, so only one tank burned.
 */
export class FirebirdHitCommandPacket extends BasePacket {
    public targets: string[] = [];
    public read(buffer: Buffer): void {
        const r = new BufferReader(buffer);
        try {
            r.readInt32BE();                 // clientTime
            this.targets = r.readStringArray();
        } catch { this.targets = []; }
    }
    public write(): Buffer { throw new Error("This is a client-to-server packet only."); }
    public static getId(): number { return defs.weapons.FirebirdHitCommand.id; }
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
        return defs.weapons.StartShootingFlamethrowerCommand.id;
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
        return defs.weapons.StartShootingFlamethrower.id;
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
        return defs.weapons.StopShootingFlamethrowerCommand.id;
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
        return defs.weapons.StopShootingFlamethrower.id;
    }
}