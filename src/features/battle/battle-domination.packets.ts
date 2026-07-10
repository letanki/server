import { packetClass } from "@/packets/packet-class";
import { defs } from "protanki-protocol";

// Domination / Control-Point runtime events (the init is InitDomPointsPacket). Wire formats from the
// decompiled client. Point state: 0 = red, 1 = blue, 2 = neutral (matches IDomPointState).
// IDs e schemas em `protanki-protocol` (defs.battle.*).

// S->C: a tank entered a control point's radius. Wire: i32 pointId, string nickname.
export const PointTankEnteredPacket = packetClass(defs.battle.PointTankEntered);
export type PointTankEnteredPacket = InstanceType<typeof PointTankEnteredPacket>;

// S->C: a tank left a control point's radius. Wire: i32 pointId, string nickname.
export const PointTankLeftPacket = packetClass(defs.battle.PointTankLeft);
export type PointTankLeftPacket = InstanceType<typeof PointTankLeftPacket>;

// S->C: a control point's capture meter changed. Wire: i32 pointId, f32 score (0..100), f32 changeRate.
export const PointScoreChangedPacket = packetClass(defs.battle.PointScoreChanged);
export type PointScoreChangedPacket = InstanceType<typeof PointScoreChangedPacket>;

// S->C: a team STARTED capturing a point (plays the capture-start sound). Wire: i32 team (0 red / 1 blue).
export const PointCaptureStartedPacket = packetClass(defs.battle.PointCaptureStarted);
export type PointCaptureStartedPacket = InstanceType<typeof PointCaptureStartedPacket>;

// S->C: a team STOPPED capturing a point (plays the capture-stop sound). Wire: i32 team (0 red / 1 blue).
export const PointCaptureStoppedPacket = packetClass(defs.battle.PointCaptureStopped);
export type PointCaptureStoppedPacket = InstanceType<typeof PointCaptureStoppedPacket>;

// S->C: a control point changed owner/state. Wire: i32 pointId, i32 state (0 red / 1 blue / 2 neutral).
export const PointStateChangedPacket = packetClass(defs.battle.PointStateChanged);
export type PointStateChangedPacket = InstanceType<typeof PointStateChangedPacket>;
