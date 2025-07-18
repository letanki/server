import { UserDocument } from "./User";
import * as crypto from "crypto";
import { IVector3 } from "../packets/interfaces/geom/IVector3";

export enum BattleMode {
  DM,
  TDM,
  CTF,
  CP,
  AS,
}

export enum EquipmentConstraintsMode {
  NONE,
  HORNET_RAILGUN,
  WASP_RAILGUN,
  HORNET_WASP_RAILGUN,
}

export enum MapTheme {
  SUMMER,
  WINTER,
  SPACE,
  SUMMER_DAY,
  SUMMER_NIGHT,
  WINTER_DAY,
  WINTER_NIGHT,
}

export interface IBattleCreationSettings {
  name: string;
  privateBattle: boolean;
  proBattle: boolean;
  battleMode: BattleMode;
  mapId: string;
  maxPeopleCount: number;
  minRank: number;
  maxRank: number;
  timeLimitInSec: number;
  scoreLimit: number;
  autoBalance: boolean;
  friendlyFire: boolean;
  parkourMode: boolean;
  equipmentConstraintsMode: EquipmentConstraintsMode;
  reArmorEnabled: boolean;
  mapTheme: MapTheme;
  withoutBonuses: boolean;
  withoutCrystals: boolean;
  withoutSupplies: boolean;
  withoutUpgrades: boolean;
  reducedResistances: boolean;
  esportDropTiming: boolean;
  withoutGoldBoxes: boolean;
  withoutGoldSiren: boolean;
  withoutGoldZone: boolean;
  withoutMedkit: boolean;
  withoutMines: boolean;
  randomGold: boolean;
  dependentCooldownEnabled: boolean;
}

export class Battle {
  public readonly battleId: string;
  public readonly settings: IBattleCreationSettings;
  public users: UserDocument[] = [];
  public usersBlue: UserDocument[] = [];
  public usersRed: UserDocument[] = [];
  public spectators: UserDocument[] = [];
  public scoreBlue: number = 0;
  public scoreRed: number = 0;
  public roundStarted: boolean = false;
  public roundStartTime: number | null = null;
  public flagBasePositionBlue: IVector3 | null = null;
  public flagBasePositionRed: IVector3 | null = null;
  public flagPositionBlue: IVector3 | null = null;
  public flagPositionRed: IVector3 | null = null;
  public flagCarrierBlue: UserDocument | null = null;
  public flagCarrierRed: UserDocument | null = null;

  constructor(settings: IBattleCreationSettings) {
    this.battleId = crypto.randomBytes(8).toString("hex");
    this.settings = settings;
  }

  public isTeamMode(): boolean {
    return this.settings.battleMode !== BattleMode.DM;
  }

  public getAllParticipants(): UserDocument[] {
    return [...this.users, ...this.usersBlue, ...this.usersRed, ...this.spectators];
  }
}