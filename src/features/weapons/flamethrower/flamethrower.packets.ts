import { BasePacket } from "@/packets/base.packet";
import { packetClass } from "@/packets/packet-class";
import { defs, decodeBody } from "protanki-protocol";

// IDs e schemas em `protanki-protocol` (defs.weapons.*). Server só faz lógica; a lib lê/escreve.

/**
 * C→S: a Firebird flame tick. O cone toca vários tanques; o corpo tem arrays paralelos. Só precisamos
 * de clientTime + targets; o schema lê só esses dois e ignora o resto do fio (short + 2 vec-arrays).
 */
export class FirebirdHitCommandPacket extends BasePacket {
    public targets: string[] = [];
    public read(buffer: Buffer): void {
        try { this.targets = decodeBody(defs.weapons.FirebirdHitCommand, buffer).fields.targets; }
        catch { this.targets = []; }
    }
    public write(): Buffer { throw new Error("This is a client-to-server packet only."); }
    public static getId(): number { return defs.weapons.FirebirdHitCommand.id; }
}

export const StartShootingFlamethrowerCommandPacket = packetClass(defs.weapons.StartShootingFlamethrowerCommand);
export type StartShootingFlamethrowerCommandPacket = InstanceType<typeof StartShootingFlamethrowerCommandPacket>;

export const StartShootingFlamethrowerPacket = packetClass(defs.weapons.StartShootingFlamethrower);
export type StartShootingFlamethrowerPacket = InstanceType<typeof StartShootingFlamethrowerPacket>;

export const StopShootingFlamethrowerCommandPacket = packetClass(defs.weapons.StopShootingFlamethrowerCommand);
export type StopShootingFlamethrowerCommandPacket = InstanceType<typeof StopShootingFlamethrowerCommandPacket>;

export const StopShootingFlamethrowerPacket = packetClass(defs.weapons.StopShootingFlamethrower);
export type StopShootingFlamethrowerPacket = InstanceType<typeof StopShootingFlamethrowerPacket>;
