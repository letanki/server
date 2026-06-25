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
