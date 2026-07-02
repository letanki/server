import { ResourceId } from "@/generated/resourceTypes";

/**
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────────
 * FUTURE WORK (documented, NOT implemented — see the "Missions" wiki + [[user-missions]]):
 *
 * 1. SUPER MISSIONS (XT skins): a special 4th-kind objective with a huge criteria (capture showed a "score"
 *    super mission at criteria 99999, prize e.g. "Casco Zangão XT M0", icon idLow 6256). These award an XT
 *    turret/hull SKIN instead of crystals/supplies. Needs: a super-mission objective type, the XT-skin item
 *    grants, their icons, and the (rarer) roll conditions. Not part of the daily 3 in the normal pool.
 *
 * 2. PREMIUM-ACCOUNT PRIZES: the wiki reward table has a "Premium" column (hours, e.g. 1-19 by rank). A prize
 *    can be a few hours of premium instead of crystals/supplies. Needs: add "Premium" as a possible rollPrize
 *    branch (using a PREMIUM-hours-by-rank table), a display name, and granting via premiumExpiresAt. Skipped
 *    for now (rare; premium plumbing exists on the user model).
 *
 * 3. WEEKLY MISSION CHAIN / streak bonus: completing ≥1 mission every day for a week grants a rank-scaled
 *    Crystals+Supplies bonus, increasing for up to 4 consecutive weeks (questLevel 1-4). We already TRACK the
 *    streak (questStreak / lastQuestCompletedDate / questLevel + the week1-4 chain/reward icons), but the
 *    weekly PAYOUT is not granted yet. Needs: a weekly-bonus table + payout on the 7-day boundary + the
 *    end-of-week claim UI packet.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────────
 */

export type QuestType = "KILLS" | "SCORE" | "CRYSTALS" | "GOLDBOX";
export type QuestDifficulty = "easy" | "medium" | "hard";

export interface IQuestDefinition {
    type: QuestType;
    description: string; // %n = the criteria
    imageResource: ResourceId;
    /** finishCriteria per slot (0=easy, 1=medium, 2=hard). GOLDBOX is always 1 (catch one box). */
    criteria: [number, number, number];
}

// finishCriteria per difficulty [easy, medium, hard], decoded from the official capture (rank 27; the objective
// target depends only on difficulty, NOT rank — only the REWARD scales with rank). Medium kills / easy score
// weren't captured directly, so they're interpolated (marked); refine if more ranks/slots are captured.
export const QuestDefinitions: IQuestDefinition[] = [
    { type: "KILLS", description: "Destrua %n inimigos", imageResource: "ui/quests/icons/kill_enemies", criteria: [30, 50, 75] }, // medium=50 interpolated
    { type: "SCORE", description: "Ganhe %n de pontuação nas batalhas", imageResource: "ui/quests/icons/battle_score", criteria: [450, 700, 1000] }, // easy=450 interpolated
    { type: "CRYSTALS", description: "Colete %n cristais em batalhas", imageResource: "ui/quests/icons/get_crystal", criteria: [250, 350, 500] },
];

/** Gold-box objective — can roll into any slot. Uses its own icon + the "gold" prize tier. */
export const GOLDBOX_DEFINITION: IQuestDefinition = {
    type: "GOLDBOX",
    description: "Pegue uma Caixa de ouro",
    imageResource: "ui/quests/icons/gold_box",
    criteria: [1, 1, 1],
};

/** Chance a (re)roll of ANY slot produces a gold-box objective instead of a normal one. */
export const GOLDBOX_REROLL_CHANCE = 0.25;

// NOTE: quest ids are UNIQUE PER INSTANCE (assigned in QuestService.freshQuestId), NOT a hash of the objective.
// Two quests with the same type+criteria must still have different ids, or changing one changes the identical
// one (the client keys quests by id). The official appears to reuse ids per objective, but it never shows two
// identical objectives at once; unique ids are strictly safer here.
/** Probability a reward is crystals rather than supplies (the wiki's stated 50%). */
export const CRYSTAL_PRIZE_CHANCE = 0.5;

// Supply reward "prices" — the crystal-equivalent used to convert a slot's supply value into item counts
// (derived from the official capture: a repair kit is 150, the rest 50; matches the wiki's worked example).
const REPAIR_KIT_PRICE = 150;
const CHEAP_SUPPLY_PRICE = 50;
const CHEAP_SUPPLIES: { item: string; name: string }[] = [
    { item: "armor", name: "Blindagem Dupla" },
    { item: "n2o", name: "Aumento de Velocidade" },
    { item: "double_damage", name: "Destruição Dupla" },
    { item: "mine", name: "Mina" },
];
const REPAIR_KIT_NAME = "Kit de Reparação";

/** Maps a prize display name back to the grantable item ("crystals" or a supply id) for completion payout. */
export const PRIZE_ITEM_BY_NAME: Record<string, string> = {
    Cristais: "crystals",
    [REPAIR_KIT_NAME]: "health",
    "Blindagem Dupla": "armor",
    "Aumento de Velocidade": "n2o",
    "Destruição Dupla": "double_damage",
    Mina: "mine",
};

// Supply crystal-equivalent VALUE and the max repair-kit count, per rank (rows 1-27) × slot
// (0=slot1/easy, 1=slot2/medium, 2=slot3/hard, 3=gold box). From the Missions wiki table.
const SLOT_SUPPLY_VALUE: number[][] = [
    [100, 150, 200, 450], [150, 200, 300, 650], [200, 250, 400, 850], [250, 350, 500, 1050],
    [300, 450, 600, 1250], [350, 500, 700, 1450], [450, 550, 800, 1650], [450, 600, 900, 1850],
    [500, 700, 1000, 2050], [550, 750, 1100, 2250], [600, 850, 1200, 2450], [650, 900, 1300, 2650],
    [700, 950, 1400, 2850], [750, 1050, 1500, 3050], [800, 1100, 1600, 3250], [850, 1200, 1700, 3450],
    [900, 1250, 1800, 3650], [950, 1300, 1900, 3850], [1000, 1400, 2000, 4050], [1050, 1450, 2100, 4250],
    [1100, 1550, 2200, 4450], [1150, 1600, 2300, 4650], [1200, 1650, 2400, 4850], [1250, 1750, 2500, 5050],
    [1300, 1800, 2600, 5250], [1350, 1900, 2700, 5450], [1400, 1950, 2800, 5650],
];
const SLOT_SUPPLY_KITS: number[][] = [
    [0, 1, 1, 2], [1, 1, 1, 2], [1, 1, 1, 3], [1, 1, 2, 4], [1, 1, 2, 4], [1, 2, 2, 5], [1, 2, 3, 6],
    [2, 2, 3, 6], [2, 2, 3, 7], [2, 3, 4, 8], [2, 3, 4, 8], [2, 3, 4, 9], [2, 3, 5, 10], [3, 4, 5, 10],
    [3, 4, 5, 11], [3, 4, 6, 12], [3, 4, 6, 12], [3, 4, 6, 13], [3, 5, 7, 14], [4, 5, 7, 14], [4, 5, 7, 15],
    [4, 5, 8, 16], [4, 6, 8, 16], [4, 6, 8, 17], [4, 6, 9, 18], [5, 6, 9, 18], [5, 7, 9, 19],
];

/** Crystals reward for a slot (linear per slot; verified against the capture). slot 3 = gold box. */
const CRYSTAL_BASE = [112, 157, 225, 450];
const CRYSTAL_PER_RANK = [50, 70, 100, 200];

const clampRankRow = (table: number[][], rank: number): number[] => table[Math.min(Math.max(1, rank), table.length) - 1];

/** Crystals per rank for a slot (0..3). */
export function slotCrystals(rank: number, slot: number): number {
    return CRYSTAL_BASE[slot] + (Math.max(1, rank) - 1) * CRYSTAL_PER_RANK[slot];
}

/** Cost (crystals) of the 2nd and later mission changes in a day. 112 at rank 1, +28 per rank. */
export function changeCost(rank: number): number {
    return 112 + (Math.max(1, rank) - 1) * 28;
}

export interface IQuestPrize {
    itemName: string;
    itemCount: number;
}

/**
 * Rolls a reward for a quest in `slot` (0=easy .. 3=gold box) at `rank`. 50% crystals, else supplies:
 * a "kit branch" (max repair kits + one cheap supply for the remainder) or a "two cheap supplies" split —
 * both derived from the official capture so amounts match the wiki table.
 */
export function rollPrize(rank: number, slot: number): IQuestPrize[] {
    if (Math.random() < CRYSTAL_PRIZE_CHANCE) {
        return [{ itemName: "Cristais", itemCount: slotCrystals(rank, slot) }];
    }
    const value = clampRankRow(SLOT_SUPPLY_VALUE, rank)[slot];
    const maxKits = clampRankRow(SLOT_SUPPLY_KITS, rank)[slot];
    const pickCheap = (): { item: string; name: string } => CHEAP_SUPPLIES[Math.floor(Math.random() * CHEAP_SUPPLIES.length)];

    if (maxKits > 0 && Math.random() < 0.5) {
        // Kit branch: use the max kits, spend the rest on one cheap supply.
        const rest = Math.max(0, value - maxKits * REPAIR_KIT_PRICE);
        const prizes: IQuestPrize[] = [{ itemName: REPAIR_KIT_NAME, itemCount: maxKits }];
        const cnt = Math.floor(rest / CHEAP_SUPPLY_PRICE);
        if (cnt > 0) prizes.push({ itemName: pickCheap().name, itemCount: cnt });
        return prizes;
    }
    // Two distinct cheap supplies, splitting the value evenly.
    const first = pickCheap();
    let second = pickCheap();
    while (second.item === first.item) second = pickCheap();
    const each = Math.floor(value / 2 / CHEAP_SUPPLY_PRICE);
    return [
        { itemName: first.name, itemCount: each },
        { itemName: second.name, itemCount: each },
    ];
}
