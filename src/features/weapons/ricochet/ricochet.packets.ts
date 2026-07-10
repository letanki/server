import { packetClass } from "@/packets/packet-class";
import { defs } from "protanki-protocol";

export const RicochetShotCommandPacket = packetClass(defs.weapons.RicochetShotCommand);
export type RicochetShotCommandPacket = InstanceType<typeof RicochetShotCommandPacket>;

/** C→S: the ricochet ball hit a tank. We only need clientTime + the target nickname for damage; the
 *  trailing hit descriptor + bounce-point vector (per the client codec) are not needed server-side. */
export const RicochetTargetShotCommandPacket = packetClass(defs.weapons.RicochetTargetShotCommand);
export type RicochetTargetShotCommandPacket = InstanceType<typeof RicochetTargetShotCommandPacket>;

export const RicochetShotPacket = packetClass(defs.weapons.RicochetShot);
export type RicochetShotPacket = InstanceType<typeof RicochetShotPacket>;
