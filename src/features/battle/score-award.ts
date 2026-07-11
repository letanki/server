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
 * Single funnel for every scoring objective (kill/assist/flag deliver-return/point). Adds `points` to
 * the battle Score AND the matching XP — XP = base × (1 + passe bonus), applied at the moment of the
 * gain (premium/upScore/newbie); the Score itself never gets the multiplier. Advances the daily-quest
 * score objective (plus any `extraQuest` counters, e.g. `kills`), persists, pushes UpdateScore, and
 * rebroadcasts the scoreboard row. No-op for non-positive points.
 */
export async function awardScore(battle: Battle, client: GameClient, points: number, extraQuest: { kills?: number } = {}): Promise<void> {
    const user = client.user;
    if (!user || points <= 0) return;
    client.battleScore += points;
    const xpGain = xpFromScore(user, points);
    user.experience += xpGain;
    client.roundStats.xpEarned += xpGain;
    const questCompleted = advanceQuestsInMemory(user, { score: points, ...extraQuest }).completed;
    await user.save();
    client.sendPacket(new ProfilePackets.UpdateScorePacket({ score: user.experience }));
    if (questCompleted) client.sendPacket(new QuestCompletedNotification());
    broadcastUserStat(battle, client);
}
