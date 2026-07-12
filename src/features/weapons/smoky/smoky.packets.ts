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

/** C→S: smoky disparou sem acertar nada (raycast não tocou tanque/cenário). */
export const SmokyShotNoTargetCommandPacket = packetClass(defs.weapons.SmokyShotNoTargetCommand);
export type SmokyShotNoTargetCommandPacket = InstanceType<typeof SmokyShotNoTargetCommandPacket>;

/** S→C: relay do disparo sem alvo (para outros verem o efeito do tiro). */
export const SmokyShotNoTargetPacket = packetClass(defs.weapons.SmokyShotNoTarget);
export type SmokyShotNoTargetPacket = InstanceType<typeof SmokyShotNoTargetPacket>;

/** S→C: efeito de crítico na torreta do tanque alvo (visual). */
export const SmokyCriticalHitPacket = packetClass(defs.weapons.SmokyCriticalHit);
export type SmokyCriticalHitPacket = InstanceType<typeof SmokyCriticalHitPacket>;
