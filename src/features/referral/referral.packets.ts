import { BasePacket } from "@/packets/base.packet";
import { readSchema, writeSchema } from "@/packets/packet-schema";
import { IEmpty } from "@/packets/packet.interfaces";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import { defs } from "protanki-protocol";
import * as ReferralTypes from "./referral.types";

// IDs e schemas em `protanki-protocol` (defs.referral.*).

export class ReferralInfo extends BasePacket implements ReferralTypes.IReferralInfo {
    hash: string = "";
    host: string = "";
    constructor(hash?: string, host?: string) {
        super();
        if (hash) this.hash = hash;
        if (host) this.host = host;
    }
    read(buffer: Buffer): void { readSchema(this, defs.referral.ReferralInfo.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.referral.ReferralInfo.schema!); }
    static getId(): number { return defs.referral.ReferralInfo.id; }
}

export class RequestReferralInfo extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { readSchema(this, defs.referral.RequestReferralInfo.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.referral.RequestReferralInfo.schema!); }
    static getId(): number { return defs.referral.RequestReferralInfo.id; }
}

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
    // Codec manual (lista de referredUsers + campos trailing).
    read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        const count = reader.readInt32BE();
        this.referredUsers = [];
        for (let i = 0; i < count; i++) {
            this.referredUsers.push({
                income: reader.readInt32BE(),
                user: reader.readOptionalString() ?? "",
            });
        }
        this.url = reader.readOptionalString() ?? "";
        this.bannerCodeString = reader.readOptionalString() ?? "";
        this.defaultRefMessage = reader.readOptionalString() ?? "";
    }
    write(): Buffer {
        const writer = new BufferWriter();
        writer.writeInt32BE(this.referredUsers.length);
        for (const ref of this.referredUsers) {
            writer.writeInt32BE(ref.income);
            writer.writeOptionalString(ref.user);
        }
        writer.writeOptionalString(this.url);
        writer.writeOptionalString(this.bannerCodeString);
        writer.writeOptionalString(this.defaultRefMessage);
        return writer.getBuffer();
    }
    static getId(): number { return defs.referral.ReferralInfoDetails.id; }
}
