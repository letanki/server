import { GameClient } from "@/server/game.client";
import { UserDocument } from "@/shared/models/user.model";
import { UpdateCrystals } from "@/features/profile/profile.packets";
import { grantPremium } from "@/features/profile/premium.notify";
import { ShowDonationAlert } from "@/features/shop/shop.packets";
import { isCrystalAbonementActive } from "@/shared/models/passes";
import { ResourceManager } from "@/utils/resource.manager";
import { ResourceId } from "@/generated/resourceTypes";

// Imagem OFICIAL da janela de doação (idlow oficial 6628, type 13 localizada: <lang>.jpg + <lang>_alpha.jpg).
// Baixada via scripts/downloadResource.ts → resources/ui/shop/donation_alert. Precisa estar registrada no
// cliente quando o ShowDonationAlert chega (carregada pré-login), senão o descriptor resolve null → #1009.
const DONATION_ALERT_IMAGE = "ui/shop/donation_alert" as ResourceId;

/**
 * Aplica uma concessão estilo DOAÇÃO (compra de pacote OU promo tratado como doação):
 *  - credita `donatedCrystals` + `packageBonusCrystals` + o DOBRO (se o abonement de Dobro de Cristais
 *    estiver ativo — `doubleCrystalBonusCrystals = soma dos outros dois`);
 *  - ativa/renova premium por `premiumDays` (notificando EM TEMPO REAL via grantPremium);
 *  - envia `ShowDonationAlert` (janela "compra concluída") + `UpdateCrystals`.
 * NÃO persiste — o chamador faz `user.save()` (para agrupar com outros writes seus).
 */
export function applyDonationGrant(
    client: GameClient,
    user: UserDocument,
    grant: { donatedCrystals: number; packageBonusCrystals: number; premiumDays: number },
): void {
    const { donatedCrystals, packageBonusCrystals, premiumDays } = grant;
    const doubleCrystalBonus = isCrystalAbonementActive(user) ? donatedCrystals + packageBonusCrystals : 0;
    const totalCrystals = donatedCrystals + packageBonusCrystals + doubleCrystalBonus;

    user.crystals += totalCrystals;
    if (premiumDays > 0) grantPremium(client, user, premiumDays);
    if (totalCrystals > 0) client.sendPacket(new UpdateCrystals({ crystals: user.crystals }));

    client.sendPacket(new ShowDonationAlert({
        donatedCrystals,
        packageBonusCrystals,
        doubleCrystalBonusCrystals: doubleCrystalBonus,
        premiumDays,
        image: { high: 0, low: ResourceManager.getIdlowById(DONATION_ALERT_IMAGE) },
    }));
}
