import { BasePacket } from "@/packets/base.packet";
import { readSchema, writeSchema } from "@/packets/packet-schema";
import { IEmpty } from "@/packets/packet.interfaces";
import { defs } from "protanki-protocol";
import * as InviteTypes from "./invite.types";

// IDs e schemas em `protanki-protocol` (defs.invite.*).

export class InviteCode extends BasePacket implements InviteTypes.IInviteCode {
    inviteCode: string | null;
    constructor(inviteCode: string | null = null) { super(); this.inviteCode = inviteCode; }
    read(buffer: Buffer): void { readSchema(this, defs.invite.InviteCode.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.invite.InviteCode.schema!); }
    static getId(): number { return defs.invite.InviteCode.id; }
}

export class InviteCodeInvalid extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { readSchema(this, defs.invite.InviteCodeInvalid.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.invite.InviteCodeInvalid.schema!); }
    static getId(): number { return defs.invite.InviteCodeInvalid.id; }
}

export class InviteCodeLogin extends BasePacket implements InviteTypes.IInviteCodeLogin {
    nickname: string | null = null;
    constructor(nickname?: string | null) { super(); if (nickname) { this.nickname = nickname; } }
    read(buffer: Buffer): void { readSchema(this, defs.invite.InviteCodeLogin.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.invite.InviteCodeLogin.schema!); }
    static getId(): number { return defs.invite.InviteCodeLogin.id; }
}

export class InviteCodeRegister extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { readSchema(this, defs.invite.InviteCodeRegister.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.invite.InviteCodeRegister.schema!); }
    static getId(): number { return defs.invite.InviteCodeRegister.id; }
}
