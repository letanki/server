// Lazy loader for per-map collision data. HAND-WRITTEN source (logic + cache); the data it reads is
// generated into src/generated/collision/<id>.json by scripts/buildMapCollision.ts. Only maps with
// active battles stay in memory; evictMapCollision drops a map when its last battle ends.
import fs from "fs";
import path from "path";

export interface ICollisionBox { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number; }
export interface ICollisionTri { ax: number; ay: number; az: number; bx: number; by: number; bz: number; cx: number; cy: number; cz: number; }
export interface IMapCollision { boxes: ICollisionBox[]; triangles: ICollisionTri[]; obstacles: ICollisionBox[]; }

const EMPTY: IMapCollision = { boxes: [], triangles: [], obstacles: [] };
const cache = new Map<string, IMapCollision>();
const idToFile = (id: string) => id.replace(/[^a-z0-9]+/gi, "_") + ".json";

// __dirname/../generated -> src/generated (dev) or dist/generated (prod); dist mirrors src.
const DATA_DIR = path.join(__dirname, "..", "generated", "collision");

export function getMapCollision(mapResourceId: string): IMapCollision {
    let c = cache.get(mapResourceId);
    if (c) return c;
    try {
        c = JSON.parse(fs.readFileSync(path.join(DATA_DIR, idToFile(mapResourceId)), "utf8")) as IMapCollision;
    } catch {
        c = EMPTY; // no collision data for this map (or not built yet)
    }
    cache.set(mapResourceId, c);
    return c;
}

/** Drops a map from the cache (called when its last battle ends). */
export function evictMapCollision(mapResourceId: string): void {
    cache.delete(mapResourceId);
}
