/**
 * Generates the server-side collision data. Two outputs:
 *
 *   src/types/mapCollision.ts
 *     - mapCollision : per-map collision SURFACES the flag can land on when dropped (it falls to the
 *       FIRST collision below the tank — a floor, the top of a wall, a box, any solid). AABB with a
 *       top z. Built from the map's authoritative <collision-geometry> (collision-plane tops +
 *       collision-box tops), the SAME geometry the client physics uses.
 *     - mapOccluders : per-map SOLID 3D boxes (collision-box) — line-of-sight: a flag can't be
 *       picked up through a wall or another pavement.
 *   src/types/hullCollision.ts
 *     - hullCollision : per-hull collision half-extents (mammoth is bigger than wasp), parsed from
 *       each hull's .3ds model, for the oriented flag-contact box.
 *
 * <collision-geometry> elements (sandbox): collision-plane (horizontal surfaces, width/length/pos/
 * rot-z), collision-box (3D obstacle, size/pos=centre/rot-z), collision-triangle (slopes — full 3D
 * rotation; approximated for now, slopes were already coarse in the previous tile version).
 *
 * Hull source: resources/hull/<hull>/m0/model/v1/object.3ds (Autodesk .3ds, chunked).
 */
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");
const MAPS_DIR = path.join(ROOT, "resources", "map");
const HULL_DIR = path.join(ROOT, "resources", "hull");
const OUT_MAP = path.join(ROOT, "src", "types", "mapCollision.ts");
const OUT_COLLISION_DIR = path.join(ROOT, "src", "types", "collision"); // one JSON per map (loaded lazily)
const OUT_HULL = path.join(ROOT, "src", "types", "hullCollision.ts");

function round(n: number): number { return Math.round(n * 10) / 10; }

// --- .3ds parsing (hull only): vertex AABB + the first local-coord origin (0x4160 = pivot). ---
interface AABB { min: [number, number, number]; max: [number, number, number]; origin: [number, number, number] | null; }
function parse3ds(buf: Buffer): AABB {
    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    let origin: [number, number, number] | null = null;
    function walk(start: number, end: number): void {
        let p = start;
        while (p + 6 <= end) {
            const id = buf.readUInt16LE(p);
            const len = buf.readUInt32LE(p + 2);
            if (len < 6 || p + len > end) break;
            const body = p + 6;
            if (id === 0x4d4d || id === 0x3d3d || id === 0x4100) {
                walk(body, p + len);
            } else if (id === 0x4000) {
                let q = body;
                while (buf[q] !== 0 && q < p + len) q++;
                walk(q + 1, p + len);
            } else if (id === 0x4110) {
                const cnt = buf.readUInt16LE(body);
                let q = body + 2;
                for (let i = 0; i < cnt; i++) {
                    for (let a = 0; a < 3; a++) {
                        const v = buf.readFloatLE(q); q += 4;
                        if (v < min[a]) min[a] = v;
                        if (v > max[a]) max[a] = v;
                    }
                }
            } else if (id === 0x4160 && origin === null) {
                origin = [buf.readFloatLE(body + 36), buf.readFloatLE(body + 40), buf.readFloatLE(body + 44)];
            }
            p += len;
        }
    }
    walk(0, buf.length);
    return { min, max, origin };
}

// ---------------------------------------------------------------------------------------------
// 1) Hull boxes (per-hull collision footprint, relative to the tank origin).
// ---------------------------------------------------------------------------------------------
interface HullBox { halfX: number; halfY: number; zMin: number; zMax: number; }
const hullCollision: { [hull: string]: HullBox } = {};
for (const hull of fs.readdirSync(HULL_DIR)) {
    const model = path.join(HULL_DIR, hull, "m0", "model", "v1", "object.3ds");
    if (!fs.existsSync(model)) continue;
    const a = parse3ds(fs.readFileSync(model));
    const pz = a.origin ? a.origin[2] : a.min[2];
    hullCollision[hull] = {
        halfX: round((a.max[0] - a.min[0]) / 2),
        halfY: round((a.max[1] - a.min[1]) / 2),
        zMin: round(a.min[2] - pz),
        zMax: round(a.max[2] - pz),
    };
    console.log(`hull ${hull}: halfX=${hullCollision[hull].halfX} halfY=${hullCollision[hull].halfY}`);
}

// ---------------------------------------------------------------------------------------------
// 2) Map collision from <collision-geometry>.
// ---------------------------------------------------------------------------------------------
// Every collision primitive becomes a 3D solid box. Used for BOTH the drop raycast (land on the
// highest box top below the tank) and the pickup occlusion (segment tank->flag through any box).
interface Box { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number; }
const PLANE_THICKNESS = 80; // planes/triangles are surfaces; give them thickness so a line crossing them registers

function vec(block: string, tag: string): { x: number; y: number; z: number } {
    const sub = (block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)) || [])[1] || "";
    const g = (c: string) => { const m = sub.match(new RegExp(`<${c}>([-0-9.]+)`)); return m ? parseFloat(m[1]) : 0; };
    return { x: g("x"), y: g("y"), z: g("z") };
}

// XY AABB of a rectangle (half-extents hw,hl) centred at (cx,cy), rotated by rot around z.
function rotatedAabb(cx: number, cy: number, hw: number, hl: number, rot: number): { minX: number; maxX: number; minY: number; maxY: number } {
    const c = Math.cos(rot), s = Math.sin(rot);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [sx, sy] of [[hw, hl], [hw, -hl], [-hw, hl], [-hw, -hl]]) {
        const x = cx + sx * c - sy * s, y = cy + sx * s + sy * c;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    return { minX: round(minX), maxX: round(maxX), minY: round(minY), maxY: round(maxY) };
}

type V3 = { x: number; y: number; z: number };
// Rotate a local vertex by the map's Euler angles (ZYX order) — exactly the matrix the client builds
// for collision geometry (decompiled). Lets us place TILTED planes/triangles (ramps) correctly.
function rotateEuler(rx: number, ry: number, rz: number, v: V3): V3 {
    const c1 = Math.cos(rx), s1 = Math.sin(rx), c2 = Math.cos(ry), s2 = Math.sin(ry), c3 = Math.cos(rz), s3 = Math.sin(rz);
    const m00 = c3 * c2, m01 = c3 * s2 * s1 - s3 * c1, m02 = c3 * s2 * c1 + s3 * s1;
    const m10 = s3 * c2, m11 = s3 * s2 * s1 + c3 * c1, m12 = s3 * s2 * c1 - c3 * s1;
    const m20 = -s2, m21 = c2 * s1, m22 = c2 * c1;
    return {
        x: m00 * v.x + m01 * v.y + m02 * v.z,
        y: m10 * v.x + m11 * v.y + m12 * v.z,
        z: m20 * v.x + m21 * v.y + m22 * v.z,
    };
}
function world(rot: V3, pos: V3, v: V3): V3 { const r = rotateEuler(rot.x, rot.y, rot.z, v); return { x: r.x + pos.x, y: r.y + pos.y, z: r.z + pos.z }; }
const FLAT = 0.01; // |rx|,|ry| below this = horizontal plane (keep as a cheap AABB slab)

interface Tri { ax: number; ay: number; az: number; bx: number; by: number; bz: number; cx: number; cy: number; cz: number; }

function buildMap(xml: string): { boxes: Box[]; triangles: Tri[]; obstacles: Box[] } {
    const boxes: Box[] = [];
    const triangles: Tri[] = [];
    const obstacles: Box[] = []; // collision-box only (solid walls/structures) — for the "inside collision" check
    const start = xml.indexOf("<collision-geometry>");
    const end = xml.indexOf("</collision-geometry>");
    if (start < 0 || end < 0) return { boxes, triangles, obstacles };
    const sec = xml.slice(start, end);

    const pushTri = (a: V3, b: V3, c: V3) => triangles.push({
        ax: round(a.x), ay: round(a.y), az: round(a.z), bx: round(b.x), by: round(b.y), bz: round(b.z), cx: round(c.x), cy: round(c.y), cz: round(c.z),
    });

    // Planes: horizontal ones are a thin AABB slab (cheap); tilted ones (ramps) become 2 real triangles.
    for (const m of sec.matchAll(/<collision-plane[\s\S]*?<\/collision-plane>/g)) {
        const b = m[0];
        const w = parseFloat((b.match(/<width>([0-9.]+)/) || [])[1] || "0");
        const l = parseFloat((b.match(/<length>([0-9.]+)/) || [])[1] || "0");
        const pos = vec(b, "position");
        const rot = vec(b, "rotation");
        if (Math.abs(rot.x) < FLAT && Math.abs(rot.y) < FLAT) {
            const aabb = rotatedAabb(pos.x, pos.y, w / 2, l / 2, rot.z);
            boxes.push({ ...aabb, minZ: round(pos.z - PLANE_THICKNESS), maxZ: round(pos.z) });
        } else {
            const hw = w / 2, hl = l / 2;
            const c0 = world(rot, pos, { x: -hw, y: -hl, z: 0 });
            const c1 = world(rot, pos, { x: hw, y: -hl, z: 0 });
            const c2 = world(rot, pos, { x: hw, y: hl, z: 0 });
            const c3 = world(rot, pos, { x: -hw, y: hl, z: 0 });
            pushTri(c0, c1, c2); pushTri(c0, c2, c3);
        }
    }

    // Boxes: 3D obstacles (walls, structures) — full z range, position is the centre.
    for (const m of sec.matchAll(/<collision-box[\s\S]*?<\/collision-box>/g)) {
        const b = m[0];
        const size = vec(b, "size");
        const pos = vec(b, "position");
        const rot = vec(b, "rotation");
        const aabb = rotatedAabb(pos.x, pos.y, size.x / 2, size.y / 2, rot.z);
        const box = { ...aabb, minZ: round(pos.z - size.z / 2), maxZ: round(pos.z + size.z / 2) };
        boxes.push(box);
        obstacles.push(box);
    }

    // Triangles (slopes): the real tilted surface (3 rotated + translated vertices).
    for (const m of sec.matchAll(/<collision-triangle[\s\S]*?<\/collision-triangle>/g)) {
        const b = m[0];
        const pos = vec(b, "position"), rot = vec(b, "rotation");
        pushTri(world(rot, pos, vec(b, "v0")), world(rot, pos, vec(b, "v1")), world(rot, pos, vec(b, "v2")));
    }

    return { boxes, triangles, obstacles };
}

function findMaps(dir: string, rel: string[] = []): { id: string; xml: string }[] {
    const out: { id: string; xml: string }[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const sub = path.join(dir, entry.name);
        const xmlPath = path.join(sub, "v1", "map.xml");
        if (entry.name === "xml" && fs.existsSync(xmlPath)) {
            out.push({ id: ["map", ...rel, "xml"].join("/"), xml: fs.readFileSync(xmlPath, "utf8") });
        } else {
            out.push(...findMaps(sub, [...rel, entry.name]));
        }
    }
    return out;
}

// --- build ---
// One JSON per map (the combined data is ~50MB — far too big to embed as a TS literal; ts-node OOMs
// compiling it). The loader (mapCollision.ts) reads & caches each map's JSON on demand at runtime.
const maps = findMaps(MAPS_DIR);
fs.rmSync(OUT_COLLISION_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_COLLISION_DIR, { recursive: true });
const idToFile = (id: string) => id.replace(/[^a-z0-9]+/gi, "_") + ".json";
for (const m of maps) {
    const { boxes, triangles, obstacles } = buildMap(m.xml);
    if (!boxes.length && !triangles.length) continue;
    fs.writeFileSync(path.join(OUT_COLLISION_DIR, idToFile(m.id)), JSON.stringify({ boxes, triangles, obstacles }));
    console.log(`${m.id}: ${boxes.length} boxes, ${triangles.length} triangles, ${obstacles.length} obstacles`);
}

const loader = `// Arquivo gerado automaticamente por scripts/buildMapCollision.ts. Não edite manualmente.
import fs from "fs";
import path from "path";

export interface ICollisionBox { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number; }
export interface ICollisionTri { ax: number; ay: number; az: number; bx: number; by: number; bz: number; cx: number; cy: number; cz: number; }
export interface IMapCollision { boxes: ICollisionBox[]; triangles: ICollisionTri[]; obstacles: ICollisionBox[]; }

// Per-map collision is stored as JSON (collision/<id>.json) and loaded + cached on first use, so only
// the maps with active battles ever sit in memory (the full set is ~50MB).
const EMPTY: IMapCollision = { boxes: [], triangles: [], obstacles: [] };
const cache = new Map<string, IMapCollision>();
const idToFile = (id: string) => id.replace(/[^a-z0-9]+/gi, "_") + ".json";

export function getMapCollision(mapResourceId: string): IMapCollision {
    let c = cache.get(mapResourceId);
    if (c) return c;
    try {
        c = JSON.parse(fs.readFileSync(path.join(__dirname, "collision", idToFile(mapResourceId)), "utf8")) as IMapCollision;
    } catch {
        c = EMPTY; // no collision data for this map (or not built yet)
    }
    cache.set(mapResourceId, c);
    return c;
}
`;
fs.writeFileSync(OUT_MAP, loader);

let hullBody = "// Arquivo gerado automaticamente por scripts/buildMapCollision.ts. Não edite manualmente.\n\n";
hullBody += "// halfX/halfY = collision half-extents along the hull model's X (width) / Y (length) axes;\n";
hullBody += "// zMin/zMax relative to the tank origin (bottom). Used for the oriented flag-contact box.\n";
hullBody += "export interface IHullBox { halfX: number; halfY: number; zMin: number; zMax: number; }\n\n";
hullBody += "export const hullCollision: { [hull: string]: IHullBox } = {\n";
for (const [hull, b] of Object.entries(hullCollision)) {
    hullBody += `    "${hull}": { halfX: ${b.halfX}, halfY: ${b.halfY}, zMin: ${b.zMin}, zMax: ${b.zMax} },\n`;
}
hullBody += "};\n";
fs.writeFileSync(OUT_HULL, hullBody);

console.log(`Wrote ${OUT_MAP} and ${OUT_HULL}.`);
