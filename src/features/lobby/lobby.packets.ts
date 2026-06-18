import { BattleMode, EquipmentConstraintsMode, MapTheme } from "@/features/battle/battle.model";
import { PacketSchema, readSchema, writeSchema } from "@/packets/packet-schema";
import { BasePacket } from "@/packets/base.packet";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import { ResourceManager } from "@/utils/resource.manager";
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
    static readonly schema: PacketSchema = [
        { name: "autoBalance", type: "bool" },
        { name: "battleMode", type: "i32" },
        { name: "equipmentConstraintsMode", type: "i32" },
        { name: "friendlyFire", type: "bool" },
        { name: "scoreLimit", type: "i32" },
        { name: "timeLimitInSec", type: "i32" },
        { name: "mapId", type: "string" },
        { name: "maxPeopleCount", type: "i32" },
        { name: "name", type: "string" },
        { name: "parkourMode", type: "bool" },
        { name: "privateBattle", type: "bool" },
        { name: "proBattle", type: "bool" },
        { name: "maxRank", type: "i32" },
        { name: "minRank", type: "i32" },
        { name: "reArmorEnabled", type: "bool" },
        { name: "mapTheme", type: "i32" },
        { name: "withoutBonuses", type: "bool" },
        { name: "withoutCrystals", type: "bool" },
        { name: "withoutSupplies", type: "bool" },
        { name: "withoutUpgrades", type: "bool" },
        { name: "reducedResistances", type: "bool" },
        { name: "esportDropTiming", type: "bool" },
        { name: "withoutGoldBoxes", type: "bool" },
        { name: "withoutGoldSiren", type: "bool" },
        { name: "withoutGoldZone", type: "bool" },
        { name: "withoutMedkit", type: "bool" },
        { name: "withoutMines", type: "bool" },
        { name: "randomGold", type: "bool" },
        { name: "dependentCooldownEnabled", type: "bool" },
    ];
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
    read(buffer: Buffer): void { readSchema(this, CreateBattleRequest.schema, buffer); }
    write(): Buffer { return writeSchema(this, CreateBattleRequest.schema); }
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
    static readonly schema: PacketSchema = [
        { name: "crystals", type: "i32" },
        { name: "currentRankScore", type: "i32" },
        { name: "durationCrystalAbonement", type: "i32" },
        { name: "hasDoubleCrystal", type: "bool" },
        { name: "nextRankScore", type: "i32" },
        { name: "place", type: "i32" },
        { name: "rank", type: "u8" },
        { name: "rating", type: "f32" },
        { name: "score", type: "i32" },
        { name: "serverNumber", type: "i32" },
        { name: "nickname", type: "string" },
        { name: "userProfileUrl", type: "string" },
    ];
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
    read(buffer: Buffer): void { readSchema(this, LobbyData.schema, buffer); }
    write(): Buffer { return writeSchema(this, LobbyData.schema); }
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
    static readonly schema: PacketSchema = [
        { name: "battleId", type: "string" },
        { name: "nickname", type: "string" },
    ];
    battleId: string | null;
    nickname: string | null;
    constructor(data?: LobbyTypes.IReleasePlayerSlotDmData) {
        super();
        this.battleId = data?.battleId ?? null;
        this.nickname = data?.nickname ?? null;
    }
    read(buffer: Buffer): void { readSchema(this, ReleasePlayerSlotDmPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, ReleasePlayerSlotDmPacket.schema); }
    static getId(): number {
        return 504016996;
    }
}

export class ReservePlayerSlotDmPacket extends BasePacket implements LobbyTypes.IReservePlayerSlotDm {
    static readonly schema: PacketSchema = [
        { name: "battleId", type: "string" },
        { name: "nickname", type: "string" },
    ];
    battleId: string | null;
    nickname: string | null;
    constructor(battleId: string | null = null, nickname: string | null = null) {
        super();
        this.battleId = battleId;
        this.nickname = nickname;
    }
    read(buffer: Buffer): void { readSchema(this, ReservePlayerSlotDmPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, ReservePlayerSlotDmPacket.schema); }
    static getId(): number {
        return -2133657895;
    }
}

export class AddUserToBattleDmPacket extends BasePacket implements LobbyTypes.IAddUserToBattleDm {
    static readonly schema: PacketSchema = [
        { name: "battleId", type: "string" },
        { name: "kills", type: "i32" },
        { name: "score", type: "i32" },
        { name: "suspicious", type: "bool" },
        { name: "nickname", type: "string" },
    ];
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
    read(buffer: Buffer): void { readSchema(this, AddUserToBattleDmPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, AddUserToBattleDmPacket.schema); }
    static getId(): number {
        return -911626491;
    }
}

export class RemoveUserFromBattleLobbyPacket extends BasePacket implements LobbyTypes.IRemoveUserFromBattleLobby {
    static readonly schema: PacketSchema = [
        { name: "battleId", type: "string" },
        { name: "nickname", type: "string" },
    ];
    battleId: string | null;
    nickname: string | null;
    constructor(data?: LobbyTypes.IRemoveUserFromBattleLobbyData) {
        super();
        this.battleId = data?.battleId ?? null;
        this.nickname = data?.nickname ?? null;
    }
    read(buffer: Buffer): void { readSchema(this, RemoveUserFromBattleLobbyPacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, RemoveUserFromBattleLobbyPacket.schema); }
    static getId(): number {
        return 1924874982;
    }
}

export class NotifyFriendOfBattlePacket extends BasePacket implements LobbyTypes.INotifyFriendOfBattle {
    static readonly schema: PacketSchema = [
        { name: "battleId", type: "string" },
        { name: "mapName", type: "string" },
        { name: "mode", type: "i32" },
        { name: "privateBattle", type: "bool" },
        { name: "probattle", type: "bool" },
        { name: "maxRank", type: "i32" },
        { name: "minRank", type: "i32" },
        { name: "serverNumber", type: "i32" },
        { name: "nickname", type: "string" },
    ];
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
    read(buffer: Buffer): void { readSchema(this, NotifyFriendOfBattlePacket.schema, buffer); }
    write(): Buffer { return writeSchema(this, NotifyFriendOfBattlePacket.schema); }
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
    static readonly schema: PacketSchema = [
        { name: "soundIdLow", type: "resource" },
    ];
    soundIdLow: number;

    constructor(soundIdLow: number) {
        super();
        this.soundIdLow = soundIdLow;
    }

    read(buffer: Buffer): void { readSchema(this, SetBattleInviteSound.schema, buffer); }

    write(): Buffer { return writeSchema(this, SetBattleInviteSound.schema); }
    static getId(): number {
        return 834877801;
    }
}
// S->C: initializes the clan module in the lobby (this is what makes the CLAN button appear). It
// carries the static clan-system config (7 nested Alternativa sub-models). We ASSEMBLE it field by
// field; the layout matches the official capture (2026-06-18_07-43). The only fields with a
// confident meaning are the clan creation cost and the trailing RESOURCE (the rankings podium image
// — 2/silver 1/gold 3/bronze); the rest are module flags and the (empty) clan state. The podium
// resource is OUR own ("clan/podium"), resolved at runtime — not the official's id.
// NOTE: the per-user clan tag is a SEPARATE packet (ClanNotifierData, id -117055417).
export class InitUserClanModelsPacket extends BasePacket {
    static readonly CREATION_COST = 500000; // crystals to create a clan (0x7A120)
    read(buffer: Buffer): void { throw new Error("This is a server-to-client packet only."); }
    write(): Buffer {
        return new BufferWriter()
            .writeInt8(1).writeInt8(1).writeInt8(1) // module-enabled flags
            .writeInt32BE(0)
            .writeInt8(1).writeInt8(1)
            .writeInt32BE(InitUserClanModelsPacket.CREATION_COST)
            .writeInt32BE(0)
            .writeInt8(1)
            .writeInt8(8)
            // empty clan state (sub-model vectors / counters — all zero in the base config)
            .writeInt32BE(0).writeInt32BE(0).writeInt32BE(0)
            .writeInt32BE(0).writeInt32BE(0).writeInt32BE(0)
            .writeInt8(0)
            .writeResource(ResourceManager.getIdlowById("clan/podium")) // rankings podium image
            .getBuffer();
    }
    static getId(): number { return -1338449818; }
}
