import { IDependency } from "@/features/loader/loader.types";
import type { IPacket } from "@/packets/packet.interfaces";
import type { GameClient } from "@/server/game.client";
import { UserDocument } from "@/shared/models/user.model";
import { chatModeratorPower } from "@/shared/models/enums/chat-moderator-level.enum";
import { IVector3 } from "@/shared/types/geom/ivector3";
import { ResourceId } from "@/generated/resourceTypes";
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
    radius: number; // capture radius (the keypoint's `distance`)
    state: 0 | 1 | 2; // 0: Red, 1: Blue, 2: Neutral (owner; persists until the meter crosses 0)
    score: number; // SIGNED capture meter: -100 = red, 0 = neutral, +100 = blue
    scoreChangeRate: number; // last broadcast change-per-second (client extrapolates from this)
    tanksOnPoint: UserDocument[];
}

export interface IActiveMine {
    id: string;
    owner: string; // nickname
    ownerTeam: number; // teamOf the owner at placement (0 red, 1 blue, 2 none/DM)
    position: IVector3;
    armed: boolean; // only armed mines trigger (armed ~1s after placement)
}

export interface IActiveBonus {
    id: string;
    type: string;
    position: IVector3;
    spawnedAt: number;
    lifeTimeMs: number;
    /** Index into the map's bonus regions this drop came from (auto-spawn occupancy), if any. */
    regionIndex?: number;
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
    /** esportDropTiming only: region indices still awaiting their ONE-TIME initial drop. The 1s seeding
     *  tick rolls a per-region chance for each entry and removes it once dropped; when empty the tick
     *  stops (thereafter regions only re-drop on the fixed post-collection cooldown). Null until the
     *  esport seeding loop initializes it. See BonusService / [[bonus-drop-model]]. */
    public bonusSeedQueue: Set<number> | null = null;
    /** Active mines on the field, keyed by mine id. Managed by MineService. */
    public readonly activeMines = new Map<string, IActiveMine>();
    public mineCounter: number = 0;
    /** Staff toggle (/bounds off): disables the map's kill/kick boundary zones so tanks can roam outside
     *  the playable shell (parkour exploration/tests). Persists across round restarts; fresh battles
     *  start with bounds ON. checkPlayerPosition skips the boundary boxes while true. */
    public boundsDisabled: boolean = false;
    /** Staff toggle (/pause): combat freeze — no damage/kills, no flag/mine/zone interactions. Movement
     *  still relays and the round clock keeps ticking (only gameplay interactions are held). */
    public paused: boolean = false;
    // System battles (e.g. "Batalha para Novatos", created without a player creator) are never
    // auto-removed.
    public isSystem: boolean = false;

    /** Creator's lowercase username (null for system battles). Private battles are only visible in the
     *  battle list to the creator, invited players, and anyone who opened its preview from a chat link. */
    public creatorUsername: string | null = null;
    /** Lowercase usernames granted visibility of a PRIVATE battle (invited + chat-preview clickers). The
     *  creator is implicitly allowed. Ignored for public battles (settings.privateBattle === false). */
    public readonly allowedViewers = new Set<string>();

    /** Whether `user` may see this battle in their battle list. Public battles are always visible;
     *  private ones only to the creator and granted viewers. */
    public canBeSeenBy(user: UserDocument | null | undefined): boolean {
        if (!this.settings.privateBattle) return true;
        if (!user) return false;
        // Staff (any moderator cargo above a regular user) can always see private battles for moderation.
        if (chatModeratorPower(user.chatModeratorLevel) > 0) return true;
        const key = user.username.toLowerCase();
        return this.creatorUsername === key || this.allowedViewers.has(key);
    }

    /** Grants `user` visibility of this private battle. Returns true if this was a newly granted viewer
     *  (so the caller can push the list card), false if they could already see it. */
    public grantViewer(user: UserDocument | null | undefined): boolean {
        if (!user || this.canBeSeenBy(user)) return false;
        this.allowedViewers.add(user.username.toLowerCase());
        return true;
    }

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

    /** Friendly fire: true when a shot from `shooter` must NOT affect `target` — a DIFFERENT tank on the
     *  same team, in a team battle with friendlyFire off. Self-hits and DM always return false. Applies to
     *  BOTH damage and status effects (freeze slow, burn) so allies aren't affected either. */
    public isFriendlyBlocked(shooter: UserDocument, target: UserDocument): boolean {
        return shooter.id !== target.id && this.isTeamMode() && !this.settings.friendlyFire && this.teamOf(shooter) === this.teamOf(target);
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