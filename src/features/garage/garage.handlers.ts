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
                client.sendPacket(new ProfilePackets.UpdateScorePacket({ score: result.newExperience }));
                // purchaseItem only adds experience — recompute the rank here. On a rank-up, notify the
                // client and RELOAD the garage (it's open — that's where the item was bought): its item
                // lists are rank-dependent and don't rebuild in place (items would duplicate).
                if (server.rankService.updateRank(client.user)) {
                    await client.user.save();
                    const rankInfo = server.rankService.getRankById(client.user.rank);
                    client.sendPacket(new ProfilePackets.UpdateRankPacket({
                        rank: client.user.rank,
                        score: client.user.experience,
                        currentRankScore: rankInfo?.minScore ?? 0,
                        nextRankScore: client.user.nextRankScore,
                        reward: 0,
                    }));
                    GarageWorkflow.reloadGarage(client, server);
                }
            } else if (result && "passId" in result) {
                // Assinatura comprada: atualiza os cristais e recarrega a garagem (o passe vai pro
                // depósito com o tempo restante; suas listas dependem do estado e não rebuildam in-place).
                client.sendPacket(new ProfilePackets.UpdateCrystals({ crystals: client.user.crystals }));
                GarageWorkflow.reloadGarage(client, server);
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
                        client.sendPacket(new BattlePackets.UpdateConsumableCountPacket({ itemId: result.supplyId, count: result.newCount }));
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
            const battle = client.currentBattle;
            const u = client.user;
            const key = server.garageService.equipCooldownKey(packet.itemId);
            // Item ainda equipado na categoria do pedido — para reverter o mount otimista do cliente.
            const currentMount =
                key === "armor" ? `${u.equippedHull}_m${u.hulls.get(u.equippedHull) ?? 0}` :
                key === "weapon" ? `${u.equippedTurret}_m${u.turrets.get(u.equippedTurret) ?? 0}` :
                `${u.equippedPaint}_m0`;

            // Bloqueio total de troca: quando o rearmamento está DESABILITADO (reArmorEnabled=false) a
            // batalha não permite trocar equipamento. Batalhas XP/BP forçam reArmorEnabled=false na criação
            // (ver lobby.service.createBattle), então esta regra também cobre "XP/BP sempre travado".
            if (battle && !battle.settings.reArmorEnabled) {
                client.sendPacket(new GaragePackets.MountItemPacket({ itemId: currentMount, owned: true }));
                logger.info(`Equip of ${packet.itemId} by ${u.username} blocked: rearmamento desabilitado.`);
                return;
            }

            // Rearmamento habilitado: cada categoria (armor/weapon/color) tem cooldown de 15 min.
            if (battle && key && server.garageService.getEquipCooldownSec(u.id, key) > 0) {
                client.sendPacket(new GaragePackets.MountItemPacket({ itemId: currentMount, owned: true }));
                logger.info(`Equip of ${packet.itemId} by ${u.username} blocked: ${key} on cooldown (${server.garageService.getEquipCooldownSec(u.id, key)}s left).`);
                return;
            }

            await server.garageService.equipItem(client.user, packet.itemId);
            // NOTE: the cooldown is NOT armed here — inside the garage the player may swap freely (and back).
            // It's armed on garage EXIT, per category actually changed vs the open-snapshot (see
            // GarageWorkflow.applyEquipmentChange). The check above still blocks changing a category that is
            // already on cooldown from a PREVIOUS exit.
            if (battle) {
                client.equipmentChangedInGarage = true;
            }
            client.sendPacket(new GaragePackets.MountItemPacket({ itemId: packet.itemId, owned: true }));
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

        client.sendPacket(new GaragePackets.MountItemPacket({ itemId, owned }));
    }
}