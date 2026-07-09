import { BasePacket } from "@/packets/base.packet";
import { defs } from "protanki-protocol";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import * as RicochetTypes from "./ricochet.types";

export class RicochetShotCommandPacket extends BasePacket implements RicochetTypes.IRicochetShotCommand {
    public clientTime: number = 0;
    public shortId: number = 0;
    public x: number = 0;
    public y: number = 0;
    public z: number = 0;

    public read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        this.clientTime = reader.readInt32BE();
        this.shortId = reader.readInt32BE();
        this.x = reader.readInt16BE();
        this.y = reader.readInt16BE();
        this.z = reader.readInt16BE();
    }

    public write(): Buffer {
        throw new Error("This is a client-to-server packet only.");
    }

    public static getId(): number {
        return defs.weapons.RicochetShotCommand.id;
    }
}

/** C→S: the ricochet ball hit a tank. We only need clientTime + the target nickname for damage; the
 *  trailing hit descriptor + bounce-point vector (per the client codec) are not needed server-side. */
export class RicochetTargetShotCommandPacket extends BasePacket {
    public clientTime: number = 0;
    public target: string | null = null;
    public read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        this.clientTime = reader.readInt32BE();
        this.target = reader.readOptionalString();
    }
    public write(): Buffer { throw new Error("This is a client-to-server packet only."); }
    public static getId(): number { return defs.weapons.RicochetTargetShotCommand.id; }
}

export class RicochetShotPacket extends BasePacket implements RicochetTypes.IRicochetShotPacket {
    public nickname: string | null;
    public x: number;
    public y: number;
    public z: number;

    constructor(data?: RicochetTypes.IRicochetShotPacketData) {
        super();
        this.nickname = data?.nickname ?? null;
        this.x = data?.x ?? 0;
        this.y = data?.y ?? 0;
        this.z = data?.z ?? 0;
    }

    public read(buffer: Buffer): void {
        throw new Error("This is a server-to-client packet only.");
    }

    public write(): Buffer {
        const writer = new BufferWriter();
        writer.writeOptionalString(this.nickname);
        writer.writeInt16BE(this.x);
        writer.writeInt16BE(this.y);
        writer.writeInt16BE(this.z);
        return writer.getBuffer();
    }

    public static getId(): number {
        return defs.weapons.RicochetShot.id;
    }
}