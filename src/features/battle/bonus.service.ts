import { getBonusData, ESPORT_BONUS_LIFETIME_MS } from "@/config/bonus.data";
import { UpdateCrystals } from "@/features/profile/profile.packets";
import * as QuestPackets from "@/features/quests/quests.packets";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IVector3 } from "@/shared/types/geom/ivector3";
import { getMapBonusRegions, IBonusRegion } from "@/maps/mapData";
import { ResourceId } from "@/generated/resourceTypes";
import { ResourceManager } from "@/utils/resource.manager";
import logger from "@/utils/logger";
import { Battle, BattleMode, EquipmentConstraintsMode } from "./battle.model";
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
// Crystal box drop (wiki "Crystal boxes"): a crystal box (10 crystals) rolls whenever crystals are ADDED
// to the battle fund — NOT on a time tick. For EACH `crystal`-type drop zone, independently, the chance is
// CRYSTAL_DROP_CHANCE per crystal added (so a +ΔF fund event = 1-(1-p)^ΔF per zone). Zones roll independent
// and ignore occupancy, so boxes can stack — faithful to official (see [[bonus-drop-model]]). We only use
// `crystal`-typed zones (not crystal_100/500) by design.
const CRYSTAL_DROP_CHANCE = 0.01;

// --- SUPPLY/BUFF field drops (both modes) — measured from official captures, see [[bonus-drop-model]] ---
// The buff DROP SYSTEM: each buff region is seeded ONCE (1s probabilistic tick), then re-drops after its
// bonus leaves the region. Only the lifetime + respawn rule differ per mode:
//   • esportDropTiming: box never expires (ESPORT_BONUS_LIFETIME_MS); on pickup it re-drops after a FIXED
//     ESPORT_RESPAWN_MS (captures: ~101.5s incl. parachute fall).
//   • default: box expires after its 30s lifetime; whenever the region empties (expiry OR pickup) it
//     re-drops after a RANDOM uniform [DEFAULT_RESPAWN_MIN_MS, DEFAULT_RESPAWN_MAX_MS] (captures: the
//     remove→next-spawn gaps fit uniform ~[45,170]s, median ~107s).
// The initial seed differs per mode (confirmed from official captures — kept faithful, NOT unified):
//   • esport: no initial delay, 1s tick — first drop ~6s, field fills ~70s.
//   • default: ~78s initial delay then a 3s tick — first drop consistently ~80-90s, field fills ~75s
//     after the delay (3 fresh-battle captures: first drop +81/+88/+90s, all on a 3s grid).
// Per-region chance tunes the fill speed; the seed queue drops each region once, refills come from the
// respawn path.
interface SeedParams { tickMs: number; chance: number; delayMs: number; }
const ESPORT_SEED: SeedParams = { tickMs: 1000, chance: 0.04, delayMs: 0 };
const DEFAULT_SEED: SeedParams = { tickMs: 3000, chance: 0.10, delayMs: 78000 };
const seedParams = (esport: boolean): SeedParams => (esport ? ESPORT_SEED : DEFAULT_SEED);

const ESPORT_RESPAWN_MS = 100000;
const DEFAULT_RESPAWN_MIN_MS = 45000;
const DEFAULT_RESPAWN_MAX_MS = 170000;
// The buff/supply bonus ids the seed+respawn system governs (our ids, post REGION_TYPE_MAP). Crystal/gold
// boxes are NOT here — the crystal box drops via the fund-based onFundAdded (wiki: 1% per `crystal` zone
// per crystal added); gold (1/7000 per crystal or fund thresholds) is still on the legacy cycle, not wired
// to the fund yet. Infinite ground lifetime in esport still applies to ALL types.
const BUFF_DROP_TYPES = new Set(["nitro", "damage", "armor", "health"]);

// Gold box (1000 crystals): fund-triggered, in one of two modes (per the wiki):
//   • RANDOM-FUND — all regular battles, AND PRO battles with `randomGold` on: a single global probabilistic
//     roll per fund event, GOLD_DROP_CHANCE = 1/7000 per crystal added (~0.014%). Chance starts at 0,
//     accumulates with crystals added → ~1 gold per ~7k fund.
//   • THRESHOLD — PRO battles with `randomGold` off: the gold drops when the fund crosses a level — first at
//     [7000,7200], then each next at previous+7000±100.
// When it fires: siren announces, box falls 30-50s later. Location = a random `crystal_100` zone. Golds roll
// independently (no in-flight cap); a rare overlap within the 30-50s window just reuses the "goldBoxDrop"
// timer (one box falls) — acceptable. See [[bonus-drop-model]].
const GOLD_DROP_CHANCE = 1 / 7000; // random-fund mode: per crystal added to the fund (~0.014%)
const GOLD_THRESHOLD_FIRST_MIN = 7000; // threshold mode: first gold at fund in [MIN, MAX]
const GOLD_THRESHOLD_FIRST_MAX = 7200;
const GOLD_THRESHOLD_STEP = 7000; // then each next = previous + STEP ± JITTER
const GOLD_THRESHOLD_JITTER = 100;
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

    /** Starts the per-battle drop loops. Supply/buff regions use the seed-once + respawn-on-empty model in
     *  BOTH modes (see _startBuffSeeding); crystal regions keep the legacy probabilistic tick (default mode
     *  only) until the fund-based crystal system exists. */
    public startAutoSpawn(battle: Battle): void {
        if (battle.settings.withoutBonuses) return;
        this._startBuffSeeding(battle);
        // Crystal boxes are NOT on a timer — they roll on fund increments (see onFundAdded).
    }

    /** Stops every drop loop and clears active drops (no re-seed — unlike clearAll). */
    public stopAutoSpawn(battle: Battle): void {
        battle.timers.clear("buffSeed");
        this._clearBuffRespawns(battle); // cancel seed queue + pending region respawns
        this.stopGoldBoxDrops(battle);
        for (const id of [...battle.activeBonuses.keys()]) this.removeBonus(battle, id);
    }

    /** No timer to start — the gold box is fund-triggered (see onFundAdded). Kept for symmetry with the
     *  battle lifecycle calls. */
    public startGoldBoxDrops(_battle: Battle): void {
        /* fund-triggered; nothing to schedule */
    }

    /** Cancels a pending gold drop (announced siren waiting to fall) and resets the threshold — round
     *  restart / battle emptied (the fund is back to 0). */
    public stopGoldBoxDrops(battle: Battle): void {
        battle.timers.clear("goldBoxDrop");
        battle.nextGoldThreshold = null;
    }

    /** Rolls the gold box on a fund increment of `amount` crystals. Mode per proBattle/`randomGold`:
     *  random-fund (probabilistic 1/7000 per crystal) or fund-threshold crossing. On trigger, fires the
     *  siren + schedules the drop. */
    private _rollGoldBox(battle: Battle, amount: number): void {
        if (battle.settings.withoutGoldBoxes) return;
        const rand = (a: number, b: number) => a + Math.random() * (b - a);

        // Random-fund mode: all regular battles + PRO battles with `randomGold` on. 1/7000 per crystal added.
        if (!battle.settings.proBattle || battle.settings.randomGold) {
            const chance = 1 - Math.pow(1 - GOLD_DROP_CHANCE, amount);
            if (Math.random() < chance) this._goldBoxAnnounce(battle);
            return;
        }

        // Threshold mode: PRO battle with `randomGold` off — drop when the fund crosses the next level.
        if (battle.nextGoldThreshold == null) {
            battle.nextGoldThreshold = Math.round(rand(GOLD_THRESHOLD_FIRST_MIN, GOLD_THRESHOLD_FIRST_MAX));
        }
        if (battle.fund >= battle.nextGoldThreshold) {
            battle.nextGoldThreshold += Math.round(GOLD_THRESHOLD_STEP + rand(-GOLD_THRESHOLD_JITTER, GOLD_THRESHOLD_JITTER));
            this._goldBoxAnnounce(battle);
        }
    }

    /** Broadcasts the "gold box coming" siren (unless disabled) and schedules the drop 30-50s later. */
    private _goldBoxAnnounce(battle: Battle): void {
        if (!battle.settings.withoutGoldSiren) {
            battle.broadcast(new GoldBoxComingNotificationPacket({ message: GOLD_BOX_COMING_MESSAGE, sound: ResourceManager.getIdlowById(GOLD_BOX_SIREN_RESOURCE) }));
        }
        const delay = GOLD_BOX_DROP_MIN_MS + Math.floor(Math.random() * (GOLD_BOX_DROP_MAX_MS - GOLD_BOX_DROP_MIN_MS));
        battle.timers.set("goldBoxDrop", delay, () => this._goldBoxDrop(battle));
    }

    /** Drops the gold box at a random `crystal_100` zone (falls back to any bonus region if the map has
     *  none). */
    private _goldBoxDrop(battle: Battle): void {
        const mode = MODE_TOKEN[battle.settings.battleMode];
        const inMode = getMapBonusRegions(battle.mapResourceId).filter((r) => r.gameModes.includes(mode));
        const goldZones = inMode.filter((r) => r.bonusType === "crystal_100");
        const regions = goldZones.length > 0 ? goldZones : inMode;
        if (regions.length === 0) return;
        const region = regions[Math.floor(Math.random() * regions.length)];
        const rand = (a: number, b: number) => a + Math.random() * (b - a);
        const position = { x: rand(region.min.x, region.max.x), y: rand(region.min.y, region.max.y), z: rand(region.min.z, region.max.z) };
        this.spawnBonus(battle, "gold", position);
    }

    /** Removes every active drop (e.g. on round restart) and RE-SEEDS the buff field from scratch (the
     *  seed tick stops once the field is full, so a plain clear would leave it empty for the new round).
     *  Also resets the gold threshold (the fund is back to 0 for the new round). */
    public clearAll(battle: Battle): void {
        for (const id of [...battle.activeBonuses.keys()]) this.removeBonus(battle, id);
        this._clearBuffRespawns(battle);
        this.stopGoldBoxDrops(battle);
        this._startBuffSeeding(battle);
    }

    /** (Re)initializes the one-time buff seed queue and arms the seeding tick. The first tick fires after
     *  the mode's initial delay (esport ~0, default ~78s); it then re-arms at the mode's tick interval. */
    private _startBuffSeeding(battle: Battle): void {
        // Guard no PONTO ÚNICO: startAutoSpawn E o re-seed do clearAll (restart de round) passam por aqui.
        // Sem isso, o restart re-semeava os drops mesmo numa partida com bônus/suprimentos desativados
        // (a config não some — era o clearAll que ignorava a flag).
        if (battle.settings.withoutBonuses) return;
        const mode = MODE_TOKEN[battle.settings.battleMode];
        const regions = getMapBonusRegions(battle.mapResourceId);
        // Seed queue: regions that support this mode AND map to a SUPPLY/BUFF type. Crystal/gold regions
        // are excluded (crystal boxes drop via the fund-based onFundAdded, not the seed queue).
        battle.bonusSeedQueue = new Set(
            regions.map((_r, i) => i).filter((i) => regions[i].gameModes.includes(mode) && BUFF_DROP_TYPES.has(REGION_TYPE_MAP[regions[i].bonusType]))
        );
        if (battle.bonusSeedQueue.size === 0) return;
        const { delayMs, tickMs } = seedParams(battle.settings.esportDropTiming);
        battle.timers.set("buffSeed", delayMs + tickMs, () => this._buffSeedTick(battle));
    }

    /** Crystal box drop (wiki model): call whenever `amount` crystals are ADDED to the battle fund. For
     *  each `crystal`-type zone, independently, spawn a crystal box (10) with chance 1-(1-p)^amount. Zones
     *  ignore occupancy (boxes may stack). No-op if bonuses are disabled. */
    public onFundAdded(battle: Battle, amount: number): void {
        if (battle.settings.withoutBonuses || amount <= 0) return;
        const mode = MODE_TOKEN[battle.settings.battleMode];
        const zoneChance = 1 - Math.pow(1 - CRYSTAL_DROP_CHANCE, amount); // `amount` independent 1% rolls
        const rand = (a: number, b: number) => a + Math.random() * (b - a);
        for (const region of getMapBonusRegions(battle.mapResourceId)) {
            if (region.bonusType !== "crystal" || !region.gameModes.includes(mode)) continue;
            if (Math.random() >= zoneChance) continue;
            const position = { x: rand(region.min.x, region.max.x), y: rand(region.min.y, region.max.y), z: rand(region.min.z, region.max.z) };
            this.spawnBonus(battle, "crystall", position);
        }
        // Gold box: single global roll, 100x rarer than a crystal-zone roll.
        this._rollGoldBox(battle, amount);
    }

    /** Buff seeding tick (1s, both modes): each still-unseeded region independently rolls a chance to drop
     *  its one-time initial bonus. Seeded regions leave the queue (refills then come from the respawn
     *  path). Stops re-arming once the queue is empty. */
    private _buffSeedTick(battle: Battle): void {
        const queue = battle.bonusSeedQueue;
        if (!queue) return;
        const { tickMs, chance } = seedParams(battle.settings.esportDropTiming);
        const regions = getMapBonusRegions(battle.mapResourceId);
        for (const i of [...queue]) {
            if (Math.random() >= chance) continue;
            this._spawnFromRegion(battle, regions[i], i);
            queue.delete(i);
        }
        if (queue.size > 0) battle.timers.set("buffSeed", tickMs, () => this._buffSeedTick(battle));
    }

    /** After a buff region empties (pickup, or expiry in default), schedule its next drop: a FIXED
     *  ESPORT_RESPAWN_MS in esport, a RANDOM uniform [DEFAULT_RESPAWN_MIN_MS, DEFAULT_RESPAWN_MAX_MS] in
     *  default. Overwrites any pending respawn for the region. */
    private _scheduleBuffRespawn(battle: Battle, regionIndex: number): void {
        const delay = battle.settings.esportDropTiming
            ? ESPORT_RESPAWN_MS
            : DEFAULT_RESPAWN_MIN_MS + Math.floor(Math.random() * (DEFAULT_RESPAWN_MAX_MS - DEFAULT_RESPAWN_MIN_MS));
        battle.timers.set(`bonusRegion:${regionIndex}`, delay, () => {
            const regions = getMapBonusRegions(battle.mapResourceId);
            const region = regions[regionIndex];
            if (region) this._spawnFromRegion(battle, region, regionIndex);
        });
    }

    /** Clears the seed queue + any pending region respawn timers (round restart / battle emptied). */
    private _clearBuffRespawns(battle: Battle): void {
        battle.bonusSeedQueue = null;
        const regions = getMapBonusRegions(battle.mapResourceId);
        for (let i = 0; i < regions.length; i++) battle.timers.clear(`bonusRegion:${i}`);
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
        // esport: NO box expires on the ground (any type only leaves when collected), so no removal timer.
        // Only the DROP SYSTEM differs per type (buff seeding/respawn vs crystal/gold fund-based), not the
        // lifetime — see [[bonus-drop-model]].
        const esport = battle.settings.esportDropTiming;
        const lifeTimeMs = esport ? ESPORT_BONUS_LIFETIME_MS : lifeTimeFor(type);
        const id = `${type}#${++battle.bonusCounter}`;
        battle.activeBonuses.set(id, { id, type, position, spawnedAt: Date.now(), lifeTimeMs, regionIndex });
        battle.broadcast(new SpawnBonusPacket({ id, position, disappearingTimeMs: lifeTimeMs }));
        if (!esport) {
            // default: the box expires after its lifetime; a buff region then re-drops after a random delay.
            const buffRegion = regionIndex !== undefined && BUFF_DROP_TYPES.has(type);
            battle.timers.set(`bonus:${id}`, lifeTimeMs + BONUS_BLINK_GRACE_MS, () => {
                this.removeBonus(battle, id);
                if (buffRegion) this._scheduleBuffRespawn(battle, regionIndex!);
            });
        }
        logger.info(`Bonus ${id} spawned in battle ${battle.battleId} at (${position.x | 0},${position.y | 0},${position.z | 0})`);
        return id;
    }

    /** Debug/staff: drops `count` bonuses of `type` at random points inside the map+mode's bonus regions
     *  OF THAT TYPE (a gold drops only in crystal_100 zones, a medkit only in medkit zones, etc.). Types
     *  with no region of their own on the map (e.g. moon/pumpkin, which no map XML declares) fall back to
     *  any region of the mode. One-off drops (no regionIndex → no respawn wiring). Returns how many were
     *  actually dropped (0 if the map has no regions for this mode). */
    public spawnRandom(battle: Battle, type: string, count: number): number {
        const mode = MODE_TOKEN[battle.settings.battleMode];
        const inMode = getMapBonusRegions(battle.mapResourceId).filter((r) => r.gameModes.includes(mode));
        const typed = inMode.filter((r) => REGION_TYPE_MAP[r.bonusType] === type);
        const regions = typed.length > 0 ? typed : inMode;
        if (regions.length === 0) return 0;
        const rand = (a: number, b: number) => a + Math.random() * (b - a);
        for (let i = 0; i < count; i++) {
            const region = regions[Math.floor(Math.random() * regions.length)];
            const position = { x: rand(region.min.x, region.max.x), y: rand(region.min.y, region.max.y), z: rand(region.min.z, region.max.z) };
            this.spawnBonus(battle, type, position);
        }
        return count;
    }

    /** Debug/staff: drops ONE bonus at the CENTER of every bonus region of the battle's map+mode, using
     *  the region's own type (crystal→crystall, crystal_100→gold [golden box], crystal_500→special,
     *  medkit→health, nitro/damageup/armorup→their buff). One-off drops (no regionIndex → no respawn
     *  wiring). Returns per-type counts so a command can report what dropped where. */
    public spawnAllRegions(battle: Battle): Record<string, number> {
        const regions = getMapBonusRegions(battle.mapResourceId);
        const mode = MODE_TOKEN[battle.settings.battleMode];
        const counts: Record<string, number> = {};
        for (const region of regions) {
            if (!region.gameModes.includes(mode)) continue;
            const type = REGION_TYPE_MAP[region.bonusType];
            if (!type) continue;
            const position = {
                x: (region.min.x + region.max.x) / 2,
                y: (region.min.y + region.max.y) / 2,
                z: (region.min.z + region.max.z) / 2,
            };
            this.spawnBonus(battle, type, position);
            counts[type] = (counts[type] ?? 0) + 1;
        }
        return counts;
    }

    /** Removes a bonus (expiry or after pickup): clears its timer and tells everyone it's gone. */
    public removeBonus(battle: Battle, id: string): void {
        if (!battle.activeBonuses.delete(id)) return;
        battle.timers.clear(`bonus:${id}`);
        battle.broadcast(new RemoveBonusPacket({ id }));
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

        battle.broadcast(new TakeBonusPacket({ id })); // pickup animation/sound for everyone
        this.removeBonus(battle, id);
        // A collected BUFF region re-drops (fixed 100s in esport, random in default). Crystal/gold don't.
        if (bonus.regionIndex !== undefined && BUFF_DROP_TYPES.has(bonus.type)) {
            this._scheduleBuffRespawn(battle, bonus.regionIndex);
        }
        // Gold box: announce the pickup to the whole battle ("<nick> picked up the gold box").
        if (bonus.type === "gold") battle.broadcast(new GoldBoxTakenNotificationPacket({ nickname: client.user.username }));
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
                client.sendPacket(new UpdateCrystals({ crystals: updated.crystals }));
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
            // Field-drop medkit: gradual regen like the inventory kit. Normalmente cura só metade do tanque
            // (~5000 normalizado, como no oficial), MAS no XP/BP (equipment-constraint) enche a vida TODA —
            // igual ao kit de inventário. Anuncia o tempo fixo oficial de 15s; o efeito acaba antes se a
            // regeneração terminar.
            const healFraction = battle.settings.equipmentConstraintsMode !== EquipmentConstraintsMode.NONE
                ? HEAL_MAX_GIVEN.INVENTORY
                : HEAL_MAX_GIVEN.DROP;
            this.supply.startHealing(client, battle, healFraction, HEAL_DROP_EFFECT_MS);
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
