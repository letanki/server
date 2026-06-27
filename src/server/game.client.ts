import { unknownPacketRecorder } from "@/core/diagnostics/unknown-packet.recorder";
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
  private isClosing: boolean = false;
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
  private _currentBattle: Battle | null = null;
  public isSpectator: boolean = false;

  /**
   * Setting currentBattle keeps the battle's `clients` set in sync, so hot broadcasts
   * (movement/turret relay) can iterate live connections directly without per-packet lookups.
   */
  public get currentBattle(): Battle | null {
    return this._currentBattle;
  }
  public set currentBattle(battle: Battle | null) {
    if (this._currentBattle === battle) return;
    this._currentBattle?.clients.delete(this);
    this._currentBattle = battle;
    battle?.clients.add(this);
    // Effects and scoreboard don't carry across battles.
    this.activeEffects = [];
    this.kills = 0;
    this.deaths = 0;
    this.battleScore = 0;
    // A pending self-destruct belongs to the incarnation that started it — leaving/joining cancels it.
    this.selfDestructIncarnation = null;
  }

  public isInFlowMode: boolean = false;
  public flowTarget: string | null = null;
  public flowPayloadHex: string | null = null;

  private timeCheckerStartTime: number = 0;
  private initialClientTime: number = 0;
  private timeCheckSentTimestamp: number = 0;
  private lastTimeCheckPing: number = 0;
  private timeCheckTimeout: NodeJS.Timeout | null = null;

  public battleState: "newcome" | "active" | "suicide" = "suicide";
  public pendingResourceAcks: Set<string> = new Set<string>();
  public battleIncarnation: number = 1;
  // Incarnation that started a still-pending self-destruct countdown, or null. The tank stays fully
  // active during the countdown; this only guards the delayed destruction (exclusive to that life).
  public selfDestructIncarnation: number | null = null;
  public battlePosition: IVector3 | null = null;
  public battleOrientation: IVector3 | null = null;
  // Last solid obstacle the tank was inside (anti-clip log state), or null when in the clear.
  public insideObstacle: string | null = null;
  public turretAngle: number = 0;
  public turretControl: number = 0;
  // Monotonic spec sequence sent in TankSpecificationPacket so the client applies the latest
  // (e.g. a nitro-boosted spec supersedes the spawn one).
  public specSequence: number = 0;
  // Supply effects currently active on this tank, replayed to players who join mid-effect via
  // InitEffects (itemIndex = supply slotId, durationTime = original effect ms).
  public activeEffects: { itemIndex: number; durationTime: number; endAt: number }[] = [];
  // Combat/scoring state. Health is the client's normalized 0-10000 scale (10000 = full); it goes
  // negative on a killing blow (overkill). kills/deaths/battleScore are the in-battle scoreboard.
  public kills: number = 0;
  public deaths: number = 0;
  public battleScore: number = 0;
  // When the railgun charge began (server-enforced fixed charge time = anti fire-rate hack).
  public railgunChargeStart: number = 0;
  // When the shaft entered aiming mode (the sniper damage scales with how long it has charged).
  public shaftAimStart: number = 0;
  // Flamethrower residual burn: current burn damage/sec on this tank, and who lit it (for kill credit).
  public flameTemperature: number = 0;
  public flameSource: string | null = null;
  // Visual heat (0..~0.2) driving the client's red "burning" glow — broadcast via the Temperature packet.
  public visualTemperature: number = 0;
  // Freeze cold (0..~-0.5): negative temperature → blue tint + movement slowdown. lastFreezeHit gates the
  // warm-up recovery so the tank only thaws once the freeze beam stops touching it.
  public freezeTemperature: number = 0;
  public lastFreezeHit: number = 0;
  // Vulcan (machinegun) overheat: after firing past the grace period the barrel heats up (0..~0.22 red tint)
  // and burns the shooter. machinegunHeatTime = accumulated continuous-fire ms; lastMachinegunShot gates it.
  public machinegunHeat: number = 0;
  public machinegunHeatTime: number = 0;
  public lastMachinegunShot: number = 0;
  public isJoiningBattle: boolean = false;
  public currentHealth: number = 0;
  // Active medkit/repair-kit regeneration timer (gradual heal). Cleared on death/respawn/disconnect
  // and whenever a new kit is activated. See SupplyService.startHealing.
  public healTimer: NodeJS.Timeout | null = null;
  public equipmentChangedInGarage: boolean = false;
  public pendingEquipmentRespawn: boolean = false;
  public pendingSpawnPoint: ISpawnPoint | null = null;
  // Set while OTHER clients are still loading this player's new equipment resources after a mid-battle
  // equipment change. While true the player's spawn (ReadyToPlace) is held back — broadcasting the
  // InitTank/Spawn before others have the resources makes the tank invisible / crashes them (#1009).
  public equipmentResourcesLoading: boolean = false;
  // The player sent ReadyToPlace while equipmentResourcesLoading was still true; the placement is
  // performed once the resource-load acks complete (garage.workflow).
  public deferredPlacement: boolean = false;

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
    // Disable Nagle's algorithm: the game sends many small packets (movement, turret),
    // and Nagle + delayed-ACK can add up to ~40ms of latency to those bursts.
    this.socket.setNoDelay(true);
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
        // Persist unknown packets so they can be reverse-engineered / implemented later.
        unknownPacketRecorder.record(packetId, decryptedPacket, this.getRemoteAddress());
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
    // A reset/abrupt drop fires both 'error' and 'close' (and closeConnection() calls
    // this manually before the 'close' event arrives). Without this guard the disconnect
    // path runs twice and announceTankRemoval sends UserDisconnectedDm twice, crashing
    // other clients (#1009) the second time the nickname is no longer in their table.
    if (this.isClosing) return;
    this.isClosing = true;

    logger.info(`Connection closed`, { client: this.getRemoteAddress() });
    this.stopTimeChecker();

    if (this.user) {
      if (this.currentBattle) {
        this.server.battleService.handlePlayerDisconnection(this);
      }
      this.server.notifySubscribersOfStatusChange(this.user.username, false);
    }

    // Drop this dead connection from its battle's broadcast set so relays don't write to a
    // destroyed socket. handlePlayerDisconnection above already captured what it needs; the
    // reconnect flow tracks state via disconnectedPlayers, not this field.
    this.currentBattle = null;

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

  /**
   * Sends a packet whose body was already serialized once (via packet.write()).
   * Used for broadcasts: the raw body is built a single time and only the
   * per-connection encryption/framing is redone here. `encrypt` copies its input,
   * so the same `rawBuffer` can be safely reused across many clients.
   */
  public sendRaw(rawBuffer: Buffer, packetId: number): void {
    try {
      const finalBuffer = this.securityService.encrypt(rawBuffer);
      this.socket.write(this.buildPacketBuffer(packetId, finalBuffer));
    } catch (error) {
      logger.error(`Error sending raw packet to ${this.getRemoteAddress()}`, { error });
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

    // Report the most recent round-trip directly — no smoothing/min-of-history — so the
    // displayed ping reflects the real current latency, including event-loop backlog.
    this.sendPacket(new TimeCheckerPacket(serverTime, this.lastTimeCheckPing));
  }

  public handleTimeCheckerResponse(clientTime: number, serverTime: number): void {
    this.lastTimeCheckPing = Date.now() - this.timeCheckSentTimestamp;

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

    this.timeCheckTimeout = setTimeout(() => this.sendTimeCheckerPacket(), 1000);
  }
}