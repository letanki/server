import { unknownPacketRecorder } from "@/core/diagnostics/unknown-packet.recorder";
import { Protection } from "@/core/security/security.packets";
import { SecurityService } from "@/core/security/security.service";
import { Battle } from "@/features/battle/battle.model";
import { TimeCheckerPacket } from "@/features/battle/battle.packets";
import { createRoundStats, createStatsSnapshot, RoundStatAccumulator, StatsFlushSnapshot, StatsService } from "@/features/stats/stats.service";
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
  /**
   * Liveness (heartbeat) timeout. In battle the client answers the TimeChecker every ~1s, so any inbound
   * packet keeps `lastDataReceivedAt` fresh. If NOTHING arrives for this long, the connection is dead (an
   * abrupt drop — power/internet loss — that never fires TCP 'close'), so we close it and let the normal
   * disconnect flow (60s reconnect grace → removal) run. Generous vs the 1s cadence to survive brief lag.
   */
  private static readonly IDLE_TIMEOUT_MS = 30000;
  private static readonly LIVENESS_CHECK_INTERVAL_MS = 10000;
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
  // Modal informativo da Ranqueada: mostrado UMA vez por sessão, na primeira vez que este cliente chega
  // ao lobby (login→lobby OU sair da batalha→lobby). Em memória → reseta a cada nova conexão/login.
  public rankedIntroShown: boolean = false;
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
    // Effects, staff toggles and scoreboard don't carry across battles. (Supply cooldowns reset on tank
    // ACTIVATION — ReadyToActivateHandler — which always precedes any supply use, so no clear here.)
    this.activeEffects = [];
    this.godMode = false;
    this.speedMultiplier = 1;
    this.relayPosition = true;
    this.flyZTarget = null;
    if (this.flyTimer) { clearInterval(this.flyTimer); this.flyTimer = null; }
    this.kills = 0;
    this.deaths = 0;
    this.battleScore = 0;
    // Long-term metrics accumulate per round in memory and flush in deltas at each trigger (death /
    // disconnect / leave / round-finish). The snapshot tracks what's already persisted for this round.
    this.roundStats = createRoundStats();
    this.statsSnapshot = createStatsSnapshot();
    this.statsFlushedForRound = false;
    // A pending self-destruct belongs to the incarnation that started it — leaving/joining cancels it.
    this.selfDestructIncarnation = null;

    // Liveness watchdog is scoped to being IN a battle: there the client answers the TimeChecker ~every
    // 1s, so a long silence reliably means a dead connection. In the lobby a client can legitimately sit
    // idle, so we don't run it there (would false-positive). Reset the clock on entry so a stale lobby
    // timestamp doesn't trip it immediately.
    if (battle) {
      this.lastDataReceivedAt = Date.now();
      if (!this.livenessTimer) {
        this.livenessTimer = setInterval(() => this.checkLiveness(), GameClient.LIVENESS_CHECK_INTERVAL_MS);
      }
    } else if (this.livenessTimer) {
      clearInterval(this.livenessTimer);
      this.livenessTimer = null;
    }
  }

  public isInFlowMode: boolean = false;
  public flowTarget: string | null = null;
  public flowPayloadHex: string | null = null;

  private timeCheckerStartTime: number = 0;
  private initialClientTime: number = 0;
  private timeCheckServerBaseline: number = 0;
  private timeCheckSentTimestamp: number = 0;
  private lastTimeCheckPing: number = 0;
  // Speed-hack detection: strikes de checagens CONSECUTIVAS com o relógio do cliente adiantado além do
  // tolerável. Só confirma (e age) após SPEEDHACK_MAX_STRIKES seguidas — um pico isolado (lag de join)
  // nunca dispara.
  private speedHackStrikes: number = 0;
  // Amostra confiável só com ping baixo: durante um lag (ex.: o join, ping ~500ms) a medição de tempo
  // fica distorcida, então essas amostras são IGNORADAS (nem viram baseline, nem strike).
  private static readonly SPEEDHACK_MAX_PING_MS = 300;
  // Drift = quanto o relógio do cliente está ADIANTADO vs o servidor no mesmo intervalo. Acima disto conta strike.
  private static readonly SPEEDHACK_DRIFT_MS = 250;
  private static readonly SPEEDHACK_MAX_STRIKES = 2;
  private timeCheckTimeout: NodeJS.Timeout | null = null;
  private lastDataReceivedAt: number = Date.now();
  private livenessTimer: NodeJS.Timeout | null = null;

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
  // Assist tracking: real HP damage taken THIS LIFE, per attacker userId → cumulative. On death the
  // kill's assist pool (max 15) is split proportional to these (killer included). Cleared at the start
  // of each life (ReadyToActivate). See CombatService.applyDamage / _handleKill.
  public damageFromAttackers: Map<string, number> = new Map();
  // Per-round competitive-metric accumulator (kills/deaths come from the fields above; the rest here).
  // Flushed to the user's persistent `stats` at round finish / on leave, then reset. See StatsService.
  public roundStats: RoundStatAccumulator = createRoundStats();
  // Snapshot of what's already been persisted to `stats` this round; each flush writes only the delta
  // against it (so death/disconnect/leave/finish never double-count). Reset with roundStats. See StatsService.
  public statsSnapshot: StatsFlushSnapshot = createStatsSnapshot();
  // True once this round's per-match aggregates (win/loss/records/streaks) have been flushed, so
  // finishRound + a same-round leave can't double-count them. (Counter deltas are idempotent regardless.)
  public statsFlushedForRound: boolean = false;
  // When the railgun charge began (server-enforced fixed charge time = anti fire-rate hack).
  public railgunChargeStart: number = 0;
  // When the shaft entered aiming mode (the sniper damage scales with how long it has charged).
  public shaftAimStart: number = 0;
  // Settings toggle "SHOW_DAMAGE" (SetShowDamageSetting, c2s): when false, we don't send this player
  // the floating damage numbers for the damage THEY deal. Default true (client sends it at settings init).
  public showDamage: boolean = true;
  // Flamethrower burn: single heat value (0..1) driving both the red "burning" glow (broadcast via the
  // Temperature packet) and the residual burn DoT (FLAME_TEMPERATURE_LIMIT × heat). flameSource = who lit it
  // (for kill credit).
  public visualTemperature: number = 0;
  public flameSource: string | null = null;
  // Freeze cold (0..-1): negative temperature → blue tint + movement slowdown. lastFreezeHit gates the
  // warm-up recovery so the tank only thaws once the freeze beam stops touching it.
  public freezeTemperature: number = 0;
  public lastFreezeHit: number = 0;
  // Vulcan (machinegun) overheat: after firing past the grace period the barrel heats up (0..~0.22 red tint)
  // and burns the shooter. machinegunHeatTime = accumulated continuous-fire ms; lastMachinegunShot gates it.
  public machinegunHeat: number = 0;
  public machinegunHeatTime: number = 0;
  public lastMachinegunShot: number = 0;
  // Isida (feixe cura/dano). O cliente quase não manda IsisStart (manda TICK contínuo + STOP ao soltar),
  // então o "jato ligado" é detectado pela CONTINUIDADE dos ticks: `isisLastBeamAt` = último sinal de jato
  // (tick/pos); se a lacuna passa de ISIS_GAP_MS, ou vem um STOP (zera), começa um NOVO jato e o âncora de
  // 500ms recomeça (`isisLastEffectAt`). Assim o dano exige 500ms de espaço SEGURADO continuamente e tapear
  // nunca acumula, sem depender do IsisStart.
  public isisLastBeamAt: number = 0;
  public isisLastEffectAt: number = 0;
  public isJoiningBattle: boolean = false;
  public currentHealth: number = 0;
  // Active medkit/repair-kit regeneration timer (gradual heal). Cleared on death/respawn/disconnect
  // and whenever a new kit is activated. See SupplyService.startHealing.
  public healTimer: NodeJS.Timeout | null = null;
  // Timestamp of the last EXECUTED mine placement — MineService.placeMine drops placements arriving
  // sooner than its minimum interval (anti-spam; parkour has no reactivation cooldown).
  public lastMinePlacedAt: number = 0;
  // Server-side supply cooldowns: supplyId → timestamp when it can be activated again. The client-side
  // cooldown is only VISUAL — a macro/lag burst of activation packets would otherwise consume one supply
  // per packet. ActivateSupplyCommandHandler discards activations arriving before their ready time.
  public supplyReadyAt: Map<string, number> = new Map();
  // Staff /god: while true, CombatService.applyDamage skips this tank entirely (weapons, mines, splash,
  // self-burn). Kill/kick zones still apply (that's /bounds). Reset on battle change.
  public godMode: boolean = false;
  // Staff /speed: movement-spec speed multiplier applied by broadcastMovementSpec (composes with
  // nitro/freeze). 1 = normal. Reset on battle change.
  public speedMultiplier: number = 1;
  // Staff /relay: when false, Move/FullMove still update battlePosition on the server but are NOT
  // rebroadcast to others — used with /tpothers and /tpself so a visual offset doesn't snap back.
  // Reset on battle change.
  public relayPosition: boolean = true;
  // Staff /flyto: locks/glides only Z (height). XY still come from the client's Move/FullMove.
  // flyZTarget set => active; flyTimer steps Z toward the target. Cleared on battle change / stop.
  public flyZTarget: number | null = null;
  public flyZSpeed: number = 800;
  public flyTimer: ReturnType<typeof setInterval> | null = null;
  public equipmentChangedInGarage: boolean = false;
  // Loadout (base ids) captured when the garage was OPENED. On garage exit, only the categories whose
  // equipped base changed vs this snapshot arm the re-arm 15-min cooldown (so the player can freely swap
  // back and forth inside the garage without triggering it). Cleared on exit.
  public equipSnapshot: { hull: string; turret: string; paint: string } | null = null;
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

  /** The server instance this client belongs to (for cross-client broadcasts from feature code). */
  public getServer(): GameServer {
    return this.server;
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
    // OS-level backstop for dead peers (half-open connections after an abrupt power/internet drop that
    // never fire 'close'). The app-level liveness watchdog (checkLiveness) is the timely detector in
    // battle; keepalive covers idle lobby connections too, just more slowly.
    this.socket.setKeepAlive(true, 30000);
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

    // Any inbound byte marks the connection as alive (drives the liveness watchdog).
    this.lastDataReceivedAt = Date.now();

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
        // Closing the client mid-match must not lose the round's progress: persist whatever's accumulated
        // since the last flush before the socket goes away. Delta-based, so the later removal/round-finish
        // won't double-count. Only the counters + clan missions — the win/loss outcome waits for the
        // player to actually leave (they may reconnect during the grace window).
        if (!this.isSpectator) StatsService.flushDelta(this, this.currentBattle, this.server);
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
    this.timeCheckServerBaseline = 0;
    this.speedHackStrikes = 0;
  }

  /** Battle heartbeat watchdog: with the ~1s TimeChecker cadence, no inbound data for IDLE_TIMEOUT_MS
   *  means the connection is dead — an abrupt drop (power/internet loss) that never fired TCP 'close'.
   *  Close it so the normal disconnect flow (60s reconnect grace → removal) runs instead of leaving the
   *  player stuck in the match forever. */
  private checkLiveness(): void {
    if (!this.currentBattle) return;
    const idleMs = Date.now() - this.lastDataReceivedAt;
    if (idleMs > GameClient.IDLE_TIMEOUT_MS) {
      logger.warn(`Client ${this.getRemoteAddress()} (${this.user?.username ?? "?"}) idle ${idleMs}ms — assuming dead, closing.`);
      this.closeConnection();
    }
  }

  public sendTimeCheckerPacket(): void {
    if (this.timeCheckerStartTime === 0) return;

    const serverTime = Date.now() - this.timeCheckerStartTime;
    this.timeCheckSentTimestamp = Date.now();

    // Report the most recent round-trip directly — no smoothing/min-of-history — so the
    // displayed ping reflects the real current latency, including event-loop backlog.
    this.sendPacket(new TimeCheckerPacket({ value1: serverTime, value2: this.lastTimeCheckPing }));
  }

  /** Processa a resposta do TimeChecker e devolve `true` quando um speed hack é CONFIRMADO (drift
   *  sustentado). O chamador (handler) decide a ação — remover da partida com aviso. */
  public handleTimeCheckerResponse(clientTime: number, serverTime: number): boolean {
    this.lastTimeCheckPing = Date.now() - this.timeCheckSentTimestamp;
    const reliable = this.lastTimeCheckPing <= GameClient.SPEEDHACK_MAX_PING_MS;
    let confirmed = false;

    // Baseline: capturado UMA vez, e só numa amostra confiável (ping baixo). Enquanto o join/lag mantém o
    // ping alto, adiamos o baseline — assim a origem dos dois relógios (servidor e cliente) fica alinhada
    // no mesmo instante limpo, sem o offset que gerava o falso "speed hack" logo na entrada.
    if (this.initialClientTime === 0) {
      if (reliable) {
        this.initialClientTime = clientTime;
        this.timeCheckServerBaseline = serverTime;
      }
    } else {
      // Ambos os deltas medidos a partir do MESMO baseline → num cliente honesto o drift fica ~0.
      const deltaServer = serverTime - this.timeCheckServerBaseline;
      const deltaClient = clientTime - this.initialClientTime;
      const drift = deltaClient - deltaServer; // positivo = relógio do cliente ADIANTADO (direção do speed hack)

      logger.info(`TimeChecker for ${this.user?.username}: deltaServer=${deltaServer}, deltaClient=${deltaClient}, drift=${drift}ms, ping=${this.lastTimeCheckPing}ms, strikes=${this.speedHackStrikes}`);

      // Amostras não confiáveis (pico de lag) não contam nem a favor nem contra — só as ignora.
      if (reliable) {
        if (drift > GameClient.SPEEDHACK_DRIFT_MS) {
          this.speedHackStrikes++;
          if (this.speedHackStrikes >= GameClient.SPEEDHACK_MAX_STRIKES) {
            logger.warn(`Speed hack CONFIRMED for ${this.user?.username} (drift=${drift}ms por ${this.speedHackStrikes} checagens seguidas).`);
            this.speedHackStrikes = 0;
            confirmed = true;
          }
        } else {
          this.speedHackStrikes = 0; // drift voltou ao normal → não é sustentado
        }
      }
    }

    this.timeCheckTimeout = setTimeout(() => this.sendTimeCheckerPacket(), 1000);
    return confirmed;
  }
}