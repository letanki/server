import { BasePacket } from "@/packets/base.packet";
import { packetClass } from "@/packets/packet-class";
import { defs, encodeBody, decodeBody } from "protanki-protocol";
import * as ReferralTypes from "./referral.types";

// IDs e schemas em `protanki-protocol` (defs.referral.*).

export const ReferralInfo = packetClass(defs.referral.ReferralInfo);
export type ReferralInfo = InstanceType<typeof ReferralInfo>;

export const RequestReferralInfo = packetClass(defs.referral.RequestReferralInfo);
export type RequestReferralInfo = InstanceType<typeof RequestReferralInfo>;

export class ReferralInfoDetails extends BasePacket implements ReferralTypes.IReferralInfoDetails {
    referredUsers: ReferralTypes.IReferredUser[] = [];
    url: string = "";
    bannerCodeString: string = "";
    defaultRefMessage: string = "";
    constructor(data?: { referredUsers?: ReferralTypes.IReferredUser[]; url?: string; bannerCode?: string; defaultMessage?: string }) {
        super();
        if (data) {
            this.referredUsers = data.referredUsers ?? [];
            this.url = data.url ?? "";
            this.bannerCodeString = data.bannerCode ?? "";
            this.defaultRefMessage = data.defaultMessage ?? "";
        }
    }
    // Lógica: mapeia os nomes de campo (bannerCode/defaultMessage) e o `user` nullable. Bytes na lib.
    read(buffer: Buffer): void {
        const { fields } = decodeBody(defs.referral.ReferralInfoDetails, buffer);
        this.referredUsers = fields.referredUsers.map((u) => ({ income: u.income, user: u.user ?? "" }));
        this.url = fields.url ?? "";
        this.bannerCodeString = fields.bannerCode ?? "";
        this.defaultRefMessage = fields.defaultMessage ?? "";
    }
    write(): Buffer {
        return encodeBody(defs.referral.ReferralInfoDetails, {
            referredUsers: this.referredUsers,
            url: this.url,
            bannerCode: this.bannerCodeString,
            defaultMessage: this.defaultRefMessage,
        });
    }
    static getId(): number { return defs.referral.ReferralInfoDetails.id; }
}
