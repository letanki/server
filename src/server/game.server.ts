import { DEFAULT_MAX_CLIENTS, DEFAULT_PORT } from "@/config/constants";
import { ConfigService } from "@/core/config/config.service";
import { AuthService } from "@/features/authentication/auth.service";
import { IRegistrationForm } from "@/features/authentication/auth.types";
import { BattleService } from "@/features/battle/battle.service";
import { ChatService } from "@/features/chat/chat.service";
import { CommandService } from "@/features/chat/commands/command.service";
import { ClanService } from "@/features/clan/clan.service";
import { FriendsService } from "@/features/friends/friends.service";
import { GarageService } from "@/features/garage/garage.service";
import { InviteService } from "@/features/invite/invite.service";
import { IInviteResponse } from "@/features/invite/invite.types";
import { LobbyService } from "@/features/lobby/lobby.service";
import { OnlineNotifierData } from "@/features/profile/profile.packets";
import { ProfileService } from "@/features/profile/profile.service";
import { QuestService } from "@/features/quests/quests.service";
import { ReferralService } from "@/features/referral/referral.service";
import { SettingsService } from "@/features/settings/settings.service";
import { ShopService } from "@/features/shop/shop.service";
import { PacketHandlerService } from "@/packets/packet-handler.service";
import { IPacket } from "@/packets/packet.interfaces";
import { PacketService } from "@/packets/packet.service";
import { RankService } from "@/shared/services/rank.service";
import { UserService } from "@/shared/services/user.service";
import logger from "@/utils/logger";
import net from "net";
import { ClientManager } from "./client.manager";
import { GameClient } from "./game.client";
import { IServerOptions } from "./server.types";

export interface IServerServices {
  configService: ConfigService;
  userService: UserService;
  inviteService: InviteService;
  chatService: ChatService;
  commandService: CommandService;
  packetHandlerService: PacketHandlerService;
  packetService: PacketService;
  shopService: ShopService;
  rankService: RankService;
  questService: QuestService;
  garageService: GarageService;
  friendsService: FriendsService;
  authService: AuthService;
  lobbyService: LobbyService;
  settingsService: SettingsService;
  referralService: ReferralService;
  profileService: ProfileService;
  clanService: ClanService;
}

export class GameServer {
  private server: net.Server;
  private clientManager: ClientManager;
  private port: number;
  private maxClients: number;
  private needInviteCode: boolean;
  private socialNetworks: Array<string[]>;
  private loginForm: IRegistrationForm;

  private dynamicCallbacks: Map<number, (client: GameClient) => void> = new Map();
  private nextCallbackId: number = 1000;

  public readonly configService: ConfigService;
  public readonly userService: UserService;
  public readonly inviteService: InviteService;
  public readonly chatService: ChatService;
  public readonly commandService: CommandService;
  public readonly packetHandlerService: PacketHandlerService;
  public readonly packetService: PacketService;
  public readonly shopService: ShopService;
  public readonly rankService: RankService;
  public readonly questService: QuestService;
  public get battleService(): BattleService {
    return this._getBattleService();
  }
  public readonly garageService: GarageService;
  public readonly friendsService: FriendsService;
  public readonly authService: AuthService;
  public readonly lobbyService: LobbyService;
  public readonly settingsService: SettingsService;
  public readonly referralService: ReferralService;
  public readonly profileService: ProfileService;
  public readonly clanService: ClanService;

  private _getBattleService: () => BattleService;

  constructor(options: IServerOptions, getBattleService: () => BattleService, services: IServerServices) {
    this.validateOptions(options);
    this.port = options.port;
    this.maxClients = options.maxClients;
    this.needInviteCode = options.needInviteCode;
    this.socialNetworks = options.socialNetworks;
    this.loginForm = options.loginForm;

    this._getBattleService = getBattleService;
    this.configService = services.configService;
    this.userService = services.userService;
    this.inviteService = services.inviteService;
    this.chatService = services.chatService;
    this.commandService = services.commandService;
    this.packetHandlerService = services.packetHandlerService;
    this.packetService = services.packetService;
    this.shopService = services.shopService;
    this.rankService = services.rankService;
    this.questService = services.questService;
    this.garageService = services.garageService;
    this.friendsService = services.friendsService;
    this.authService = services.authService;
    this.lobbyService = services.lobbyService;
    this.settingsService = services.settingsService;
    this.referralService = services.referralService;
    this.profileService = services.profileService;
    this.clanService = services.clanService;

    this.server = net.createServer(this.handleConnection.bind(this));
    this.clientManager = new ClientManager();
  }

  private validateOptions(options: IServerOptions): void {
    if (!options.port || options.port <= 0) {
      options.port = DEFAULT_PORT;
    }
    if (!options.maxClients || options.maxClients < 0) {
      options.maxClients = DEFAULT_MAX_CLIENTS;
    }
    if (!options.loginForm || !options.socialNetworks) {
      throw new Error("Missing required server options: loginForm or socialNetworks");
    }
  }

  public start(): void {
    this.server.listen(this.port, () => {
      logger.info(`LeTanki Server started`, {
        port: this.port,
        maxClients: this.maxClients,
      });
    });

    this.server.on("error", (err) => {
      logger.error("Server error", { error: err });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((err) => {
        if (err) {
          logger.error("Error stopping LeTanki Server", { error: err });
          return reject(err);
        }
        this.clientManager.getClients().forEach((client) => client.closeConnection());
        resolve();
      });
    });
  }

  public addClient(client: GameClient): void {
    this.clientManager.addClient(client);
  }

  public removeClient(client: GameClient): void {
    this.clientManager.removeClient(client);
  }

  /** Index an authenticated client for O(1) username lookups. Call after client.user is set. */
  public indexAuthenticatedClient(client: GameClient): void {
    this.clientManager.indexUsername(client);
  }

  private handleConnection(socket: net.Socket): void {
    if (this.clientManager.getClientCount() >= this.maxClients) {
      logger.warn(`Connection rejected: server at max capacity`, {
        maxClients: this.maxClients,
        client: socket.remoteAddress,
      });
      socket.write("Server is full. Try again later.\n");
      socket.end();
      return;
    }

    logger.info(`New client connected`, {
      client: socket.remoteAddress || "unknown",
    });
    new GameClient({ socket, server: this });
  }

  public getClients(): GameClient[] {
    return this.clientManager.getClients();
  }

  public findClientByIp(ip: string): GameClient | undefined {
    return this.clientManager.findClientByIp(ip);
  }

  public findClientByUsername(username: string): GameClient | undefined {
    return this.clientManager.findClientByUsername(username);
  }

  public getNeedInviteCode(): boolean {
    return this.needInviteCode;
  }

  public getSocialNetworks(): Array<string[]> {
    return this.socialNetworks;
  }

  public getLoginForm(): IRegistrationForm {
    return this.loginForm;
  }

  public async validateInviteCode(code: string): Promise<IInviteResponse> {
    try {
      return await this.inviteService.validateInviteCode(code);
    } catch (error) {
      logger.error(`Error validating invite code ${code}`, { error });
      throw error;
    }
  }

  public broadcastToAll(packet: IPacket): void {
    this.clientManager.getClients().forEach((client) => client.sendPacket(packet));
  }

  // Pending-restart window (set by the /update admin command). While active, creating or joining a
  // battle is refused with a BattleHaltPacket.
  private restartAt: number | null = null;

  /** Opens the restart window for `seconds` (matches the HaltServer countdown shown to clients). */
  public beginRestart(seconds: number): void {
    this.restartAt = Date.now() + seconds * 1000;
  }

  /** True while the restart countdown is still running. */
  public isRestartPending(): boolean {
    return this.restartAt !== null && Date.now() < this.restartAt;
  }

  public broadcastToLobbyChat(packet: IPacket): void {
    this.clientManager.sendToLobbyChatListeners(packet);
  }

  public broadcastToBattleList(packet: IPacket, filter?: (client: GameClient) => boolean): void {
    this.clientManager.sendToBattleListWatchers(packet, filter);
  }

  public notifySubscribersOfStatusChange(username: string, isOnline: boolean, serverNumber: number = 1): void {
    const lowerCaseUsername = username.toLowerCase();

    this.clientManager.getClients().forEach((client) => {
      if (client.subscriptions.has(lowerCaseUsername)) {
        logger.info(`Notifying ${client.user?.username} about status change for ${username}`);
        client.sendPacket(new OnlineNotifierData(isOnline, serverNumber, username));
      }
    });
  }

  public registerDynamicCallback(callback: (client: GameClient) => void): number {
    const id = this.nextCallbackId++;
    this.dynamicCallbacks.set(id, callback);
    return id;
  }

  public executeDynamicCallback(id: number, client: GameClient): boolean {
    const cb = this.dynamicCallbacks.get(id);
    if (cb) {
      cb(client);
      return true;
    }
    return false;
  }

  public removeDynamicCallback(id: number): void {
    this.dynamicCallbacks.delete(id);
  }
}