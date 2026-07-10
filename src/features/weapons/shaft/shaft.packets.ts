import { BasePacket } from "@/packets/base.packet";
import { packetClass } from "@/packets/packet-class";
import { defs, readSchema, writeSchema, decodeSchema } from "protanki-protocol";
import { IVector3 } from "@/shared/types/geom/ivector3";

// IDs e schemas em `protanki-protocol` (defs.weapons.*). Server só faz lógica; a lib lê/escreve.

/**
 * O head fixo + tail opcional dos shot-commands (arcade/aiming). Um HIT (tank) carrega target + hit; um
 * MISS (parede = pacote curto, ou void) termina após o head. A checagem de tamanho é lógica; a lib lê.
 */
interface ShaftShotHead { origin: IVector3 | null; target: string | null; hit: IVector3 | null; }
function readShaftHead(buffer: Buffer): ShaftShotHead {
    const { result: head, bytesRead } = decodeSchema(defs.weapons.ShaftShotCommandHeadSchema, buffer);
    let target: string | null = null;
    let hit: IVector3 | null = null;
    if (buffer.length > bytesRead) {
        try {
            const { result: tail } = decodeSchema(defs.weapons.ShaftShotCommandTailSchema, buffer.subarray(bytesRead));
            target = tail.target;
            hit = tail.hit;
        } catch { /* short/odd packet → treat as a miss */ }
    }
    return { origin: head.origin, target, hit };
}

/** C→S: shaft ARCADE shot (quick mode) hit a tank. Damage = random(FROM..TO). */
export class ShaftArcadeShotCommandPacket extends BasePacket {
    public origin: IVector3 | null = null;
    public target: string | null = null;
    public hit: IVector3 | null = null;
    public read(buffer: Buffer): void { Object.assign(this, readShaftHead(buffer)); }
    public write(): Buffer { throw new Error("This is a client-to-server packet only."); }
    public static getId(): number { return defs.weapons.ShaftArcadeShotCommand.id; }
}

/** C→S: shaft AIMING (sniper) shot hit a tank. Damage scales with the charge held since entering aim. */
export class ShaftAimingShotCommandPacket extends BasePacket {
    public origin: IVector3 | null = null;
    public target: string | null = null;
    public hit: IVector3 | null = null;
    public read(buffer: Buffer): void { Object.assign(this, readShaftHead(buffer)); }
    public write(): Buffer { throw new Error("This is a client-to-server packet only."); }
    public static getId(): number { return defs.weapons.ShaftAimingShotCommand.id; }
}

/** C→S: shaft aiming-mode tracking (the laser sight, streamed while aiming). Body = target, direction. */
export const ShaftAimTrackCommandPacket = packetClass(defs.weapons.ShaftAimTrackCommand);
export type ShaftAimTrackCommandPacket = InstanceType<typeof ShaftAimTrackCommandPacket>;

/** S→C: relays the shaft laser-sight tracking to other players (the beam shown while aiming). */
export class ShaftAimTrackPacket extends BasePacket {
    constructor(private readonly nickname: string, private readonly target: string | null, private readonly direction: IVector3 | null) { super(); }
    public read(_buffer: Buffer): void {}
    public write(): Buffer { return writeSchema(this, defs.weapons.ShaftAimTrack.schema!); }
    public static getId(): number { return defs.weapons.ShaftAimTrack.id; }
}

/** C→S: shaft entered aiming mode — the damage CHARGE starts here. Empty body, not relayed. */
export class ShaftEnterAimingPacket extends BasePacket {
    public read(_buffer: Buffer): void {}
    public write(): Buffer { throw new Error("This is a client-to-server packet only."); }
    public static getId(): number { return defs.weapons.ShaftEnterAiming.id; }
}

/** C→S: shaft aiming fully ENGAGED (empty body) — sent ~0.5s after ShaftEnterAiming. THIS is relayed. */
export class ShaftAimEngagedPacket extends BasePacket {
    public read(_buffer: Buffer): void {}
    public write(): Buffer { throw new Error("This is a client-to-server packet only."); }
    public static getId(): number { return defs.weapons.ShaftAimEngaged.id; }
}

/** C→S: shaft LEFT aiming mode (empty body). Sent right after firing an aiming shot (or on cancel). */
export class ShaftExitAimingPacket extends BasePacket {
    public read(_buffer: Buffer): void {}
    public write(): Buffer { throw new Error("This is a client-to-server packet only."); }
    public static getId(): number { return defs.weapons.ShaftExitAiming.id; }
}

/** S→C: a player ENTERED aiming mode — others render aiming (turret-only) and start the laser. */
export class ShaftAimEnterRelayPacket extends BasePacket {
    constructor(private readonly nickname: string) { super(); }
    public read(_buffer: Buffer): void {}
    public write(): Buffer { return writeSchema(this, defs.weapons.ShaftAimEnterRelay.schema!); }
    public static getId(): number { return defs.weapons.ShaftAimEnterRelay.id; }
}

/** S→C: a player EXITED aiming mode (e.g. after firing) — others stop the laser. */
export class ShaftAimExitRelayPacket extends BasePacket {
    constructor(private readonly nickname: string) { super(); }
    public read(_buffer: Buffer): void {}
    public write(): Buffer { return writeSchema(this, defs.weapons.ShaftAimExitRelay.schema!); }
    public static getId(): number { return defs.weapons.ShaftAimExitRelay.id; }
}

/**
 * S→C: relays a shaft shot to other players (the beam visual). Encoding CONDICIONAL: um HIT carrega o
 * bloco completo do alvo (int/byte framing + target + hit), um MISS colapsa em dois marcadores null. O
 * branch (target !== null) é lógica; a lib escreve a variante HIT (schema) ou MISS (ShaftShotMissSchema).
 * power = 1.67 arcade / 4.30 aiming.
 */
export class ShaftShotPacket extends BasePacket {
    constructor(
        private readonly nickname: string,
        private readonly origin: IVector3 | null,
        private readonly target: string | null,
        private readonly hit: IVector3 | null,
        private readonly power: number,
    ) { super(); }
    public read(_buffer: Buffer): void {}
    public write(): Buffer {
        if (this.target !== null) {
            return writeSchema(
                { nickname: this.nickname, origin: this.origin, padA: 0, padB: 1, target: this.target, padC: 0, padD: 1, hit: this.hit, power: this.power },
                defs.weapons.ShaftShot.schema!,
            );
        }
        return writeSchema(
            { nickname: this.nickname, origin: this.origin, target: null, hit: null, power: this.power },
            defs.weapons.ShaftShotMissSchema,
        );
    }
    public static getId(): number { return defs.weapons.ShaftShot.id; }
}
