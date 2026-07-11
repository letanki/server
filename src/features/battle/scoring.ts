// Cálculo PURO de Score (= XP base) dos objetivos de batalha, conforme o wiki `Experience`
// (docs-internal/PLANO-EXPERIENCIA.md). Sem dependência de batalha/estado → 100% testável.
//
// Regra geral: cada função devolve o SCORE base do objetivo (o XP base = score; o multiplicador
// dos passes é aplicado à parte, ver `@/shared/models/passes`). O fundo de time usa o score base.

/** Cascos LEVES (destruí-los rende menos). Os demais rendem o valor padrão. */
export const LIGHT_HULLS = new Set(["wasp", "hornet"]);

export const KILL_SCORE_STANDARD = 10;
export const KILL_SCORE_LIGHT = 8;
export const ASSIST_SCORE_CAP = 15;
export const HEAL_SCORE_PER_SEC = 3; // Isida curando aliado
export const FLAG_DELIVER_PER_ENEMY = 10;
export const KILL_FLAG_CARRIER_MULT = 2; // dobro de um kill normal → 16–20
export const RETURN_FLAG_SEGMENTS = 6; // reta base→base dividida em 5+1 partes (prêmio 0..5 × enemy)
export const POINT_CAPTURE_PER_ENEMY = 2;

/** Normaliza um id de casco para a base (remove sufixo de modificação `_mN`). */
function baseHullId(hullId: string): string {
    return hullId.replace(/_m\d+$/, "");
}

/** Score por destruir um inimigo, pelo casco da VÍTIMA: 8 (leve: Wasp/Hornet) ou 10 (demais). */
export function killScore(victimHullId: string): number {
    return LIGHT_HULLS.has(baseHullId(victimHullId)) ? KILL_SCORE_LIGHT : KILL_SCORE_STANDARD;
}

/** Score por matar o PORTADOR da bandeira: o dobro de um kill normal (16–20 pelo casco da vítima). */
export function killFlagCarrierScore(victimHullId: string): number {
    return KILL_FLAG_CARRIER_MULT * killScore(victimHullId);
}

/**
 * Assistências: divide `cap` (15) proporcional ao DANO entre todos que feriram a vítima (inclui quem
 * deu o abate — o kill em si é separado). Retorna share por usuário (fracionário; o chamador arredonda).
 */
export function assistShares(damageByUser: Map<string, number>, cap: number = ASSIST_SCORE_CAP): Map<string, number> {
    const shares = new Map<string, number>();
    let total = 0;
    for (const dmg of damageByUser.values()) if (dmg > 0) total += dmg;
    if (total <= 0) return shares;
    for (const [user, dmg] of damageByUser) {
        if (dmg > 0) shares.set(user, (cap * dmg) / total);
    }
    return shares;
}

export interface FlagDeliveryRoles {
    capturers: string[]; // levaram a bandeira à própria base (normalmente 1)
    baseTakers: string[]; // pegaram a bandeira na base inimiga (normalmente 1)
    carriers: string[]; // carregaram em algum trecho (pode ser vários)
}

/**
 * Entregar bandeira: total `10 × enemy`, dividido por PAPEL — 50% capturador, 20% quem tirou da base,
 * 30% carregadores. Uma pessoa acumula os papéis que fez; cada papel é rateado entre quem o fez.
 */
export function deliverFlagShares(enemy: number, roles: FlagDeliveryRoles): Map<string, number> {
    const total = FLAG_DELIVER_PER_ENEMY * enemy;
    const shares = new Map<string, number>();
    const addRole = (users: string[], pct: number) => {
        if (users.length === 0) return;
        const per = (total * pct) / 100 / users.length;
        for (const u of users) shares.set(u, (shares.get(u) ?? 0) + per);
    };
    addRole(roles.capturers, 50);
    addRole(roles.baseTakers, 20);
    addRole(roles.carriers, 30);
    return shares;
}

/**
 * Retornar bandeira: `seg × enemy`, onde `seg` (0..5) é o segmento em que a bandeira estava na reta
 * base-própria→base-inimiga (6 partes). Perto da base própria → 0; quase capturando (perto da inimiga)
 * → 5 × enemy.
 */
export function returnFlagScore(distFromOwnBase: number, distBetweenBases: number, enemy: number): number {
    if (distBetweenBases <= 0) return 0;
    const frac = Math.max(0, Math.min(1, distFromOwnBase / distBetweenBases));
    const seg = Math.min(RETURN_FLAG_SEGMENTS - 1, Math.floor(frac * RETURN_FLAG_SEGMENTS));
    return seg * enemy;
}

/**
 * Capturar/neutralizar ponto (CP): total `2 × enemy` dividido entre os aliados no raio no momento.
 * Retorna o score POR aliado.
 */
export function pointCaptureScore(enemy: number, alliesOnPoint: number): number {
    if (alliesOnPoint <= 0) return 0;
    return (POINT_CAPTURE_PER_ENEMY * enemy) / alliesOnPoint;
}
