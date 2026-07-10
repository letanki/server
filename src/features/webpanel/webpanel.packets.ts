import { WEBPANEL } from "@/config/constants";
import { BasePacket } from "@/packets/base.packet";
import { PacketSchema, writeSchema } from "@/packets/packet-schema";

// Wire local (pacote só-do-server; reusa o id/handler do ReferralInfoDetails no cliente):
// int32 count(0) + optString(config JSON) + 2 slots vazios. A lib escreve os bytes.
const WEBPANEL_WIRE: PacketSchema = [
  { name: "count", type: "i32" },
  { name: "config", type: "string" },
  { name: "slot1", type: "string" },
  { name: "slot2", type: "string" },
];

export interface IWebPanelConfig {
  /** Page to load in the embedded browser (must be reachable by the client). */
  url: string;
  /** Panel width/height in px. */
  width: number;
  height: number;
  /** Top-left position in px. Use -1 (default) to have the client center it on the stage. */
  x?: number;
  y?: number;
  /** Se true, x/y/w/h são PORCENTAGENS (0-100) do palco; a view acompanha o resize da janela.
   *  Em qualquer modo, x<0 centraliza X e y<0 centraliza Y. Em px, w<=0/h<=0 = tela cheia. */
  pct?: boolean;
  /** Se true, o cliente DESCARTA a view (fechamento dirigido pelo servidor) e ignora url/tamanho. */
  close?: boolean;
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
  public pct: boolean;
  public close: boolean;

  constructor(cfg: IWebPanelConfig) {
    super();
    this.url = cfg.url;
    this.width = cfg.width;
    this.height = cfg.height;
    this.x = cfg.x ?? -1;
    this.y = cfg.y ?? -1;
    this.pct = cfg.pct ?? false;
    this.close = cfg.close ?? false;
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
      pct: this.pct,
      close: this.close,
    });
    return writeSchema({ count: 0, config, slot1: "", slot2: "" }, WEBPANEL_WIRE);
  }

  static getId(): number {
    return 1587315905;
  }
}
