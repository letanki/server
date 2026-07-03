import { BasePacket } from "@/packets/base.packet";
import { PacketSchema, readSchema, writeSchema } from "@/packets/packet-schema";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import * as BattleTypes from "./battle.types";

export class BattleConsumablesPacket extends BasePacket implements BattleTypes.IBattleConsumables {
    jsonData: string | null;
    constructor(jsonData: string | null = null) { super(); this.jsonData = jsonData; }
    read(buffer: Buffer): void { this.jsonData = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.jsonData).getBuffer(); }
    static getId(): number { return -137249251; }
}

export class BattleMinesPropertiesPacket extends BasePacket implements BattleTypes.IBattleMinesProperties {
    activateSound: number = 0; activateTimeMsec: number = 0; battleMines: BattleTypes.IBattleMine[] = []; blueMineTexture: number = 0; deactivateSound: number = 0; enemyMineTexture: number = 0; explosionMarkTexture: number = 0; explosionSound: number = 0; farVisibilityRadius: number = 0; friendlyMineTexture: number = 0; idleExplosionTexture: number = 0; impactForce: number = 0; mainExplosionTexture: number = 0; minDistanceFromBase: number = 0; model3ds: number = 0; nearVisibilityRadius: number = 0; radius: number = 0; redMineTexture: number = 0;
    static readonly schema: PacketSchema = [
        { name: "activateSound", type: "resource" },
        { name: "activateTimeMsec", type: "i32" },
        // Wire order verified byte-for-byte against an official 351-mine join snapshot: mineId, ownerId,
        // activated (armed state), then a PLAIN vector3 (3 floats, no present byte). This list was never
        // populated before (joiners got an empty mine snapshot), so the field order had never been exercised.
        { name: "battleMines", type: "list", of: [
            { name: "mineId", type: "string" },
            { name: "ownerId", type: "string" },
            { name: "activated", type: "bool" },
            { name: "position", type: "object", of: [
                { name: "x", type: "f32" }, { name: "y", type: "f32" }, { name: "z", type: "f32" },
            ] },
        ] },
        { name: "blueMineTexture", type: "resource" },
        { name: "deactivateSound", type: "resource" },
        { name: "enemyMineTexture", type: "resource" },
        { name: "explosionMarkTexture", type: "resource" },
        { name: "explosionSound", type: "resource" },
        { name: "farVisibilityRadius", type: "f32" },
        { name: "friendlyMineTexture", type: "resource" },
        { name: "idleExplosionTexture", type: "resource" },
        { name: "impactForce", type: "f32" },
        { name: "mainExplosionTexture", type: "resource" },
        { name: "minDistanceFromBase", type: "f32" },
        { name: "model3ds", type: "resource" },
        { name: "nearVisibilityRadius", type: "f32" },
        { name: "radius", type: "f32" },
        { name: "redMineTexture", type: "resource" },
    ];
    constructor(data?: BattleTypes.IBattleMinesPropertiesData) { super(); if (data) Object.assign(this, data); }
    read(buffer: Buffer): void { readSchema(this, BattleMinesPropertiesPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, BattleMinesPropertiesPacket.schema); }
    static getId(): number { return -226978906; }
}

export class BattleStatsPacket extends BasePacket implements BattleTypes.IBattleStats {
    static readonly schema: PacketSchema = [
        { name: "battleMode", type: "i32" },
        { name: "equipmentConstraintsMode", type: "i32" },
        { name: "fund", type: "i32" },
        { name: "scoreLimit", type: "i32" },
        { name: "timeLimitInSec", type: "i32" },
        { name: "mapName", type: "string" },
        { name: "maxPeopleCount", type: "i32" },
        { name: "parkourMode", type: "bool" },
        { name: "premiumBonusInPercent", type: "i32" },
        { name: "spectator", type: "bool" },
        { name: "suspiciousUserIds", type: "optStringArray" },
        { name: "timeLeft", type: "i32" },
    ];
    battleMode: BattleTypes.BattleMode = BattleTypes.BattleMode.DM; equipmentConstraintsMode: BattleTypes.EquipmentConstraintsMode = BattleTypes.EquipmentConstraintsMode.NONE; fund: number = 0; scoreLimit: number = 0; timeLimitInSec: number = 0; mapName: string | null = null; maxPeopleCount: number = 0; parkourMode: boolean = false; premiumBonusInPercent: number = 0; spectator: boolean = false; suspiciousUserIds: string[] = []; timeLeft: number = 0;
    constructor(data: BattleTypes.IBattleStatsData) { super(); Object.assign(this, data); }
    read(buffer: Buffer): void { readSchema(this, BattleStatsPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, BattleStatsPacket.schema); }
    static getId(): number { return 522993449; }
}

export class BattleUserEffectsPacket extends BasePacket implements BattleTypes.IBattleUserEffects {
    jsonData: string | null;
    constructor(jsonData: string | null = null) { super(); this.jsonData = jsonData; }
    read(buffer: Buffer): void { this.jsonData = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.jsonData).getBuffer(); }
    static getId(): number { return 417965410; }
}

export class BonusDataPacket extends BasePacket implements BattleTypes.IBonusData {
    jsonData: string | null;
    constructor(jsonData: string | null = null) { super(); this.jsonData = jsonData; }
    read(buffer: Buffer): void { this.jsonData = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.jsonData).getBuffer(); }
    static getId(): number { return 228171466; }
}

export class InitBonusesPacket extends BasePacket {
    jsonData: string | null;
    constructor(jsonData: string | null = "[]") { super(); this.jsonData = jsonData; }
    read(buffer: Buffer): void { this.jsonData = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.jsonData).getBuffer(); }
    static getId(): number { return 870278784; }
}

// Inline (non-optional) 3-float vector — note this is NOT the optVector3 used elsewhere.
const VEC3_INLINE: PacketSchema = [
    { name: "x", type: "f32" },
    { name: "y", type: "f32" },
    { name: "z", type: "f32" },
];

export class BonusRegionsPacket extends BasePacket implements BattleTypes.IBonusRegions {
    static readonly schema: PacketSchema = [
        { name: "bonusRegionResources", type: "list", of: [
            { name: "bonusResource", type: "resource" },
            { name: "bonusType", type: "i32" },
        ] },
        { name: "bonusRegionData", type: "list", of: [
            { name: "position", type: "object", of: VEC3_INLINE },
            { name: "rotation", type: "object", of: VEC3_INLINE },
            { name: "bonusType", type: "i32" },
        ] },
    ];
    bonusRegionResources: BattleTypes.IBonusRegionResource[]; bonusRegionData: BattleTypes.IBonusRegionData[];
    constructor(data?: BattleTypes.IBonusRegionsData) { super(); this.bonusRegionResources = data?.bonusRegionResources ?? []; this.bonusRegionData = data?.bonusRegionData ?? []; }
    read(buffer: Buffer): void { readSchema(this, BonusRegionsPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, BonusRegionsPacket.schema); }
    static getId(): number { return -959048700; }
}

export class InitBattleDMPacket extends BasePacket implements BattleTypes.IInitBattleDM {
    read(buffer: Buffer): void { }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return 930618015; }
}

export class InitBattleTeamPacket extends BasePacket implements BattleTypes.IInitBattleTeam {
    read(buffer: Buffer): void { }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return 183561709; }
}

// Per-user fields shared by the battle user-list packets (no chatModeratorLevel on the wire).
const BATTLE_USER_FIELDS: PacketSchema = [
    { name: "deaths", type: "i32" },
    { name: "kills", type: "i32" },
    { name: "rank", type: "u8" },
    { name: "score", type: "i32" },
    { name: "uid", type: "string" },
];

export class InitBattleUsersDMPacket extends BasePacket implements BattleTypes.IInitBattleUsersDM {
    static readonly schema: PacketSchema = [{ name: "users", type: "list", of: BATTLE_USER_FIELDS }];
    users: BattleTypes.IBattleUser[] = [];
    constructor(users?: BattleTypes.IBattleUser[]) { super(); if (users) this.users = users; }
    read(buffer: Buffer): void { readSchema(this, InitBattleUsersDMPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, InitBattleUsersDMPacket.schema); }
    static getId(): number { return -1959138292; }
}

export class InitBattleUsersTeamPacket extends BasePacket implements BattleTypes.IInitBattleUsersTeam {
    static readonly schema: PacketSchema = [
        { name: "scoreBlue", type: "i32" },
        { name: "scoreRed", type: "i32" },
        { name: "usersBlue", type: "list", of: BATTLE_USER_FIELDS },
        { name: "usersRed", type: "list", of: BATTLE_USER_FIELDS },
    ];
    scoreBlue: number; scoreRed: number; usersBlue: BattleTypes.IBattleUser[]; usersRed: BattleTypes.IBattleUser[];
    constructor(scoreBlue: number = 0, scoreRed: number = 0, usersBlue: BattleTypes.IBattleUser[] = [], usersRed: BattleTypes.IBattleUser[] = []) { super(); this.scoreBlue = scoreBlue; this.scoreRed = scoreRed; this.usersBlue = usersBlue; this.usersRed = usersRed; }
    read(buffer: Buffer): void { readSchema(this, InitBattleUsersTeamPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, InitBattleUsersTeamPacket.schema); }
    static getId(): number { return -1233891872; }
}

export class InitCtfFlagsPacket extends BasePacket implements BattleTypes.IInitCtfFlags {
    static readonly schema: PacketSchema = [
        { name: "flagBasePositionBlue", type: "vector3" },
        { name: "flagCarrierIdBlue", type: "string" },
        { name: "flagPositionBlue", type: "vector3" },
        { name: "blueFlagSprite", type: "resource" },
        { name: "bluePedestalModel", type: "resource" },
        { name: "flagBasePositionRed", type: "vector3" },
        { name: "flagCarrierIdRed", type: "string" },
        { name: "flagPositionRed", type: "vector3" },
        { name: "redFlagSprite", type: "resource" },
        { name: "redPedestalModel", type: "resource" },
        { name: "flagDropSound", type: "resource" },
        { name: "flagReturnSound", type: "resource" },
        { name: "flagTakeSound", type: "resource" },
        { name: "winSound", type: "resource" },
    ];
    flagBasePositionBlue: BattleTypes.IVector3 | null = null; flagCarrierIdBlue: string | null = null; flagPositionBlue: BattleTypes.IVector3 | null = null; blueFlagSprite: number = 0; bluePedestalModel: number = 0; flagBasePositionRed: BattleTypes.IVector3 | null = null; flagCarrierIdRed: string | null = null; flagPositionRed: BattleTypes.IVector3 | null = null; redFlagSprite: number = 0; redPedestalModel: number = 0; flagDropSound: number = 0; flagReturnSound: number = 0; flagTakeSound: number = 0; winSound: number = 0;
    constructor(data: BattleTypes.IInitCtfFlagsData) { super(); Object.assign(this, data); }
    read(buffer: Buffer): void { readSchema(this, InitCtfFlagsPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, InitCtfFlagsPacket.schema); }
    static getId(): number { return 789790814; }
}

export class InitDomPointsPacket extends BasePacket implements BattleTypes.IInitDomPoints {
    keypointTriggerRadius: number = 0; keypointVisorHeight: number = 0; minesRestrictionRadius: number = 0; points: BattleTypes.IDomPoint[] = []; bigLetters: number = 0; blueCircle: number = 0; bluePedestalTexture: number = 0; blueRay: number = 0; blueRayTip: number = 0; neutralCircle: number = 0; neutralPedestalTexture: number = 0; pedestal: number = 0; redCircle: number = 0; redPedestalTexture: number = 0; redRay: number = 0; redRayTip: number = 0; pointCaptureStartNegativeSound: number = 0; pointCaptureStartPositiveSound: number = 0; pointCaptureStopNegativeSound: number = 0; pointCaptureStopPositiveSound: number = 0; pointCapturedNegativeSound: number = 0; pointCapturedPositiveSound: number = 0; pointNeutralizedNegativeSound: number = 0; pointNeutralizedPositiveSound: number = 0; pointScoreDecreasingSound: number = 0; pointScoreIncreasingSound: number = 0;
    static readonly schema: PacketSchema = [
        { name: "keypointTriggerRadius", type: "f32" },
        { name: "keypointVisorHeight", type: "f32" },
        { name: "minesRestrictionRadius", type: "f32" },
        { name: "points", type: "list", of: [
            { name: "id", type: "i32" },
            { name: "name", type: "string" },
            { name: "position", type: "vector3" },
            { name: "score", type: "f32" },
            { name: "scoreChangeRate", type: "f32" },
            { name: "state", type: "i32" },
            { name: "tankIds", type: "stringArray" },
        ] },
        { name: "bigLetters", type: "resource" },
        { name: "blueCircle", type: "resource" },
        { name: "bluePedestalTexture", type: "resource" },
        { name: "blueRay", type: "resource" },
        { name: "blueRayTip", type: "resource" },
        { name: "neutralCircle", type: "resource" },
        { name: "neutralPedestalTexture", type: "resource" },
        { name: "pedestal", type: "resource" },
        { name: "redCircle", type: "resource" },
        { name: "redPedestalTexture", type: "resource" },
        { name: "redRay", type: "resource" },
        { name: "redRayTip", type: "resource" },
        { name: "pointCaptureStartNegativeSound", type: "resource" },
        { name: "pointCaptureStartPositiveSound", type: "resource" },
        { name: "pointCaptureStopNegativeSound", type: "resource" },
        { name: "pointCaptureStopPositiveSound", type: "resource" },
        { name: "pointCapturedNegativeSound", type: "resource" },
        { name: "pointCapturedPositiveSound", type: "resource" },
        { name: "pointNeutralizedNegativeSound", type: "resource" },
        { name: "pointNeutralizedPositiveSound", type: "resource" },
        { name: "pointScoreDecreasingSound", type: "resource" },
        { name: "pointScoreIncreasingSound", type: "resource" },
    ];
    constructor(data?: BattleTypes.IInitDomPointsData) { super(); if (data) Object.assign(this, data); }
    read(buffer: Buffer): void { readSchema(this, InitDomPointsPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, InitDomPointsPacket.schema); }
    static getId(): number { return -1337059439; }
}

export class InitializeBattleStatisticsPacket extends BasePacket implements BattleTypes.IInitializeBattleStatistics {
    read(buffer: Buffer): void { }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return 1953272681; }
}

export class InitMapPacket extends BasePacket implements BattleTypes.IInitMap {
    jsonData: string | null;
    constructor(jsonData: string | null = null) { super(); this.jsonData = jsonData; }
    read(buffer: Buffer): void { this.jsonData = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.jsonData).getBuffer(); }
    static getId(): number { return -152638117; }
}

export class LoadBattleChatPacket extends BasePacket implements BattleTypes.ILoadBattleChat {
    read(buffer: Buffer): void { }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return -643105296; }
}

export class TankModelDataPacket extends BasePacket implements BattleTypes.ITankModelData {
    jsonData: string | null;
    constructor(jsonData: string | null = null) { super(); this.jsonData = jsonData; }
    read(buffer: Buffer): void { this.jsonData = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.jsonData).getBuffer(); }
    static getId(): number { return -1643824092; }
}

export class TankSpecificationPacket extends BasePacket implements BattleTypes.ITankSpecification {
    // The trailing int16 is a per-tank spec SEQUENCE (1, 2, 3...), not isPro: the client applies
    // specs in order so a later (e.g. nitro-boosted) spec supersedes the spawn one.
    nickname: string | null = null; speed: number = 0; maxTurnSpeed: number = 0; turretTurnSpeed: number = 0; acceleration: number = 0; sequence: number = 0;
    constructor(data?: BattleTypes.ITankSpecificationData) { super(); if (data) Object.assign(this, data); }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.nickname = r.readOptionalString(); this.speed = r.readFloatBE(); this.maxTurnSpeed = r.readFloatBE(); this.turretTurnSpeed = r.readFloatBE(); this.acceleration = r.readFloatBE(); this.sequence = r.readInt16BE(); }
    write(): Buffer { const w = new BufferWriter(); w.writeOptionalString(this.nickname); w.writeFloatBE(this.speed); w.writeFloatBE(this.maxTurnSpeed); w.writeFloatBE(this.turretTurnSpeed); w.writeFloatBE(this.acceleration); w.writeInt16BE(this.sequence); return w.getBuffer(); }
    static getId(): number { return -1672577397; }
}

export class UnloadSpaceBattlePacket extends BasePacket implements BattleTypes.IUnloadSpaceBattle {
    read(buffer: Buffer): void { }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return -985579124; }
}

export class WeaponPhysicsPacket extends BasePacket implements BattleTypes.IWeaponPhysics {
    jsonData: string | null;
    constructor(jsonData: string | null = null) { super(); this.jsonData = jsonData; }
    read(buffer: Buffer): void { this.jsonData = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.jsonData).getBuffer(); }
    static getId(): number { return -2124388778; }
}
