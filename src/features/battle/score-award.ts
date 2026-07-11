import { GameClient } from "@/server/game.client";
import * as ProfilePackets from "@/features/profile/profile.packets";
import { advanceQuestsInMemory } from "@/features/quests/quests.service";
import { QuestCompletedNotification } from "@/features/quests/quests.packets";
import { xpFromScore } from "@/shared/models/passes";
import { Battle } from "./battle.model";
import { UpdateBattleUserDMPacket, UpdateBattleUserTeamPacket } from "./battle.packets";

/** Rebroadcasts a player's scoreboard row (kills/deaths/score) using the mode's packet. */
export function broadcastUserStat(battle: Battle, client: GameClient): void {
    const user = client.user;
    if (!user) return;
    const data = { deaths: client.deaths, kills: client.kills, score: client.battleScore, nickname: user.username };
    if (battle.isTeamMode()) {
        battle.broadcast(new UpdateBattleUserTeamPacket({ ...data, team: battle.teamOf(user) }));
    } else {
        battle.broadcast(new UpdateBattleUserDMPacket(data));
    }
}

/**
 * Single funnel for every scoring objective (kill/assist/flag deliver-return/point). There are TWO XP
 * kinds: the BATTLE XP (scoreboard `battleScore` + the round metric) gets `points` flat, with NO passe
 * bonus; the ACCOUNT XP (`user.experience`, the rank progress bar) gets `points × (1 + passe bonus)` —
 * the premium/upScore/newbie multiplier lands ONLY on the account, never in the match. Advances the
 * daily-quest score objective (plus any `extraQuest` counters, e.g. `kills`), persists, pushes
 * UpdateScore, and rebroadcasts the scoreboard row. No-op for non-positive points.
 */
export async function awardScore(battle: Battle, client: GameClient, points: number, extraQuest: { kills?: number } = {}): Promise<void> {
    const user = client.user;
    if (!user || points <= 0) return;
    // XP DE BATALHA (placar + métrica da partida) = base, SEM bônus de passe.
    client.battleScore += points;
    client.roundStats.xpEarned += points;
    // XP DA CONTA (barra de progresso) = base × (1 + bônus dos passes). O bônus vai SÓ para a conta.
    user.experience += xpFromScore(user, points);
    const questCompleted = advanceQuestsInMemory(user, { score: points, ...extraQuest }).completed;
    await user.save();
    client.sendPacket(new ProfilePackets.UpdateScorePacket({ score: user.experience }));
    if (questCompleted) client.sendPacket(new QuestCompletedNotification());
    broadcastUserStat(battle, client);
}
