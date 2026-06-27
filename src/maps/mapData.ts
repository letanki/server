// Lazy loader for the per-map battle data. This file is HAND-WRITTEN source (logic + cache); the
// data it reads is generated into src/generated/map-data/<id>.json by scripts/buildResources.ts.
// Only maps with active battles stay in memory; evictMapData drops a map when its last battle ends.
import fs from "fs";
import path from "path";

export interface IVector3 { x: number; y: number; z: number; }
export interface ISpawnPoint { type: string; position: IVector3; rotation: IVector3; }
export interface ISpecialBox { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number; action: "kill" | "kick"; }
export interface ICtfFlags { red: IVector3; blue: IVector3; }
export interface IDomKeypoint { name: string; radius: number; position: IVector3; }
export interface IBonusRegion { bonusType: string; min: IVector3; max: IVector3; gameModes: string[]; }

export interface IMapData {
    spawns: ISpawnPoint[];
    geometries: ISpecialBox[];
    ctfFlags: ICtfFlags | null;
    domKeypoints: IDomKeypoint[];
    bonusRegions: IBonusRegion[];
}

const EMPTY: IMapData = { spawns: [], geometries: [], ctfFlags: null, domKeypoints: [], bonusRegions: [] };
const cache = new Map<string, IMapData>();
const idToFile = (id: string) => id.replace(/[^a-z0-9]+/gi, "_") + ".json";

// __dirname/../generated -> src/generated (dev) or dist/generated (prod); dist mirrors src.
const DATA_DIR = path.join(__dirname, "..", "generated", "map-data");

/** Per-map battle data, loaded + cached on first use (EMPTY if the map has no data / isn't built). */
export function getMapData(mapResourceId: string): IMapData {
    let d = cache.get(mapResourceId);
    if (d) return d;
    try {
        d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, idToFile(mapResourceId)), "utf8")) as IMapData;
    } catch {
        d = EMPTY;
    }
    cache.set(mapResourceId, d);
    return d;
}

/** Drops a map from the cache (called when its last battle ends). */
export function evictMapData(mapResourceId: string): void {
    cache.delete(mapResourceId);
}

export const getMapSpawns = (id: string): ISpawnPoint[] => getMapData(id).spawns;
export const getMapGeometries = (id: string): ISpecialBox[] => getMapData(id).geometries;
export const getMapCtfFlags = (id: string): ICtfFlags | null => getMapData(id).ctfFlags;
export const getMapDomKeypoints = (id: string): IDomKeypoint[] => getMapData(id).domKeypoints;
export const getMapBonusRegions = (id: string): IBonusRegion[] => getMapData(id).bonusRegions;

// Identified once per loaded map; keyed by the geometries array so it follows getMapData's cache/eviction.
const ceilingCache = new WeakMap<ISpecialBox[], ISpecialBox | null>();

/**
 * The map's "ceiling" kill/kick box — the topmost horizontal slab spanning the play area (a tank that climbs
 * too high lands in it and dies/gets kicked). Found by shape: a thin-in-Z box that covers most of the map's
 * X and Y extent and sits in the upper half of its Z range. Returns null for maps with no such slab (open /
 * space maps). Parkour mode skips this box so there's no upper limit — only the side and floor zones remain.
 */
export function getMapCeilingBox(id: string): ISpecialBox | null {
    const boxes = getMapGeometries(id);
    const cached = ceilingCache.get(boxes);
    if (cached !== undefined) return cached;

    let ceiling: ISpecialBox | null = null;
    if (boxes.length > 0) {
        let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        for (const b of boxes) {
            minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY); minZ = Math.min(minZ, b.minZ);
            maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY); maxZ = Math.max(maxZ, b.maxZ);
        }
        const spanX = maxX - minX, spanY = maxY - minY, midZ = (minZ + maxZ) / 2;
        for (const b of boxes) {
            const bx = b.maxX - b.minX, by = b.maxY - b.minY, bz = b.maxZ - b.minZ;
            const isSlab = bx >= 0.6 * spanX && by >= 0.6 * spanY && bz <= bx && bz <= by;
            if (isSlab && b.minZ >= midZ && (ceiling === null || b.minZ > ceiling.minZ)) ceiling = b;
        }
    }
    ceilingCache.set(boxes, ceiling);
    return ceiling;
}
