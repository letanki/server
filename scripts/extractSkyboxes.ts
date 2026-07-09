/**
 * Extrai skyboxes dos logs de captura (.ndjson) e baixa as texturas do CDN oficial.
 *
 * Como funciona:
 *  1. Varre todos os *.ndjson (raiz + logs/) coletando:
 *     - InitBattlefieldModelPacket → o campo `skybox` (JSON com os 6 idLows por face) + map_id;
 *     - LoadDependenciesPacket → descritores completos (idlow → versionhigh/versionlow/idhigh/type),
 *       necessários porque o CDN exige a VERSÃO no caminho e o InitBattlefield só traz os ids.
 *  2. Deduplica os sets pela tupla das 6 faces (mesmos ids = mesmo skybox, não baixa de novo) e
 *     consulta downloads/skyboxes/manifest.json — sets já baixados são pulados em execuções futuras.
 *  3. Baixa cada face como <face>.jpg em downloads/skyboxes/<mapa>_<frontId>/v1/ — o layout já é o
 *     dos sets nomeados (resources/skybox/<nome>/v1/{front,...}.jpg): pra adotar um set é só copiar
 *     a pasta pra resources/skybox/<nome-que-quiser>/ e rodar `npm run build:resources`.
 *
 * A pasta downloads/ é ignorada pelo git (material de referência, não recurso do servidor).
 * Um set cujo descritor não aparece em nenhum log fica registrado como "pendente" — capture um
 * login/entrada em batalha com o cache do cliente limpo para o servidor reenviar o LoadDependencies.
 *
 * Uso: npm run extract:skyboxes   (ou ts-node scripts/extractSkyboxes.ts [--force])
 */
import axios from "axios";
import fs from "fs";
import path from "path";
import { ResourcePathUtils } from "../src/utils/resource.path.utils";

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "downloads", "skyboxes");
const MANIFEST_PATH = path.join(OUT_DIR, "manifest.json");
const CDN_BASE = "http://146.59.110.103";
const FACES = ["front", "back", "left", "right", "top", "bottom"] as const;
type Face = (typeof FACES)[number];

interface Descriptor { idhigh: number; idlow: number; versionhigh: number; versionlow: number; type: number; }
interface SkyboxSet { key: string; faces: Record<Face, number>; maps: Set<string>; }
interface ManifestEntry { folder: string; faces: Record<Face, number>; maps: string[]; downloadedAt: string; }

/** Extrai o primeiro array JSON de um payload binário (prefixo de callback/length + lixo ao final),
 *  varrendo colchetes com respeito a strings — JSON.parse direto falha pelo lixo pós-array. */
function extractJsonArray(buf: Buffer): unknown[] | null {
    const start = buf.indexOf(0x5b); // '['
    if (start === -1) return null;
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < buf.length; i++) {
        const c = buf[i];
        if (esc) { esc = false; continue; }
        if (inStr) { if (c === 0x5c) esc = true; else if (c === 0x22) inStr = false; continue; }
        if (c === 0x22) inStr = true;
        else if (c === 0x5b) depth++;
        else if (c === 0x5d && --depth === 0) {
            try { return JSON.parse(buf.slice(start, i + 1).toString("utf8")); } catch { return null; }
        }
    }
    return null;
}

/** Extrai o primeiro objeto JSON do payload (InitBattlefield: length-prefix + JSON). */
function extractJsonObject(buf: Buffer): any | null {
    const start = buf.indexOf(0x7b); // '{'
    if (start === -1) return null;
    try { return JSON.parse(buf.slice(start).toString("utf8")); } catch { return null; }
}

function listLogs(): string[] {
    const dirs = [ROOT, path.join(ROOT, "logs")];
    const files: string[] = [];
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;
        for (const f of fs.readdirSync(dir)) {
            if (f.endsWith(".ndjson")) files.push(path.join(dir, f));
        }
    }
    return files;
}

function scanLogs(): { sets: Map<string, SkyboxSet>; descriptors: Map<number, Descriptor> } {
    const sets = new Map<string, SkyboxSet>();
    const descriptors = new Map<number, Descriptor>();

    for (const file of listLogs()) {
        let text: string;
        try { text = fs.readFileSync(file, "utf8"); } catch { continue; }
        // Filtro barato antes do parse linha-a-linha (logs de 100MB+ existem).
        if (!text.includes("InitBattlefieldModelPacket") && !text.includes("LoadDependenciesPacket")) continue;

        for (const line of text.split("\n")) {
            if (!line) continue;
            const isInit = line.includes("InitBattlefieldModelPacket");
            const isDeps = line.includes("LoadDependenciesPacket");
            if (!isInit && !isDeps) continue;
            let entry: any;
            try { entry = JSON.parse(line); } catch { continue; }
            if (!entry.hex) continue;
            const buf = Buffer.from(entry.hex, "hex");

            if (entry.name === "LoadDependenciesPacket") {
                const resources = extractJsonArray(buf);
                if (!Array.isArray(resources)) continue;
                for (const r of resources as any[]) {
                    if (r && typeof r.idlow === "number" && !descriptors.has(r.idlow)) descriptors.set(r.idlow, r);
                }
            } else if (entry.name === "InitBattlefieldModelPacket") {
                const data = extractJsonObject(buf);
                if (!data?.skybox) continue;
                let sky: Record<string, number>;
                try { sky = JSON.parse(data.skybox); } catch { continue; }
                if (!FACES.every((f) => typeof sky[f] === "number")) continue;
                const faces = Object.fromEntries(FACES.map((f) => [f, sky[f]])) as Record<Face, number>;
                const key = FACES.map((f) => faces[f]).join("-");
                const mapName = String(data.map_id ?? "unknown").replace(/^map_/, "");
                const existing = sets.get(key);
                if (existing) existing.maps.add(mapName);
                else sets.set(key, { key, faces, maps: new Set([mapName]) });
            }
        }
    }
    return { sets, descriptors };
}

function loadManifest(): Record<string, ManifestEntry> {
    try { return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")); } catch { return {}; }
}

async function downloadFace(desc: Descriptor, destFile: string): Promise<boolean> {
    const rel = ResourcePathUtils.getResourcePath({
        idLow: desc.idlow, idHigh: desc.idhigh ?? 0,
        versionLow: desc.versionlow, versionHigh: desc.versionhigh ?? 0,
    });
    const url = `${CDN_BASE}${rel}image.jpg`;
    const res = await axios.get(url, { responseType: "arraybuffer", validateStatus: () => true, proxy: false });
    if (res.status !== 200) {
        console.warn(`    HTTP ${res.status}: ${url}`);
        return false;
    }
    fs.writeFileSync(destFile, Buffer.from(res.data));
    return true;
}

async function main(): Promise<void> {
    const force = process.argv.includes("--force");
    console.log("Varrendo logs .ndjson por skyboxes...");
    const { sets, descriptors } = scanLogs();
    console.log(`Encontrados ${sets.size} set(s) único(s) de skybox; ${descriptors.size} descritores de recursos nos logs.\n`);

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const manifest = loadManifest();
    let downloaded = 0, skipped = 0, pending = 0;

    for (const set of sets.values()) {
        const maps = [...set.maps].sort();
        const known = manifest[set.key];
        if (known) {
            // Set já baixado — só agrega mapas recém-vistos ao registro.
            known.maps = [...new Set([...known.maps, ...maps])].sort();
            if (!force) {
                console.log(`= ${known.folder} (ids ${set.key}) já baixado — pulando. Mapas: ${known.maps.join(", ")}`);
                skipped++;
                continue;
            }
        }

        const missing = FACES.filter((f) => !descriptors.has(set.faces[f]));
        if (missing.length > 0) {
            console.warn(`! Set ${set.key} (mapas: ${maps.join(", ")}): sem descritor p/ face(s) ${missing.join(", ")} em nenhum log — capture um battle-load com cache limpo.`);
            pending++;
            continue;
        }

        const folder = known?.folder ?? `${maps[0]}_${set.faces.front}`;
        const destDir = path.join(OUT_DIR, folder, "v1");
        fs.mkdirSync(destDir, { recursive: true });
        console.log(`> Baixando ${folder} (ids ${set.key}) — mapas: ${maps.join(", ")}`);

        let ok = 0;
        for (const face of FACES) {
            const desc = descriptors.get(set.faces[face])!;
            if (await downloadFace(desc, path.join(destDir, `${face}.jpg`))) ok++;
        }
        console.log(`  ${ok}/${FACES.length} faces salvas em downloads/skyboxes/${folder}/v1/`);
        if (ok === FACES.length) {
            manifest[set.key] = { folder, faces: set.faces, maps, downloadedAt: new Date().toISOString() };
            downloaded++;
        }
    }

    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    console.log(`\nConcluído: ${downloaded} baixado(s), ${skipped} já existente(s), ${pending} pendente(s) de descritor.`);
    if (downloaded > 0) console.log("Para adotar um set: copie a pasta para resources/skybox/<nome>/ e rode 'npm run build:resources'.");
}

main().catch((err) => {
    console.error("Falha na extração:", err);
    process.exit(1);
});
