import { BasePacket } from "@/packets/base.packet";
import { PacketSchema, readSchema, writeSchema } from "@/packets/packet-schema";
import { IVector3 } from "@/shared/types/geom/ivector3";

// Bonus (drop) lifecycle packets. The bonus `id` is "<type>#<instance>" (e.g. "crystall#3"); the
// client maps the `<type>` prefix to a definition sent earlier in BonusDataPacket (textures/lifetime).

// S->C: a bonus drops onto the field. Wire (verified vs log): optString id, vector3 position (parachute
// drop point), i32 disappearingTimeMs. The current client only reads id + position for a spawn.
export class SpawnBonusPacket extends BasePacket {
    static readonly schema: PacketSchema = [
        { name: "id", type: "string" },
        { name: "position", type: "vector3" },
        { name: "disappearingTimeMs", type: "i32" },
    ];
    id: string | null = null;
    position: IVector3 | null = null;
    disappearingTimeMs: number = 0;
    constructor(data?: { id: string; position: IVector3; disappearingTimeMs: number }) { super(); if (data) Object.assign(this, data); }
    read(buffer: Buffer): void { readSchema(this, SpawnBonusPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, SpawnBonusPacket.schema); }
    static getId(): number { return 1831462385; }
}

// S->C: a bonus is removed from the field (picked up or expired). Wire: optString id.
export class RemoveBonusPacket extends BasePacket {
    static readonly schema: PacketSchema = [{ name: "id", type: "string" }];
    id: string | null = null;
    constructor(id: string | null = null) { super(); this.id = id; }
    read(buffer: Buffer): void { readSchema(this, RemoveBonusPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, RemoveBonusPacket.schema); }
    static getId(): number { return -2026749922; }
}

// S->C: a bonus was taken (plays the pickup animation/sound). Wire: optString id. Usually followed by
// RemoveBonusPacket for the same id.
export class TakeBonusPacket extends BasePacket {
    static readonly schema: PacketSchema = [{ name: "id", type: "string" }];
    id: string | null = null;
    constructor(id: string | null = null) { super(); this.id = id; }
    read(buffer: Buffer): void { readSchema(this, TakeBonusPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, TakeBonusPacket.schema); }
    static getId(): number { return -1291499147; }
}
