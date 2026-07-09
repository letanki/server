import { BasePacket } from "@/packets/base.packet";
import { readSchema, writeSchema } from "@/packets/packet-schema";
import { IEmpty } from "@/packets/packet.interfaces";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import { defs } from "protanki-protocol";
import * as SettingsTypes from "./settings.types";

// IDs e schemas em `protanki-protocol` (defs.settings.*).

export class RequestSettings extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { readSchema(this, defs.settings.RequestSettings.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.settings.RequestSettings.schema!); }
    static getId(): number { return defs.settings.RequestSettings.id; }
}

export class UserSettingsSocial extends BasePacket implements SettingsTypes.IUserSettingsSocial {
    passwordCreated: boolean = false;
    socialLinks: SettingsTypes.ISocialLink[] = [];
    constructor(passwordCreated?: boolean, socialLinks?: SettingsTypes.ISocialLink[]) {
        super();
        if (passwordCreated !== undefined) this.passwordCreated = passwordCreated;
        if (socialLinks) this.socialLinks = socialLinks;
    }
    // Codec manual (lista de social links).
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
    static getId(): number { return defs.settings.UserSettingsSocial.id; }
}

export class UserSettingsNotifications extends BasePacket implements SettingsTypes.IUserSettingsNotifications {
    notificationsEnabled: boolean = false;
    constructor(enabled?: boolean) { super(); if (enabled !== undefined) this.notificationsEnabled = enabled; }
    read(buffer: Buffer): void { readSchema(this, defs.settings.UserSettingsNotifications.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.settings.UserSettingsNotifications.schema!); }
    static getId(): number { return defs.settings.UserSettingsNotifications.id; }
}

export class SetNotifications extends BasePacket implements SettingsTypes.ISetNotifications {
    enabled: boolean = false;
    read(buffer: Buffer): void { readSchema(this, defs.settings.SetNotifications.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.settings.SetNotifications.schema!); }
    static getId(): number { return defs.settings.SetNotifications.id; }
}

export class UpdatePassword extends BasePacket implements SettingsTypes.IUpdatePassword {
    password: string | null = null;
    email: string | null = null;
    read(buffer: Buffer): void { readSchema(this, defs.settings.UpdatePassword.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.settings.UpdatePassword.schema!); }
    static getId() { return defs.settings.UpdatePassword.id; }
}

export class UpdatePasswordResult extends BasePacket implements SettingsTypes.IUpdatePasswordResult {
    isError: boolean = false;
    message: string | null = null;
    constructor(isError?: boolean, message?: string | null) {
        super();
        if (isError !== undefined) this.isError = isError;
        if (message) this.message = message;
    }
    read(buffer: Buffer): void { readSchema(this, defs.settings.UpdatePasswordResult.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.settings.UpdatePasswordResult.schema!); }
    static getId() { return defs.settings.UpdatePasswordResult.id; }
}

export class RequestChangePasswordForm extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { readSchema(this, defs.settings.RequestChangePasswordForm.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.settings.RequestChangePasswordForm.schema!); }
    static getId(): number { return defs.settings.RequestChangePasswordForm.id; }
}

export class ChangePasswordForm extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { readSchema(this, defs.settings.ChangePasswordForm.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.settings.ChangePasswordForm.schema!); }
    static getId(): number { return defs.settings.ChangePasswordForm.id; }
}

export class CreatePasswordForm extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { readSchema(this, defs.settings.CreatePasswordForm.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.settings.CreatePasswordForm.schema!); }
    static getId(): number { return defs.settings.CreatePasswordForm.id; }
}

export class LinkEmailRequest extends BasePacket implements SettingsTypes.ILinkEmailRequest {
    email: string | null = null;
    read(buffer: Buffer) { readSchema(this, defs.settings.LinkEmailRequest.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.settings.LinkEmailRequest.schema!); }
    static getId() { return defs.settings.LinkEmailRequest.id; }
}

export class LinkAccountResultSuccess extends BasePacket implements SettingsTypes.ILinkAccountResultSuccess {
    identifier: string | null = null;
    constructor(identifier?: string | null) { super(); if (identifier) this.identifier = identifier; }
    read(buffer: Buffer) { readSchema(this, defs.settings.LinkAccountResultSuccess.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.settings.LinkAccountResultSuccess.schema!); }
    static getId() { return defs.settings.LinkAccountResultSuccess.id; }
}

export class LinkAccountResultError extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { readSchema(this, defs.settings.LinkAccountResultError.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.settings.LinkAccountResultError.schema!); }
    static getId(): number { return defs.settings.LinkAccountResultError.id; }
}

export class LinkAccountFailedAccountInUse extends BasePacket implements SettingsTypes.ILinkAccountFailedAccountInUse {
    method: string | null = null;
    constructor(method?: string | null) { super(); if (method) this.method = method; }
    read(buffer: Buffer) { readSchema(this, defs.settings.LinkAccountFailedAccountInUse.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.settings.LinkAccountFailedAccountInUse.schema!); }
    static getId() { return defs.settings.LinkAccountFailedAccountInUse.id; }
}
