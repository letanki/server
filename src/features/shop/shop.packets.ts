import { BasePacket } from "@/packets/base.packet";
import { packetClass } from "@/packets/packet-class";
import { defs, encodeBody, decodeBody } from "protanki-protocol";
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
    // Lógica: a classe guarda países como tuplas [code, label]; o wire é uma list de { code, label }.
    read(buffer: Buffer): void {
        const { fields } = decodeBody(defs.shop.LocalizationInfo, buffer);
        this.countries = fields.countries.map((c): [string, string] => [c.code ?? "", c.label ?? ""]);
        this.defaultCountryCode = fields.defaultCountryCode ?? "";
        this.locationCheckEnabled = fields.locationCheckEnabled;
    }
    write(): Buffer {
        return encodeBody(defs.shop.LocalizationInfo, {
            countries: this.countries.map(([code, label]) => ({ code, label })),
            defaultCountryCode: this.defaultCountryCode,
            locationCheckEnabled: this.locationCheckEnabled,
        });
    }
    static getId(): number { return defs.shop.LocalizationInfo.id; }
}

export const RequestPaymentWindow = packetClass(defs.shop.RequestPaymentWindow);
export type RequestPaymentWindow = InstanceType<typeof RequestPaymentWindow>;

export const RequestShopData = packetClass(defs.shop.RequestShopData);
export type RequestShopData = InstanceType<typeof RequestShopData>;

export const SetShopCountry = packetClass(defs.shop.SetShopCountry);
export type SetShopCountry = InstanceType<typeof SetShopCountry>;

export const ShopData = packetClass(defs.shop.ShopData);
export type ShopData = InstanceType<typeof ShopData>;

export const ShowPaymentWindow = packetClass(defs.shop.ShowPaymentWindow);
export type ShowPaymentWindow = InstanceType<typeof ShowPaymentWindow>;

/** C->S: escolheu o pacote + método de pagamento → pede a compra. {itemId, paymentMethod}. */
export const PurchaseShopItem = packetClass(defs.shop.PurchaseShopItem);
export type PurchaseShopItem = InstanceType<typeof PurchaseShopItem>;

/** S->C: o cliente abre a URL de checkout numa nova aba. {url}. */
export const OpenPaymentUrl = packetClass(defs.shop.OpenPaymentUrl);
export type OpenPaymentUrl = InstanceType<typeof OpenPaymentUrl>;

/** C->S: ativar um código promocional. {code}. */
export const ActivatePromoCode = packetClass(defs.shop.ActivatePromoCode);
export type ActivatePromoCode = InstanceType<typeof ActivatePromoCode>;

/** S->C: código promocional válido (fecha o diálogo). */
export const PromoCodeValid = packetClass(defs.shop.PromoCodeValid);
export type PromoCodeValid = InstanceType<typeof PromoCodeValid>;

/** S->C: código promocional inválido. */
export const PromoCodeInvalid = packetClass(defs.shop.PromoCodeInvalid);
export type PromoCodeInvalid = InstanceType<typeof PromoCodeInvalid>;
