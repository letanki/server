import { BasePacket } from "@/packets/base.packet";
import { readSchema, writeSchema } from "@/packets/packet-schema";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import { defs } from "protanki-protocol";
import * as BattleTypes from "./battle.types";

// IDs e schemas em `protanki-protocol` (defs.battle.*).

export class BattleConsumablesPacket extends BasePacket implements BattleTypes.IBattleConsumables {
    jsonData: string | null;
    constructor(jsonData: string | null = null) { super(); this.jsonData = jsonData; }
    read(buffer: Buffer): void { this.jsonData = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.jsonData).getBuffer(); }
    static getId(): number { return defs.battle.BattleConsumables.id; }
}

export class BattleMinesPropertiesPacket extends BasePacket implements BattleTypes.IBattleMinesProperties {
    activateSound: number = 0; activateTimeMsec: number = 0; battleMines: BattleTypes.IBattleMine[] = []; blueMineTexture: number = 0; deactivateSound: number = 0; enemyMineTexture: number = 0; explosionMarkTexture: number = 0; explosionSound: number = 0; farVisibilityRadius: number = 0; friendlyMineTexture: number = 0; idleExplosionTexture: number = 0; impactForce: number = 0; mainExplosionTexture: number = 0; minDistanceFromBase: number = 0; model3ds: number = 0; nearVisibilityRadius: number = 0; radius: number = 0; redMineTexture: number = 0;
    static readonly schema = defs.battle.BattleMinesProperties.schema!;
    constructor(data?: BattleTypes.IBattleMinesPropertiesData) { super(); if (data) Object.assign(this, data); }
    read(buffer: Buffer): void { readSchema(this, BattleMinesPropertiesPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, BattleMinesPropertiesPacket.schema); }
    static getId(): number { return defs.battle.BattleMinesProperties.id; }
}

export class BattleStatsPacket extends BasePacket implements BattleTypes.IBattleStats {
    static readonly schema = defs.battle.BattleStats.schema!;
    battleMode: BattleTypes.BattleMode = BattleTypes.BattleMode.DM; equipmentConstraintsMode: BattleTypes.EquipmentConstraintsMode = BattleTypes.EquipmentConstraintsMode.NONE; fund: number = 0; scoreLimit: number = 0; timeLimitInSec: number = 0; mapName: string | null = null; maxPeopleCount: number = 0; parkourMode: boolean = false; premiumBonusInPercent: number = 0; spectator: boolean = false; suspiciousUserIds: string[] = []; timeLeft: number = 0;
    constructor(data: BattleTypes.IBattleStatsData) { super(); Object.assign(this, data); }
    read(buffer: Buffer): void { readSchema(this, BattleStatsPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, BattleStatsPacket.schema); }
    static getId(): number { return defs.battle.BattleStats.id; }
}

export class BattleUserEffectsPacket extends BasePacket implements BattleTypes.IBattleUserEffects {
    jsonData: string | null;
    constructor(jsonData: string | null = null) { super(); this.jsonData = jsonData; }
    read(buffer: Buffer): void { this.jsonData = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.jsonData).getBuffer(); }
    static getId(): number { return defs.battle.BattleUserEffects.id; }
}

export class BonusDataPacket extends BasePacket implements BattleTypes.IBonusData {
    jsonData: string | null;
    constructor(jsonData: string | null = null) { super(); this.jsonData = jsonData; }
    read(buffer: Buffer): void { this.jsonData = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.jsonData).getBuffer(); }
    static getId(): number { return defs.battle.BonusData.id; }
}

export class InitBonusesPacket extends BasePacket {
    jsonData: string | null;
    constructor(jsonData: string | null = "[]") { super(); this.jsonData = jsonData; }
    read(buffer: Buffer): void { this.jsonData = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.jsonData).getBuffer(); }
    static getId(): number { return defs.battle.InitBonuses.id; }
}

export class BonusRegionsPacket extends BasePacket implements BattleTypes.IBonusRegions {
    static readonly schema = defs.battle.BonusRegions.schema!;
    bonusRegionResources: BattleTypes.IBonusRegionResource[]; bonusRegionData: BattleTypes.IBonusRegionData[];
    constructor(data?: BattleTypes.IBonusRegionsData) { super(); this.bonusRegionResources = data?.bonusRegionResources ?? []; this.bonusRegionData = data?.bonusRegionData ?? []; }
    read(buffer: Buffer): void { readSchema(this, BonusRegionsPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, BonusRegionsPacket.schema); }
    static getId(): number { return defs.battle.BonusRegions.id; }
}

export class InitBattleDMPacket extends BasePacket implements BattleTypes.IInitBattleDM {
    read(buffer: Buffer): void { }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.battle.InitBattleDM.id; }
}

export class InitBattleTeamPacket extends BasePacket implements BattleTypes.IInitBattleTeam {
    read(buffer: Buffer): void { }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.battle.InitBattleTeam.id; }
}

export class InitBattleUsersDMPacket extends BasePacket implements BattleTypes.IInitBattleUsersDM {
    static readonly schema = defs.battle.InitBattleUsersDM.schema!;
    users: BattleTypes.IBattleUser[] = [];
    constructor(users?: BattleTypes.IBattleUser[]) { super(); if (users) this.users = users; }
    read(buffer: Buffer): void { readSchema(this, InitBattleUsersDMPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, InitBattleUsersDMPacket.schema); }
    static getId(): number { return defs.battle.InitBattleUsersDM.id; }
}

export class InitBattleUsersTeamPacket extends BasePacket implements BattleTypes.IInitBattleUsersTeam {
    static readonly schema = defs.battle.InitBattleUsersTeam.schema!;
    scoreBlue: number; scoreRed: number; usersBlue: BattleTypes.IBattleUser[]; usersRed: BattleTypes.IBattleUser[];
    constructor(scoreBlue: number = 0, scoreRed: number = 0, usersBlue: BattleTypes.IBattleUser[] = [], usersRed: BattleTypes.IBattleUser[] = []) { super(); this.scoreBlue = scoreBlue; this.scoreRed = scoreRed; this.usersBlue = usersBlue; this.usersRed = usersRed; }
    read(buffer: Buffer): void { readSchema(this, InitBattleUsersTeamPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, InitBattleUsersTeamPacket.schema); }
    static getId(): number { return defs.battle.InitBattleUsersTeam.id; }
}

export class InitCtfFlagsPacket extends BasePacket implements BattleTypes.IInitCtfFlags {
    static readonly schema = defs.battle.InitCtfFlags.schema!;
    flagBasePositionBlue: BattleTypes.IVector3 | null = null; flagCarrierIdBlue: string | null = null; flagPositionBlue: BattleTypes.IVector3 | null = null; blueFlagSprite: number = 0; bluePedestalModel: number = 0; flagBasePositionRed: BattleTypes.IVector3 | null = null; flagCarrierIdRed: string | null = null; flagPositionRed: BattleTypes.IVector3 | null = null; redFlagSprite: number = 0; redPedestalModel: number = 0; flagDropSound: number = 0; flagReturnSound: number = 0; flagTakeSound: number = 0; winSound: number = 0;
    constructor(data: BattleTypes.IInitCtfFlagsData) { super(); Object.assign(this, data); }
    read(buffer: Buffer): void { readSchema(this, InitCtfFlagsPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, InitCtfFlagsPacket.schema); }
    static getId(): number { return defs.battle.InitCtfFlags.id; }
}

export class InitDomPointsPacket extends BasePacket implements BattleTypes.IInitDomPoints {
    keypointTriggerRadius: number = 0; keypointVisorHeight: number = 0; minesRestrictionRadius: number = 0; points: BattleTypes.IDomPoint[] = []; bigLetters: number = 0; blueCircle: number = 0; bluePedestalTexture: number = 0; blueRay: number = 0; blueRayTip: number = 0; neutralCircle: number = 0; neutralPedestalTexture: number = 0; pedestal: number = 0; redCircle: number = 0; redPedestalTexture: number = 0; redRay: number = 0; redRayTip: number = 0; pointCaptureStartNegativeSound: number = 0; pointCaptureStartPositiveSound: number = 0; pointCaptureStopNegativeSound: number = 0; pointCaptureStopPositiveSound: number = 0; pointCapturedNegativeSound: number = 0; pointCapturedPositiveSound: number = 0; pointNeutralizedNegativeSound: number = 0; pointNeutralizedPositiveSound: number = 0; pointScoreDecreasingSound: number = 0; pointScoreIncreasingSound: number = 0;
    static readonly schema = defs.battle.InitDomPoints.schema!;
    constructor(data?: BattleTypes.IInitDomPointsData) { super(); if (data) Object.assign(this, data); }
    read(buffer: Buffer): void { readSchema(this, InitDomPointsPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, InitDomPointsPacket.schema); }
    static getId(): number { return defs.battle.InitDomPoints.id; }
}

export class InitializeBattleStatisticsPacket extends BasePacket implements BattleTypes.IInitializeBattleStatistics {
    read(buffer: Buffer): void { }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.battle.InitializeBattleStatistics.id; }
}

export class InitMapPacket extends BasePacket implements BattleTypes.IInitMap {
    jsonData: string | null;
    constructor(jsonData: string | null = null) { super(); this.jsonData = jsonData; }
    read(buffer: Buffer): void { this.jsonData = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.jsonData).getBuffer(); }
    static getId(): number { return defs.battle.InitMap.id; }
}

export class LoadBattleChatPacket extends BasePacket implements BattleTypes.ILoadBattleChat {
    read(buffer: Buffer): void { }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.battle.LoadBattleChat.id; }
}

export class TankModelDataPacket extends BasePacket implements BattleTypes.ITankModelData {
    jsonData: string | null;
    constructor(jsonData: string | null = null) { super(); this.jsonData = jsonData; }
    read(buffer: Buffer): void { this.jsonData = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.jsonData).getBuffer(); }
    static getId(): number { return defs.battle.TankModelData.id; }
}

export class TankSpecificationPacket extends BasePacket implements BattleTypes.ITankSpecification {
    // The trailing int16 is a per-tank spec SEQUENCE (1, 2, 3...), not isPro: the client applies
    // specs in order so a later (e.g. nitro-boosted) spec supersedes the spawn one.
    nickname: string | null = null; speed: number = 0; maxTurnSpeed: number = 0; turretTurnSpeed: number = 0; acceleration: number = 0; sequence: number = 0;
    constructor(data?: BattleTypes.ITankSpecificationData) { super(); if (data) Object.assign(this, data); }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.nickname = r.readOptionalString(); this.speed = r.readFloatBE(); this.maxTurnSpeed = r.readFloatBE(); this.turretTurnSpeed = r.readFloatBE(); this.acceleration = r.readFloatBE(); this.sequence = r.readInt16BE(); }
    write(): Buffer { const w = new BufferWriter(); w.writeOptionalString(this.nickname); w.writeFloatBE(this.speed); w.writeFloatBE(this.maxTurnSpeed); w.writeFloatBE(this.turretTurnSpeed); w.writeFloatBE(this.acceleration); w.writeInt16BE(this.sequence); return w.getBuffer(); }
    static getId(): number { return defs.battle.TankSpecification.id; }
}

export class UnloadSpaceBattlePacket extends BasePacket implements BattleTypes.IUnloadSpaceBattle {
    read(buffer: Buffer): void { }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return defs.battle.UnloadSpaceBattle.id; }
}

export class WeaponPhysicsPacket extends BasePacket implements BattleTypes.IWeaponPhysics {
    jsonData: string | null;
    constructor(jsonData: string | null = null) { super(); this.jsonData = jsonData; }
    read(buffer: Buffer): void { this.jsonData = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.jsonData).getBuffer(); }
    static getId(): number { return defs.battle.WeaponPhysics.id; }
}
