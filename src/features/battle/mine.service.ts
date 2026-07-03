import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import logger from "@/utils/logger";
import { Battle, BattleMode } from "./battle.model";
import { BattleEvents } from "./battle-events";
import { CombatService } from "./combat.service";
import { ActivateMinePacket, DetonateMinePacket, PutMinePacket, RemoveMinesPacket } from "./battle.packets";

const MINE_ARM_DELAY_MS = 1000; // a placed mine becomes armed (able to trigger) this long after placement
// A mine fires when a tank is physically ON it (its hull covers the mine), NOT by proximity/chain. Derived
// from an official capture (2026-06-23 s1): a stationary tank simultaneously set off two mines 290 units
// apart, i.e. its footprint reached ~145 units from centre to each. The old 250 fired ~100 units before the
// hull actually touched the mine ("explodes before you drive over it"). Centre-to-centre distance in world units.
const MINE_TRIGGER_RADIUS = 150;
// Mine damage is a flat RANDOM real-HP range (like every other weapon), NOT a % of health — so heavy hulls
// tank far more mines than light ones. Derived from official captures (2026-06-23 s1 log) by converting the
// normalised health drops back to real HP with each victim's HULL_ARMOR: Flu (wasp_m3, armor 180) took 89 &
// 70 HP; testosterone (hornet_m3, armor 210) took 70 & 87 HP → a ~70-90 HP roll. (The old flat 800 one-shot
// light hulls — that was the bug.) Rolled per detonation.
const MINE_DAMAGE_MIN = 70;
const MINE_DAMAGE_MAX = 90;

/**
 * Battle mines: a player drops an invisible mine (Mine supply); it detonates when an enemy gets close,
 * dealing splash damage. Place/activate/remove are broadcast to the whole battle (the client hides
 * enemies' mines until they activate). Constructed with the server + CombatService for the explosion.
 */
export class MineService {
    constructor(private readonly server: GameServer, private readonly combat: CombatService, events: BattleEvents) {
        // When a tank is destroyed (any cause), its mines are deactivated/removed.
        events.on("tankDestroyed", ({ battle, client }) => {
            if (client.user) this.removeMinesOf(battle, client.user.username);
        });
        // On round restart, wipe every mine — the client clears its visuals, so leftover server-side
        // mines would keep detonating invisibly on the new round.
        events.on("roundRestarted", ({ battle }) => this.clearAll(battle));
    }

    /** Removes every mine in the battle (e.g. on round restart). */
    public clearAll(battle: Battle): void {
        const owners = new Set<string>();
        for (const [id, mine] of battle.activeMines) {
            battle.timers.clear(`mineArm:${id}`);
            owners.add(mine.owner);
        }
        battle.activeMines.clear();
        for (const owner of owners) battle.broadcast(new RemoveMinesPacket(owner));
    }

    /** Drops a mine at the caller's current position (Mine supply activation). */
    public placeMine(client: GameClient, battle: Battle): void {
        const user = client.user;
        const pos = client.battlePosition;
        if (!user || !pos || client.battleState !== "active" || battle.settings.withoutMines) return;

        const id = `${++battle.mineCounter}`;
        battle.activeMines.set(id, { id, owner: user.username, ownerTeam: battle.teamOf(user), position: { ...pos }, armed: false });
        battle.broadcast(new PutMinePacket(id, pos, user.username));
        // A placed mine always arms after the same short delay — parkour included. Parkour's ONLY mine
        // difference is the reactivation cooldown (0 in parkour, so you can drop another immediately); it
        // does NOT arm instantly. Arming instantly let a freshly-dropped mine trigger before it settled.
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

        // HOIST all Mongoose access OUT of the per-mine loop. `user.username` and `battle.teamOf(user)` go
        // through Mongoose getters/virtuals — and the `.id` virtual inside teamOf allocates a hex string per
        // call. Doing them per mine turned a big minefield into O(mines) Mongoose calls on EVERY movement
        // packet, which pinned a CPU core (profiled: ~77% of CPU under checkTriggers → idGetter/Document.get/
        // slice). mine.owner/mine.ownerTeam are already plain values, so the in-loop test needs no document.
        const myName = user.username;
        const isDM = battle.settings.battleMode === BattleMode.DM;
        const myTeam = isDM ? -1 : battle.teamOf(user);
        const px = battlePosition.x, py = battlePosition.y, pz = battlePosition.z;
        const r2 = MINE_TRIGGER_RADIUS * MINE_TRIGGER_RADIUS;

        for (const mine of battle.activeMines.values()) {
            if (!mine.armed) continue;
            if (mine.owner === myName) continue;              // your own mine never triggers on you
            if (!isDM && mine.ownerTeam === myTeam) continue; // a teammate's mine (team modes)
            const dx = mine.position.x - px;
            const dy = mine.position.y - py;
            const dz = mine.position.z - pz;
            if (dx * dx + dy * dy + dz * dz <= r2) {
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
        // Flat random real-HP roll (see constants) — applyDamage normalises it per the victim's hull.
        const damage = MINE_DAMAGE_MIN + Math.random() * (MINE_DAMAGE_MAX - MINE_DAMAGE_MIN);
        // sourceWeapon=null: mine damage isn't a turret hit, so no paint resistance applies (there's no
        // MINE_RESISTANCE). Without this it would wrongly use the owner's currently-equipped turret.
        void this.combat.applyDamage(battle, shooter, victimClient, damage, 0, null);
        logger.info(`Mine ${id} (${mine.owner}) detonated on ${victimClient.user.username} in battle ${battle.battleId}`);
    }

}
