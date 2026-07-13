import { packetClass } from "@/packets/packet-class";
import { defs } from "protanki-protocol";

// IDs e schemas em `protanki-protocol` (defs.weapons.*). Isida = feixe que CURA aliados e DANA inimigos.
// Fluxo: IsisStart → (por tick) IsisTargetTick/IsisTargetPosition → IsisStop. O server relaya
// StartShootingIsis/StopShootingIsis e, por tick, SetIsisState (state 1=sem alvo, 2=cura, 3=dano).

// c2s
export const IsisStartCommandPacket = packetClass(defs.weapons.IsisStartCommand);
export type IsisStartCommandPacket = InstanceType<typeof IsisStartCommandPacket>;

export const IsisStopCommandPacket = packetClass(defs.weapons.IsisStopCommand);
export type IsisStopCommandPacket = InstanceType<typeof IsisStopCommandPacket>;

export const IsisTargetTickCommandPacket = packetClass(defs.weapons.IsisTargetTickCommand);
export type IsisTargetTickCommandPacket = InstanceType<typeof IsisTargetTickCommandPacket>;

export const IsisTargetPositionCommandPacket = packetClass(defs.weapons.IsisTargetPositionCommand);
export type IsisTargetPositionCommandPacket = InstanceType<typeof IsisTargetPositionCommandPacket>;

// s2c
export const SetIsisStatePacket = packetClass(defs.weapons.SetIsisState);
export type SetIsisStatePacket = InstanceType<typeof SetIsisStatePacket>;

export const StartShootingIsisPacket = packetClass(defs.weapons.StartShootingIsis);
export type StartShootingIsisPacket = InstanceType<typeof StartShootingIsisPacket>;

export const StopShootingIsisPacket = packetClass(defs.weapons.StopShootingIsis);
export type StopShootingIsisPacket = InstanceType<typeof StopShootingIsisPacket>;
