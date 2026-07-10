import { BasePacket } from "@/packets/base.packet";
import { packetClass } from "@/packets/packet-class";
import { defs, encodeBody, decodeBody } from "protanki-protocol";
import * as SettingsTypes from "./settings.types";

// IDs e schemas em `protanki-protocol` (defs.settings.*).

export const RequestSettings = packetClass(defs.settings.RequestSettings);
export type RequestSettings = InstanceType<typeof RequestSettings>;

export class UserSettingsSocial extends BasePacket implements SettingsTypes.IUserSettingsSocial {
    passwordCreated: boolean = false;
    socialLinks: SettingsTypes.ISocialLink[] = [];
    constructor(passwordCreated?: boolean, socialLinks?: SettingsTypes.ISocialLink[]) {
        super();
        if (passwordCreated !== undefined) this.passwordCreated = passwordCreated;
        if (socialLinks) this.socialLinks = socialLinks;
    }
    // Lógica: normaliza os campos nullable dos links. Bytes na lib.
    read(buffer: Buffer): void {
        const { fields } = decodeBody(defs.settings.UserSettingsSocial, buffer);
        this.passwordCreated = fields.passwordCreated;
        this.socialLinks = fields.socialLinks.map((l) => ({
            authorizationUrl: l.authorizationUrl ?? "",
            isLinked: l.isLinked,
            snId: l.snId ?? "",
        }));
    }
    write(): Buffer {
        return encodeBody(defs.settings.UserSettingsSocial, {
            passwordCreated: this.passwordCreated,
            socialLinks: this.socialLinks,
        });
    }
    static getId(): number { return defs.settings.UserSettingsSocial.id; }
}

export const UserSettingsNotifications = packetClass(defs.settings.UserSettingsNotifications);
export type UserSettingsNotifications = InstanceType<typeof UserSettingsNotifications>;

export const SetNotifications = packetClass(defs.settings.SetNotifications);
export type SetNotifications = InstanceType<typeof SetNotifications>;

export const UpdatePassword = packetClass(defs.settings.UpdatePassword);
export type UpdatePassword = InstanceType<typeof UpdatePassword>;

export const UpdatePasswordResult = packetClass(defs.settings.UpdatePasswordResult);
export type UpdatePasswordResult = InstanceType<typeof UpdatePasswordResult>;

export const RequestChangePasswordForm = packetClass(defs.settings.RequestChangePasswordForm);
export type RequestChangePasswordForm = InstanceType<typeof RequestChangePasswordForm>;

export const ChangePasswordForm = packetClass(defs.settings.ChangePasswordForm);
export type ChangePasswordForm = InstanceType<typeof ChangePasswordForm>;

export const CreatePasswordForm = packetClass(defs.settings.CreatePasswordForm);
export type CreatePasswordForm = InstanceType<typeof CreatePasswordForm>;

export const LinkEmailRequest = packetClass(defs.settings.LinkEmailRequest);
export type LinkEmailRequest = InstanceType<typeof LinkEmailRequest>;

export const LinkAccountResultSuccess = packetClass(defs.settings.LinkAccountResultSuccess);
export type LinkAccountResultSuccess = InstanceType<typeof LinkAccountResultSuccess>;

export const LinkAccountResultError = packetClass(defs.settings.LinkAccountResultError);
export type LinkAccountResultError = InstanceType<typeof LinkAccountResultError>;

export const LinkAccountFailedAccountInUse = packetClass(defs.settings.LinkAccountFailedAccountInUse);
export type LinkAccountFailedAccountInUse = InstanceType<typeof LinkAccountFailedAccountInUse>;
