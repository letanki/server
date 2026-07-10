import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import logger from "@/utils/logger";
import * as SettingsPackets from "./settings.packets";
import { ISocialLink } from "./settings.types";

export class RequestSettingsHandler implements IPacketHandler<SettingsPackets.RequestSettings> {
    public readonly packetId = SettingsPackets.RequestSettings.getId();

    public execute(client: GameClient, server: GameServer): void {
        if (!client.user) {
            logger.warn("RequestSettings received from unauthenticated client.", { client: client.getRemoteAddress() });
            return;
        }

        const socialAuthConfig = server.configService.getSocialAuthLinks();
        const socialLinks: ISocialLink[] = Object.entries(socialAuthConfig).map(([id, url]) => ({
            snId: id,
            authorizationUrl: url as string,
            isLinked: false,
        }));

        const passwordCreated = !!client.user.password;

        client.sendPacket(new SettingsPackets.UserSettingsSocial(passwordCreated, socialLinks));
        client.sendPacket(new SettingsPackets.UserSettingsNotifications({ notificationsEnabled: client.user.notificationsEnabled }));
    }
}

export class SetNotificationsHandler implements IPacketHandler<SettingsPackets.SetNotifications> {
    public readonly packetId = SettingsPackets.SetNotifications.getId();

    public async execute(client: GameClient, server: GameServer, packet: SettingsPackets.SetNotifications): Promise<void> {
        if (!client.user) {
            logger.warn("SetNotifications received from unauthenticated client.", { client: client.getRemoteAddress() });
            return;
        }
        client.user = await server.settingsService.setNotifications(client.user, packet.enabled);
    }
}

export class UpdatePasswordHandler implements IPacketHandler<SettingsPackets.UpdatePassword> {
    public readonly packetId = SettingsPackets.UpdatePassword.getId();
    public async execute(client: GameClient, server: GameServer, packet: SettingsPackets.UpdatePassword): Promise<void> {
        const originalEmail = client.recoveryEmail;
        if (!originalEmail || !packet.password || !packet.email) {
            client.sendPacket(new SettingsPackets.UpdatePasswordResult({ isError: true, message: "Dados inválidos." }));
            return;
        }
        try {
            await server.settingsService.updatePasswordByEmail(originalEmail, packet.password, packet.email);
            logger.info(`Password updated for user with original email ${originalEmail}`, { client: client.getRemoteAddress(), newEmail: packet.email });
            client.sendPacket(new SettingsPackets.UpdatePasswordResult({ isError: false, message: "Sua senha foi alterada com sucesso." }));
        } catch (error: any) {
            logger.error(`Failed to update password for ${originalEmail}`, { error: error.message });
            if (error.message.includes("is already in use")) {
                client.sendPacket(new SettingsPackets.UpdatePasswordResult({ isError: true, message: "O e-mail fornecido já está em uso por outra conta." }));
            } else {
                client.sendPacket(new SettingsPackets.UpdatePasswordResult({ isError: true, message: "Ocorreu um erro ao atualizar sua senha." }));
            }
        }
    }
}

export class RequestChangePasswordFormHandler implements IPacketHandler<SettingsPackets.RequestChangePasswordForm> {
    public readonly packetId = SettingsPackets.RequestChangePasswordForm.getId();
    public execute(client: GameClient, server: GameServer): void {
        if (!client.user) {
            logger.warn("RequestChangePasswordForm received from unauthenticated client.", { client: client.getRemoteAddress() });
            return;
        }
        const passwordCreated = !!client.user.password;
        if (passwordCreated) {
            client.sendPacket(new SettingsPackets.ChangePasswordForm());
        } else {
            client.sendPacket(new SettingsPackets.CreatePasswordForm());
        }
    }
}

export class LinkEmailRequestHandler implements IPacketHandler<SettingsPackets.LinkEmailRequest> {
    public readonly packetId = SettingsPackets.LinkEmailRequest.getId();
    public async execute(client: GameClient, server: GameServer, packet: SettingsPackets.LinkEmailRequest): Promise<void> {
        const currentUser = client.user;
        if (!currentUser || !packet.email) return;
        try {
            const updatedUser = await server.settingsService.linkEmailToAccount(currentUser, packet.email);
            client.user = updatedUser;
            client.sendPacket(new SettingsPackets.LinkAccountResultSuccess({ identifier: updatedUser.email ?? null }));
        } catch (error: any) {
            if (error.message === "EMAIL_IN_USE") {
                client.sendPacket(new SettingsPackets.LinkAccountFailedAccountInUse({ method: "email" }));
            } else {
                logger.error(`Failed to link email for user ${currentUser.username}`, { error: error.message, client: client.getRemoteAddress() });
                client.sendPacket(new SettingsPackets.LinkAccountResultError());
            }
        }
    }
}