import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import logger from "@/utils/logger";
import * as ShopPackets from "./shop.packets";
import { ShowAlertMessage } from "@/features/system/system.packets";
import { UpdateCrystals } from "@/features/profile/profile.packets";
import { promoCodesData } from "@/config/promo-codes.data";

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
/**
 * C→S: o jogador escolheu um pacote + método de pagamento (cryptomus/paygate/telegram) e confirmou.
 * O fluxo oficial responde com OpenPaymentUrl (URL de checkout do provedor). Ainda NÃO temos integração
 * de pagamento (ver docs-internal/tarefas/2), então avisamos por um modal em vez de abrir um checkout.
 */
export class PurchaseShopItemHandler implements IPacketHandler<ShopPackets.PurchaseShopItem> {
    public readonly packetId = ShopPackets.PurchaseShopItem.getId();
    public execute(client: GameClient, _server: GameServer, packet: ShopPackets.PurchaseShopItem): void {
        logger.info(`Shop purchase attempt: item=${packet.itemId} method=${packet.paymentMethod} by ${client.user?.username}`);
        client.sendPacket(new ShowAlertMessage({ text: "Pagamentos ainda não estão disponíveis neste servidor." }));
        // TODO (tarefa 2): gerar a URL de checkout do provedor escolhido e responder com OpenPaymentUrl.
    }
}

/**
 * C→S: ativar um código promocional. Concede a recompensa (config promoCodesData) uma vez por conta e
 * responde PromoCodeValid; código desconhecido / já usado → PromoCodeInvalid.
 */
export class ActivatePromoCodeHandler implements IPacketHandler<ShopPackets.ActivatePromoCode> {
    public readonly packetId = ShopPackets.ActivatePromoCode.getId();
    public async execute(client: GameClient, _server: GameServer, packet: ShopPackets.ActivatePromoCode): Promise<void> {
        const user = client.user;
        if (!user) return;
        const code = (packet.code ?? "").trim().toUpperCase();
        const reward = promoCodesData[code];
        if (!code || !reward || user.usedPromoCodes.includes(code)) {
            client.sendPacket(new ShopPackets.PromoCodeInvalid());
            return;
        }

        if (reward.crystals) user.crystals += reward.crystals;
        if (reward.premiumDays) {
            const base = user.premiumExpiresAt && user.premiumExpiresAt > new Date() ? user.premiumExpiresAt.getTime() : Date.now();
            user.premiumExpiresAt = new Date(base + reward.premiumDays * 24 * 60 * 60 * 1000);
        }
        user.usedPromoCodes.push(code);
        await user.save();

        client.sendPacket(new ShopPackets.PromoCodeValid());
        if (reward.crystals) client.sendPacket(new UpdateCrystals({ crystals: user.crystals }));
        logger.info(`User ${user.username} redeemed promo code ${code} (crystals=${reward.crystals ?? 0}, premiumDays=${reward.premiumDays ?? 0}).`);
    }
}
