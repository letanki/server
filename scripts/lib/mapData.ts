/**
 * Shared map-data extraction used by the build scripts. The goal is "parse each map.xml ONCE": the
 * caller reads the file and runs xml2js a single time, then feeds the parsed object (and, for the
 * regex-based sections, the raw string) to these pure extractors. Output shapes match the data the
 * server consumes per mapResourceId.
 */
import fs from "fs";
import path from "path";

export interface IVector3 { x: number; y: number; z: number; }
export interface ISpawnPoint { type: string; position: IVector3; rotation: IVector3; }
export interface ISpecialBox { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number; action: "kill" | "kick"; }
export interface ICtfFlags { red: IVector3; blue: IVector3; }
export interface IDomKeypoint { name: string; radius: number; position: IVector3; }
export interface IBonusRegion { bonusType: string; min: IVector3; max: IVector3; gameModes: string[]; }

/** All per-map "battle" data extracted from one map.xml. Collision is built separately (large). */
export interface IMapBattleData {
    spawns: ISpawnPoint[];
    geometries: ISpecialBox[];
    ctfFlags: ICtfFlags | null;
    domKeypoints: IDomKeypoint[];
    bonusRegions: IBonusRegion[];
}

/** mapResourceId ("map/<name>/<theme>/xml") -> JSON filename, shared by writer and runtime loader. */
export function idToFile(id: string): string {
    return id.replace(/[^a-z0-9]+/gi, "_") + ".json";
}

/** Walks resources/map and returns every map's id + raw xml. */
export function findMaps(dir: string, rel: string[] = []): { id: string; xml: string }[] {
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

// --- DOM extractors (operate on the single xml2js parse) -------------------------------------

/** library-name of every static-geometry prop (for proplibs.xml + map dependencies). */
export function extractPropLibs(parsedMap: any): string[] {
    const libs = new Set<string>();
    const props = parsedMap.map?.["static-geometry"]?.[0]?.prop;
    if (Array.isArray(props)) {
        for (const prop of props) {
            if (prop.$ && prop.$["library-name"]) libs.add(prop.$["library-name"]);
        }
    }
    return [...libs];
}

export function extractSpawnPoints(parsedMap: any): ISpawnPoint[] | null {
    const node = parsedMap.map?.["spawn-points"]?.[0]?.["spawn-point"];
    if (!node) return null;
    return node.map((sp: any) => {
        const pos = sp.position[0];
        const rot = sp.rotation[0];
        return {
            type: sp.$.type,
            position: { x: parseFloat(pos.x?.[0] ?? "0"), y: parseFloat(pos.y?.[0] ?? "0"), z: parseFloat(pos.z?.[0] ?? "0") },
            rotation: { x: parseFloat(rot.x?.[0] ?? "0"), y: parseFloat(rot.y?.[0] ?? "0"), z: parseFloat(rot.z?.[0] ?? "0") },
        };
    });
}

export function extractSpecialGeometries(parsedMap: any): ISpecialBox[] | null {
    const node = parsedMap.map?.["special-geometry"]?.[0]?.["special-box"];
    if (!node) return null;
    return node.map((b: any) => ({
        minX: parseFloat(b.minX[0]), minY: parseFloat(b.minY[0]), minZ: parseFloat(b.minZ[0]),
        maxX: parseFloat(b.maxX[0]), maxY: parseFloat(b.maxY[0]), maxZ: parseFloat(b.maxZ[0]),
        action: b.action[0],
    }));
}

export function extractCtfFlags(parsedMap: any): ICtfFlags | null {
    const flags = parsedMap.map?.["ctf-flags"]?.[0];
    if (!flags) return null;
    const red = flags["flag-red"]?.[0];
    const blue = flags["flag-blue"]?.[0];
    if (red && blue) {
        return {
            red: { x: parseFloat(red.x[0]), y: parseFloat(red.y[0]), z: parseFloat(red.z[0]) },
            blue: { x: parseFloat(blue.x[0]), y: parseFloat(blue.y[0]), z: parseFloat(blue.z[0]) },
        };
    }
    return null;
}

export function extractDomKeypoints(parsedMap: any, mapId: string): IDomKeypoint[] | null {
    const node = parsedMap.map?.["dom-keypoints"]?.[0]?.["dom-keypoint"];
    if (!node) return null;
    return node
        .map((kp: any, index: number) => {
            if (!kp || typeof kp !== "object") {
                console.warn(`Warning: Malformed keypoint at index ${index} in map ${mapId}.`);
                return null;
            }
            if (!kp.$ || !kp.$.name) {
                console.warn(`Warning: dom-keypoint without 'name' in map ${mapId}. Skipping index ${index}.`);
                return null;
            }
            const pos = kp.position?.[0];
            if (!pos) {
                console.warn(`Warning: dom-keypoint "${kp.$.name}" without 'position' in map ${mapId}. Skipping.`);
                return null;
            }
            return {
                name: kp.$.name,
                radius: parseFloat(kp.$.distance ?? "0"),
                position: { x: parseFloat(pos.x?.[0] ?? "0"), y: parseFloat(pos.y?.[0] ?? "0"), z: parseFloat(pos.z?.[0] ?? "0") },
            };
        })
        .filter((kp: IDomKeypoint | null): kp is IDomKeypoint => kp !== null);
}

// --- Regex extractor (bonus regions; cheap, runs on the raw string) ----------------------------

function vecFromBlock(block: string, tag: string): IVector3 {
    const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
    const s = m ? m[1] : "";
    const num = (axis: string) => {
        const a = s.match(new RegExp(`<${axis}>([^<]*)</${axis}>`));
        return a ? Math.round(parseFloat(a[1]) * 10) / 10 : 0;
    };
    return { x: num("x"), y: num("y"), z: num("z") };
}

export function parseBonusRegions(xml: string): IBonusRegion[] {
    const out: IBonusRegion[] = [];
    for (const m of xml.matchAll(/<bonus-region[\s\S]*?<\/bonus-region>/g)) {
        const b = m[0];
        const typeMatch = b.match(/<bonus-type>([^<]*)<\/bonus-type>/);
        if (!typeMatch) continue;
        const gameModes = [...b.matchAll(/<game-mode>([^<]*)<\/game-mode>/g)].map((g) => g[1].toLowerCase());
        out.push({ bonusType: typeMatch[1].trim(), min: vecFromBlock(b, "min"), max: vecFromBlock(b, "max"), gameModes });
    }
    return out;
}
