import * as LobbyPackets from "@/features/lobby/lobby.packets";
import { LobbyWorkflow } from "@/features/lobby/lobby.workflow";
import { IPacket } from "@/packets/packet.interfaces";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import logger from "@/utils/logger";
import { Battle, BattleMode } from "./battle.model";
import { BattleEvents, BattleEventMap } from "./battle-events";
import { CtfService } from "./ctf.service";
import { SpawnService } from "./spawn.service";
import { EffectStoppedPacket, FinishBattlePacket, RestartRoundDmPacket, RestartRoundTeamPacket, SetCtfScorePacket, SetRoundTimePacket } from "./battle.packets";

const ROUND_FINISH_PAUSE_MS = 10000; // results screen before a finished round restarts

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
    ) {
        this.events.on("kill", (p) => this._onKill(p));
        this.events.on("flagCaptured", (p) => this._onFlagCaptured(p));
    }

    /** (Re)starts the round clock: tells everyone the time limit and arms the time-up finish. */
    public startRoundTimer(battle: Battle): void {
        if (battle.roundTimer) clearTimeout(battle.roundTimer);
        const limit = battle.settings.timeLimitInSec;
        battle.broadcast(new SetRoundTimePacket(limit));
        if (limit > 0) {
            battle.roundTimer = setTimeout(() => this.finishRound(battle), limit * 1000);
        }
    }

    /** End the round (time or score limit): broadcast final standings, then restart after the pause. */
    public finishRound(battle: Battle): void {
        if (battle.roundFinishTimer) return; // already finishing
        if (battle.roundTimer) { clearTimeout(battle.roundTimer); battle.roundTimer = null; }

        const nicknames = [...battle.clients].filter((c) => c.user && !c.isSpectator).map((c) => c.user!.username);
        battle.broadcast(new FinishBattlePacket(nicknames, ROUND_FINISH_PAUSE_MS / 1000));
        // Lobby preview watchers: the running timer they see should reset.
        this._sendToWatchers(battle, new LobbyPackets.RoundFinishPacket(battle.battleId));

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

        battle.roundFinishTimer = setTimeout(() => this.restartRound(battle), ROUND_FINISH_PAUSE_MS);
    }

    /** Restart a finished round: swap sides (team modes), reset scores/flags, respawn everyone, restart timer. */
    public restartRound(battle: Battle): void {
        battle.roundFinishTimer = null;
        if ([...battle.users, ...battle.usersBlue, ...battle.usersRed].length === 0) return; // emptied during the pause

        // Switch sides (team modes): swap the rosters, then re-send them so the client reassigns each
        // player's team in the scoreboard (RestartRoundTeamPacket = field0 red, field1 blue).
        if (battle.isTeamMode()) {
            const red = battle.usersRed;
            battle.usersRed = battle.usersBlue;
            battle.usersBlue = red;
        }

        battle.scoreRed = 0;
        battle.scoreBlue = 0;
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
        }

        // Kill-based score limit (DM = individual kills; team non-CTF = team's total kills).
        const limit = battle.settings.scoreLimit;
        if (killer.id !== victim.id && battle.settings.battleMode !== BattleMode.CTF) {
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
        // Score limit reached -> end the round.
        if (battle.settings.scoreLimit > 0 && newScore >= battle.settings.scoreLimit) {
            this.finishRound(battle);
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
