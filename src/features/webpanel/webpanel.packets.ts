import { WEBPANEL } from "@/config/constants";
import { BasePacket } from "@/packets/base.packet";
import { BufferWriter } from "@/utils/buffer/buffer.writer";

export interface IWebPanelConfig {
  /** Page to load in the embedded browser (must be reachable by the client). */
  url: string;
  /** Panel width/height in px. */
  width: number;
  height: number;
  /** Top-left position in px. Use -1 (default) to have the client center it on the stage. */
  x?: number;
  y?: number;
}

/**
 * OpenWebPanel — instructs the client to open the in-game web panel (an AIR HTMLLoader) at the
 * given URL, size and position. The server can push this at any time (button response, battle
 * entry, event, etc.).
 *
 * Transport: it reuses packet id 1587315905 (originally ReferralInfoDetails), whose client handler
 * `ReferralsModel.openReferrerPanel` we repurposed in scripts/patches/webpanel-button.js to open the
 * HTMLLoader. The client decodes that packet as [int32 usersCount][optString a][optString b]
 * [optString c]; we send usersCount=0 and put a JSON config `{"url","x","y","w","h"}` in the first
 * string. The patched client does `JSON.parse` on it; x<0 means "center on stage".
 */
export class OpenWebPanel extends BasePacket {
  public url: string;
  public width: number;
  public height: number;
  public x: number;
  public y: number;

  constructor(cfg: IWebPanelConfig) {
    super();
    this.url = cfg.url;
    this.width = cfg.width;
    this.height = cfg.height;
    this.x = cfg.x ?? -1;
    this.y = cfg.y ?? -1;
  }

  /** Convenience: the default panel (URL/size from config, centered). */
  static default(overrides: Partial<IWebPanelConfig> = {}): OpenWebPanel {
    return new OpenWebPanel({
      url: WEBPANEL.URL,
      width: WEBPANEL.WIDTH,
      height: WEBPANEL.HEIGHT,
      x: WEBPANEL.X,
      y: WEBPANEL.Y,
      ...overrides,
    });
  }

  read(_buffer: Buffer): void {
    // Outgoing only.
  }

  write(): Buffer {
    // Cache-buster: the AIR WebKit caches the HTML aggressively, so a stale page could still show
    // (e.g. an old layout). A fresh query param forces a reload on every open.
    const sep = this.url.includes("?") ? "&" : "?";
    const url = `${this.url}${sep}t=${Date.now()}`;
    const config = JSON.stringify({
      url,
      x: this.x,
      y: this.y,
      w: this.width,
      h: this.height,
    });
    const writer = new BufferWriter();
    writer.writeInt32BE(0); // referredUsers count (unused)
    writer.writeOptionalString(config); // JSON config in the first string slot
    writer.writeOptionalString(""); // unused slot
    writer.writeOptionalString(""); // unused slot
    return writer.getBuffer();
  }

  static getId(): number {
    return 1587315905;
  }
}
