import { BasePacket } from "@/packets/base.packet";
import { defs } from "protanki-protocol";
import { IVector3 } from "@/shared/types/geom/ivector3";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import * as RailgunTypes from "./railgun.types";

export class RailgunShotCommandPacket extends BasePacket implements RailgunTypes.IRailgunShotCommand {
    public clientTime: number = 0;
    public position: IVector3 | null = null;
    public targets: RailgunTypes.IRailgunShotTargetData[] = [];

    public read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        this.clientTime = reader.readInt32BE();
        this.position = reader.readOptionalVector3();
        const targetNicknames = reader.readStringArray();
        const targetsPosition = this.readVector3Array(reader);
        const targetsIncarnation = reader.readInt16Array();
        const targetsRotation = this.readVector3Array(reader);
        const targetsOrientation = this.readVector3Array(reader);
        for (let i = 0; i < targetNicknames.length; i++) {
            this.targets.push({
                nickname: targetNicknames[i],
                position: targetsPosition[i],
                incarnation: targetsIncarnation[i],
                rotation: targetsRotation[i],
                orientation: targetsOrientation[i],
            });
        }
    }

    private readVector3Array(reader: BufferReader): IVector3[] {
        const vectors: IVector3[] = [];
        const isEmpty = reader.readUInt8() === 1;
        if (isEmpty) return vectors;
        const count = reader.readInt32BE();
        for (let i = 0; i < count; i++) {
            const vector = reader.readOptionalVector3();
            if (vector) {
                vectors.push(vector);
            }
        }
        return vectors;
    }

    public write(): Buffer {
        throw new Error("RailgunShotCommandPacket is a client-to-server packet only and should not be written.");
    }
    public static getId(): number {
        return defs.weapons.RailgunShotCommand.id;
    }
}

export class RailgunShotPacket extends BasePacket implements RailgunTypes.IRailgunShotPacket {
    public shooterNickname: string | null;
    public hitPosition: IVector3 | null;
    public targets: { nickname: string; position: IVector3 }[];
    constructor(data?: RailgunTypes.IRailgunShotPacketData) {
        super();
        this.shooterNickname = data?.shooterNickname ?? null;
        this.hitPosition = data?.hitPosition ?? null;
        this.targets = data?.targets ?? [];
    }
    public read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        this.shooterNickname = reader.readOptionalString();
        this.hitPosition = reader.readOptionalVector3();
        const targetNicknames = reader.readStringArray();
        const targetPositions = reader.readVector3Array();
        this.targets = [];
        for (let i = 0; i < targetNicknames.length; i++) {
            const position = targetPositions[i];
            if (position) {
                this.targets.push({
                    nickname: targetNicknames[i],
                    position: position,
                });
            }
        }
    }
    public write(): Buffer {
        const writer = new BufferWriter();
        writer.writeOptionalString(this.shooterNickname);
        writer.writeOptionalVector3(this.hitPosition);
        const nicknames = this.targets.map((t) => t.nickname);
        const positions = this.targets.map((t) => t.position);
        writer.writeOptionalStringArray(nicknames);
        writer.writeVector3Array(positions);
        return writer.getBuffer();
    }
    public static getId(): number {
        return defs.weapons.RailgunShot.id;
    }
}

export class StartChargingCommandPacket extends BasePacket implements RailgunTypes.IStartChargingCommand {
    public clientTime: number = 0;
    public read(buffer: Buffer): void {
        this.clientTime = new BufferReader(buffer).readInt32BE();
    }
    public write(): Buffer {
        return new BufferWriter().writeInt32BE(this.clientTime).getBuffer();
    }
    public static getId(): number {
        return defs.weapons.StartChargingCommand.id;
    }
}

export class StartChargingPacket extends BasePacket implements RailgunTypes.IStartChargingPacket {
    public nickname: string | null;
    constructor(data?: RailgunTypes.IStartChargingPacketData) {
        super();
        this.nickname = data?.nickname ?? null;
    }
    public read(buffer: Buffer): void {
        this.nickname = new BufferReader(buffer).readOptionalString();
    }
    public write(): Buffer {
        return new BufferWriter().writeOptionalString(this.nickname).getBuffer();
    }
    public static getId(): number {
        return defs.weapons.StartCharging.id;
    }
}