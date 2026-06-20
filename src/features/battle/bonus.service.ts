import { UpdateCrystals } from "@/features/profile/profile.packets";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IVector3 } from "@/shared/types/geom/ivector3";
import logger from "@/utils/logger";
import { Battle } from "./battle.model";
import { RemoveBonusPacket, SetHealthPacket, SpawnBonusPacket, TakeBonusPacket } from "./battle.packets";

const BONUS_LIFETIME_MS = 30000; // a dropped bonus auto-disappears after this if not picked up
const BONUS_PICKUP_RADIUS = 250; // how close a tank must be to grab a bonus (world units)
// Crystals granted by crystal-type drops.
const CRYSTAL_BONUS_AMOUNT = 30;
const GOLD_BONUS_AMOUNT = 1000;

/**
 * Field drops (bonuses): spawn → live for a while → auto-remove or get picked up. The bonus id is
 * "<type>#<instance>"; the type prefix maps to a definition the client received in BonusDataPacket.
 * Spawn/remove/take are broadcast to the whole battle; per-drop lifetimes use battle.timers. Pickup
 * effects (crystals/heal) are applied here. Constructed with the server for crystal persistence.
 */
export class BonusService {
    constructor(private readonly server: GameServer) {}

    /** Drops a bonus of `type` at `position`; broadcasts it and arms its auto-disappear timer. */
    public spawnBonus(battle: Battle, type: string, position: IVector3, lifeTimeMs = BONUS_LIFETIME_MS): string {
        const id = `${type}#${++battle.bonusCounter}`;
        battle.activeBonuses.set(id, { id, type, position, spawnedAt: Date.now(), lifeTimeMs });
        battle.broadcast(new SpawnBonusPacket({ id, position, disappearingTimeMs: lifeTimeMs }));
        battle.timers.set(`bonus:${id}`, lifeTimeMs, () => this.removeBonus(battle, id));
        logger.info(`Bonus ${id} spawned in battle ${battle.battleId} at (${position.x | 0},${position.y | 0},${position.z | 0})`);
        return id;
    }

    /** Removes a bonus (expiry or after pickup): clears its timer and tells everyone it's gone. */
    public removeBonus(battle: Battle, id: string): void {
        if (!battle.activeBonuses.delete(id)) return;
        battle.timers.clear(`bonus:${id}`);
        battle.broadcast(new RemoveBonusPacket(id));
    }

    /** CTF/DM pickup check: if an active tank is on top of a bonus, take it. Called per position update. */
    public checkPickup(client: GameClient): void {
        const { user, currentBattle: battle, battlePosition } = client;
        if (!user || !battle || !battlePosition || client.battleState !== "active") return;
        for (const bonus of battle.activeBonuses.values()) {
            const dx = bonus.position.x - battlePosition.x;
            const dy = bonus.position.y - battlePosition.y;
            const dz = bonus.position.z - battlePosition.z;
            if (dx * dx + dy * dy + dz * dz <= BONUS_PICKUP_RADIUS * BONUS_PICKUP_RADIUS) {
                this._takeBonus(client, battle, bonus.id, bonus.type);
                break;
            }
        }
    }

    private _takeBonus(client: GameClient, battle: Battle, id: string, type: string): void {
        battle.broadcast(new TakeBonusPacket(id)); // pickup animation/sound for everyone
        this.removeBonus(battle, id);
        void this._applyEffect(client, battle, type);
    }

    /** Applies a picked-up bonus's effect. Crystals are persisted; health restores HP. */
    private async _applyEffect(client: GameClient, battle: Battle, type: string): Promise<void> {
        const user = client.user;
        if (!user) return;

        if (type === "crystall" || type === "gold") {
            const amount = type === "gold" ? GOLD_BONUS_AMOUNT : CRYSTAL_BONUS_AMOUNT;
            try {
                const updated = await this.server.userService.updateResources(user.id, { crystals: user.crystals + amount });
                client.user = updated;
                client.sendPacket(new UpdateCrystals(updated.crystals));
            } catch (error: any) {
                logger.error(`Failed to grant ${amount} crystals from bonus to ${user.username}`, { error: error.message });
            }
            return;
        }

        if (type === "health") {
            client.currentHealth = 10000;
            battle.broadcast(new SetHealthPacket({ nickname: user.username, health: 10000 }));
            return;
        }

        // nitro / damage / armor (supply buffs) — pickup works; gameplay effect to be added later.
        logger.info(`${user.username} picked up bonus type "${type}" (effect not yet implemented)`);
    }
}
