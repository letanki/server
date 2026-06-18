/**
 * Generates src/types/mapCollision.ts: per-map axis-aligned ground boxes used for the server-side
 * "drop the flag to the ground below the tank" raycast (and void detection).
 *
 * We only model the WALKABLE FLOOR (the Grass/Concrete tile props). Each tile is `WxH` 500-unit
 * cells (e.g. "1x1" = 500x500) centered at its position; rotation by ~90deg swaps W/H. The box top
 * is the tile's position z (a tank rests at topZ + ~89). Cliffs/walls/bushes are NOT floors, so
 * they're excluded — a point not covered by any tile is treated as the void.
 */
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");
const MAPS_DIR = path.join(ROOT, "resources", "map");
const OUT = path.join(ROOT, "src", "types", "mapCollision.ts");
const CELL = 500; // a "1x1" tile is 500x500 units

interface Box { minX: number; maxX: number; minY: number; maxY: number; topZ: number; }

function num(re: RegExp, s: string): number {
    const m = s.match(re);
    return m ? parseFloat(m[1]) : NaN;
}

function tilesFromMap(xml: string): Box[] {
    const boxes: Box[] = [];
    for (const block of xml.split("<prop ").slice(1)) {
        const lib = (block.match(/library-name="([^"]*)"/) || [])[1] || "";
        const name = (block.match(/ name="([^"]*)"/) || [])[1] || "";
        if (!/Tiles/.test(lib)) continue; // only floor tiles

        const size = name.match(/(\d+)x(\d+)/);
        if (!size) continue;
        let w = parseInt(size[1], 10);
        let h = parseInt(size[2], 10);

        const pos = (block.match(/<position>([\s\S]*?)<\/position>/) || [])[1] || "";
        const x = num(/<x>([-0-9.]+)/, pos);
        const y = num(/<y>([-0-9.]+)/, pos);
        const z = num(/<z>([-0-9.]+)/, pos);
        if (isNaN(x) || isNaN(y) || isNaN(z)) continue;

        // Rotation around z: ~90deg / ~270deg swaps the footprint.
        const rot = (block.match(/<rotation>([\s\S]*?)<\/rotation>/) || [])[1] || "";
        const rz = num(/<z>([-0-9.]+)/, rot) || 0;
        const quarter = Math.round((rz / (Math.PI / 2))) % 2; // 0 or 1
        if (quarter !== 0) [w, h] = [h, w];

        const hx = (w * CELL) / 2;
        const hy = (h * CELL) / 2;
        boxes.push({ minX: x - hx, maxX: x + hx, minY: y - hy, maxY: y + hy, topZ: z });
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

const maps = findMaps(MAPS_DIR);
let body = "// Arquivo gerado automaticamente por scripts/buildMapCollision.ts. Não edite manualmente.\n\n";
body += "export interface ICollisionBox { minX: number; maxX: number; minY: number; maxY: number; topZ: number; }\n\n";
body += "export const mapCollision: { [mapResourceId: string]: ICollisionBox[] } = {\n";
for (const m of maps) {
    const boxes = tilesFromMap(m.xml);
    if (boxes.length === 0) continue;
    const rows = boxes.map((b) => `        { minX: ${b.minX}, maxX: ${b.maxX}, minY: ${b.minY}, maxY: ${b.maxY}, topZ: ${b.topZ} },`).join("\n");
    body += `    "${m.id}": [\n${rows}\n    ],\n`;
    console.log(`${m.id}: ${boxes.length} floor boxes`);
}
body += "};\n";

fs.writeFileSync(OUT, body);
console.log(`Wrote ${OUT} for ${maps.length} maps.`);
