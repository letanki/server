import { Battle, BattleMode, EquipmentConstraintsMode, IBattleCreationSettings, MapTheme } from "@/features/battle/battle.model";
import { BattleSystemMessagePacket } from "@/features/battle/battle.packets";
import { BattleService } from "@/features/battle/battle.service";
import { BattleWorkflow } from "@/features/battle/battle.workflow";
import { ChatHistory } from "@/features/chat/chat.packets";
import { UnloadGaragePacket } from "@/features/garage/garage.packets";
import { repositionWebPanel, sendWebPanel } from "@/features/webpanel/webpanel.service";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import User, { RankedModeStats, UserDocument } from "@/shared/models/user.model";
import logger from "@/utils/logger";

/** Ganchos do ciclo de batalha que o matchmaking observa (setados em GameServer.rankedObserver). */
export interface RankedObserver {
    /** Round terminou (tempo/placar): resolve a partida ranqueada pelo placar CTF (scoreRed x scoreBlue). */
    onRoundFinished(battle: Battle): void;
    /** Jogador saiu/foi removido da batalha (leave explícito OU não reconectou no grace) → W.O. */
    onPlayerLeft(battle: Battle, userId: string): void;
}

const ELO_K = 32;
const MMR_FLOOR = 100;

/**
 * Núcleo do matchmaking competitivo (Partida Competitiva, XP/BP 1v1).
 * FATIA 2: fila + pareamento FIFO + CRIAÇÃO da batalha XP/BP privada e entrada forçada dos dois.
 * Falta (próximas fatias): Elo no fim + limpeza do match no fim/saída, W.O. por abandono, leaderboard.
 */
// idle → searching → found (10s) → active (na batalha) → result (tela de vitória/derrota) → idle
export type RankedState = "idle" | "searching" | "found" | "active" | "result";

interface PlayerRef {
    userId: string;
    username: string;
    mmr: number;
}
interface QueueEntry extends PlayerRef {
    enqueuedAt: number;
}
interface RankedMatch {
    matchId: string;
    battleId: string;
    a: PlayerRef;
    b: PlayerRef;
    createdAt: number;
    state: "found" | "active";
    /** Fallback: se nenhum painel confirmar a entrada, o servidor entra sozinho após SAFETY_MS. */
    safetyTimer: NodeJS.Timeout | null;
    /** IDs que já mandaram ReadyToPlace no início da partida (gate do primeiro spawn). */
    readyToPlace?: Set<string>;
    /** true depois que o primeiro spawn simultâneo aconteceu — respawns seguintes não são segurados. */
    firstSpawnDone?: boolean;
}

interface PlayerBoard {
    flags: number;
    kills: number;
    deaths: number;
}
/** Uma linha do placar (um jogador) na tela de resultado. */
interface ResultSide {
    nick: string;
    tag: string | null; // tag do clã (sem colchetes)
    kills: number;
    deaths: number;
    flags: number;
    delta: number; // ± pontos de MMR ganhos/perdidos por ESTE jogador
}
/** Resultado guardado por jogador após a partida (para a tela de resultado no painel). TTL curto. */
interface RankedResult {
    outcome: "win" | "loss" | "draw";
    mmrAfter: number;
    rank: number | null; // posição no ranking do modo após a partida (null = não classificado)
    total: number; // total de classificados no modo
    you: ResultSide;
    opp: ResultSide;
    expiresAt: number;
}

export interface RankedStatus {
    state: RankedState;
    mmr: number;
    mode: "xpbp";
    queuedForMs?: number;
    opponent?: string;
    matchId?: string;
    /** Em "found": duração total da contagem (ms) — o PAINEL conta localmente. */
    countdownMs?: number;
    /** Em "result": dados da tela de resultado. */
    result?: Omit<RankedResult, "expiresAt">;
}

const PAIR_INTERVAL_MS = 2000;
const FOUND_COUNTDOWN_MS = 10000; // "Partida encontrada": 10s de contagem (rodada no PAINEL)
const SAFETY_ENTER_MS = 13000; // fallback do servidor: entra sozinho se o painel não confirmar
const RANKED_MODE = EquipmentConstraintsMode.HORNET_WASP_RAILGUN;
/** Chave do modo ranqueado atual (stats são POR MODO em user.rankedModes). Novos modos = novas chaves. */
const MODE_KEY = "xpbp";
// Painel: pequeno no topo-centro durante busca/encontrada; fullscreen no idle/resultado.
const PANEL_SMALL = { width: 280, height: 124, x: -1, y: 44 };
const PANEL_FULL = { width: 0, height: 0, x: -1, y: -1 };

function defaultStats(): RankedModeStats {
    return { mmr: 1000, wins: 0, losses: 0, abandons: 0, games: 0, currentStreak: 0 };
}
/** Stats do modo atual num doc de user; semeia de rankedModes, ou do legado `ranked`, ou default. */
function modeStatsOf(user: UserDocument): RankedModeStats {
    if (!user.rankedModes) user.rankedModes = new Map();
    let s = user.rankedModes.get(MODE_KEY);
    if (!s) {
        const legacy: any = user.ranked;
        s = legacy && legacy.games > 0
            ? { mmr: legacy.mmr ?? 1000, wins: legacy.wins ?? 0, losses: legacy.losses ?? 0, abandons: legacy.abandons ?? 0, games: legacy.games ?? 0, currentStreak: legacy.currentStreak ?? 0 }
            : defaultStats();
        user.rankedModes.set(MODE_KEY, s);
    }
    return s as RankedModeStats;
}

/** Mapas sorteados a cada partida ranqueada 1v1. Todos suportam CTF e têm bandeiras nos dados gerados. */
const RANKED_MAPS = ["map_sandbox", "map_zone", "map_station"] as const;
const pickRankedMap = (): string => RANKED_MAPS[Math.floor(Math.random() * RANKED_MAPS.length)];

function rankedBattleSettings(): IBattleCreationSettings {
    return {
        name: "Partida Competitiva",
        privateBattle: true, // sistema/oculta da lista pública
        proBattle: false,
        battleMode: BattleMode.CTF, // 1v1 CTF: vence quem fizer 7 bandeiras (ou o maior em 10 min)
        mapId: pickRankedMap(), // sorteia sandbox/zona/estação a cada partida
        mapTheme: MapTheme.SUMMER,
        maxPeopleCount: 1, // CTF é POR TIME: 1 por time = 1v1 (2 daria 2v2)
        minRank: 1,
        maxRank: 31,
        timeLimitInSec: 600, // 10 minutos
        scoreLimit: 7, // 7 bandeiras
        autoBalance: false, // times atribuídos manualmente (0 e 1) no forceEnter
        friendlyFire: false,
        parkourMode: false,
        equipmentConstraintsMode: RANKED_MODE,
        reArmorEnabled: false, // XP/BP: troca de equipamento bloqueada (createBattle força isso de qualquer forma)
        // Sem drop nenhum e sem suprimento nenhum.
        withoutBonuses: true,
        withoutCrystals: true,
        withoutSupplies: true,
        withoutUpgrades: false,
        reducedResistances: false,
        esportDropTiming: false,
        withoutGoldBoxes: true,
        withoutGoldSiren: true,
        withoutGoldZone: true,
        withoutMedkit: true,
        withoutMines: true,
        randomGold: false,
        dependentCooldownEnabled: false,
    };
}

export class RankedMatchmakingService implements RankedObserver {
    private queue = new Map<string, QueueEntry>();
    private matchByUser = new Map<string, RankedMatch>();
    private matchByBattleId = new Map<string, RankedMatch>();
    private resultByUser = new Map<string, RankedResult>();
    private timer: NodeJS.Timeout;

    constructor(private server: GameServer) {
        this.timer = setInterval(() => this.tick(), PAIR_INTERVAL_MS);
    }

    /** true se o jogador está buscando (fila) ou numa partida encontrada/ativa do ranqueado. */
    public isBusy(userId: string): boolean {
        return this.queue.has(userId) || this.matchByUser.has(userId);
    }

    /** Tamanho para (re)abrir o painel: pequeno (widget) se buscando/encontrada; fullscreen caso contrário. */
    public panelSizeFor(userId: string): { width: number; height: number; x: number; y: number } {
        return this.isBusy(userId) ? PANEL_SMALL : PANEL_FULL;
    }

    /** Envia um aviso de sistema no chat que o jogador está vendo (batalha ou lobby), estilo /msg. */
    public notifyChat(client: GameClient, message: string): void {
        const tagged = `[RANQUEADA] ${message}`;
        if (client.currentBattle) {
            client.sendPacket(new BattleSystemMessagePacket(tagged));
        } else {
            client.sendPacket(new ChatHistory([{ message: tagged, isSystem: true, isWarning: true, source: null, target: null }]));
        }
    }

    public async enqueue(userId: string, username: string): Promise<{ ok: boolean; error?: string }> {
        this.resultByUser.delete(userId); // "Jogar novamente" dispensa a tela de resultado
        // O motivo da falha é devolvido no {error} e exibido pelo PRÓPRIO painel (já aberto), não no chat.
        if (this.matchByUser.has(userId)) return { ok: false, error: "Você já está em uma partida." };
        if (this.queue.has(userId)) return { ok: true }; // idempotente

        // Não deixa buscar enquanto está numa batalha (casual): deve sair antes.
        const client = this.server.findClientByUsername(username);
        if (client?.currentBattle) return { ok: false, error: "Saia da batalha atual para buscar uma ranqueada." };

        const user = await User.findById(userId);
        if (!user) return { ok: false, error: "Usuário não encontrado." };

        // Verifica o equipamento XP/BP JÁ no enqueue (feedback imediato; addUserToBattle reforça na entrada).
        const equipError = BattleService.getEquipmentConstraintError(RANKED_MODE, user);
        if (equipError) return { ok: false, error: equipError };

        const mmr = modeStatsOf(user).mmr;
        this.queue.set(userId, { userId, username, mmr, enqueuedAt: Date.now() });
        logger.info(`[ranked] ${username} entrou na fila (mmr ${mmr}). fila=${this.queue.size}`);
        if (client) repositionWebPanel(client, PANEL_SMALL); // encolhe o painel p/ o widget de busca
        return { ok: true };
    }

    /** Sai da fila; se está na tela "partida encontrada" (found), cancela o pareamento e apaga a batalha.
     *  Volta o painel a fullscreen (idle). */
    public cancel(userId: string): { ok: boolean } {
        const q = this.queue.get(userId);
        const m = this.matchByUser.get(userId);
        const username = q?.username ?? (m ? (m.a.userId === userId ? m.a.username : m.b.username) : null);
        this.queue.delete(userId);
        if (m) {
            if (m.state === "found") this.server.lobbyService.removeBattle(m.battleId);
            this.clearMatch(m);
        }
        if (username) {
            const client = this.server.findClientByUsername(username);
            if (client) repositionWebPanel(client, PANEL_FULL); // volta o painel a fullscreen (idle)
        }
        return { ok: true };
    }

    /** Painel confirmou o fim da contagem local → entra os dois na partida (idempotente). */
    public playerReady(userId: string): { ok: boolean } {
        const m = this.matchByUser.get(userId);
        if (m && m.state === "found") void this.enterNow(m);
        return { ok: true };
    }

    private clearMatch(m: RankedMatch): void {
        if (m.safetyTimer) {
            clearTimeout(m.safetyTimer);
            m.safetyTimer = null;
        }
        this.matchByUser.delete(m.a.userId);
        this.matchByUser.delete(m.b.userId);
        this.matchByBattleId.delete(m.battleId);
    }

    /** Dispensa a tela de resultado ("Sair"). */
    public dismissResult(userId: string): { ok: boolean } {
        this.resultByUser.delete(userId);
        return { ok: true };
    }

    public async status(userId: string): Promise<RankedStatus> {
        const result = this.resultByUser.get(userId);
        if (result) {
            if (result.expiresAt < Date.now()) {
                this.resultByUser.delete(userId);
            } else {
                const { expiresAt, ...data } = result;
                return { state: "result", mmr: result.mmrAfter, mode: "xpbp", result: data };
            }
        }
        const match = this.matchByUser.get(userId);
        if (match) {
            const me = match.a.userId === userId ? match.a : match.b;
            const opp = match.a.userId === userId ? match.b : match.a;
            if (match.state === "found") {
                return { state: "found", mmr: me.mmr, mode: "xpbp", opponent: opp.username, matchId: match.matchId, countdownMs: FOUND_COUNTDOWN_MS };
            }
            return { state: "active", mmr: me.mmr, mode: "xpbp", opponent: opp.username, matchId: match.matchId };
        }
        const q = this.queue.get(userId);
        if (q) return { state: "searching", mmr: q.mmr, mode: "xpbp", queuedForMs: Date.now() - q.enqueuedAt };
        const u: any = await User.findById(userId).select("rankedModes ranked").lean();
        const mmr = u?.rankedModes?.[MODE_KEY]?.mmr ?? (u?.ranked?.games > 0 ? u.ranked.mmr : 1000);
        return { state: "idle", mmr, mode: "xpbp" };
    }

    private tick(): void {
        // Remove da fila quem caiu (offline) e mantém só os online, mais antigos primeiro.
        const waiting: QueueEntry[] = [];
        for (const [id, e] of this.queue) {
            if (this.server.findClientByUsername(e.username)) waiting.push(e);
            else this.queue.delete(id);
        }
        waiting.sort((a, b) => a.enqueuedAt - b.enqueuedAt);

        while (waiting.length >= 2) {
            const a = waiting.shift()!;
            const b = waiting.shift()!;
            this.queue.delete(a.userId);
            this.queue.delete(b.userId);
            this.createMatch(a, b);
        }
    }

    /** Pareou: cria a batalha e entra no estado "found" (tela de 10s). NÃO entra na batalha ainda. */
    private createMatch(a: QueueEntry, b: QueueEntry): void {
        const ca = this.server.findClientByUsername(a.username);
        const cb = this.server.findClientByUsername(b.username);
        if (!ca?.user || !cb?.user) {
            const alive = ca?.user ? a : cb?.user ? b : null;
            if (alive) this.queue.set(alive.userId, { ...alive, enqueuedAt: Date.now() });
            return;
        }

        const battle = this.server.lobbyService.createBattle(rankedBattleSettings());
        const match: RankedMatch = {
            matchId: `${a.userId}-${b.userId}-${Date.now()}`,
            battleId: battle.battleId,
            a: { userId: a.userId, username: a.username, mmr: a.mmr },
            b: { userId: b.userId, username: b.username, mmr: b.mmr },
            createdAt: Date.now(),
            state: "found",
            safetyTimer: null,
        };
        this.matchByUser.set(a.userId, match);
        this.matchByUser.set(b.userId, match);
        this.matchByBattleId.set(battle.battleId, match);
        // A contagem roda no PAINEL; o servidor só entra quando um painel confirmar (playerReady) OU,
        // como fallback, após SAFETY_ENTER_MS caso nenhum painel avise.
        match.safetyTimer = setTimeout(() => void this.enterNow(match), SAFETY_ENTER_MS);
        logger.info(`[ranked] partida encontrada ${match.matchId}: ${a.username} x ${b.username}`);
    }

    /** Entra os DOIS na batalha (idempotente via state). a = time 0 (vermelho), b = time 1 (azul). */
    private async enterNow(match: RankedMatch): Promise<void> {
        if (match.state !== "found") return; // já entrou (idempotente)
        match.state = "active";
        if (match.safetyTimer) {
            clearTimeout(match.safetyTimer);
            match.safetyTimer = null;
        }

        const ca = this.server.findClientByUsername(match.a.username);
        const cb = this.server.findClientByUsername(match.b.username);
        if (!ca?.user || !cb?.user) {
            logger.warn(`[ranked] partida ${match.matchId} abortada: um jogador saiu durante a contagem.`);
            this.server.lobbyService.removeBattle(match.battleId);
            this.clearMatch(match);
            return;
        }

        try {
            await this.forceEnter(ca, match.battleId, 0);
            await this.forceEnter(cb, match.battleId, 1);
        } catch (error: any) {
            logger.error(`[ranked] falha ao iniciar partida ${match.matchId}: ${error?.message}`);
            this.server.lobbyService.removeBattle(match.battleId);
            this.clearMatch(match);
        }
    }

    /**
     * Gate do PRIMEIRO spawn no modo ranqueado: segura a colocação de cada jogador até que TODOS
     * tenham mandado ReadyToPlace, então libera todos juntos. Respawns seguintes não são segurados.
     * Retorno:
     *  - `null`  → não é o primeiro spawn de uma partida ranqueada (o handler segue o fluxo normal);
     *  - `[]`    → segurado (ainda faltam jogadores prontos) — o handler não deve colocar nada;
     *  - `[...]` → todos prontos: o handler deve colocar exatamente estes clientes.
     */
    public gateRankedFirstSpawn(client: GameClient): GameClient[] | null {
        const battle = client.currentBattle;
        const user = client.user;
        if (!battle || !user) return null;
        const match = this.matchByBattleId.get(battle.battleId);
        if (!match || match.state !== "active" || match.firstSpawnDone) return null;

        (match.readyToPlace ??= new Set()).add(user.id);
        const expected = [match.a, match.b];
        const clients = expected.map((p) => this.server.findClientByUsername(p.username));
        const allReady = expected.every((p) => match.readyToPlace!.has(p.userId)) && clients.every((c) => !!c?.user);
        if (!allReady) {
            logger.info(`[ranked] segurando spawn de ${user.username} até todos os jogadores estarem prontos.`);
            return [];
        }
        match.firstSpawnDone = true;
        // Todos prontos: o cronômetro do round só começa a valer agora — reseta para o tempo cheio
        // (mesmo efeito do comando /time), para ninguém perder segundos esperando o outro carregar.
        this.server.battleService.setRoundTimeLeft(battle, battle.settings.timeLimitInSec);
        logger.info(`[ranked] todos prontos na partida ${match.matchId}: liberando o primeiro spawn simultâneo e resetando o tempo do round.`);
        return clients as GameClient[];
    }

    /** Coloca o cliente na batalha e dirige o cliente (mesmo caminho do EnterBattleHandler). */
    private async forceEnter(client: GameClient, battleId: string, teamIndex: number): Promise<void> {
        // O EnterBattleHandler só é chamado a partir da lista de batalhas; matchmaking pode pegar o
        // jogador na GARAGEM (chat_garage/battle_garage), onde a garagem fica carregada por cima. O
        // enterBattle faz o teardown do lobby mas não o da garagem — descarregamos aqui antes.
        const st = client.getState();
        if (st === "chat_garage" || st === "battle_garage") {
            client.sendPacket(new UnloadGaragePacket());
        }
        client.lastViewedBattleId = battleId;
        const battle = this.server.battleService.addUserToBattle(client.user!, battleId, teamIndex);
        client.currentBattle = battle;
        await BattleWorkflow.enterBattle(client, this.server, battle);
    }

    // ===================== resolução da partida (RankedObserver) =====================

    /** Fim do round: resolve pelo placar CTF. a = vermelho (scoreRed), b = azul (scoreBlue). */
    public onRoundFinished(battle: Battle): void {
        const match = this.matchByBattleId.get(battle.battleId);
        if (!match) return;
        const board = this.captureBoards(battle, match);
        this.clearMatch(match); // remove já para não processar duas vezes (o round pode reiniciar)
        void this.resolve(match, battle, board, null);
    }

    /** Saída/abandono (leave OU não reconectar no grace): W.O. — quem saiu perde, o outro vence. */
    public onPlayerLeft(battle: Battle, userId: string): void {
        const match = this.matchByBattleId.get(battle.battleId);
        if (!match) return;
        if (match.a.userId !== userId && match.b.userId !== userId) return; // ignora terceiros
        const board = this.captureBoards(battle, match);
        this.clearMatch(match);
        void this.resolve(match, battle, board, userId);
    }

    /** Placar de cada lado no momento da resolução. a = vermelho (scoreRed), b = azul (scoreBlue). */
    private captureBoards(battle: Battle, match: RankedMatch): { a: PlayerBoard; b: PlayerBoard } {
        const ca = this.server.findClientByUsername(match.a.username);
        const cb = this.server.findClientByUsername(match.b.username);
        return {
            a: { flags: battle.scoreRed ?? 0, kills: ca?.kills ?? 0, deaths: ca?.deaths ?? 0 },
            b: { flags: battle.scoreBlue ?? 0, kills: cb?.kills ?? 0, deaths: cb?.deaths ?? 0 },
        };
    }

    /** Decide vencedor (placar, ou W.O. se abandonerId), aplica Elo, guarda o resultado dos dois e encerra. */
    private async resolve(match: RankedMatch, battle: Battle, board: { a: PlayerBoard; b: PlayerBoard }, abandonerId: string | null): Promise<void> {
        const nameOf = (uid: string): string => (match.a.userId === uid ? match.a.username : match.b.username);
        const boardOf = (uid: string): PlayerBoard => (match.a.userId === uid ? board.a : board.b);

        // Determina os IDs para o Elo (eloA=vencedor no winloss / a no empate) e o desfecho de cada um.
        const isDraw = !abandonerId && board.a.flags === board.b.flags;
        let eloA: string, eloB: string, kind: "winloss" | "draw";
        if (isDraw) {
            eloA = match.a.userId; eloB = match.b.userId; kind = "draw";
        } else {
            eloA = abandonerId ? (match.a.userId === abandonerId ? match.b.userId : match.a.userId) : board.a.flags > board.b.flags ? match.a.userId : match.b.userId;
            eloB = eloA === match.a.userId ? match.b.userId : match.a.userId; kind = "winloss";
        }

        const d = await this.applyElo(eloA, eloB, kind, !!abandonerId);
        if (d) {
            const deltaOf = (uid: string) => (uid === eloA ? d.a.delta : d.b.delta);
            const afterOf = (uid: string) => (uid === eloA ? d.a.after : d.b.after);
            const tagOf = (uid: string) => (uid === eloA ? d.tagA : d.tagB);
            const outcomeOf = (uid: string): "win" | "loss" | "draw" => (kind === "draw" ? "draw" : uid === eloA ? "win" : "loss");
            const sideOf = (uid: string): ResultSide => {
                const bd = boardOf(uid);
                return { nick: nameOf(uid), tag: tagOf(uid), kills: bd.kills, deaths: bd.deaths, flags: bd.flags, delta: deltaOf(uid) };
            };
            const sideA = sideOf(match.a.userId);
            const sideB = sideOf(match.b.userId);
            const [pa, pb] = await Promise.all([this.getPlayerPosition(match.a.userId), this.getPlayerPosition(match.b.userId)]);
            this.storeResult(match.a.userId, outcomeOf(match.a.userId), afterOf(match.a.userId), sideA, sideB, pa);
            this.storeResult(match.b.userId, outcomeOf(match.b.userId), afterOf(match.b.userId), sideB, sideA, pb);
        }
        logger.info(`[ranked] partida ${match.matchId}: ${isDraw ? `empate (${board.a.flags}x${board.b.flags})` : `${nameOf(eloA)} venceu${abandonerId ? " (W.O.)" : ` ${Math.max(board.a.flags, board.b.flags)}x${Math.min(board.a.flags, board.b.flags)}`}`}.`);

        await this.finalize(match, battle);
    }

    private storeResult(userId: string, outcome: "win" | "loss" | "draw", mmrAfter: number, you: ResultSide, opp: ResultSide, pos: { rank: number; total: number } | null): void {
        this.resultByUser.set(userId, { outcome, mmrAfter, rank: pos?.rank ?? null, total: pos?.total ?? 0, you, opp, expiresAt: Date.now() + 5 * 60 * 1000 });
    }

    // ===================== classificação / leaderboard (por modo) =====================

    /** Tag do clã do jogador (sem colchetes), ou null se não tiver clã. */
    public async getUserTag(userId: string): Promise<string | null> {
        const user = await User.findById(userId);
        return user ? this.server.clanService.getTagForUser(user) : null;
    }

    /** Resolve as tags de vários clãs de uma vez (evita N buscas) → Map<clanId, tag>. */
    private async tagsByClanId(clanIds: string[]): Promise<Map<string, string>> {
        const unique = [...new Set(clanIds.filter(Boolean))];
        const map = new Map<string, string>();
        await Promise.all(
            unique.map(async (id) => {
                const clan = await this.server.clanService.getClanById(id);
                if (clan?.tag) map.set(id, clan.tag);
            })
        );
        return map;
    }

    /** Top jogadores do modo por MMR (só quem já jogou ≥1 partida — a entrada só existe após o Elo). */
    public async getLeaderboard(limit: number = 20): Promise<Array<{ username: string; tag: string | null; mmr: number; wins: number; losses: number; games: number }>> {
        const key = `rankedModes.${MODE_KEY}.mmr`;
        const users: any[] = await User.find({ [key]: { $exists: true } })
            .sort({ [key]: -1 })
            .limit(limit)
            .select(`username clanId rankedModes.${MODE_KEY}`)
            .lean();
        const tags = await this.tagsByClanId(users.map((u) => String(u.clanId ?? "")));
        return users.map((u) => {
            const s = u.rankedModes?.[MODE_KEY] ?? {};
            return { username: u.username, tag: u.clanId ? tags.get(String(u.clanId)) ?? null : null, mmr: s.mmr ?? 1000, wins: s.wins ?? 0, losses: s.losses ?? 0, games: s.games ?? 0 };
        });
    }

    /** Posição do jogador no ranking do modo (1 = topo) + total de classificados. */
    public async getPlayerPosition(userId: string): Promise<{ rank: number; mmr: number; total: number } | null> {
        const key = `rankedModes.${MODE_KEY}.mmr`;
        const u: any = await User.findById(userId).select(`rankedModes.${MODE_KEY}`).lean();
        const mmr = u?.rankedModes?.[MODE_KEY]?.mmr;
        const total = await User.countDocuments({ [key]: { $exists: true } });
        if (mmr == null) return null; // ainda não classificado
        const higher = await User.countDocuments({ [key]: { $gt: mmr } });
        return { rank: higher + 1, mmr, total };
    }

    /**
     * Elo (K=32). `kind="winloss"`: aId=vencedor, bId=perdedor (isAbandon → +abandons no perdedor).
     * `kind="draw"`: score 0.5 para ambos (sem win/loss). Retorna o delta de cada (a e b) para a UI.
     */
    private async applyElo(
        aId: string,
        bId: string,
        kind: "winloss" | "draw",
        isAbandon: boolean
    ): Promise<{ a: { before: number; after: number; delta: number }; b: { before: number; after: number; delta: number }; tagA: string | null; tagB: string | null } | null> {
        const [a, b] = await Promise.all([User.findById(aId), User.findById(bId)]);
        if (!a || !b) return null;
        const sa = modeStatsOf(a);
        const sb = modeStatsOf(b);

        const am = sa.mmr;
        const bm = sb.mmr;
        const expA = 1 / (1 + Math.pow(10, (bm - am) / 400));
        const scoreA = kind === "draw" ? 0.5 : 1;
        const scoreB = kind === "draw" ? 0.5 : 0;
        const da = Math.round(ELO_K * (scoreA - expA));
        const db = Math.round(ELO_K * (scoreB - (1 - expA)));

        sa.mmr = Math.max(MMR_FLOOR, am + da);
        sb.mmr = Math.max(MMR_FLOOR, bm + db);
        sa.games += 1;
        sb.games += 1;
        if (kind === "winloss") {
            sa.wins += 1;
            sa.currentStreak = sa.currentStreak >= 0 ? sa.currentStreak + 1 : 1;
            sb.losses += 1;
            sb.currentStreak = sb.currentStreak <= 0 ? sb.currentStreak - 1 : -1;
            if (isAbandon) sb.abandons += 1;
        }
        a.rankedModes.set(MODE_KEY, sa);
        b.rankedModes.set(MODE_KEY, sb);
        a.markModified("rankedModes");
        b.markModified("rankedModes");
        await Promise.all([a.save(), b.save()]);
        const [tagA, tagB] = await Promise.all([this.server.clanService.getTagForUser(a), this.server.clanService.getTagForUser(b)]);
        logger.info(`[ranked] Elo(${MODE_KEY}): ${a.username} ${am}→${sa.mmr} (${da >= 0 ? "+" : ""}${da}) | ${b.username} ${bm}→${sb.mmr} (${db >= 0 ? "+" : ""}${db})${isAbandon ? " [W.O.]" : ""}`);
        return {
            a: { before: am, after: sa.mmr, delta: sa.mmr - am },
            b: { before: bm, after: sb.mmr, delta: sb.mmr - bm },
            tagA,
            tagB,
        };
    }

    /** Encerra a partida: cancela o restart, ejeta todos para o lobby, APAGA a batalha e reabre o painel de resultado. */
    private async finalize(match: RankedMatch, battle: Battle): Promise<void> {
        battle.timers.clear("finish"); // cancela o restart automático do round
        battle.timers.clear("round");
        await this.server.battleService.evacuateForRestart(battle); // ejeta os dois → lobby
        this.server.lobbyService.removeBattle(battle.battleId); // apaga: ninguém entra mais

        for (const p of [match.a, match.b]) {
            const client = this.server.findClientByUsername(p.username);
            if (client) sendWebPanel(client, { width: 0, height: 0 }, "ranked-result"); // reabre em tela cheia (resultado via /ranked/status)
        }
        logger.info(`[ranked] partida ${match.matchId} encerrada e batalha ${battle.battleId} removida.`);
    }
}
