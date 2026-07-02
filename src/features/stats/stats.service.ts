import type { Battle } from "@/features/battle/battle.model";
import type { GameClient } from "@/server/game.client";
import type { GameServer } from "@/server/game.server";
import User from "@/shared/models/user.model";
import logger from "@/utils/logger";

/** Game-mode names indexed by BattleMode (DM, TDM, CTF, CP, AS). */
const MODE_NAMES = ["dm", "tdm", "ctf", "cp", "as"] as const;

export type BattleOutcome = "win" | "loss" | "none";

/**
 * Per-round in-memory tally carried on a GameClient. Accumulated cheaply during play (plain number
 * increments, no DB writes). The RUNNING TOTAL for the whole round lives here; it is persisted to the
 * user's stats in DELTAS at each flush trigger — death, disconnect, leave/kick and round-finish (see
 * StatsService.flushDelta) — so a player who never leaves still has their progress saved every time they
 * die. kills/deaths come from the client scoreboard fields (client.kills / client.deaths); everything
 * else lives here. Reset (together with the flush snapshot) only at round-restart / battle entry.
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
 * A snapshot of what has already been persisted this round, carried on the GameClient alongside the
 * accumulator. Each flush computes `current counters − snapshot` (the delta), writes only that, then
 * updates the snapshot. This lets us flush on every death / disconnect / leave without ever double-
 * counting when a later trigger fires. `battleScore` is tracked separately (clan-mission contribution
 * only — it is not a persisted stat counter). Reset with the accumulator at round-restart / entry.
 */
export interface StatsFlushSnapshot {
    counters: Record<string, number>;
    battleScore: number;
}

export function createStatsSnapshot(): StatsFlushSnapshot {
    return { counters: {}, battleScore: 0 };
}

/**
 * Long-term competitive metrics. Accumulated in-memory during a round (no DB writes on the combat/supply
 * hot paths) and persisted in DELTAS at each flush trigger — death, disconnect, leave/kick, round-finish
 * — so progress is saved every life, not just when the player leaves. Each write is a single atomic $inc
 * (order-independent, race-safe) and the in-memory user document is mirrored so a later user.save() (e.g.
 * the kill-XP path) can't clobber the freshly-flushed stats. The round-finish/leave flush additionally
 * settles the per-match records ($max) and win/loss streaks.
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
     * The round's running counter totals for this client, as a flat map (the values the flush snapshot is
     * diffed against). Base metrics (kills/deaths/xp/…) are expanded to their three granularities by the
     * flush; the per-item breakdowns (item_used:<id>, bonus_taken:<type>) are already-namespaced keys and
     * stay flat. `battleScore` is NOT here — it's clan-only and tracked separately on the snapshot.
     */
    private static _currentCounters(client: GameClient): Record<string, number> {
        const rs = client.roundStats;
        const c: Record<string, number> = {
            kills: client.kills,
            deaths: client.deaths,
            suicides: rs.suicides,
            xp_earned: rs.xpEarned,
            crystals_earned: rs.crystalsEarned,
            supplies_used: rs.suppliesUsed,
            mines_used: rs.minesUsed,
            supplies_picked: rs.suppliesPicked,
            damage_dealt: Math.round(rs.damageDealt),
            damage_taken: Math.round(rs.damageTaken),
        };
        for (const [id, n] of Object.entries(rs.suppliesUsedByItem)) c[`item_used:${id}`] = n;
        for (const [t, n] of Object.entries(rs.suppliesPickedByType)) c[`bonus_taken:${t}`] = n;
        return c;
    }

    /**
     * Persists everything accumulated SINCE THE LAST FLUSH — the delta between the round's running totals
     * and the client's snapshot — then advances the snapshot. Called on every flush trigger (death,
     * disconnect, leave/kick, round-finish), so it is safe to call many times per round without double-
     * counting. Writes the stat counters (global + per-mode + per-mode×type) with one atomic $inc and, for
     * clan members, feeds the same delta (kills / battle-score / crystals / gold boxes) into the clan's
     * daily missions. Fire-and-forget — never blocks the caller.
     */
    public static flushDelta(client: GameClient, battle: Battle, server: GameServer): void {
        const user = client.user;
        if (!user || client.isSpectator) return;
        if (!user.stats) user.set("stats", {}); // materialise on legacy accounts so the mirror stays consistent

        const cur = this._currentCounters(client);
        const snap = client.statsSnapshot;
        const { mode, type } = this.context(battle);

        const inc: Record<string, number> = {};
        for (const [metric, total] of Object.entries(cur)) {
            const delta = total - (snap.counters[metric] ?? 0);
            if (delta <= 0) continue;
            if (metric.includes(":")) {
                // Already-namespaced per-item breakdown (item_used:<id>, bonus_taken:<type>) — flat, no expansion.
                inc[`stats.counters.${metric}`] = (inc[`stats.counters.${metric}`] ?? 0) + delta;
            } else {
                for (const k of [metric, `${metric}:${mode}`, `${metric}:${mode}:${type}`]) {
                    inc[`stats.counters.${k}`] = (inc[`stats.counters.${k}`] ?? 0) + delta;
                }
            }
        }

        // Clan daily missions get the same delta (kills, battle score, crystals, gold boxes caught).
        const clanDelta = {
            kills: Math.max(0, (cur.kills ?? 0) - (snap.counters.kills ?? 0)),
            battleScore: Math.max(0, client.battleScore - snap.battleScore),
            crystals: Math.max(0, (cur.crystals_earned ?? 0) - (snap.counters.crystals_earned ?? 0)),
            goldBox: Math.max(0, (cur["bonus_taken:gold"] ?? 0) - (snap.counters["bonus_taken:gold"] ?? 0)),
        };
        if (user.clanId && (clanDelta.kills || clanDelta.battleScore || clanDelta.crystals || clanDelta.goldBox)) {
            void server.clanService.applyRoundContribution(user, clanDelta, server);
        }

        // Advance the snapshot to the current totals (do this even if nothing changed — cheap and keeps it fresh).
        client.statsSnapshot = { counters: cur, battleScore: client.battleScore };

        if (!Object.keys(inc).length) return;
        this._mirror(user, inc, {}, {});
        void User.updateOne({ _id: user._id }, { $inc: inc }).catch((error: any) => {
            logger.error(`Failed to flush stat delta for ${user.username}`, { error: error?.message });
        });
    }

    /**
     * Round-finish / leave flush: settles the final counter delta (via flushDelta) AND the per-round
     * aggregates that only make sense once the round is over — battles_played, win/loss, the per-match
     * records ($max) and win/loss streaks. `outcome` "none" leaves streaks untouched (e.g. parkour, a tie,
     * or a match with a single player). Guarded by the caller's `statsFlushedForRound` so it runs once.
     */
    public static flushRound(client: GameClient, battle: Battle, outcome: BattleOutcome, server: GameServer): void {
        const user = client.user;
        if (!user || client.isSpectator) return;

        // Final counter + clan-mission delta for the round.
        this.flushDelta(client, battle, server);

        const rs = client.roundStats;
        const kills = client.kills;
        const deaths = client.deaths;
        const { mode, type } = this.context(battle);

        const inc: Record<string, number> = {};
        const bump = (metric: string, amount: number): void => {
            if (!amount) return;
            for (const k of [metric, `${metric}:${mode}`, `${metric}:${mode}:${type}`]) {
                inc[`stats.counters.${k}`] = (inc[`stats.counters.${k}`] ?? 0) + amount;
            }
        };
        bump("battles_played", 1);
        if (outcome === "win") bump("wins", 1);
        else if (outcome === "loss") bump("losses", 1);

        // Per-match records: keep the best single round ever (round totals, not the per-flush deltas).
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
        void User.updateOne({ _id: user._id }, update).catch((error: any) => {
            logger.error(`Failed to flush round stats for ${user.username}`, { error: error?.message });
        });
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
