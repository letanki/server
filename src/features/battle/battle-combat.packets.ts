import { BasePacket } from "@/packets/base.packet";
import { PacketSchema, readSchema, writeSchema } from "@/packets/packet-schema";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import * as BattleTypes from "./battle.types";

export class ActivateTankPacket extends BasePacket {
    nickname: string | null;
    constructor(nickname: string | null = null) { super(); this.nickname = nickname; }
    read(buffer: Buffer): void { this.nickname = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.nickname).getBuffer(); }
    static getId(): number { return 1868573511; }
}

// C->S: the player activated a supply (consumable). Body is just the supply id (e.g. "n2o").
export class ActivateSupplyCommandPacket extends BasePacket {
    static readonly schema: PacketSchema = [{ name: "itemId", type: "string" }];
    itemId: string | null = null;
    read(buffer: Buffer): void { readSchema(this, ActivateSupplyCommandPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, ActivateSupplyCommandPacket.schema); }
    static getId(): number { return -2102525054; }
}

// S->C (to the activating client): confirms the activation so the client greys out the slot for
// `cooldownMs` (effectTime + restSec) and decrements the count. `flag` is 1 in every observed case.
export class ActivatedSupplyPacket extends BasePacket {
    static readonly schema: PacketSchema = [
        { name: "itemId", type: "string" },
        { name: "cooldownMs", type: "i32" },
        { name: "flag", type: "i8" },
    ];
    itemId: string | null; cooldownMs: number; flag: number;
    constructor(itemId: string | null = null, cooldownMs: number = 0, flag: number = 1) { super(); this.itemId = itemId; this.cooldownMs = cooldownMs; this.flag = flag; }
    read(buffer: Buffer): void { readSchema(this, ActivatedSupplyPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, ActivatedSupplyPacket.schema); }
    static getId(): number { return 2032104949; }
}

// S->C (broadcast): a supply effect started on a tank, so every client renders it. `effectType`
// is the supply slotId (armor=2, double_damage=3, n2o=4, mine=5), `durationMs` is effectTime*1000.
export class EffectStartedPacket extends BasePacket {
    static readonly schema: PacketSchema = [
        { name: "nickname", type: "string" },
        { name: "effectType", type: "i32" },
        { name: "durationMs", type: "i32" },
        { name: "unknown", type: "i16" },
    ];
    nickname: string | null; effectType: number; durationMs: number; unknown: number;
    constructor(nickname: string | null = null, effectType: number = 0, durationMs: number = 0, unknown: number = 0) { super(); this.nickname = nickname; this.effectType = effectType; this.durationMs = durationMs; this.unknown = unknown; }
    read(buffer: Buffer): void { readSchema(this, EffectStartedPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, EffectStartedPacket.schema); }
    static getId(): number { return -1639713644; }
}

// S->C (broadcast): a supply effect ended on a tank, so every client removes its visual. Sent at
// the end of the effect duration, right before the spec is reverted (for movement effects).
export class EffectStoppedPacket extends BasePacket {
    static readonly schema: PacketSchema = [
        { name: "nickname", type: "string" },
        { name: "effectType", type: "i32" },
    ];
    nickname: string | null; effectType: number;
    constructor(nickname: string | null = null, effectType: number = 0) { super(); this.nickname = nickname; this.effectType = effectType; }
    read(buffer: Buffer): void { readSchema(this, EffectStoppedPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, EffectStoppedPacket.schema); }
    static getId(): number { return -1994318624; }
}

export class ConfirmDestructionPacket extends BasePacket implements BattleTypes.IConfirmDestruction {
    static readonly schema: PacketSchema = [
        { name: "nickname", type: "string" },
        { name: "delaytoSpawn", type: "i32" },
    ];
    nickname: string | null; delaytoSpawn: number;
    constructor(nickname: string | null = null, delaytoSpawn: number = 0) { super(); this.nickname = nickname; this.delaytoSpawn = delaytoSpawn; }
    read(buffer: Buffer): void { readSchema(this, ConfirmDestructionPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, ConfirmDestructionPacket.schema); }
    static getId(): number { return -173682854; }
}

// S->C (broadcast): floating damage number on a tank. count is always 1 here; type 2 = normal hit.
export class DamageIndicatorPacket extends BasePacket {
    static readonly schema: PacketSchema = [
        { name: "count", type: "i32" },
        { name: "damage", type: "f32" },
        { name: "damageType", type: "i32" },
        { name: "target", type: "string" },
    ];
    count: number; damage: number; damageType: number; target: string | null;
    constructor(target: string | null = null, damage: number = 0, damageType: number = 2) { super(); this.count = 1; this.damage = damage; this.damageType = damageType; this.target = target; }
    read(buffer: Buffer): void { readSchema(this, DamageIndicatorPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, DamageIndicatorPacket.schema); }
    static getId(): number { return -1165230470; }
}

// S->C (broadcast): a tank was killed — victim, killer, and respawn delay (ms).
export class KillPacket extends BasePacket {
    static readonly schema: PacketSchema = [
        { name: "victim", type: "string" },
        { name: "killer", type: "string" },
        { name: "respawnDelayMs", type: "i32" },
    ];
    victim: string | null; killer: string | null; respawnDelayMs: number;
    constructor(victim: string | null = null, killer: string | null = null, respawnDelayMs: number = 3000) { super(); this.victim = victim; this.killer = killer; this.respawnDelayMs = respawnDelayMs; }
    read(buffer: Buffer): void { readSchema(this, KillPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, KillPacket.schema); }
    static getId(): number { return -42520728; }
}

export class DestroyTankPacket extends BasePacket implements BattleTypes.IDestroyTankPacket {
    static readonly schema: PacketSchema = [
        { name: "nickname", type: "string" },
        { name: "readyToSpawnInMs", type: "i32" },
    ];
    nickname: string | null; readyToSpawnInMs: number;
    constructor(nickname: string | null = null, readyToSpawnInMs: number = 0) { super(); this.nickname = nickname; this.readyToSpawnInMs = readyToSpawnInMs; }
    read(buffer: Buffer): void { readSchema(this, DestroyTankPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, DestroyTankPacket.schema); }
    static getId(): number { return 162656882; }
}

export class FullMoveCommandPacket extends BasePacket implements BattleTypes.IFullMoveCommand {
    static readonly schema: PacketSchema = [
        { name: "clientTime", type: "i32" },
        { name: "incarnation", type: "i16" },
        { name: "angularVelocity", type: "vector3" },
        { name: "control", type: "i8" },
        { name: "linearVelocity", type: "vector3" },
        { name: "orientation", type: "vector3" },
        { name: "position", type: "vector3" },
        { name: "direction", type: "f32" },
    ];
    clientTime: number = 0; incarnation: number = 0; angularVelocity: BattleTypes.IVector3 | null = null; control: number = 0; linearVelocity: BattleTypes.IVector3 | null = null; orientation: BattleTypes.IVector3 | null = null; position: BattleTypes.IVector3 | null = null; direction: number = 0;
    read(buffer: Buffer): void { readSchema(this, FullMoveCommandPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, FullMoveCommandPacket.schema); }
    static getId(): number { return -1683279062; }
}

export class FullMovePacket extends BasePacket implements BattleTypes.IFullMovePacket {
    static readonly schema: PacketSchema = [
        { name: "nickname", type: "string" },
        { name: "angularVelocity", type: "vector3" },
        { name: "control", type: "i8" },
        { name: "linearVelocity", type: "vector3" },
        { name: "orientation", type: "vector3" },
        { name: "position", type: "vector3" },
        { name: "direction", type: "f32" },
    ];
    nickname: string | null; angularVelocity: BattleTypes.IVector3 | null; control: number; linearVelocity: BattleTypes.IVector3 | null; orientation: BattleTypes.IVector3 | null; position: BattleTypes.IVector3 | null; direction: number;
    constructor(data: BattleTypes.IFullMovePacketData) { super(); this.nickname = data.nickname; this.angularVelocity = data.angularVelocity; this.control = data.control; this.linearVelocity = data.linearVelocity; this.orientation = data.orientation; this.position = data.position; this.direction = data.direction; }
    read(buffer: Buffer): void { readSchema(this, FullMovePacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, FullMovePacket.schema); }
    static getId(): number { return 1516578027; }
}

export class MoveCommandPacket extends BasePacket implements BattleTypes.IMoveCommand {
    static readonly schema: PacketSchema = [
        { name: "clientTime", type: "i32" },
        { name: "incarnation", type: "i16" },
        { name: "angularVelocity", type: "vector3" },
        { name: "control", type: "i8" },
        { name: "linearVelocity", type: "vector3" },
        { name: "orientation", type: "vector3" },
        { name: "position", type: "vector3" },
    ];
    clientTime: number = 0; incarnation: number = 0; angularVelocity: BattleTypes.IVector3 | null = null; control: number = 0; linearVelocity: BattleTypes.IVector3 | null = null; orientation: BattleTypes.IVector3 | null = null; position: BattleTypes.IVector3 | null = null;
    read(buffer: Buffer): void { readSchema(this, MoveCommandPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, MoveCommandPacket.schema); }
    static getId(): number { return 329279865; }
}

export class MovePacket extends BasePacket implements BattleTypes.IMovePacket {
    static readonly schema: PacketSchema = [
        { name: "nickname", type: "string" },
        { name: "angularVelocity", type: "vector3" },
        { name: "control", type: "i8" },
        { name: "linearVelocity", type: "vector3" },
        { name: "orientation", type: "vector3" },
        { name: "position", type: "vector3" },
    ];
    nickname: string | null = null; angularVelocity: BattleTypes.IVector3 | null = null; control: number = 0; linearVelocity: BattleTypes.IVector3 | null = null; orientation: BattleTypes.IVector3 | null = null; position: BattleTypes.IVector3 | null = null;
    constructor(data: BattleTypes.IMovePacketData) { super(); Object.assign(this, data); }
    read(buffer: Buffer): void { readSchema(this, MovePacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, MovePacket.schema); }
    static getId(): number { return -64696933; }
}

// C->S: the tank's input/control state (pressed-keys bitmask). Other clients simulate the
// tank's physics from this; without relaying it (especially the key-release), remote tanks
// keep moving/spinning. `control` is the bitmask; the other two are client timing fields.
export class MovementControlCommandPacket extends BasePacket {
    static readonly schema: PacketSchema = [
        { name: "throttleTime", type: "i32" },
        { name: "turnControl", type: "i16" },
        { name: "control", type: "i8" },
    ];
    throttleTime = 0; turnControl = 0; control = 0;
    read(buffer: Buffer): void { readSchema(this, MovementControlCommandPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, MovementControlCommandPacket.schema); }
    static getId(): number { return -1749108178; }
}

// S->C: relays a tank's control state to the other players in the battle.
export class MovementControlPacket extends BasePacket {
    static readonly schema: PacketSchema = [
        { name: "nickname", type: "string" },
        { name: "control", type: "i8" },
    ];
    nickname: string | null = null; control = 0;
    constructor(data?: Partial<MovementControlPacket>) { super(); if (data) Object.assign(this, data); }
    read(buffer: Buffer): void { readSchema(this, MovementControlPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, MovementControlPacket.schema); }
    static getId(): number { return -301298508; }
}

export class PrepareToSpawnPacket extends BasePacket implements BattleTypes.IPrepareToSpawn {
    static readonly schema: PacketSchema = [
        { name: "position", type: "vector3" },
        { name: "rotation", type: "vector3" },
    ];
    position: BattleTypes.IVector3 | null; rotation: BattleTypes.IVector3 | null;
    constructor(position: BattleTypes.IVector3 | null = null, rotation: BattleTypes.IVector3 | null = null) { super(); this.position = position; this.rotation = rotation; }
    read(buffer: Buffer): void { readSchema(this, PrepareToSpawnPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, PrepareToSpawnPacket.schema); }
    static getId(): number { return -157204477; }
}

export class ReadyToActivatePacket extends BasePacket implements BattleTypes.IReadyToActivate {
    read(buffer: Buffer): void { }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return 1178028365; }
}

export class ReadyToPlacePacket extends BasePacket implements BattleTypes.IReadyToPlace {
    read(buffer: Buffer): void { }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return -1378839846; }
}

export class ReadyToSpawnPacket extends BasePacket implements BattleTypes.IReadyToSpawn {
    read(buffer: Buffer): void { }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return 268832557; }
}

// C->S: the client signals it left the "pause" state (resuming / spawning). Empty body, fire-and-
// forget — the reference server sends no reply (verified against capture 2026-06-18_07-43). Handled
// as a no-op just so it isn't logged as an unknown packet.
export class DisablePausePacket extends BasePacket {
    read(buffer: Buffer): void { }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return 1156768699; }
}

export class RemoveTankPacket extends BasePacket implements BattleTypes.IRemoveTank {
    nickname: string | null;
    constructor(nickname: string | null = null) { super(); this.nickname = nickname; }
    read(buffer: Buffer): void { this.nickname = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.nickname).getBuffer(); }
    static getId(): number { return 1719707347; }
}

export class RotateTurretCommandPacket extends BasePacket implements BattleTypes.IRotateTurretCommand {
    static readonly schema: PacketSchema = [
        { name: "clientTime", type: "i32" },
        { name: "angle", type: "f32" },
        { name: "control", type: "i8" },
        { name: "incarnation", type: "i16" },
    ];
    clientTime: number = 0; angle: number = 0; control: number = 0; incarnation: number = 0;
    read(buffer: Buffer): void { readSchema(this, RotateTurretCommandPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, RotateTurretCommandPacket.schema); }
    static getId(): number { return -114968993; }
}

export class TurretRotationPacket extends BasePacket implements BattleTypes.IRotateTurretPacket {
    static readonly schema: PacketSchema = [
        { name: "nickname", type: "string" },
        { name: "angle", type: "f32" },
        { name: "control", type: "i8" },
    ];
    nickname: string | null = null; angle: number = 0; control: number = 0;
    constructor(data: BattleTypes.IRotateTurretPacketData) { super(); Object.assign(this, data); }
    read(buffer: Buffer): void { readSchema(this, TurretRotationPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, TurretRotationPacket.schema); }
    static getId(): number { return 1927704181; }
}

export class SelfDestructScheduledPacket extends BasePacket implements BattleTypes.ISelfDestructScheduled {
    time: number;
    constructor(time: number = 0) { super(); this.time = time; }
    read(buffer: Buffer): void { this.time = new BufferReader(buffer).readInt32BE(); }
    write(): Buffer { return new BufferWriter().writeInt32BE(this.time).getBuffer(); }
    static getId(): number { return -911983090; }
}

export class SetHealthPacket extends BasePacket implements BattleTypes.ISetHealth {
    static readonly schema: PacketSchema = [
        { name: "nickname", type: "string" },
        { name: "health", type: "f32" },
    ];
    nickname: string | null; health: number;
    constructor(data?: BattleTypes.ISetHealthData) { super(); this.nickname = data?.nickname ?? null; this.health = data?.health ?? 0; }
    read(buffer: Buffer): void { readSchema(this, SetHealthPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, SetHealthPacket.schema); }
    static getId(): number { return -611961116; }
}

export class SpawnPacket extends BasePacket implements BattleTypes.ISpawn {
    static readonly schema: PacketSchema = [
        { name: "nickname", type: "string" },
        { name: "team", type: "i32" },
        { name: "position", type: "vector3" },
        { name: "orientation", type: "vector3" },
        { name: "health", type: "i16" },
        { name: "incarnation", type: "i16" },
    ];
    nickname: string | null; team: number; position: BattleTypes.IVector3 | null; orientation: BattleTypes.IVector3 | null; health: number; incarnation: number;
    constructor(data?: BattleTypes.ISpawnData) { super(); this.nickname = data?.nickname ?? null; this.team = data?.team ?? 2; this.position = data?.position ?? null; this.orientation = data?.orientation ?? null; this.health = data?.health ?? 0; this.incarnation = data?.incarnation ?? 0; }
    read(buffer: Buffer): void { readSchema(this, SpawnPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, SpawnPacket.schema); }
    static getId(): number { return 875259457; }
}

export class SuicidePacket extends BasePacket implements BattleTypes.ISuicidePacket {
    read(buffer: Buffer): void { }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return 988664577; }
}

// --- Round lifecycle (decoded from log 2026-06-19_02-28) ---

// S->C: set the round time remaining, in seconds. Sent at round start and restart.
export class SetRoundTimePacket extends BasePacket {
    constructor(private readonly seconds: number = 0) { super(); }
    read(buffer: Buffer): void { throw new Error("This is a server-to-client packet only."); }
    write(): Buffer { return new BufferWriter().writeInt32BE(this.seconds).getBuffer(); }
    static getId(): number { return 732434644; }
}

// (Team score = the existing SetCtfScorePacket, id 561771020 — reused on restart to reset to 0.)

// S->C: the battle fund (crystal pool shown in the stats panel). Single i32 = the new TOTAL fund
// (cumulative, not a delta), per the decompiled client (battle-stats handler case 1149211509 ->
// statsPanel.setFund(int)). Sent whenever the fund grows; resets to 0 on round restart.
export class ChangeFundPacket extends BasePacket {
    constructor(private readonly fund: number = 0) { super(); }
    read(buffer: Buffer): void { throw new Error("This is a server-to-client packet only."); }
    write(): Buffer { return new BufferWriter().writeInt32BE(this.fund).getBuffer(); }
    static getId(): number { return 1149211509; }
}

// S->C: round finished. Per the client model (decompiled): a Vector<reward> + an int "break
// package in". Each reward entry = [i32 newbieAbonementBonus, i32 premiumBonus, i32 reward, optString
// nick] (the per-user crystal reward breakdown — all 0 when there are no rewards). The trailing int
// is the break/results-pause duration in seconds. Wire = i32 count + count×entry + i32 breakSeconds.
export class FinishBattlePacket extends BasePacket {
    constructor(private readonly nicknames: (string | null)[] = [], private readonly breakSeconds: number = 10) { super(); }
    read(buffer: Buffer): void { throw new Error("This is a server-to-client packet only."); }
    write(): Buffer {
        const w = new BufferWriter().writeInt32BE(this.nicknames.length);
        for (const nick of this.nicknames) {
            w.writeInt32BE(0).writeInt32BE(0).writeInt32BE(0).writeOptionalString(nick); // no rewards (0,0,0)
        }
        w.writeInt32BE(this.breakSeconds);
        return w.getBuffer();
    }
    static getId(): number { return 560336625; }
}

// S->C: rebuild the battle scoreboard rosters on round restart (this is what reassigns players to
// their new team in the Tab list). Per the client model: two Vector<entry> (field0 = RED, field1 =
// BLUE). Each entry = [i32, i32, optString nick] (stats, 0 on a fresh round). Verified vs log.
export class RestartRoundTeamPacket extends BasePacket {
    constructor(private readonly red: (string | null)[] = [], private readonly blue: (string | null)[] = []) { super(); }
    read(buffer: Buffer): void { throw new Error("This is a server-to-client packet only."); }
    write(): Buffer {
        const w = new BufferWriter();
        for (const team of [this.red, this.blue]) {
            w.writeInt32BE(team.length);
            for (const nick of team) w.writeInt32BE(0).writeInt32BE(0).writeOptionalString(nick);
        }
        return w.getBuffer();
    }
    static getId(): number { return -1668779175; }
}

// S->C: DM variant — one Vector<entry> (the full roster) rebuilt on round restart.
export class RestartRoundDmPacket extends BasePacket {
    constructor(private readonly users: (string | null)[] = []) { super(); }
    read(buffer: Buffer): void { throw new Error("This is a server-to-client packet only."); }
    write(): Buffer {
        const w = new BufferWriter().writeInt32BE(this.users.length);
        for (const nick of this.users) w.writeInt32BE(0).writeInt32BE(0).writeOptionalString(nick);
        return w.getBuffer();
    }
    static getId(): number { return 1061006142; }
}
