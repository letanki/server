import { BasePacket } from "@/packets/base.packet";
import { defs, encodeBody, decodeBody } from "protanki-protocol";
import { IVector3 } from "@/shared/types/geom/ivector3";

interface ShotgunTargetHit { pellets: number; worldHit: IVector3 | null; center: IVector3 | null; }

// IDs e schemas em `protanki-protocol` (defs.weapons.*). Server só faz lógica; a lib lê/escreve.

/**
 * C→S: a Hammer (shotgun) blast. Body = clientTime, direction, então uma list de registros de pellet
 * [3 vecs, target nick, int] — um por pellet que ACERTOU. A lib lê a list; o server AGREGA por alvo
 * (contagem de pellets + o primeiro impacto/centro).
 */
export class ShotgunShotCommandPacket extends BasePacket {
    public direction: IVector3 | null = null;
    public hitsByTarget: Map<string, ShotgunTargetHit> = new Map();
    public read(buffer: Buffer): void {
        let fields;
        try { fields = decodeBody(defs.weapons.ShotgunShotCommand, buffer).fields; }
        catch { return; }
        this.direction = fields.direction;
        for (const h of fields.hits) {
            const target = h.target;
            if (!target) continue;
            const entry = this.hitsByTarget.get(target);
            if (entry) entry.pellets++;
            else this.hitsByTarget.set(target, { pellets: 1, worldHit: h.localHitPoint, center: h.position });
        }
    }
    public write(): Buffer { throw new Error("This is a client-to-server packet only."); }
    public static getId(): number { return defs.weapons.ShotgunShotCommand.id; }
}

/**
 * S→C: relays a shotgun blast (o cone + impactos). Body = nick, direction, então por alvo
 * [direction, hit, pelletCount(byte), nick]. Cada registro repete a direção do disparo (lógica).
 */
export class ShotgunShotPacket extends BasePacket {
    constructor(
        private readonly nickname: string,
        private readonly direction: IVector3 | null,
        private readonly targets: { hit: IVector3 | null; pellets: number; nick: string }[],
    ) { super(); }
    public read(_buffer: Buffer): void {}
    public write(): Buffer {
        return encodeBody(defs.weapons.ShotgunShot, {
            nickname: this.nickname,
            direction: this.direction,
            targets: this.targets.map((t) => ({ direction: this.direction, hit: t.hit, pellets: t.pellets & 0xff, nick: t.nick })),
        });
    }
    public static getId(): number { return defs.weapons.ShotgunShot.id; }
}
