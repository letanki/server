import { packetClass } from "@/packets/packet-class";
import { defs } from "protanki-protocol";

// IDs e schemas em `protanki-protocol` (defs.invite.*).

export const InviteCode = packetClass(defs.invite.InviteCode);
export type InviteCode = InstanceType<typeof InviteCode>;

export const InviteCodeInvalid = packetClass(defs.invite.InviteCodeInvalid);
export type InviteCodeInvalid = InstanceType<typeof InviteCodeInvalid>;

export const InviteCodeLogin = packetClass(defs.invite.InviteCodeLogin);
export type InviteCodeLogin = InstanceType<typeof InviteCodeLogin>;

export const InviteCodeRegister = packetClass(defs.invite.InviteCodeRegister);
export type InviteCodeRegister = InstanceType<typeof InviteCodeRegister>;
