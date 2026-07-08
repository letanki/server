import logger from "@/utils/logger";
import { getOrIssuePanelToken } from "./webpanel.auth";
import { IWebPanelConfig, OpenWebPanel } from "./webpanel.packets";

/** Minimal structural view of a client we can push a panel to (avoids importing GameClient). */
interface PanelClient {
  sendPacket(packet: OpenWebPanel): void;
  user?: { id?: string; username?: string } | null;
}

/** Injeta o token (reusado) da sessão do usuário na URL do painel, se ele estiver autenticado. */
function withToken(client: PanelClient, cfg: Partial<IWebPanelConfig>): Partial<IWebPanelConfig> {
  if (!client.user?.id || !client.user.username) return cfg;
  const token = getOrIssuePanelToken({ id: client.user.id, username: client.user.username });
  const base = cfg.url ?? OpenWebPanel.default().url;
  return { ...cfg, url: base + (base.includes("?") ? "&" : "?") + "token=" + token };
}

/**
 * Builds the OpenWebPanel packet (config defaults + overrides), injects a per-session token into the URL
 * (so the panel's HTTP calls are tied to this logged-in user), logs it, and sends it. `reason` labels the
 * log (button click, battle entry, ...).
 */
export function sendWebPanel(client: PanelClient, overrides: Partial<IWebPanelConfig> = {}, reason = "manual"): void {
  const packet = OpenWebPanel.default(withToken(client, overrides));
  logger.info(`[webpanel] sending panel (${reason}) to ${client.user?.username ?? "?"}: ${packet.url}`);
  client.sendPacket(packet);
}

/**
 * Reposiciona/redimensiona um painel JÁ ABERTO (o patch do cliente só atualiza o viewPort no re-open,
 * sem recarregar a URL). Carrega o MESMO token reusado da sessão: se o painel já existe, o patch ignora a
 * URL (só reaplica o viewPort); se por acaso ele tiver sido descartado, recarrega já autenticado — em vez
 * de uma URL sem token que daria 401. Envie {width,height,x,y} conforme desejado.
 */
export function repositionWebPanel(client: PanelClient, cfg: Partial<IWebPanelConfig>): void {
  client.sendPacket(OpenWebPanel.default(withToken(client, cfg)));
}

/**
 * Fecha (descarta) o painel web do cliente de forma AUTORITATIVA pelo servidor. Diferente do fechamento
 * pelo HTML (que depende do JS do painel rodando), isso funciona mesmo se a StageWebView estiver com os
 * timers estarvados durante a batalha (Stage3D) — o caso em que o widget "Buscando" travava em produção.
 * No-op no cliente se não houver painel aberto.
 */
export function closeWebPanel(client: PanelClient): void {
  client.sendPacket(OpenWebPanel.default({ close: true }));
}
