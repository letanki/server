import { UpdateCrystals } from "@/features/profile/profile.packets";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import logger from "@/utils/logger";
import { ResourceManager } from "@/utils/resource.manager";
import { QuestDefinitions } from "./quests.data";
import * as QuestPackets from "./quests.packets";
import { IQuest } from "./quests.types";

export class RequestQuestsWindowHandler implements IPacketHandler<QuestPackets.RequestQuestsWindow> {
    public readonly packetId = QuestPackets.RequestQuestsWindow.getId();

    public async execute(client: GameClient, server: GameServer, packet: QuestPackets.RequestQuestsWindow): Promise<void> {
        if (!client.user) {
            logger.warn("RequestQuestsWindow received from unauthenticated client.", { client: client.getRemoteAddress() });
            return;
        }

        const questData = await server.questService.getQuestsForUser(client.user);
        client.sendPacket(new QuestPackets.ShowQuestsWindow(questData));
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

            const definition = QuestDefinitions.find((def) => def.type === result.newQuest.questType);
            if (!definition) throw new Error("New quest definition not found after reroll.");

            const newQuestPacketData: IQuest = {
                canSkipForFree: result.newQuest.canSkipForFree,
                description: definition.description.replace("%n", result.newQuest.finishCriteria.toString()),
                finishCriteria: result.newQuest.finishCriteria,
                image: ResourceManager.getIdlowById(definition.imageResource),
                progress: result.newQuest.progress,
                questId: result.newQuest.questId,
                skipCost: definition.skipCost,
                prizes: result.newQuest.prizes,
            };

            client.sendPacket(new QuestPackets.ReplaceQuest(result.oldQuestId, newQuestPacketData));

            const updatedUser = await server.userService.findUserByUsername(currentUser.username);
            if (updatedUser) {
                client.user = updatedUser;
            }
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

            const definition = QuestDefinitions.find((def) => def.type === result.newQuest.questType);
            if (!definition) throw new Error("New quest definition not found after reroll.");

            const newQuestPacketData: IQuest = {
                canSkipForFree: result.newQuest.canSkipForFree,
                description: definition.description.replace("%n", result.newQuest.finishCriteria.toString()),
                finishCriteria: result.newQuest.finishCriteria,
                image: ResourceManager.getIdlowById(definition.imageResource),
                progress: result.newQuest.progress,
                questId: result.newQuest.questId,
                skipCost: definition.skipCost,
                prizes: result.newQuest.prizes,
            };

            const updatedUser = await server.userService.findUserByUsername(currentUser.username);
            if (updatedUser) {
                client.user = updatedUser;
            }

            client.sendPacket(new QuestPackets.ReplaceQuest(result.oldQuestId, newQuestPacketData));

            if (client.user) {
                client.sendPacket(new UpdateCrystals(client.user.crystals));
            }
        } catch (error: any) {
            logger.warn(`Failed to skip quest with payment for user ${currentUser.username}`, { error: error.message });
        }
    }
}