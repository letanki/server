import { BasePacket } from "@/packets/base.packet";
import { readSchema, writeSchema } from "@/packets/packet-schema";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import { defs } from "protanki-protocol";
import * as ShopTypes from "./shop.types";

// IDs e schemas em `protanki-protocol` (defs.shop.*).

export class LocalizationInfo extends BasePacket implements ShopTypes.ILocalizationInfo {
    countries: [string, string][] = [];
    defaultCountryCode: string = "";
    locationCheckEnabled: boolean = false;
    constructor(countries?: [string, string][], defaultCountryCode?: string, locationCheckEnabled?: boolean) {
        super();
        if (countries) { this.countries = countries; }
        if (defaultCountryCode) { this.defaultCountryCode = defaultCountryCode; }
        if (locationCheckEnabled !== undefined) { this.locationCheckEnabled = locationCheckEnabled; }
    }
    // Codec manual (lista de países [code, label]).
    read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        const count = reader.readInt32BE();
        this.countries = [];
        for (let i = 0; i < count; i++) {
            const key = reader.readOptionalString() ?? "";
            const value = reader.readOptionalString() ?? "";
            this.countries.push([key, value]);
        }
        this.defaultCountryCode = reader.readOptionalString() ?? "";
        this.locationCheckEnabled = reader.readUInt8() === 1;
    }
    write(): Buffer {
        const writer = new BufferWriter();
        writer.writeInt32BE(this.countries.length);
        for (const country of this.countries) {
            writer.writeOptionalString(country[0]);
            writer.writeOptionalString(country[1]);
        }
        writer.writeOptionalString(this.defaultCountryCode);
        writer.writeUInt8(this.locationCheckEnabled ? 1 : 0);
        return writer.getBuffer();
    }
    static getId(): number { return defs.shop.LocalizationInfo.id; }
}

export class RequestPaymentWindow extends BasePacket implements ShopTypes.IRequestPaymentWindow {
    read(buffer: Buffer): void { readSchema(this, defs.shop.RequestPaymentWindow.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.shop.RequestPaymentWindow.schema!); }
    static getId(): number { return defs.shop.RequestPaymentWindow.id; }
}

export class RequestShopData extends BasePacket implements ShopTypes.IRequestShopData {
    read(buffer: Buffer): void { readSchema(this, defs.shop.RequestShopData.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.shop.RequestShopData.schema!); }
    static getId(): number { return defs.shop.RequestShopData.id; }
}

export class SetShopCountry extends BasePacket implements ShopTypes.ISetShopCountry {
    countryCode: string | null = null;
    read(buffer: Buffer): void { readSchema(this, defs.shop.SetShopCountry.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.shop.SetShopCountry.schema!); }
    static getId(): number { return defs.shop.SetShopCountry.id; }
}

export class ShopData extends BasePacket implements ShopTypes.IShopData {
    payload: string | null = null;
    constructor(payload?: string | null) { super(); if (payload) { this.payload = payload; } }
    read(buffer: Buffer): void { readSchema(this, defs.shop.ShopData.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.shop.ShopData.schema!); }
    static getId(): number { return defs.shop.ShopData.id; }
}

export class ShowPaymentWindow extends BasePacket implements ShopTypes.IShowPaymentWindow {
    read(buffer: Buffer): void { readSchema(this, defs.shop.ShowPaymentWindow.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.shop.ShowPaymentWindow.schema!); }
    static getId(): number { return defs.shop.ShowPaymentWindow.id; }
}
