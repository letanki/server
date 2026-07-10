import { BasePacket } from "@/packets/base.packet";
import { readSchema, writeSchema } from "@/packets/packet-schema";
import { packetClass } from "@/packets/packet-class";
import { defs, encodeBody, compileCodec } from "protanki-protocol";
import * as BattleTypes from "./battle.types";

// IDs e schemas em `protanki-protocol` (defs.battle.*). Os HOT PATH (movimento) e os
// S->C de write customizado (listas) mantêm o codec manual verbatim; só id/schema apontam
// para a lib.

export const ActivateTankPacket = packetClass(defs.battle.ActivateTank);
export type ActivateTankPacket = InstanceType<typeof ActivateTankPacket>;

// C->S: the player activated a supply (consumable). Body is just the supply id (e.g. "n2o").
export class ActivateSupplyCommandPacket extends BasePacket {
    static readonly codec = compileCodec(defs.battle.ActivateSupplyCommand.schema!);
    itemId: string | null = null;
    // HOT PATH — hand-written monomorphic read (received on every supply activation; mine-spam macros fire
    // this hundreds of times/second). Byte-identical to `schema`.
    read(buffer: Buffer): void { ActivateSupplyCommandPacket.codec.read(buffer, this); }
    write(): Buffer { return ActivateSupplyCommandPacket.codec.write(this); }
    static getId(): number { return defs.battle.ActivateSupplyCommand.id; }
}

// S->C (to the activating client): confirms the activation so the client greys out the slot for
// `cooldownMs` (effectTime + restSec) and decrements the count. `flag` is 1 in every observed case.
export class ActivatedSupplyPacket extends BasePacket {
    static readonly codec = compileCodec(defs.battle.ActivatedSupply.schema!);
    itemId: string | null; cooldownMs: number; flag: number;
    constructor(itemId: string | null = null, cooldownMs: number = 0, flag: number = 1) { super(); this.itemId = itemId; this.cooldownMs = cooldownMs; this.flag = flag; }
    read(buffer: Buffer): void { ActivatedSupplyPacket.codec.read(buffer, this); }
    // HOT PATH — hand-written monomorphic write (sent back to the miner on every activation). Byte-identical to `schema`.
    write(): Buffer { return ActivatedSupplyPacket.codec.write(this); }
    static getId(): number { return defs.battle.ActivatedSupply.id; }
}

// S->C: updates a single consumable's count in the in-battle supply panel after a garage purchase
// (e.g. bought more mines mid-battle). Body = optionalString(base supply id, e.g. "mine") + i32(new
// total count).
export const UpdateConsumableCountPacket = packetClass(defs.battle.UpdateConsumableCount);
export type UpdateConsumableCountPacket = InstanceType<typeof UpdateConsumableCountPacket>;

// S->C (broadcast): a supply effect started on a tank, so every client renders it. `effectType`
// is the supply slotId (armor=2, double_damage=3, n2o=4, mine=5), `durationMs` is effectTime*1000.
export const EffectStartedPacket = packetClass(defs.battle.EffectStarted);
export type EffectStartedPacket = InstanceType<typeof EffectStartedPacket>;

// S->C (broadcast): a supply effect ended on a tank, so every client removes its visual. Sent at
// the end of the effect duration, right before the spec is reverted (for movement effects).
export const EffectStoppedPacket = packetClass(defs.battle.EffectStopped);
export type EffectStoppedPacket = InstanceType<typeof EffectStoppedPacket>;

export const ConfirmDestructionPacket = packetClass(defs.battle.ConfirmDestruction);
export type ConfirmDestructionPacket = InstanceType<typeof ConfirmDestructionPacket>;

// S->C (broadcast): floating damage number on a tank. count is always 1 here. damageType drives the
// number's colour in the client: 0 = normal (white), 1 = critical (yellow), 2 = fatal/kill (red),
// 3 = heal (green).
export class DamageIndicatorPacket extends BasePacket {
    static readonly schema = defs.battle.DamageIndicator.schema!;
    count: number; damage: number; damageType: number; target: string | null;
    constructor(target: string | null = null, damage: number = 0, damageType: number = 0) { super(); this.count = 1; this.damage = damage; this.damageType = damageType; this.target = target; }
    read(buffer: Buffer): void { readSchema(this, DamageIndicatorPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, DamageIndicatorPacket.schema); }
    static getId(): number { return defs.battle.DamageIndicator.id; }
}

// S->C (broadcast): a tank was killed — victim, killer, and respawn delay (ms).
export const KillPacket = packetClass(defs.battle.Kill);
export type KillPacket = InstanceType<typeof KillPacket>;

export const DestroyTankPacket = packetClass(defs.battle.DestroyTank);
export type DestroyTankPacket = InstanceType<typeof DestroyTankPacket>;

export class FullMoveCommandPacket extends BasePacket implements BattleTypes.IFullMoveCommand {
    static readonly codec = compileCodec(defs.battle.FullMoveCommand.schema!);
    clientTime: number = 0; incarnation: number = 0; angularVelocity: BattleTypes.IVector3 | null = null; control: number = 0; linearVelocity: BattleTypes.IVector3 | null = null; orientation: BattleTypes.IVector3 | null = null; position: BattleTypes.IVector3 | null = null; direction: number = 0;
    // HOT PATH — hand-written monomorphic read (received on every movement tick from every client). The
    // generic readSchema shares one megamorphic property site across all packet types; this doesn't. Must
    // stay byte-identical to `schema` above.
    read(buffer: Buffer): void { FullMoveCommandPacket.codec.read(buffer, this); }
    write(): Buffer { return FullMoveCommandPacket.codec.write(this); }
    static getId(): number { return defs.battle.FullMoveCommand.id; }
}

export class FullMovePacket extends BasePacket implements BattleTypes.IFullMovePacket {
    static readonly codec = compileCodec(defs.battle.FullMove.schema!);
    nickname: string | null; angularVelocity: BattleTypes.IVector3 | null; control: number; linearVelocity: BattleTypes.IVector3 | null; orientation: BattleTypes.IVector3 | null; position: BattleTypes.IVector3 | null; direction: number;
    constructor(data: BattleTypes.IFullMovePacketData) { super(); this.nickname = data.nickname; this.angularVelocity = data.angularVelocity; this.control = data.control; this.linearVelocity = data.linearVelocity; this.orientation = data.orientation; this.position = data.position; this.direction = data.direction; }
    read(buffer: Buffer): void { FullMovePacket.codec.read(buffer, this); }
    // HOT PATH — hand-written monomorphic write (broadcast to every client on every movement tick). Must
    // stay byte-identical to `schema` above.
    write(): Buffer { return FullMovePacket.codec.write(this); }
    static getId(): number { return defs.battle.FullMove.id; }
}

export class MoveCommandPacket extends BasePacket implements BattleTypes.IMoveCommand {
    static readonly codec = compileCodec(defs.battle.MoveCommand.schema!);
    clientTime: number = 0; incarnation: number = 0; angularVelocity: BattleTypes.IVector3 | null = null; control: number = 0; linearVelocity: BattleTypes.IVector3 | null = null; orientation: BattleTypes.IVector3 | null = null; position: BattleTypes.IVector3 | null = null;
    // HOT PATH — hand-written monomorphic read (see FullMoveCommandPacket). Byte-identical to `schema`.
    read(buffer: Buffer): void { MoveCommandPacket.codec.read(buffer, this); }
    write(): Buffer { return MoveCommandPacket.codec.write(this); }
    static getId(): number { return defs.battle.MoveCommand.id; }
}

export class MovePacket extends BasePacket implements BattleTypes.IMovePacket {
    static readonly codec = compileCodec(defs.battle.Move.schema!);
    nickname: string | null = null; angularVelocity: BattleTypes.IVector3 | null = null; control: number = 0; linearVelocity: BattleTypes.IVector3 | null = null; orientation: BattleTypes.IVector3 | null = null; position: BattleTypes.IVector3 | null = null;
    // Explicit field assignment (not Object.assign) so every instance shares one hidden class — keeps the
    // hot write() below monomorphic and avoids Object.assign's per-relay hasOwnProperty scan.
    constructor(data: BattleTypes.IMovePacketData) { super(); this.nickname = data.nickname; this.angularVelocity = data.angularVelocity; this.control = data.control; this.linearVelocity = data.linearVelocity; this.orientation = data.orientation; this.position = data.position; }
    read(buffer: Buffer): void { MovePacket.codec.read(buffer, this); }
    // HOT PATH — hand-written monomorphic write (broadcast every movement tick). Byte-identical to `schema`.
    write(): Buffer { return MovePacket.codec.write(this); }
    static getId(): number { return defs.battle.Move.id; }
}

// C->S: the tank's input/control state (pressed-keys bitmask). Other clients simulate the
// tank's physics from this; without relaying it (especially the key-release), remote tanks
// keep moving/spinning. `control` is the bitmask; the other two are client timing fields.
export const MovementControlCommandPacket = packetClass(defs.battle.MovementControlCommand);
export type MovementControlCommandPacket = InstanceType<typeof MovementControlCommandPacket>;

// S->C: relays a tank's control state to the other players in the battle.
export const MovementControlPacket = packetClass(defs.battle.MovementControl);
export type MovementControlPacket = InstanceType<typeof MovementControlPacket>;

export const PrepareToSpawnPacket = packetClass(defs.battle.PrepareToSpawn);
export type PrepareToSpawnPacket = InstanceType<typeof PrepareToSpawnPacket>;

export class ReadyToActivatePacket extends BasePacket implements BattleTypes.IReadyToActivate {
    read(buffer: Buffer): void { }
    write(): Buffer { return writeSchema(this, defs.battle.ReadyToActivate.schema!); }
    static getId(): number { return defs.battle.ReadyToActivate.id; }
}

export class ReadyToPlacePacket extends BasePacket implements BattleTypes.IReadyToPlace {
    read(buffer: Buffer): void { }
    write(): Buffer { return writeSchema(this, defs.battle.ReadyToPlace.schema!); }
    static getId(): number { return defs.battle.ReadyToPlace.id; }
}

export class ReadyToSpawnPacket extends BasePacket implements BattleTypes.IReadyToSpawn {
    read(buffer: Buffer): void { }
    write(): Buffer { return writeSchema(this, defs.battle.ReadyToSpawn.schema!); }
    static getId(): number { return defs.battle.ReadyToSpawn.id; }
}

// C->S: the client signals it left the "pause" state (resuming / spawning). Empty body, fire-and-
// forget — the reference server sends no reply (verified against capture 2026-06-18_07-43). Handled
// as a no-op just so it isn't logged as an unknown packet.
export class DisablePausePacket extends BasePacket {
    read(buffer: Buffer): void { }
    write(): Buffer { return writeSchema(this, defs.battle.DisablePause.schema!); }
    static getId(): number { return defs.battle.DisablePause.id; }
}

export const RemoveTankPacket = packetClass(defs.battle.RemoveTank);
export type RemoveTankPacket = InstanceType<typeof RemoveTankPacket>;

export const RotateTurretCommandPacket = packetClass(defs.battle.RotateTurretCommand);
export type RotateTurretCommandPacket = InstanceType<typeof RotateTurretCommandPacket>;

export const TurretRotationPacket = packetClass(defs.battle.TurretRotation);
export type TurretRotationPacket = InstanceType<typeof TurretRotationPacket>;

// C->S: the continuous turret-direction stream (bare angle, no control). The client sends this every
// frame while the turret turns, IN ADDITION to the discrete RotateTurretCommand (start/stop). Without
// relaying it, remote turrets only update on the sparse control commands → jerky/stuck aim on others.
export const TurretDirectionCommandPacket = packetClass(defs.battle.TurretDirectionCommand);
export type TurretDirectionCommandPacket = InstanceType<typeof TurretDirectionCommandPacket>;

// S->C: relays the continuous turret direction to the other players (nickname + angle). Pairs with
// TurretDirectionCommandPacket, exactly like TurretRotationPacket pairs with RotateTurretCommandPacket.
export const TurretDirectionPacket = packetClass(defs.battle.TurretDirection);
export type TurretDirectionPacket = InstanceType<typeof TurretDirectionPacket>;

export const SelfDestructScheduledPacket = packetClass(defs.battle.SelfDestructScheduled);
export type SelfDestructScheduledPacket = InstanceType<typeof SelfDestructScheduledPacket>;

export class SetHealthPacket extends BasePacket implements BattleTypes.ISetHealth {
    static readonly schema = defs.battle.SetHealth.schema!;
    nickname: string | null; health: number;
    constructor(data?: BattleTypes.ISetHealthData) { super(); this.nickname = data?.nickname ?? null; this.health = data?.health ?? 0; }
    read(buffer: Buffer): void { readSchema(this, SetHealthPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, SetHealthPacket.schema); }
    static getId(): number { return defs.battle.SetHealth.id; }
}

/**
 * S->C (broadcast): a tank's "temperature" — drives the client's heat/cold tint AND its frozen slowdown.
 * Positive = heat (Firebird's red burning glow), negative = cold (Freeze's blue tint), 0 = normal. Body =
 * nickname(optString) + temperature(f32). Generic tank state shared by the fire/ice weapons.
 */
export class TankTemperaturePacket extends BasePacket {
    constructor(private readonly nickname: string | null = null, private readonly temperature: number = 0) { super(); }
    read(_buffer: Buffer): void {}
    write(): Buffer { return writeSchema(this, defs.battle.TankTemperature.schema!); }
    static getId(): number { return defs.battle.TankTemperature.id; }
}

export class SpawnPacket extends BasePacket implements BattleTypes.ISpawn {
    static readonly schema = defs.battle.Spawn.schema!;
    nickname: string | null; team: number; position: BattleTypes.IVector3 | null; orientation: BattleTypes.IVector3 | null; health: number; incarnation: number;
    constructor(data?: BattleTypes.ISpawnData) { super(); this.nickname = data?.nickname ?? null; this.team = data?.team ?? 2; this.position = data?.position ?? null; this.orientation = data?.orientation ?? null; this.health = data?.health ?? 0; this.incarnation = data?.incarnation ?? 0; }
    read(buffer: Buffer): void { readSchema(this, SpawnPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, SpawnPacket.schema); }
    static getId(): number { return defs.battle.Spawn.id; }
}

export class SuicidePacket extends BasePacket implements BattleTypes.ISuicidePacket {
    read(buffer: Buffer): void { }
    write(): Buffer { return writeSchema(this, defs.battle.Suicide.schema!); }
    static getId(): number { return defs.battle.Suicide.id; }
}

// --- Round lifecycle (decoded from log 2026-06-19_02-28) ---

// S->C: set the round time remaining, in seconds. Sent at round start and restart.
export class SetRoundTimePacket extends BasePacket {
    constructor(private readonly seconds: number = 0) { super(); }
    read(buffer: Buffer): void { throw new Error("This is a server-to-client packet only."); }
    write(): Buffer { return writeSchema(this, defs.battle.SetRoundTime.schema!); }
    static getId(): number { return defs.battle.SetRoundTime.id; }
}

// (Team score = the existing SetCtfScorePacket, id 561771020 — reused on restart to reset to 0.)

// S->C: the battle fund (crystal pool shown in the stats panel). Single i32 = the new TOTAL fund
// (cumulative, not a delta), per the decompiled client (battle-stats handler case 1149211509 ->
// statsPanel.setFund(int)). Sent whenever the fund grows; resets to 0 on round restart.
export class ChangeFundPacket extends BasePacket {
    constructor(private readonly fund: number = 0) { super(); }
    read(buffer: Buffer): void { throw new Error("This is a server-to-client packet only."); }
    write(): Buffer { return writeSchema(this, defs.battle.ChangeFund.schema!); }
    static getId(): number { return defs.battle.ChangeFund.id; }
}

export interface IFinishBattleReward {
    nickname: string | null;
    /** Crystals awarded to this player from the battle fund (shown on the results screen). */
    reward: number;
}

// S->C: round finished. Per the client model (decompiled): a Vector<reward> + an int "break
// package in". Each reward entry = [i32 newbieAbonementBonus, i32 premiumBonus, i32 reward, optString
// nick] (the per-user crystal reward breakdown). The trailing int is the break/results-pause duration
// in seconds. Wire = i32 count + count×entry + i32 breakSeconds.
export class FinishBattlePacket extends BasePacket {
    constructor(private readonly rewards: IFinishBattleReward[] = [], private readonly breakSeconds: number = 10) { super(); }
    read(buffer: Buffer): void { throw new Error("This is a server-to-client packet only."); }
    write(): Buffer {
        return encodeBody(defs.battle.FinishBattle, {
            rewards: this.rewards.map((r) => ({ newbieBonus: 0, premiumBonus: 0, reward: r.reward, nickname: r.nickname })),
            breakSeconds: this.breakSeconds,
        });
    }
    static getId(): number { return defs.battle.FinishBattle.id; }
}

// S->C: rebuild the battle scoreboard rosters on round restart (this is what reassigns players to
// their new team in the Tab list). Per the client model: two Vector<entry> (field0 = RED, field1 =
// BLUE). Each entry = [i32, i32, optString nick] (stats, 0 on a fresh round). Verified vs log.
export class RestartRoundTeamPacket extends BasePacket {
    constructor(private readonly red: (string | null)[] = [], private readonly blue: (string | null)[] = []) { super(); }
    read(buffer: Buffer): void { throw new Error("This is a server-to-client packet only."); }
    write(): Buffer {
        const entry = (nickname: string | null) => ({ stat1: 0, stat2: 0, nickname });
        return encodeBody(defs.battle.RestartRoundTeam, {
            red: this.red.map(entry),
            blue: this.blue.map(entry),
        });
    }
    static getId(): number { return defs.battle.RestartRoundTeam.id; }
}

// S->C: DM variant — one Vector<entry> (the full roster) rebuilt on round restart.
export class RestartRoundDmPacket extends BasePacket {
    constructor(private readonly users: (string | null)[] = []) { super(); }
    read(buffer: Buffer): void { throw new Error("This is a server-to-client packet only."); }
    write(): Buffer {
        return encodeBody(defs.battle.RestartRoundDm, {
            users: this.users.map((nickname) => ({ stat1: 0, stat2: 0, nickname })),
        });
    }
    static getId(): number { return defs.battle.RestartRoundDm.id; }
}
