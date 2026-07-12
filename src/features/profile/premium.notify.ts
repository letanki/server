import { GameClient } from "@/server/game.client";
import { UserDocument } from "@/shared/models/user.model";
import { UpdatePremiumTimePacket, ShowPremiumAlert } from "@/features/profile/profile.packets";

/** Segundos de premium restantes (0 se expirado/nulo). */
export function premiumSecondsLeft(user: UserDocument): number {
    if (!user.premiumExpiresAt || user.premiumExpiresAt <= new Date()) return 0;
    return Math.round((user.premiumExpiresAt.getTime() - Date.now()) / 1000);
}

/**
 * Ativa/renova o premium por `days` dias (estende do vencimento atual se ainda ativo, senão a partir de
 * agora). SEMPRE envia `UpdatePremiumTime` (novo tempo restante, em tempo real). O `ShowPremiumAlert`
 * (popup de ativado) SÓ dispara quando o usuário NÃO tinha premium ativo — 1ª ativação (returning=false)
 * ou reativação após expirar (returning=true); numa renovação de premium já ativo, não mostra o popup.
 * Muta `user.premiumExpiresAt` — persistir (`user.save()`) fica a cargo do chamador.
 */
export function grantPremium(client: GameClient, user: UserDocument, days: number): void {
    if (days <= 0) return;
    const now = new Date();
    const wasActive = !!user.premiumExpiresAt && user.premiumExpiresAt > now;
    const hadBefore = !!user.premiumExpiresAt; // já teve premium alguma vez (mesmo expirado)
    const base = wasActive ? user.premiumExpiresAt!.getTime() : now.getTime();
    user.premiumExpiresAt = new Date(base + days * 24 * 60 * 60 * 1000);

    client.sendPacket(new UpdatePremiumTimePacket({ timeLeft: premiumSecondsLeft(user) }));
    if (!wasActive) client.sendPacket(new ShowPremiumAlert({ returning: hadBefore }));
}
