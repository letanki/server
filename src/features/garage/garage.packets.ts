import { BasePacket } from "@/packets/base.packet";
import { readSchema, writeSchema } from "@/packets/packet-schema";
import { defs } from "protanki-protocol";
import * as GarageTypes from "./garage.types";

// IDs e schemas em `protanki-protocol` (defs.garage.*).

export class BuyItemPacket extends BasePacket implements GarageTypes.IBuyItem {
    itemId: string | null = null;
    quantity: number = 0;
    price: number = 0;
    read(buffer: Buffer): void { readSchema(this, defs.garage.BuyItem.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.garage.BuyItem.schema!); }
    static getId(): number { return defs.garage.BuyItem.id; }
}

export class EquipItemRequestPacket extends BasePacket implements GarageTypes.IEquipItemRequest {
    itemId: string | null = null;
    read(buffer: Buffer): void { readSchema(this, defs.garage.EquipItemRequest.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.garage.EquipItemRequest.schema!); }
    static getId(): number { return defs.garage.EquipItemRequest.id; }
}

export class GarageItemsPacket extends BasePacket implements GarageTypes.IGarageItems {
    jsonData: string | null = null;
    constructor(jsonData: string | null = null) { super(); this.jsonData = jsonData; }
    read(buffer: Buffer): void { readSchema(this, defs.garage.GarageItems.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.garage.GarageItems.schema!); }
    static getId(): number { return defs.garage.GarageItems.id; }
}

// S->C: mount an item on the garage tank (also called InitMounted). itemId is "<base>_m<mod>".
export class MountItemPacket extends BasePacket implements GarageTypes.IMountItem {
    itemId: string | null;
    owned: boolean;
    constructor(itemId: string | null = null, owned: boolean = false) { super(); this.itemId = itemId; this.owned = owned; }
    read(buffer: Buffer): void { readSchema(this, defs.garage.MountItem.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.garage.MountItem.schema!); }
    static getId(): number { return defs.garage.MountItem.id; }
}

// C->S: the player is PREVIEWING (fitting) an item on the garage tank without equipping/buying it.
export class FitItemPacket extends BasePacket implements GarageTypes.IFitItem {
    itemId: string | null = null;
    read(buffer: Buffer): void { readSchema(this, defs.garage.FitItem.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.garage.FitItem.schema!); }
    static getId(): number { return defs.garage.FitItem.id; }
}

export class RequestGaragePacket extends BasePacket implements GarageTypes.IRequestGarage {
    read(buffer: Buffer): void { readSchema(this, defs.garage.RequestGarage.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.garage.RequestGarage.schema!); }
    static getId(): number { return defs.garage.RequestGarage.id; }
}

export class ShopItemsPacket extends BasePacket implements GarageTypes.IShopItems {
    jsonData: string | null = null;
    constructor(jsonData: string | null = null) { super(); this.jsonData = jsonData; }
    read(buffer: Buffer): void { readSchema(this, defs.garage.ShopItems.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.garage.ShopItems.schema!); }
    static getId(): number { return defs.garage.ShopItems.id; }
}

export class UnloadGaragePacket extends BasePacket implements GarageTypes.IUnloadGarage {
    read(buffer: Buffer): void { readSchema(this, defs.garage.UnloadGarage.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.garage.UnloadGarage.schema!); }
    static getId(): number { return defs.garage.UnloadGarage.id; }
}
