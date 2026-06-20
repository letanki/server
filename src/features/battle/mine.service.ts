import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import logger from "@/utils/logger";
import { Battle, BattleMode } from "./battle.model";
import { CombatService } from "./combat.service";
import { ActivateMinePacket, DetonateMinePacket, PutMinePacket, RemoveMinesPacket } from "./battle.packets";

const MINE_ARM_DELAY_MS = 1000; // a placed mine becomes armed (able to trigger) this long after placement
const MINE_TRIGGER_RADIUS = 250; // an enemy this close (x,y,z) sets the mine off
const MINE_DAMAGE = 800; // damage dealt to the tank that steps on it (garage HP units)

/**
 * Battle mines: a player drops an invisible mine (Mine supply); it detonates when an enemy gets close,
 * dealing splash damage. Place/activate/remove are broadcast to the whole battle (the client hides
 * enemies' mines until they activate). Constructed with the server + CombatService for the explosion.
 */
export class MineService {
    constructor(private readonly server: GameServer, private readonly combat: CombatService) {}

    /** Drops a mine at the caller's current position (Mine supply activation). */
    public placeMine(client: GameClient, battle: Battle): void {
        const user = client.user;
        const pos = client.battlePosition;
        if (!user || !pos || client.battleState !== "active" || battle.settings.withoutMines) return;

        const id = `${++battle.mineCounter}`;
        battle.activeMines.set(id, { id, owner: user.username, ownerTeam: battle.teamOf(user), position: { ...pos }, armed: false });
        battle.broadcast(new PutMinePacket(id, pos, user.username));
        // Arm it after a short delay — only then can it trigger.
        battle.timers.set(`mineArm:${id}`, MINE_ARM_DELAY_MS, () => this._arm(battle, id));
        logger.info(`Mine ${id} placed by ${user.username} in battle ${battle.battleId}`);
    }

    private _arm(battle: Battle, id: string): void {
        const mine = battle.activeMines.get(id);
        if (!mine) return;
        mine.armed = true;
        battle.broadcast(new ActivateMinePacket(id));
    }

    /** Per-position check: if an enemy tank is on top of a mine, detonate it. */
    public checkTriggers(client: GameClient): void {
        const { user, currentBattle: battle, battlePosition } = client;
        if (!user || !battle || !battlePosition || client.battleState !== "active") return;

        for (const mine of battle.activeMines.values()) {
            if (!mine.armed || !this._isEnemy(battle, client, mine.owner, mine.ownerTeam)) continue;
            const dx = mine.position.x - battlePosition.x;
            const dy = mine.position.y - battlePosition.y;
            const dz = mine.position.z - battlePosition.z;
            if (dx * dx + dy * dy + dz * dz <= MINE_TRIGGER_RADIUS * MINE_TRIGGER_RADIUS) {
                this._detonate(battle, mine.id, client);
                break;
            }
        }
    }

    /** Removes every mine owned by `ownerNickname` (e.g. when they leave the battle). */
    public removeMinesOf(battle: Battle, ownerNickname: string): void {
        let removed = false;
        for (const [id, mine] of battle.activeMines) {
            if (mine.owner === ownerNickname) {
                battle.timers.clear(`mineArm:${id}`);
                battle.activeMines.delete(id);
                removed = true;
            }
        }
        if (removed) battle.broadcast(new RemoveMinesPacket(ownerNickname));
    }

    private _detonate(battle: Battle, id: string, victimClient: GameClient): void {
        const mine = battle.activeMines.get(id);
        if (!mine || !victimClient.user) return;
        battle.timers.clear(`mineArm:${id}`);
        battle.activeMines.delete(id);
        // Explosion: the client plays it and removes the mine. Only the tank that stepped on it takes
        // damage (no area damage), credited to the mine owner so a kill scores for them (falls back to
        // the victim as shooter if the owner is gone, so the death still registers).
        battle.broadcast(new DetonateMinePacket(id, victimClient.user.username));
        const shooter = this.server.findClientByUsername(mine.owner) ?? victimClient;
        void this.combat.applyDamage(battle, shooter, victimClient, MINE_DAMAGE);
        logger.info(`Mine ${id} (${mine.owner}) detonated on ${victimClient.user.username} in battle ${battle.battleId}`);
    }

    /** A tank that should trigger `mine`: not the owner, and (team modes) on the opposing team. */
    private _isEnemy(battle: Battle, client: GameClient, owner: string, ownerTeam: number): boolean {
        if (client.user!.username === owner) return false;
        if (battle.settings.battleMode === BattleMode.DM) return true; // everyone is an enemy in DM
        return battle.teamOf(client.user!) !== ownerTeam;
    }
}
