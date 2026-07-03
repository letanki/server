import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { hullCollision } from "@/generated/hullCollision";
import logger from "@/utils/logger";
import { Battle, BattleMode } from "./battle.model";
import { BattleEvents } from "./battle-events";
import { CombatService } from "./combat.service";
import { ActivateMinePacket, DetonateMinePacket, PutMinePacket, RemoveMinesPacket } from "./battle.packets";

const MINE_ARM_DELAY_MS = 1000; // a placed mine becomes armed (able to trigger) this long after placement
// A mine fires when a tank is physically ON it — its REAL hull collision box (per-hull, oriented by the tank
// yaw; the same boxes CtfService uses for flag pickup) covers the mine. A fixed centre-radius was wrong: a
// wasp's nose is 231 units from centre, so driving the tip onto a mine never got the centre close enough.
// MINE_FOOTPRINT = the mine object's own half-size (the .3ds disc, ~0.5 m ≈ 50 u) added to the hull box, so
// "touch" means the hull edge reaches the mine's edge.
const MINE_FOOTPRINT = 50;
const HULL_FALLBACK = { halfX: 165, halfY: 270, zMin: 0, zMax: 180 }; // unknown hull → mid-size box (matches CtfService)
// Mine damage = flat RANDOM real-HP roll, per the official wiki ("Mine — Damage to opponents 120-240 hp").
// Confirmed by a clean single-mine capture: Giovana's wasp (180 HP) was ONE-SHOT by a SINGLE mine (health
// 10000 → -888 / -1666 = ~196-210 HP dealt) — squarely in the 120-240 band. So a mine one-shots light hulls
// and takes 2-4 to kill heavy ones (mammoth 500 → ~24-48% each). applyDamage does the hull normalisation and
// halves it under Double Armour. (My earlier "% of health" reading came from multi-mine cluster drops in an
// older log — wrong.) Rolled per detonation.
const MINE_DAMAGE_MIN = 120;
const MINE_DAMAGE_MAX = 240;

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

        // HOIST all Mongoose access OUT of the per-mine loop. `user.username`, `user.equippedHull` and
        // `battle.teamOf(user)` go through Mongoose getters/virtuals (the `.id` virtual inside teamOf allocates
        // a hex string per call). Doing them per mine turned a big minefield into O(mines) Mongoose calls on
        // EVERY movement packet, which pinned a CPU core (profiled — see [[mongoose-hotloop-perf]]).
        const myName = user.username;
        const isDM = battle.settings.battleMode === BattleMode.DM;
        const myTeam = isDM ? -1 : battle.teamOf(user);
        // Oriented hull box: rotate each mine offset into the tank's local frame (yaw around z) and test the
        // real per-hull half-extents (+ the mine's footprint). This fires when ANY part of the hull is over
        // the mine — including just the nose — not only when the centre is close.
        const hull = hullCollision[user.equippedHull] ?? HULL_FALLBACK;
        const yaw = client.battleOrientation?.z ?? 0;
        const cos = Math.cos(yaw), sin = Math.sin(yaw);
        const reachX = hull.halfX + MINE_FOOTPRINT, reachY = hull.halfY + MINE_FOOTPRINT;
        const px = battlePosition.x, py = battlePosition.y, pz = battlePosition.z;

        for (const mine of battle.activeMines.values()) {
            if (!mine.armed) continue;
            if (mine.owner === myName) continue;              // your own mine never triggers on you
            if (!isDM && mine.ownerTeam === myTeam) continue; // a teammate's mine (team modes)
            const dx = mine.position.x - px;
            const dy = mine.position.y - py;
            const localX = dx * cos + dy * sin;   // along hull width  (model X)
            const localY = -dx * sin + dy * cos;  // along hull length (model Y)
            if (Math.abs(localX) >= reachX || Math.abs(localY) >= reachY) continue;
            // Height: the mine must be at roughly the tank's level (parkour is vertical — don't trigger a
            // mine one platform below/above). z span = the hull box, with the mine footprint as slack.
            const dz = mine.position.z - pz;
            if (dz < -MINE_FOOTPRINT || dz > hull.zMax + MINE_FOOTPRINT) continue;
            this._detonate(battle, mine.id, client);
            break;
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
        // Flat random real-HP roll (wiki 120-240) — applyDamage normalises it per the victim's hull and
        // halves it under Double Armour.
        const damage = MINE_DAMAGE_MIN + Math.random() * (MINE_DAMAGE_MAX - MINE_DAMAGE_MIN);
        // sourceWeapon=null: mine damage isn't a turret hit, so no paint resistance applies (there's no
        // MINE_RESISTANCE). Without this it would wrongly use the owner's currently-equipped turret.
        void this.combat.applyDamage(battle, shooter, victimClient, damage, 0, null);
        logger.info(`Mine ${id} (${mine.owner}) detonated on ${victimClient.user.username} in battle ${battle.battleId}`);
    }

}
