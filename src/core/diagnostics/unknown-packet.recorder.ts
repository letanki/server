import fs from "fs";
import path from "path";
import logger from "@/utils/logger";

interface IUnknownPacketStat {
    id: number;
    count: number;
    firstSeen: string;
    lastSeen: string;
    sizes: number[];
    samples: string[];
}

/**
 * Persists packets received from the client that the server has no class for
 * ("No packet class found for ID"). Two outputs are written under `logs/`:
 *
 *  - `unknown-packets.ndjson` — append-only, one line per occurrence
 *    (`{ ts, id, size, hex, client }`) for full history / reverse engineering.
 *  - `unknown-packets.summary.json` — aggregated per id (count, first/last seen,
 *    distinct sizes, a few sample payloads) for a quick overview of what is
 *    still missing and worth implementing.
 *
 * Unknown packets are rare by definition (every known packet is handled), so the
 * writes are synchronous for simplicity and capture reliability.
 */
export class UnknownPacketRecorder {
    private static readonly MAX_SAMPLES = 10;
    private static readonly MAX_SIZES = 20;

    private readonly ndjsonPath: string;
    private readonly summaryPath: string;
    private readonly stats = new Map<number, IUnknownPacketStat>();

    constructor(logsDir: string = path.join(__dirname, "../../../logs")) {
        this.ndjsonPath = path.join(logsDir, "unknown-packets.ndjson");
        this.summaryPath = path.join(logsDir, "unknown-packets.summary.json");

        try {
            fs.mkdirSync(logsDir, { recursive: true });
        } catch (error) {
            logger.error("Failed to create logs directory for unknown packets", { error });
        }

        this.loadExistingSummary();
    }

    public record(packetId: number, payload: Buffer, client: string): void {
        const hex = payload.toString("hex");
        const ts = new Date().toISOString();
        const size = payload.length;

        try {
            fs.appendFileSync(this.ndjsonPath, JSON.stringify({ ts, id: packetId, size, hex, client }) + "\n");
        } catch (error) {
            logger.error("Failed to append unknown packet to ndjson", { error, packetId });
        }

        let stat = this.stats.get(packetId);
        if (!stat) {
            stat = { id: packetId, count: 0, firstSeen: ts, lastSeen: ts, sizes: [], samples: [] };
            this.stats.set(packetId, stat);
        }

        stat.count++;
        stat.lastSeen = ts;
        if (!stat.sizes.includes(size) && stat.sizes.length < UnknownPacketRecorder.MAX_SIZES) {
            stat.sizes.push(size);
        }
        if (!stat.samples.includes(hex) && stat.samples.length < UnknownPacketRecorder.MAX_SAMPLES) {
            stat.samples.push(hex);
        }

        this.writeSummary();
    }

    private loadExistingSummary(): void {
        try {
            if (!fs.existsSync(this.summaryPath)) {
                return;
            }
            const parsed = JSON.parse(fs.readFileSync(this.summaryPath, "utf8")) as IUnknownPacketStat[];
            for (const stat of parsed) {
                this.stats.set(stat.id, stat);
            }
        } catch (error) {
            logger.error("Failed to load existing unknown-packets summary", { error });
        }
    }

    private writeSummary(): void {
        try {
            const summary = Array.from(this.stats.values()).sort((a, b) => b.count - a.count);
            fs.writeFileSync(this.summaryPath, JSON.stringify(summary, null, 2));
        } catch (error) {
            logger.error("Failed to write unknown-packets summary", { error });
        }
    }
}

/** Shared singleton, mirroring how the logger is used across the codebase. */
export const unknownPacketRecorder = new UnknownPacketRecorder();
