import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import logger from "@/utils/logger";
import * as ShopPackets from "./shop.packets";

export class RequestShopDataHandler implements IPacketHandler<ShopPackets.RequestShopData> {
    public readonly packetId = ShopPackets.RequestShopData.getId();
    public execute(client: GameClient, server: GameServer, packet: ShopPackets.RequestShopData): void {
        if (!client.user) {
            logger.warn("RequestShopData received from unauthenticated client.", { client: client.getRemoteAddress() });
            return;
        }
        const shopDataPayload = server.shopService.getShopData(client.user, client.shopCountryCode);
        client.sendPacket(new ShopPackets.ShopData({ jsonData: shopDataPayload }));
    }
}

export class SetShopCountryHandler implements IPacketHandler<ShopPackets.SetShopCountry> {
    public readonly packetId = ShopPackets.SetShopCountry.getId();
    public execute(client: GameClient, server: GameServer, packet: ShopPackets.SetShopCountry): void {
        if (packet.countryCode) {
            client.shopCountryCode = packet.countryCode.toUpperCase();
            logger.info(`Client ${client.getRemoteAddress()} set shop country to ${client.shopCountryCode}`);
        }
    }
}

export class RequestPaymentWindowHandler implements IPacketHandler<ShopPackets.RequestPaymentWindow> {
    public readonly packetId = ShopPackets.RequestPaymentWindow.getId();
    public execute(client: GameClient, server: GameServer, packet: ShopPackets.RequestPaymentWindow): void {
        client.sendPacket(new ShopPackets.ShowPaymentWindow());
    }
}