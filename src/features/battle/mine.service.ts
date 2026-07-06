import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { hullCollision } from "@/generated/hullCollision";
import { IVector3 } from "@/shared/types/geom/ivector3";
import logger from "@/utils/logger";
import { Battle, BattleMode } from "./battle.model";
import { BattleEvents } from "./battle-events";
import { CollisionService } from "./collision.service";
import { CombatService } from "./combat.service";
import { ActivateMinePacket, DetonateMinePacket, PutMinePacket, RemoveMinesPacket } from "./battle.packets";

const MINE_ARM_DELAY_MS = 1000; // a placed mine becomes armed (able to trigger) this long after placement
// A mine fires when a tank is physically ON it — its REAL hull collision box (per-hull, oriented by the tank
// yaw; the same boxes CtfService uses for flag pickup) covers the mine. A fixed centre-radius was wrong: a
// wasp's nose is 231 units from centre, so driving the tip onto a mine never got the centre close enough.
// MINE_FOOTPRINT = slack added to the hull box so "touch" means the hull edge reaches the mine's edge. Kept
// SMALL (tighter than the mine disc) on purpose: the tank must actually drive up ONTO the mine to set it off,
// not just graze near it. Raise it if mines feel unresponsive; lower it toward 0 to require more overlap.
const MINE_FOOTPRINT = 20;
// Vertical margin (world units) added to each end of the hull's z-extent [zMin, zMax] in the tank's LOCAL
// (tilted) frame — see checkTriggers. The mine is a flat floor object with no .3ds to measure, so this is a
// small estimated slack around the hull box. Because the test is done in the rotated frame, this stays tight
// without missing pitched/rolled hulls. Lower it if mines fire from too far above/below; raise it if flat-
// ground mines get missed.
const MINE_HEIGHT = 30;
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
    constructor(private readonly server: GameServer, private readonly combat: CombatService, private readonly collision: CollisionService, events: BattleEvents) {
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
        const pos = client.battlePosition;
        if (!pos) return;
        const id = this.placeMineAt(client, battle, pos);
        if (id) logger.info(`Mine ${id} placed by ${client.user?.username} in battle ${battle.battleId}`);
    }

    /** Places a mine at an explicit world position, owned by `client`'s user, and returns its id (or null if
     *  it can't be placed). Shared by placeMine (own position) and the debug "mine around me" command. */
    public placeMineAt(client: GameClient, battle: Battle, position: IVector3): string | null {
        const user = client.user;
        if (!user || client.battleState !== "active" || battle.settings.withoutMines) return null;
        const id = `${++battle.mineCounter}`;
        const pos = this._snapToGround(client, battle, position);
        battle.activeMines.set(id, { id, owner: user.username, ownerTeam: battle.teamOf(user), position: pos, armed: false });
        battle.broadcast(new PutMinePacket(id, pos, user.username));
        // A placed mine always arms after the same short delay — parkour included. Parkour's ONLY mine
        // difference is the reactivation cooldown (0 in parkour, so you can drop another immediately); it
        // does NOT arm instantly. Arming instantly let a freshly-dropped mine trigger before it settled.
        battle.timers.set(`mineArm:${id}`, MINE_ARM_DELAY_MS, () => this._arm(battle, id));
        return id;
    }

    /** Re-bases a placement onto the ground beneath its (x,y). A mine is stored at TANK-CENTRE height (that's
     *  what checkTriggers compares against a passing tank's battlePosition.z), so we take the ground under the
     *  mine and add the PLACER's own height above its ground. For a normal drop (mine at the placer's exact
     *  position) this reproduces the placer's z unchanged; for a mine dropped over lower/higher terrain — the
     *  /mine debug scatter, or a mine dropped mid-jump — it lands the mine at the height a tank driving there
     *  will actually have, instead of floating at the placer's flat z (which never matched, so it never fired).
     *  Over the void (no ground) the position is kept as given. */
    private _snapToGround(client: GameClient, battle: Battle, position: IVector3): IVector3 {
        const map = battle.mapResourceId;
        const groundAtMine = this.collision.raycastGroundZ(map, position.x, position.y, position.z);
        if (groundAtMine === null) return { ...position };
        const p = client.battlePosition;
        let offset = 0;
        if (p) {
            const groundAtPlacer = this.collision.raycastGroundZ(map, p.x, p.y, p.z);
            if (groundAtPlacer !== null) offset = p.z - groundAtPlacer;
        }
        return { x: position.x, y: position.y, z: groundAtMine + offset };
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
        // Full 3D ORIENTED hull box. A tank can pitch and roll (nose or tail down on ramps/jumps, tipped on
        // a slope), so a flat yaw-only footprint plus a world-space height check misses a mine the tilted
        // hull is visibly sitting on. Build the tank's local→world rotation from ALL THREE Euler angles
        // (Alternativa3D order Rz·Ry·Rx — x=pitch, y=roll, z=yaw; this reduces to the old yaw-only formula
        // when pitch=roll=0) and transform each mine offset into the hull's local frame with its transpose
        // (world→local), then test the real per-hull box + the mine footprint.
        const hull = hullCollision[user.equippedHull] ?? HULL_FALLBACK;
        const ori = client.battleOrientation;
        const rx = ori?.x ?? 0, ry = ori?.y ?? 0, rz = ori?.z ?? 0;
        const sinX = Math.sin(rx), cosX = Math.cos(rx);
        const sinY = Math.sin(ry), cosY = Math.cos(ry);
        const sinZ = Math.sin(rz), cosZ = Math.cos(rz);
        // Rows of local→world M; we dot the world offset against M's COLUMNS to get local coords (M^T·d).
        const ma = cosZ * cosY, mb = cosZ * sinY * sinX - sinZ * cosX, mc = cosZ * sinY * cosX + sinZ * sinX;
        const me = sinZ * cosY, mf = sinZ * sinY * sinX + cosZ * cosX, mg = sinZ * sinY * cosX - cosZ * sinX;
        const mi = -sinY,       mj = cosY * sinX,                      mk = cosY * cosX;
        const reachX = hull.halfX + MINE_FOOTPRINT, reachY = hull.halfY + MINE_FOOTPRINT;
        const px = battlePosition.x, py = battlePosition.y, pz = battlePosition.z;

        for (const mine of battle.activeMines.values()) {
            if (!mine.armed) continue;
            if (mine.owner === myName) continue;              // your own mine never triggers on you
            if (!isDM && mine.ownerTeam === myTeam) continue; // a teammate's mine (team modes)
            const dx = mine.position.x - px;
            const dy = mine.position.y - py;
            const dz = mine.position.z - pz;
            const localX = ma * dx + me * dy + mi * dz;   // across hull width  (model X)
            const localY = mb * dx + mf * dy + mj * dz;   // along hull length  (model Y)
            const localZ = mc * dx + mg * dy + mk * dz;   // up through the hull (model Z; 0 = belly/origin)
            if (Math.abs(localX) >= reachX || Math.abs(localY) >= reachY) continue;
            // Vertical: the hull box is ASYMMETRIC — it spans [zMin=0 (belly at the origin), zMax (top)],
            // i.e. only ABOVE the origin. `mk` (= cosY·cosX) is the world-up component of the hull's local
            // up axis: 1 = upright, 0 = on its side, −1 = upside down.
            // • Upright / on a ramp (mk ≥ 0.5): keep the tight belly→top window so a tank sitting ABOVE a
            //   floor mine (up on a ramp) maps to a large NEGATIVE localZ and is correctly ignored (the old
            //   "dies on the ramp without being on the ground" fix stays intact).
            // • CAPSIZED / heavily tilted (mk < 0.5): the tank rests on its side/roof, so relative to the
            //   belly-origin a mine it's physically sitting on can land BELOW zMin or ABOVE zMax (its top/
            //   turret side is what's on the ground). Widen the window symmetrically by the hull height so
            //   a flipped tank still sets mines off. The tight horizontal footprint still gates it.
            const upright = mk >= 0.5;
            const hullHeight = hull.zMax - hull.zMin;
            const zLow = upright ? hull.zMin - MINE_HEIGHT : hull.zMin - hullHeight - MINE_HEIGHT;
            const zHigh = upright ? hull.zMax + MINE_HEIGHT : hull.zMax + hullHeight + MINE_HEIGHT;
            if (localZ < zLow || localZ > zHigh) continue;
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
        // sourceWeapon=null: no paint resistance (mines aren't a turret hit). ignoreShooterBuffs=true: the
        // mine's damage is fixed at placement, so the owner's current Double Damage must not scale it.
        void this.combat.applyDamage(battle, shooter, victimClient, damage, 0, null, true);
        logger.info(`Mine ${id} (${mine.owner}) detonated on ${victimClient.user.username} in battle ${battle.battleId}`);
    }

}
