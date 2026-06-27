import { BasePacket } from "@/packets/base.packet";
import { IVector3 } from "@/shared/types/geom/ivector3";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";

interface ShotgunTargetHit { pellets: number; hit: IVector3 | null; }

/**
 * C→S: a Hammer (shotgun) blast. Body = clientTime, direction(vec), count(int), then `count` pellet hit
 * records of [3 vecs, target nick, int] (58B each) — one record per pellet that LANDED on a tank (missed
 * pellets aren't reported, so the count encodes spread/accuracy). We keep the blast direction, the per-
 * target pellet count (for damage), and one hit position per target (for the visual relay).
 */
export class ShotgunShotCommandPacket extends BasePacket {
    public direction: IVector3 | null = null;
    public hitsByTarget: Map<string, ShotgunTargetHit> = new Map();
    public read(buffer: Buffer): void {
        const r = new BufferReader(buffer);
        r.readInt32BE();                       // clientTime
        this.direction = r.readOptionalVector3();
        const count = r.readInt32BE();
        for (let i = 0; i < count; i++) {
            try {
                const hit = r.readOptionalVector3(); // first vec = the impact position
                r.readOptionalVector3();
                r.readOptionalVector3();
                const target = r.readOptionalString();
                r.readInt32BE();
                if (!target) continue;
                const entry = this.hitsByTarget.get(target);
                if (entry) entry.pellets++;
                else this.hitsByTarget.set(target, { pellets: 1, hit });
            } catch { break; }
        }
    }
    public write(): Buffer { throw new Error("This is a client-to-server packet only."); }
    public static getId(): number { return -541655881; }
}

/**
 * S→C: relays a shotgun blast to the other players (the cone + pellet impacts). Body = nick, direction,
 * count(targets hit), then per target [direction, hit position, pelletCount(byte), target nick].
 */
export class ShotgunShotPacket extends BasePacket {
    constructor(
        private readonly nickname: string,
        private readonly direction: IVector3 | null,
        private readonly targets: { hit: IVector3 | null; pellets: number; nick: string }[],
    ) { super(); }
    public read(_buffer: Buffer): void {}
    public write(): Buffer {
        const w = new BufferWriter().writeOptionalString(this.nickname).writeOptionalVector3(this.direction).writeInt32BE(this.targets.length);
        for (const t of this.targets) {
            w.writeOptionalVector3(this.direction).writeOptionalVector3(t.hit).writeUInt8(t.pellets & 0xff).writeOptionalString(t.nick);
        }
        return w.getBuffer();
    }
    public static getId(): number { return 471157826; }
}
