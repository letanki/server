// Códigos promocionais resgatáveis (shop → "Resgatar"). Cada código concede uma recompensa uma única
// vez por conta (ver user.usedPromoCodes). As chaves são comparadas em MAIÚSCULAS (o handler faz
// trim().toUpperCase()). Adicione/edite à vontade.
export interface PromoReward {
    crystals?: number;
    premiumDays?: number;
}

export const promoCodesData: Record<string, PromoReward> = {
    BEMVINDO: { crystals: 1000 },
    LETANKI: { crystals: 5000, premiumDays: 1 },
};
