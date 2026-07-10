import { BasePacket } from "@/packets/base.packet";
import { packetClass } from "@/packets/packet-class";
import { defs, decodeBody } from "protanki-protocol";

// IDs e schemas em `protanki-protocol` (defs.weapons.*). Server só faz lógica; a lib lê/escreve.

/**
 * C→S: a Freeze beam tick. Mesma forma do Firebird (o cone toca vários tanques). Só precisamos de
 * clientTime + targets; o schema lê só esses dois e ignora o resto do fio.
 */
export class FreezeHitCommandPacket extends BasePacket {
    public targets: string[] = [];
    public read(buffer: Buffer): void {
        try { this.targets = decodeBody(defs.weapons.FreezeHitCommand, buffer).fields.targets; }
        catch { this.targets = []; }
    }
    public write(): Buffer { throw new Error("This is a client-to-server packet only."); }
    public static getId(): number { return defs.weapons.FreezeHitCommand.id; }
}

export const StartShootingFreezeCommandPacket = packetClass(defs.weapons.StartShootingFreezeCommand);
export type StartShootingFreezeCommandPacket = InstanceType<typeof StartShootingFreezeCommandPacket>;

export const StartShootingFreezePacket = packetClass(defs.weapons.StartShootingFreeze);
export type StartShootingFreezePacket = InstanceType<typeof StartShootingFreezePacket>;

export const StopShootingFreezeCommandPacket = packetClass(defs.weapons.StopShootingFreezeCommand);
export type StopShootingFreezeCommandPacket = InstanceType<typeof StopShootingFreezeCommandPacket>;

export const StopShootingFreezePacket = packetClass(defs.weapons.StopShootingFreeze);
export type StopShootingFreezePacket = InstanceType<typeof StopShootingFreezePacket>;
