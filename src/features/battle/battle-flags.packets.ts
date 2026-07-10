import { BasePacket } from "@/packets/base.packet";
import { writeSchema } from "@/packets/packet-schema";
import { packetClass } from "@/packets/packet-class";
import { defs } from "protanki-protocol";
import * as BattleTypes from "./battle.types";

// IDs e schemas em `protanki-protocol` (defs.battle.*).

export const TakeFlagPacket = packetClass(defs.battle.TakeFlag);
export type TakeFlagPacket = InstanceType<typeof TakeFlagPacket>;

export class DropFlagRequestPacket extends BasePacket implements BattleTypes.IDropFlagRequest {
    read(buffer: Buffer): void { }
    write(): Buffer { return writeSchema(this, defs.battle.DropFlagRequest.schema!); }
    static getId(): number { return defs.battle.DropFlagRequest.id; }
}

export const DropFlagPacket = packetClass(defs.battle.DropFlag);
export type DropFlagPacket = InstanceType<typeof DropFlagPacket>;

export const ReturnFlagPacket = packetClass(defs.battle.ReturnFlag);
export type ReturnFlagPacket = InstanceType<typeof ReturnFlagPacket>;

// Sent after a CTF capture to update the capturing team's flag score (red = 0, blue = 1).
export const SetCtfScorePacket = packetClass(defs.battle.SetCtfScore);
export type SetCtfScorePacket = InstanceType<typeof SetCtfScorePacket>;

export const CaptureFlagPacket = packetClass(defs.battle.CaptureFlag);
export type CaptureFlagPacket = InstanceType<typeof CaptureFlagPacket>;
