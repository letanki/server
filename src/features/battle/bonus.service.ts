import { getBonusData } from "@/config/bonus.data";
import { UpdateCrystals } from "@/features/profile/profile.packets";
import * as QuestPackets from "@/features/quests/quests.packets";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IVector3 } from "@/shared/types/geom/ivector3";
import { getMapBonusRegions, IBonusRegion } from "@/maps/mapData";
import { ResourceId } from "@/generated/resourceTypes";
import { ResourceManager } from "@/utils/resource.manager";
import logger from "@/utils/logger";
import { Battle, BattleMode } from "./battle.model";
import { HEAL_DROP_EFFECT_MS, HEAL_MAX_GIVEN, SupplyService } from "./supply.service";
import { GoldBoxComingNotificationPacket, GoldBoxTakenNotificationPacket, RemoveBonusPacket, SpawnBonusPacket, TakeBonusPacket } from "./battle.packets";

const BONUS_FALLBACK_LIFETIME_MS = 30000; // used if a type has no lifeTimeMs in getBonusData
// Extra time the server keeps the box AFTER its disappear time, so the client's final fade-out blink
// plays smoothly before the box is actually removed.
const BONUS_BLINK_GRACE_MS = 1000;

// Per-type lifeTimeMs from getBonusData — the SAME value sent to the client in packet 228171466. It
// already accounts for the blink, so the server removes the box exactly at this time. Built lazily
// (getBonusData touches the ResourceManager, which isn't ready at import time).
let bonusLifetimes: Map<string, number> | null = null;
function lifeTimeFor(type: string): number {
    if (!bonusLifetimes) bonusLifetimes = new Map(getBonusData().bonuses.map((b) => [b.id, b.lifeTimeMs]));
    return bonusLifetimes.get(type) ?? BONUS_FALLBACK_LIFETIME_MS;
}
// The CLIENT detects the actual touch (it simulates the parachute fall) and sends TakeBonusCommand;
// the server only sanity-checks horizontal (x,y) distance, generously, against grossly-wrong claims.
const BONUS_PICKUP_SAFETY_RADIUS = 800;
const SPAWN_TICK_MS = 20000; // how often the auto-spawn loop runs
const SPAWN_CHANCE_PER_REGION = 0.25; // chance an empty region drops a bonus on a given tick
const MAX_ACTIVE_BONUSES = 8; // cap on simultaneous drops per battle

// Gold-box drop cadence: a siren announces, then the box falls 30-50s later (wiki), repeating each cycle.
const GOLD_BOX_FIRST_DELAY_MS = 20000; // first siren after the round starts
const GOLD_BOX_INTERVAL_MS = 90000; // gap from one drop to the next siren
const GOLD_BOX_DROP_MIN_MS = 30000; // siren → drop delay (wiki: random 30-50s)
const GOLD_BOX_DROP_MAX_MS = 50000;
const GOLD_BOX_COMING_MESSAGE = "A caixa de ouro será deixada em breve";
const GOLD_BOX_SIREN_RESOURCE = "sounds/notifications/gold_box_siren" as ResourceId; // played with the siren toast

// Maps the official bonus-type names found in the maps' <bonus-region> XML onto OUR bonus ids (the
// ones the client already has resources for — see getBonusData). Keeps the client untouched.
const REGION_TYPE_MAP: Record<string, string> = {
    crystal: "crystall",
    crystal_100: "gold",
    crystal_500: "special",
    medkit: "health",
    nitro: "nitro",
    damageup: "damage",
    armorup: "armor",
};

// BattleMode -> the game-mode token used in the maps' <bonus-region> XML.
const MODE_TOKEN: Record<BattleMode, string> = {
    [BattleMode.DM]: "dm",
    [BattleMode.TDM]: "tdm",
    [BattleMode.CTF]: "ctf",
    [BattleMode.CP]: "dom",
    [BattleMode.AS]: "as",
};

/**
 * Field drops (bonuses): auto-spawn at the map's <bonus-region> points → live for a while → auto-
 * remove or get picked up. The bonus id is "<type>#<instance>"; the type prefix maps to a definition
 * the client received in BonusDataPacket. Spawn/remove/take are broadcast to the whole battle; per-drop
 * lifetimes and the spawn loop use battle.timers. Pickup effects (crystals/heal) are applied here.
 */
// Maps a supply-buff bonus type to the supply id whose effect it triggers (no inventory cost).
const BONUS_SUPPLY_MAP: Record<string, string> = {
    nitro: "n2o",
    damage: "double_damage",
    armor: "armor",
};

export class BonusService {
    constructor(private readonly server: GameServer, private readonly supply: SupplyService) {}

    /** Starts the per-battle auto-spawn loop (drops bonuses at the map's bonus regions over time). */
    public startAutoSpawn(battle: Battle): void {
        if (battle.settings.withoutBonuses) return;
        battle.timers.set("bonusSpawn", SPAWN_TICK_MS, () => this._spawnTick(battle));
    }

    /** Stops the auto-spawn loop and clears every active drop. */
    public stopAutoSpawn(battle: Battle): void {
        battle.timers.clear("bonusSpawn");
        this.stopGoldBoxDrops(battle);
        this.clearAll(battle);
    }

    /** Starts the gold-box drop cycle (siren → random 30-50s → a gold box falls → repeat). No-op if the
     *  battle disabled gold boxes. */
    public startGoldBoxDrops(battle: Battle): void {
        if (battle.settings.withoutGoldBoxes) return;
        battle.timers.set("goldBoxCycle", GOLD_BOX_FIRST_DELAY_MS, () => this._goldBoxAnnounce(battle));
    }

    /** Stops the gold-box drop cycle (pending siren + pending drop). */
    public stopGoldBoxDrops(battle: Battle): void {
        battle.timers.clear("goldBoxCycle");
        battle.timers.clear("goldBoxDrop");
    }

    /** Broadcasts the "gold box coming" siren (unless disabled) and schedules the drop 30-50s later. */
    private _goldBoxAnnounce(battle: Battle): void {
        if (!battle.settings.withoutGoldSiren) {
            battle.broadcast(new GoldBoxComingNotificationPacket(GOLD_BOX_COMING_MESSAGE, ResourceManager.getIdlowById(GOLD_BOX_SIREN_RESOURCE)));
        }
        const delay = GOLD_BOX_DROP_MIN_MS + Math.floor(Math.random() * (GOLD_BOX_DROP_MAX_MS - GOLD_BOX_DROP_MIN_MS));
        battle.timers.set("goldBoxDrop", delay, () => this._goldBoxDrop(battle));
    }

    /** Drops a gold box at a random bonus-region point, then schedules the next cycle. */
    private _goldBoxDrop(battle: Battle): void {
        const regions = getMapBonusRegions(battle.mapResourceId);
        if (regions.length > 0) {
            const region = regions[Math.floor(Math.random() * regions.length)];
            const rand = (a: number, b: number) => a + Math.random() * (b - a);
            const position = { x: rand(region.min.x, region.max.x), y: rand(region.min.y, region.max.y), z: rand(region.min.z, region.max.z) };
            this.spawnBonus(battle, "gold", position);
        }
        battle.timers.set("goldBoxCycle", GOLD_BOX_INTERVAL_MS, () => this._goldBoxAnnounce(battle));
    }

    /** Removes every active drop (e.g. on round restart) without stopping the auto-spawn loop. */
    public clearAll(battle: Battle): void {
        for (const id of [...battle.activeBonuses.keys()]) this.removeBonus(battle, id);
    }

    private _spawnTick(battle: Battle): void {
        const regions = getMapBonusRegions(battle.mapResourceId);
        const mode = MODE_TOKEN[battle.settings.battleMode];
        const occupied = new Set([...battle.activeBonuses.values()].map((b) => b.regionIndex).filter((i) => i !== undefined));

        for (let i = 0; i < regions.length && battle.activeBonuses.size < MAX_ACTIVE_BONUSES; i++) {
            const region = regions[i];
            if (occupied.has(i) || !region.gameModes.includes(mode)) continue;
            if (Math.random() > SPAWN_CHANCE_PER_REGION) continue;
            this._spawnFromRegion(battle, region, i);
        }

        battle.timers.set("bonusSpawn", SPAWN_TICK_MS, () => this._spawnTick(battle)); // re-arm
    }

    private _spawnFromRegion(battle: Battle, region: IBonusRegion, regionIndex: number): void {
        const type = REGION_TYPE_MAP[region.bonusType];
        if (!type) return; // unknown/unsupported region bonus-type
        // A random point anywhere inside the region's min/max box — including z (no ground raycast).
        const rand = (a: number, b: number) => a + Math.random() * (b - a);
        const position = { x: rand(region.min.x, region.max.x), y: rand(region.min.y, region.max.y), z: rand(region.min.z, region.max.z) };
        this.spawnBonus(battle, type, position, regionIndex);
    }

    /** Drops a bonus of `type` at `position`. The per-type lifeTimeMs from getBonusData (sent to the
     *  client as disappearingTimeMs, blink included) is when the box disappears; the server removes it then. */
    public spawnBonus(battle: Battle, type: string, position: IVector3, regionIndex?: number): string {
        const lifeTimeMs = lifeTimeFor(type);
        const id = `${type}#${++battle.bonusCounter}`;
        battle.activeBonuses.set(id, { id, type, position, spawnedAt: Date.now(), lifeTimeMs, regionIndex });
        battle.broadcast(new SpawnBonusPacket({ id, position, disappearingTimeMs: lifeTimeMs }));
        battle.timers.set(`bonus:${id}`, lifeTimeMs + BONUS_BLINK_GRACE_MS, () => this.removeBonus(battle, id));
        logger.info(`Bonus ${id} spawned in battle ${battle.battleId} at (${position.x | 0},${position.y | 0},${position.z | 0})`);
        return id;
    }

    /** Removes a bonus (expiry or after pickup): clears its timer and tells everyone it's gone. */
    public removeBonus(battle: Battle, id: string): void {
        if (!battle.activeBonuses.delete(id)) return;
        battle.timers.clear(`bonus:${id}`);
        battle.broadcast(new RemoveBonusPacket(id));
    }

    /** Client-driven pickup: the client touched a bonus and asked to take it (TakeBonusCommand). We
     *  validate the drop exists and the tank is plausibly near (x,y safety), then apply + remove it. */
    public takeBonus(client: GameClient, battle: Battle, id: string): void {
        const bonus = battle.activeBonuses.get(id);
        if (!bonus || !client.user || client.battleState !== "active") return;

        // Safety only — the client already confirmed the touch, so this is a generous anti-cheat bound.
        const pos = client.battlePosition;
        if (pos) {
            const dx = bonus.position.x - pos.x;
            const dy = bonus.position.y - pos.y;
            if (dx * dx + dy * dy > BONUS_PICKUP_SAFETY_RADIUS * BONUS_PICKUP_SAFETY_RADIUS) {
                logger.warn(`Rejected bonus ${id} pickup by ${client.user.username}: too far (${Math.hypot(dx, dy) | 0}u)`);
                return;
            }
        }

        battle.broadcast(new TakeBonusPacket(id)); // pickup animation/sound for everyone
        this.removeBonus(battle, id);
        // Gold box: announce the pickup to the whole battle ("<nick> picked up the gold box").
        if (bonus.type === "gold") battle.broadcast(new GoldBoxTakenNotificationPacket(client.user.username));
        // Metrics: a field drop was picked up (all types — supplies, crystal/gold/special boxes, medkit).
        client.roundStats.suppliesPicked++;
        client.roundStats.suppliesPickedByType[bonus.type] = (client.roundStats.suppliesPickedByType[bonus.type] ?? 0) + 1;

        // Daily-quest progress for the pickup (gold-box + its crystals) is applied inside _applyEffect, on the
        // same user doc that the crystal grant refreshes — doing it here on a different instance would get
        // clobbered by the crystal grant's dailyQuests $set (a gold box advances BOTH the gold-box and the
        // "earn crystals" quests).
        void this._applyEffect(client, battle, bonus.type);
    }

    /** Crystals granted by each crystal-type drop ("special" is randomized at pickup time). */
    private _crystalAmount(type: string): number | null {
        switch (type) {
            case "crystall": return 10;
            case "gold": return 1000;
            case "moon": return 3000;
            case "pumpkin": return 1000;
            case "special": return 1000 + Math.floor(Math.random() * 1001); // 1000..2000
            default: return null;
        }
    }

    /** Applies a picked-up bonus's effect. Crystals are persisted; medkit restores HP. */
    private async _applyEffect(client: GameClient, battle: Battle, type: string): Promise<void> {
        const user = client.user;
        if (!user) return;

        const crystals = this._crystalAmount(type);
        if (crystals !== null) {
            try {
                const updated = await this.server.userService.updateResources(user.id, { crystals: user.crystals + crystals });
                client.user = updated;
                client.roundStats.crystalsEarned += crystals; // metrics: crystals earned from field drops
                client.sendPacket(new UpdateCrystals(updated.crystals));
                // Crystal drops count toward the "earn crystals" quest; a gold box ALSO counts toward the
                // "catch a gold box" quest — both applied in ONE call so neither dailyQuests $set clobbers the other.
                const questCompleted = await this.server.questService.applyQuestEvent(updated, { crystals, goldBox: type === "gold" ? 1 : 0 });
                if (questCompleted && !client.isDestroyed) client.sendPacket(new QuestPackets.QuestCompletedNotification());
            } catch (error: any) {
                logger.error(`Failed to grant ${crystals} crystals from bonus to ${user.username}`, { error: error.message });
            }
            return;
        }

        if (type === "health") {
            // Field-drop medkit: gradual regen like the inventory kit, but its HP budget only refills
            // half the tank (the official drop heals ~5000 normalized, stopping short of full). It
            // announces the official fixed 15s effect time; the effect ends early when regen finishes.
            this.supply.startHealing(client, battle, HEAL_MAX_GIVEN.DROP, HEAL_DROP_EFFECT_MS);
            return;
        }

        // nitro / damage / armor: trigger the matching supply effect for free (no inventory cost).
        const supplyId = BONUS_SUPPLY_MAP[type];
        if (supplyId) {
            this.supply.applyEffect(client, battle, supplyId);
            return;
        }

        logger.info(`${user.username} picked up bonus type "${type}" (no effect mapped)`);
    }
}
