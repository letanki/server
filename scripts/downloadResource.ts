/**
 * Downloads a game resource from the official server into the SOURCE tree (resources/<dest>/v<n>/);
 * `npm run build:resources` then produces the .resource entry — never edit .resource by hand. The
 * idLow is normally derived from the dest path (crc), which is fine when WE control how the resource
 * is referenced (e.g. via ResourceManager.getIdlowById). Pass --pinid only when something out of our
 * control references the resource by the official id (writes id.json to pin it).
 *
 * The CDN path is the client's own algorithm (decompiled): each id byte and the interleaved high/low
 * version in octal. Get a resource's descriptor (idhigh, idlow, versionhigh, versionlow, type,
 * fileNames) from a LoadDependencies entry in the reference logs. The OFFICIAL version is only used
 * to fetch the files; locally we store them under v<localversion> (the version OUR build assigns).
 *
 * Usage:
 *   ts-node scripts/downloadResource.ts --dest=clan/emblem --idlow=11805 --vhigh=413 --vlow=3234669125 --type=10
 *   ts-node scripts/downloadResource.ts --dest=foo/bar --idlow=123 --vlow=1 --type=3 --files=object.3ds,images.xml
 * Flags: --idhigh (default 0), --localversion (default 1), --files (csv override), --base (override CDN).
 */
import axios from "axios";
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");
const RESOURCES_DIR = path.join(ROOT, "resources");
const DEFAULT_BASE = "http://146.59.110.103";

// Files a resource type carries when the descriptor doesn't list them explicitly (fileNames).
// `alpha` textures additionally fetch alpha.tara. Extend as new types are needed.
const TYPE_FILES: { [type: number]: string[] } = {
    3: ["object.3ds", "images.xml"],   // 3D model (jpg textures usually come via fileNames)
    4: ["sound.swf"],                  // sound
    8: ["map.xml", "proplibs.xml"],    // map / proplib
    10: ["image.jpg"],                 // texture (+ alpha.jpg when alpha)
    11: ["image.jpg"],                 // texture
    17: ["image.jpg"],                 // texture / sprite
};
const ALPHA_TYPES = new Set([10, 11, 13, 17]); // append alpha.jpg when the descriptor is alpha

/** Octal-encode the interleaved high/low version exactly like the client. */
function encodeVersion(vHigh: number, vLow: number): string {
    let shift = 0, hi = "", lo = "";
    for (let i = 0; i < 5; i++) {
        const h = (((vHigh & ((63 << (4 + shift)) >>> 0)) >>> 0) >>> (shift + 4)) >>> 0;
        const l = (((vLow & ((63 << shift) >>> 0)) >>> 0) >>> shift) >>> 0;
        hi = (h < 8 ? "0" : "") + h.toString(8) + hi;
        lo = (l < 8 ? "0" : "") + l.toString(8) + lo;
        shift += 6;
    }
    const mid = (((vHigh & 0x0f) << 2) + (vLow >>> 30)) >>> 0;
    const s = hi + (mid < 8 ? "0" : "") + mid.toString(8) + lo;
    let k = 0;
    while (k < s.length && s[k] === "0") k++;
    return s.substr(k);
}

/** Client resource path: /idHigh/(idLow>>16)/(idLow>>8 & FF)/(idLow & FF)/version/ — all octal. */
function resourcePath(idHigh: number, idLow: number, vHigh: number, vLow: number): string {
    return (
        "/" + idHigh.toString(8) +
        "/" + (((idLow >> 16) & 0xffff) >>> 0).toString(8) +
        "/" + ((idLow >> 8) & 0xff).toString(8) +
        "/" + (idLow & 0xff).toString(8) +
        "/" + encodeVersion(vHigh, vLow) + "/"
    );
}

function arg(name: string): string | undefined {
    const a = process.argv.find((x) => x.startsWith(`--${name}=`));
    return a ? a.split("=").slice(1).join("=") : undefined;
}

async function main(): Promise<void> {
    const idLow = Number(arg("idlow"));
    const idHigh = Number(arg("idhigh") ?? 0);
    const vHigh = Number(arg("vhigh") ?? 0);
    const vLow = Number(arg("vlow") ?? 0);
    const type = Number(arg("type"));
    const base = (arg("base") ?? DEFAULT_BASE).replace(/\/$/, "");
    const filesArg = arg("files");
    const alpha = arg("alpha") === "true";
    const dest = arg("dest");
    const localVersion = Number(arg("localversion") ?? 1);

    if (!dest || !Number.isFinite(idLow) || !Number.isFinite(type)) {
        console.error("Required: --dest, --idlow and --type (see usage at top of file).");
        process.exit(1);
    }

    const rel = resourcePath(idHigh, idLow, vHigh, vLow); // CDN path (official version)
    let files = filesArg ? filesArg.split(",").map((f) => f.trim()) : TYPE_FILES[type];
    if (!files) {
        console.error(`No default file list for type ${type}; pass --files=a,b,c.`);
        process.exit(1);
    }
    if (!filesArg && alpha && ALPHA_TYPES.has(type)) files = [...files, "alpha.jpg"];

    const destDir = path.join(RESOURCES_DIR, dest, `v${localVersion}`);
    console.log(`Resource idLow=${idLow} type=${type} CDN version=${vHigh}:${vLow}`);
    console.log(`CDN path: ${rel}  ->  resources/${dest}/v${localVersion}/`);
    fs.mkdirSync(destDir, { recursive: true });

    let ok = 0;
    for (const file of files) {
        const url = `${base}${rel}${file}`;
        try {
            const res = await axios.get(url, { responseType: "arraybuffer", validateStatus: () => true, proxy: false });
            if (res.status !== 200) {
                console.warn(`  ${file}: HTTP ${res.status} (skipped)`);
                continue;
            }
            fs.writeFileSync(path.join(destDir, file), Buffer.from(res.data));
            console.log(`  ${file}: ${(res.data as ArrayBuffer).byteLength} bytes`);
            ok++;
        } catch (e: any) {
            console.warn(`  ${file}: ${e.message}`);
        }
    }
    // Only pin the idLow (id.json) when requested; otherwise the build crc-derives it from the path.
    if (arg("pinid") === "true") fs.writeFileSync(path.join(destDir, "id.json"), JSON.stringify({ idlow: idLow }));
    console.log(ok ? `Done (${ok}/${files.length} files). Run 'npm run build:resources'.` : "No files downloaded — check id/version/type or --files.");
}

main();
