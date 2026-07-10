import { packetClass } from "@/packets/packet-class";
import { defs } from "protanki-protocol";

// IDs e schemas em `protanki-protocol` (defs.garage.*).

export const BuyItemPacket = packetClass(defs.garage.BuyItem);
export type BuyItemPacket = InstanceType<typeof BuyItemPacket>;

export const EquipItemRequestPacket = packetClass(defs.garage.EquipItemRequest);
export type EquipItemRequestPacket = InstanceType<typeof EquipItemRequestPacket>;

export const GarageItemsPacket = packetClass(defs.garage.GarageItems);
export type GarageItemsPacket = InstanceType<typeof GarageItemsPacket>;

// S->C: mount an item on the garage tank (also called InitMounted). itemId is "<base>_m<mod>".
export const MountItemPacket = packetClass(defs.garage.MountItem);
export type MountItemPacket = InstanceType<typeof MountItemPacket>;

// C->S: the player is PREVIEWING (fitting) an item on the garage tank without equipping/buying it.
export const FitItemPacket = packetClass(defs.garage.FitItem);
export type FitItemPacket = InstanceType<typeof FitItemPacket>;

export const RequestGaragePacket = packetClass(defs.garage.RequestGarage);
export type RequestGaragePacket = InstanceType<typeof RequestGaragePacket>;

export const ShopItemsPacket = packetClass(defs.garage.ShopItems);
export type ShopItemsPacket = InstanceType<typeof ShopItemsPacket>;

export const UnloadGaragePacket = packetClass(defs.garage.UnloadGarage);
export type UnloadGaragePacket = InstanceType<typeof UnloadGaragePacket>;
