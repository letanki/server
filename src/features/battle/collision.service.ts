import { getMapCollision, ICollisionTri } from "@/maps/mapCollision";
import { IVector3 } from "@/shared/types/geom/ivector3";

// When checking if collision is BETWEEN two points, trim this much off each end of the line so the
// surface a flag rests on (and the floor under the tank) — touched only at the endpoints — don't
// count; only collision genuinely between the two blocks.
const OCCLUSION_TRIM = 40;

/**
 * Pure map-geometry queries (no battle/client/packet state) used for flag drops, pickup occlusion
 * and the anti-clip check. Backed by the generated per-map collision boxes + ramp triangles
 * (`getMapCollision`). Extracted from BattleService as the first step of splitting that god object.
 */
export class CollisionService {
    /** Highest collision surface top at (x,y) at/below `fromZ` (box top or interpolated ramp z), or
     *  null if there's nothing there (the void). Used to drop flags onto the ground below the tank. */
    public raycastGroundZ(mapResourceId: string, x: number, y: number, fromZ: number): number | null {
        const { boxes, triangles } = getMapCollision(mapResourceId);
        let best: number | null = null;
        const ceiling = fromZ + 1; // tiny slack: the tank rests ~89 above its floor, so the top <= fromZ
        for (const b of boxes) {
            if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY || b.maxZ > ceiling) continue;
            if (best === null || b.maxZ > best) best = b.maxZ;
        }
        for (const t of triangles) {
            const z = this._triZAt(t, x, y);
            if (z !== null && z <= ceiling && (best === null || z > best)) best = z;
        }
        return best;
    }

    /** Is there ANY construction (not just a floor to stand on) in the column at (x,y) that reaches the
     *  tank's height or below? True if any collision box whose XY contains (x,y) starts at/below `z`
     *  (a wall/building whose top may even be ABOVE the tank still counts), or a ramp surface sits at/below
     *  `z`. False only over the true VOID — an empty column with no collision at all. Used by parkour so a
     *  tank explodes ONLY when it actually falls into nothing, never while over/beside any structure. */
    public hasSupportBelow(mapResourceId: string, x: number, y: number, z: number): boolean {
        const { boxes, triangles } = getMapCollision(mapResourceId);
        for (const b of boxes) {
            if (x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY && b.minZ <= z) return true;
        }
        for (const t of triangles) {
            const tz = this._triZAt(t, x, y);
            if (tz !== null && tz <= z + 1) return true;
        }
        return false;
    }

    /** Is there ANY collision (floor, wall, structure, ramp) genuinely BETWEEN the two points? The
     *  straight line is trimmed at both ends (OCCLUSION_TRIM) so the surface a point rests on doesn't
     *  count; only geometry the line passes THROUGH blocks. */
    public isBlockedBetween(mapResourceId: string, from: IVector3, to: IVector3): boolean {
        const { boxes, triangles } = getMapCollision(mapResourceId);
        if (!boxes.length && !triangles.length) return false;
        const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
        const len = Math.hypot(dx, dy, dz);
        const e = len > 0 ? Math.min(0.45, OCCLUSION_TRIM / len) : 0; // trim fraction off each end
        const o: [number, number, number] = [from.x + dx * e, from.y + dy * e, from.z + dz * e];
        const dir: [number, number, number] = [dx * (1 - 2 * e), dy * (1 - 2 * e), dz * (1 - 2 * e)];
        for (const b of boxes) {
            const lo = [b.minX, b.minY, b.minZ], hi = [b.maxX, b.maxY, b.maxZ];
            let tmin = 0, tmax = 1, hit = true;
            for (let a = 0; a < 3; a++) {
                if (Math.abs(dir[a]) < 1e-6) {
                    if (o[a] < lo[a] || o[a] > hi[a]) { hit = false; break; }
                } else {
                    let t1 = (lo[a] - o[a]) / dir[a], t2 = (hi[a] - o[a]) / dir[a];
                    if (t1 > t2) [t1, t2] = [t2, t1];
                    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
                    if (tmin > tmax) { hit = false; break; }
                }
            }
            if (hit) return true;
        }
        for (const t of triangles) if (this._segHitsTri(o, dir, t)) return true;
        return false;
    }

    /** The solid obstacle (wall/structure) the point is inside, or null. For the anti-clip check —
     *  obstacles are shrunk slightly so merely resting against one doesn't count. */
    public obstacleAt(mapResourceId: string, pos: IVector3): string | null {
        const { obstacles } = getMapCollision(mapResourceId);
        const M = 30; // shrink margin
        for (const b of obstacles) {
            if (pos.x > b.minX + M && pos.x < b.maxX - M && pos.y > b.minY + M && pos.y < b.maxY - M && pos.z > b.minZ + M && pos.z < b.maxZ - M) {
                return `[${b.minX},${b.minY},${b.minZ}]..[${b.maxX},${b.maxY},${b.maxZ}]`;
            }
        }
        return null;
    }

    /** Segment origin+dir (t in [0,1]) vs a 3D triangle. Möller–Trumbore. */
    private _segHitsTri(o: [number, number, number], dir: [number, number, number], t: ICollisionTri): boolean {
        const e1 = [t.bx - t.ax, t.by - t.ay, t.bz - t.az];
        const e2 = [t.cx - t.ax, t.cy - t.ay, t.cz - t.az];
        const p = [dir[1] * e2[2] - dir[2] * e2[1], dir[2] * e2[0] - dir[0] * e2[2], dir[0] * e2[1] - dir[1] * e2[0]];
        const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
        if (Math.abs(det) < 1e-9) return false;
        const inv = 1 / det;
        const tv = [o[0] - t.ax, o[1] - t.ay, o[2] - t.az];
        const u = (tv[0] * p[0] + tv[1] * p[1] + tv[2] * p[2]) * inv;
        if (u < 0 || u > 1) return false;
        const q = [tv[1] * e1[2] - tv[2] * e1[1], tv[2] * e1[0] - tv[0] * e1[2], tv[0] * e1[1] - tv[1] * e1[0]];
        const v = (dir[0] * q[0] + dir[1] * q[1] + dir[2] * q[2]) * inv;
        if (v < 0 || u + v > 1) return false;
        const tt = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) * inv;
        return tt >= 0 && tt <= 1;
    }

    /** z of the tilted triangle surface at (x,y) if (x,y) is within its XY projection, else null. */
    private _triZAt(t: ICollisionTri, x: number, y: number): number | null {
        const d = (t.by - t.cy) * (t.ax - t.cx) + (t.cx - t.bx) * (t.ay - t.cy);
        if (Math.abs(d) < 1e-9) return null;
        const a = ((t.by - t.cy) * (x - t.cx) + (t.cx - t.bx) * (y - t.cy)) / d;
        const b = ((t.cy - t.ay) * (x - t.cx) + (t.ax - t.cx) * (y - t.cy)) / d;
        const c = 1 - a - b;
        const eps = -0.001;
        if (a < eps || b < eps || c < eps) return null;
        return a * t.az + b * t.bz + c * t.cz;
    }
}
