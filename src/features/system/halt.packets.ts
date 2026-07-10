import { BasePacket } from "@/packets/base.packet";
import { defs, encodeBody } from "protanki-protocol";

// IDs e schemas em `protanki-protocol` (defs.system.*). S->C only — a lib escreve os bytes.

/**
 * Server-restart countdown shown to every client ("server restarts in N seconds").
 * Body = a single int32 (seconds). Captured from the official server.
 */
export class HaltServerPacket extends BasePacket {
    constructor(private readonly seconds: number = 0) { super(); }
    read(): void {}
    write(): Buffer { return encodeBody(defs.system.HaltServer, { seconds: this.seconds }); }
    static getId(): number { return defs.system.HaltServer.id; }
}

/**
 * Refuses a battle action while a restart is pending. Body = one optionalString. When refusing a
 * join we pass the battleId; when refusing a create we pass an arbitrary string (the client ignores
 * the value). Captured from the official server.
 */
export class BattleHaltPacket extends BasePacket {
    constructor(private readonly text: string | null = null) { super(); }
    read(): void {}
    write(): Buffer { return encodeBody(defs.system.BattleHalt, { text: this.text }); }
    static getId(): number { return defs.system.BattleHalt.id; }
}
