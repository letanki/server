import { BasePacket } from "@/packets/base.packet";
import { defs } from "protanki-protocol";
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
    public static getId(): number { return defs.weapons.ShaftArcadeShotCommand.id; }
}

/** C→S: shaft AIMING (sniper) shot hit a tank. Damage scales with the charge held since entering aim. */
export class ShaftAimingShotCommandPacket extends BasePacket {
    public origin: IVector3 | null = null;
    public target: string | null = null;
    public hit: IVector3 | null = null;
    public read(buffer: Buffer): void { Object.assign(this, readHead(buffer)); }
    public write(): Buffer { throw new Error("This is a client-to-server packet only."); }
    public static getId(): number { return defs.weapons.ShaftAimingShotCommand.id; }
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
    public static getId(): number { return defs.weapons.ShaftAimTrackCommand.id; }
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
    public static getId(): number { return defs.weapons.ShaftAimTrack.id; }
}

/** C→S: shaft entered aiming mode — the damage CHARGE starts here (body = clientTime). Sent the instant
 *  the player holds aim; the zoom/laser is not yet engaged, so this is NOT relayed (see ShaftAimEngaged). */
export class ShaftEnterAimingPacket extends BasePacket {
    public read(_buffer: Buffer): void {}
    public write(): Buffer { throw new Error("This is a client-to-server packet only."); }
    public static getId(): number { return defs.weapons.ShaftEnterAiming.id; }
}

/** C→S: shaft aiming fully ENGAGED (empty body) — sent ~0.5s after ShaftEnterAiming, when the zoom
 *  animation completes and the laser turns on. THIS is what the official server relays as the aim-enter
 *  event (so others start the laser at the right moment); relaying on ShaftEnterAiming instead makes the
 *  remote laser appear ~0.5s early. Verified by clock-aligned timing in 2026-07-04_23-56_s6-54824.ndjson. */
export class ShaftAimEngagedPacket extends BasePacket {
    public read(_buffer: Buffer): void {}
    public write(): Buffer { throw new Error("This is a client-to-server packet only."); }
    public static getId(): number { return defs.weapons.ShaftAimEngaged.id; }
}

/** C→S: shaft LEFT aiming mode (empty body). The client sends this right after firing an aiming shot (or
 *  on cancel); the official server responds by broadcasting the exit relay so others stop the laser. */
export class ShaftExitAimingPacket extends BasePacket {
    public read(_buffer: Buffer): void {}
    public write(): Buffer { throw new Error("This is a client-to-server packet only."); }
    public static getId(): number { return defs.weapons.ShaftExitAiming.id; }
}

/** S→C: a player ENTERED aiming mode — others render it as aiming (turret-only) and start the laser.
 *  Without this they read the aim-track as the whole tank rotating. Body = optionalString(nick). */
export class ShaftAimEnterRelayPacket extends BasePacket {
    constructor(private readonly nickname: string) { super(); }
    public read(_buffer: Buffer): void {}
    public write(): Buffer { return new BufferWriter().writeOptionalString(this.nickname).getBuffer(); }
    public static getId(): number { return defs.weapons.ShaftAimEnterRelay.id; }
}

/** S→C: a player EXITED aiming mode (e.g. after firing) — others stop the laser. Body = optionalString(nick). */
export class ShaftAimExitRelayPacket extends BasePacket {
    constructor(private readonly nickname: string) { super(); }
    public read(_buffer: Buffer): void {}
    public write(): Buffer { return new BufferWriter().writeOptionalString(this.nickname).getBuffer(); }
    public static getId(): number { return defs.weapons.ShaftAimExitRelay.id; }
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
        const w = new BufferWriter()
            .writeOptionalString(this.nickname)
            .writeOptionalVector3(this.origin);
        // A HIT carries the full target block (int/byte framing + target + hit vec); a MISS (wall/void,
        // target=null) collapses to just two null markers — matching the official relay byte-for-byte
        // (miss = 31B, hit = 60B, verified against 2026-07-04_23-56 capture). Emitting the full block with
        // null placeholders on a miss produced a 41B packet the client can't parse, which desynced the
        // shaft aim/beam rendering on the other players (misses are frequent while aiming at cover).
        if (this.target !== null) {
            w.writeInt32BE(0)
                .writeInt8(1)
                .writeOptionalString(this.target)
                .writeInt8(0)
                .writeInt32BE(1)
                .writeOptionalVector3(this.hit);
        } else {
            w.writeOptionalString(null).writeOptionalVector3(null);
        }
        return w.writeFloatBE(this.power).getBuffer();
    }
    public static getId(): number { return defs.weapons.ShaftShot.id; }
}
