import { BasePacket } from "@/packets/base.packet";
import { PacketSchema, readSchema, writeSchema } from "@/packets/packet-schema";
import { IEmpty } from "@/packets/packet.interfaces";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import * as InviteTypes from "./invite.types";

export class InviteCode extends BasePacket implements InviteTypes.IInviteCode {
    static readonly schema: PacketSchema = [
        { name: "inviteCode", type: "string" },
    ];
    inviteCode: string | null;

    constructor(inviteCode: string | null = null) {
        super();
        this.inviteCode = inviteCode;
    }

    read(buffer: Buffer): void { readSchema(this, InviteCode.schema, buffer); }

    write(): Buffer { return writeSchema(this, InviteCode.schema); }

    static getId(): number {
        return 509394385;
    }
}

export class InviteCodeInvalid extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { }

    write(): Buffer {
        return new BufferWriter().getBuffer();
    }

    static getId(): number {
        return 312571157;
    }
}

export class InviteCodeLogin extends BasePacket implements InviteTypes.IInviteCodeLogin {
    static readonly schema: PacketSchema = [
        { name: "nickname", type: "string" },
    ];
    nickname: string | null = null;

    constructor(nickname?: string | null) {
        super();
        if (nickname) {
            this.nickname = nickname;
        }
    }

    read(buffer: Buffer): void { readSchema(this, InviteCodeLogin.schema, buffer); }

    write(): Buffer { return writeSchema(this, InviteCodeLogin.schema); }

    static getId(): number {
        return 714838911;
    }
}

export class InviteCodeRegister extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { }

    write(): Buffer {
        return new BufferWriter().getBuffer();
    }

    static getId(): number {
        return 184934482;
    }
}