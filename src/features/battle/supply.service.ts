import { suppliesData } from "@/config/supplies.data";
import { GameClient } from "@/server/game.client";
import { ItemUtils } from "@/utils/item.utils";
import { relieveBurn } from "@/features/weapons/flamethrower/flamethrower.handlers";
import { relieveFreeze, broadcastMovementSpec } from "@/features/weapons/freeze/freeze.handlers";
import { Battle } from "./battle.model";
import { EffectStartedPacket, EffectStoppedPacket, SetHealthPacket } from "./battle.packets";

// Supply slot ids (from supplies.data) read elsewhere — combat applies the damage/armor multipliers
// by checking the tank's active effect for these slots.
export const SUPPLY_SLOT = { HEALTH: 1, ARMOR: 2, DOUBLE_DAMAGE: 3, NITRO: 4, MINE: 5 } as const;

// Repair-kit regeneration, matched to the official server's SetHealth ramp (see the reference
// captures): health refills in 0.5s steps of a constant 30 real HP per step. Normalized onto the
// client's 0-10000 health scale that step is `300000 / hullHP` (mammoth 500hp -> +600, a 336hp hull
// -> +892), so the wire ramp is identical regardless of tank.
const HEAL_TICK_MS = 500;
const HEAL_HP_PER_TICK = 30;
// How much health a kit can hand out before it stops, as a fraction of full (10000 normalized).
// Inventory kit fully repairs (1.0); a field-drop medkit only gives half (observed ~5000 normalized).
export const HEAL_MAX_GIVEN = { INVENTORY: 1.0, DROP: 0.5 } as const;
// The floating heal effect over the tank uses the HEALTH supply slot as its effectType. The drop
// medkit announces a fixed nominal effect duration (the official sends 15000ms and then ends the
// effect early when the heal actually finishes); the inventory kit announces its real heal time.
export const HEAL_DROP_EFFECT_MS = 15000;

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

        // Nitro: speed x1.3 + acceleration +0.5. The buff is real only because we re-send the tank spec via
        // broadcastMovementSpec, which COMBINES nitro with any active freeze slowdown — so freezing a nitro'd
        // tank no longer wipes the boost, and it's restored (not lost) when the tank thaws. Both apply (after
        // _startEffect registers the NITRO effect) and end (after it's cleared) recompute the combined spec.
        const onEnd: (() => void) | undefined = supplyId === "n2o" ? () => broadcastMovementSpec(battle, client) : undefined;
        // double_damage / armor: no spec change — CombatService reads the active effect slot and scales damage.

        this._startEffect(client, battle, supply.slotId, durationMs, onEnd);
        if (supplyId === "n2o") broadcastMovementSpec(battle, client);
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

    /**
     * Starts (or restarts) the gradual repair-kit regeneration on `client`. Health climbs +30 real HP
     * every 0.5s (normalized per the tank's hull) until the tank is full OR the kit has handed out its
     * whole HP budget (`maxGivenFraction` of full health), whichever comes first.
     *
     * The budget is the cumulative HP DELIVERED, not a target health level: while the tank is being
     * shot the heal keeps topping it up, but it stops once it has poured in its total — e.g. a mammoth
     * (500hp, 1hp = 20 normalized) at 250hp activating an inventory kit delivers 500hp over 16 ticks +
     * a partial 17th; if it also eats 500hp of damage meanwhile (without dying), it ends right back at
     * 250hp because the kit gave its full 500hp and no more. Re-running supersedes any in-progress heal.
     */
    public startHealing(client: GameClient, battle: Battle, maxGivenFraction: number, effectDurationMs?: number): void {
        const user = client.user;
        if (!user) return;
        SupplyService.stopHealing(client);

        const hullHP = ItemUtils.getHullArmor(user);
        const stepNormalized = (HEAL_HP_PER_TICK * 10000) / hullHP;
        const budgetNormalized = maxGivenFraction * 10000; // total HP the kit can hand out
        let delivered = 0;
        if (client.currentHealth >= 10000) return;

        // Floating "+health" effect over the tank (HEALTH slot). Duration is the kit's nominal time
        // when given (drop medkit), else the real heal time = ticks to deliver the deliverable amount.
        const ticks = Math.ceil(Math.min(10000 - client.currentHealth, budgetNormalized) / stepNormalized);
        const durationMs = effectDurationMs ?? ticks * HEAL_TICK_MS;
        battle.broadcast(new EffectStartedPacket(user.username, SUPPLY_SLOT.HEALTH, durationMs, 0));

        client.healTimer = setInterval(() => {
            if (client.isDestroyed || client.currentBattle !== battle || client.battleState !== "active") {
                SupplyService.stopHealing(client);
                return;
            }
            // Using health also thaws a freeze and puts out a fire fast — each tick shaves the freeze/burn
            // temperatures hard, out-pacing the beam/flame even while still under fire.
            relieveFreeze(battle, client);
            relieveBurn(battle, client);

            // This tick gives a normal step, but never overheals past full and never exceeds the
            // kit's remaining budget (so the last tick before the budget runs out is partial).
            const step = Math.min(stepNormalized, 10000 - client.currentHealth, budgetNormalized - delivered);
            if (step > 0) {
                client.currentHealth += step;
                delivered += step;
                battle.broadcast(new SetHealthPacket({ nickname: user.username, health: Math.round(client.currentHealth) }));
            }
            // Stop on a full tank or once the kit has poured in its whole budget.
            if (client.currentHealth >= 10000 || delivered >= budgetNormalized) SupplyService.stopHealing(client);
        }, HEAL_TICK_MS);
    }

    /** Cancels any in-progress repair-kit regeneration (completion, death, respawn, disconnect, new
     *  kit) and removes the floating heal effect from every client. */
    public static stopHealing(client: GameClient): void {
        if (!client.healTimer) return;
        clearInterval(client.healTimer);
        client.healTimer = null;
        if (client.user && client.currentBattle) {
            client.currentBattle.broadcast(new EffectStoppedPacket(client.user.username, SUPPLY_SLOT.HEALTH));
        }
    }

    /** Whether `client` currently has the given supply-slot effect active. */
    public static hasEffect(client: GameClient, slotId: number): boolean {
        return client.activeEffects.some((e) => e.itemIndex === slotId && e.endAt > Date.now());
    }
}
