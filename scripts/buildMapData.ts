/**
 * Extracts the per-map GAMEPLAY data (spawn points, special-geometry kill/kick boxes, CTF flag
 * positions, DOM keypoints, bonus/drop regions) from every map.xml into one JSON per map at
 * src/generated/map-data/<id>.json. The runtime loads these lazily via src/maps/mapData.ts.
 *
 * Independent of the resource build (no resource ids needed), so it can be re-run on its own when
 * only map gameplay data changed — without the heavy resources copy.
 */
import fs from "fs";
import path from "path";
import { parseStringPromise } from "xml2js";
import { extractCtfFlags, extractDomKeypoints, extractSpawnPoints, extractSpecialGeometries, findMaps, idToFile, parseBonusRegions } from "./lib/mapData";

const ROOT = path.join(__dirname, "..");
const MAPS_DIR = path.join(ROOT, "resources", "map");
const OUT_DIR = path.join(ROOT, "src", "generated", "map-data");

async function build() {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const maps = findMaps(MAPS_DIR);
    for (const m of maps) {
        const parsed = await parseStringPromise(m.xml, { trim: true });
        const data = {
            spawns: extractSpawnPoints(parsed) ?? [],
            geometries: extractSpecialGeometries(parsed) ?? [],
            ctfFlags: extractCtfFlags(parsed),
            domKeypoints: extractDomKeypoints(parsed, m.id) ?? [],
            bonusRegions: parseBonusRegions(m.xml),
        };
        fs.writeFileSync(path.join(OUT_DIR, idToFile(m.id)), JSON.stringify(data));
    }
    console.log(`Wrote map data for ${maps.length} maps to ${OUT_DIR}.`);
}

build().catch((error) => {
    console.error("Map data build failed:", error);
    process.exit(1);
});
