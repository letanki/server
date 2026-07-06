/**
 * Analyzes powerup/bonus drop behavior from packet-capture ndjson logs, to reverse-engineer the
 * official spawn rules (tick cadence, per-point types, lifetime, taken-vs-expired).
 *
 * For each capture it pairs SpawnBonusPacket <-> RemoveBonusPacket by bonus id and classifies every
 * removal as EXPIRED (age ~= lifeTimeMs, nobody grabbed it) or TAKEN (age < lifeTime, a tank picked
 * it up). It then aggregates: the global spawn tick, spawns-per-tick distribution, fixed spawn points
 * (clustered from jittered positions), the fixed type per point, and per-type counts.
 *
 * Bonus lifetimes come from the InitBonusesDataPacket JSON when present, else a sane default table.
 *
 * Usage:
 *   ts-node scripts/analyzeDrops.ts <capture.ndjson>     # one file, detailed
 *   ts-node scripts/analyzeDrops.ts                      # every *.ndjson in cwd, summarized + combined
 */
import fs from "fs";
import path from "path";

const DEFAULT_LIFE_MS: Record<string, number> = {
    medkit: 30000, nitro: 30000, damageup: 30000, armorup: 30000,
    crystal: 900000, crystal_100: 30000000, special: 30000000, moon: 30000000, pumpkin: 30000000,
};

/** Tolerance (ms) below lifeTime that still counts as "expired" (network/scheduler slack). */
const EXPIRE_SLACK_MS = 2000;
/** Two spawn positions within this distance (game units) are treated as the same fixed point. */
const CLUSTER_RADIUS = 1200;
/** The granularity we test the spawn cadence against. */
const TICK_MS = 3000;

interface Packet { type: string; ts: string; name?: string; hex?: string; fields?: any; }
interface Spawn { t: number; id: string; kind: string; pos: { x: number; y: number; z: number }; }
interface Removal { t: number; id: string; }

interface FileResult {
    file: string;
    durationS: number;
    life: Record<string, number>;
    spawns: Spawn[];
    removals: Removal[];
    taken: Array<{ kind: string; ageS: number; id: string }>;
    expired: Array<{ kind: string; ageS: number; id: string }>;
    orphanRemovals: number; // remove without a matching spawn in this file
}

function readPackets(file: string): Packet[] {
    return fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean)
        .map((l) => { try { return JSON.parse(l) as Packet; } catch { return null; } })
        .filter((p): p is Packet => !!p);
}

/** Extracts the {bonuses:[...]} JSON embedded in an InitBonusesDataPacket hex body. */
function parseLifetimes(pk: Packet[]): Record<string, number> {
    const def = pk.find((p) => p.name === "InitBonusesDataPacket" && p.hex);
    if (!def?.hex) return { ...DEFAULT_LIFE_MS };
    try {
        const b = Buffer.from(def.hex, "hex");
        const start = b.indexOf(0x7b); // first '{'
        const data = JSON.parse(b.slice(start).toString("utf8"));
        const life: Record<string, number> = { ...DEFAULT_LIFE_MS };
        for (const x of data.bonuses ?? []) if (x.id) life[x.id] = x.lifeTimeMs;
        return life;
    } catch {
        return { ...DEFAULT_LIFE_MS };
    }
}

function analyzeFile(file: string): FileResult | null {
    const pk = readPackets(file);
    const spawnPkts = pk.filter((p) => p.name === "SpawnBonusPacket" && p.fields?.id);
    if (spawnPkts.length === 0) return null; // not a battle-with-bonuses capture

    const life = parseLifetimes(pk);
    const spawns: Spawn[] = spawnPkts.map((p) => ({
        t: new Date(p.ts).getTime(),
        id: p.fields.id,
        kind: String(p.fields.id).split("#")[0],
        pos: p.fields.position,
    }));
    const spawnById = new Map(spawns.map((s) => [s.id, s]));

    const removals: Removal[] = pk
        .filter((p) => p.name === "RemoveBonusPacket" && p.fields?.bonusId)
        .map((p) => ({ t: new Date(p.ts).getTime(), id: p.fields.bonusId }));

    const taken: FileResult["taken"] = [];
    const expired: FileResult["expired"] = [];
    let orphanRemovals = 0;
    for (const r of removals) {
        const s = spawnById.get(r.id);
        if (!s) { orphanRemovals++; continue; }
        const ageS = (r.t - s.t) / 1000;
        const lifeS = (life[s.kind] ?? 30000) / 1000;
        if (ageS >= lifeS - EXPIRE_SLACK_MS / 1000) expired.push({ kind: s.kind, ageS, id: r.id });
        else taken.push({ kind: s.kind, ageS, id: r.id });
    }

    const t0 = spawns[0].t;
    const tEnd = Math.max(spawns[spawns.length - 1].t, ...removals.map((r) => r.t), t0);
    return { file: path.basename(file), durationS: (tEnd - t0) / 1000, life, spawns, removals, taken, expired, orphanRemovals };
}

/** Greedy 2D clustering of jittered spawn positions into fixed spawn points. */
function clusterPoints(spawns: Spawn[]) {
    const clusters: Array<{ cx: number; cy: number; n: number; kinds: Record<string, number> }> = [];
    for (const s of spawns) {
        let c = clusters.find((k) => Math.hypot(k.cx - s.pos.x, k.cy - s.pos.y) < CLUSTER_RADIUS);
        if (!c) { c = { cx: s.pos.x, cy: s.pos.y, n: 0, kinds: {} }; clusters.push(c); }
        c.n++;
        c.kinds[s.kind] = (c.kinds[s.kind] || 0) + 1;
        c.cx = (c.cx * (c.n - 1) + s.pos.x) / c.n;
        c.cy = (c.cy * (c.n - 1) + s.pos.y) / c.n;
    }
    return clusters.sort((a, b) => b.n - a.n);
}

/** How well do spawn timestamps fit a fixed TICK_MS grid, and how many spawns per firing tick. */
function tickStats(spawns: Spawn[]) {
    const t0 = spawns[0].t;
    let maxDev = 0;
    const perTick = new Map<number, number>();
    for (const s of spawns) {
        const rel = s.t - t0;
        maxDev = Math.max(maxDev, Math.abs(rel - Math.round(rel / TICK_MS) * TICK_MS));
        const tick = Math.round(rel / TICK_MS);
        perTick.set(tick, (perTick.get(tick) || 0) + 1);
    }
    const lastTick = Math.round((spawns[spawns.length - 1].t - t0) / TICK_MS);
    const dist: Record<number, number> = {};
    for (const n of perTick.values()) dist[n] = (dist[n] || 0) + 1;
    return { maxDevMs: maxDev, firingTicks: perTick.size, possibleTicks: lastTick + 1, perTickDist: dist };
}

function typeCounts(spawns: Spawn[]) {
    const c: Record<string, number> = {};
    for (const s of spawns) c[s.kind] = (c[s.kind] || 0) + 1;
    return c;
}

function printFileDetail(r: FileResult) {
    console.log(`\n============================================================`);
    console.log(`FILE: ${r.file}   (${r.durationS.toFixed(0)}s, ${r.spawns.length} spawns, ${r.removals.length} removes)`);
    console.log(`  classification: EXPIRED=${r.expired.length}  TAKEN=${r.taken.length}  orphanRemoves=${r.orphanRemovals}`);
    const ts = tickStats(r.spawns);
    console.log(`  tick fit: maxDev=${ts.maxDevMs}ms on ${TICK_MS}ms grid | firing ${ts.firingTicks}/${ts.possibleTicks} ticks | spawns-per-tick ${JSON.stringify(ts.perTickDist)}`);
    console.log(`  type counts: ${JSON.stringify(typeCounts(r.spawns))}`);
    if (r.taken.length) {
        console.log(`  --- TAKEN pickups (age < lifetime) ---`);
        const byKind: Record<string, number[]> = {};
        for (const t of r.taken) (byKind[t.kind] ||= []).push(t.ageS);
        for (const [k, ages] of Object.entries(byKind)) {
            const avg = ages.reduce((a, b) => a + b, 0) / ages.length;
            console.log(`    ${k.padEnd(10)} n=${String(ages.length).padStart(2)}  ageS: min=${Math.min(...ages).toFixed(1)} avg=${avg.toFixed(1)} max=${Math.max(...ages).toFixed(1)}`);
        }
    }
    const clusters = clusterPoints(r.spawns);
    console.log(`  --- ${clusters.length} fixed spawn points ---`);
    for (const c of clusters) {
        const kinds = Object.entries(c.kinds).map(([k, v]) => `${k}:${v}`).join(" ");
        console.log(`    (${c.cx.toFixed(0).padStart(6)},${c.cy.toFixed(0).padStart(7)})  n=${String(c.n).padStart(2)}  ${kinds}`);
    }
}

function main() {
    const arg = process.argv[2];
    const files = arg ? [arg] : fs.readdirSync(process.cwd()).filter((f) => f.endsWith(".ndjson")).sort();
    if (files.length === 0) { console.error("No .ndjson files found."); process.exit(1); }

    const results: FileResult[] = [];
    for (const f of files) {
        const r = analyzeFile(f);
        if (r) results.push(r);
    }
    if (results.length === 0) { console.error("No captures contained SpawnBonusPacket."); process.exit(1); }

    // Detailed per-file only when a single file was requested; otherwise a compact one-liner each.
    if (arg) {
        printFileDetail(results[0]);
    } else {
        console.log(`file`.padEnd(40), `dur  spawn  rem  EXP  TAKE  orphan  types`);
        for (const r of results) {
            console.log(
                r.file.padEnd(40),
                String(r.durationS.toFixed(0)).padStart(4),
                String(r.spawns.length).padStart(5),
                String(r.removals.length).padStart(4),
                String(r.expired.length).padStart(4),
                String(r.taken.length).padStart(5),
                String(r.orphanRemovals).padStart(6),
                "  " + JSON.stringify(typeCounts(r.spawns)),
            );
        }
    }

    // Combined findings across all analyzed captures.
    const allSpawns = results.flatMap((r) => r.spawns);
    const allTaken = results.flatMap((r) => r.taken);
    const allExpired = results.flatMap((r) => r.expired);
    console.log(`\n============================================================`);
    console.log(`COMBINED across ${results.length} capture(s):`);
    console.log(`  total spawns=${allSpawns.length}  EXPIRED=${allExpired.length}  TAKEN=${allTaken.length}`);
    console.log(`  overall type counts: ${JSON.stringify(typeCounts(allSpawns))}`);

    if (allTaken.length) {
        const byKind: Record<string, number[]> = {};
        for (const t of allTaken) (byKind[t.kind] ||= []).push(t.ageS);
        console.log(`  --- pickup age (seconds bonus stayed on field before TAKEN) ---`);
        for (const [k, ages] of Object.entries(byKind)) {
            const avg = ages.reduce((a, b) => a + b, 0) / ages.length;
            console.log(`    ${k.padEnd(10)} n=${String(ages.length).padStart(3)}  min=${Math.min(...ages).toFixed(1)} avg=${avg.toFixed(1)} max=${Math.max(...ages).toFixed(1)}`);
        }
    } else {
        console.log(`  (no TAKEN pickups in any capture — all removals were lifetime expirations)`);
    }

    // Expiration age sanity: should cluster tightly at each type's lifetime.
    if (allExpired.length) {
        const byKind: Record<string, number[]> = {};
        for (const e of allExpired) (byKind[e.kind] ||= []).push(e.ageS);
        console.log(`  --- expiration age (should equal lifeTime) ---`);
        for (const [k, ages] of Object.entries(byKind)) {
            const avg = ages.reduce((a, b) => a + b, 0) / ages.length;
            console.log(`    ${k.padEnd(10)} n=${String(ages.length).padStart(3)}  min=${Math.min(...ages).toFixed(1)} avg=${avg.toFixed(1)} max=${Math.max(...ages).toFixed(1)}`);
        }
    }
}

main();
