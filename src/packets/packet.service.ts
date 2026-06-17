import { IPacket } from "@/packets/packet.interfaces";
import logger from "@/utils/logger";
import { loadModulesFromDir } from "@/utils/module-loader";
import path from "path";

export class PacketService {
  private packets = new Map<number, new (...args: any[]) => IPacket>();

  public constructor() {
    this.loadPacketsFromDir(path.join(__dirname, "../features"));
  }

  private loadPacketsFromDir(dir: string): void {
    const modules = loadModulesFromDir(
      dir,
      (file) => (file.endsWith(".ts") || file.endsWith(".js")) && !file.includes("BasePacket")
    );

    for (const { file, module } of modules) {
      for (const key in module) {
        const PacketClass = module[key];
        if (PacketClass && typeof PacketClass.getId === "function" && PacketClass.prototype?.hasOwnProperty("read")) {
          try {
            const packetId = PacketClass.getId();
            const existing = this.packets.get(packetId);
            // Re-exports (barrel files) surface the same class twice; only warn on a
            // genuine conflict (a different class claiming an already-used id).
            if (existing && existing !== PacketClass) {
              logger.warn(`Packet ID ${packetId} from ${file} conflicts with an already-registered class. Overwriting.`);
            }
            this.packets.set(packetId, PacketClass);
          } catch (e) {
            // getId() throws on the abstract BasePacket; ignore non-packet exports.
          }
        }
      }
    }
  }

  public createPacket(id: number): IPacket | null {
    const PacketClass = this.packets.get(id);
    if (!PacketClass) {
      return null;
    }
    return new PacketClass();
  }
}