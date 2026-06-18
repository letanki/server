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

function buildMap(xml: string): Box[] {
    const boxes: Box[] = [];
    const start = xml.indexOf("<collision-geometry>");
    const end = xml.indexOf("</collision-geometry>");
    if (start < 0 || end < 0) return boxes;
    const sec = xml.slice(start, end);

    // Planes: horizontal surfaces — top at z, thin slab below.
    for (const m of sec.matchAll(/<collision-plane[\s\S]*?<\/collision-plane>/g)) {
        const b = m[0];
        const w = parseFloat((b.match(/<width>([0-9.]+)/) || [])[1] || "0");
        const l = parseFloat((b.match(/<length>([0-9.]+)/) || [])[1] || "0");
        const pos = vec(b, "position");
        const rot = vec(b, "rotation");
        const aabb = rotatedAabb(pos.x, pos.y, w / 2, l / 2, rot.z);
        boxes.push({ ...aabb, minZ: round(pos.z - PLANE_THICKNESS), maxZ: round(pos.z) });
    }

    // Boxes: 3D obstacles (walls, structures) — full z range, position is the centre.
    for (const m of sec.matchAll(/<collision-box[\s\S]*?<\/collision-box>/g)) {
        const b = m[0];
        const size = vec(b, "size");
        const pos = vec(b, "position");
        const rot = vec(b, "rotation");
        const aabb = rotatedAabb(pos.x, pos.y, size.x / 2, size.y / 2, rot.z);
        boxes.push({ ...aabb, minZ: round(pos.z - size.z / 2), maxZ: round(pos.z + size.z / 2) });
    }

    // Triangles (slopes): approximate as a thin slab at the highest local vertex + position.z.
    for (const m of sec.matchAll(/<collision-triangle[\s\S]*?<\/collision-triangle>/g)) {
        const b = m[0];
        const v0 = vec(b, "v0"), v1 = vec(b, "v1"), v2 = vec(b, "v2"), pos = vec(b, "position");
        const xs = [v0.x, v1.x, v2.x], ys = [v0.y, v1.y, v2.y];
        const topZ = round(pos.z + Math.max(v0.z, v1.z, v2.z));
        boxes.push({
            minX: round(pos.x + Math.min(...xs)), maxX: round(pos.x + Math.max(...xs)),
            minY: round(pos.y + Math.min(...ys)), maxY: round(pos.y + Math.max(...ys)),
            minZ: round(topZ - PLANE_THICKNESS), maxZ: topZ,
        });
    }

    return boxes;
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
const maps = findMaps(MAPS_DIR);
let mapBody = "// Arquivo gerado automaticamente por scripts/buildMapCollision.ts. Não edite manualmente.\n\n";
mapBody += "// 3D solid collision boxes per map (from <collision-geometry>). The flag drops onto the\n";
mapBody += "// highest box top (maxZ) below the tank; pickup is blocked if a box lies between tank and flag.\n";
mapBody += "export interface ICollisionBox { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number; }\n\n";
mapBody += "export const mapCollision: { [mapResourceId: string]: ICollisionBox[] } = {\n";
for (const m of maps) {
    const boxes = buildMap(m.xml);
    if (boxes.length) {
        const rows = boxes.map((b) => `        { minX: ${b.minX}, maxX: ${b.maxX}, minY: ${b.minY}, maxY: ${b.maxY}, minZ: ${b.minZ}, maxZ: ${b.maxZ} },`).join("\n");
        mapBody += `    "${m.id}": [\n${rows}\n    ],\n`;
    }
    console.log(`${m.id}: ${boxes.length} collision boxes`);
}
mapBody += "};\n";
fs.writeFileSync(OUT_MAP, mapBody);

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
