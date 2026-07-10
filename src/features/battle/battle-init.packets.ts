import { packetClass } from "@/packets/packet-class";
import { defs } from "protanki-protocol";

// IDs e schemas em `protanki-protocol` (defs.battle.*).

export const BattleConsumablesPacket = packetClass(defs.battle.BattleConsumables);
export type BattleConsumablesPacket = InstanceType<typeof BattleConsumablesPacket>;

export const BattleMinesPropertiesPacket = packetClass(defs.battle.BattleMinesProperties);
export type BattleMinesPropertiesPacket = InstanceType<typeof BattleMinesPropertiesPacket>;

export const BattleStatsPacket = packetClass(defs.battle.BattleStats);
export type BattleStatsPacket = InstanceType<typeof BattleStatsPacket>;

export const BattleUserEffectsPacket = packetClass(defs.battle.BattleUserEffects);
export type BattleUserEffectsPacket = InstanceType<typeof BattleUserEffectsPacket>;

export const BonusDataPacket = packetClass(defs.battle.BonusData);
export type BonusDataPacket = InstanceType<typeof BonusDataPacket>;

export const InitBonusesPacket = packetClass(defs.battle.InitBonuses);
export type InitBonusesPacket = InstanceType<typeof InitBonusesPacket>;

export const BonusRegionsPacket = packetClass(defs.battle.BonusRegions);
export type BonusRegionsPacket = InstanceType<typeof BonusRegionsPacket>;

export const InitBattleDMPacket = packetClass(defs.battle.InitBattleDM);
export type InitBattleDMPacket = InstanceType<typeof InitBattleDMPacket>;

export const InitBattleTeamPacket = packetClass(defs.battle.InitBattleTeam);
export type InitBattleTeamPacket = InstanceType<typeof InitBattleTeamPacket>;

export const InitBattleUsersDMPacket = packetClass(defs.battle.InitBattleUsersDM);
export type InitBattleUsersDMPacket = InstanceType<typeof InitBattleUsersDMPacket>;

export const InitBattleUsersTeamPacket = packetClass(defs.battle.InitBattleUsersTeam);
export type InitBattleUsersTeamPacket = InstanceType<typeof InitBattleUsersTeamPacket>;

export const InitCtfFlagsPacket = packetClass(defs.battle.InitCtfFlags);
export type InitCtfFlagsPacket = InstanceType<typeof InitCtfFlagsPacket>;

export const InitDomPointsPacket = packetClass(defs.battle.InitDomPoints);
export type InitDomPointsPacket = InstanceType<typeof InitDomPointsPacket>;

export const InitializeBattleStatisticsPacket = packetClass(defs.battle.InitializeBattleStatistics);
export type InitializeBattleStatisticsPacket = InstanceType<typeof InitializeBattleStatisticsPacket>;

export const InitMapPacket = packetClass(defs.battle.InitMap);
export type InitMapPacket = InstanceType<typeof InitMapPacket>;

export const LoadBattleChatPacket = packetClass(defs.battle.LoadBattleChat);
export type LoadBattleChatPacket = InstanceType<typeof LoadBattleChatPacket>;

export const TankModelDataPacket = packetClass(defs.battle.TankModelData);
export type TankModelDataPacket = InstanceType<typeof TankModelDataPacket>;

// The trailing int16 is a per-tank spec SEQUENCE (1, 2, 3...), not isPro: the client applies
// specs in order so a later (e.g. nitro-boosted) spec supersedes the spawn one.
export const TankSpecificationPacket = packetClass(defs.battle.TankSpecification);
export type TankSpecificationPacket = InstanceType<typeof TankSpecificationPacket>;

export const UnloadSpaceBattlePacket = packetClass(defs.battle.UnloadSpaceBattle);
export type UnloadSpaceBattlePacket = InstanceType<typeof UnloadSpaceBattlePacket>;

export const WeaponPhysicsPacket = packetClass(defs.battle.WeaponPhysics);
export type WeaponPhysicsPacket = InstanceType<typeof WeaponPhysicsPacket>;
