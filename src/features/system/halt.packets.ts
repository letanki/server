import { BasePacket } from "@/packets/base.packet";
import { BufferWriter } from "@/utils/buffer/buffer.writer";

/**
 * Server-restart countdown shown to every client ("server restarts in N seconds").
 * Body = a single int32 (seconds). Captured from the official server.
 */
export class HaltServerPacket extends BasePacket {
    constructor(private readonly seconds: number = 0) {
        super();
    }
    read(): void {}
    write(): Buffer {
        return new BufferWriter().writeInt32BE(this.seconds).getBuffer();
    }
    static getId(): number {
        return -1712113407;
    }
}

/**
 * Refuses a battle action while a restart is pending. Body = one optionalString. When refusing a
 * join we pass the battleId; when refusing a create we pass an arbitrary string (the client ignores
 * the value). Captured from the official server.
 */
export class BattleHaltPacket extends BasePacket {
    constructor(private readonly text: string | null = null) {
        super();
    }
    read(): void {}
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.text).getBuffer();
    }
    static getId(): number {
        return -831998018;
    }
}
