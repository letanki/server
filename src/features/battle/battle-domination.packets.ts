import { BasePacket } from "@/packets/base.packet";
import { PacketSchema, readSchema, writeSchema } from "@/packets/packet-schema";

// Domination / Control-Point runtime events (the init is InitDomPointsPacket). Wire formats from the
// decompiled client. Point state: 0 = red, 1 = blue, 2 = neutral (matches IDomPointState).

// S->C: a tank entered a control point's radius. Wire: i32 pointId, string nickname.
export class PointTankEnteredPacket extends BasePacket {
    static readonly schema: PacketSchema = [{ name: "pointId", type: "i32" }, { name: "nickname", type: "string" }];
    pointId = 0; nickname: string | null = null;
    constructor(pointId?: number, nickname?: string) { super(); if (pointId !== undefined) this.pointId = pointId; if (nickname !== undefined) this.nickname = nickname; }
    read(buffer: Buffer): void { readSchema(this, PointTankEnteredPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, PointTankEnteredPacket.schema); }
    static getId(): number { return -456245145; }
}

// S->C: a tank left a control point's radius. Wire: i32 pointId, string nickname.
export class PointTankLeftPacket extends BasePacket {
    static readonly schema: PacketSchema = [{ name: "pointId", type: "i32" }, { name: "nickname", type: "string" }];
    pointId = 0; nickname: string | null = null;
    constructor(pointId?: number, nickname?: string) { super(); if (pointId !== undefined) this.pointId = pointId; if (nickname !== undefined) this.nickname = nickname; }
    read(buffer: Buffer): void { readSchema(this, PointTankLeftPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, PointTankLeftPacket.schema); }
    static getId(): number { return -1410197917; }
}

// S->C: a control point's capture meter changed. Wire: i32 pointId, f32 score (0..100), f32 changeRate.
export class PointScoreChangedPacket extends BasePacket {
    static readonly schema: PacketSchema = [{ name: "pointId", type: "i32" }, { name: "score", type: "f32" }, { name: "scoreChangeRate", type: "f32" }];
    pointId = 0; score = 0; scoreChangeRate = 0;
    constructor(pointId?: number, score?: number, scoreChangeRate?: number) { super(); if (pointId !== undefined) this.pointId = pointId; if (score !== undefined) this.score = score; if (scoreChangeRate !== undefined) this.scoreChangeRate = scoreChangeRate; }
    read(buffer: Buffer): void { readSchema(this, PointScoreChangedPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, PointScoreChangedPacket.schema); }
    static getId(): number { return -2141998253; }
}

// S->C: a team STARTED capturing a point (plays the capture-start sound). Wire: i32 team (0 red / 1 blue).
export class PointCaptureStartedPacket extends BasePacket {
    static readonly schema: PacketSchema = [{ name: "team", type: "i32" }];
    team = 0;
    constructor(team?: number) { super(); if (team !== undefined) this.team = team; }
    read(buffer: Buffer): void { readSchema(this, PointCaptureStartedPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, PointCaptureStartedPacket.schema); }
    static getId(): number { return -1346883037; }
}

// S->C: a team STOPPED capturing a point (plays the capture-stop sound). Wire: i32 team (0 red / 1 blue).
export class PointCaptureStoppedPacket extends BasePacket {
    static readonly schema: PacketSchema = [{ name: "team", type: "i32" }];
    team = 0;
    constructor(team?: number) { super(); if (team !== undefined) this.team = team; }
    read(buffer: Buffer): void { readSchema(this, PointCaptureStoppedPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, PointCaptureStoppedPacket.schema); }
    static getId(): number { return -1701488017; }
}

// S->C: a control point changed owner/state. Wire: i32 pointId, i32 state (0 red / 1 blue / 2 neutral).
export class PointStateChangedPacket extends BasePacket {
    static readonly schema: PacketSchema = [{ name: "pointId", type: "i32" }, { name: "state", type: "i32" }];
    pointId = 0; state = 2;
    constructor(pointId?: number, state?: number) { super(); if (pointId !== undefined) this.pointId = pointId; if (state !== undefined) this.state = state; }
    read(buffer: Buffer): void { readSchema(this, PointStateChangedPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, PointStateChangedPacket.schema); }
    static getId(): number { return -1073178885; }
}
