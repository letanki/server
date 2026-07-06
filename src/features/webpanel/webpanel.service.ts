import logger from "@/utils/logger";
import { IWebPanelConfig, OpenWebPanel } from "./webpanel.packets";

/** Minimal structural view of a client we can push a panel to (avoids importing GameClient). */
interface PanelClient {
  sendPacket(packet: OpenWebPanel): void;
  user?: { username?: string } | null;
}

/**
 * Builds the OpenWebPanel packet (config defaults + overrides), logs the exact JSON that goes on the
 * wire, and sends it. `reason` is just a label for the log so we can tell where a panel was triggered
 * from (button click, battle entry, ...).
 */
export function sendWebPanel(client: PanelClient, overrides: Partial<IWebPanelConfig> = {}, reason = "manual"): void {
  const packet = OpenWebPanel.default(overrides);
  const json = JSON.stringify({ url: packet.url, x: packet.x, y: packet.y, w: packet.width, h: packet.height });
  logger.info(`[webpanel] sending panel (${reason}) to ${client.user?.username ?? "?"}: ${json}`);
  client.sendPacket(packet);
}
