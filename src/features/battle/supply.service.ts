import { suppliesData } from "@/config/supplies.data";
import { GameClient } from "@/server/game.client";
import { ItemUtils } from "@/utils/item.utils";
import { Battle } from "./battle.model";
import { EffectStartedPacket, EffectStoppedPacket, TankSpecificationPacket } from "./battle.packets";

// Supply slot ids (from supplies.data) read elsewhere — combat applies the damage/armor multipliers
// by checking the tank's active effect for these slots.
export const SUPPLY_SLOT = { HEALTH: 1, ARMOR: 2, DOUBLE_DAMAGE: 3, NITRO: 4, MINE: 5 } as const;

/**
 * Applies battle supply effects (the EffectStarted → tracked → EffectStopped lifecycle plus each
 * supply's gameplay) WITHOUT touching inventory, so both the inventory-activation handler and a
 * field-bonus pickup can reuse it. n2o re-sends a boosted tank spec; double_damage/armor just mark
 * the effect — CombatService reads `client.activeEffects` for those slots and scales damage.
 */
export class SupplyService {
    /** Applies `supplyId`'s effect to `client`. Returns the activation cooldown in ms (for the
     *  inventory-activation confirm); 0 if the supply is unknown or has no timed effect. */
    public applyEffect(client: GameClient, battle: Battle, supplyId: string): number {
        const supply = suppliesData.find((s) => s.id === supplyId);
        const user = client.user;
        if (!supply || !user) return 0;

        const durationMs = supply.itemEffectTime * 1000;
        // Parkour mode: no reactivation delay — reactivation is allowed the moment the effect ends,
        // so the cooldown is just the active duration (itemRestSec is dropped).
        const cooldownMs = battle.settings.parkourMode
            ? durationMs
            : (supply.itemEffectTime + supply.itemRestSec) * 1000;
        if (durationMs <= 0) return cooldownMs; // health/mine have no timed buff here

        let onEnd: (() => void) | undefined;
        if (supplyId === "n2o") {
            // Nitro: speed x1.3 + acceleration +0.5, real only because we re-send the tank spec; reverted at end.
            const baseSpecs = ItemUtils.getTankSpecifications(user);
            const sendSpec = (specs: typeof baseSpecs) => battle.broadcast(new TankSpecificationPacket({ ...specs, nickname: user.username, sequence: ++client.specSequence }));
            sendSpec({ ...baseSpecs, speed: baseSpecs.speed * 1.3, acceleration: baseSpecs.acceleration + 0.5 });
            onEnd = () => sendSpec(baseSpecs);
        }
        // double_damage / armor: no spec change — CombatService reads the active effect slot and scales damage.

        this._startEffect(client, battle, supply.slotId, durationMs, onEnd);
        return cooldownMs;
    }

    /** Broadcasts EffectStarted, tracks the effect for join-replay, then EffectStopped (+ onEnd) at expiry. */
    private _startEffect(client: GameClient, battle: Battle, slotId: number, durationMs: number, onEnd?: () => void): void {
        const user = client.user!;
        const endAt = Date.now() + durationMs;
        client.activeEffects = client.activeEffects.filter((e) => e.itemIndex !== slotId);
        client.activeEffects.push({ itemIndex: slotId, durationTime: durationMs, endAt });
        battle.broadcast(new EffectStartedPacket(user.username, slotId, durationMs, 0));
        setTimeout(() => {
            if (client.isDestroyed) return;
            const cur = client.activeEffects.find((e) => e.itemIndex === slotId);
            if (cur && cur.endAt !== endAt) return; // superseded by a re-activation
            client.activeEffects = client.activeEffects.filter((e) => e.itemIndex !== slotId);
            if (client.currentBattle !== battle || client.battleState !== "active") return;
            battle.broadcast(new EffectStoppedPacket(user.username, slotId));
            onEnd?.();
        }, durationMs);
    }

    /** Whether `client` currently has the given supply-slot effect active. */
    public static hasEffect(client: GameClient, slotId: number): boolean {
        return client.activeEffects.some((e) => e.itemIndex === slotId && e.endAt > Date.now());
    }
}
