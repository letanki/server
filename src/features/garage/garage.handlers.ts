import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import * as BattlePackets from "@/features/battle/battle.packets";
import { BattleWorkflow } from "@/features/battle/battle.workflow";
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
            if (result && "newExperience" in result) {
                client.sendPacket(new ProfilePackets.UpdateScorePacket(result.newExperience));
            } else if (result && "supplyId" in result) {
                // Bought a stackable supply: keep the in-battle supply panel in sync. If the player had
                // supplies already (panel loaded), update just this item's count; otherwise this is their
                // first supply, so load the panel.
                const battle = client.currentBattle;
                const filtered =
                    (result.supplyId === "mine" && battle?.settings.withoutMines) ||
                    (result.supplyId === "health" && battle?.settings.withoutMedkit);
                if (battle && !client.isSpectator && !battle.settings.withoutSupplies && !filtered) {
                    if (result.hadSuppliesBefore) {
                        client.sendPacket(new BattlePackets.UpdateConsumableCountPacket(result.supplyId, result.newCount));
                    } else {
                        BattleWorkflow.sendConsumables(client, battle);
                    }
                }
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

// PREVIEW ("fit"): the player clicked an item to try it on the garage tank without equipping/buying it.
// We reply with MountItemPacket so the client shows it on the model; `owned` drives the equip-vs-buy UI.
export class FitItemHandler implements IPacketHandler<GaragePackets.FitItemPacket> {
    public readonly packetId = GaragePackets.FitItemPacket.getId();

    public execute(client: GameClient, server: GameServer, packet: GaragePackets.FitItemPacket): void {
        const user = client.user;
        if (!user || !packet.itemId) {
            return;
        }

        // itemId is "<base>_m<mod>" (e.g. "africa_m0", "wasp_m2"). Owned = the player has the paint, or
        // owns the hull/turret at >= the previewed mod.
        const itemId = packet.itemId;
        const base = itemId.replace(/_m\d+$/, "");
        const mod = Number(itemId.match(/_m(\d+)$/)?.[1] ?? 0);
        const owned =
            user.paints.includes(base) ||
            (user.hulls.has(base) && (user.hulls.get(base) ?? -1) >= mod) ||
            (user.turrets.has(base) && (user.turrets.get(base) ?? -1) >= mod);

        client.sendPacket(new GaragePackets.MountItemPacket(itemId, owned));
    }
}