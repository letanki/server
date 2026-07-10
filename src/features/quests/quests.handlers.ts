import { UpdateCrystals } from "@/features/profile/profile.packets";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import logger from "@/utils/logger";
import * as QuestPackets from "./quests.packets";

export class RequestQuestsWindowHandler implements IPacketHandler<QuestPackets.RequestQuestsWindow> {
    public readonly packetId = QuestPackets.RequestQuestsWindow.getId();

    public async execute(client: GameClient, server: GameServer, packet: QuestPackets.RequestQuestsWindow): Promise<void> {
        if (!client.user) {
            logger.warn("RequestQuestsWindow received from unauthenticated client.", { client: client.getRemoteAddress() });
            return;
        }

        const questData = await server.questService.getQuestsForUser(client.user);
        // No active missions (all completed & collected) → the official sends the summary packet, NOT a
        // ShowQuestsWindow with an empty list (which the client renders wrong).
        client.sendPacket(
            questData.quests.length === 0
                ? new QuestPackets.QuestSummaryWindow(questData)
                : new QuestPackets.ShowQuestsWindow(questData)
        );
    }
}

export class CollectQuestRewardHandler implements IPacketHandler<QuestPackets.CollectQuestReward> {
    public readonly packetId = QuestPackets.CollectQuestReward.getId();

    public async execute(client: GameClient, server: GameServer, packet: QuestPackets.CollectQuestReward): Promise<void> {
        if (!client.user) return;
        const result = await server.questService.collectReward(client.user, packet.questId);
        if (!result) return; // not collectable (not complete, or already claimed)
        client.sendPacket(new QuestPackets.QuestRewardCollected(packet.questId));
        if (result.crystalsGranted > 0) client.sendPacket(new UpdateCrystals({ crystals: client.user.crystals }));
    }
}

export class SkipQuestFreeHandler implements IPacketHandler<QuestPackets.SkipQuestFree> {
    public readonly packetId = QuestPackets.SkipQuestFree.getId();

    public async execute(client: GameClient, server: GameServer, packet: QuestPackets.SkipQuestFree): Promise<void> {
        const currentUser = client.user;
        if (!currentUser) {
            return;
        }

        try {
            const result = await server.questService.rerollQuest(currentUser, packet.missionId, false);
            const newQuestPacketData = server.questService.buildQuestView(currentUser, result.newQuest);
            client.sendPacket(new QuestPackets.ReplaceQuest({ missionToReplaceId: result.oldQuestId, newQuest: newQuestPacketData }));
        } catch (error: any) {
            logger.warn(`Failed to skip quest for free for user ${currentUser.username}`, { error: error.message });
        }
    }
}

export class SkipQuestPaidHandler implements IPacketHandler<QuestPackets.SkipQuestPaid> {
    public readonly packetId = QuestPackets.SkipQuestPaid.getId();

    public async execute(client: GameClient, server: GameServer, packet: QuestPackets.SkipQuestPaid): Promise<void> {
        const currentUser = client.user;
        if (!currentUser) {
            return;
        }

        try {
            const result = await server.questService.rerollQuest(currentUser, packet.missionId, true);
            const newQuestPacketData = server.questService.buildQuestView(currentUser, result.newQuest);
            client.sendPacket(new QuestPackets.ReplaceQuest({ missionToReplaceId: result.oldQuestId, newQuest: newQuestPacketData }));
            client.sendPacket(new UpdateCrystals({ crystals: currentUser.crystals }));
        } catch (error: any) {
            logger.warn(`Failed to skip quest with payment for user ${currentUser.username}`, { error: error.message });
        }
    }
}