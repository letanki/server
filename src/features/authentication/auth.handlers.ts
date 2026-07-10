import { LobbyWorkflow } from "@/features/lobby/lobby.workflow";
import { SystemMessage } from "@/features/system/system.packets";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import generateCaptcha from "@/utils/captcha.generator";
import logger from "@/utils/logger";
import { ValidationUtils } from "@/utils/validation.utils";
import crypto from "crypto";
import * as AuthPackets from "./auth.packets";
import { AuthWorkflow } from "./auth.workflow";

export class CreateAccountHandler implements IPacketHandler<AuthPackets.CreateAccount> {
    public readonly packetId = AuthPackets.CreateAccount.getId();
    public async execute(client: GameClient, server: GameServer, packet: AuthPackets.CreateAccount): Promise<void> {
        if (!packet.nickname || !packet.password || packet.nickname.length < 3 || packet.password.length < 3) {
            client.sendPacket(new SystemMessage({ text: "Apelido ou senha inválidos." }));
            return;
        }
        if (ValidationUtils.isNicknameInappropriate(packet.nickname)) {
            client.sendPacket(new AuthPackets.InvalidNickname());
            return;
        }
        try {
            const user = await server.authService.createUser({
                username: packet.nickname,
                password: packet.password,
            });
            client.user = user;
            logger.info(`Account created and auto-logged in for ${packet.nickname}`, { client: client.getRemoteAddress() });
            const flowHandled = await LobbyWorkflow.postAuthenticationFlow(client, server);
            if (flowHandled && packet.rememberMe) {
                const token = await server.authService.generateAndSetLoginToken(user);
                client.sendPacket(new AuthPackets.LoginTokenPacket({ hash: token }));
            }
        } catch (error: any) {
            logger.warn(`Failed to create account for ${packet.nickname}`, { error: error.message, client: client.getRemoteAddress() });
            if (error.message.includes("already exists")) {
                const suggestions = await server.userService.generateUsernameSuggestions(packet.nickname);
                client.sendPacket(new AuthPackets.NicknameUnavailable({ suggestions }));
            } else {
                client.sendPacket(new SystemMessage({ text: "Ocorreu um erro ao criar a conta.\nTente novamente." }));
            }
        }
    }
}

export class LoginHandler implements IPacketHandler<AuthPackets.Login> {
    public readonly packetId = AuthPackets.Login.getId();
    public async execute(client: GameClient, server: GameServer, packet: AuthPackets.Login): Promise<void> {
        if (!packet.username || !packet.password) {
            client.sendPacket(new AuthPackets.IncorrectPassword());
            return;
        }
        try {
            const user = await server.authService.login(packet.username, packet.password);
            client.user = user;
            logger.info(`Successful login for user ${user.username}`, { client: client.getRemoteAddress() });
            const flowHandled = await LobbyWorkflow.postAuthenticationFlow(client, server);
            if (flowHandled && packet.rememberMe) {
                const token = await server.authService.generateAndSetLoginToken(user);
                client.sendPacket(new AuthPackets.LoginTokenPacket({ hash: token }));
            }
        } catch (error: any) {
            logger.warn(`Failed login attempt for username ${packet.username}`, { error: error.message, client: client.getRemoteAddress() });
            client.sendPacket(new AuthPackets.IncorrectPassword());
        }
    }
}

export class LoginByTokenHandler implements IPacketHandler<AuthPackets.LoginByTokenRequestPacket> {
    public readonly packetId = AuthPackets.LoginByTokenRequestPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: AuthPackets.LoginByTokenRequestPacket): Promise<void> {
        if (!packet.hash) {
            client.sendPacket(new SystemMessage({ text: "Token de login inválido." }));
            return;
        }
        try {
            const user = await server.authService.findUserByLoginToken(packet.hash);
            if (!user) {
                throw new Error("Token de login inválido ou expirado.");
            }
            client.user = user;
            logger.info(`Successful login via token for user ${user.username}`, { client: client.getRemoteAddress() });
            await LobbyWorkflow.postAuthenticationFlow(client, server);
        } catch (error: any) {
            logger.warn(`Failed login attempt via token`, { error: error.message, client: client.getRemoteAddress() });
            client.sendPacket(new SystemMessage(error.message));
        }
    }
}

export class CheckNicknameAvailableHandler implements IPacketHandler<AuthPackets.CheckNicknameAvailable> {
    public readonly packetId = AuthPackets.CheckNicknameAvailable.getId();
    public async execute(client: GameClient, server: GameServer, packet: AuthPackets.CheckNicknameAvailable): Promise<void> {
        if (!packet.nickname || packet.nickname.length < 3) return;
        if (ValidationUtils.isNicknameInappropriate(packet.nickname)) {
            client.sendPacket(new AuthPackets.InvalidNickname());
            return;
        }
        const isAvailable = await server.userService.isUsernameAvailable(packet.nickname);
        if (isAvailable) {
            client.sendPacket(new AuthPackets.NicknameAvailable());
        } else {
            const suggestions = await server.userService.generateUsernameSuggestions(packet.nickname);
            client.sendPacket(new AuthPackets.NicknameUnavailable({ suggestions }));
        }
    }
}

export class RequestCaptchaHandler implements IPacketHandler<AuthPackets.RequestCaptcha> {
    public readonly packetId = AuthPackets.RequestCaptcha.getId();
    public execute(client: GameClient, server: GameServer, packet: AuthPackets.RequestCaptcha): void {
        const captcha = generateCaptcha();
        client.captchaSolution = captcha.text;
        client.sendPacket(new AuthPackets.Captcha({ view: packet.view, image: captcha.image }));
    }
}

export class CaptchaVerifyHandler implements IPacketHandler<AuthPackets.CaptchaVerify> {
    public readonly packetId = AuthPackets.CaptchaVerify.getId();
    public execute(client: GameClient, server: GameServer, packet: AuthPackets.CaptchaVerify): void {
        if (packet.solution && client.captchaSolution === packet.solution.toLowerCase()) {
            client.sendPacket(new AuthPackets.CaptchaIsValid({ view: packet.view }));
            return;
        }
        const captcha = generateCaptcha();
        client.captchaSolution = captcha.text;
        client.sendPacket(new AuthPackets.CaptchaIsInvalid({ view: packet.view, image: captcha.image }));
    }
}

export class RecoveryAccountSendCodeHandler implements IPacketHandler<AuthPackets.RecoveryAccountSendCode> {
    public readonly packetId = AuthPackets.RecoveryAccountSendCode.getId();
    public async execute(client: GameClient, server: GameServer, packet: AuthPackets.RecoveryAccountSendCode): Promise<void> {
        if (!packet.email) {
            client.sendPacket(new AuthPackets.RecoveryEmailNotExists());
            return;
        }
        logger.info(`Recovery code requested for email: ${packet.email}`, { client: client.getRemoteAddress() });
        try {
            const user = await server.userService.findUserByEmail(packet.email);
            if (user) {
                const recoveryCode = crypto.randomBytes(16).toString("hex");
                logger.info(`Recovery email sent to: ${packet.email}, code: ${recoveryCode}`);
                client.recoveryEmail = packet.email;
                client.recoveryCode = recoveryCode;
                client.sendPacket(new AuthPackets.RecoveryEmailSent());
            } else {
                logger.info(`Email not found: ${packet.email}`);
                client.sendPacket(new AuthPackets.RecoveryEmailNotExists());
            }
        } catch (error) {
            logger.error(`Error checking email ${packet.email}`, { error });
            client.sendPacket(new AuthPackets.RecoveryEmailNotExists());
        }
    }
}

export class RecoveryAccountVerifyCodeHandler implements IPacketHandler<AuthPackets.RecoveryAccountVerifyCode> {
    public readonly packetId = AuthPackets.RecoveryAccountVerifyCode.getId();
    public execute(client: GameClient, server: GameServer, packet: AuthPackets.RecoveryAccountVerifyCode): void {
        if (client.recoveryCode && client.recoveryCode === packet.code) {
            client.sendPacket(new AuthPackets.GoToRecoveryPassword({ email: client.recoveryEmail }));
        } else {
            AuthWorkflow.handleInvalidRecoveryCode(client);
        }
    }
}

export class LanguageHandler implements IPacketHandler<AuthPackets.Language> {
    public readonly packetId = AuthPackets.Language.getId();

    public async execute(client: GameClient, server: GameServer, packet: AuthPackets.Language): Promise<void> {
        client.language = packet.lang;
        logger.info(`Setting language to: ${packet.lang}`, {
            client: client.getRemoteAddress(),
        });

        await AuthWorkflow.sendLoginScreenData(client, server);
    }
}