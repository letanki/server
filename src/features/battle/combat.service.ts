import { GameClient } from "@/server/game.client";
import * as ProfilePackets from "@/features/profile/profile.packets";
import { UserDocument } from "@/shared/models/user.model";
import { IVector3 } from "@/shared/types/geom/ivector3";
import { ItemUtils } from "@/utils/item.utils";
import logger from "@/utils/logger";
import { Battle, BattleRoundState } from "./battle.model";
import { BattleEvents } from "./battle-events";
import { DamageIndicatorPacket, KillPacket, SetHealthPacket, UpdateBattleUserDMPacket, UpdateBattleUserTeamPacket } from "./battle.packets";

const KILL_RESPAWN_MS = 3000;
const KILL_SCORE = 10; // in-battle scoreboard points per kill
const KILL_XP = 10; // rank experience per kill

/**
 * Damage, health and the kill scoreboard. On a killing blow it emits the `kill` event; the cross-
 * cutting reactions (flag drop, lobby preview, round score-limit) live in their own listeners so
 * combat doesn't call CTF/round directly. Extracted from BattleService.
 */
export class CombatService {
    constructor(private readonly events: BattleEvents) {}

    /**
     * Applies `realDamage` (garage HP units) to a target. Health is on the client's normalized
     * 0-10000 scale (RULE OF 3: normalizedDamage = realDamage * 10000 / hullHP). Broadcasts SetHealth
     * + the damage number, and runs the kill flow at 0. Shared by all weapons (railgun, thunder, ...).
     */
    public async applyDamage(battle: Battle, shooterClient: GameClient, targetClient: GameClient, realDamage: number): Promise<void> {
        const targetUser = targetClient.user;
        if (!targetUser || targetClient.battleState !== "active" || realDamage <= 0) return;
        if (battle.roundState === BattleRoundState.FINISHED) return; // no damage/kills during the round-finish freeze

        const hullHP = ItemUtils.getHullArmor(targetUser);
        targetClient.currentHealth -= (realDamage * 10000) / hullHP;

        battle.broadcast(new SetHealthPacket({ nickname: targetUser.username, health: Math.round(targetClient.currentHealth) }));
        battle.broadcast(new DamageIndicatorPacket(targetUser.username, Math.round(realDamage), 2));
        logger.info(`${shooterClient.user?.username} hit ${targetUser.username}: ${Math.round(realDamage)} dmg (hull ${hullHP}hp) -> ${Math.round(targetClient.currentHealth)}/10000`);

        if (targetClient.currentHealth <= 0) {
            await this._handleKill(battle, shooterClient, targetClient);
        }
    }

    /**
     * Area (splash) damage from an explosion at `center`. Every active tank — including the shooter —
     * within `minRadius` takes damage: full to `maxRadius`, then linearly down to `minPercent`% at
     * `minRadius`. World distance is scaled by SPLASH_WORLD_SCALE.
     */
    public async applySplashDamage(battle: Battle, shooterClient: GameClient, center: IVector3, baseDamage: number, maxRadius: number, minRadius: number, minPercent: number): Promise<void> {
        const SPLASH_WORLD_SCALE = 10;
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

            await this.applyDamage(battle, shooterClient, targetClient, baseDamage * factor);
        }
    }

    /** A death with no killer (self-destruct, void): +1 death on the scoreboard, no kill credit. */
    public registerSuicideDeath(battle: Battle, client: GameClient): void {
        if (!client.user) return;
        client.deaths++;
        this._broadcastUserStat(battle, client, client.user);
    }

    private async _handleKill(battle: Battle, killerClient: GameClient, victimClient: GameClient): Promise<void> {
        const killer = killerClient.user;
        const victim = victimClient.user;
        if (!killer || !victim) return;

        victimClient.battleState = "suicide";

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
            await killer.save();
            killerClient.sendPacket(new ProfilePackets.UpdateScorePacket(killer.experience));
        }
        this._broadcastUserStat(battle, killerClient, killer);

        logger.info(`${killer.username} killed ${victim.username} in battle ${battle.battleId}.`);

        // Cross-cutting reactions — flag drop (CTF), lobby preview, kill-based score limit — are
        // decoupled via the bus, so combat doesn't call CTF/round directly.
        this.events.emit("kill", { battle, killerClient, victimClient });
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
