import { IEmpty, IPacket } from "@/packets/packet.interfaces";

export interface IBuyItem extends IPacket {
    itemId: string | null;
    quantity: number;
    price: number;
}

export interface IEquipItemRequest extends IPacket {
    itemId: string | null;
}

export interface IFitItem extends IPacket {
    itemId: string | null;
}

export interface IGarageItems extends IPacket {
    jsonData: string | null;
}

export interface IMountItem extends IPacket {
    itemId: string | null;
    /** Whether the player OWNS this item (equip vs buy UI). True on equip; on a Fit-preview it reflects ownership. */
    owned: boolean;
}

export interface IRequestGarage extends IEmpty { }

export interface IShopItems extends IPacket {
    jsonData: string | null;
}

export interface IUnloadGarage extends IEmpty { }