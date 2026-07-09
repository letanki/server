import { BattleMode, EquipmentConstraintsMode, MapTheme } from "@/features/battle/battle.model";
import { readSchema, writeSchema } from "@/packets/packet-schema";
import { BasePacket } from "@/packets/base.packet";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import { ResourceManager } from "@/utils/resource.manager";
import { defs } from "protanki-protocol";
import * as LobbyTypes from "./lobby.types";

// IDs e schemas em `protanki-protocol` (defs.lobby.*).

export class BattleInfo extends BasePacket implements LobbyTypes.IBattleInfo {
    jsonData: string | null = null;
    constructor(jsonData?: string | null) {
        super();
        if (jsonData) { this.jsonData = jsonData; }
    }
    read(buffer: Buffer): void { readSchema(this, defs.lobby.BattleInfo.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.lobby.BattleInfo.schema!); }
    static getId(): number { return defs.lobby.BattleInfo.id; }
}

export class BattleList extends BasePacket implements LobbyTypes.IBattleList {
    jsonData: string | null = null;
    constructor(jsonData?: string | null) {
        super();
        if (jsonData) { this.jsonData = jsonData; }
    }
    read(buffer: Buffer): void { readSchema(this, defs.lobby.BattleList.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.lobby.BattleList.schema!); }
    static getId(): number { return defs.lobby.BattleList.id; }
}

export class BattleDetails extends BasePacket implements LobbyTypes.IBattleDetails {
    jsonData: string | null = null;
    constructor(jsonData?: string | null) {
        super();
        if (jsonData) { this.jsonData = jsonData; }
    }
    read(buffer: Buffer): void { readSchema(this, defs.lobby.BattleDetails.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.lobby.BattleDetails.schema!); }
    static getId(): number { return defs.lobby.BattleDetails.id; }
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
    read(buffer: Buffer): void { readSchema(this, defs.lobby.CreateBattleRequest.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.lobby.CreateBattleRequest.schema!); }
    static getId(): number { return defs.lobby.CreateBattleRequest.id; }
}

export class CreateBattleResponse extends BasePacket implements LobbyTypes.ICreateBattleResponse {
    jsonData: string | null = null;
    constructor(jsonData?: string | null) {
        super();
        if (jsonData) { this.jsonData = jsonData; }
    }
    read(buffer: Buffer): void { readSchema(this, defs.lobby.CreateBattleResponse.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.lobby.CreateBattleResponse.schema!); }
    static getId(): number { return defs.lobby.CreateBattleResponse.id; }
}

// Codec manual: aplica .trim() ao battleId lido.
export class SelectBattlePacket extends BasePacket implements LobbyTypes.ISelectBattle {
    battleId: string | null = null;
    constructor(battleId?: string | null) {
        super();
        if (battleId) { this.battleId = battleId; }
    }
    read(buffer: Buffer): void {
        const readId = new BufferReader(buffer).readOptionalString();
        this.battleId = readId ? readId.trim() : null;
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.battleId).getBuffer();
    }
    static getId(): number { return defs.lobby.SelectBattle.id; }
}

export class RequestBattleByLinkPacket extends BasePacket implements LobbyTypes.IRequestBattleByLink {
    battleId: string | null = null;
    read(buffer: Buffer): void { readSchema(this, defs.lobby.RequestBattleByLink.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.lobby.RequestBattleByLink.schema!); }
    static getId(): number { return defs.lobby.RequestBattleByLink.id; }
}

export class ValidateBattleNameRequest extends BasePacket implements LobbyTypes.IValidateBattleName {
    name: string | null = null;
    read(buffer: Buffer): void { readSchema(this, defs.lobby.ValidateBattleNameRequest.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.lobby.ValidateBattleNameRequest.schema!); }
    static getId(): number { return defs.lobby.ValidateBattleNameRequest.id; }
}

export class ValidateBattleNameResponse extends BasePacket implements LobbyTypes.IValidateBattleName {
    name: string | null = null;
    constructor(name?: string | null) {
        super();
        if (name) { this.name = name; }
    }
    read(buffer: Buffer): void { readSchema(this, defs.lobby.ValidateBattleNameResponse.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.lobby.ValidateBattleNameResponse.schema!); }
    static getId(): number { return defs.lobby.ValidateBattleNameResponse.id; }
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
        if (data) { Object.assign(this, data); }
    }
    read(buffer: Buffer): void { readSchema(this, defs.lobby.LobbyData.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.lobby.LobbyData.schema!); }
    static getId(): number { return defs.lobby.LobbyData.id; }
}

export class UserNotInBattlePacket extends BasePacket implements LobbyTypes.IUserNotInBattle {
    nickname: string | null;
    constructor(nickname: string | null = null) {
        super();
        this.nickname = nickname;
    }
    read(buffer: Buffer): void { readSchema(this, defs.lobby.UserNotInBattle.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.lobby.UserNotInBattle.schema!); }
    static getId(): number { return defs.lobby.UserNotInBattle.id; }
}

export class ReleasePlayerSlotDmPacket extends BasePacket implements LobbyTypes.IReleasePlayerSlotDm {
    battleId: string | null;
    nickname: string | null;
    constructor(data?: LobbyTypes.IReleasePlayerSlotDmData) {
        super();
        this.battleId = data?.battleId ?? null;
        this.nickname = data?.nickname ?? null;
    }
    read(buffer: Buffer): void { readSchema(this, defs.lobby.ReleasePlayerSlotDm.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.lobby.ReleasePlayerSlotDm.schema!); }
    static getId(): number { return defs.lobby.ReleasePlayerSlotDm.id; }
}

export class ReservePlayerSlotDmPacket extends BasePacket implements LobbyTypes.IReservePlayerSlotDm {
    battleId: string | null;
    nickname: string | null;
    constructor(battleId: string | null = null, nickname: string | null = null) {
        super();
        this.battleId = battleId;
        this.nickname = nickname;
    }
    read(buffer: Buffer): void { readSchema(this, defs.lobby.ReservePlayerSlotDm.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.lobby.ReservePlayerSlotDm.schema!); }
    static getId(): number { return defs.lobby.ReservePlayerSlotDm.id; }
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
    read(buffer: Buffer): void { readSchema(this, defs.lobby.AddUserToBattleDm.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.lobby.AddUserToBattleDm.schema!); }
    static getId(): number { return defs.lobby.AddUserToBattleDm.id; }
}

export class RemoveUserFromBattleLobbyPacket extends BasePacket implements LobbyTypes.IRemoveUserFromBattleLobby {
    battleId: string | null;
    nickname: string | null;
    constructor(data?: LobbyTypes.IRemoveUserFromBattleLobbyData) {
        super();
        this.battleId = data?.battleId ?? null;
        this.nickname = data?.nickname ?? null;
    }
    read(buffer: Buffer): void { readSchema(this, defs.lobby.RemoveUserFromBattleLobby.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.lobby.RemoveUserFromBattleLobby.schema!); }
    static getId(): number { return defs.lobby.RemoveUserFromBattleLobby.id; }
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
    read(buffer: Buffer): void { readSchema(this, defs.lobby.NotifyFriendOfBattle.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.lobby.NotifyFriendOfBattle.schema!); }
    static getId(): number { return defs.lobby.NotifyFriendOfBattle.id; }
}

export class UnloadBattleListPacket extends BasePacket implements LobbyTypes.IUnloadBattleList {
    read(buffer: Buffer): void { readSchema(this, defs.lobby.UnloadBattleList.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.lobby.UnloadBattleList.schema!); }
    static getId(): number { return defs.lobby.UnloadBattleList.id; }
}

export class RequestLobbyPacket extends BasePacket implements LobbyTypes.IRequestLobby {
    read(buffer: Buffer): void { readSchema(this, defs.lobby.RequestLobby.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.lobby.RequestLobby.schema!); }
    static getId(): number { return defs.lobby.RequestLobby.id; }
}

export class SetBattleInviteSound extends BasePacket implements LobbyTypes.ISetBattleInviteSound {
    soundIdLow: number;

    constructor(soundIdLow: number) {
        super();
        this.soundIdLow = soundIdLow;
    }

    read(buffer: Buffer): void { readSchema(this, defs.lobby.SetBattleInviteSound.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.lobby.SetBattleInviteSound.schema!); }
    static getId(): number { return defs.lobby.SetBattleInviteSound.id; }
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
    // Tags of the clans the user has a PENDING join request to. The client renders the "sent requests"
    // list from this Vector<String> at init — without it the modal shows 0 even if the request cards
    // (325031295) were sent. Confirmed by diffing captures: empty (s18) vs 1 request "LGC" (s19).
    constructor(private readonly requestTags: string[] = []) { super(); }
    read(buffer: Buffer): void { throw new Error("This is a server-to-client packet only."); }
    write(): Buffer {
        const w = new BufferWriter()
            .writeInt8(1).writeInt8(1).writeInt8(1) // module-enabled flags
            .writeInt32BE(0)
            .writeInt8(1).writeInt8(1)
            .writeInt32BE(InitUserClanModelsPacket.CREATION_COST)
            .writeInt32BE(0)
            .writeInt8(1)
            .writeInt8(8)
            .writeInt32BE(0).writeInt8(0).writeInt8(0); // 6 pre-vector state bytes (all zero)
        // pending join-requests Vector<String> (int32 count + each tag as optionalString)
        w.writeInt32BE(this.requestTags.length);
        for (const tag of this.requestTags) w.writeOptionalString(tag);
        // remaining clan state (all zero in the base config) + rankings podium resource
        w.writeInt32BE(0).writeInt32BE(0).writeInt32BE(0).writeInt8(0).writeInt8(0).writeInt8(0)
            .writeResource(ResourceManager.getIdlowById("clan/podium"));
        return w.getBuffer();
    }
    static getId(): number { return defs.lobby.InitUserClanModels.id; }
}

// --- Team-mode battle-lobby roster (mirror the DM packets, with a `team` field; 0=red, 1=blue). ---

// S->C (battle list): a player reserved a team slot in a battle.
export class OnReserveSlotTeamPacket extends BasePacket {
    battleId: string | null; nickname: string | null; team: number;
    constructor(battleId: string | null = null, nickname: string | null = null, team: number = 0) {
        super(); this.battleId = battleId; this.nickname = nickname; this.team = team;
    }
    read(buffer: Buffer): void { readSchema(this, defs.lobby.OnReserveSlotTeam.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.lobby.OnReserveSlotTeam.schema!); }
    static getId(): number { return defs.lobby.OnReserveSlotTeam.id; }
}

// S->C (battle list): a player released their team slot.
export class OnReleaseSlotTeamPacket extends BasePacket {
    battleId: string | null; nickname: string | null;
    constructor(battleId: string | null = null, nickname: string | null = null) {
        super(); this.battleId = battleId; this.nickname = nickname;
    }
    read(buffer: Buffer): void { readSchema(this, defs.lobby.OnReleaseSlotTeam.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.lobby.OnReleaseSlotTeam.schema!); }
    static getId(): number { return defs.lobby.OnReleaseSlotTeam.id; }
}

// S->C (battle-details watchers): add a user to a team battle's roster.
export class AddUserTeamPacket extends BasePacket {
    battleId: string | null; nickname: string | null; kills: number; score: number; suspicious: boolean; team: number;
    constructor(data?: { battleId?: string | null; nickname?: string | null; kills?: number; score?: number; suspicious?: boolean; team?: number }) {
        super();
        this.battleId = data?.battleId ?? null;
        this.nickname = data?.nickname ?? null;
        this.kills = data?.kills ?? 0;
        this.score = data?.score ?? 0;
        this.suspicious = data?.suspicious ?? false;
        this.team = data?.team ?? 0;
    }
    read(buffer: Buffer): void { readSchema(this, defs.lobby.AddUserTeam.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.lobby.AddUserTeam.schema!); }
    static getId(): number { return defs.lobby.AddUserTeam.id; }
}

// S->C (battle-details watchers): update a user's score in the battle roster.
export class UpdateUserScorePacket extends BasePacket {
    battleId: string | null; nickname: string | null; score: number;
    constructor(battleId: string | null = null, nickname: string | null = null, score: number = 0) {
        super(); this.battleId = battleId; this.nickname = nickname; this.score = score;
    }
    read(buffer: Buffer): void { readSchema(this, defs.lobby.UpdateUserScore.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.lobby.UpdateUserScore.schema!); }
    static getId(): number { return defs.lobby.UpdateUserScore.id; }
}

// S->C: hide a battle's info panel (e.g. the battle is no longer selectable).
export class HideBattleInfoPacket extends BasePacket {
    battleId: string | null;
    constructor(battleId: string | null = null) { super(); this.battleId = battleId; }
    read(buffer: Buffer): void { readSchema(this, defs.lobby.HideBattleInfo.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.lobby.HideBattleInfo.schema!); }
    static getId(): number { return defs.lobby.HideBattleInfo.id; }
}

// S->C: remove a battle from the lobby battle list (e.g. it expired empty). Body: battleId. This is
// the actual list-removal packet (id -1848001147), distinct from HideBattleInfo (panel toggle).
export class RemoveBattleFromListPacket extends BasePacket {
    battleId: string | null;
    constructor(battleId: string | null = null) { super(); this.battleId = battleId; }
    read(buffer: Buffer): void { readSchema(this, defs.lobby.RemoveBattleFromList.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.lobby.RemoveBattleFromList.schema!); }
    static getId(): number { return defs.lobby.RemoveBattleFromList.id; }
}

// S->C (lobby battle-preview watchers): the running match round finished — resets the preview timer.
export class RoundFinishPacket extends BasePacket {
    battleId: string | null;
    constructor(battleId: string | null = null) { super(); this.battleId = battleId; }
    read(buffer: Buffer): void { readSchema(this, defs.lobby.RoundFinish.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.lobby.RoundFinish.schema!); }
    static getId(): number { return defs.lobby.RoundFinish.id; }
}

// S->C (lobby battle-preview watchers): a team's score changed in the running battle. team 0=red,1=blue.
export class UpdateTeamScorePacket extends BasePacket {
    battleId: string | null; team: number; score: number;
    constructor(battleId: string | null = null, team: number = 0, score: number = 0) { super(); this.battleId = battleId; this.team = team; this.score = score; }
    read(buffer: Buffer): void { readSchema(this, defs.lobby.UpdateTeamScore.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.lobby.UpdateTeamScore.schema!); }
    static getId(): number { return defs.lobby.UpdateTeamScore.id; }
}
