import { BasePacket } from "@/packets/base.packet";
import { defs } from "protanki-protocol";
import { IVector3 } from "@/shared/types/geom/ivector3";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import * as ThunderTypes from "./thunder.types";

export class ThunderShotNoTargetCommandPacket extends BasePacket implements ThunderTypes.IThunderShotNoTargetCommand {
    public clientTime: number = 0;
    public read(buffer: Buffer): void {
        this.clientTime = new BufferReader(buffer).readInt32BE();
    }
    public write(): Buffer {
        throw new Error("This is a client-to-server packet only.");
    }
    public static getId(): number {
        return defs.weapons.ThunderShotNoTargetCommand.id;
    }
}

export class ThunderShotNoTargetPacket extends BasePacket implements ThunderTypes.IThunderShotNoTargetPacket {
    public nickname: string | null;
    constructor(nickname: string | null = null) {
        super();
        this.nickname = nickname;
    }
    public read(buffer: Buffer): void {
        throw new Error("This is a server-to-client packet only.");
    }
    public write(): Buffer {
        return new BufferWriter().writeOptionalString(this.nickname).getBuffer();
    }
    public static getId(): number {
        return defs.weapons.ThunderShotNoTarget.id;
    }
}

export class ThunderStaticShotCommandPacket extends BasePacket implements ThunderTypes.IThunderStaticShotCommand {
    public clientTime: number = 0;
    public position: IVector3 | null = null;
    public read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        this.clientTime = reader.readInt32BE();
        this.position = reader.readOptionalVector3();
    }
    public write(): Buffer {
        throw new Error("This is a client-to-server packet only.");
    }
    public static getId(): number {
        return defs.weapons.ThunderStaticShotCommand.id;
    }
}

export class ThunderStaticShotPacket extends BasePacket implements ThunderTypes.IThunderStaticShotPacket {
    public nickname: string | null;
    public position: IVector3 | null;
    constructor(data?: ThunderTypes.IThunderStaticShotPacketData) {
        super();
        this.nickname = data?.nickname ?? null;
        this.position = data?.position ?? null;
    }
    public read(buffer: Buffer): void {
        throw new Error("This is a server-to-client packet only.");
    }
    public write(): Buffer {
        const writer = new BufferWriter();
        writer.writeOptionalString(this.nickname);
        writer.writeOptionalVector3(this.position);
        return writer.getBuffer();
    }
    public static getId(): number {
        return defs.weapons.ThunderStaticShot.id;
    }
}

export class ThunderTargetShotCommandPacket extends BasePacket implements ThunderTypes.IThunderTargetShotCommand {
    public clientTime: number = 0;
    public internalPosition: IVector3 | null = null;
    public nicknameTarget: string | null = null;
    public incarnationTarget: number = 0;
    public positionTarget: IVector3 | null = null;
    public positionInWorld: IVector3 | null = null;
    public read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        this.clientTime = reader.readInt32BE();
        this.internalPosition = reader.readOptionalVector3();
        this.nicknameTarget = reader.readOptionalString();
        this.incarnationTarget = reader.readInt16BE();
        this.positionTarget = reader.readOptionalVector3();
        this.positionInWorld = reader.readOptionalVector3();
    }
    public write(): Buffer {
        throw new Error("This is a client-to-server packet only.");
    }
    public static getId(): number {
        return defs.weapons.ThunderTargetShotCommand.id;
    }
}

export class ThunderTargetShotPacket extends BasePacket implements ThunderTypes.IThunderTargetShotPacket {
    public nicknameShooter: string | null;
    public nicknameTarget: string | null;
    public internalPosition: IVector3 | null;
    constructor(data?: ThunderTypes.IThunderTargetShotPacketData) {
        super();
        this.nicknameShooter = data?.nicknameShooter ?? null;
        this.nicknameTarget = data?.nicknameTarget ?? null;
        this.internalPosition = data?.internalPosition ?? null;
    }
    public read(buffer: Buffer): void {
        throw new Error("This is a server-to-client packet only.");
    }
    public write(): Buffer {
        const writer = new BufferWriter();
        writer.writeOptionalString(this.nicknameShooter);
        writer.writeOptionalString(this.nicknameTarget);
        writer.writeOptionalVector3(this.internalPosition);
        return writer.getBuffer();
    }
    public static getId(): number {
        return defs.weapons.ThunderTargetShot.id;
    }
}