import { getBonusData } from "@/config/bonus.data";
import { UpdateCrystals } from "@/features/profile/profile.packets";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IVector3 } from "@/shared/types/geom/ivector3";
import { bonusRegions, IBonusRegion } from "@/types/bonusRegions";
import logger from "@/utils/logger";
import { Battle, BattleMode } from "./battle.model";
import { SupplyService } from "./supply.service";
import { RemoveBonusPacket, SetHealthPacket, SpawnBonusPacket, TakeBonusPacket } from "./battle.packets";

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
        this.clearAll(battle);
    }

    /** Removes every active drop (e.g. on round restart) without stopping the auto-spawn loop. */
    public clearAll(battle: Battle): void {
        for (const id of [...battle.activeBonuses.keys()]) this.removeBonus(battle, id);
    }

    private _spawnTick(battle: Battle): void {
        const regions = bonusRegions[battle.mapResourceId] ?? [];
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
                client.sendPacket(new UpdateCrystals(updated.crystals));
            } catch (error: any) {
                logger.error(`Failed to grant ${crystals} crystals from bonus to ${user.username}`, { error: error.message });
            }
            return;
        }

        if (type === "health") {
            client.currentHealth = 10000;
            battle.broadcast(new SetHealthPacket({ nickname: user.username, health: 10000 }));
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
