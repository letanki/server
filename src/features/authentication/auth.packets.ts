import { packetClass } from "@/packets/packet-class";
import { defs } from "protanki-protocol";

// IDs e schemas em `protanki-protocol` (defs.auth.*).
// Classes finas geradas a partir das defs compartilhadas (id + schema + direção).

export const Language = packetClass(defs.auth.Language);
export type Language = InstanceType<typeof Language>;

export const CreateAccount = packetClass(defs.auth.CreateAccount);
export type CreateAccount = InstanceType<typeof CreateAccount>;

export const Login = packetClass(defs.auth.Login);
export type Login = InstanceType<typeof Login>;

export const LoginByTokenRequestPacket = packetClass(defs.auth.LoginByTokenRequest);
export type LoginByTokenRequestPacket = InstanceType<typeof LoginByTokenRequestPacket>;

export const LoginTokenPacket = packetClass(defs.auth.LoginToken);
export type LoginTokenPacket = InstanceType<typeof LoginTokenPacket>;

export const IncorrectPassword = packetClass(defs.auth.IncorrectPassword);
export type IncorrectPassword = InstanceType<typeof IncorrectPassword>;

export const CheckNicknameAvailable = packetClass(defs.auth.CheckNicknameAvailable);
export type CheckNicknameAvailable = InstanceType<typeof CheckNicknameAvailable>;

export const NicknameAvailable = packetClass(defs.auth.NicknameAvailable);
export type NicknameAvailable = InstanceType<typeof NicknameAvailable>;

export const NicknameUnavailable = packetClass(defs.auth.NicknameUnavailable);
export type NicknameUnavailable = InstanceType<typeof NicknameUnavailable>;

export const InvalidNickname = packetClass(defs.auth.InvalidNickname);
export type InvalidNickname = InstanceType<typeof InvalidNickname>;

export const RequestCaptcha = packetClass(defs.auth.RequestCaptcha);
export type RequestCaptcha = InstanceType<typeof RequestCaptcha>;

export const Captcha = packetClass(defs.auth.Captcha);
export type Captcha = InstanceType<typeof Captcha>;

export const CaptchaVerify = packetClass(defs.auth.CaptchaVerify);
export type CaptchaVerify = InstanceType<typeof CaptchaVerify>;

export const CaptchaIsValid = packetClass(defs.auth.CaptchaIsValid);
export type CaptchaIsValid = InstanceType<typeof CaptchaIsValid>;

export const CaptchaIsInvalid = packetClass(defs.auth.CaptchaIsInvalid);
export type CaptchaIsInvalid = InstanceType<typeof CaptchaIsInvalid>;

export const RecoveryAccountSendCode = packetClass(defs.auth.RecoveryAccountSendCode);
export type RecoveryAccountSendCode = InstanceType<typeof RecoveryAccountSendCode>;

export const RecoveryEmailSent = packetClass(defs.auth.RecoveryEmailSent);
export type RecoveryEmailSent = InstanceType<typeof RecoveryEmailSent>;

export const RecoveryEmailNotExists = packetClass(defs.auth.RecoveryEmailNotExists);
export type RecoveryEmailNotExists = InstanceType<typeof RecoveryEmailNotExists>;

export const RecoveryAccountVerifyCode = packetClass(defs.auth.RecoveryAccountVerifyCode);
export type RecoveryAccountVerifyCode = InstanceType<typeof RecoveryAccountVerifyCode>;

export const RecoveryEmailInvalidCode = packetClass(defs.auth.RecoveryEmailInvalidCode);
export type RecoveryEmailInvalidCode = InstanceType<typeof RecoveryEmailInvalidCode>;

export const GoToRecoveryPassword = packetClass(defs.auth.GoToRecoveryPassword);
export type GoToRecoveryPassword = InstanceType<typeof GoToRecoveryPassword>;

export const HideLoginForm = packetClass(defs.auth.HideLoginForm);
export type HideLoginForm = InstanceType<typeof HideLoginForm>;

export const Punishment = packetClass(defs.auth.Punishment);
export type Punishment = InstanceType<typeof Punishment>;

export const Registration = packetClass(defs.auth.Registration);
export type Registration = InstanceType<typeof Registration>;
