import { BasePacket } from "@/packets/base.packet";
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

export class ConfirmDestructionPacket extends BasePacket implements BattleTypes.IConfirmDestruction {
    nickname: string | null; delaytoSpawn: number;
    constructor(nickname: string | null = null, delaytoSpawn: number = 0) { super(); this.nickname = nickname; this.delaytoSpawn = delaytoSpawn; }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.nickname = r.readOptionalString(); this.delaytoSpawn = r.readInt32BE(); }
    write(): Buffer { const w = new BufferWriter(); w.writeOptionalString(this.nickname); w.writeInt32BE(this.delaytoSpawn); return w.getBuffer(); }
    static getId(): number { return -173682854; }
}

export class DestroyTankPacket extends BasePacket implements BattleTypes.IDestroyTankPacket {
    nickname: string | null; readyToSpawnInMs: number;
    constructor(nickname: string | null = null, readyToSpawnInMs: number = 0) { super(); this.nickname = nickname; this.readyToSpawnInMs = readyToSpawnInMs; }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.nickname = r.readOptionalString(); this.readyToSpawnInMs = r.readInt32BE(); }
    write(): Buffer { const w = new BufferWriter(); w.writeOptionalString(this.nickname); w.writeInt32BE(this.readyToSpawnInMs); return w.getBuffer(); }
    static getId(): number { return 162656882; }
}

export class FullMoveCommandPacket extends BasePacket implements BattleTypes.IFullMoveCommand {
    clientTime: number = 0; incarnation: number = 0; angularVelocity: BattleTypes.IVector3 | null = null; control: number = 0; linearVelocity: BattleTypes.IVector3 | null = null; orientation: BattleTypes.IVector3 | null = null; position: BattleTypes.IVector3 | null = null; direction: number = 0;
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.clientTime = r.readInt32BE(); this.incarnation = r.readInt16BE(); this.angularVelocity = r.readOptionalVector3(); this.control = r.readInt8(); this.linearVelocity = r.readOptionalVector3(); this.orientation = r.readOptionalVector3(); this.position = r.readOptionalVector3(); this.direction = r.readFloatBE(); }
    write(): Buffer { const w = new BufferWriter(); w.writeInt32BE(this.clientTime); w.writeInt16BE(this.incarnation); w.writeOptionalVector3(this.angularVelocity); w.writeInt8(this.control); w.writeOptionalVector3(this.linearVelocity); w.writeOptionalVector3(this.orientation); w.writeOptionalVector3(this.position); w.writeFloatBE(this.direction); return w.getBuffer(); }
    static getId(): number { return -1683279062; }
}

export class FullMovePacket extends BasePacket implements BattleTypes.IFullMovePacket {
    nickname: string | null; angularVelocity: BattleTypes.IVector3 | null; control: number; linearVelocity: BattleTypes.IVector3 | null; orientation: BattleTypes.IVector3 | null; position: BattleTypes.IVector3 | null; direction: number;
    constructor(data: BattleTypes.IFullMovePacketData) { super(); this.nickname = data.nickname; this.angularVelocity = data.angularVelocity; this.control = data.control; this.linearVelocity = data.linearVelocity; this.orientation = data.orientation; this.position = data.position; this.direction = data.direction; }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.nickname = r.readOptionalString(); this.angularVelocity = r.readOptionalVector3(); this.control = r.readInt8(); this.linearVelocity = r.readOptionalVector3(); this.orientation = r.readOptionalVector3(); this.position = r.readOptionalVector3(); this.direction = r.readFloatBE(); }
    write(): Buffer { const w = new BufferWriter(); w.writeOptionalString(this.nickname); w.writeOptionalVector3(this.angularVelocity); w.writeInt8(this.control); w.writeOptionalVector3(this.linearVelocity); w.writeOptionalVector3(this.orientation); w.writeOptionalVector3(this.position); w.writeFloatBE(this.direction); return w.getBuffer(); }
    static getId(): number { return 1516578027; }
}

export class MoveCommandPacket extends BasePacket implements BattleTypes.IMoveCommand {
    clientTime: number = 0; incarnation: number = 0; angularVelocity: BattleTypes.IVector3 | null = null; control: number = 0; linearVelocity: BattleTypes.IVector3 | null = null; orientation: BattleTypes.IVector3 | null = null; position: BattleTypes.IVector3 | null = null;
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.clientTime = r.readInt32BE(); this.incarnation = r.readInt16BE(); this.angularVelocity = r.readOptionalVector3(); this.control = r.readInt8(); this.linearVelocity = r.readOptionalVector3(); this.orientation = r.readOptionalVector3(); this.position = r.readOptionalVector3(); }
    write(): Buffer { const w = new BufferWriter(); w.writeInt32BE(this.clientTime); w.writeInt16BE(this.incarnation); w.writeOptionalVector3(this.angularVelocity); w.writeInt8(this.control); w.writeOptionalVector3(this.linearVelocity); w.writeOptionalVector3(this.orientation); w.writeOptionalVector3(this.position); return w.getBuffer(); }
    static getId(): number { return 329279865; }
}

export class MovePacket extends BasePacket implements BattleTypes.IMovePacket {
    nickname: string | null = null; angularVelocity: BattleTypes.IVector3 | null = null; control: number = 0; linearVelocity: BattleTypes.IVector3 | null = null; orientation: BattleTypes.IVector3 | null = null; position: BattleTypes.IVector3 | null = null;
    constructor(data: BattleTypes.IMovePacketData) { super(); Object.assign(this, data); }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.nickname = r.readOptionalString(); this.angularVelocity = r.readOptionalVector3(); this.control = r.readInt8(); this.linearVelocity = r.readOptionalVector3(); this.orientation = r.readOptionalVector3(); this.position = r.readOptionalVector3(); }
    write(): Buffer { const w = new BufferWriter(); w.writeOptionalString(this.nickname); w.writeOptionalVector3(this.angularVelocity); w.writeInt8(this.control); w.writeOptionalVector3(this.linearVelocity); w.writeOptionalVector3(this.orientation); w.writeOptionalVector3(this.position); return w.getBuffer(); }
    static getId(): number { return -64696933; }
}

export class PrepareToSpawnPacket extends BasePacket implements BattleTypes.IPrepareToSpawn {
    position: BattleTypes.IVector3 | null; rotation: BattleTypes.IVector3 | null;
    constructor(position: BattleTypes.IVector3 | null = null, rotation: BattleTypes.IVector3 | null = null) { super(); this.position = position; this.rotation = rotation; }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.position = r.readOptionalVector3(); this.rotation = r.readOptionalVector3(); }
    write(): Buffer { const w = new BufferWriter(); w.writeOptionalVector3(this.position); w.writeOptionalVector3(this.rotation); return w.getBuffer(); }
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

export class RemoveTankPacket extends BasePacket implements BattleTypes.IRemoveTank {
    nickname: string | null;
    constructor(nickname: string | null = null) { super(); this.nickname = nickname; }
    read(buffer: Buffer): void { this.nickname = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.nickname).getBuffer(); }
    static getId(): number { return 1719707347; }
}

export class RotateTurretCommandPacket extends BasePacket implements BattleTypes.IRotateTurretCommand {
    clientTime: number = 0; angle: number = 0; control: number = 0; incarnation: number = 0;
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.clientTime = r.readInt32BE(); this.angle = r.readFloatBE(); this.control = r.readInt8(); this.incarnation = r.readInt16BE(); }
    write(): Buffer { const w = new BufferWriter(); w.writeInt32BE(this.clientTime); w.writeFloatBE(this.angle); w.writeInt8(this.control); w.writeInt16BE(this.incarnation); return w.getBuffer(); }
    static getId(): number { return -114968993; }
}

export class TurretRotationPacket extends BasePacket implements BattleTypes.IRotateTurretPacket {
    nickname: string | null = null; angle: number = 0; control: number = 0;
    constructor(data: BattleTypes.IRotateTurretPacketData) { super(); Object.assign(this, data); }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.nickname = r.readOptionalString(); this.angle = r.readFloatBE(); this.control = r.readInt8(); }
    write(): Buffer { const w = new BufferWriter(); w.writeOptionalString(this.nickname); w.writeFloatBE(this.angle); w.writeInt8(this.control); return w.getBuffer(); }
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
    nickname: string | null; health: number;
    constructor(data?: BattleTypes.ISetHealthData) { super(); this.nickname = data?.nickname ?? null; this.health = data?.health ?? 0; }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.nickname = r.readOptionalString(); this.health = r.readFloatBE(); }
    write(): Buffer { const w = new BufferWriter(); w.writeOptionalString(this.nickname); w.writeFloatBE(this.health); return w.getBuffer(); }
    static getId(): number { return -611961116; }
}

export class SpawnPacket extends BasePacket implements BattleTypes.ISpawn {
    nickname: string | null; team: number; position: BattleTypes.IVector3 | null; orientation: BattleTypes.IVector3 | null; health: number; incarnation: number;
    constructor(data?: BattleTypes.ISpawnData) { super(); this.nickname = data?.nickname ?? null; this.team = data?.team ?? 2; this.position = data?.position ?? null; this.orientation = data?.orientation ?? null; this.health = data?.health ?? 0; this.incarnation = data?.incarnation ?? 0; }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.nickname = r.readOptionalString(); this.team = r.readInt32BE(); this.position = r.readOptionalVector3(); this.orientation = r.readOptionalVector3(); this.health = r.readInt16BE(); this.incarnation = r.readInt16BE(); }
    write(): Buffer { const w = new BufferWriter(); w.writeOptionalString(this.nickname); w.writeInt32BE(this.team); w.writeOptionalVector3(this.position); w.writeOptionalVector3(this.orientation); w.writeInt16BE(this.health); w.writeInt16BE(this.incarnation); return w.getBuffer(); }
    static getId(): number { return 875259457; }
}

export class SuicidePacket extends BasePacket implements BattleTypes.ISuicidePacket {
    read(buffer: Buffer): void { }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return 988664577; }
}
