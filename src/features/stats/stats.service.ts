import type { Battle } from "@/features/battle/battle.model";
import type { GameClient } from "@/server/game.client";
import User from "@/shared/models/user.model";
import logger from "@/utils/logger";

/** Game-mode names indexed by BattleMode (DM, TDM, CTF, CP, AS). */
const MODE_NAMES = ["dm", "tdm", "ctf", "cp", "as"] as const;

export type BattleOutcome = "win" | "loss" | "none";

/**
 * Per-round in-memory tally carried on a GameClient. Accumulated cheaply during play (plain number
 * increments, no DB writes), then flushed ONCE to the user's persistent stats at round end / on leave.
 * kills/deaths come from the client scoreboard fields (client.kills / client.deaths); everything else
 * lives here.
 */
export interface RoundStatAccumulator {
    xpEarned: number;
    crystalsEarned: number;
    suppliesUsed: number;
    minesUsed: number;
    suppliesPicked: number;
    damageDealt: number;
    damageTaken: number;
    suicides: number;
    suppliesUsedByItem: Record<string, number>;
    suppliesPickedByType: Record<string, number>;
}

export function createRoundStats(): RoundStatAccumulator {
    return {
        xpEarned: 0,
        crystalsEarned: 0,
        suppliesUsed: 0,
        minesUsed: 0,
        suppliesPicked: 0,
        damageDealt: 0,
        damageTaken: 0,
        suicides: 0,
        suppliesUsedByItem: {},
        suppliesPickedByType: {},
    };
}

/**
 * Long-term competitive metrics. Everything is accumulated in-memory during a round and persisted in a
 * single atomic update per player at round finish / on leave — no DB writes on the combat/supply hot
 * paths. The in-memory user document is mirrored so a later user.save() (e.g. the kill-XP path) can't
 * clobber the freshly-flushed stats.
 */
export class StatsService {
    /** The mode ("tdm") and type ("normal"/"xpbp"/"parkour") tags used to granulate every metric. */
    public static context(battle: Battle): { mode: string; type: string } {
        const mode = MODE_NAMES[battle.settings.battleMode] ?? "dm";
        const type = battle.settings.parkourMode
            ? "parkour"
            : battle.settings.equipmentConstraintsMode !== 0
              ? "xpbp"
              : "normal";
        return { mode, type };
    }

    /** Whether this battle contributes to win/loss + streaks (everything but parkour). */
    public static countsWinLoss(battle: Battle): boolean {
        return !battle.settings.parkourMode;
    }

    /**
     * Flushes a player's accumulated round stats into their profile: per-mode×type totals, per-match
     * records ($max) and win/loss streaks. `outcome` "none" leaves streaks untouched (e.g. parkour, a
     * tie, or a match with a single player). Safe to call once per round per player.
     */
    public static async flushRound(client: GameClient, battle: Battle, outcome: BattleOutcome): Promise<void> {
        const user = client.user;
        if (!user || client.isSpectator) return;
        // Legacy accounts created before this field: materialise the sub-doc (with defaults) so the
        // in-memory mirror below is consistent with what we persist.
        if (!user.stats) user.set("stats", {});

        const rs = client.roundStats;
        const kills = client.kills;
        const deaths = client.deaths;
        const { mode, type } = this.context(battle);

        const inc: Record<string, number> = {};
        // Each metric is recorded at three granularities: global, per game-mode, and per mode×type.
        const bump = (metric: string, amount: number): void => {
            if (!amount) return;
            for (const k of [metric, `${metric}:${mode}`, `${metric}:${mode}:${type}`]) {
                inc[`stats.counters.${k}`] = (inc[`stats.counters.${k}`] ?? 0) + amount;
            }
        };
        // A single flat counter (no mode expansion) — used for per-item / per-bonus-type breakdowns.
        const flat = (key: string, amount: number): void => {
            if (!amount) return;
            inc[`stats.counters.${key}`] = (inc[`stats.counters.${key}`] ?? 0) + amount;
        };

        bump("battles_played", 1);
        bump("kills", kills);
        bump("deaths", deaths);
        bump("suicides", rs.suicides);
        bump("xp_earned", rs.xpEarned);
        bump("crystals_earned", rs.crystalsEarned);
        bump("supplies_used", rs.suppliesUsed);
        bump("mines_used", rs.minesUsed);
        bump("supplies_picked", rs.suppliesPicked);
        bump("damage_dealt", Math.round(rs.damageDealt));
        bump("damage_taken", Math.round(rs.damageTaken));
        if (outcome === "win") bump("wins", 1);
        else if (outcome === "loss") bump("losses", 1);
        for (const [id, n] of Object.entries(rs.suppliesUsedByItem)) flat(`item_used:${id}`, n);
        for (const [t, n] of Object.entries(rs.suppliesPickedByType)) flat(`bonus_taken:${t}`, n);

        // Per-match records: keep the best single round ever.
        const max: Record<string, number> = {
            "stats.maxKillsInBattle": kills,
            "stats.maxDeathsInBattle": deaths,
            "stats.maxCrystalsInBattle": rs.crystalsEarned,
            "stats.maxXpInBattle": rs.xpEarned,
            "stats.maxDamageInBattle": Math.round(rs.damageDealt),
        };

        // Streaks: current run + best run. Leaving mid-match arrives here as a "loss" (see caller).
        const set: Record<string, number> = {};
        const st = user.stats;
        if (outcome === "win") {
            const cur = (st.currentWinStreak ?? 0) + 1;
            set["stats.currentWinStreak"] = cur;
            set["stats.currentLossStreak"] = 0;
            if (cur > (st.maxWinStreak ?? 0)) set["stats.maxWinStreak"] = cur;
        } else if (outcome === "loss") {
            const cur = (st.currentLossStreak ?? 0) + 1;
            set["stats.currentLossStreak"] = cur;
            set["stats.currentWinStreak"] = 0;
            if (cur > (st.maxLossStreak ?? 0)) set["stats.maxLossStreak"] = cur;
        }

        this._mirror(user, inc, max, set);

        const update: Record<string, unknown> = {};
        if (Object.keys(inc).length) update.$inc = inc;
        if (Object.keys(max).length) update.$max = max;
        if (Object.keys(set).length) update.$set = set;
        try {
            await User.updateOne({ _id: user._id }, update);
        } catch (error: any) {
            logger.error(`Failed to flush stats for ${user.username}`, { error: error.message });
        }
    }

    /** Applies the same deltas to the in-memory user doc so a later save() writes consistent values. */
    private static _mirror(user: any, inc: Record<string, number>, max: Record<string, number>, set: Record<string, number>): void {
        const st = user.stats;
        if (!st) return;
        const CTR = "stats.counters.";
        const STAT = "stats.";
        for (const [path, amount] of Object.entries(inc)) {
            const key = path.slice(CTR.length);
            st.counters.set(key, (st.counters.get(key) ?? 0) + amount);
        }
        for (const [path, val] of Object.entries(max)) {
            const key = path.slice(STAT.length);
            if (val > (st[key] ?? 0)) st[key] = val;
        }
        for (const [path, val] of Object.entries(set)) {
            st[path.slice(STAT.length)] = val;
        }
        user.markModified("stats");
    }
}
