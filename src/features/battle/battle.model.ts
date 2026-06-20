import { IDependency } from "@/features/loader/loader.types";
import type { IPacket } from "@/packets/packet.interfaces";
import type { GameClient } from "@/server/game.client";
import { UserDocument } from "@/shared/models/user.model";
import { IVector3 } from "@/shared/types/geom/ivector3";
import { ResourceId } from "@/types/resourceTypes";
import { ResourceManager } from "@/utils/resource.manager";
import * as crypto from "crypto";
import { BattleTimers } from "./battle-timers";

/** Round lifecycle: WAITING (no players yet / emptied), RUNNING (live), FINISHED (results pause). */
export enum BattleRoundState {
    WAITING,
    RUNNING,
    FINISHED,
}

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

export interface IDomPointState {
    id: number;
    name: string;
    position: IVector3;
    state: 0 | 1 | 2; // 0: Red, 1: Blue, 2: Neutral
    score: number;
    tanksOnPoint: UserDocument[];
}

export interface IActiveBonus {
    id: string;
    type: string;
    position: IVector3;
    spawnedAt: number;
    lifeTimeMs: number;
}

export class Battle {
    public readonly battleId: string;
    public readonly settings: IBattleCreationSettings;
    public readonly mapResourceId: ResourceId;
    public readonly mapLibraryDependencies: IDependency[] = [];
    public users: UserDocument[] = [];
    public usersBlue: UserDocument[] = [];
    public usersRed: UserDocument[] = [];
    public spectators: UserDocument[] = [];
    public scoreBlue: number = 0;
    public scoreRed: number = 0;
    /** Battle fund: the crystal pool shown in the stats panel; grows on kills/captures, reset each round. */
    public fund: number = 0;
    public roundState: BattleRoundState = BattleRoundState.WAITING;
    public roundStartTime: number | null = null;
    public flagBasePositionBlue: IVector3 | null = null;
    public flagBasePositionRed: IVector3 | null = null;
    public flagPositionBlue: IVector3 | null = null;
    public flagPositionRed: IVector3 | null = null;
    public flagCarrierBlue: UserDocument | null = null;
    public flagCarrierRed: UserDocument | null = null;
    public flagLastDroppedByRed: { userId: string; timestamp: number } | null = null;
    public flagLastDroppedByBlue: { userId: string; timestamp: number } | null = null;
    public domPoints: IDomPointState[] = [];
    /** Active drops on the field, keyed by bonus id ("type#instance"). Managed by BonusService. */
    public readonly activeBonuses = new Map<string, IActiveBonus>();
    public bonusCounter: number = 0;
    // System battles (e.g. "Batalha para Novatos", created without a player creator) are never
    // auto-removed.
    public isSystem: boolean = false;

    /**
     * All this battle's named timers (round time limit, finish-results pause, empty-battle removal,
     * per-flag auto-return). See BattleTimers; each service arms/clears its own names.
     */
    public readonly timers = new BattleTimers();

    /**
     * Live connections currently in this battle, maintained by GameClient's currentBattle setter
     * (and pruned on disconnect). Lets hot broadcasts iterate sockets directly instead of doing
     * getAllParticipants() (array alloc) + findClientByUsername() (toLowerCase alloc + Map.get)
     * per recipient — at 200Hz movement spam those allocations saturate the event loop.
     */
    public readonly clients = new Set<GameClient>();

    constructor(settings: IBattleCreationSettings) {
        this.battleId = crypto.randomBytes(8).toString("hex");
        this.settings = settings;
        const mapId = settings.mapId.replace("map_", "");
        this.mapResourceId = ResourceManager.getMapResourceIdWithFallback(mapId, settings.mapTheme);
        this.mapLibraryDependencies = ResourceManager.getMapResources(mapId, MapTheme[settings.mapTheme]);
    }

    public isTeamMode(): boolean {
        return this.settings.battleMode !== BattleMode.DM;
    }

    /** True once the round has begun (RUNNING or in the FINISHED results pause); false while WAITING. */
    public get roundStarted(): boolean {
        return this.roundState !== BattleRoundState.WAITING;
    }

    /** Scoreboard team index for a user: 0 = red, 1 = blue, 2 = none/DM. */
    public teamOf(user: UserDocument): number {
        if (this.usersRed.some((u) => u.id === user.id)) return 0;
        if (this.usersBlue.some((u) => u.id === user.id)) return 1;
        return 2;
    }

    public getAllParticipants(): UserDocument[] {
        return [...this.users, ...this.usersBlue, ...this.usersRed, ...this.spectators];
    }

    /**
     * Broadcasts an already-serialized packet body to every live connection in this battle.
     * Each recipient re-encrypts the shared `raw` for its own cipher stream. No per-recipient
     * lookups or allocations — this is the hot path for movement/turret relay.
     */
    /**
     * Serializes a packet once and broadcasts it to every established connection in the battle.
     * Same audience rules as broadcastRaw (skips destroyed sockets and clients still joining) —
     * use this for any per-player gameplay packet (spawn, activate, tank model, flags, removal).
     * A still-loading client must not receive these: it hasn't registered the referenced player
     * yet, so the client derefs null (#1009). It gets the consistent state in its entry snapshot.
     */
    public broadcast(packet: IPacket, exceptUserId?: string): void {
        this.broadcastRaw(packet.write(), packet.getId(), exceptUserId);
    }

    public broadcastRaw(raw: Buffer, packetId: number, exceptUserId?: string): void {
        for (const client of this.clients) {
            if (client.isDestroyed) continue;
            // Clients still loading the battle haven't received every tank object yet. A live
            // movement delta for a tank they don't know about makes their client deref null
            // (#1009). They get the full snapshot during their entry handshake, so just skip
            // them until they're established.
            if (client.isJoiningBattle) continue;
            if (exceptUserId && client.user?.id === exceptUserId) continue;
            client.sendRaw(raw, packetId);
        }
    }
}