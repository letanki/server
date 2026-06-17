import { BattleMode, EquipmentConstraintsMode, MapTheme } from "@/features/battle/battle.model";
import { BasePacket } from "@/packets/base.packet";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import * as LobbyTypes from "./lobby.types";

export class BattleInfo extends BasePacket implements LobbyTypes.IBattleInfo {
    jsonData: string | null = null;
    constructor(jsonData?: string | null) {
        super();
        if (jsonData) {
            this.jsonData = jsonData;
        }
    }
    read(buffer: Buffer): void {
        this.jsonData = new BufferReader(buffer).readOptionalString();
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.jsonData).getBuffer();
    }
    static getId(): number {
        return -838186985;
    }
}

export class BattleList extends BasePacket implements LobbyTypes.IBattleList {
    jsonData: string | null = null;
    constructor(jsonData?: string | null) {
        super();
        if (jsonData) {
            this.jsonData = jsonData;
        }
    }
    read(buffer: Buffer): void {
        this.jsonData = new BufferReader(buffer).readOptionalString();
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.jsonData).getBuffer();
    }
    static getId(): number {
        return 552006706;
    }
}

export class BattleDetails extends BasePacket implements LobbyTypes.IBattleDetails {
    jsonData: string | null = null;
    constructor(jsonData?: string | null) {
        super();
        if (jsonData) {
            this.jsonData = jsonData;
        }
    }
    read(buffer: Buffer): void {
        this.jsonData = new BufferReader(buffer).readOptionalString();
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.jsonData).getBuffer();
    }
    static getId(): number {
        return 546722394;
    }
}

export class CreateBattleRequest extends BasePacket implements LobbyTypes.ICreateBattleRequest {
    autoBalance: boolean = false;
    battleMode: BattleMode = BattleMode.DM;
    equipmentConstraintsMode: EquipmentConstraintsMode = EquipmentConstraintsMode.NONE;
    friendlyFire: boolean = false;
    scoreLimit: number = 0;
    timeLimitInSec: number = 0;
    mapId: string = "";
    maxPeopleCount: number = 0;
    name: string = "";
    parkourMode: boolean = false;
    privateBattle: boolean = false;
    proBattle: boolean = false;
    maxRank: number = 1;
    minRank: number = 1;
    reArmorEnabled: boolean = false;
    mapTheme: MapTheme = MapTheme.SUMMER;
    withoutBonuses: boolean = false;
    withoutCrystals: boolean = false;
    withoutSupplies: boolean = false;
    withoutUpgrades: boolean = false;
    reducedResistances: boolean = false;
    esportDropTiming: boolean = false;
    withoutGoldBoxes: boolean = false;
    withoutGoldSiren: boolean = false;
    withoutGoldZone: boolean = false;
    withoutMedkit: boolean = false;
    withoutMines: boolean = false;
    randomGold: boolean = false;
    dependentCooldownEnabled: boolean = false;
    read(buffer: Buffer): void {
        const r = new BufferReader(buffer);
        this.autoBalance = r.readUInt8() === 1;
        this.battleMode = r.readInt32BE();
        this.equipmentConstraintsMode = r.readInt32BE();
        this.friendlyFire = r.readUInt8() === 1;
        this.scoreLimit = r.readInt32BE();
        this.timeLimitInSec = r.readInt32BE();
        this.mapId = r.readOptionalString() ?? "";
        this.maxPeopleCount = r.readInt32BE();
        this.name = r.readOptionalString() ?? "";
        this.parkourMode = r.readUInt8() === 1;
        this.privateBattle = r.readUInt8() === 1;
        this.proBattle = r.readUInt8() === 1;
        this.maxRank = r.readInt32BE();
        this.minRank = r.readInt32BE();
        this.reArmorEnabled = r.readUInt8() === 1;
        this.mapTheme = r.readInt32BE();
        this.withoutBonuses = r.readUInt8() === 1;
        this.withoutCrystals = r.readUInt8() === 1;
        this.withoutSupplies = r.readUInt8() === 1;
        this.withoutUpgrades = r.readUInt8() === 1;
        this.reducedResistances = r.readUInt8() === 1;
        this.esportDropTiming = r.readUInt8() === 1;
        this.withoutGoldBoxes = r.readUInt8() === 1;
        this.withoutGoldSiren = r.readUInt8() === 1;
        this.withoutGoldZone = r.readUInt8() === 1;
        this.withoutMedkit = r.readUInt8() === 1;
        this.withoutMines = r.readUInt8() === 1;
        this.randomGold = r.readUInt8() === 1;
        this.dependentCooldownEnabled = r.readUInt8() === 1;
    }
    write(): Buffer {
        const w = new BufferWriter();
        w.writeUInt8(this.autoBalance ? 1 : 0);
        w.writeInt32BE(this.battleMode);
        w.writeInt32BE(this.equipmentConstraintsMode);
        w.writeUInt8(this.friendlyFire ? 1 : 0);
        w.writeInt32BE(this.scoreLimit);
        w.writeInt32BE(this.timeLimitInSec);
        w.writeOptionalString(this.mapId);
        w.writeInt32BE(this.maxPeopleCount);
        w.writeOptionalString(this.name);
        w.writeUInt8(this.parkourMode ? 1 : 0);
        w.writeUInt8(this.privateBattle ? 1 : 0);
        w.writeUInt8(this.proBattle ? 1 : 0);
        w.writeInt32BE(this.maxRank);
        w.writeInt32BE(this.minRank);
        w.writeUInt8(this.reArmorEnabled ? 1 : 0);
        w.writeInt32BE(this.mapTheme);
        w.writeUInt8(this.withoutBonuses ? 1 : 0);
        w.writeUInt8(this.withoutCrystals ? 1 : 0);
        w.writeUInt8(this.withoutSupplies ? 1 : 0);
        w.writeUInt8(this.withoutUpgrades ? 1 : 0);
        w.writeUInt8(this.reducedResistances ? 1 : 0);
        w.writeUInt8(this.esportDropTiming ? 1 : 0);
        w.writeUInt8(this.withoutGoldBoxes ? 1 : 0);
        w.writeUInt8(this.withoutGoldSiren ? 1 : 0);
        w.writeUInt8(this.withoutGoldZone ? 1 : 0);
        w.writeUInt8(this.withoutMedkit ? 1 : 0);
        w.writeUInt8(this.withoutMines ? 1 : 0);
        w.writeUInt8(this.randomGold ? 1 : 0);
        w.writeUInt8(this.dependentCooldownEnabled ? 1 : 0);
        return w.getBuffer();
    }
    static getId(): number {
        return -2135234426;
    }
}

export class CreateBattleResponse extends BasePacket implements LobbyTypes.ICreateBattleResponse {
    jsonData: string | null = null;
    constructor(jsonData?: string | null) {
        super();
        if (jsonData) {
            this.jsonData = jsonData;
        }
    }
    read(buffer: Buffer): void {
        this.jsonData = new BufferReader(buffer).readOptionalString();
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.jsonData).getBuffer();
    }
    static getId(): number {
        return 802300608;
    }
}

export class SelectBattlePacket extends BasePacket implements LobbyTypes.ISelectBattle {
    battleId: string | null = null;
    constructor(battleId?: string | null) {
        super();
        if (battleId) {
            this.battleId = battleId;
        }
    }
    read(buffer: Buffer): void {
        const readId = new BufferReader(buffer).readOptionalString();
        this.battleId = readId ? readId.trim() : null;
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.battleId).getBuffer();
    }
    static getId(): number {
        return 2092412133;
    }
}

export class RequestBattleByLinkPacket extends BasePacket implements LobbyTypes.IRequestBattleByLink {
    battleId: string | null = null;
    read(buffer: Buffer): void {
        this.battleId = new BufferReader(buffer).readOptionalString();
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.battleId).getBuffer();
    }
    static getId(): number {
        return -604091695;
    }
}

export class ValidateBattleNameRequest extends BasePacket implements LobbyTypes.IValidateBattleName {
    name: string | null = null;
    read(buffer: Buffer): void {
        this.name = new BufferReader(buffer).readOptionalString();
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.name).getBuffer();
    }
    static getId(): number {
        return 566652736;
    }
}

export class ValidateBattleNameResponse extends BasePacket implements LobbyTypes.IValidateBattleName {
    name: string | null = null;
    constructor(name?: string | null) {
        super();
        if (name) {
            this.name = name;
        }
    }
    read(buffer: Buffer): void {
        this.name = new BufferReader(buffer).readOptionalString();
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.name).getBuffer();
    }
    static getId(): number {
        return 120401338;
    }
}

export class LobbyData extends BasePacket implements LobbyTypes.ILobbyData {
    crystals: number = 0;
    currentRankScore: number = 0;
    durationCrystalAbonement: number = 0;
    hasDoubleCrystal: boolean = false;
    nextRankScore: number = 0;
    place: number = 0;
    rank: number = 0;
    rating: number = 0;
    score: number = 0;
    serverNumber: number = 0;
    nickname: string = "";
    userProfileUrl: string = "";
    constructor(data?: LobbyTypes.ILobbyDataProps) {
        super();
        if (data) {
            Object.assign(this, data);
        }
    }
    read(buffer: Buffer): void {
        const r = new BufferReader(buffer);
        this.crystals = r.readInt32BE();
        this.currentRankScore = r.readInt32BE();
        this.durationCrystalAbonement = r.readInt32BE();
        this.hasDoubleCrystal = r.readUInt8() === 1;
        this.nextRankScore = r.readInt32BE();
        this.place = r.readInt32BE();
        this.rank = r.readUInt8();
        this.rating = r.readFloatBE();
        this.score = r.readInt32BE();
        this.serverNumber = r.readInt32BE();
        this.nickname = r.readOptionalString() ?? "";
        this.userProfileUrl = r.readOptionalString() ?? "";
    }
    write(): Buffer {
        const w = new BufferWriter();
        w.writeInt32BE(this.crystals);
        w.writeInt32BE(this.currentRankScore);
        w.writeInt32BE(this.durationCrystalAbonement);
        w.writeUInt8(this.hasDoubleCrystal ? 1 : 0);
        w.writeInt32BE(this.nextRankScore);
        w.writeInt32BE(this.place);
        w.writeUInt8(this.rank);
        w.writeFloatBE(this.rating);
        w.writeInt32BE(this.score);
        w.writeInt32BE(this.serverNumber);
        w.writeOptionalString(this.nickname);
        w.writeOptionalString(this.userProfileUrl);
        return w.getBuffer();
    }
    static getId(): number {
        return 907073245;
    }
}

export class UserNotInBattlePacket extends BasePacket implements LobbyTypes.IUserNotInBattle {
    nickname: string | null;
    constructor(nickname: string | null = null) {
        super();
        this.nickname = nickname;
    }
    read(buffer: Buffer): void {
        this.nickname = new BufferReader(buffer).readOptionalString();
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.nickname).getBuffer();
    }
    static getId(): number {
        return 1941694508;
    }
}

export class ReleasePlayerSlotDmPacket extends BasePacket implements LobbyTypes.IReleasePlayerSlotDm {
    battleId: string | null;
    nickname: string | null;
    constructor(data?: LobbyTypes.IReleasePlayerSlotDmData) {
        super();
        this.battleId = data?.battleId ?? null;
        this.nickname = data?.nickname ?? null;
    }
    read(buffer: Buffer): void {
        const r = new BufferReader(buffer);
        this.battleId = r.readOptionalString();
        this.nickname = r.readOptionalString();
    }
    write(): Buffer {
        const w = new BufferWriter();
        w.writeOptionalString(this.battleId);
        w.writeOptionalString(this.nickname);
        return w.getBuffer();
    }
    static getId(): number {
        return 504016996;
    }
}

export class ReservePlayerSlotDmPacket extends BasePacket implements LobbyTypes.IReservePlayerSlotDm {
    battleId: string | null;
    nickname: string | null;
    constructor(battleId: string | null = null, nickname: string | null = null) {
        super();
        this.battleId = battleId;
        this.nickname = nickname;
    }
    read(buffer: Buffer): void {
        const r = new BufferReader(buffer);
        this.battleId = r.readOptionalString();
        this.nickname = r.readOptionalString();
    }
    write(): Buffer {
        const w = new BufferWriter();
        w.writeOptionalString(this.battleId);
        w.writeOptionalString(this.nickname);
        return w.getBuffer();
    }
    static getId(): number {
        return -2133657895;
    }
}

export class AddUserToBattleDmPacket extends BasePacket implements LobbyTypes.IAddUserToBattleDm {
    battleId: string | null;
    nickname: string | null;
    kills: number;
    score: number;
    suspicious: boolean;
    constructor(data?: LobbyTypes.IAddUserToBattleDmData) {
        super();
        this.battleId = data?.battleId ?? null;
        this.nickname = data?.nickname ?? null;
        this.kills = data?.kills ?? 0;
        this.score = data?.score ?? 0;
        this.suspicious = data?.suspicious ?? false;
    }
    read(buffer: Buffer): void {
        const r = new BufferReader(buffer);
        this.battleId = r.readOptionalString();
        this.kills = r.readInt32BE();
        this.score = r.readInt32BE();
        this.suspicious = r.readUInt8() === 1;
        this.nickname = r.readOptionalString();
    }
    write(): Buffer {
        const w = new BufferWriter();
        w.writeOptionalString(this.battleId);
        w.writeInt32BE(this.kills);
        w.writeInt32BE(this.score);
        w.writeUInt8(this.suspicious ? 1 : 0);
        w.writeOptionalString(this.nickname);
        return w.getBuffer();
    }
    static getId(): number {
        return -911626491;
    }
}

export class RemoveUserFromBattleLobbyPacket extends BasePacket implements LobbyTypes.IRemoveUserFromBattleLobby {
    battleId: string | null;
    nickname: string | null;
    constructor(data?: LobbyTypes.IRemoveUserFromBattleLobbyData) {
        super();
        this.battleId = data?.battleId ?? null;
        this.nickname = data?.nickname ?? null;
    }
    read(buffer: Buffer): void {
        const r = new BufferReader(buffer);
        this.battleId = r.readOptionalString();
        this.nickname = r.readOptionalString();
    }
    write(): Buffer {
        const w = new BufferWriter();
        w.writeOptionalString(this.battleId);
        w.writeOptionalString(this.nickname);
        return w.getBuffer();
    }
    static getId(): number {
        return 1924874982;
    }
}

export class NotifyFriendOfBattlePacket extends BasePacket implements LobbyTypes.INotifyFriendOfBattle {
    battleId: string | null;
    mapName: string | null;
    mode: BattleMode;
    privateBattle: boolean;
    probattle: boolean;
    maxRank: number;
    minRank: number;
    serverNumber: number;
    nickname: string | null;
    constructor(data?: LobbyTypes.INotifyFriendOfBattleData) {
        super();
        this.battleId = data?.battleId ?? null;
        this.mapName = data?.mapName ?? null;
        this.mode = data?.mode ?? BattleMode.DM;
        this.privateBattle = data?.privateBattle ?? false;
        this.probattle = data?.probattle ?? false;
        this.maxRank = data?.maxRank ?? 0;
        this.minRank = data?.minRank ?? 0;
        this.serverNumber = data?.serverNumber ?? 0;
        this.nickname = data?.nickname ?? null;
    }
    read(buffer: Buffer): void {
        const r = new BufferReader(buffer);
        this.battleId = r.readOptionalString();
        this.mapName = r.readOptionalString();
        this.mode = r.readInt32BE();
        this.privateBattle = r.readUInt8() === 1;
        this.probattle = r.readUInt8() === 1;
        this.maxRank = r.readInt32BE();
        this.minRank = r.readInt32BE();
        this.serverNumber = r.readInt32BE();
        this.nickname = r.readOptionalString();
    }
    write(): Buffer {
        const w = new BufferWriter();
        w.writeOptionalString(this.battleId);
        w.writeOptionalString(this.mapName);
        w.writeInt32BE(this.mode);
        w.writeUInt8(this.privateBattle ? 1 : 0);
        w.writeUInt8(this.probattle ? 1 : 0);
        w.writeInt32BE(this.maxRank);
        w.writeInt32BE(this.minRank);
        w.writeInt32BE(this.serverNumber);
        w.writeOptionalString(this.nickname);
        return w.getBuffer();
    }
    static getId(): number {
        return -1895446889;
    }
}

export class UnloadBattleListPacket extends BasePacket implements LobbyTypes.IUnloadBattleList {
    read(buffer: Buffer): void { }
    write(): Buffer {
        return new BufferWriter().getBuffer();
    }
    static getId(): number {
        return -324155151;
    }
}

export class RequestLobbyPacket extends BasePacket implements LobbyTypes.IRequestLobby {
    read(buffer: Buffer): void { }
    write(): Buffer {
        return new BufferWriter().getBuffer();
    }
    static getId(): number {
        return 1452181070;
    }
}

export class SetBattleInviteSound extends BasePacket implements LobbyTypes.ISetBattleInviteSound {
    soundIdLow: number;

    constructor(soundIdLow: number) {
        super();
        this.soundIdLow = soundIdLow;
    }

    read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        reader.readInt32BE(); // soundResourceId.high (always 0)
        this.soundIdLow = reader.readInt32BE(); // soundResourceId.low
    }

    write(): Buffer {
        const writer = new BufferWriter();
        writer.writeInt32BE(0); // soundResourceId.high
        writer.writeInt32BE(this.soundIdLow); // soundResourceId.low
        return writer.getBuffer();
    }
    static getId(): number {
        return 834877801;
    }
}