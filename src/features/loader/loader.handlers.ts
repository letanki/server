import { CALLBACK } from "@/config/constants";
import { AuthWorkflow } from "@/features/authentication/auth.workflow";
import { BattleWorkflow } from "@/features/battle/battle.workflow";
import { GarageWorkflow } from "@/features/garage/garage.workflow";
import { LobbyWorkflow } from "@/features/lobby/lobby.workflow";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import { ResourceId } from "@/generated/resourceTypes";
import { ResourceManager } from "@/utils/resource.manager";
import * as LoaderPackets from "./loader.packets";

export class RequestNextTipHandler implements IPacketHandler<LoaderPackets.RequestNextTipPacket> {
    public readonly packetId = LoaderPackets.RequestNextTipPacket.getId();

    public execute(client: GameClient, server: GameServer, packet: LoaderPackets.RequestNextTipPacket): void {
        const tipResources: ResourceId[] = ["tips/tip_1", "tips/tip_2", "tips/tip_3"];
        const randomTipId = tipResources[Math.floor(Math.random() * tipResources.length)];

        try {
            const resourceIdLow = ResourceManager.getIdlowById(randomTipId);
            client.sendPacket(new LoaderPackets.SetLoadingScreenImagePacket(resourceIdLow));
        } catch (error) {
            client.sendPacket(new LoaderPackets.SetLoadingScreenImagePacket(ResourceManager.getIdlowById("ui/login_background")));
        }
    }
}

export class ResourceCallbackHandler implements IPacketHandler<LoaderPackets.ResourceCallback> {
    public readonly packetId = LoaderPackets.ResourceCallback.getId();

    public async execute(client: GameClient, server: GameServer, packet: LoaderPackets.ResourceCallback): Promise<void> {
        if (server.executeDynamicCallback(packet.callbackId, client)) {
            return;
        }

        switch (packet.callbackId) {
            case CALLBACK.LOGIN_FORM:
                AuthWorkflow.initializeLoginForm(client, server);
                break;
            case CALLBACK.GARAGE_DATA:
                GarageWorkflow.initializeGarage(client, server);
                break;
            case CALLBACK.LOBBY_DATA:
                await LobbyWorkflow.initializeLobby(client, server);
                break;
            case CALLBACK.BATTLE_MAP_LIBS_LOADED:
                if (client.currentBattle) {
                    BattleWorkflow.loadMapResources(client, server, client.currentBattle);
                }
                break;
            case CALLBACK.BATTLE_SKYBOX_LOADED:
                if (client.currentBattle) {
                    BattleWorkflow.loadMapGeometry(client, server, client.currentBattle);
                }
                break;
            case CALLBACK.BATTLE_MAP_GEOMETRY_LOADED:
                if (client.currentBattle) {
                    BattleWorkflow.loadGeneralBattleResources(client, server, client.currentBattle);
                }
                break;
            case CALLBACK.BATTLE_GENERAL_RESOURCES_LOADED:
                if (client.currentBattle) {
                    BattleWorkflow.loadPlayerEquipment(client, server, client.currentBattle);
                }
                break;
            case CALLBACK.BATTLE_PLAYER_EQUIPMENT_LOADED:
                if (client.currentBattle) {
                    BattleWorkflow.initializeBattle(client, server, client.currentBattle);
                }
                break;
            case CALLBACK.TIPS_LOADED:
                AuthWorkflow.sendMainLoginResources(client, server);
                break;
        }
    }
}