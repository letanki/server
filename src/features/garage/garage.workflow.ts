import { CALLBACK } from "@/config/constants";
import { ConfirmDestructionPacket, SelfDestructScheduledPacket } from "@/features/battle/battle.packets";
import { LoadDependencies } from "@/features/loader/loader.packets";
import { UnloadBattleListPacket } from "@/features/lobby/lobby.packets";
import { LobbyWorkflow } from "@/features/lobby/lobby.workflow";
import { ConfirmLayoutChange, SetLayout } from "@/features/system/system.packets";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { ResourceId } from "@/types/resourceTypes";
import logger from "@/utils/logger";
import { ResourceManager } from "@/utils/resource.manager";
import { itemBlueprints, supplyPreviewResources } from "./garage.data";
import * as GaragePackets from "./garage.packets";

export class GarageWorkflow {
    private static _loadGarageDependencies(client: GameClient): void {
        const resourceIds: ResourceId[] = ["garage"];

        itemBlueprints.turrets.forEach((turret) => {
            turret.modifications.forEach((mod) => {
                resourceIds.push(`turret/${turret.id}/m${mod.modificationID}/model` as ResourceId);
                resourceIds.push(`turret/${turret.id}/m${mod.modificationID}/preview` as ResourceId);
            });
        });

        itemBlueprints.hulls.forEach((hull) => {
            hull.modifications.forEach((mod) => {
                resourceIds.push(`hull/${hull.id}/m${mod.modificationID}/model` as ResourceId);
                resourceIds.push(`hull/${hull.id}/m${mod.modificationID}/preview` as ResourceId);
            });
        });

        itemBlueprints.paints.forEach((paint) => {
            resourceIds.push(`paint/${paint.id}/texture` as ResourceId);
            resourceIds.push(`paint/${paint.id}/preview` as ResourceId);
        });

        // Supply preview icons (served from our own resource server, like every other resource).
        Object.values(supplyPreviewResources).forEach((resourceId) => resourceIds.push(resourceId));

        const uniqueResourceIds = [...new Set(resourceIds)];

        const dependencies = {
            resources: ResourceManager.getBulkResources(uniqueResourceIds),
        };
        client.sendPacket(new LoadDependencies(dependencies, CALLBACK.GARAGE_DATA));

        logger.info(`User ${client.user!.username} is loading garage resources.`);
    }

    public static async enterGarage(client: GameClient, server: GameServer): Promise<void> {
        if (!client.user) {
            logger.error("Attempted to enter garage without a user authenticated.", { client: client.getRemoteAddress() });
            return;
        }

        if (!client.isChatLoaded) {
            await LobbyWorkflow.sendChatSetup(client.user, client, server);
        }

        client.setState("chat_garage");
        client.sendPacket(new SetLayout(1));
        client.sendPacket(new UnloadBattleListPacket());

        this._loadGarageDependencies(client);
    }

    public static enterBattleGarageView(client: GameClient, server: GameServer): void {
        client.setState("battle_garage");
        client.sendPacket(new SetLayout(1));
        this._loadGarageDependencies(client);
    }

    public static transitionFromLobbyToGarage(client: GameClient, server: GameServer): void {
        client.sendPacket(new UnloadBattleListPacket());
        this.enterBattleGarageView(client, server);
    }

    private static _triggerSelfDestructForRespawn(client: GameClient, server: GameServer): void {
        if (client.battleState === "suicide") {
            return;
        }

        const selfDestructTime = 3000;
        client.sendPacket(new SelfDestructScheduledPacket(selfDestructTime));

        setTimeout(() => {
            if (client.isDestroyed || !client.currentBattle) {
                return;
            }

            if (client.battleState === "suicide") {
                return;
            }

            server.battleService.dropFlag(client.user!, client.currentBattle, client.battlePosition);

            client.battleState = "suicide";
            client.battleIncarnation++;

            const destructionPacket = new ConfirmDestructionPacket(client.user!.username, 3000);
            const battle = client.currentBattle;
            const allPlayers = [...battle.users, ...battle.usersBlue, ...battle.usersRed];
            allPlayers.forEach((player) => {
                const playerClient = server.findClientByUsername(player.username);
                if (playerClient && playerClient.currentBattle?.battleId === battle.battleId) {
                    playerClient.sendPacket(destructionPacket);
                }
            });
        }, selfDestructTime);
    }

    public static returnToBattleView(client: GameClient, server: GameServer): void {
        client.setState("battle");
        client.sendPacket(new SetLayout(3));
        client.sendPacket(new GaragePackets.UnloadGaragePacket());

        if (client.equipmentChangedInGarage) {
            client.equipmentChangedInGarage = false;
            client.pendingEquipmentRespawn = true;

            const otherClientsInBattle = server.getClients().filter((c) => c !== client && c.currentBattle?.battleId === client.currentBattle?.battleId);

            if (otherClientsInBattle.length > 0) {
                const user = client.user!;
                const hullId = user.equippedHull,
                    hullMod = user.hulls.get(hullId) ?? 0;
                const turretId = user.equippedTurret,
                    turretMod = user.turrets.get(turretId) ?? 0;
                const paintId = user.equippedPaint;

                const resourcesToLoad: ResourceId[] = [`hull/${hullId}/m${hullMod}/model` as ResourceId, `turret/${turretId}/m${turretMod}/model` as ResourceId, `paint/${paintId}/texture` as ResourceId];

                const acknowledgements = new Set(otherClientsInBattle.map((c) => c.user!.username));

                const onResourcesLoadedCallback = (acknowledgingClient: GameClient) => {
                    acknowledgements.delete(acknowledgingClient.user!.username);
                    if (acknowledgements.size === 0) {
                        server.removeDynamicCallback(callbackId);
                        this._triggerSelfDestructForRespawn(client, server);
                    }
                };

                const callbackId = server.registerDynamicCallback(onResourcesLoadedCallback);
                const depsPacket = new LoadDependencies({ resources: ResourceManager.getBulkResources(resourcesToLoad) }, callbackId);

                otherClientsInBattle.forEach((otherClient) => {
                    otherClient.sendPacket(depsPacket);
                });
            } else {
                this._triggerSelfDestructForRespawn(client, server);
            }
        }

        client.sendPacket(new ConfirmLayoutChange(3, 3));
    }

    public static initializeGarage(client: GameClient, server: GameServer): void {
        if (!client.user) {
            logger.error(`Cannot initialize garage for unauthenticated client.`);
            return;
        }

        logger.info(`Initializing garage for ${client.user.username}.`);

        const userInventory = {
            ...Object.fromEntries(client.user.turrets),
            ...Object.fromEntries(client.user.hulls),
            paints: client.user.paints,
            supplies: client.user.supplies,
        };

        const { garageItems, shopItems } = server.garageService.buildGarageData(userInventory);

        const garageData = {
            items: garageItems,
            garageBoxId: ResourceManager.getIdlowById("garage"),
        };
        client.sendPacket(new GaragePackets.GarageItemsPacket(JSON.stringify(garageData)));

        const shopData = {
            items: shopItems,
            delayMountArmorInSec: 0,
            delayMountWeaponInSec: 0,
            delayMountColorInSec: 0,
        };
        client.sendPacket(new GaragePackets.ShopItemsPacket(JSON.stringify(shopData)));

        const turretId = client.user.equippedTurret;
        const turretMod = client.user.turrets.get(turretId) ?? 0;
        const hullId = client.user.equippedHull;
        const hullMod = client.user.hulls.get(hullId) ?? 0;
        const paintId = client.user.equippedPaint;

        client.sendPacket(new GaragePackets.MountItemPacket(`${hullId}_m${hullMod}`, true));
        client.sendPacket(new GaragePackets.MountItemPacket(`${turretId}_m${turretMod}`, true));
        client.sendPacket(new GaragePackets.MountItemPacket(`${paintId}_m0`, true));

        if (client.getState() === "battle_garage") {
            client.sendPacket(new ConfirmLayoutChange(3, 1));
        } else {
            client.sendPacket(new ConfirmLayoutChange(1, 1));
        }
    }
}