import { BasePacket } from "@/packets/base.packet";
import { packetClass } from "@/packets/packet-class";
import { defs, encodeBody, decodeBody } from "protanki-protocol";
import { IVector3 } from "@/shared/types/geom/ivector3";
import * as MachinegunTypes from "./machinegun.types";

// IDs e schemas em `protanki-protocol` (defs.weapons.*). Server só faz lógica; a lib lê/escreve.

export const StartShootingMachinegunCommandPacket = packetClass(defs.weapons.StartShootingMachinegunCommand);
export type StartShootingMachinegunCommandPacket = InstanceType<typeof StartShootingMachinegunCommandPacket>;

export const StartShootingMachinegunPacket = packetClass(defs.weapons.StartShootingMachinegun);
export type StartShootingMachinegunPacket = InstanceType<typeof StartShootingMachinegunPacket>;

export class MachinegunShotCommandPacket extends BasePacket implements MachinegunTypes.IMachinegunShotCommand {
    public clientTime: number = 0;
    public shotDirection: IVector3 | null = null;
    public targets: MachinegunTypes.IMachinegunShotTargetCommandData[] = [];
    // O `targets` já tem a forma da `list`; leitura direta pela lib.
    public read(buffer: Buffer): void {
        const { fields } = decodeBody(defs.weapons.MachinegunShotCommand, buffer);
        this.clientTime = fields.clientTime;
        this.shotDirection = fields.shotDirection;
        this.targets = fields.targets as MachinegunTypes.IMachinegunShotTargetCommandData[];
    }
    public write(): Buffer { throw new Error("This is a client-to-server packet only."); }
    public static getId(): number { return defs.weapons.MachinegunShotCommand.id; }
}

export class MachinegunShotPacket extends BasePacket implements MachinegunTypes.IMachinegunShotPacket {
    public nickname: string | null;
    public shotDirection: IVector3 | null;
    public targets: MachinegunTypes.IMachinegunShotTargetPacketData[];
    constructor(data?: MachinegunTypes.IMachinegunShotPacketData) {
        super();
        this.nickname = data?.nickname ?? null;
        this.shotDirection = data?.shotDirection ?? null;
        this.targets = data?.targets ?? [];
    }
    public read(buffer: Buffer): void { throw new Error("This is a server-to-client packet only."); }
    public write(): Buffer {
        return encodeBody(defs.weapons.MachinegunShot, {
            nickname: this.nickname,
            shotDirection: this.shotDirection,
            targets: this.targets.map((t) => ({ direction: t.direction, localHitPoint: t.localHitPoint, numberHits: t.numberHits, nickname: t.nickname })),
        });
    }
    public static getId(): number { return defs.weapons.MachinegunShot.id; }
}

export const StopShootingMachinegunCommandPacket = packetClass(defs.weapons.StopShootingMachinegunCommand);
export type StopShootingMachinegunCommandPacket = InstanceType<typeof StopShootingMachinegunCommandPacket>;

export const StopShootingMachinegunPacket = packetClass(defs.weapons.StopShootingMachinegun);
export type StopShootingMachinegunPacket = InstanceType<typeof StopShootingMachinegunPacket>;
