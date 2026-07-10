import { BasePacket } from "@/packets/base.packet";
import { packetClass } from "@/packets/packet-class";
import { defs, writeSchema } from "protanki-protocol";
import { IVector3 } from "@/shared/types/geom/ivector3";

// IDs e schemas em `protanki-protocol` (defs.weapons.*). Server só faz lógica; a lib lê/escreve.
// O Shaft PERFURA vários tanques: os shot-commands carregam vetores paralelos por alvo
// (targets/localHitPoints/incarnations/...), lidos pela lib via o schema único.

/** C→S: shaft ARCADE shot (quick mode). `targets` = tanks atingidos (null = só cenário). */
export const ShaftArcadeShotCommandPacket = packetClass(defs.weapons.ShaftArcadeShotCommand);
export type ShaftArcadeShotCommandPacket = InstanceType<typeof ShaftArcadeShotCommandPacket>;

/** C→S: shaft AIMING (sniper) shot. Damage escala com a carga desde o início da mira. */
export const ShaftAimingShotCommandPacket = packetClass(defs.weapons.ShaftAimingShotCommand);
export type ShaftAimingShotCommandPacket = InstanceType<typeof ShaftAimingShotCommandPacket>;

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
 * S→C: relays a shaft shot to the others (the beam visual). Layout único (multi-alvo): ponto no cenário
 * + tanks atingidos + seus hit points locais. Miss (só cenário) = targets/localHitPoints null.
 * power = 1.67 arcade / 4.30 aiming. `localHitPoints` já vem no formato de item da lista ({ v }).
 */
export class ShaftShotPacket extends BasePacket {
    constructor(
        private readonly nickname: string,
        private readonly staticHitPoint: IVector3 | null,
        private readonly targets: string[] | null,
        private readonly localHitPoints: { v: IVector3 | null }[] | null,
        private readonly power: number,
    ) { super(); }
    public read(_buffer: Buffer): void {}
    public write(): Buffer {
        return writeSchema({
            nickname: this.nickname,
            staticHitPoint: this.staticHitPoint,
            targets: this.targets,
            localHitPoints: this.localHitPoints,
            power: this.power,
        }, defs.weapons.ShaftShot.schema!);
    }
    public static getId(): number { return defs.weapons.ShaftShot.id; }
}
