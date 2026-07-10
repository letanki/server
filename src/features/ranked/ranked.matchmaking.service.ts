import { Battle, BattleMode, EquipmentConstraintsMode, IBattleCreationSettings, MapTheme } from "@/features/battle/battle.model";
import { BattleSystemMessagePacket } from "@/features/battle/battle.packets";
import { BattleService } from "@/features/battle/battle.service";
import { BattleWorkflow } from "@/features/battle/battle.workflow";
import { ChatHistory } from "@/features/chat/chat.packets";
import { UnloadGaragePacket } from "@/features/garage/garage.packets";
import { closeWebPanel, repositionWebPanel, sendWebPanel } from "@/features/webpanel/webpanel.service";
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
 * Núcleo do matchmaking competitivo (Partida Competitiva, XP/BP). Suporta VÁRIOS modos (1v1, 2v2), cada um
 * com fila própria e MMR próprio (chave em user.rankedModes). O 2v2 é SOLO QUEUE: 4 avulsos entram e o
 * servidor divide em 2 times equilibrados por MMR. O Elo é por MÉDIA de time (cada membro ganha/perde o
 * mesmo delta). Fila FIFO → pareamento → batalha XP/BP privada → entrada forçada → Elo no fim + W.O. por
 * abandono + leaderboard por modo.
 */
// idle → searching → found (10s) → active (na batalha) → result (tela de vitória/derrota) → idle
export type RankedState = "idle" | "searching" | "found" | "active" | "result";

/** Modos ranqueados. `key` = chave dos stats em user.rankedModes (MMR próprio por modo). `teamSize` = por
 *  time (1v1 = 1/time, 2v2 = 2/time). O 1v1 mantém a chave "xpbp" (dados legados); novos modos = novas chaves. */
export type RankedModeId = "1v1" | "2v2";
interface RankedModeDef {
    id: RankedModeId;
    key: string;
    teamSize: number;
    label: string;
}
const MODES: Record<RankedModeId, RankedModeDef> = {
    "1v1": { id: "1v1", key: "xpbp", teamSize: 1, label: "1v1" },
    "2v2": { id: "2v2", key: "xpbp_2v2", teamSize: 2, label: "2v2" },
};
const MODE_IDS = Object.keys(MODES) as RankedModeId[];
const LEGACY_MODE_KEY = "xpbp"; // só o 1v1 herda os stats do campo legado `ranked`
const isModeId = (v: unknown): v is RankedModeId => typeof v === "string" && v in MODES;

interface PlayerRef {
    userId: string;
    username: string;
    mmr: number;
}
interface QueueEntry extends PlayerRef {
    mode: RankedModeId;
    enqueuedAt: number;
}
interface RankedMatch {
    matchId: string;
    battleId: string;
    mode: RankedModeDef;
    /** Time 0 (vermelho, scoreRed) e time 1 (azul, scoreBlue). teamSize jogadores cada. */
    teamA: PlayerRef[];
    teamB: PlayerRef[];
    createdAt: number;
    state: "found" | "active";
    /** Fallback: se nenhum painel confirmar a entrada, o servidor entra sozinho após SAFETY_MS. */
    safetyTimer: NodeJS.Timeout | null;
    /** IDs que já mandaram ReadyToPlace no início da partida (gate do primeiro spawn). */
    readyToPlace?: Set<string>;
    /** true depois que o primeiro spawn simultâneo aconteceu — respawns seguintes não são segurados. */
    firstSpawnDone?: boolean;
}

/** Uma linha do placar (um jogador) na tela de resultado. */
interface ResultSide {
    nick: string;
    tag: string | null; // tag do clã (sem colchetes)
    kills: number;
    deaths: number;
    delta: number; // ± pontos de MMR ganhos/perdidos por ESTE jogador
}
/** Resultado guardado por jogador após a partida (para a tela de resultado no painel). TTL curto. */
interface RankedResult {
    outcome: "win" | "loss" | "draw";
    mode: RankedModeId;
    mmrAfter: number;
    rank: number | null; // posição no ranking do modo após a partida (null = não classificado)
    total: number; // total de classificados no modo
    youFlags: number; // bandeiras do time do jogador
    oppFlags: number; // bandeiras do time adversário
    youTeam: ResultSide[]; // o time do jogador (inclui ele)
    oppTeam: ResultSide[]; // o time adversário
    expiresAt: number;
}

export interface RankedStatus {
    state: RankedState;
    mmr: number;
    mode: RankedModeId;
    queuedForMs?: number;
    /** Em found/active: nomes do time adversário. */
    opponents?: string[];
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
// Painel: pequeno no topo-centro durante busca/encontrada; fullscreen no idle/resultado.
const PANEL_SMALL = { width: 280, height: 124, x: -1, y: 44 };
const PANEL_FULL = { width: 0, height: 0, x: -1, y: -1 };

function defaultStats(): RankedModeStats {
    return { mmr: 1000, wins: 0, losses: 0, abandons: 0, games: 0, currentStreak: 0 };
}
/** Stats de UM modo num doc de user; semeia de rankedModes[key], do legado `ranked` (só o 1v1) ou default. */
function modeStatsOf(user: UserDocument, key: string): RankedModeStats {
    if (!user.rankedModes) user.rankedModes = new Map();
    let s = user.rankedModes.get(key);
    if (!s) {
        const legacy: any = key === LEGACY_MODE_KEY ? user.ranked : null;
        s = legacy && legacy.games > 0
            ? { mmr: legacy.mmr ?? 1000, wins: legacy.wins ?? 0, losses: legacy.losses ?? 0, abandons: legacy.abandons ?? 0, games: legacy.games ?? 0, currentStreak: legacy.currentStreak ?? 0 }
            : defaultStats();
        user.rankedModes.set(key, s);
    }
    return s as RankedModeStats;
}

/** Mapas sorteados a cada partida ranqueada. Todos suportam CTF e têm bandeiras nos dados gerados. */
const RANKED_MAPS = ["map_sandbox", "map_zone", "map_station", "map_sandal", "map_dualiti", "map_garder"] as const;
const pickRankedMap = (): string => RANKED_MAPS[Math.floor(Math.random() * RANKED_MAPS.length)];

function rankedBattleSettings(mode: RankedModeDef): IBattleCreationSettings {
    return {
        name: `Partida Competitiva ${mode.label}`,
        privateBattle: true, // sistema/oculta da lista pública
        proBattle: false,
        battleMode: BattleMode.CTF, // CTF: vence quem fizer 7 bandeiras (ou o maior em 10 min)
        mapId: pickRankedMap(), // sorteia o mapa a cada partida
        mapTheme: MapTheme.SUMMER,
        maxPeopleCount: mode.teamSize, // CTF é POR TIME: teamSize por time (1 = 1v1, 2 = 2v2)
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

    // ---- helpers de time --------------------------------------------------
    private allPlayers(m: RankedMatch): PlayerRef[] {
        return [...m.teamA, ...m.teamB];
    }
    private sideOfUser(m: RankedMatch, userId: string): "A" | "B" | null {
        if (m.teamA.some((p) => p.userId === userId)) return "A";
        if (m.teamB.some((p) => p.userId === userId)) return "B";
        return null;
    }
    private opponentsOf(m: RankedMatch, userId: string): PlayerRef[] {
        const side = this.sideOfUser(m, userId);
        return side === "A" ? m.teamB : side === "B" ? m.teamA : [];
    }
    private usernameInMatch(m: RankedMatch, userId: string): string | null {
        return this.allPlayers(m).find((p) => p.userId === userId)?.username ?? null;
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
            client.sendPacket(new BattleSystemMessagePacket({ message: tagged }));
        } else {
            client.sendPacket(new ChatHistory({ messages: [{ message: tagged, isSystem: true, isWarning: true, source: null, target: null }] }));
        }
    }

    public async enqueue(userId: string, username: string, modeId: RankedModeId): Promise<{ ok: boolean; error?: string }> {
        this.resultByUser.delete(userId); // "Jogar novamente" dispensa a tela de resultado
        if (!isModeId(modeId)) return { ok: false, error: "Modo inválido." };
        // O motivo da falha é devolvido no {error} e exibido pelo PRÓPRIO painel (já aberto), não no chat.
        if (this.matchByUser.has(userId)) return { ok: false, error: "Você já está em uma partida." };
        const existing = this.queue.get(userId);
        if (existing) {
            // Já na fila: se trocou de modo, re-enfileira no novo; senão idempotente.
            if (existing.mode !== modeId) this.queue.set(userId, { ...existing, mode: modeId, enqueuedAt: Date.now() });
            return { ok: true };
        }

        // Não deixa buscar enquanto está numa batalha (casual): deve sair antes.
        const client = this.server.findClientByUsername(username);
        if (client?.currentBattle) return { ok: false, error: "Saia da batalha atual para buscar uma ranqueada." };

        const user = await User.findById(userId);
        if (!user) return { ok: false, error: "Usuário não encontrado." };

        // Verifica o equipamento XP/BP JÁ no enqueue (feedback imediato; addUserToBattle reforça na entrada).
        const equipError = BattleService.getEquipmentConstraintError(RANKED_MODE, user);
        if (equipError) return { ok: false, error: equipError };

        const mmr = modeStatsOf(user, MODES[modeId].key).mmr;
        this.queue.set(userId, { userId, username, mmr, mode: modeId, enqueuedAt: Date.now() });
        logger.info(`[ranked] ${username} entrou na fila ${modeId} (mmr ${mmr}). fila=${this.queue.size}`);
        if (client) repositionWebPanel(client, PANEL_SMALL); // encolhe o painel p/ o widget de busca
        return { ok: true };
    }

    /** Sai da fila; se está na tela "partida encontrada" (found), cancela o pareamento e apaga a batalha.
     *  Volta o painel a fullscreen (idle). */
    public cancel(userId: string): { ok: boolean } {
        const q = this.queue.get(userId);
        const m = this.matchByUser.get(userId);
        const username = q?.username ?? (m ? this.usernameInMatch(m, userId) : null);
        this.queue.delete(userId);
        if (m) {
            // Cancelar durante a contagem só é permitido no "found"; apaga a batalha e devolve os OUTROS à fila.
            if (m.state === "found") {
                this.server.lobbyService.removeBattle(m.battleId);
                for (const p of this.allPlayers(m)) {
                    if (p.userId === userId) continue;
                    this.queue.set(p.userId, { userId: p.userId, username: p.username, mmr: p.mmr, mode: m.mode.id, enqueuedAt: Date.now() });
                    const c = this.server.findClientByUsername(p.username);
                    if (c) repositionWebPanel(c, PANEL_SMALL); // voltam a "buscando"
                }
            }
            this.clearMatch(m);
        }
        if (username) {
            const client = this.server.findClientByUsername(username);
            if (client) repositionWebPanel(client, PANEL_FULL); // volta o painel a fullscreen (idle)
        }
        return { ok: true };
    }

    /** Painel confirmou o fim da contagem local → entra todos na partida (idempotente). */
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
        for (const p of this.allPlayers(m)) this.matchByUser.delete(p.userId);
        this.matchByBattleId.delete(m.battleId);
    }

    /** Dispensa a tela de resultado ("Sair"). */
    public dismissResult(userId: string): { ok: boolean } {
        this.resultByUser.delete(userId);
        return { ok: true };
    }

    /** `requestedMode` só é usado no estado idle (MMR do modo que o painel está exibindo). */
    public async status(userId: string, requestedMode: RankedModeId = "1v1"): Promise<RankedStatus> {
        const result = this.resultByUser.get(userId);
        if (result) {
            if (result.expiresAt < Date.now()) {
                this.resultByUser.delete(userId);
            } else {
                const { expiresAt, ...data } = result;
                return { state: "result", mmr: result.mmrAfter, mode: result.mode, result: data };
            }
        }
        const match = this.matchByUser.get(userId);
        if (match) {
            const me = this.allPlayers(match).find((p) => p.userId === userId)!;
            const opponents = this.opponentsOf(match, userId).map((p) => p.username);
            if (match.state === "found") {
                return { state: "found", mmr: me.mmr, mode: match.mode.id, opponents, matchId: match.matchId, countdownMs: FOUND_COUNTDOWN_MS };
            }
            return { state: "active", mmr: me.mmr, mode: match.mode.id, opponents, matchId: match.matchId };
        }
        const q = this.queue.get(userId);
        if (q) return { state: "searching", mmr: q.mmr, mode: q.mode, queuedForMs: Date.now() - q.enqueuedAt };
        const mode = isModeId(requestedMode) ? requestedMode : "1v1";
        const u: any = await User.findById(userId).select("rankedModes ranked").lean();
        const key = MODES[mode].key;
        const legacyMmr = mode === "1v1" && u?.ranked?.games > 0 ? u.ranked.mmr : 1000;
        const mmr = u?.rankedModes?.[key]?.mmr ?? legacyMmr;
        return { state: "idle", mmr, mode };
    }

    private tick(): void {
        // Remove da fila quem caiu (offline) e agrupa por modo, mais antigos primeiro.
        const waitingByMode: Record<RankedModeId, QueueEntry[]> = { "1v1": [], "2v2": [] };
        for (const [id, e] of this.queue) {
            if (this.server.findClientByUsername(e.username)) waitingByMode[e.mode].push(e);
            else this.queue.delete(id);
        }

        for (const modeId of MODE_IDS) {
            const mode = MODES[modeId];
            const need = mode.teamSize * 2;
            const waiting = waitingByMode[modeId].sort((a, b) => a.enqueuedAt - b.enqueuedAt);
            while (waiting.length >= need) {
                const group = waiting.splice(0, need);
                for (const g of group) this.queue.delete(g.userId);
                this.createMatch(mode, group);
            }
        }
    }

    /** Divide os `entries` em 2 times equilibrados por MMR (snake: maior+menor de um lado). */
    private balanceTeams(entries: QueueEntry[]): { teamA: PlayerRef[]; teamB: PlayerRef[] } {
        const sorted = [...entries].sort((a, b) => b.mmr - a.mmr);
        const teamA: PlayerRef[] = [];
        const teamB: PlayerRef[] = [];
        sorted.forEach((e, i) => {
            const ref: PlayerRef = { userId: e.userId, username: e.username, mmr: e.mmr };
            // snake em blocos de 4: A pega índices 0 e 3 (maior+menor), B pega 1 e 2 (do meio) → médias próximas.
            (i % 4 === 0 || i % 4 === 3 ? teamA : teamB).push(ref);
        });
        return { teamA, teamB };
    }

    /** Pareou: cria a batalha e entra no estado "found" (tela de 10s). NÃO entra na batalha ainda. */
    private createMatch(mode: RankedModeDef, entries: QueueEntry[]): void {
        const online = entries.map((e) => ({ e, c: this.server.findClientByUsername(e.username) }));
        if (online.some((x) => !x.c?.user)) {
            // Alguém caiu entre o pareamento e agora: devolve os online à fila para reparear.
            for (const { e, c } of online) if (c?.user) this.queue.set(e.userId, { ...e, enqueuedAt: Date.now() });
            return;
        }

        const { teamA, teamB } = this.balanceTeams(entries);
        const battle = this.server.lobbyService.createBattle(rankedBattleSettings(mode));
        const match: RankedMatch = {
            matchId: `${mode.id}-${entries.map((e) => e.userId).join("-")}-${Date.now()}`,
            battleId: battle.battleId,
            mode,
            teamA,
            teamB,
            createdAt: Date.now(),
            state: "found",
            safetyTimer: null,
        };
        for (const p of this.allPlayers(match)) this.matchByUser.set(p.userId, match);
        this.matchByBattleId.set(battle.battleId, match);
        // A contagem roda no PAINEL; o servidor só entra quando um painel confirmar (playerReady) OU,
        // como fallback, após SAFETY_ENTER_MS caso nenhum painel avise.
        match.safetyTimer = setTimeout(() => void this.enterNow(match), SAFETY_ENTER_MS);
        logger.info(`[ranked] partida ${mode.id} encontrada ${match.matchId}: [${teamA.map((p) => p.username).join(",")}] x [${teamB.map((p) => p.username).join(",")}]`);
    }

    /** Entra TODOS na batalha (idempotente via state). teamA = time 0 (vermelho), teamB = time 1 (azul). */
    private async enterNow(match: RankedMatch): Promise<void> {
        if (match.state !== "found") return; // já entrou (idempotente)
        match.state = "active";
        if (match.safetyTimer) {
            clearTimeout(match.safetyTimer);
            match.safetyTimer = null;
        }

        const entries: { client: GameClient; teamIndex: number }[] = [];
        for (const [teamIndex, team] of [match.teamA, match.teamB].entries()) {
            for (const p of team) {
                const c = this.server.findClientByUsername(p.username);
                if (!c?.user) {
                    logger.warn(`[ranked] partida ${match.matchId} abortada: ${p.username} saiu durante a contagem.`);
                    this.server.lobbyService.removeBattle(match.battleId);
                    this.clearMatch(match);
                    return;
                }
                entries.push({ client: c, teamIndex });
            }
        }

        try {
            for (const { client, teamIndex } of entries) await this.forceEnter(client, match.battleId, teamIndex);
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
        const expected = this.allPlayers(match);
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
        // FECHAMENTO autoritativo do painel no gatilho do spawn: garante que o widget "Buscando"/"Encontrada"
        // suma ao entrar na partida mesmo se o JS do painel estiver travado (Stage3D em produção).
        for (const c of clients) if (c) closeWebPanel(c);
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

    /** Fim do round: resolve pelo placar CTF (teamA=scoreRed, teamB=scoreBlue). */
    public onRoundFinished(battle: Battle): void {
        const match = this.matchByBattleId.get(battle.battleId);
        if (!match) return;
        this.clearMatch(match); // remove já para não processar duas vezes (o round pode reiniciar)
        void this.resolve(match, battle, null);
    }

    /** Saída/abandono (leave OU não reconectar no grace): W.O. — o time de quem saiu perde. */
    public onPlayerLeft(battle: Battle, userId: string): void {
        const match = this.matchByBattleId.get(battle.battleId);
        if (!match) return;
        if (this.sideOfUser(match, userId) === null) return; // ignora terceiros
        this.clearMatch(match);
        void this.resolve(match, battle, userId);
    }

    /** kills/deaths de um jogador AGORA (do client vivo, se houver). */
    private playerKD(username: string): { kills: number; deaths: number } {
        const c = this.server.findClientByUsername(username);
        return { kills: c?.kills ?? 0, deaths: c?.deaths ?? 0 };
    }

    /**
     * Decide o time vencedor (placar, ou W.O. se abandonerId → o time do abandonador perde), aplica Elo por
     * média de time, guarda o resultado de cada jogador e encerra a batalha.
     */
    private async resolve(match: RankedMatch, battle: Battle, abandonerId: string | null): Promise<void> {
        const flagsA = battle.scoreRed ?? 0;
        const flagsB = battle.scoreBlue ?? 0;

        let winner: "A" | "B" | null;
        if (abandonerId) {
            winner = this.sideOfUser(match, abandonerId) === "A" ? "B" : "A"; // o time do abandonador perde
        } else {
            winner = flagsA > flagsB ? "A" : flagsB > flagsA ? "B" : null; // null = empate
        }

        const elo = await this.applyTeamElo(match, winner, !!abandonerId);
        if (elo.size > 0) {
            const rowsOf = (team: PlayerRef[]): ResultSide[] =>
                team.map((p) => {
                    const kd = this.playerKD(p.username);
                    const e = elo.get(p.userId);
                    return { nick: p.username, tag: e?.tag ?? null, kills: kd.kills, deaths: kd.deaths, delta: e?.delta ?? 0 };
                });
            const rowsA = rowsOf(match.teamA);
            const rowsB = rowsOf(match.teamB);

            const positions = new Map<string, { rank: number; total: number } | null>();
            await Promise.all(this.allPlayers(match).map(async (p) => positions.set(p.userId, await this.getPlayerPosition(p.userId, match.mode.id))));

            for (const p of this.allPlayers(match)) {
                const side = this.sideOfUser(match, p.userId)!;
                const e = elo.get(p.userId)!;
                this.resultByUser.set(p.userId, {
                    outcome: winner === null ? "draw" : side === winner ? "win" : "loss",
                    mode: match.mode.id,
                    mmrAfter: e.after,
                    rank: positions.get(p.userId)?.rank ?? null,
                    total: positions.get(p.userId)?.total ?? 0,
                    youFlags: side === "A" ? flagsA : flagsB,
                    oppFlags: side === "A" ? flagsB : flagsA,
                    youTeam: side === "A" ? rowsA : rowsB,
                    oppTeam: side === "A" ? rowsB : rowsA,
                    expiresAt: Date.now() + 5 * 60 * 1000,
                });
            }
        }
        logger.info(`[ranked] partida ${match.matchId}: ${winner === null ? `empate (${flagsA}x${flagsB})` : `time ${winner} venceu (${Math.max(flagsA, flagsB)}x${Math.min(flagsA, flagsB)})${abandonerId ? " [W.O.]" : ""}`}.`);

        await this.finalize(match, battle);
    }

    /**
     * Elo por MÉDIA DE TIME (K=32): a expectativa de cada jogador usa a média de MMR do seu time vs a do
     * adversário, então os dois membros de um time ganham/perdem o MESMO delta. `winner=null` = empate
     * (0.5 pra ambos). Persiste ATÔMICO por jogador (só rankedModes.<modo>) + espelha na sessão online — um
     * doc obsoleto (sessão que relogou) não consegue reverter. Retorna por userId: after/delta/outcome/tag.
     */
    private async applyTeamElo(
        match: RankedMatch,
        winner: "A" | "B" | null,
        isAbandon: boolean
    ): Promise<Map<string, { after: number; delta: number; tag: string | null }>> {
        const key = match.mode.key;
        const out = new Map<string, { after: number; delta: number; tag: string | null }>();

        const players = this.allPlayers(match);
        const docs = new Map<string, UserDocument>();
        await Promise.all(players.map(async (p) => { const u = await User.findById(p.userId); if (u) docs.set(p.userId, u); }));

        const mmrBefore = (p: PlayerRef): number => (docs.has(p.userId) ? modeStatsOf(docs.get(p.userId)!, key).mmr : p.mmr);
        const mean = (arr: PlayerRef[]): number => arr.reduce((s, p) => s + mmrBefore(p), 0) / Math.max(1, arr.length);
        const avgA = mean(match.teamA);
        const avgB = mean(match.teamB);

        for (const p of players) {
            const u = docs.get(p.userId);
            if (!u) continue;
            const st = modeStatsOf(u, key);
            const before = st.mmr;
            const side = this.sideOfUser(match, p.userId)!;
            const myAvg = side === "A" ? avgA : avgB;
            const oppAvg = side === "A" ? avgB : avgA;
            const exp = 1 / (1 + Math.pow(10, (oppAvg - myAvg) / 400));
            const score = winner === null ? 0.5 : side === winner ? 1 : 0;
            const delta = Math.round(ELO_K * (score - exp));

            st.mmr = Math.max(MMR_FLOOR, before + delta);
            st.games += 1;
            if (winner !== null) {
                if (side === winner) {
                    st.wins += 1;
                    st.currentStreak = st.currentStreak >= 0 ? st.currentStreak + 1 : 1;
                } else {
                    st.losses += 1;
                    st.currentStreak = st.currentStreak <= 0 ? st.currentStreak - 1 : -1;
                    if (isAbandon) st.abandons += 1;
                }
            }

            await User.updateOne({ _id: p.userId }, { $set: { [`rankedModes.${key}`]: st } });
            this._mirrorRankedStats(p.username, st, key);
            const tag = await this.server.clanService.getTagForUser(u);
            out.set(p.userId, { after: st.mmr, delta: st.mmr - before, tag });
            logger.info(`[ranked] Elo(${key}): ${u.username} ${before}→${st.mmr} (${delta >= 0 ? "+" : ""}${delta})${isAbandon ? " [W.O.]" : ""}`);
        }
        return out;
    }

    /** Espelha os stats do modo no doc EM MEMÓRIA da sessão online (se houver), para que um save() posterior
     *  de um client.user obsoleto (ex.: sessão que relogou) não reverta o MMR gravado atomicamente. */
    private _mirrorRankedStats(username: string, stats: RankedModeStats, key: string): void {
        const client = this.server.findClientByUsername(username);
        if (!client?.user) return;
        if (!client.user.rankedModes) client.user.rankedModes = new Map();
        client.user.rankedModes.set(key, stats);
        client.user.markModified("rankedModes");
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

    /** Top jogadores de UM modo por MMR (só quem já jogou ≥1 partida — a entrada só existe após o Elo). */
    public async getLeaderboard(modeId: RankedModeId, limit: number = 20): Promise<Array<{ username: string; tag: string | null; mmr: number; wins: number; losses: number; games: number }>> {
        const modeKey = MODES[isModeId(modeId) ? modeId : "1v1"].key;
        const key = `rankedModes.${modeKey}.mmr`;
        const users: any[] = await User.find({ [key]: { $exists: true } })
            .sort({ [key]: -1 })
            .limit(limit)
            .select(`username clanId rankedModes.${modeKey}`)
            .lean();
        const tags = await this.tagsByClanId(users.map((u) => String(u.clanId ?? "")));
        return users.map((u) => {
            const s = u.rankedModes?.[modeKey] ?? {};
            return { username: u.username, tag: u.clanId ? tags.get(String(u.clanId)) ?? null : null, mmr: s.mmr ?? 1000, wins: s.wins ?? 0, losses: s.losses ?? 0, games: s.games ?? 0 };
        });
    }

    /** Posição do jogador no ranking de UM modo (1 = topo) + total de classificados. */
    public async getPlayerPosition(userId: string, modeId: RankedModeId): Promise<{ rank: number; mmr: number; total: number } | null> {
        const modeKey = MODES[isModeId(modeId) ? modeId : "1v1"].key;
        const key = `rankedModes.${modeKey}.mmr`;
        const u: any = await User.findById(userId).select(`rankedModes.${modeKey}`).lean();
        const mmr = u?.rankedModes?.[modeKey]?.mmr;
        const total = await User.countDocuments({ [key]: { $exists: true } });
        if (mmr == null) return null; // ainda não classificado
        const higher = await User.countDocuments({ [key]: { $gt: mmr } });
        return { rank: higher + 1, mmr, total };
    }

    /** Top mineiros do servidor: quem mais colocou minas no total (stats.counters.mines_used global). */
    public async getTopMiners(limit: number = 20): Promise<Array<{ username: string; tag: string | null; mines: number }>> {
        const key = "stats.counters.mines_used";
        const users: any[] = await User.find({ [key]: { $gt: 0 } })
            .sort({ [key]: -1 })
            .limit(limit)
            .select(`username clanId ${key}`)
            .lean();
        const tags = await this.tagsByClanId(users.map((u) => String(u.clanId ?? "")));
        return users.map((u) => ({
            username: u.username,
            tag: u.clanId ? tags.get(String(u.clanId)) ?? null : null,
            mines: u.stats?.counters?.mines_used ?? 0,
        }));
    }

    /** Encerra a partida: cancela o restart, ejeta todos para o lobby, APAGA a batalha e reabre o painel de resultado. */
    private async finalize(match: RankedMatch, battle: Battle): Promise<void> {
        battle.timers.clear("finish"); // cancela o restart automático do round
        battle.timers.clear("round");
        await this.server.battleService.evacuateForRestart(battle); // ejeta todos → lobby
        this.server.lobbyService.removeBattle(battle.battleId); // apaga: ninguém entra mais

        for (const p of this.allPlayers(match)) {
            const client = this.server.findClientByUsername(p.username);
            if (client) sendWebPanel(client, { width: 0, height: 0 }, "ranked-result"); // reabre em tela cheia (resultado via /ranked/status)
        }
        logger.info(`[ranked] partida ${match.matchId} encerrada e batalha ${battle.battleId} removida.`);
    }
}
