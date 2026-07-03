import { GameClient } from "@/server/game.client";
import * as ProfilePackets from "@/features/profile/profile.packets";
import { advanceQuestsInMemory } from "@/features/quests/quests.service";
import { QuestCompletedNotification } from "@/features/quests/quests.packets";
import { UserDocument } from "@/shared/models/user.model";
import { IVector3 } from "@/shared/types/geom/ivector3";
import { ItemUtils } from "@/utils/item.utils";
import logger from "@/utils/logger";
import { Battle, BattleRoundState, EquipmentConstraintsMode } from "./battle.model";
import { SUPPLY_SLOT, SupplyService } from "./supply.service";
import { CollisionService } from "./collision.service";
import { BattleEvents } from "./battle-events";
import { DamageIndicatorPacket, KillPacket, SetHealthPacket, UpdateBattleUserDMPacket, UpdateBattleUserTeamPacket } from "./battle.packets";

const KILL_RESPAWN_MS = 3000;
const KILL_SCORE = 10; // in-battle scoreboard points per kill
const KILL_XP = 10; // rank experience per kill

// Each weapon (turret id) → the paint-resistance property that protects against it. The victim's
// equipped paint reduces incoming damage from this weapon by its RESISTANCE percent (garage `properts`).
// Covers every turret, including isida — so the moment isida (or any not-yet-wired weapon) starts
// calling applyDamage, its resistance works automatically with no further changes.
const WEAPON_RESISTANCE: Record<string, string> = {
    railgun: "RAILGUN_RESISTANCE",
    smoky: "SMOKY_RESISTANCE",
    twins: "TWINS_RESISTANCE",
    thunder: "THUNDER_RESISTANCE",
    shotgun: "SHOTGUN_RESISTANCE",
    freeze: "FREEZE_RESISTANCE",
    ricochet: "RICOCHET_RESISTANCE",
    machinegun: "MACHINE_GUN_RESISTANCE",
    shaft: "SHAFT_RESISTANCE",
    flamethrower: "FIREBIRD_RESISTANCE",
    isida: "ISIS_RESISTANCE",
};

/**
 * Damage, health and the kill scoreboard. On a killing blow it emits the `kill` event; the cross-
 * cutting reactions (flag drop, lobby preview, round score-limit) live in their own listeners so
 * combat doesn't call CTF/round directly. Extracted from BattleService.
 */
export class CombatService {
    constructor(private readonly events: BattleEvents, private readonly collision: CollisionService) {}

    /**
     * Applies `realDamage` (garage HP units) to a target. Health is on the client's normalized
     * 0-10000 scale (RULE OF 3: normalizedDamage = realDamage * 10000 / hullHP). Broadcasts SetHealth
     * + the damage number, and runs the kill flow at 0. Shared by all weapons (railgun, thunder, ...).
     */
    public async applyDamage(battle: Battle, shooterClient: GameClient, targetClient: GameClient, realDamage: number, damageType: number = 0, sourceWeapon?: string | null, ignoreShooterBuffs: boolean = false): Promise<void> {
        const targetUser = targetClient.user;
        if (!targetUser || targetClient.battleState !== "active" || realDamage <= 0) return;
        if (battle.roundState === BattleRoundState.FINISHED) return; // no damage/kills during the round-finish freeze

        // Friendly fire: in team modes with friendlyFire disabled, teammates can't damage each other.
        // Self-damage always lands (ricochet bounce-back, splash on yourself, self-destruct), and DM has
        // no teams (teamOf === 2 for everyone) so this never gates it.
        const shooterUser = shooterClient.user;
        if (shooterUser && battle.isFriendlyBlocked(shooterUser, targetUser)) {
            return;
        }

        // Supply/bonus multipliers: shooter's Double Damage doubles output, target's Double Armor halves it.
        // `ignoreShooterBuffs` skips the Double Damage step for damage that isn't a live shot — a MINE deals a
        // fixed roll set when it was placed, so the owner's CURRENT Double Damage must not scale it (and, if
        // it did, it would exactly cancel the victim's Double Armor, making armor look broken). The victim's
        // Double Armor ALWAYS applies.
        if (!ignoreShooterBuffs && SupplyService.hasEffect(shooterClient, SUPPLY_SLOT.DOUBLE_DAMAGE)) realDamage *= 2;
        if (SupplyService.hasEffect(targetClient, SUPPLY_SLOT.ARMOR)) realDamage *= 0.5;

        // Paint resistance: the victim's equipped paint reduces damage from the SHOOTER's weapon by its
        // RESISTANCE % (garage `properts`). The weapon defaults to the shooter's equipped turret; callers
        // can override (a weapon id) or pass null to disable it (e.g. mines have no paint resistance).
        // Disabled entirely in XP/BP (equipment-constraint) modes so the deterministic 2-shot matrix stays
        // pure — a resisting paint must not change the shot count there.
        const weaponId = sourceWeapon === undefined ? shooterUser?.equippedTurret : sourceWeapon;
        const resistProp = weaponId ? WEAPON_RESISTANCE[weaponId] : undefined;
        if (resistProp && battle.settings.equipmentConstraintsMode === EquipmentConstraintsMode.NONE) {
            const resistPct = ItemUtils.getPaintResistancePercent(targetUser, resistProp);
            if (resistPct > 0) realDamage *= 1 - resistPct / 100;
        }

        const hullHP = ItemUtils.getHullArmor(targetUser);

        // Real HP the target had before this blow — the official client shows the HP actually removed
        // on a killing shot (the victim's remaining health), not the weapon's full roll.
        const hpBefore = Math.max(0, (targetClient.currentHealth / 10000) * hullHP);
        targetClient.currentHealth -= (realDamage * 10000) / hullHP;

        // Damage-indicator type: 0 normal (white), 1 critical (yellow), 2 fatal/kill (red). On a kill
        // the number shown is the victim's remaining health (overkill isn't displayed).
        const fatal = targetClient.currentHealth <= 0;
        const shownDamage = Math.round(fatal ? Math.min(realDamage, hpBefore) : realDamage);
        const shownType = fatal ? 2 : damageType;

        // Metrics: the damage actually removed (excludes self-damage — ricochet/splash/self-destruct).
        // Accumulated in roundStats and persisted with the rest of the counters at the next flush trigger
        // (death / disconnect / leave / round-finish) — see StatsService.flushDelta.
        if (shooterUser && shooterUser.id !== targetUser.id) {
            shooterClient.roundStats.damageDealt += shownDamage;
            targetClient.roundStats.damageTaken += shownDamage;
        }

        battle.broadcast(new SetHealthPacket({ nickname: targetUser.username, health: Math.round(targetClient.currentHealth) }));
        battle.broadcast(new DamageIndicatorPacket(targetUser.username, shownDamage, shownType));
        logger.info(`${shooterClient.user?.username} hit ${targetUser.username}: ${Math.round(realDamage)} dmg (hull ${hullHP}hp) -> ${Math.round(targetClient.currentHealth)}/10000`);

        if (fatal) {
            await this._handleKill(battle, shooterClient, targetClient);
        }
    }

    /**
     * Area (splash) damage from an explosion at `center`. Every active tank — including the shooter —
     * within `minRadius` takes damage: full to `maxRadius`, then linearly down to `minPercent`% at
     * `minRadius`. World distance is scaled by SPLASH_WORLD_SCALE.
     */
    public async applySplashDamage(battle: Battle, shooterClient: GameClient, center: IVector3, baseDamage: number, maxRadius: number, minRadius: number, minPercent: number): Promise<void> {
        const SPLASH_WORLD_SCALE = 100; // world units per "metre" — radii are in metres (thunder splash 0..12m)
        for (const targetClient of [...battle.clients]) {
            if (targetClient.isDestroyed || targetClient.battleState !== "active" || !targetClient.battlePosition) continue;
            const dx = targetClient.battlePosition.x - center.x;
            const dy = targetClient.battlePosition.y - center.y;
            const dz = targetClient.battlePosition.z - center.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) / SPLASH_WORLD_SCALE;

            let factor: number;
            if (distance <= maxRadius) factor = 1;
            else if (distance <= minRadius) factor = 1 - (1 - minPercent / 100) * ((distance - maxRadius) / (minRadius - maxRadius));
            else continue;

            // Line of sight: a wall/structure between the explosion and the tank blocks the splash — no
            // damage through walls. (Checked only for tanks already in range, so it's cheap. The trim in
            // isBlockedBetween means the surface at the impact / floor under the tank don't count; a tank
            // AT the impact centre — the direct hit — has a zero-length line and is never blocked.)
            if (this.collision.isBlockedBetween(battle.mapResourceId, center, targetClient.battlePosition)) continue;

            await this.applyDamage(battle, shooterClient, targetClient, baseDamage * factor);
        }
    }

    /** A death with no killer (self-destruct, void): +1 death on the scoreboard, no kill credit. */
    public registerSuicideDeath(battle: Battle, client: GameClient): void {
        if (!client.user) return;
        client.deaths++;
        client.roundStats.suicides++;
        this._broadcastUserStat(battle, client, client.user);
        this.events.emit("tankDestroyed", { battle, client });
    }

    private async _handleKill(battle: Battle, killerClient: GameClient, victimClient: GameClient): Promise<void> {
        const killer = killerClient.user;
        const victim = victimClient.user;
        if (!killer || !victim) return;

        victimClient.battleState = "suicide";
        // A combat death ends the life → bump the incarnation, exactly like the void/garage/self-destruct
        // death paths do. Without this, a combat death (which never touched the incarnation) left a pending
        // self-destruct's `selfDestructIncarnation` still equal to `battleIncarnation` on the NEXT life, so
        // the SuicidePacketHandler's "already counting down this incarnation" guard silently swallowed the
        // new self-destruct press — the reported "self-destruct sometimes doesn't fire after 10s".
        victimClient.battleIncarnation++;
        SupplyService.stopHealing(victimClient); // a death cancels any in-progress repair-kit regen

        // Kill notice (victim, killer, respawn delay) — drives the death on every client.
        battle.broadcast(new KillPacket(victim.username, killer.username, KILL_RESPAWN_MS));

        // Scoreboard: victim +1 death, killer +1 kill and score.
        victimClient.deaths++;
        this._broadcastUserStat(battle, victimClient, victim);

        // No self/team-kill credit.
        if (killer.id !== victim.id) {
            killerClient.kills++;
            killerClient.battleScore += KILL_SCORE;
            killer.experience += KILL_XP;
            killerClient.roundStats.xpEarned += KILL_XP;
            // Real-time daily-quest progress (kills + battle score). Persisted by the killer.save() below; a
            // newly-finished mission pushes the completion notification.
            const questCompleted = advanceQuestsInMemory(killer, { kills: 1, score: KILL_SCORE }).completed;
            await killer.save();
            killerClient.sendPacket(new ProfilePackets.UpdateScorePacket(killer.experience));
            if (questCompleted) killerClient.sendPacket(new QuestCompletedNotification());
        }
        this._broadcastUserStat(battle, killerClient, killer);

        logger.info(`${killer.username} killed ${victim.username} in battle ${battle.battleId}.`);

        // Cross-cutting reactions — flag drop (CTF), lobby preview, kill-based score limit — are
        // decoupled via the bus, so combat doesn't call CTF/round directly.
        this.events.emit("kill", { battle, killerClient, victimClient });
        this.events.emit("tankDestroyed", { battle, client: victimClient });
    }

    /** Broadcasts a player's kills/deaths/score using the DM or team scoreboard packet for the mode. */
    private _broadcastUserStat(battle: Battle, client: GameClient, user: UserDocument): void {
        const data = { deaths: client.deaths, kills: client.kills, score: client.battleScore, nickname: user.username };
        if (battle.isTeamMode()) {
            battle.broadcast(new UpdateBattleUserTeamPacket({ ...data, team: battle.teamOf(user) }));
        } else {
            battle.broadcast(new UpdateBattleUserDMPacket(data));
        }
    }
}
