import { packetClass } from "@/packets/packet-class";
import { defs } from "protanki-protocol";

export const ThunderShotNoTargetCommandPacket = packetClass(defs.weapons.ThunderShotNoTargetCommand);
export type ThunderShotNoTargetCommandPacket = InstanceType<typeof ThunderShotNoTargetCommandPacket>;

export const ThunderShotNoTargetPacket = packetClass(defs.weapons.ThunderShotNoTarget);
export type ThunderShotNoTargetPacket = InstanceType<typeof ThunderShotNoTargetPacket>;

export const ThunderStaticShotCommandPacket = packetClass(defs.weapons.ThunderStaticShotCommand);
export type ThunderStaticShotCommandPacket = InstanceType<typeof ThunderStaticShotCommandPacket>;

export const ThunderStaticShotPacket = packetClass(defs.weapons.ThunderStaticShot);
export type ThunderStaticShotPacket = InstanceType<typeof ThunderStaticShotPacket>;

export const ThunderTargetShotCommandPacket = packetClass(defs.weapons.ThunderTargetShotCommand);
export type ThunderTargetShotCommandPacket = InstanceType<typeof ThunderTargetShotCommandPacket>;

export const ThunderTargetShotPacket = packetClass(defs.weapons.ThunderTargetShot);
export type ThunderTargetShotPacket = InstanceType<typeof ThunderTargetShotPacket>;
