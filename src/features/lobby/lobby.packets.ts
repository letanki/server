import { BasePacket } from "@/packets/base.packet";
import { packetClass } from "@/packets/packet-class";
import { ResourceManager } from "@/utils/resource.manager";
import { defs, encodeBody, decodeBody } from "protanki-protocol";
import * as LobbyTypes from "./lobby.types";

// IDs e schemas em `protanki-protocol` (defs.lobby.*).

export const BattleInfo = packetClass(defs.lobby.BattleInfo);
export type BattleInfo = InstanceType<typeof BattleInfo>;

export const BattleList = packetClass(defs.lobby.BattleList);
export type BattleList = InstanceType<typeof BattleList>;

export const BattleDetails = packetClass(defs.lobby.BattleDetails);
export type BattleDetails = InstanceType<typeof BattleDetails>;

export const CreateBattleRequest = packetClass(defs.lobby.CreateBattleRequest);
export type CreateBattleRequest = InstanceType<typeof CreateBattleRequest>;

export const CreateBattleResponse = packetClass(defs.lobby.CreateBattleResponse);
export type CreateBattleResponse = InstanceType<typeof CreateBattleResponse>;

// Codec manual: aplica .trim() ao battleId lido.
export class SelectBattlePacket extends BasePacket implements LobbyTypes.ISelectBattle {
    battleId: string | null = null;
    constructor(battleId?: string | null) {
        super();
        if (battleId) { this.battleId = battleId; }
    }
    read(buffer: Buffer): void {
        const { fields } = decodeBody(defs.lobby.SelectBattle, buffer);
        this.battleId = fields.battleId ? fields.battleId.trim() : null;   // .trim() = lógica
    }
    write(): Buffer { return encodeBody(defs.lobby.SelectBattle, { battleId: this.battleId }); }
    static getId(): number { return defs.lobby.SelectBattle.id; }
}

export const RequestBattleByLinkPacket = packetClass(defs.lobby.RequestBattleByLink);
export type RequestBattleByLinkPacket = InstanceType<typeof RequestBattleByLinkPacket>;

export const ValidateBattleNameRequest = packetClass(defs.lobby.ValidateBattleNameRequest);
export type ValidateBattleNameRequest = InstanceType<typeof ValidateBattleNameRequest>;

export const ValidateBattleNameResponse = packetClass(defs.lobby.ValidateBattleNameResponse);
export type ValidateBattleNameResponse = InstanceType<typeof ValidateBattleNameResponse>;

export const LobbyData = packetClass(defs.lobby.LobbyData);
export type LobbyData = InstanceType<typeof LobbyData>;

export const UserNotInBattlePacket = packetClass(defs.lobby.UserNotInBattle);
export type UserNotInBattlePacket = InstanceType<typeof UserNotInBattlePacket>;

export const ReleasePlayerSlotDmPacket = packetClass(defs.lobby.ReleasePlayerSlotDm);
export type ReleasePlayerSlotDmPacket = InstanceType<typeof ReleasePlayerSlotDmPacket>;

export const ReservePlayerSlotDmPacket = packetClass(defs.lobby.ReservePlayerSlotDm);
export type ReservePlayerSlotDmPacket = InstanceType<typeof ReservePlayerSlotDmPacket>;

export const AddUserToBattleDmPacket = packetClass(defs.lobby.AddUserToBattleDm);
export type AddUserToBattleDmPacket = InstanceType<typeof AddUserToBattleDmPacket>;

export const RemoveUserFromBattleLobbyPacket = packetClass(defs.lobby.RemoveUserFromBattleLobby);
export type RemoveUserFromBattleLobbyPacket = InstanceType<typeof RemoveUserFromBattleLobbyPacket>;

export const NotifyFriendOfBattlePacket = packetClass(defs.lobby.NotifyFriendOfBattle);
export type NotifyFriendOfBattlePacket = InstanceType<typeof NotifyFriendOfBattlePacket>;

export const UnloadBattleListPacket = packetClass(defs.lobby.UnloadBattleList);
export type UnloadBattleListPacket = InstanceType<typeof UnloadBattleListPacket>;

export const RequestLobbyPacket = packetClass(defs.lobby.RequestLobby);
export type RequestLobbyPacket = InstanceType<typeof RequestLobbyPacket>;

export const SetBattleInviteSound = packetClass(defs.lobby.SetBattleInviteSound);
export type SetBattleInviteSound = InstanceType<typeof SetBattleInviteSound>;

// S->C: initializes the clan module in the lobby (this is what makes the CLAN button appear).
// Usa o def OFICIAL da lib (defs.lobby.InitUserClanModels), com campos semânticos. Os VALORES
// dos flags reproduzem exatamente os bytes que o server já enviava no caso vazio (comportamento
// validado, byte-idêntico), enquanto os pedidos de entrada pendentes agora vão no campo oficial
// `outgoingRequestClanIds` — corrigindo o bug de estrutura antigo (que quebrava com 1+ pedido,
// pois mandava 1 list<tag> onde o oficial tem 5 Vector<String> anuláveis).
// NOTE: a tag do clã do próprio usuário vai num pacote SEPARADO (ClanNotifierData, id -117055417),
// por isso `tag` aqui é null.
export class InitUserClanModelsPacket extends BasePacket {
    static readonly CREATION_COST = 500000; // crystals to create a clan (0x7A120)
    // Tags of the clans the user has a PENDING join request to (só quando o usuário não tem clã).
    constructor(private readonly outgoingRequestTags: string[] = []) { super(); }
    read(buffer: Buffer): void { throw new Error("This is a server-to-client packet only."); }
    write(): Buffer {
        return encodeBody(defs.lobby.InitUserClanModels, {
            tag: null,
            giveBonusesToClan: true,
            clansEnabled: true,
            joinCooldownSeconds: 0,
            unknownPanelFlag: true,
            uiLocked: true,
            createCost: InitUserClanModelsPacket.CREATION_COST,
            notificationsCount: 0,
            canCreateClan: true,
            minRankToCreate: 8,
            incomingInviteClanTags: [],
            outgoingRequestClanTags: this.outgoingRequestTags,
            viewedInviteClanTags: [],
            memberNotificationNicks: [],
            joinRequestNicks: [],
            logoImageId: { high: 0, low: ResourceManager.getIdlowById("clan/podium") },
        });
    }
    static getId(): number { return defs.lobby.InitUserClanModels.id; }
}

/** S->C: inicializa a janela do Passe Iniciante (duração + bônus de cristais/XP). Enviado no init pós-login
 *  enquanto o passe estiver ativo. */
export const InitNewbieBonusPacket = packetClass(defs.lobby.InitNewbieBonus);
export type InitNewbieBonusPacket = InstanceType<typeof InitNewbieBonusPacket>;

/** S->C: notícias da janela do lobby. Cada item = { imageUrl, date, textHtml }. */
export const InitNewsPacket = packetClass(defs.lobby.InitNews);
export type InitNewsPacket = InstanceType<typeof InitNewsPacket>;

/** S->C: atualiza os kills de um jogador no roster do lobby (preview de batalha). */
export const UpdateUserKillsPacket = packetClass(defs.lobby.UpdateUserKills);
export type UpdateUserKillsPacket = InstanceType<typeof UpdateUserKillsPacket>;

// --- Team-mode battle-lobby roster (mirror the DM packets, with a `team` field; 0=red, 1=blue). ---

// S->C (battle list): a player reserved a team slot in a battle.
export const OnReserveSlotTeamPacket = packetClass(defs.lobby.OnReserveSlotTeam);
export type OnReserveSlotTeamPacket = InstanceType<typeof OnReserveSlotTeamPacket>;

// S->C (battle list): a player released their team slot.
export const OnReleaseSlotTeamPacket = packetClass(defs.lobby.OnReleaseSlotTeam);
export type OnReleaseSlotTeamPacket = InstanceType<typeof OnReleaseSlotTeamPacket>;

// S->C (battle-details watchers): add a user to a team battle's roster.
export const AddUserTeamPacket = packetClass(defs.lobby.AddUserTeam);
export type AddUserTeamPacket = InstanceType<typeof AddUserTeamPacket>;

// S->C (battle-details watchers): update a user's score in the battle roster.
export const UpdateUserScorePacket = packetClass(defs.lobby.UpdateUserScore);
export type UpdateUserScorePacket = InstanceType<typeof UpdateUserScorePacket>;

// S->C: hide a battle's info panel (e.g. the battle is no longer selectable).
export const HideBattleInfoPacket = packetClass(defs.lobby.HideBattleInfo);
export type HideBattleInfoPacket = InstanceType<typeof HideBattleInfoPacket>;

// S->C: remove a battle from the lobby battle list (e.g. it expired empty). Body: battleId. This is
// the actual list-removal packet (id -1848001147), distinct from HideBattleInfo (panel toggle).
export const RemoveBattleFromListPacket = packetClass(defs.lobby.RemoveBattleFromList);
export type RemoveBattleFromListPacket = InstanceType<typeof RemoveBattleFromListPacket>;

// S->C (lobby battle-preview watchers): the running match round finished — resets the preview timer.
export const RoundFinishPacket = packetClass(defs.lobby.RoundFinish);
export type RoundFinishPacket = InstanceType<typeof RoundFinishPacket>;

// S->C (lobby battle-preview watchers): a team's score changed in the running battle. team 0=red,1=blue.
export const UpdateTeamScorePacket = packetClass(defs.lobby.UpdateTeamScore);
export type UpdateTeamScorePacket = InstanceType<typeof UpdateTeamScorePacket>;
