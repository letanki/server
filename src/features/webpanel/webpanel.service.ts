import logger from "@/utils/logger";
import { issuePanelToken } from "./webpanel.auth";
import { IWebPanelConfig, OpenWebPanel } from "./webpanel.packets";

/** Minimal structural view of a client we can push a panel to (avoids importing GameClient). */
interface PanelClient {
  sendPacket(packet: OpenWebPanel): void;
  user?: { id?: string; username?: string } | null;
}

/**
 * Builds the OpenWebPanel packet (config defaults + overrides), injects a per-session token into the URL
 * (so the panel's HTTP calls are tied to this logged-in user), logs it, and sends it. `reason` labels the
 * log (button click, battle entry, ...).
 */
export function sendWebPanel(client: PanelClient, overrides: Partial<IWebPanelConfig> = {}, reason = "manual"): void {
  const cfg: Partial<IWebPanelConfig> = { ...overrides };
  if (client.user?.id && client.user.username) {
    const token = issuePanelToken({ id: client.user.id, username: client.user.username });
    const base = cfg.url ?? OpenWebPanel.default().url;
    cfg.url = base + (base.includes("?") ? "&" : "?") + "token=" + token;
  }
  const packet = OpenWebPanel.default(cfg);
  logger.info(`[webpanel] sending panel (${reason}) to ${client.user?.username ?? "?"}: ${packet.url}`);
  client.sendPacket(packet);
}

/**
 * Reposiciona/redimensiona um painel JÁ ABERTO (o patch do cliente só atualiza o viewPort no re-open,
 * sem recarregar). NÃO emite token novo — o painel mantém o token da sessão que já está usando (emitir um
 * novo revogaria o atual e quebraria as chamadas do painel). Envie {width,height,x,y} conforme desejado.
 */
export function repositionWebPanel(client: PanelClient, cfg: Partial<IWebPanelConfig>): void {
  client.sendPacket(OpenWebPanel.default(cfg));
}
