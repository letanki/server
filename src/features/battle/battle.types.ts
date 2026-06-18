import { IEmpty, IPacket } from "@/packets/packet.interfaces";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";
import { IVector3 } from "@/shared/types/geom/ivector3";
import { BattleMode, EquipmentConstraintsMode } from "./battle.model";

export { BattleMode, EquipmentConstraintsMode, IVector3 };

export interface IBattleChatMessageData {
    nickname: string | null;
    message: string | null;
    team: number;
}
export interface IBattleChatMessage extends IPacket, IBattleChatMessageData { }

export interface IBattleConsumable {
    id: string;
    count: number;
    slotId: number;
    itemEffectTime: number;
    itemRestSec: number;
}
export interface IBattleConsumables extends IPacket {
    jsonData: string | null;
}

export interface IBattleMine {
    activated: boolean;
    mineId: string | null;
    ownerId: string | null;
    position: IVector3;
}

export interface IBattleMinesPropertiesData {
    activateSound: number;
    activateTimeMsec: number;
    battleMines: IBattleMine[];
    blueMineTexture: number;
    deactivateSound: number;
    enemyMineTexture: number;
    explosionMarkTexture: number;
    explosionSound: number;
    farVisibilityRadius: number;
    friendlyMineTexture: number;
    idleExplosionTexture: number;
    impactForce: number;
    mainExplosionTexture: number;
    minDistanceFromBase: number;
    model3ds: number;
    nearVisibilityRadius: number;
    radius: number;
    redMineTexture: number;
}
export interface IBattleMinesProperties extends IPacket, IBattleMinesPropertiesData { }

export interface IBattleStatsData {
    battleMode: BattleMode;
    equipmentConstraintsMode: EquipmentConstraintsMode;
    fund: number;
    scoreLimit: number;
    timeLimitInSec: number;
    mapName: string | null;
    maxPeopleCount: number;
    parkourMode: boolean;
    premiumBonusInPercent: number;
    spectator: boolean;
    suspiciousUserIds: string[];
    timeLeft: number;
}
export interface IBattleStats extends IBattleStatsData, IPacket { }

export interface IBattleUser {
    chatModeratorLevel: ChatModeratorLevel;
    deaths: number;
    kills: number;
    rank: number;
    score: number;
    uid: string | null;
}

export interface IBattleUserEffects extends IPacket {
    jsonData: string | null;
}

export interface IBonusData extends IPacket {
    jsonData: string | null;
}

export enum BonusType { NITRO, DAMAGE, ARMOR, HEALTH, CRYSTAL, GOLD, SPECIAL, MOON, PUMPKIN, }

export interface IBonusRegionResource {
    bonusResource: number;
    bonusType: BonusType;
}

export interface IBonusRegionData {
    position: IVector3;
    rotation: IVector3;
    bonusType: BonusType;
}

export interface IBonusRegionsData {
    bonusRegionResources: IBonusRegionResource[];
    bonusRegionData: IBonusRegionData[];
}
export interface IBonusRegions extends IPacket, IBonusRegionsData { }

export interface IConfirmDestruction extends IPacket {
    nickname: string | null;
    delaytoSpawn: number;
}

export interface IDestroyTankPacket extends IPacket {
    nickname: string | null;
    readyToSpawnInMs: number;
}

export interface IEnterBattle extends IPacket { battleTeam: number; }
export interface IEnterBattleAsSpectator extends IEmpty { }
export interface IEquipmentChanged extends IPacket { nickname: string | null; }
export interface IExitFromBattle extends IPacket { layout: number; }

export interface IMovePhysics {
    angularVelocity: IVector3 | null;
    control: number;
    linearVelocity: IVector3 | null;
    orientation: IVector3 | null;
    position: IVector3 | null;
}
export interface IFullMoveCommand extends IPacket, IMovePhysics { clientTime: number; incarnation: number; direction: number; }
export interface IMoveCommand extends IPacket, IMovePhysics { clientTime: number; incarnation: number; }
export interface IMovePacketData extends IMovePhysics { nickname: string | null; }
export interface IMovePacket extends IPacket, IMovePacketData { }
export interface IFullMovePacketData extends IMovePhysics { nickname: string | null; direction: number; }
export interface IFullMovePacket extends IPacket, IFullMovePacketData { }

export interface IInitBattleDM extends IEmpty { }
export interface IInitBattleTeam extends IEmpty { }
export interface IInitBattleUsersDM extends IPacket { users: IBattleUser[]; }
export interface IInitBattleUsersTeam extends IPacket { scoreBlue: number; scoreRed: number; usersBlue: IBattleUser[]; usersRed: IBattleUser[]; }

export interface IInitCtfFlagsData {
    flagBasePositionBlue: IVector3 | null;
    flagCarrierIdBlue: string | null;
    flagPositionBlue: IVector3 | null;
    blueFlagSprite: number;
    bluePedestalModel: number;
    flagBasePositionRed: IVector3 | null;
    flagCarrierIdRed: string | null;
    flagPositionRed: IVector3 | null;
    redFlagSprite: number;
    redPedestalModel: number;
    flagDropSound: number;
    flagReturnSound: number;
    flagTakeSound: number;
    winSound: number;
}
export interface IInitCtfFlags extends IPacket, IInitCtfFlagsData { }

export interface IDomPoint {
    id: number;
    name: string | null;
    position: IVector3 | null;
    score: number;
    scoreChangeRate: number;
    state: number;
    tankIds: string[];
}
export interface IInitDomPointsData {
    keypointTriggerRadius: number;
    keypointVisorHeight: number;
    minesRestrictionRadius: number;
    points: IDomPoint[];
    bigLetters: number; blueCircle: number; bluePedestalTexture: number; blueRay: number; blueRayTip: number;
    neutralCircle: number; neutralPedestalTexture: number; pedestal: number; redCircle: number;
    redPedestalTexture: number; redRay: number; redRayTip: number;
    pointCaptureStartNegativeSound: number; pointCaptureStartPositiveSound: number;
    pointCaptureStopNegativeSound: number; pointCaptureStopPositiveSound: number;
    pointCapturedNegativeSound: number; pointCapturedPositiveSound: number;
    pointNeutralizedNegativeSound: number; pointNeutralizedPositiveSound: number;
    pointScoreDecreasingSound: number; pointScoreIncreasingSound: number;
}
export interface IInitDomPoints extends IPacket, IInitDomPointsData { }

export interface IInitializeBattleStatistics extends IEmpty { }
export interface IInitMap extends IPacket { jsonData: string | null; }
export interface ILoadBattleChat extends IEmpty { }
export interface IPrepareToSpawn extends IPacket { position: IVector3 | null; rotation: IVector3 | null; }
export interface IReadyToActivate extends IEmpty { }
export interface IReadyToPlace extends IEmpty { }
export interface IReadyToSpawn extends IEmpty { }
export interface IRemoveTank extends IPacket { nickname: string | null; }

export interface IRotateTurretCommand extends IPacket { clientTime: number; angle: number; control: number; incarnation: number; }
export interface IRotateTurretPacketData { nickname: string | null; angle: number; control: number; }
export interface IRotateTurretPacket extends IPacket, IRotateTurretPacketData { }

export interface ISelfDestructScheduled extends IPacket { time: number; }
export interface ISendBattleChatMessage extends IPacket { message: string | null; team: boolean; }
export interface ISetHealthData { nickname: string | null; health: number; }
export interface ISetHealth extends IPacket, ISetHealthData { }
export interface ISpawnData { nickname: string | null; team: number; position: IVector3 | null; orientation: IVector3 | null; health: number; incarnation: number; }
export interface ISpawn extends IPacket, ISpawnData { }
export interface ISuicidePacket extends IEmpty { }
export interface ITankModelData extends IPacket { jsonData: string | null; }
export interface ITankSpecificationData { nickname: string | null; speed: number; maxTurnSpeed: number; turretTurnSpeed: number; acceleration: number; isPro: boolean; }
export interface ITankSpecification extends IPacket, ITankSpecificationData { }
export interface ITimeChecker extends IPacket { value1: number; value2: number; }
export interface ITimeCheckerResponse extends IPacket { clientTime: number; serverTime: number; }
export interface IUnloadSpaceBattle extends IEmpty { }
export interface IUpdateBattleUserDMData { deaths: number; kills: number; score: number; nickname: string | null; }
export interface IUpdateBattleUserDM extends IPacket, IUpdateBattleUserDMData { }
export interface IUpdateBattleUserTeamData { deaths: number; kills: number; score: number; nickname: string | null; team: number; }
export interface IUpdateBattleUserTeam extends IPacket, IUpdateBattleUserTeamData { }
export interface IUpdateSpectatorList extends IPacket { spectatorList: string | null; }
export interface IBattleUserInfo { ChatModeratorLevel: ChatModeratorLevel; deaths: number; kills: number; rank: number; score: number; nickname: string | null; }
export interface IBattleUserInfoTeam extends IBattleUserInfo { team: number; }
export interface IUserConnectDM extends IPacket { nickname: string | null; usersInfo: IBattleUserInfo[]; }
export interface IUserDisconnectedDm extends IPacket { nickname: string | null; }

export interface IWeaponPhysics extends IPacket {
    jsonData: string | null;
}

export interface ITakeFlag extends IPacket {
    nickname: string | null;
    team: number;
}

export interface IDropFlagRequest extends IEmpty { }

export interface IDropFlag extends IPacket {
    position: IVector3 | null;
    team: number;
}

export interface IReturnFlagData {
    team: number;
    nickname: string | null;
}
export interface IReturnFlag extends IPacket, IReturnFlagData { }

export interface ICaptureFlagData {
    team: number;
    nickname: string | null;
}
export interface ICaptureFlag extends IPacket, ICaptureFlagData { }