import { BasePacket } from "@/packets/base.packet";
import { IVector3 } from "@/shared/types/geom/ivector3";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";

/**
 * The shared shot-command head: clientTime, origin vec, int, byte, [target nick, byte, int, hit vec].
 * A HIT (tank) carries the target + hit position; a MISS (wall = short packet, or void = null origin too)
 * ends right after the leading bytes with no target. We MUST stop there — reading the target past the end
 * crashed the client. (decoded: hit = 95B, wall miss = 22B, void miss = 10B.)
 */
interface ShaftShotHead { origin: IVector3 | null; target: string | null; hit: IVector3 | null; }
function readHead(buffer: Buffer): ShaftShotHead {
    const r = new BufferReader(buffer);
    r.readInt32BE();                          // clientTime
    const origin = r.readOptionalVector3();   // shot origin (null on a void shot)
    r.readInt32BE();                          // unknown
    r.readInt8();                             // unknown
    if (!r.hasRemaining) return { origin, target: null, hit: null }; // miss — no target
    try {
        const target = r.readOptionalString();
        r.readInt8();
        r.readInt32BE();
        const hit = r.readOptionalVector3();
        return { origin, target, hit };
    } catch {
        return { origin, target: null, hit: null }; // short/odd packet → treat as a miss
    }
}

/** C→S: shaft ARCADE shot (quick mode) hit a tank. Damage = random(FROM..TO). */
export class ShaftArcadeShotCommandPacket extends BasePacket {
    public origin: IVector3 | null = null;
    public target: string | null = null;
    public hit: IVector3 | null = null;
    public read(buffer: Buffer): void { Object.assign(this, readHead(buffer)); }
    public write(): Buffer { throw new Error("This is a client-to-server packet only."); }
    public static getId(): number { return -2030760866; }
}

/** C→S: shaft AIMING (sniper) shot hit a tank. Damage scales with the charge held since entering aim. */
export class ShaftAimingShotCommandPacket extends BasePacket {
    public origin: IVector3 | null = null;
    public target: string | null = null;
    public hit: IVector3 | null = null;
    public read(buffer: Buffer): void { Object.assign(this, readHead(buffer)); }
    public write(): Buffer { throw new Error("This is a client-to-server packet only."); }
    public static getId(): number { return 1632423559; }
}

/** C→S: shaft aiming-mode tracking (the laser sight, streamed while aiming). Body = target, direction. */
export class ShaftAimTrackCommandPacket extends BasePacket {
    public target: string | null = null;
    public direction: IVector3 | null = null;
    public read(buffer: Buffer): void {
        const r = new BufferReader(buffer);
        this.target = r.readOptionalString();
        this.direction = r.readOptionalVector3();
    }
    public write(): Buffer { throw new Error("This is a client-to-server packet only."); }
    public static getId(): number { return -1517837003; }
}

/** S→C: relays the shaft laser-sight tracking to other players (the beam shown while aiming). */
export class ShaftAimTrackPacket extends BasePacket {
    constructor(private readonly nickname: string, private readonly target: string | null, private readonly direction: IVector3 | null) { super(); }
    public read(_buffer: Buffer): void {}
    public write(): Buffer {
        return new BufferWriter()
            .writeOptionalString(this.nickname)
            .writeOptionalString(this.target)
            .writeOptionalVector3(this.direction)
            .getBuffer();
    }
    public static getId(): number { return 11992250; }
}

/** C→S: shaft entered aiming mode (the charge starts here). Body = clientTime. */
export class ShaftEnterAimingPacket extends BasePacket {
    public read(_buffer: Buffer): void {}
    public write(): Buffer { throw new Error("This is a client-to-server packet only."); }
    public static getId(): number { return -367760678; }
}

/** S→C: a player ENTERED aiming mode — others render it as aiming (turret-only) and start the laser.
 *  Without this they read the aim-track as the whole tank rotating. Body = optionalString(nick). */
export class ShaftAimEnterRelayPacket extends BasePacket {
    constructor(private readonly nickname: string) { super(); }
    public read(_buffer: Buffer): void {}
    public write(): Buffer { return new BufferWriter().writeOptionalString(this.nickname).getBuffer(); }
    public static getId(): number { return -1222085753; }
}

/** S→C: a player EXITED aiming mode (e.g. after firing) — others stop the laser. Body = optionalString(nick). */
export class ShaftAimExitRelayPacket extends BasePacket {
    constructor(private readonly nickname: string) { super(); }
    public read(_buffer: Buffer): void {}
    public write(): Buffer { return new BufferWriter().writeOptionalString(this.nickname).getBuffer(); }
    public static getId(): number { return -380595194; }
}

/**
 * S→C: relays a shaft shot to other players (the beam visual). Body = nick, origin, int(0), byte(1),
 * target, byte(0), int(1), hit, power(float). power = 1.67 arcade / 4.30 aiming (the impact strength,
 * which is what tells the client which beam to draw).
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
        return new BufferWriter()
            .writeOptionalString(this.nickname)
            .writeOptionalVector3(this.origin)
            .writeInt32BE(0)
            .writeInt8(1)
            .writeOptionalString(this.target)
            .writeInt8(0)
            .writeInt32BE(1)
            .writeOptionalVector3(this.hit)
            .writeFloatBE(this.power)
            .getBuffer();
    }
    public static getId(): number { return 1184835319; }
}
