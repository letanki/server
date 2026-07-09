import { BasePacket } from "@/packets/base.packet";
import { readSchema, writeSchema } from "@/packets/packet-schema";
import { IEmpty } from "@/packets/packet.interfaces";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import { defs } from "protanki-protocol";
import * as SystemTypes from "./system.types";

// IDs e schemas em `protanki-protocol` (defs.system.*).

export class SystemMessage extends BasePacket implements SystemTypes.ISystemMessage {
    text: string | null = null;
    constructor(text?: string | null) { super(); if (text) { this.text = text; } }
    read(buffer: Buffer): void { readSchema(this, defs.system.SystemMessage.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.system.SystemMessage.schema!); }
    static getId(): number { return defs.system.SystemMessage.id; }
}

export class Ping extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { readSchema(this, defs.system.Ping.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.system.Ping.schema!); }
    static getId(): number { return defs.system.Ping.id; }
}

export class Pong extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { readSchema(this, defs.system.Pong.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.system.Pong.schema!); }
    static getId(): number { return defs.system.Pong.id; }
}

export class CaptchaLocation extends BasePacket implements SystemTypes.ICaptchaLocation {
    captchaLocations: Array<number> = [];
    constructor(captchaLocations?: Array<number>) {
        super();
        if (captchaLocations) { this.captchaLocations = captchaLocations; }
    }
    // Codec manual (lista de i32 sem flag).
    read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        const itemsCount = reader.readInt32BE();
        this.captchaLocations = [];
        for (let i = 0; i < itemsCount; i++) {
            this.captchaLocations.push(reader.readInt32BE());
        }
    }
    write(): Buffer {
        const writer = new BufferWriter();
        writer.writeInt32BE(this.captchaLocations.length);
        for (const location of this.captchaLocations) {
            writer.writeInt32BE(location);
        }
        return writer.getBuffer();
    }
    static getId(): number { return defs.system.CaptchaLocation.id; }
}

export class InviteEnabled extends BasePacket implements SystemTypes.IInviteEnabled {
    requireInviteCode: boolean = false;
    constructor(requireInviteCode?: boolean) { super(); if (requireInviteCode !== undefined) { this.requireInviteCode = requireInviteCode; } }
    read(buffer: Buffer): void { readSchema(this, defs.system.InviteEnabled.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.system.InviteEnabled.schema!); }
    static getId(): number { return defs.system.InviteEnabled.id; }
}

export class ConfirmLayoutChange extends BasePacket implements SystemTypes.IConfirmLayoutChange {
    fromLayout: number = 0;
    toLayout: number = 0;
    constructor(from?: number, to?: number) {
        super();
        if (from !== undefined) this.fromLayout = from;
        if (to !== undefined) this.toLayout = to;
    }
    read(buffer: Buffer): void { readSchema(this, defs.system.ConfirmLayoutChange.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.system.ConfirmLayoutChange.schema!); }
    static getId(): number { return defs.system.ConfirmLayoutChange.id; }
}

export class SetLayout extends BasePacket implements SystemTypes.ISetLayout {
    layoutId: number;
    constructor(layoutId: number) { super(); this.layoutId = layoutId; }
    read(buffer: Buffer): void { readSchema(this, defs.system.SetLayout.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.system.SetLayout.schema!); }
    static getId(): number { return defs.system.SetLayout.id; }
}
