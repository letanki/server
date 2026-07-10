import { defs } from "protanki-protocol";
import { packetClass } from "@/packets/packet-class";

// Classes finas geradas a partir das defs compartilhadas (id + schema + direção).
// O par const + type (mesmo nome) preserva o uso dual valor/tipo: `new X({...})` e
// `IPacketHandler<X>` / `packet: X` continuam funcionando sem alteração nos handlers.

export const SmokyStaticShotCommandPacket = packetClass(defs.weapons.SmokyStaticShotCommand);
export type SmokyStaticShotCommandPacket = InstanceType<typeof SmokyStaticShotCommandPacket>;

export const SmokyStaticShotPacket = packetClass(defs.weapons.SmokyStaticShot);
export type SmokyStaticShotPacket = InstanceType<typeof SmokyStaticShotPacket>;

export const SmokyTargetShotCommandPacket = packetClass(defs.weapons.SmokyTargetShotCommand);
export type SmokyTargetShotCommandPacket = InstanceType<typeof SmokyTargetShotCommandPacket>;

export const SmokyTargetShotPacket = packetClass(defs.weapons.SmokyTargetShot);
export type SmokyTargetShotPacket = InstanceType<typeof SmokyTargetShotPacket>;
