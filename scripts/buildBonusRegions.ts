/**
 * Extracts the bonus (drop) spawn regions from every map's authoritative map.xml <bonus-regions>
 * into src/types/bonusRegions.ts, keyed by mapResourceId ("map/<name>/<theme>/xml" — the same key
 * CollisionService uses). Each <bonus-region> has a min/max box (the drop area), a bonus-type (the
 * drop spawned there) and the game-modes it applies to. BonusService spawns drops at random points
 * inside these boxes for regions matching the battle's mode.
 */
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");
const MAPS_DIR = path.join(ROOT, "resources", "map");
const OUT = path.join(ROOT, "src", "types", "bonusRegions.ts");

interface IVec { x: number; y: number; z: number; }
interface IBonusRegion { bonusType: string; min: IVec; max: IVec; gameModes: string[]; }

function vec(block: string, tag: string): IVec {
    const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
    const s = m ? m[1] : "";
    const num = (axis: string) => {
        const a = s.match(new RegExp(`<${axis}>([^<]*)</${axis}>`));
        return a ? Math.round(parseFloat(a[1]) * 10) / 10 : 0;
    };
    return { x: num("x"), y: num("y"), z: num("z") };
}

function parseRegions(xml: string): IBonusRegion[] {
    const out: IBonusRegion[] = [];
    for (const m of xml.matchAll(/<bonus-region[\s\S]*?<\/bonus-region>/g)) {
        const b = m[0];
        const typeMatch = b.match(/<bonus-type>([^<]*)<\/bonus-type>/);
        if (!typeMatch) continue; // regions without an explicit type are skipped
        const gameModes = [...b.matchAll(/<game-mode>([^<]*)<\/game-mode>/g)].map((g) => g[1].toLowerCase());
        out.push({ bonusType: typeMatch[1].trim(), min: vec(b, "min"), max: vec(b, "max"), gameModes });
    }
    return out;
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

const result: Record<string, IBonusRegion[]> = {};
let total = 0;
for (const m of findMaps(MAPS_DIR)) {
    const regions = parseRegions(m.xml);
    if (regions.length === 0) continue;
    result[m.id] = regions;
    total += regions.length;
    console.log(`${m.id}: ${regions.length} bonus regions`);
}

let body = "// Arquivo gerado automaticamente por scripts/buildBonusRegions.ts. Não edite manualmente.\n\n";
body += "export interface IBonusVec { x: number; y: number; z: number; }\n";
body += "export interface IBonusRegion { bonusType: string; min: IBonusVec; max: IBonusVec; gameModes: string[]; }\n\n";
body += "// Per-map drop regions keyed by mapResourceId (\"map/<name>/<theme>/xml\").\n";
body += "export const bonusRegions: Record<string, IBonusRegion[]> = " + JSON.stringify(result) + ";\n";
fs.writeFileSync(OUT, body);
console.log(`Wrote ${OUT} (${Object.keys(result).length} maps, ${total} regions).`);
