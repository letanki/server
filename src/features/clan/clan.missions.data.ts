/**
 * Clan mission (the "DAILY_QUEST_MISSIONS" tab) templates + scoring constants. Decoded from the official
 * capture (see the clan-missions notes): collective daily goals whose progress is summed across ALL clan
 * members. On completion the prize is auto-granted to every current member, and each member's CONTRIBUTION
 * becomes their clanScore/weeklyClanScore (which feeds the clan rating).
 */

import { ResourceId } from "@/generated/resourceTypes";

/** A prize line: `count` × the display `name`; `item` is what we actually grant ("crystals" or a supply id). */
export interface IClanMissionPrize {
    item: "crystals" | "n2o" | "armor" | "double_damage" | "health" | "mine";
    count: number;
    name: string; // shown in the client ("name × count")
}

export interface IClanMissionTemplate {
    /** Which battle metric advances this mission (matches the per-round contribution keys). */
    metricKey: "kills" | "battleScore" | "crystals" | "goldBox";
    description: string;
    /** Named icon resource; its idLow is sent as the mission icon. MUST be preloaded (LoadDependencies)
     *  before the missions packet, or the client throws "Resource <id> not found" while deserializing. */
    iconResource: ResourceId;
    criteria: number; // clan-wide target
    prizes: IClanMissionPrize[];
}

/** Each fully-completed mission is worth this many clan points, split among members by contribution share
 *  (a member contributing `d` of a mission's `criteria` earns round(d/criteria × MISSION_POINTS)). Normalising
 *  by criteria keeps the 40000-score goal from dwarfing the 3000-kill goal. */
export const MISSION_POINTS = 1000;

/** The daily clan mission set, replicated from the official capture (ids/targets/prizes). */
export const CLAN_MISSION_TEMPLATES: IClanMissionTemplate[] = [
    {
        metricKey: "kills",
        description: "Destrua os inimigos",
        iconResource: "ui/clan/missions/kill_enemies",
        criteria: 3000,
        prizes: [
            { item: "n2o", count: 16, name: "Aumento de Velocidade" },
            { item: "armor", count: 5, name: "Blindagem Dupla" },
            { item: "double_damage", count: 4, name: "Destruição Dupla" },
        ],
    },
    {
        metricKey: "battleScore",
        description: "Ganhe pontuação de batalha nas batalhas",
        iconResource: "ui/clan/missions/battle_score",
        criteria: 40000,
        prizes: [{ item: "health", count: 20, name: "Kit de Reparação" }],
    },
    {
        metricKey: "crystals",
        description: "Ganhe cristais em batalhas",
        iconResource: "ui/clan/missions/get_crystal",
        criteria: 20000,
        prizes: [{ item: "mine", count: 49, name: "Mina" }],
    },
    {
        metricKey: "goldBox",
        description: "Pegue uma Caixa de ouro",
        iconResource: "ui/clan/missions/gold_box",
        criteria: 20,
        prizes: [{ item: "crystals", count: 2653, name: "Cristais" }],
    },
];

/** Distinct icon resources the client must have loaded before receiving the missions packet (otherwise the
 *  Resource-typed icon field throws "Resource <id> not found" during deserialization). Preloaded on open. */
export const CLAN_MISSION_ICON_RESOURCES: ResourceId[] = [
    "ui/clan/missions/kill_enemies",
    "ui/clan/missions/battle_score",
    "ui/clan/missions/get_crystal",
    "ui/clan/missions/gold_box",
];

/** Per-round battle contribution a member brings to the clan missions (keys match template metricKey). */
export interface IClanMissionContribution {
    kills: number;
    battleScore: number;
    crystals: number;
    goldBox: number;
}
