import { hullCollision } from "@/generated/hullCollision";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IVector3 } from "@/shared/types/geom/ivector3";
import logger from "@/utils/logger";
import { BattleEvents } from "./battle-events";
import { Battle, BattleMode } from "./battle.model";
import { ActivateMinePacket, DetonateMinePacket, PutMinePacket, RemoveMinesPacket } from "./battle.packets";
import { CollisionService } from "./collision.service";
import { CombatService } from "./combat.service";

const MINE_ARM_DELAY_MS = 1000; // a placed mine becomes armed (able to trigger) this long after placement
// Server-side floor between two mine placements by the same player. Parkour has NO reactivation cooldown
// (that's its whole mine difference), so a hacked/lagged client could machine-gun mines; any placement
// packet arriving sooner than this after the last EXECUTED one is silently dropped. The clock only
// advances on execution: e.g. drops at 0/50/80ms → the 0ms and 80ms ones place, the middle two don't.
const MINE_PLACE_MIN_INTERVAL_MS = 80;
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
// Altura de repouso por carroceria: quão acima do chão fica a ORIGEM (battlePosition.z) de um tanque PARADO
// em terreno plano. Medida em jogo com /pos (campo "repouso"). Como a mina é guardada NO CHÃO (ver
// _snapToGround), a origem do tanque que passa por cima fica ~esse tanto acima dela; a janela vertical do
// gatilho estende esse valor pra BAIXO para pegar a mina no chão. Por carroceria = preciso e o mais APERTADO
// possível (hull pequeno → janela menor → não pega mina de bordas baixas). XT compartilha a geometria/física
// da base. Hulls sem entrada usam RIDE_HEIGHT_DEFAULT. Manter pequeno (≠ o DOWN=600 da bandeira) evita que um
// tanque numa borda acima dispare a mina lá embaixo.
const RIDE_HEIGHT_DEFAULT = 90; // placeholder p/ hull sem entrada (~mediana dos medidos; passa ereto E capotado)
// Repouso medido em jogo (/pos, chão plano, parado). É a distância entre o chão (onde a mina fica) e o
// battlePosition do tanque (~centro do casco). NÃO deriva limpo de zMax/2 — por isso a tabela medida.
const HULL_RIDE_HEIGHT: Record<string, number> = {
    wasp: 89,
    viking: 77,
    mammoth: 96,
    dictator: 114,
    hornet: 82,
    // TODO medir: hunter, titan (usam RIDE_HEIGHT_DEFAULT até lá).
};
/** Altura de repouso da carroceria (com fallback base sem _xt e depois o default). */
function rideHeightFor(hullId: string): number {
    return HULL_RIDE_HEIGHT[hullId] ?? HULL_RIDE_HEIGHT[hullId.replace(/_xt$/, "")] ?? RIDE_HEIGHT_DEFAULT;
}
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
        for (const owner of owners) battle.broadcast(new RemoveMinesPacket({ owner }));
    }

    /** Drops a mine at the caller's current position (Mine supply activation). Placements arriving
     *  sooner than MINE_PLACE_MIN_INTERVAL_MS after the last successful one are dropped (anti-spam —
     *  matters in parkour, whose reactivation cooldown is 0). The staff /mine scatter goes through
     *  placeMineAt directly and is not throttled. */
    public placeMine(client: GameClient, battle: Battle): string | null {
        const pos = client.battlePosition;
        if (!pos) return null;
        const now = Date.now();
        if (now - client.lastMinePlacedAt < MINE_PLACE_MIN_INTERVAL_MS) return null; // too soon — packet discarded
        const id = this.placeMineAt(client, battle, pos);
        if (id) {
            client.lastMinePlacedAt = now; // only an EXECUTED placement advances the throttle clock
            logger.info(`Mine ${id} placed by ${client.user?.username} in battle ${battle.battleId}`);
        }
        return id;
    }

    /** Places a mine at an explicit world position, owned by `client`'s user, and returns its id (or null if
     *  it can't be placed). Shared by placeMine (own position) and the debug "mine around me" command. */
    public placeMineAt(client: GameClient, battle: Battle, position: IVector3, snap: boolean = true): string | null {
        const user = client.user;
        if (!user || client.battleState !== "active" || battle.settings.withoutMines) return null;
        const id = `${++battle.mineCounter}`;
        // `snap=false` (debug /mineup): guarda a posição CRUA, sem re-basear no chão — para observar se o
        // CLIENTE assenta a mina no chão (ignorando o Z do pacote) ou a mostra flutuando no Z enviado.
        const pos = snap ? this._snapToGround(client, battle, position) : { ...position };
        battle.activeMines.set(id, { id, owner: user.username, ownerTeam: battle.teamOf(user), position: pos, armed: false });
        battle.broadcast(new PutMinePacket({ id, position: pos, owner: user.username }));
        // A placed mine always arms after the same short delay — parkour included. Parkour's ONLY mine
        // difference is the reactivation cooldown (0 in parkour, so you can drop another immediately); it
        // does NOT arm instantly. Arming instantly let a freshly-dropped mine trigger before it settled.
        battle.timers.set(`mineArm:${id}`, MINE_ARM_DELAY_MS, () => this._arm(battle, id));
        return id;
    }

    /** Assenta a mina no CHÃO sob seu (x,y) — exatamente como o servidor faz com a bandeira (CtfService.
     *  dropFlag) e como o CLIENTE renderiza a mina (o cliente faz o próprio raycast do chão e IGNORA o z do
     *  pacote — ver [[client-mine-rendering]]). Guardar no chão faz a colisão do servidor bater com o visual
     *  do cliente; a altura do TANQUE que passa por cima (~RIDE_HEIGHT acima do chão) é compensada na janela
     *  vertical do gatilho (checkTriggers). Antes usávamos a altura do placer, que virava a altura do PULO ao
     *  soltar no ar e flutuava a mina lá em cima. Sobre o vazio (sem chão) mantém a posição dada. */
    private _snapToGround(_client: GameClient, battle: Battle, position: IVector3): IVector3 {
        const groundZ = this.collision.raycastGroundZ(battle.mapResourceId, position.x, position.y, position.z);
        if (groundZ === null) return { ...position };
        return { x: position.x, y: position.y, z: groundZ };
    }

    private _arm(battle: Battle, id: string): void {
        const mine = battle.activeMines.get(id);
        if (!mine) return;
        mine.armed = true;
        battle.broadcast(new ActivateMinePacket({ id }));
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
        const rideHeight = rideHeightFor(user.equippedHull); // hoisted: altura de repouso da carroceria (janela vertical)
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
            // Vertical: caixa do casco RELATIVA ao battlePosition (a origem do corpo rígido — confirmado no
            // cliente decompilado: TankBody aplica a posição 1:1 na origem, um ponto FIXO no casco). A mina
            // fica no chão (ver _snapToGround), ~rideHeight abaixo da origem; o topo do casco fica em
            // zMax−rideHeight. Como a caixa está ancorada na origem, uma janela ÚNICA basta — a rotação já
            // embutida em localZ resolve ereto/inclinado/capotado, sem ramo especial (a margem MINE_HEIGHT
            // cobre o capotado: zMax ≤ 2·rideHeight+MINE_HEIGHT em todos os hulls). Um tanque numa borda ACIMA
            // da mina mapeia para um localZ bem abaixo de zLow e é ignorado — é o que impede a mina de baixo
            // de pegar quem está em cima.
            const zLow = hull.zMin - rideHeight - MINE_HEIGHT;
            const zHigh = hull.zMax - rideHeight + MINE_HEIGHT;
            if (localZ < zLow || localZ > zHigh) continue;
            // Line-of-sight: the box alone can't tell "physically ON the mine" from "separated by thin
            // geometry" (a floor slab, a low wall the hull overhangs). If any collision surface lies
            // BETWEEN the mine and the tank centre, they aren't touching — skip. isBlockedBetween trims
            // both ends so the ground the mine/tank rest on doesn't count (same LOS the thunder splash
            // uses). Cheap here: it only runs for the rare candidate that already passed the box test.
            if (this.collision.isBlockedBetween(battle.mapResourceId, mine.position, battlePosition)) continue;
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
        if (removed) battle.broadcast(new RemoveMinesPacket({ owner: ownerNickname }));
    }

    private _detonate(battle: Battle, id: string, victimClient: GameClient): void {
        const mine = battle.activeMines.get(id);
        if (!mine || !victimClient.user) return;
        battle.timers.clear(`mineArm:${id}`);
        battle.activeMines.delete(id);
        // Explosion: the client plays it and removes the mine. Only the tank that stepped on it takes
        // damage (no area damage), credited to the mine owner so a kill scores for them (falls back to
        // the victim as shooter if the owner is gone, so the death still registers).
        battle.broadcast(new DetonateMinePacket({ id, victim: victimClient.user.username }));
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
