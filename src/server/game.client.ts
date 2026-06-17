import { Protection } from "@/core/security/security.packets";
import { SecurityService } from "@/core/security/security.service";
import { Battle } from "@/features/battle/battle.model";
import { TimeCheckerPacket } from "@/features/battle/battle.packets";
import { Ping } from "@/features/system/system.packets";
import { IPacket } from "@/packets/packet.interfaces";
import { UserDocument } from "@/shared/models/user.model";
import { IVector3 } from "@/shared/types/geom/ivector3";
import logger from "@/utils/logger";
import * as net from "net";
import { ClientState } from "./client.state";
import { IClientOptions } from "./client.types";
import { GameServer } from "./game.server";

interface PacketQueueItem {
  packetId: number;
  packetData: Buffer;
}

interface ISpawnPoint {
  position: IVector3;
  rotation: IVector3;
}

export class GameClient {
  private static readonly HEADER_SIZE = 8;
  private socket: net.Socket;
  private server: GameServer;
  private state: ClientState;
  private securityService: SecurityService;
  private rawDataReceived: Buffer = Buffer.alloc(0);
  public language: string | null = null;
  public captchaSolution: string | null = null;
  public recoveryCode: string | null = null;
  public recoveryEmail: string | null = null;
  public user: UserDocument | null = null;
  public friendsCache: string[] = [];
  public isChatLoaded: boolean = false;
  public shopCountryCode: string = "BR";
  private packetQueue: PacketQueueItem[] = [];
  private isProcessingQueue: boolean = false;
  public subscriptions: Set<string> = new Set<string>();
  public lastPingSentTimestamp: number = 0;
  public pingHistory: number[] = [];
  public lastViewedBattleId: string | null = null;
  public currentBattle: Battle | null = null;
  public isSpectator: boolean = false;

  public isInFlowMode: boolean = false;
  public flowTarget: string | null = null;
  public flowPayloadHex: string | null = null;

  private timeCheckerStartTime: number = 0;
  private initialClientTime: number = 0;
  private timeCheckSentTimestamp: number = 0;
  private lastTimeCheckPing: number = 0;
  private timeCheckTimeout: NodeJS.Timeout | null = null;
  private timeCheckerPingHistory: number[] = [];

  public battleState: "newcome" | "active" | "suicide" = "suicide";
  public pendingResourceAcks: Set<string> = new Set<string>();
  public battleIncarnation: number = 1;
  public battlePosition: IVector3 | null = null;
  public battleOrientation: IVector3 | null = null;
  public turretAngle: number = 0;
  public turretControl: number = 0;
  public isJoiningBattle: boolean = false;
  public currentHealth: number = 0;
  public equipmentChangedInGarage: boolean = false;
  public pendingEquipmentRespawn: boolean = false;
  public pendingSpawnPoint: ISpawnPoint | null = null;

  constructor({ socket, server }: IClientOptions) {
    this.socket = socket;
    this.server = server;
    this.state = "auth";
    this.securityService = new SecurityService();
    this.setupSocket();
    this.server.addClient(this);
    this.sendPacket(new Protection(this.securityService.obtainKeys()), false);
  }

  public get isDestroyed(): boolean {
    return this.socket.destroyed;
  }

  public getState(): ClientState {
    return this.state;
  }

  public setState(newState: ClientState): void {
    this.state = newState;
  }

  public getRemoteAddress(): string {
    return this.socket.remoteAddress || "unknown";
  }

  private setupSocket(): void {
    this.socket.on("data", this.handleData.bind(this));
    this.socket.on("close", this.handleClose.bind(this));
    this.socket.on("error", (err) => {
      logger.error(`Socket error for client ${this.getRemoteAddress()}`, {
        error: err,
      });
      this.handleClose();
    });
  }

  private handleData(data: Buffer): void {
    if (!data || data.length === 0) {
      logger.warn("Received empty data", { client: this.getRemoteAddress() });
      return;
    }

    this.rawDataReceived = Buffer.concat([this.rawDataReceived, data]);

    while (this.rawDataReceived.length >= GameClient.HEADER_SIZE) {
      const packetSize = this.rawDataReceived.readInt32BE(0);
      if (this.rawDataReceived.length < packetSize) {
        break;
      }

      if (packetSize < GameClient.HEADER_SIZE) {
        logger.warn(`Invalid packet size: ${packetSize}`, {
          client: this.getRemoteAddress(),
        });
        this.closeConnection();
        return;
      }

      const packetId = this.rawDataReceived.readInt32BE(4);
      const packetData = this.rawDataReceived.slice(GameClient.HEADER_SIZE, packetSize);

      this.packetQueue.push({ packetId, packetData });
      logger.debug(`Packet queued`, {
        id: packetId,
        size: packetSize,
        client: this.getRemoteAddress(),
      });

      this.rawDataReceived = this.rawDataReceived.slice(packetSize);
    }

    this.processPacketQueue();
  }

  private async processPacketQueue(): Promise<void> {
    if (this.isProcessingQueue || this.packetQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.packetQueue.length > 0) {
      const { packetId, packetData } = this.packetQueue.shift()!;

      const decryptedPacket = this.securityService.decrypt(packetData);
      const packetInstance = this.server.packetService.createPacket(packetId);

      if (!packetInstance) {
        logger.warn(`No packet class found for ID: ${packetId}`, {
          client: this.getRemoteAddress(),
          packetHex: decryptedPacket.toString("hex"),
        });
        continue;
      }

      try {
        packetInstance.read(decryptedPacket);
        // toString() serializes every field (JSON.stringify); only build it when
        // debug logging is actually enabled to keep the hot read path cheap.
        if (logger.isLevelEnabled("debug")) {
          logger.debug(`Packet processed: ${packetInstance.toString()}`, {
            client: this.getRemoteAddress(),
          });
        }

        const handler = this.server.packetHandlerService.getHandler(packetId);

        if (handler) {
          await handler.execute(this, this.server, packetInstance);
        } else {
          logger.warn(`No handler implemented for packet ID: ${packetId}`);
        }
      } catch (error: any) {
        console.error(`Error processing packet ID ${packetId} client ${this.getRemoteAddress()}`, error);

        this.closeConnection();
        break;
      }
    }

    this.isProcessingQueue = false;
  }

  private handleClose(): void {
    logger.info(`Connection closed`, { client: this.getRemoteAddress() });
    this.stopTimeChecker();

    if (this.user) {
      if (this.currentBattle) {
        this.server.battleService.handlePlayerDisconnection(this);
      }
      this.server.notifySubscribersOfStatusChange(this.user.username, false);
    }

    this.server.removeClient(this);
    this.socket.destroy();
  }

  public closeConnection(): void {
    this.socket.end();
    this.handleClose();
  }

  public sendPacket(packet: IPacket, encrypt: boolean = true): void {
    if (packet instanceof Ping) {
      this.lastPingSentTimestamp = Date.now();
    }
    try {
      const rawBuffer = packet.write();
      const packetId = packet.getId();
      const finalBuffer = encrypt ? this.securityService.encrypt(rawBuffer) : rawBuffer;
      const packetBuffer = this.buildPacketBuffer(packetId, finalBuffer);

      // packet.toString() is expensive (serializes every field); guard it so it
      // only runs when debug logging is enabled.
      if (logger.isLevelEnabled("debug")) {
        logger.debug(`Sending packet`, {
          string: packet.toString(),
          id: packetId,
          size: packetBuffer.length,
          encrypted: encrypt,
          client: this.getRemoteAddress(),
          userTarget: this.user?.username || "unknown",
        });
      }
      this.socket.write(packetBuffer);
    } catch (error) {
      logger.error(`Error sending packet to ${this.getRemoteAddress()}`, {
        error,
      });
    }
  }

  private buildPacketBuffer(packetId: number, data: Buffer): Buffer {
    const packetSize = data.length + GameClient.HEADER_SIZE;
    const packetBuffer = Buffer.alloc(packetSize);
    packetBuffer.writeInt32BE(packetSize, 0);
    packetBuffer.writeInt32BE(packetId, 4);
    data.copy(packetBuffer, GameClient.HEADER_SIZE);
    return packetBuffer;
  }

  public startTimeChecker(): void {
    if (this.timeCheckerStartTime > 0) return;

    this.timeCheckerStartTime = Date.now();
    this.sendTimeCheckerPacket();
  }

  public stopTimeChecker(): void {
    if (this.timeCheckTimeout) {
      clearTimeout(this.timeCheckTimeout);
      this.timeCheckTimeout = null;
    }
    this.timeCheckerStartTime = 0;
    this.initialClientTime = 0;
  }

  public sendTimeCheckerPacket(): void {
    if (this.timeCheckerStartTime === 0) return;

    const serverTime = Date.now() - this.timeCheckerStartTime;
    this.timeCheckSentTimestamp = Date.now();

    let bestPing = this.lastTimeCheckPing;
    if (this.timeCheckerPingHistory.length > 0) {
      bestPing = Math.min(...this.timeCheckerPingHistory);
    }

    this.sendPacket(new TimeCheckerPacket(serverTime, bestPing));
  }

  public handleTimeCheckerResponse(clientTime: number, serverTime: number): void {
    this.lastTimeCheckPing = Date.now() - this.timeCheckSentTimestamp;
    this.timeCheckerPingHistory.push(this.lastTimeCheckPing);
    if (this.timeCheckerPingHistory.length > 2) {
      this.timeCheckerPingHistory.shift();
    }

    if (this.initialClientTime === 0) {
      this.initialClientTime = clientTime;
    } else {
      const deltaServer = serverTime;
      const deltaClient = clientTime - this.initialClientTime;
      const diff = Math.abs(deltaServer - deltaClient);

      logger.info(`TimeChecker for ${this.user?.username}: deltaServer=${deltaServer}, deltaClient=${deltaClient}, diff=${diff}ms, ping=${this.lastTimeCheckPing}ms`);

      if (diff > 100) {
        logger.warn(`Potential speed hack detected for user ${this.user?.username}. Time difference: ${diff}ms`);
      }
    }

    this.timeCheckTimeout = setTimeout(() => this.sendTimeCheckerPacket(), 2000);
  }
}