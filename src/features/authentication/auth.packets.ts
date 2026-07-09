import { BasePacket } from "@/packets/base.packet";
import { readSchema, writeSchema } from "@/packets/packet-schema";
import { IEmpty } from "@/packets/packet.interfaces";
import { defs } from "protanki-protocol";
import * as AuthTypes from "./auth.types";

// IDs e schemas vêm da lib compartilhada `protanki-protocol` (defs.auth.*),
// fonte única também consumida pelo protanki-bridge. As classes mantêm seus
// construtores/campos; read/write/getId apenas referenciam a definição.

export class Language extends BasePacket implements AuthTypes.ILanguage {
    lang: string | null;
    constructor(lang: string | null = null) {
        super();
        this.lang = lang;
    }
    read(buffer: Buffer): void { readSchema(this, defs.auth.Language.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.auth.Language.schema!); }
    static getId() { return defs.auth.Language.id; }
}

export class CreateAccount extends BasePacket implements AuthTypes.ICreateAccount {
    nickname: string | null = null;
    password: string | null = null;
    rememberMe: boolean = false;
    read(buffer: Buffer): void { readSchema(this, defs.auth.CreateAccount.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.auth.CreateAccount.schema!); }
    static getId() { return defs.auth.CreateAccount.id; }
}

export class Login extends BasePacket implements AuthTypes.ILogin {
    username: string | null = null;
    password: string | null = null;
    rememberMe: boolean = false;
    read(buffer: Buffer): void { readSchema(this, defs.auth.Login.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.auth.Login.schema!); }
    static getId() { return defs.auth.Login.id; }
}

export class LoginByTokenRequestPacket extends BasePacket implements AuthTypes.ILoginByTokenRequest {
    hash: string | null;
    constructor(hash: string | null = null) {
        super();
        this.hash = hash;
    }
    read(buffer: Buffer): void { readSchema(this, defs.auth.LoginByTokenRequest.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.auth.LoginByTokenRequest.schema!); }
    static getId() { return defs.auth.LoginByTokenRequest.id; }
}

export class LoginTokenPacket extends BasePacket implements AuthTypes.ILoginToken {
    hash: string | null;
    constructor(hash: string | null = null) {
        super();
        this.hash = hash;
    }
    read(buffer: Buffer): void { readSchema(this, defs.auth.LoginToken.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.auth.LoginToken.schema!); }
    static getId() { return defs.auth.LoginToken.id; }
}

export class IncorrectPassword extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { readSchema(this, defs.auth.IncorrectPassword.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.auth.IncorrectPassword.schema!); }
    static getId() { return defs.auth.IncorrectPassword.id; }
}

export class CheckNicknameAvailable extends BasePacket implements AuthTypes.ICheckNicknameAvailable {
    nickname: string | null;
    constructor(nickname: string | null) {
        super();
        this.nickname = nickname;
    }
    read(buffer: Buffer): void { readSchema(this, defs.auth.CheckNicknameAvailable.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.auth.CheckNicknameAvailable.schema!); }
    static getId() { return defs.auth.CheckNicknameAvailable.id; }
}

export class NicknameAvailable extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { readSchema(this, defs.auth.NicknameAvailable.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.auth.NicknameAvailable.schema!); }
    static getId() { return defs.auth.NicknameAvailable.id; }
}

export class NicknameUnavailable extends BasePacket implements AuthTypes.INicknameUnavailable {
    suggestions: string[] | null = null;
    constructor(suggestions?: string[] | null) {
        super();
        if (suggestions) {
            this.suggestions = suggestions;
        }
    }
    read(buffer: Buffer): void { readSchema(this, defs.auth.NicknameUnavailable.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.auth.NicknameUnavailable.schema!); }
    static getId() { return defs.auth.NicknameUnavailable.id; }
}

export class InvalidNickname extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { readSchema(this, defs.auth.InvalidNickname.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.auth.InvalidNickname.schema!); }
    static getId() { return defs.auth.InvalidNickname.id; }
}

export class RequestCaptcha extends BasePacket implements AuthTypes.IRequestCaptcha {
    view: number;
    constructor(view: number = 0) {
        super();
        this.view = view;
    }
    read(buffer: Buffer): void { readSchema(this, defs.auth.RequestCaptcha.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.auth.RequestCaptcha.schema!); }
    static getId() { return defs.auth.RequestCaptcha.id; }
}

export class Captcha extends BasePacket implements AuthTypes.ICaptcha {
    view: number;
    image: Buffer;
    constructor(view: number = 0, image: Buffer = Buffer.alloc(0)) {
        super();
        this.view = view;
        this.image = image;
    }
    read(buffer: Buffer): void { readSchema(this, defs.auth.Captcha.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.auth.Captcha.schema!); }
    static getId() { return defs.auth.Captcha.id; }
}

export class CaptchaVerify extends BasePacket implements AuthTypes.ICaptchaVerify {
    view: number;
    solution: string | null;
    constructor(view: number = 0, solution: string | null) {
        super();
        this.view = view;
        this.solution = solution;
    }
    read(buffer: Buffer): void { readSchema(this, defs.auth.CaptchaVerify.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.auth.CaptchaVerify.schema!); }
    static getId() { return defs.auth.CaptchaVerify.id; }
}

export class CaptchaIsValid extends BasePacket implements AuthTypes.ICaptchaView {
    view: number = 0;
    constructor(view?: number) {
        super();
        if (view !== undefined) this.view = view;
    }
    read(buffer: Buffer): void { readSchema(this, defs.auth.CaptchaIsValid.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.auth.CaptchaIsValid.schema!); }
    static getId() { return defs.auth.CaptchaIsValid.id; }
}

export class CaptchaIsInvalid extends BasePacket implements AuthTypes.ICaptcha {
    view: number = 0;
    image: Buffer = Buffer.alloc(0);
    constructor(view?: number, image?: Buffer) {
        super();
        if (view !== undefined) this.view = view;
        if (image) this.image = image;
    }
    read(buffer: Buffer): void { readSchema(this, defs.auth.CaptchaIsInvalid.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.auth.CaptchaIsInvalid.schema!); }
    static getId() { return defs.auth.CaptchaIsInvalid.id; }
}

export class RecoveryAccountSendCode extends BasePacket implements AuthTypes.IRecoveryAccountSendCode {
    email: string | null;
    constructor(email: string | null) {
        super();
        this.email = email;
    }
    read(buffer: Buffer): void { readSchema(this, defs.auth.RecoveryAccountSendCode.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.auth.RecoveryAccountSendCode.schema!); }
    static getId() { return defs.auth.RecoveryAccountSendCode.id; }
}

export class RecoveryEmailSent extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { readSchema(this, defs.auth.RecoveryEmailSent.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.auth.RecoveryEmailSent.schema!); }
    static getId() { return defs.auth.RecoveryEmailSent.id; }
}

export class RecoveryEmailNotExists extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { readSchema(this, defs.auth.RecoveryEmailNotExists.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.auth.RecoveryEmailNotExists.schema!); }
    static getId() { return defs.auth.RecoveryEmailNotExists.id; }
}

export class RecoveryAccountVerifyCode extends BasePacket implements AuthTypes.IRecoveryAccountVerifyCode {
    code: string | null;
    constructor(code: string | null) {
        super();
        this.code = code;
    }
    read(buffer: Buffer): void { readSchema(this, defs.auth.RecoveryAccountVerifyCode.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.auth.RecoveryAccountVerifyCode.schema!); }
    static getId() { return defs.auth.RecoveryAccountVerifyCode.id; }
}

export class RecoveryEmailInvalidCode extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { readSchema(this, defs.auth.RecoveryEmailInvalidCode.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.auth.RecoveryEmailInvalidCode.schema!); }
    static getId() { return defs.auth.RecoveryEmailInvalidCode.id; }
}

export class GoToRecoveryPassword extends BasePacket implements AuthTypes.IGoToRecoveryPassword {
    email: string | null = null;
    constructor(email?: string | null) {
        super();
        if (email) this.email = email;
    }
    read(buffer: Buffer): void { readSchema(this, defs.auth.GoToRecoveryPassword.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.auth.GoToRecoveryPassword.schema!); }
    static getId() { return defs.auth.GoToRecoveryPassword.id; }
}

export class HideLoginForm extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { readSchema(this, defs.auth.HideLoginForm.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.auth.HideLoginForm.schema!); }
    static getId(): number { return defs.auth.HideLoginForm.id; }
}

export class Punishment extends BasePacket implements AuthTypes.IPunishment {
    reason: string | null = null;
    days: number = 0;
    hours: number = 0;
    minutes: number = 0;

    constructor(reason?: string | null, days?: number, hours?: number, minutes?: number) {
        super();
        if (reason) this.reason = reason;
        if (days !== undefined) this.days = days;
        if (hours !== undefined) this.hours = hours;
        if (minutes !== undefined) this.minutes = minutes;
    }

    read(buffer: Buffer): void { readSchema(this, defs.auth.Punishment.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.auth.Punishment.schema!); }
    static getId(): number { return defs.auth.Punishment.id; }
}

export class Registration extends BasePacket implements AuthTypes.IRegistration {
    bgResource: number;
    enableRequiredEmail: boolean;
    maxPasswordLength: number;
    minPasswordLength: number;

    constructor(bgResource: number = 0, enableRequiredEmail: boolean = false, maxPasswordLength: number = 0, minPasswordLength: number = 0) {
        super();
        this.bgResource = bgResource;
        this.enableRequiredEmail = enableRequiredEmail;
        this.maxPasswordLength = maxPasswordLength;
        this.minPasswordLength = minPasswordLength;
    }

    read(buffer: Buffer): void { readSchema(this, defs.auth.Registration.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.auth.Registration.schema!); }
    static getId(): number { return defs.auth.Registration.id; }
}
