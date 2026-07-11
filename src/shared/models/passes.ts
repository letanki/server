import { UserDocument } from "@/shared/models/user.model";

// Assinaturas/passes por tempo. Fonte: wiki `Experience` + capturas (docs-internal/PLANO-EXPERIENCIA.md).
//
// Bônus de XP dos passes ATIVOS são SOMADOS e aplicados no momento do ganho (não no fim da partida):
//   premium +50%, up_score +30%, newbie +50%. O Score (Tab / fundo) NÃO recebe bônus.

/** Uma assinatura está ativa enquanto a data de expiração está no futuro. */
export function isActive(expiresAt: Date | null | undefined): boolean {
    return !!expiresAt && expiresAt.getTime() > Date.now();
}

export const isPremiumActive = (u: UserDocument): boolean => isActive(u.premiumExpiresAt);
export const isNewbieActive = (u: UserDocument): boolean => isActive(u.newbieExpiresAt);
export const isUpScoreActive = (u: UserDocument): boolean => isActive(u.upScoreExpiresAt);

/** Percentual de bônus de XP por passe (wiki + confirmação do dono). */
export const XP_BONUS_PERCENT = { PREMIUM: 50, UP_SCORE: 30, NEWBIE: 50 } as const;

/**
 * Soma dos bônus de XP dos passes ativos (ex.: os três ativos → 130). TODOS os passes valem em TODOS os
 * modos — o bônus incide só no XP DA CONTA (barra de progresso), nunca no battleScore da partida.
 */
export function xpBonusPercent(u: UserDocument): number {
    return (isPremiumActive(u) ? XP_BONUS_PERCENT.PREMIUM : 0)
        + (isUpScoreActive(u) ? XP_BONUS_PERCENT.UP_SCORE : 0)
        + (isNewbieActive(u) ? XP_BONUS_PERCENT.NEWBIE : 0);
}

/** XP da conta a partir do Score base, aplicando os multiplicadores dos passes. O Score em si não muda. */
export function xpFromScore(u: UserDocument, baseScore: number): number {
    return Math.round(baseScore * (1 + xpBonusPercent(u) / 100));
}

// Durações dos passes.
export const NEWBIE_DURATION_MS = 21 * 24 * 3600 * 1000; // 21 dias (concedido ao criar conta)
export const UP_SCORE_DURATION_MS = 30 * 24 * 3600 * 1000; // 30 dias (comprável na garagem)

/** Bônus de CRISTAIS por batalha do passe iniciante (separado do multiplicador de XP). */
export const NEWBIE_CRYSTAL_BONUS_PERCENT = 100;

/** % de cristais extra por batalha com Premium (= premiumBonusInPercent enviado na BattleStats). */
export const PREMIUM_CRYSTAL_BONUS_PERCENT = 100;

/** Bônus de CRISTAIS de fim de batalha (mostrados separados no resultado), sobre o reward base. */
export function crystalBonuses(u: UserDocument, baseReward: number): { newbieBonus: number; premiumBonus: number } {
    return {
        newbieBonus: isNewbieActive(u) ? Math.round(baseReward * NEWBIE_CRYSTAL_BONUS_PERCENT / 100) : 0,
        premiumBonus: isPremiumActive(u) ? Math.round(baseReward * PREMIUM_CRYSTAL_BONUS_PERCENT / 100) : 0,
    };
}

/** Segundos restantes de um passe (0 se inativo) — para os pacotes de init (ex.: InitNewbieBonus). */
export function secondsLeft(expiresAt: Date | null | undefined): number {
    return isActive(expiresAt) ? Math.round((expiresAt!.getTime() - Date.now()) / 1000) : 0;
}
