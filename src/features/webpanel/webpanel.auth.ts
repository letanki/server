import crypto from "crypto";

/**
 * Token de sessão do painel web (StageWebView). Quando o servidor abre o painel para um cliente já
 * autenticado no jogo, emite um token curto e o injeta na URL. A página (servida na mesma origem, porta
 * 9999) usa esse token nas chamadas HTTP do painel — assim o painel "herda" a identidade da sessão do
 * jogo sem um segundo login. O token vive só em memória (mesmo processo do game server) e expira.
 */
export interface PanelSession {
    userId: string;
    username: string;
    expiresAt: number;
}

const TTL_MS = 2 * 60 * 60 * 1000; // 2h
const sessions = new Map<string, PanelSession>();

/** Emite um token novo para o usuário (revoga tokens antigos dele para não acumular). */
export function issuePanelToken(user: { id: string; username: string }): string {
    // remove tokens anteriores do mesmo usuário
    for (const [tok, s] of sessions) if (s.userId === user.id) sessions.delete(tok);
    const token = crypto.randomBytes(16).toString("hex");
    sessions.set(token, { userId: user.id, username: user.username, expiresAt: Date.now() + TTL_MS });
    return token;
}

/** Resolve um token válido (não expirado) para a sessão, ou null. */
export function resolvePanelToken(token: string | undefined | null): PanelSession | null {
    if (!token) return null;
    const s = sessions.get(token);
    if (!s) return null;
    if (s.expiresAt < Date.now()) {
        sessions.delete(token);
        return null;
    }
    return s;
}

/** Revoga o token de um usuário (ex.: logout / fechar painel). */
export function revokePanelTokensFor(userId: string): void {
    for (const [tok, s] of sessions) if (s.userId === userId) sessions.delete(tok);
}
