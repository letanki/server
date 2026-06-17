import { BasePacket } from "@/packets/base.packet";
import { PacketSchema, readSchema, writeSchema } from "@/packets/packet-schema";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import * as GarageTypes from "./garage.types";

export class BuyItemPacket extends BasePacket implements GarageTypes.IBuyItem {
    static readonly schema: PacketSchema = [
        { name: "itemId", type: "string" },
        { name: "quantity", type: "i32" },
        { name: "price", type: "i32" },
    ];
    itemId: string | null = null;
    quantity: number = 0;
    price: number = 0;
    read(buffer: Buffer): void { readSchema(this, BuyItemPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, BuyItemPacket.schema); }
    static getId(): number { return -1961983005; }
}

export class EquipItemRequestPacket extends BasePacket implements GarageTypes.IEquipItemRequest {
    itemId: string | null = null;
    read(buffer: Buffer): void { this.itemId = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.itemId).getBuffer(); }
    static getId(): number { return -1505530736; }
}

export class GarageItemsPacket extends BasePacket implements GarageTypes.IGarageItems {
    jsonData: string | null;
    constructor(jsonData: string | null = null) { super(); this.jsonData = jsonData; }
    read(buffer: Buffer): void { this.jsonData = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.jsonData).getBuffer(); }
    static getId(): number { return -255516505; }
}

export class MountItemPacket extends BasePacket implements GarageTypes.IMountItem {
    static readonly schema: PacketSchema = [
        { name: "itemId", type: "string" },
        { name: "unknown", type: "bool" },
    ];
    itemId: string | null;
    unknown: boolean;
    constructor(itemId: string | null = null, unknown: boolean = false) { super(); this.itemId = itemId; this.unknown = unknown; }
    read(buffer: Buffer): void { readSchema(this, MountItemPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, MountItemPacket.schema); }
    static getId(): number { return 2062201643; }
}

export class RequestGaragePacket extends BasePacket implements GarageTypes.IRequestGarage {
    read(buffer: Buffer): void { }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return -479046431; }
}

export class ShopItemsPacket extends BasePacket implements GarageTypes.IShopItems {
    jsonData: string | null;
    constructor(jsonData: string | null = null) { super(); this.jsonData = jsonData; }
    read(buffer: Buffer): void { this.jsonData = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.jsonData).getBuffer(); }
    static getId(): number { return -300370823; }
}

export class UnloadGaragePacket extends BasePacket implements GarageTypes.IUnloadGarage {
    read(buffer: Buffer): void { }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return 1211186637; }
}