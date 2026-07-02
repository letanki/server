/**
 * Unpack / repack Tanki `.tara` image containers.
 *
 * A `.tara` is a tiny archive of one or more named blobs — for textures it holds the RGB JPEG
 * under the tag "i" and (optionally) the alpha-mask JPEG under the tag "a". Layout (big-endian):
 *
 *   uint32                       entryCount
 *   entryCount ×  {              table of contents (all descriptors first)
 *       uint16  tagLen
 *       byte[tagLen] tag         UTF-8, e.g. "i" / "a"
 *       uint32  dataLen
 *   }
 *   entryCount ×  byte[dataLen]  the raw blobs, concatenated in TOC order
 *
 * Unpacking writes each blob as `<tag>.<ext>` (extension sniffed from the magic bytes) plus a
 * `tara.json` manifest that records the tag order. Packing reads that manifest (or, if absent,
 * takes files from the command line) and rebuilds a byte-identical `.tara`.
 *
 * Usage:
 *   ts-node scripts/tara.ts unpack image.tara [outDir]
 *   ts-node scripts/tara.ts pack   <inDir> [out.tara]          # uses <inDir>/tara.json
 *   ts-node scripts/tara.ts pack   out.tara i=rgb.jpg a=mask.jpg   # explicit tag=file list
 */
import fs from "fs";
import path from "path";

interface Entry {
    tag: string;
    data: Buffer;
}

interface Manifest {
    /** Tag order as it appears in the .tara TOC. */
    entries: { tag: string; file: string }[];
}

/** Parse a .tara buffer into its ordered list of tagged blobs. */
export function parseTara(buf: Buffer): Entry[] {
    let off = 0;
    const count = buf.readUInt32BE(off); off += 4;
    const toc: { tag: string; len: number }[] = [];
    for (let i = 0; i < count; i++) {
        const tagLen = buf.readUInt16BE(off); off += 2;
        const tag = buf.toString("utf8", off, off + tagLen); off += tagLen;
        const len = buf.readUInt32BE(off); off += 4;
        toc.push({ tag, len });
    }
    const entries: Entry[] = [];
    for (const { tag, len } of toc) {
        entries.push({ tag, data: buf.subarray(off, off + len) });
        off += len;
    }
    if (off !== buf.length) {
        console.warn(`Warning: parsed ${off} bytes but file is ${buf.length} (trailing data ignored).`);
    }
    return entries;
}

/** Serialize an ordered list of tagged blobs back into the .tara byte layout. */
export function buildTara(entries: Entry[]): Buffer {
    const head: Buffer[] = [];
    const count = Buffer.alloc(4);
    count.writeUInt32BE(entries.length, 0);
    head.push(count);
    for (const { tag, data } of entries) {
        const tagBuf = Buffer.from(tag, "utf8");
        const desc = Buffer.alloc(2 + tagBuf.length + 4);
        desc.writeUInt16BE(tagBuf.length, 0);
        tagBuf.copy(desc, 2);
        desc.writeUInt32BE(data.length, 2 + tagBuf.length);
        head.push(desc);
    }
    return Buffer.concat([...head, ...entries.map((e) => e.data)]);
}

/** Guess a file extension from a blob's magic bytes (falls back to .bin). */
function sniffExt(data: Buffer): string {
    if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "jpg";
    if (data.length >= 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return "png";
    return "bin";
}

/** A tag may contain path-unfriendly chars; make a safe file stem while keeping the raw tag in the manifest. */
function safeStem(tag: string, index: number): string {
    const s = tag.replace(/[^A-Za-z0-9_-]/g, "");
    return s.length ? s : `entry${index}`;
}

function unpack(taraPath: string, outDir?: string): void {
    const buf = fs.readFileSync(taraPath);
    const entries = parseTara(buf);
    const dir = outDir ?? taraPath.replace(/\.tara$/i, "") + ".unpacked";
    fs.mkdirSync(dir, { recursive: true });

    const manifest: Manifest = { entries: [] };
    entries.forEach((e, i) => {
        const file = `${safeStem(e.tag, i)}.${sniffExt(e.data)}`;
        fs.writeFileSync(path.join(dir, file), e.data);
        manifest.entries.push({ tag: e.tag, file });
        console.log(`  ${JSON.stringify(e.tag)} -> ${file} (${e.data.length} bytes)`);
    });
    fs.writeFileSync(path.join(dir, "tara.json"), JSON.stringify(manifest, null, 2));
    console.log(`Unpacked ${entries.length} entr${entries.length === 1 ? "y" : "ies"} into ${dir}`);
}

function pack(args: string[]): void {
    // Two forms: `pack <inDir> [out.tara]`  (manifest-driven)  or  `pack out.tara tag=file ...`
    const pairs = args.filter((a) => a.includes("="));
    let entries: Entry[];
    let outPath: string;

    if (pairs.length) {
        // Explicit tag=file list; first non-pair arg (or first arg) is the output path.
        outPath = args.find((a) => !a.includes("=")) ?? "out.tara";
        entries = pairs.map((p) => {
            const eq = p.indexOf("=");
            const tag = p.slice(0, eq);
            const file = p.slice(eq + 1);
            return { tag, data: fs.readFileSync(file) };
        });
    } else {
        const inDir = args[0];
        if (!inDir || !fs.statSync(inDir).isDirectory()) {
            throw new Error("pack: give a directory containing tara.json, or a list of tag=file pairs.");
        }
        const manifest: Manifest = JSON.parse(fs.readFileSync(path.join(inDir, "tara.json"), "utf8"));
        outPath = args[1] ?? path.join(inDir, "repacked.tara");
        entries = manifest.entries.map((e) => ({ tag: e.tag, data: fs.readFileSync(path.join(inDir, e.file)) }));
    }

    fs.writeFileSync(outPath, buildTara(entries));
    console.log(`Packed ${entries.length} entr${entries.length === 1 ? "y" : "ies"} into ${outPath} (${fs.statSync(outPath).size} bytes)`);
}

function main(): void {
    const [cmd, ...rest] = process.argv.slice(2);
    if (cmd === "unpack" && rest[0]) {
        unpack(rest[0], rest[1]);
    } else if (cmd === "pack" && rest[0]) {
        pack(rest);
    } else {
        console.error(
            "Usage:\n" +
            "  ts-node scripts/tara.ts unpack <image.tara> [outDir]\n" +
            "  ts-node scripts/tara.ts pack   <inDir> [out.tara]          (uses <inDir>/tara.json)\n" +
            "  ts-node scripts/tara.ts pack   <out.tara> i=rgb.jpg a=mask.jpg"
        );
        process.exit(1);
    }
}

if (require.main === module) main();
