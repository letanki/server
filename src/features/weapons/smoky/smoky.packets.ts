import { BasePacket } from "@/packets/base.packet";
import { defs } from "protanki-protocol";
import { IVector3 } from "@/shared/types/geom/ivector3";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import * as SmokyTypes from "./smoky.types";

export class SmokyStaticShotCommandPacket extends BasePacket implements SmokyTypes.ISmokyStaticShotCommand {
    public clientTime: number = 0;
    public hitPosition: IVector3 | null = null;
    public read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        this.clientTime = reader.readInt32BE();
        this.hitPosition = reader.readOptionalVector3();
    }
    public write(): Buffer {
        throw new Error("This is a client-to-server packet only.");
    }
    public static getId(): number {
        return defs.weapons.SmokyStaticShotCommand.id;
    }
}

export class SmokyStaticShotPacket extends BasePacket implements SmokyTypes.ISmokyStaticShotPacket {
    public nickname: string | null;
    public hitPosition: IVector3 | null;
    constructor(nickname: string | null = null, hitPosition: IVector3 | null = null) {
        super();
        this.nickname = nickname;
        this.hitPosition = hitPosition;
    }
    public read(buffer: Buffer): void {
        throw new Error("This is a server-to-client packet only.");
    }
    public write(): Buffer {
        const writer = new BufferWriter();
        writer.writeOptionalString(this.nickname);
        writer.writeOptionalVector3(this.hitPosition);
        return writer.getBuffer();
    }
    public static getId(): number {
        return defs.weapons.SmokyStaticShot.id;
    }
}

export class SmokyTargetShotCommandPacket extends BasePacket implements SmokyTypes.ISmokyTargetShotCommand {
    public clientTime: number = 0;
    public targetUserId: string | null = null;
    public targetIncarnation: number = 0;
    public targetPosition: IVector3 | null = null;
    public hitLocalPosition: IVector3 | null = null;
    public hitGlobalPosition: IVector3 | null = null;
    public read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        this.clientTime = reader.readInt32BE();
        this.targetUserId = reader.readOptionalString();
        this.targetIncarnation = reader.readInt16BE();
        this.targetPosition = reader.readOptionalVector3();
        this.hitLocalPosition = reader.readOptionalVector3();
        this.hitGlobalPosition = reader.readOptionalVector3();
    }
    public write(): Buffer {
        throw new Error("This is a client-to-server packet only.");
    }
    public static getId(): number {
        return defs.weapons.SmokyTargetShotCommand.id;
    }
}

export class SmokyTargetShotPacket extends BasePacket implements SmokyTypes.ISmokyTargetShotPacket {
    public nickname: string | null;
    public targetNickname: string | null;
    public hitPosition: IVector3 | null;
    public impactForce: number;
    public critical: boolean;
    constructor(data?: Partial<SmokyTypes.ISmokyTargetShotPacket>) {
        super();
        this.nickname = data?.nickname ?? null;
        this.targetNickname = data?.targetNickname ?? null;
        this.hitPosition = data?.hitPosition ?? null;
        this.impactForce = data?.impactForce ?? 0;
        this.critical = data?.critical ?? false;
    }
    public read(buffer: Buffer): void {
        throw new Error("This is a server-to-client packet only.");
    }
    public write(): Buffer {
        const writer = new BufferWriter();
        writer.writeOptionalString(this.nickname);
        writer.writeOptionalString(this.targetNickname);
        writer.writeOptionalVector3(this.hitPosition);
        writer.writeFloatBE(this.impactForce);
        writer.writeUInt8(this.critical ? 1 : 0);
        return writer.getBuffer();
    }
    public static getId(): number {
        return defs.weapons.SmokyTargetShot.id;
    }
}