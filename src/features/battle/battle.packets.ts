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

export class BattleChatMessagePacket extends BasePacket implements BattleTypes.IBattleChatMessage {
    nickname: string | null;
    message: string | null;
    team: number;
    constructor(data?: BattleTypes.IBattleChatMessageData) { super(); this.nickname = data?.nickname ?? null; this.message = data?.message ?? null; this.team = data?.team ?? 2; }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.nickname = r.readOptionalString(); this.message = r.readOptionalString(); this.team = r.readInt32BE(); }
    write(): Buffer { const w = new BufferWriter(); w.writeOptionalString(this.nickname); w.writeOptionalString(this.message); w.writeInt32BE(this.team); return w.getBuffer(); }
    static getId(): number { return 1259981343; }
}

export class BattleChatTeamMessagePacket extends BasePacket implements BattleTypes.IBattleChatMessage {
    nickname: string | null;
    message: string | null;
    team: number;
    constructor(data?: BattleTypes.IBattleChatMessageData) { super(); this.nickname = data?.nickname ?? null; this.message = data?.message ?? null; this.team = data?.team ?? 2; }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.nickname = r.readOptionalString(); this.message = r.readOptionalString(); this.team = r.readInt32BE(); }
    write(): Buffer { const w = new BufferWriter(); w.writeOptionalString(this.nickname); w.writeOptionalString(this.message); w.writeInt32BE(this.team); return w.getBuffer(); }
    static getId(): number { return -449356094; }
}

export class BattleConsumablesPacket extends BasePacket implements BattleTypes.IBattleConsumables {
    jsonData: string | null;
    constructor(jsonData: string | null = null) { super(); this.jsonData = jsonData; }
    read(buffer: Buffer): void { this.jsonData = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.jsonData).getBuffer(); }
    static getId(): number { return -137249251; }
}

export class BattleMinesPropertiesPacket extends BasePacket implements BattleTypes.IBattleMinesProperties {
    activateSound: number = 0; activateTimeMsec: number = 0; battleMines: BattleTypes.IBattleMine[] = []; blueMineTexture: number = 0; deactivateSound: number = 0; enemyMineTexture: number = 0; explosionMarkTexture: number = 0; explosionSound: number = 0; farVisibilityRadius: number = 0; friendlyMineTexture: number = 0; idleExplosionTexture: number = 0; impactForce: number = 0; mainExplosionTexture: number = 0; minDistanceFromBase: number = 0; model3ds: number = 0; nearVisibilityRadius: number = 0; radius: number = 0; redMineTexture: number = 0;
    constructor(data?: BattleTypes.IBattleMinesPropertiesData) { super(); if (data) Object.assign(this, data); }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.activateSound = r.readResource(); this.activateTimeMsec = r.readInt32BE(); this.battleMines = this.readMines(r); this.blueMineTexture = r.readResource(); this.deactivateSound = r.readResource(); this.enemyMineTexture = r.readResource(); this.explosionMarkTexture = r.readResource(); this.explosionSound = r.readResource(); this.farVisibilityRadius = r.readFloatBE(); this.friendlyMineTexture = r.readResource(); this.idleExplosionTexture = r.readResource(); this.impactForce = r.readFloatBE(); this.mainExplosionTexture = r.readResource(); this.minDistanceFromBase = r.readFloatBE(); this.model3ds = r.readResource(); this.nearVisibilityRadius = r.readFloatBE(); this.radius = r.readFloatBE(); this.redMineTexture = r.readResource(); }
    write(): Buffer { const w = new BufferWriter(); w.writeResource(this.activateSound); w.writeInt32BE(this.activateTimeMsec); this.writeMines(w, this.battleMines); w.writeResource(this.blueMineTexture); w.writeResource(this.deactivateSound); w.writeResource(this.enemyMineTexture); w.writeResource(this.explosionMarkTexture); w.writeResource(this.explosionSound); w.writeFloatBE(this.farVisibilityRadius); w.writeResource(this.friendlyMineTexture); w.writeResource(this.idleExplosionTexture); w.writeFloatBE(this.impactForce); w.writeResource(this.mainExplosionTexture); w.writeFloatBE(this.minDistanceFromBase); w.writeResource(this.model3ds); w.writeFloatBE(this.nearVisibilityRadius); w.writeFloatBE(this.radius); w.writeResource(this.redMineTexture); return w.getBuffer(); }
    private readMines(r: BufferReader): BattleTypes.IBattleMine[] { const c = r.readInt32BE(); const a: BattleTypes.IBattleMine[] = []; for (let i = 0; i < c; i++) a.push({ activated: r.readUInt8() === 1, mineId: r.readOptionalString(), ownerId: r.readOptionalString(), position: { x: r.readFloatBE(), y: r.readFloatBE(), z: r.readFloatBE() } }); return a; }
    private writeMines(w: BufferWriter, a: BattleTypes.IBattleMine[]): void { w.writeInt32BE(a.length); for (const m of a) { w.writeUInt8(m.activated ? 1 : 0); w.writeOptionalString(m.mineId); w.writeOptionalString(m.ownerId); w.writeFloatBE(m.position.x); w.writeFloatBE(m.position.y); w.writeFloatBE(m.position.z); } }
    static getId(): number { return -226978906; }
}

export class BattleStatsPacket extends BasePacket implements BattleTypes.IBattleStats {
    battleMode: BattleTypes.BattleMode = BattleTypes.BattleMode.DM; equipmentConstraintsMode: BattleTypes.EquipmentConstraintsMode = BattleTypes.EquipmentConstraintsMode.NONE; fund: number = 0; scoreLimit: number = 0; timeLimitInSec: number = 0; mapName: string | null = null; maxPeopleCount: number = 0; parkourMode: boolean = false; premiumBonusInPercent: number = 0; spectator: boolean = false; suspiciousUserIds: string[] = []; timeLeft: number = 0;
    constructor(data: BattleTypes.IBattleStatsData) { super(); Object.assign(this, data); }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.battleMode = r.readInt32BE(); this.equipmentConstraintsMode = r.readInt32BE(); this.fund = r.readInt32BE(); this.scoreLimit = r.readInt32BE(); this.timeLimitInSec = r.readInt32BE(); this.mapName = r.readOptionalString(); this.maxPeopleCount = r.readInt32BE(); this.parkourMode = r.readUInt8() === 1; this.premiumBonusInPercent = r.readInt32BE(); this.spectator = r.readUInt8() === 1; this.suspiciousUserIds = r.readStringArray(); this.timeLeft = r.readInt32BE(); }
    write(): Buffer { const w = new BufferWriter(); w.writeInt32BE(this.battleMode); w.writeInt32BE(this.equipmentConstraintsMode); w.writeInt32BE(this.fund); w.writeInt32BE(this.scoreLimit); w.writeInt32BE(this.timeLimitInSec); w.writeOptionalString(this.mapName); w.writeInt32BE(this.maxPeopleCount); w.writeUInt8(this.parkourMode ? 1 : 0); w.writeInt32BE(this.premiumBonusInPercent); w.writeUInt8(this.spectator ? 1 : 0); w.writeOptionalStringArray(this.suspiciousUserIds); w.writeInt32BE(this.timeLeft); return w.getBuffer(); }
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

export class BonusRegionsPacket extends BasePacket implements BattleTypes.IBonusRegions {
    bonusRegionResources: BattleTypes.IBonusRegionResource[]; bonusRegionData: BattleTypes.IBonusRegionData[];
    constructor(data?: BattleTypes.IBonusRegionsData) { super(); this.bonusRegionResources = data?.bonusRegionResources ?? []; this.bonusRegionData = data?.bonusRegionData ?? []; }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); const rc = r.readInt32BE(); this.bonusRegionResources = []; for (let i = 0; i < rc; i++) this.bonusRegionResources.push({ bonusResource: r.readInt32BE(), bonusType: r.readInt32BE() }); const dc = r.readInt32BE(); this.bonusRegionData = []; for (let i = 0; i < dc; i++) this.bonusRegionData.push({ position: { x: r.readFloatBE(), y: r.readFloatBE(), z: r.readFloatBE() }, rotation: { x: r.readFloatBE(), y: r.readFloatBE(), z: r.readFloatBE() }, bonusType: r.readInt32BE() }); }
    write(): Buffer { const w = new BufferWriter(); w.writeInt32BE(this.bonusRegionResources.length); for (const res of this.bonusRegionResources) { w.writeInt32BE(res.bonusResource); w.writeInt32BE(res.bonusType); } w.writeInt32BE(this.bonusRegionData.length); for (const data of this.bonusRegionData) { w.writeFloatBE(data.position.x); w.writeFloatBE(data.position.y); w.writeFloatBE(data.position.z); w.writeFloatBE(data.rotation.x); w.writeFloatBE(data.rotation.y); w.writeFloatBE(data.rotation.z); w.writeInt32BE(data.bonusType); } return w.getBuffer(); }
    static getId(): number { return -959048700; }
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

export class EnterBattlePacket extends BasePacket implements BattleTypes.IEnterBattle {
    battleTeam: number = 0;
    read(buffer: Buffer): void { this.battleTeam = new BufferReader(buffer).readInt32BE(); }
    write(): Buffer { return new BufferWriter().writeInt32BE(this.battleTeam).getBuffer(); }
    static getId(): number { return -1284211503; }
}

export class EnterBattleAsSpectatorPacket extends BasePacket implements BattleTypes.IEnterBattleAsSpectator {
    read(buffer: Buffer): void { }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return -1315002220; }
}

export class EquipmentChangedPacket extends BasePacket implements BattleTypes.IEquipmentChanged {
    nickname: string | null;
    constructor(nickname: string | null = null) { super(); this.nickname = nickname; }
    read(buffer: Buffer): void { this.nickname = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.nickname).getBuffer(); }
    static getId(): number { return -1767633906; }
}

export class ExitFromBattlePacket extends BasePacket implements BattleTypes.IExitFromBattle {
    layout: number = 0;
    read(buffer: Buffer): void { this.layout = new BufferReader(buffer).readInt32BE(); }
    write(): Buffer { return new BufferWriter().writeInt32BE(this.layout).getBuffer(); }
    static getId(): number { return 377959142; }
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

export class InitBattleUsersDMPacket extends BasePacket implements BattleTypes.IInitBattleUsersDM {
    users: BattleTypes.IBattleUser[] = [];
    constructor(users?: BattleTypes.IBattleUser[]) { super(); if (users) this.users = users; }
    read(buffer: Buffer): void { this.users = this.readUsers(new BufferReader(buffer)); }
    write(): Buffer { const w = new BufferWriter(); this.writeUsers(w, this.users); return w.getBuffer(); }
    private readUsers(r: BufferReader): BattleTypes.IBattleUser[] { const c = r.readInt32BE(); const a: BattleTypes.IBattleUser[] = []; for (let i = 0; i < c; i++) a.push({ chatModeratorLevel: r.readInt32BE(), deaths: r.readInt32BE(), kills: r.readInt32BE(), rank: r.readInt8(), score: r.readInt32BE(), uid: r.readOptionalString() }); return a; }
    private writeUsers(w: BufferWriter, u: BattleTypes.IBattleUser[]): void { w.writeInt32BE(u.length); for (const i of u) { w.writeInt32BE(i.chatModeratorLevel); w.writeInt32BE(i.deaths); w.writeInt32BE(i.kills); w.writeInt8(i.rank); w.writeInt32BE(i.score); w.writeOptionalString(i.uid); } }
    static getId(): number { return -1959138292; }
}

export class InitBattleUsersTeamPacket extends BasePacket implements BattleTypes.IInitBattleUsersTeam {
    scoreBlue: number; scoreRed: number; usersBlue: BattleTypes.IBattleUser[]; usersRed: BattleTypes.IBattleUser[];
    constructor(scoreBlue: number = 0, scoreRed: number = 0, usersBlue: BattleTypes.IBattleUser[] = [], usersRed: BattleTypes.IBattleUser[] = []) { super(); this.scoreBlue = scoreBlue; this.scoreRed = scoreRed; this.usersBlue = usersBlue; this.usersRed = usersRed; }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.scoreBlue = r.readInt32BE(); this.scoreRed = r.readInt32BE(); this.usersBlue = this.readUsers(r); this.usersRed = this.readUsers(r); }
    write(): Buffer { const w = new BufferWriter(); w.writeInt32BE(this.scoreBlue); w.writeInt32BE(this.scoreRed); this.writeUsers(w, this.usersBlue); this.writeUsers(w, this.usersRed); return w.getBuffer(); }
    private readUsers(r: BufferReader): BattleTypes.IBattleUser[] { const c = r.readInt32BE(); const a: BattleTypes.IBattleUser[] = []; for (let i = 0; i < c; i++) a.push({ chatModeratorLevel: r.readInt32BE(), deaths: r.readInt32BE(), kills: r.readInt32BE(), rank: r.readInt8(), score: r.readInt32BE(), uid: r.readOptionalString() }); return a; }
    private writeUsers(w: BufferWriter, u: BattleTypes.IBattleUser[]): void { w.writeInt32BE(u.length); for (const i of u) { w.writeInt32BE(i.chatModeratorLevel); w.writeInt32BE(i.deaths); w.writeInt32BE(i.kills); w.writeInt8(i.rank); w.writeInt32BE(i.score); w.writeOptionalString(i.uid); } }
    static getId(): number { return -1233891872; }
}

export class InitCtfFlagsPacket extends BasePacket implements BattleTypes.IInitCtfFlags {
    flagBasePositionBlue: BattleTypes.IVector3 | null = null; flagCarrierIdBlue: string | null = null; flagPositionBlue: BattleTypes.IVector3 | null = null; blueFlagSprite: number = 0; bluePedestalModel: number = 0; flagBasePositionRed: BattleTypes.IVector3 | null = null; flagCarrierIdRed: string | null = null; flagPositionRed: BattleTypes.IVector3 | null = null; redFlagSprite: number = 0; redPedestalModel: number = 0; flagDropSound: number = 0; flagReturnSound: number = 0; flagTakeSound: number = 0; winSound: number = 0;
    constructor(data: BattleTypes.IInitCtfFlagsData) { super(); Object.assign(this, data); }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.flagBasePositionBlue = r.readOptionalVector3(); this.flagCarrierIdBlue = r.readOptionalString(); this.flagPositionBlue = r.readOptionalVector3(); this.blueFlagSprite = r.readResource(); this.bluePedestalModel = r.readResource(); this.flagBasePositionRed = r.readOptionalVector3(); this.flagCarrierIdRed = r.readOptionalString(); this.flagPositionRed = r.readOptionalVector3(); this.redFlagSprite = r.readResource(); this.redPedestalModel = r.readResource(); this.flagDropSound = r.readResource(); this.flagReturnSound = r.readResource(); this.flagTakeSound = r.readResource(); this.winSound = r.readResource(); }
    write(): Buffer { const w = new BufferWriter(); w.writeOptionalVector3(this.flagBasePositionBlue); w.writeOptionalString(this.flagCarrierIdBlue); w.writeOptionalVector3(this.flagPositionBlue); w.writeResource(this.blueFlagSprite); w.writeResource(this.bluePedestalModel); w.writeOptionalVector3(this.flagBasePositionRed); w.writeOptionalString(this.flagCarrierIdRed); w.writeOptionalVector3(this.flagPositionRed); w.writeResource(this.redFlagSprite); w.writeResource(this.redPedestalModel); w.writeResource(this.flagDropSound); w.writeResource(this.flagReturnSound); w.writeResource(this.flagTakeSound); w.writeResource(this.winSound); return w.getBuffer(); }
    static getId(): number { return 789790814; }
}

export class InitDomPointsPacket extends BasePacket implements BattleTypes.IInitDomPoints {
    keypointTriggerRadius: number = 0; keypointVisorHeight: number = 0; minesRestrictionRadius: number = 0; points: BattleTypes.IDomPoint[] = []; bigLetters: number = 0; blueCircle: number = 0; bluePedestalTexture: number = 0; blueRay: number = 0; blueRayTip: number = 0; neutralCircle: number = 0; neutralPedestalTexture: number = 0; pedestal: number = 0; redCircle: number = 0; redPedestalTexture: number = 0; redRay: number = 0; redRayTip: number = 0; pointCaptureStartNegativeSound: number = 0; pointCaptureStartPositiveSound: number = 0; pointCaptureStopNegativeSound: number = 0; pointCaptureStopPositiveSound: number = 0; pointCapturedNegativeSound: number = 0; pointCapturedPositiveSound: number = 0; pointNeutralizedNegativeSound: number = 0; pointNeutralizedPositiveSound: number = 0; pointScoreDecreasingSound: number = 0; pointScoreIncreasingSound: number = 0;
    constructor(data?: BattleTypes.IInitDomPointsData) { super(); if (data) Object.assign(this, data); }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.keypointTriggerRadius = r.readFloatBE(); this.keypointVisorHeight = r.readFloatBE(); this.minesRestrictionRadius = r.readFloatBE(); const c = r.readInt32BE(); this.points = []; for (let i = 0; i < c; i++) this.points.push({ id: r.readInt32BE(), name: r.readOptionalString(), position: r.readOptionalVector3(), score: r.readFloatBE(), scoreChangeRate: r.readFloatBE(), state: r.readInt32BE(), tankIds: r.readStringArray() }); this.bigLetters = r.readResource(); this.blueCircle = r.readResource(); this.bluePedestalTexture = r.readResource(); this.blueRay = r.readResource(); this.blueRayTip = r.readResource(); this.neutralCircle = r.readResource(); this.neutralPedestalTexture = r.readResource(); this.pedestal = r.readResource(); this.redCircle = r.readResource(); this.redPedestalTexture = r.readResource(); this.redRay = r.readResource(); this.redRayTip = r.readResource(); this.pointCaptureStartNegativeSound = r.readResource(); this.pointCaptureStartPositiveSound = r.readResource(); this.pointCaptureStopNegativeSound = r.readResource(); this.pointCaptureStopPositiveSound = r.readResource(); this.pointCapturedNegativeSound = r.readResource(); this.pointCapturedPositiveSound = r.readResource(); this.pointNeutralizedNegativeSound = r.readResource(); this.pointNeutralizedPositiveSound = r.readResource(); this.pointScoreDecreasingSound = r.readResource(); this.pointScoreIncreasingSound = r.readResource(); }
    write(): Buffer { const w = new BufferWriter(); w.writeFloatBE(this.keypointTriggerRadius); w.writeFloatBE(this.keypointVisorHeight); w.writeFloatBE(this.minesRestrictionRadius); w.writeInt32BE(this.points.length); for (const p of this.points) { w.writeInt32BE(p.id); w.writeOptionalString(p.name); w.writeOptionalVector3(p.position); w.writeFloatBE(p.score); w.writeFloatBE(p.scoreChangeRate); w.writeInt32BE(p.state); w.writeStringArray(p.tankIds); } w.writeResource(this.bigLetters); w.writeResource(this.blueCircle); w.writeResource(this.bluePedestalTexture); w.writeResource(this.blueRay); w.writeResource(this.blueRayTip); w.writeResource(this.neutralCircle); w.writeResource(this.neutralPedestalTexture); w.writeResource(this.pedestal); w.writeResource(this.redCircle); w.writeResource(this.redPedestalTexture); w.writeResource(this.redRay); w.writeResource(this.redRayTip); w.writeResource(this.pointCaptureStartNegativeSound); w.writeResource(this.pointCaptureStartPositiveSound); w.writeResource(this.pointCaptureStopNegativeSound); w.writeResource(this.pointCaptureStopPositiveSound); w.writeResource(this.pointCapturedNegativeSound); w.writeResource(this.pointCapturedPositiveSound); w.writeResource(this.pointNeutralizedNegativeSound); w.writeResource(this.pointNeutralizedPositiveSound); w.writeResource(this.pointScoreDecreasingSound); w.writeResource(this.pointScoreIncreasingSound); return w.getBuffer(); }
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

export class SendBattleChatMessagePacket extends BasePacket implements BattleTypes.ISendBattleChatMessage {
    message: string | null; team: boolean;
    constructor(message: string | null = null, team: boolean = false) { super(); this.message = message; this.team = team; }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.message = r.readOptionalString(); this.team = r.readUInt8() === 1; }
    write(): Buffer { const w = new BufferWriter(); w.writeOptionalString(this.message); w.writeUInt8(this.team ? 1 : 0); return w.getBuffer(); }
    static getId(): number { return 945463181; }
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

export class TankModelDataPacket extends BasePacket implements BattleTypes.ITankModelData {
    jsonData: string | null;
    constructor(jsonData: string | null = null) { super(); this.jsonData = jsonData; }
    read(buffer: Buffer): void { this.jsonData = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.jsonData).getBuffer(); }
    static getId(): number { return -1643824092; }
}

export class TankSpecificationPacket extends BasePacket implements BattleTypes.ITankSpecification {
    nickname: string | null = null; speed: number = 0; maxTurnSpeed: number = 0; turretTurnSpeed: number = 0; acceleration: number = 0; isPro: boolean = false;
    constructor(data?: BattleTypes.ITankSpecificationData) { super(); if (data) Object.assign(this, data); }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.nickname = r.readOptionalString(); this.speed = r.readFloatBE(); this.maxTurnSpeed = r.readFloatBE(); this.turretTurnSpeed = r.readFloatBE(); this.acceleration = r.readFloatBE(); this.isPro = r.readInt16BE() === 1; }
    write(): Buffer { const w = new BufferWriter(); w.writeOptionalString(this.nickname); w.writeFloatBE(this.speed); w.writeFloatBE(this.maxTurnSpeed); w.writeFloatBE(this.turretTurnSpeed); w.writeFloatBE(this.acceleration); w.writeInt16BE(this.isPro ? 1 : 0); return w.getBuffer(); }
    static getId(): number { return -1672577397; }
}

export class TimeCheckerPacket extends BasePacket implements BattleTypes.ITimeChecker {
    value1: number; value2: number;
    constructor(value1: number = 0, value2: number = 0) { super(); this.value1 = value1; this.value2 = value2; }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.value1 = r.readInt32BE(); this.value2 = r.readInt32BE(); }
    write(): Buffer { const w = new BufferWriter(); w.writeInt32BE(this.value1); w.writeInt32BE(this.value2); return w.getBuffer(); }
    static getId(): number { return 34068208; }
}

export class TimeCheckerResponsePacket extends BasePacket implements BattleTypes.ITimeCheckerResponse {
    clientTime: number; serverTime: number;
    constructor(clientTime: number = 0, serverTime: number = 0) { super(); this.clientTime = clientTime; this.serverTime = serverTime; }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.clientTime = r.readInt32BE(); this.serverTime = r.readInt32BE(); }
    write(): Buffer { const w = new BufferWriter(); w.writeInt32BE(this.clientTime); w.writeInt32BE(this.serverTime); return w.getBuffer(); }
    static getId(): number { return 2074243318; }
}

export class UnloadSpaceBattlePacket extends BasePacket implements BattleTypes.IUnloadSpaceBattle {
    read(buffer: Buffer): void { }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return -985579124; }
}

export class UpdateBattleUserDMPacket extends BasePacket implements BattleTypes.IUpdateBattleUserDM {
    deaths: number; kills: number; score: number; nickname: string | null;
    constructor(data?: BattleTypes.IUpdateBattleUserDMData) { super(); this.deaths = data?.deaths ?? 0; this.kills = data?.kills ?? 0; this.score = data?.score ?? 0; this.nickname = data?.nickname ?? null; }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.deaths = r.readInt32BE(); this.kills = r.readInt32BE(); this.score = r.readInt32BE(); this.nickname = r.readOptionalString(); }
    write(): Buffer { const w = new BufferWriter(); w.writeInt32BE(this.deaths); w.writeInt32BE(this.kills); w.writeInt32BE(this.score); w.writeOptionalString(this.nickname); return w.getBuffer(); }
    static getId(): number { return 696140460; }
}

export class UpdateBattleUserTeamPacket extends BasePacket implements BattleTypes.IUpdateBattleUserTeam {
    deaths: number; kills: number; score: number; nickname: string | null; team: number;
    constructor(data?: BattleTypes.IUpdateBattleUserTeamData) { super(); this.deaths = data?.deaths ?? 0; this.kills = data?.kills ?? 0; this.score = data?.score ?? 0; this.nickname = data?.nickname ?? null; this.team = data?.team ?? 2; }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.deaths = r.readInt32BE(); this.kills = r.readInt32BE(); this.score = r.readInt32BE(); this.nickname = r.readOptionalString(); this.team = r.readInt32BE(); }
    write(): Buffer { const w = new BufferWriter(); w.writeInt32BE(this.deaths); w.writeInt32BE(this.kills); w.writeInt32BE(this.score); w.writeOptionalString(this.nickname); w.writeInt32BE(this.team); return w.getBuffer(); }
    static getId(): number { return -497293992; }
}

export class UpdateSpectatorListPacket extends BasePacket implements BattleTypes.IUpdateSpectatorList {
    spectatorList: string | null;
    constructor(spectatorList: string | null = null) { super(); this.spectatorList = spectatorList; }
    read(buffer: Buffer): void { this.spectatorList = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.spectatorList).getBuffer(); }
    static getId(): number { return -1331361684; }
}

export class UserConnectDMPacket extends BasePacket implements BattleTypes.IUserConnectDM {
    nickname: string | null; usersInfo: BattleTypes.IBattleUserInfo[];
    constructor(nickname: string | null, usersInfo: BattleTypes.IBattleUserInfo[]) { super(); this.nickname = nickname; this.usersInfo = usersInfo; }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.nickname = r.readOptionalString(); const c = r.readInt32BE(); this.usersInfo = []; for (let i = 0; i < c; i++) { this.usersInfo.push({ ChatModeratorLevel: r.readInt32BE(), deaths: r.readInt32BE(), kills: r.readInt32BE(), rank: r.readUInt8(), score: r.readInt32BE(), nickname: r.readOptionalString() }); } }
    write(): Buffer { const w = new BufferWriter(); w.writeOptionalString(this.nickname); w.writeInt32BE(this.usersInfo.length); for (const u of this.usersInfo) { w.writeInt32BE(u.ChatModeratorLevel); w.writeInt32BE(u.deaths); w.writeInt32BE(u.kills); w.writeUInt8(u.rank); w.writeInt32BE(u.score); w.writeOptionalString(u.nickname); } return w.getBuffer(); }
    static getId(): number { return 862913394; }
}

export class UserDisconnectedDmPacket extends BasePacket implements BattleTypes.IUserDisconnectedDm {
    nickname: string | null;
    constructor(nickname: string | null = null) { super(); this.nickname = nickname; }
    read(buffer: Buffer): void { this.nickname = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.nickname).getBuffer(); }
    static getId(): number { return -1689876764; }
}

export class WeaponPhysicsPacket extends BasePacket implements BattleTypes.IWeaponPhysics {
    jsonData: string | null;
    constructor(jsonData: string | null = null) { super(); this.jsonData = jsonData; }
    read(buffer: Buffer): void { this.jsonData = new BufferReader(buffer).readOptionalString(); }
    write(): Buffer { return new BufferWriter().writeOptionalString(this.jsonData).getBuffer(); }
    static getId(): number { return -2124388778; }
}

export class TakeFlagPacket extends BasePacket implements BattleTypes.ITakeFlag {
    nickname: string | null;
    team: number;
    constructor(nickname: string | null = null, team: number = 0) { super(); this.nickname = nickname; this.team = team; }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.nickname = r.readOptionalString(); this.team = r.readInt32BE(); }
    write(): Buffer { const w = new BufferWriter(); w.writeOptionalString(this.nickname); w.writeInt32BE(this.team); return w.getBuffer(); }
    static getId(): number { return -1282406496; }
}

export class DropFlagRequestPacket extends BasePacket implements BattleTypes.IDropFlagRequest {
    read(buffer: Buffer): void { }
    write(): Buffer { return new BufferWriter().getBuffer(); }
    static getId(): number { return -1832611824; }
}

export class DropFlagPacket extends BasePacket implements BattleTypes.IDropFlag {
    position: BattleTypes.IVector3 | null;
    team: number;
    constructor(position: BattleTypes.IVector3 | null = null, team: number = 0) { super(); this.position = position; this.team = team; }
    read(buffer: Buffer): void { const r = new BufferReader(buffer); this.position = r.readOptionalVector3(); this.team = r.readInt32BE(); }
    write(): Buffer { const w = new BufferWriter(); w.writeOptionalVector3(this.position); w.writeInt32BE(this.team); return w.getBuffer(); }
    static getId(): number { return 1925237062; }
}

export class ReturnFlagPacket extends BasePacket implements BattleTypes.IReturnFlag {
    team: number;
    nickname: string | null;
    constructor(data?: BattleTypes.IReturnFlagData) {
        super();
        this.team = data?.team ?? 0;
        this.nickname = data?.nickname ?? null;
    }
    read(buffer: Buffer): void {
        const r = new BufferReader(buffer);
        this.team = r.readInt32BE();
        this.nickname = r.readOptionalString();
    }
    write(): Buffer {
        const w = new BufferWriter();
        w.writeInt32BE(this.team);
        w.writeOptionalString(this.nickname);
        return w.getBuffer();
    }
    static getId(): number {
        return -1026428589;
    }
}

export class CaptureFlagPacket extends BasePacket implements BattleTypes.ICaptureFlag {
    team: number;
    nickname: string | null;
    constructor(data?: BattleTypes.ICaptureFlagData) {
        super();
        this.team = data?.team ?? 0;
        this.nickname = data?.nickname ?? null;
    }
    read(buffer: Buffer): void {
        const r = new BufferReader(buffer);
        this.team = r.readInt32BE();
        this.nickname = r.readOptionalString();
    }
    write(): Buffer {
        const w = new BufferWriter();
        w.writeInt32BE(this.team);
        w.writeOptionalString(this.nickname);
        return w.getBuffer();
    }
    static getId(): number {
        return -1870108387;
    }
}