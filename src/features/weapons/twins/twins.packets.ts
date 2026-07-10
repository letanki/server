import { BasePacket } from "@/packets/base.packet";
import { packetClass } from "@/packets/packet-class";
import { defs, decodeSchema } from "protanki-protocol";
import { IVector3 } from "@/shared/types/geom/ivector3";

// IDs e schemas em `protanki-protocol` (defs.weapons.*). Server só faz lógica; a lib lê/escreve.

/** C→S: twins fired (continuous aim/fire). Body = clientTime, control(i8), shotId, direction vector. */
export const TwinsShotCommandPacket = packetClass(defs.weapons.TwinsShotCommand);
export type TwinsShotCommandPacket = InstanceType<typeof TwinsShotCommandPacket>;

/** S→C: relays a twins shot to other players (the plasma visual). Body = nick, control(i8), direction. */
export const TwinsShotPacket = packetClass(defs.weapons.TwinsShot);
export type TwinsShotPacket = InstanceType<typeof TwinsShotPacket>;

/**
 * C→S: a twins plasma ball hit a tank. Head = clientTime + shotId; um HIT ainda carrega target + posição
 * global (para o falloff). Um MISS manda pacote curto (só o head) — nunca leia além do fim. A checagem
 * de tamanho é lógica; os bytes são da lib.
 */
export class TwinsTargetShotCommandPacket extends BasePacket {
    public clientTime: number = 0;
    public shotId: number = 0;
    public target: string | null = null;
    public hitGlobalPosition: IVector3 | null = null;
    public read(buffer: Buffer): void {
        const schema = defs.weapons.TwinsTargetShotCommand.schema!;
        const { result: head, bytesRead } = decodeSchema(schema.slice(0, 2), buffer);
        this.clientTime = head.clientTime;
        this.shotId = head.shotId;
        if (buffer.length > bytesRead) {
            try {
                const { result: tail } = decodeSchema(schema.slice(2), buffer.subarray(bytesRead));
                this.target = tail.target;
                this.hitGlobalPosition = tail.hitGlobalPosition;
            } catch {
                this.target = null;
                this.hitGlobalPosition = null;
            }
        }
    }
    public write(): Buffer { throw new Error("This is a client-to-server packet only."); }
    public static getId(): number { return defs.weapons.TwinsTargetShotCommand.id; }
}
