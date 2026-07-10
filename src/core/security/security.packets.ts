import { BasePacket } from "@/packets/base.packet";
import { defs, encodeBody, decodeBody } from "protanki-protocol";
import * as SecurityTypes from "./security.types";

// ID em `protanki-protocol` (defs.security.*). Codec manual (lista de i8 sem flag).

export class Protection extends BasePacket implements SecurityTypes.IProtection {
    keys: Array<number>;

    constructor(keys: Array<number>) {
        super();
        this.keys = keys;
    }

    read(buffer: Buffer): void {
        const { fields } = decodeBody(defs.security.Protection, buffer);
        this.keys = fields.keys.map((x) => x.key);
    }

    write(): Buffer {
        return encodeBody(defs.security.Protection, { keys: this.keys.map((key) => ({ key })) });
    }
    static getId(): number { return defs.security.Protection.id; }
}
