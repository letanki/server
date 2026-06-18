import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import * as ProfilePackets from "@/features/profile/profile.packets";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import logger from "@/utils/logger";
import * as GaragePackets from "./garage.packets";
import { GarageWorkflow } from "./garage.workflow";

export class RequestGarageHandler implements IPacketHandler<GaragePackets.RequestGaragePacket> {
    public readonly packetId = GaragePackets.RequestGaragePacket.getId();

    public async execute(client: GameClient, server: GameServer, packet: GaragePackets.RequestGaragePacket): Promise<void> {
        const state = client.getState();

        if (client.currentBattle) {
            if (state === "battle") {
                GarageWorkflow.enterBattleGarageView(client, server);
            } else if (state === "battle_garage") {
                GarageWorkflow.returnToBattleView(client, server);
            } else if (state === "battle_lobby") {
                GarageWorkflow.transitionFromLobbyToGarage(client, server);
            }
        } else {
            if (state === "chat_lobby") {
                await GarageWorkflow.enterGarage(client, server);
            }
        }
    }
}

export class BuyItemHandler implements IPacketHandler<GaragePackets.BuyItemPacket> {
    public readonly packetId = GaragePackets.BuyItemPacket.getId();

    public async execute(client: GameClient, server: GameServer, packet: GaragePackets.BuyItemPacket): Promise<void> {
        if (!client.user || !packet.itemId) {
            return;
        }

        try {
            const result = await server.garageService.purchaseItem(client.user, packet.itemId, packet.quantity, packet.price);
            // The "1000_scores" supply is consumed instantly and grants experience; refresh the
            // client's score counter with the new total.
            if (result && typeof result.newExperience === "number") {
                client.sendPacket(new ProfilePackets.UpdateScorePacket(result.newExperience));
            }
        } catch (error: any) {
            logger.warn(`Failed to purchase item ${packet.itemId} for user ${client.user.username}`, {
                error: error.message,
                client: client.getRemoteAddress(),
            });
        }
    }
}

export class EquipItemRequestHandler implements IPacketHandler<GaragePackets.EquipItemRequestPacket> {
    public readonly packetId = GaragePackets.EquipItemRequestPacket.getId();

    public async execute(client: GameClient, server: GameServer, packet: GaragePackets.EquipItemRequestPacket): Promise<void> {
        if (!client.user || !packet.itemId) {
            return;
        }

        try {
            await server.garageService.equipItem(client.user, packet.itemId);
            if (client.currentBattle) {
                client.equipmentChangedInGarage = true;
            }
            client.sendPacket(new GaragePackets.MountItemPacket(packet.itemId, true));
        } catch (error: any) {
            logger.warn(`Failed to equip item ${packet.itemId} for user ${client.user.username}`, {
                error: error.message,
                client: client.getRemoteAddress(),
            });
        }
    }
}