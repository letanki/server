import { BasePacket } from "@/packets/base.packet";
import { IVector3 } from "@/shared/types/geom/ivector3";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";

/** C→S: twins fired (continuous aim/fire). Body = clientTime, control(i8), shotId, direction vector. */
export class TwinsShotCommandPacket extends BasePacket {
    public clientTime: number = 0;
    public control: number = 0;
    public shotId: number = 0;
    public direction: IVector3 | null = null;
    public read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        this.clientTime = reader.readInt32BE();
        this.control = reader.readInt8();
        this.shotId = reader.readInt32BE();
        this.direction = reader.readOptionalVector3();
    }
    public write(): Buffer { throw new Error("This is a client-to-server packet only."); }
    public static getId(): number { return -159686980; }
}

/** S→C: relays a twins shot to other players (the plasma visual). Body = nick, control(i8), direction. */
export class TwinsShotPacket extends BasePacket {
    constructor(private readonly nickname: string, private readonly control: number, private readonly direction: IVector3 | null) { super(); }
    public read(_buffer: Buffer): void {}
    public write(): Buffer {
        return new BufferWriter()
            .writeOptionalString(this.nickname)
            .writeInt8(this.control)
            .writeOptionalVector3(this.direction)
            .getBuffer();
    }
    public static getId(): number { return -44282936; }
}

/**
 * C→S: a twins plasma ball hit a tank. We read clientTime + the target nickname + the global hit position
 * (for the distance falloff); the trailing local-hit vector isn't needed server-side.
 */
export class TwinsTargetShotCommandPacket extends BasePacket {
    public clientTime: number = 0;
    public shotId: number = 0;
    public target: string | null = null;
    public hitGlobalPosition: IVector3 | null = null;
    public read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        this.clientTime = reader.readInt32BE();
        this.shotId = reader.readInt32BE();
        this.target = reader.readOptionalString();
        this.hitGlobalPosition = reader.readOptionalVector3();
    }
    public write(): Buffer { throw new Error("This is a client-to-server packet only."); }
    public static getId(): number { return -1723353904; }
}
