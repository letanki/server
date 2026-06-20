import { BasePacket } from "@/packets/base.packet";
import { IVector3 } from "@/shared/types/geom/ivector3";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";

// Mine lifecycle packets. Wire formats verified against the 2026-06-19 logs.

// S->C: a mine is placed on the field. Wire: optString id, vector3 position (PLAIN — 3 floats, no
// present byte), optString owner nickname. The client hides enemies' mines until they activate.
export class PutMinePacket extends BasePacket {
    constructor(private readonly id: string, private readonly position: IVector3, private readonly owner: string) { super(); }
    read(buffer: Buffer): void { throw new Error("This is a server-to-client packet only."); }
    write(): Buffer {
        return new BufferWriter()
            .writeOptionalString(this.id)
            .writeFloatBE(this.position.x).writeFloatBE(this.position.y).writeFloatBE(this.position.z)
            .writeOptionalString(this.owner)
            .getBuffer();
    }
    static getId(): number { return 272183855; }
}

// S->C: a mine becomes ARMED (sent ~1s after PutMine). Wire: optString id.
export class ActivateMinePacket extends BasePacket {
    constructor(private readonly id: string) { super(); }
    read(buffer: Buffer): void { throw new Error("This is a server-to-client packet only."); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.id).getBuffer(); }
    static getId(): number { return -624217047; }
}

// S->C: an armed mine detonates (an enemy stepped on it). Wire: optString id, optString victim
// nickname. The client plays the explosion and removes the mine; damage is applied server-side.
export class DetonateMinePacket extends BasePacket {
    constructor(private readonly id: string, private readonly victim: string) { super(); }
    read(buffer: Buffer): void { throw new Error("This is a server-to-client packet only."); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.id).writeOptionalString(this.victim).getBuffer(); }
    static getId(): number { return 1387974401; }
}

// S->C: removes all of a player's mines (e.g. on death/leave). Wire: optString owner nickname.
export class RemoveMinesPacket extends BasePacket {
    constructor(private readonly owner: string) { super(); }
    read(buffer: Buffer): void { throw new Error("This is a server-to-client packet only."); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.owner).getBuffer(); }
    static getId(): number { return -1200619383; }
}
