import * as LobbyPackets from "@/features/lobby/lobby.packets";
import { LobbyWorkflow } from "@/features/lobby/lobby.workflow";
import { UpdateCrystals } from "@/features/profile/profile.packets";
import { IPacket } from "@/packets/packet.interfaces";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import logger from "@/utils/logger";
import { Battle, BattleMode, BattleRoundState } from "./battle.model";
import { BattleEvents, BattleEventMap } from "./battle-events";
import { BonusService } from "./bonus.service";
import { CtfService } from "./ctf.service";
import { SpawnService } from "./spawn.service";
import { ChangeFundPacket, EffectStoppedPacket, FinishBattlePacket, RestartRoundDmPacket, RestartRoundTeamPacket, SetCtfScorePacket, SetRoundTimePacket } from "./battle.packets";

const ROUND_FINISH_PAUSE_MS = 10000; // results screen before a finished round restarts
const FUND_PER_KILL = 1; // crystals added to the battle fund per kill
const FUND_PER_FLAG = 10; // crystals added to the battle fund per flag capture

/**
 * Round lifecycle: the per-round time/score limits, the finish→pause→restart cycle (side switch,
 * stat reset, flag reset, respawn) and the lobby-preview reactions. Subscribes to the bus (`kill`,
 * `flagCaptured`) for the score-limit/preview updates so combat and CTF don't call it directly.
 * Depends on the server, the bus, CTF (flag reset/drop) and Spawn (respawn) — no back-reference to
 * BattleService. Extracted from BattleService.
 */
export class RoundService {
    constructor(
        private readonly server: GameServer,
        private readonly events: BattleEvents,
        private readonly ctf: CtfService,
        private readonly spawn: SpawnService,
        private readonly bonus: BonusService,
    ) {
        this.events.on("kill", (p) => this._onKill(p));
        this.events.on("flagCaptured", (p) => this._onFlagCaptured(p));
    }

    /** (Re)starts the round clock: marks the round RUNNING, tells everyone the time limit and arms
     *  the time-up finish. */
    public startRoundTimer(battle: Battle): void {
        battle.roundState = BattleRoundState.RUNNING;
        const limit = battle.settings.timeLimitInSec;
        battle.broadcast(new SetRoundTimePacket(limit));
        if (limit > 0) {
            battle.timers.set("round", limit * 1000, () => this.finishRound(battle));
        } else {
            battle.timers.clear("round");
        }
    }

    /** End the round (time or score limit): broadcast final standings, then restart after the pause. */
    public finishRound(battle: Battle): void {
        if (battle.roundState === BattleRoundState.FINISHED) return; // already finishing
        battle.roundState = BattleRoundState.FINISHED;
        battle.timers.clear("round");

        // Crystal payout from the battle fund (team-first in team modes, then per player).
        const players = [...battle.clients].filter((c) => c.user && !c.isSpectator);
        const rewards = this._computeRewards(battle, players);

        battle.broadcast(new FinishBattlePacket(rewards.map((r) => ({ nickname: r.nickname, reward: r.reward })), ROUND_FINISH_PAUSE_MS / 1000));
        // Lobby preview watchers: the running timer they see should reset.
        this._sendToWatchers(battle, new LobbyPackets.RoundFinishPacket(battle.battleId));

        // Credit the earned crystals to each player's account (persist + refresh their balance).
        void this._awardCrystals(rewards);

        // Carried flags fall (CTF).
        if (battle.settings.battleMode === BattleMode.CTF) {
            for (const carrier of [battle.flagCarrierRed, battle.flagCarrierBlue]) {
                if (carrier) this.ctf.dropFlag(carrier, battle, this.server.findClientByUsername(carrier.username)?.battlePosition ?? null);
            }
        }
        // Active supply effects clear on every tank.
        for (const c of battle.clients) {
            if (!c.user) continue;
            for (const e of c.activeEffects) battle.broadcast(new EffectStoppedPacket(c.user.username, e.itemIndex));
            c.activeEffects = [];
        }

        logger.info(`Round finished in battle ${battle.battleId}.`);

        battle.timers.set("finish", ROUND_FINISH_PAUSE_MS, () => this.restartRound(battle));
    }

    /** Restart a finished round: swap sides (team modes), reset scores/flags, respawn everyone, restart timer. */
    public restartRound(battle: Battle): void {
        if ([...battle.users, ...battle.usersBlue, ...battle.usersRed].length === 0) return; // emptied during the pause

        // Leave the FINISHED freeze up front so the respawn loop below isn't blocked by the freeze
        // guard (combat/spawn gate on roundState === FINISHED). startRoundTimer re-affirms RUNNING.
        battle.timers.clear("finish");
        battle.roundState = BattleRoundState.RUNNING;
        this.events.emit("roundRestarted", { battle }); // modes (e.g. domination) reset their own state

        // Switch sides (team modes): swap the rosters, then re-send them so the client reassigns each
        // player's team in the scoreboard (RestartRoundTeamPacket = field0 red, field1 blue).
        if (battle.isTeamMode()) {
            const red = battle.usersRed;
            battle.usersRed = battle.usersBlue;
            battle.usersBlue = red;
        }

        battle.scoreRed = 0;
        battle.scoreBlue = 0;
        battle.fund = 0;
        battle.broadcast(new ChangeFundPacket(0));
        this.bonus.clearAll(battle); // fresh round starts with no leftover drops
        const active = [...battle.clients].filter((c) => c.user && !c.isSpectator);
        for (const c of active) { c.kills = 0; c.deaths = 0; c.battleScore = 0; }

        if (battle.settings.battleMode === BattleMode.CTF) {
            this.ctf.returnFlagToBase(battle, "RED");
            this.ctf.returnFlagToBase(battle, "BLUE");
            battle.broadcast(new SetCtfScorePacket(0, 0));
            battle.broadcast(new SetCtfScorePacket(1, 0));
        }

        // Rebuild the scoreboard rosters with reset stats + the new team assignment.
        if (battle.isTeamMode()) {
            battle.broadcast(new RestartRoundTeamPacket(battle.usersRed.map((u) => u.username), battle.usersBlue.map((u) => u.username)));
            // Update the battle-list per-team counts: each player moved to the other team's slot.
            for (let team = 0; team < 2; team++) {
                for (const u of (team === 0 ? battle.usersRed : battle.usersBlue)) {
                    this.server.broadcastToBattleList(new LobbyPackets.OnReleaseSlotTeamPacket(battle.battleId, u.username));
                    this.server.broadcastToBattleList(new LobbyPackets.OnReserveSlotTeamPacket(battle.battleId, u.username, team));
                }
            }
        } else {
            battle.broadcast(new RestartRoundDmPacket(battle.users.map((u) => u.username)));
        }

        for (const c of active) {
            this.spawn.prepareRespawn(c); // -> client replies ReadyToPlace -> normal spawn finishes the placement
        }

        battle.roundStartTime = Date.now();
        this.startRoundTimer(battle);

        // Refresh the lobby preview for watchers: hide + re-show the battle details. The per-event
        // packets don't refresh the preview panel itself, so the reset timer, reset score and the new
        // team rosters only show up after re-sending BattleDetails (computed from the fresh state).
        for (const w of this._battleWatchers(battle)) {
            w.sendPacket(new LobbyPackets.HideBattleInfoPacket(battle.battleId));
            void LobbyWorkflow.sendBattleDetails(w, this.server, battle);
        }

        logger.info(`Round restarted in battle ${battle.battleId}.`);
    }

    /** Kill reactions: lobby-preview score update + the kill-based score limit (DM/team non-CTF). */
    private _onKill({ battle, killerClient, victimClient }: BattleEventMap["kill"]): void {
        const killer = killerClient.user;
        const victim = victimClient.user;
        if (!killer || !victim) return;

        // Lobby preview watchers: the scorer's individual score, and (team modes) the team score.
        if (killer.id !== victim.id) {
            this._sendToWatchers(battle, new LobbyPackets.UpdateUserScorePacket(battle.battleId, killer.username, killerClient.battleScore));
            this._addFund(battle, FUND_PER_KILL);
        }

        // Kill-based score limit (DM = individual kills; TDM = team's total kills). CTF (flags) and CP
        // (control-point time) have their own scoring, so kills don't count toward their limit.
        const limit = battle.settings.scoreLimit;
        if (killer.id !== victim.id && battle.settings.battleMode !== BattleMode.CTF && battle.settings.battleMode !== BattleMode.CP) {
            const team = battle.teamOf(killer);
            const teamKills = battle.isTeamMode()
                ? [...battle.clients].filter((c) => c.user && battle.teamOf(c.user) === team).reduce((sum, c) => sum + c.kills, 0)
                : killerClient.kills;
            if (battle.isTeamMode()) {
                this._sendToWatchers(battle, new LobbyPackets.UpdateTeamScorePacket(battle.battleId, team, teamKills));
            }
            if (limit > 0 && teamKills >= limit) this.finishRound(battle);
        }
    }

    /** Flag-capture reactions: lobby-preview team score + the CTF score limit. */
    private _onFlagCaptured({ battle, capturingTeamId, newScore }: BattleEventMap["flagCaptured"]): void {
        // Lobby preview watchers see the team score rise.
        this._sendToWatchers(battle, new LobbyPackets.UpdateTeamScorePacket(battle.battleId, capturingTeamId, newScore));
        this._addFund(battle, FUND_PER_FLAG);
        // Score limit reached -> end the round.
        if (battle.settings.scoreLimit > 0 && newScore >= battle.settings.scoreLimit) {
            this.finishRound(battle);
        }
    }

    /** Adds to the battle fund (crystal pool) and broadcasts the new total to everyone in the battle. */
    private _addFund(battle: Battle, amount: number): void {
        battle.fund += amount;
        battle.broadcast(new ChangeFundPacket(battle.fund));
    }

    /**
     * Splits the battle fund into per-player crystal rewards. A player who scored nothing in the match
     * gets nothing, regardless of outcome. DM: proportional to individual score. Team modes
     * (TDM/CTF/AS/CP): the fund is split BETWEEN the teams first — proportional to the team score (flag
     * captures in CTF, summed player score otherwise) — and each team's share is then split among its
     * players by individual score. An empty team's (or all-zero-score team's) share is simply lost.
     */
    private _computeRewards(battle: Battle, players: GameClient[]): { client: GameClient; nickname: string; reward: number }[] {
        const result = (rewardMap: Map<GameClient, number>) => players.map((c) => ({ client: c, nickname: c.user!.username, reward: rewardMap.get(c) ?? 0 }));
        const fund = battle.fund;
        if (fund <= 0 || players.length === 0) return result(new Map());

        // Splits a pot among members proportional to individual score. Members who scored 0 get 0; if
        // nobody in the group scored, the pot is lost (no even-split fallback — 0 score earns nothing).
        const splitByScore = (members: GameClient[], pot: number): Map<GameClient, number> => {
            const out = new Map<GameClient, number>();
            const total = members.reduce((s, c) => s + Math.max(0, c.battleScore), 0);
            if (pot <= 0 || total <= 0) return out;
            for (const c of members) {
                if (c.battleScore > 0) out.set(c, Math.floor((pot * c.battleScore) / total));
            }
            return out;
        };

        if (!battle.isTeamMode()) {
            return result(splitByScore(players, fund));
        }

        // Team modes: team pot first (by team score), then within the team by individual score.
        const isCtf = battle.settings.battleMode === BattleMode.CTF;
        const red = players.filter((c) => battle.teamOf(c.user!) === 0);
        const blue = players.filter((c) => battle.teamOf(c.user!) === 1);
        const teamScore = (members: GameClient[], flagScore: number) =>
            isCtf ? flagScore : members.reduce((s, c) => s + Math.max(0, c.battleScore), 0);
        const redScore = teamScore(red, battle.scoreRed);
        const blueScore = teamScore(blue, battle.scoreBlue);
        const totalTeamScore = redScore + blueScore;

        // Team pot is proportional to team score; if neither team scored, the fund is split evenly between
        // the two teams (each team then still only pays out to players who actually scored).
        const redPot = totalTeamScore > 0 ? Math.floor((fund * redScore) / totalTeamScore) : Math.floor(fund / 2);
        const bluePot = totalTeamScore > 0 ? Math.floor((fund * blueScore) / totalTeamScore) : Math.floor(fund / 2);

        return result(new Map<GameClient, number>([...splitByScore(red, redPot), ...splitByScore(blue, bluePot)]));
    }

    /** Persists each player's earned crystals and refreshes their displayed balance. */
    private async _awardCrystals(rewards: { client: GameClient; reward: number }[]): Promise<void> {
        for (const { client, reward } of rewards) {
            if (reward <= 0 || !client.user) continue;
            try {
                const newTotal = client.user.crystals + reward;
                const updated = await this.server.userService.updateResources(client.user.id, { crystals: newTotal });
                client.user = updated;
                client.sendPacket(new UpdateCrystals(updated.crystals));
            } catch (error: any) {
                logger.error(`Failed to award ${reward} crystals to ${client.user?.username}`, { error: error.message });
            }
        }
    }

    /** Lobby clients currently watching this battle's preview (battle-details panel). */
    private _battleWatchers(battle: Battle): GameClient[] {
        return this.server.getClients().filter((c) => (c.getState() === "chat_lobby" || c.getState() === "battle_lobby") && c.lastViewedBattleId === battle.battleId);
    }
    private _sendToWatchers(battle: Battle, packet: IPacket): void {
        for (const w of this._battleWatchers(battle)) w.sendPacket(packet);
    }
}
