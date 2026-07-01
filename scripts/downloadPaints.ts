/**
 * Bulk-downloads every paint's preview + coloring texture from a captured garage log, using the shared
 * downloadResource() (same CDN path algorithm; file list from the resource type). The paint list comes
 * from the InitMarket packet (JSON) and each resource's version/type from the LoadDependencies packets.
 *
 * Usage: ts-node scripts/downloadPaints.ts <garage-capture.ndjson>
 * Then run `npm run build:resources` so the new resources/paint/<id>/{preview,texture} get idLows.
 * Skips paints whose resources already exist (e.g. red/blue/black/white/orange).
 */
import fs from "fs";
import path from "path";
import { downloadResource } from "./downloadResource";

const INIT_MARKET_ID = -300370823;
const LOAD_DEPS_ID = -1797047325;
const ROOT = path.join(__dirname, "..");

/** Reads an optString(JSON) body: 1 null-flag byte + i32 length + utf8 JSON. */
function optStringJson(hex: string): any {
    const b = Buffer.from(hex, "hex");
    if (b.readUInt8(0) === 1) return null;
    const len = b.readInt32BE(1);
    return JSON.parse(b.toString("utf8", 5, 5 + len));
}

async function main(): Promise<void> {
    const logFile = process.argv[2];
    if (!logFile) { console.error("Usage: ts-node scripts/downloadPaints.ts <garage-capture.ndjson>"); process.exit(1); }
    const lines = fs.readFileSync(logFile, "utf8").split(/\r?\n/).filter(Boolean);

    let market: any = null;
    const depByIdLow = new Map<number, any>();
    for (const line of lines) {
        let j: any; try { j = JSON.parse(line); } catch { continue; }
        if (!j.hex) continue;
        if (j.id === INIT_MARKET_ID && !market) market = optStringJson(j.hex);
        else if (j.id === LOAD_DEPS_ID) {
            let arr = optStringJson(j.hex); if (!arr) continue;
            if (!Array.isArray(arr)) arr = arr.resources ?? [];
            for (const d of arr) if (!depByIdLow.has(d.idlow)) depByIdLow.set(d.idlow, d);
        }
    }
    if (!market) { console.error("No InitMarket packet in log."); process.exit(1); }
    const paints = (market.items ?? market).filter((it: any) => it.category === "paint");
    console.log(`Found ${paints.length} paints, ${depByIdLow.size} resource descriptors.`);

    let done = 0, skipped = 0, failed = 0;
    for (const p of paints) {
        for (const [official, kind, alpha] of [[p.previewResourceId, "preview", true], [p.coloring, "texture", false]] as [number, string, boolean][]) {
            const dest = `paint/${p.id}/${kind}`;
            if (fs.existsSync(path.join(ROOT, "resources", dest, "v1", "image.jpg"))) { skipped++; continue; }
            const d = depByIdLow.get(official);
            if (!d) { console.warn(`  ${dest}: no descriptor for idLow ${official}`); failed++; continue; }
            const ok = await downloadResource({
                dest, idLow: official, idHigh: Number(d.idhigh ?? 0),
                vHigh: Number(d.versionhigh ?? 0), vLow: Number(d.versionlow ?? 0),
                type: d.type, files: d.fileNames, alpha: alpha || !!d.alpha, log: false,
            });
            if (ok > 0) { console.log(`  ${p.id}/${kind}: ${ok} file(s)`); done++; }
            else { console.warn(`  ${dest}: 0 files`); failed++; }
        }
    }
    console.log(`\nDone. downloaded=${done} skipped(existing)=${skipped} failed=${failed}. Run 'npm run build:resources'.`);
}

main();
