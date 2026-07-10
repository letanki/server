import { BasePacket } from "@/packets/base.packet";
import { readSchema, writeSchema } from "@/packets/packet-schema";
import { packetClass } from "@/packets/packet-class";
import { defs, encodeBody, decodeBody } from "protanki-protocol";
import { IVector3 } from "@/shared/types/geom/ivector3";
import * as RailgunTypes from "./railgun.types";

// IDs e schemas em `protanki-protocol` (defs.weapons.*). Server só faz lógica (o zip dos arrays
// paralelos em `targets`); a lib lê/escreve os bytes.

export class RailgunShotCommandPacket extends BasePacket implements RailgunTypes.IRailgunShotCommand {
    public clientTime: number = 0;
    public position: IVector3 | null = null;
    public targets: RailgunTypes.IRailgunShotTargetData[] = [];
    public read(buffer: Buffer): void {
        const { fields } = decodeBody(defs.weapons.RailgunShotCommand, buffer);
        this.clientTime = fields.clientTime;
        this.position = fields.position;
        this.targets = fields.targetNicknames.map((nickname, i) => ({
            nickname,
            position: fields.targetsPosition[i],
            incarnation: fields.targetsIncarnation[i],
            rotation: fields.targetsRotation[i],
            orientation: fields.targetsOrientation[i],
        })) as RailgunTypes.IRailgunShotTargetData[];
    }
    public write(): Buffer {
        throw new Error("RailgunShotCommandPacket is a client-to-server packet only and should not be written.");
    }
    public static getId(): number { return defs.weapons.RailgunShotCommand.id; }
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
        const { fields } = decodeBody(defs.weapons.RailgunShot, buffer);
        this.shooterNickname = fields.shooterNickname;
        this.hitPosition = fields.hitPosition;
        this.targets = [];
        for (let i = 0; i < fields.targetNicknames.length; i++) {
            const position = fields.targetPositions[i];
            if (position) this.targets.push({ nickname: fields.targetNicknames[i], position });
        }
    }
    public write(): Buffer {
        return encodeBody(defs.weapons.RailgunShot, {
            shooterNickname: this.shooterNickname,
            hitPosition: this.hitPosition,
            targetNicknames: this.targets.map((t) => t.nickname),
            targetPositions: this.targets.map((t) => t.position),
        });
    }
    public static getId(): number { return defs.weapons.RailgunShot.id; }
}

export const StartChargingCommandPacket = packetClass(defs.weapons.StartChargingCommand);
export type StartChargingCommandPacket = InstanceType<typeof StartChargingCommandPacket>;

export const StartChargingPacket = packetClass(defs.weapons.StartCharging);
export type StartChargingPacket = InstanceType<typeof StartChargingPacket>;
