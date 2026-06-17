import { BasePacket } from "@/packets/base.packet";
import { PacketSchema, readSchema, writeSchema } from "@/packets/packet-schema";
import { IEmpty } from "@/packets/packet.interfaces";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import * as SettingsTypes from "./settings.types";

export class RequestSettings extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { }
    write(): Buffer {
        return new BufferWriter().getBuffer();
    }
    static getId(): number {
        return 850220815;
    }
}

export class UserSettingsSocial extends BasePacket implements SettingsTypes.IUserSettingsSocial {
    passwordCreated: boolean = false;
    socialLinks: SettingsTypes.ISocialLink[] = [];

    constructor(passwordCreated?: boolean, socialLinks?: SettingsTypes.ISocialLink[]) {
        super();
        if (passwordCreated !== undefined) this.passwordCreated = passwordCreated;
        if (socialLinks) this.socialLinks = socialLinks;
    }

    read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        this.passwordCreated = reader.readUInt8() === 1;
        const count = reader.readInt32BE();
        this.socialLinks = [];
        for (let i = 0; i < count; i++) {
            this.socialLinks.push({
                authorizationUrl: reader.readOptionalString() ?? "",
                isLinked: reader.readUInt8() === 1,
                snId: reader.readOptionalString() ?? "",
            });
        }
    }

    write(): Buffer {
        const writer = new BufferWriter();
        writer.writeUInt8(this.passwordCreated ? 1 : 0);
        writer.writeInt32BE(this.socialLinks.length);
        for (const link of this.socialLinks) {
            writer.writeOptionalString(link.authorizationUrl);
            writer.writeUInt8(link.isLinked ? 1 : 0);
            writer.writeOptionalString(link.snId);
        }
        return writer.getBuffer();
    }
    static getId(): number {
        return -583564465;
    }
}

export class UserSettingsNotifications extends BasePacket implements SettingsTypes.IUserSettingsNotifications {
    static readonly schema: PacketSchema = [
        { name: "notificationsEnabled", type: "bool" },
    ];
    notificationsEnabled: boolean = false;

    constructor(enabled?: boolean) {
        super();
        if (enabled !== undefined) this.notificationsEnabled = enabled;
    }

    read(buffer: Buffer): void { readSchema(this, UserSettingsNotifications.schema, buffer); }

    write(): Buffer { return writeSchema(this, UserSettingsNotifications.schema); }
    static getId(): number {
        return 1447082276;
    }
}

export class SetNotifications extends BasePacket implements SettingsTypes.ISetNotifications {
    enabled: boolean = false;
    read(buffer: Buffer): void {
        this.enabled = new BufferReader(buffer).readUInt8() === 1;
    }
    write(): Buffer {
        return new BufferWriter().writeUInt8(this.enabled ? 1 : 0).getBuffer();
    }
    static getId(): number {
        return 1312986424;
    }
}

export class UpdatePassword extends BasePacket implements SettingsTypes.IUpdatePassword {
    static readonly schema: PacketSchema = [
        { name: "password", type: "string" },
        { name: "email", type: "string" },
    ];
    password: string | null = null;
    email: string | null = null;
    read(buffer: Buffer): void { readSchema(this, UpdatePassword.schema, buffer); }
    write(): Buffer { return writeSchema(this, UpdatePassword.schema); }
    static getId() {
        return 762959326;
    }
}

export class UpdatePasswordResult extends BasePacket implements SettingsTypes.IUpdatePasswordResult {
    static readonly schema: PacketSchema = [
        { name: "isError", type: "bool" },
        { name: "message", type: "string" },
    ];
    isError: boolean = false;
    message: string | null = null;
    constructor(isError?: boolean, message?: string | null) {
        super();
        if (isError !== undefined) this.isError = isError;
        if (message) this.message = message;
    }
    read(buffer: Buffer): void { readSchema(this, UpdatePasswordResult.schema, buffer); }
    write(): Buffer { return writeSchema(this, UpdatePasswordResult.schema); }
    static getId() {
        return 1570555748;
    }
}

export class RequestChangePasswordForm extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { }
    write(): Buffer {
        return new BufferWriter().getBuffer();
    }
    static getId(): number {
        return -1507635228;
    }
}

export class ChangePasswordForm extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { }
    write(): Buffer {
        return new BufferWriter().getBuffer();
    }
    static getId(): number {
        return 600420685;
    }
}

export class CreatePasswordForm extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { }
    write(): Buffer {
        return new BufferWriter().getBuffer();
    }
    static getId(): number {
        return 133238100;
    }
}

export class LinkEmailRequest extends BasePacket implements SettingsTypes.ILinkEmailRequest {
    email: string | null = null;
    read(buffer: Buffer) {
        this.email = new BufferReader(buffer).readOptionalString();
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.email).getBuffer();
    }
    static getId() {
        return -20486732;
    }
}

export class LinkAccountResultSuccess extends BasePacket implements SettingsTypes.ILinkAccountResultSuccess {
    identifier: string | null = null;
    constructor(identifier?: string | null) {
        super();
        if (identifier) this.identifier = identifier;
    }
    read(buffer: Buffer) {
        this.identifier = new BufferReader(buffer).readOptionalString();
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.identifier).getBuffer();
    }
    static getId() {
        return 2098576423;
    }
}

export class LinkAccountResultError extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { }
    write(): Buffer {
        return new BufferWriter().getBuffer();
    }
    static getId(): number {
        return -541741971;
    }
}

export class LinkAccountFailedAccountInUse extends BasePacket implements SettingsTypes.ILinkAccountFailedAccountInUse {
    method: string | null = null;
    constructor(method?: string | null) {
        super();
        if (method) this.method = method;
    }
    read(buffer: Buffer) {
        this.method = new BufferReader(buffer).readOptionalString();
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.method).getBuffer();
    }
    static getId() {
        return -20513325;
    }
}