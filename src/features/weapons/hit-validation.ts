import { GameClient } from "@/server/game.client";
import { IVector3 } from "@/shared/types/geom/ivector3";

/** Um alvo reportado pelo cliente num hit de cone (Firebird/Freeze), com os dados de validação. */
export interface HitTarget {
    nickname: string;
    /** Vida (incarnation) do alvo que o cliente afirma ter acertado — ecoada do Spawn. null se ausente. */
    incarnation: number | null;
    /** Posição do alvo afirmada pelo cliente (z = chão nas capturas). null se ausente. */
    targetPosition: IVector3 | null;
    /** Ponto de impacto afirmado pelo cliente. null se ausente. */
    hitPoint: IVector3 | null;
}

/**
 * Zipa os vetores paralelos do FirebirdHitCommand/FreezeHitCommand (targets/incarnations/targetPositions/
 * hitPoints) num alvo-por-índice. Cada um pode ser null (nullableList/nullableStringArray) → degrada para
 * lista vazia / campo null, nunca lança.
 */
export function parseHitTargets(fields: any): HitTarget[] {
    const names: string[] = fields.targets ?? [];
    const incs: Array<{ i: number }> = fields.incarnations ?? [];
    const tpos: Array<{ v: IVector3 }> = fields.targetPositions ?? [];
    const hits: Array<{ v: IVector3 }> = fields.hitPoints ?? [];
    return names.map((nickname, k) => ({
        nickname,
        incarnation: incs[k]?.i ?? null,
        targetPosition: tpos[k]?.v ?? null,
        hitPoint: hits[k]?.v ?? null,
    }));
}

// Tolerância 2D (x,y) entre a posição do alvo que o CLIENTE afirma e a que o SERVIDOR conhece. Generosa
// de propósito — cobre lag normal e pega alvo forjado/dessincronizado sem rejeitar jogo legítimo. O z é
// ignorado (o cliente manda z=chão; o servidor tem z=altura do tanque).
export const HIT_POSITION_TOLERANCE = 2000;

/**
 * Valida um hit reportado pelo cliente contra a VERDADE do servidor (anti-cheat), antes de aplicar dano:
 *  - **incarnation**: o alvo tem que ser a VIDA atual. O cliente ecoa o incarnation que enviamos no Spawn
 *    (`battleIncarnation`); se o alvo já morreu/renasceu, não bate → hit obsoleto sobre outra vida → rejeita.
 *  - **posição**: a posição do alvo afirmada tem que estar perto da conhecida pelo servidor (2D, tolerante).
 * Cada campo é OPCIONAL — só a arma que carrega aquele dado o valida (Firebird/Freeze/Railgun têm
 * incarnation; Machinegun só posição). Campo ausente (null/undefined) NÃO reprova — degradação segura.
 */
export function isReportedHitValid(targetClient: GameClient, hit: { incarnation?: number | null; targetPosition?: IVector3 | null }): boolean {
    if (hit.incarnation != null && targetClient.battleIncarnation !== hit.incarnation) return false;
    const server = targetClient.battlePosition;
    if (server && hit.targetPosition) {
        const dx = server.x - hit.targetPosition.x;
        const dy = server.y - hit.targetPosition.y;
        if (dx * dx + dy * dy > HIT_POSITION_TOLERANCE * HIT_POSITION_TOLERANCE) return false;
    }
    return true;
}
