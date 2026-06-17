import { BasePacket } from "@/packets/base.packet";
import { PacketSchema, readSchema, writeSchema } from "@/packets/packet-schema";
import { IEmpty } from "@/packets/packet.interfaces";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import * as SystemTypes from "./system.types";

export class SystemMessage extends BasePacket implements SystemTypes.ISystemMessage {
    static readonly schema: PacketSchema = [
        { name: "text", type: "string" },
    ];
    text: string | null = null;

    constructor(text?: string | null) {
        super();
        if (text) {
            this.text = text;
        }
    }

    read(buffer: Buffer): void { readSchema(this, SystemMessage.schema, buffer); }

    write(): Buffer { return writeSchema(this, SystemMessage.schema); }
    static getId(): number {
        return -600078553;
    }
}

export class Ping extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { }
    write(): Buffer {
        return new BufferWriter().getBuffer();
    }
    static getId(): number {
        return -555602629;
    }
}

export class Pong extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { }
    write(): Buffer {
        return new BufferWriter().getBuffer();
    }
    static getId(): number {
        return 1484572481;
    }
}

export class CaptchaLocation extends BasePacket implements SystemTypes.ICaptchaLocation {
    captchaLocations: Array<number> = [];

    constructor(captchaLocations?: Array<number>) {
        super();
        if (captchaLocations) {
            this.captchaLocations = captchaLocations;
        }
    }

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
    static getId(): number {
        return 321971701;
    }
}

export class InviteEnabled extends BasePacket implements SystemTypes.IInviteEnabled {
    static readonly schema: PacketSchema = [
        { name: "requireInviteCode", type: "bool" },
    ];
    requireInviteCode: boolean = false;

    constructor(requireInviteCode?: boolean) {
        super();
        if (requireInviteCode !== undefined) {
            this.requireInviteCode = requireInviteCode;
        }
    }

    read(buffer: Buffer): void { readSchema(this, InviteEnabled.schema, buffer); }

    write(): Buffer { return writeSchema(this, InviteEnabled.schema); }
    static getId(): number {
        return 444933603;
    }
}

export class ConfirmLayoutChange extends BasePacket implements SystemTypes.IConfirmLayoutChange {
    static readonly schema: PacketSchema = [
        { name: "fromLayout", type: "i32" },
        { name: "toLayout", type: "i32" },
    ];
    fromLayout: number = 0;
    toLayout: number = 0;

    constructor(from?: number, to?: number) {
        super();
        if (from !== undefined) this.fromLayout = from;
        if (to !== undefined) this.toLayout = to;
    }

    read(buffer: Buffer): void { readSchema(this, ConfirmLayoutChange.schema, buffer); }

    write(): Buffer { return writeSchema(this, ConfirmLayoutChange.schema); }
    static getId(): number {
        return -593368100;
    }
}

export class SetLayout extends BasePacket implements SystemTypes.ISetLayout {
    static readonly schema: PacketSchema = [
        { name: "layoutId", type: "i32" },
    ];
    layoutId: number;

    constructor(layoutId: number) {
        super();
        this.layoutId = layoutId;
    }

    read(buffer: Buffer): void { readSchema(this, SetLayout.schema, buffer); }

    write(): Buffer { return writeSchema(this, SetLayout.schema); }
    static getId(): number {
        return 1118835050;
    }
}