import { BasePacket } from "@/packets/base.packet";
import { IEmpty } from "@/packets/packet.interfaces";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import * as ChatTypes from "./chat.types";

export class SendChatMessage extends BasePacket implements ChatTypes.ISendChatMessage {
    targetNickname: string | null = null;
    message: string | null;
    constructor(targetNickname: string | null, message: string | null) {
        super();
        this.targetNickname = targetNickname;
        this.message = message;
    }
    read(buffer: Buffer) {
        const r = new BufferReader(buffer);
        this.targetNickname = r.readOptionalString();
        this.message = r.readOptionalString();
    }
    write(): Buffer {
        const w = new BufferWriter();
        w.writeOptionalString(this.targetNickname);
        w.writeOptionalString(this.message);
        return w.getBuffer();
    }
    static getId() {
        return 705454610;
    }
}

export class ChatHistory extends BasePacket implements ChatTypes.IChatHistory {
    messages: ChatTypes.IChatMessageData[] = [];
    constructor(messages?: ChatTypes.IChatMessageData[]) {
        super();
        if (messages) {
            this.messages = messages;
        }
    }
    private readUserFromBuffer(reader: BufferReader): ChatTypes.IChatMessageUser | null {
        const isEmpty = reader.readUInt8() === 1;
        if (isEmpty) return null;
        return {
            moderatorLevel: reader.readInt32BE(),
            ip: reader.readOptionalString(),
            rank: reader.readInt32BE(),
            uid: reader.readOptionalString() ?? "",
        };
    }
    read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        const count = reader.readInt32BE();
        this.messages = [];
        for (let i = 0; i < count; i++) {
            this.messages.push({
                source: this.readUserFromBuffer(reader),
                isSystem: reader.readUInt8() === 1,
                target: this.readUserFromBuffer(reader),
                message: reader.readOptionalString() ?? "",
                isWarning: reader.readUInt8() === 1,
            });
        }
    }
    private writeUserToBuffer(writer: BufferWriter, user: ChatTypes.IChatMessageUser | null): void {
        const isEmpty = !user;
        writer.writeUInt8(isEmpty ? 1 : 0);
        if (!isEmpty) {
            writer.writeInt32BE(user!.moderatorLevel);
            writer.writeOptionalString(user!.ip);
            writer.writeInt32BE(user!.rank);
            writer.writeOptionalString(user!.uid);
        }
    }
    write(): Buffer {
        const writer = new BufferWriter();
        writer.writeInt32BE(this.messages.length);
        for (const msg of this.messages) {
            this.writeUserToBuffer(writer, msg.source);
            writer.writeUInt8(msg.isSystem ? 1 : 0);
            this.writeUserToBuffer(writer, msg.target);
            writer.writeOptionalString(msg.message);
            writer.writeUInt8(msg.isWarning ? 1 : 0);
        }
        return writer.getBuffer();
    }
    static getId() {
        return -1263520410;
    }
}

export class ChatProperties extends BasePacket implements ChatTypes.IChatProperties {
    admin: boolean = false;
    antifloodEnabled: boolean = false;
    bufferSize: number = 0;
    chatEnabled: boolean = false;
    chatModeratorLevel: number = 0;
    linksWhiteList: string[] = [];
    minChar: number = 0;
    minWord: number = 0;
    selfName: string = "";
    showLinks: boolean = false;
    typingSpeedAntifloodEnabled: boolean = false;
    constructor(data?: ChatTypes.IChatPropertiesProps) {
        super();
        if (data) Object.assign(this, data);
    }
    read(buffer: Buffer) {
        const r = new BufferReader(buffer);
        this.admin = r.readUInt8() === 1;
        this.antifloodEnabled = r.readUInt8() === 1;
        this.bufferSize = r.readInt32BE();
        this.chatEnabled = r.readUInt8() === 1;
        this.chatModeratorLevel = r.readInt32BE();
        this.linksWhiteList = r.readStringArray();
        this.minChar = r.readInt32BE();
        this.minWord = r.readInt16BE();
        this.selfName = r.readOptionalString() ?? "";
        this.showLinks = r.readUInt8() === 1;
        this.typingSpeedAntifloodEnabled = r.readUInt8() === 1;
    }
    write(): Buffer {
        const w = new BufferWriter();
        w.writeUInt8(this.admin ? 1 : 0);
        w.writeUInt8(this.antifloodEnabled ? 1 : 0);
        w.writeInt32BE(this.bufferSize);
        w.writeUInt8(this.chatEnabled ? 1 : 0);
        w.writeInt32BE(this.chatModeratorLevel);
        w.writeOptionalStringArray(this.linksWhiteList);
        w.writeInt32BE(this.minChar);
        w.writeInt16BE(this.minWord);
        w.writeOptionalString(this.selfName);
        w.writeUInt8(this.showLinks ? 1 : 0);
        w.writeUInt8(this.typingSpeedAntifloodEnabled ? 1 : 0);
        return w.getBuffer();
    }
    static getId() {
        return 178154988;
    }
}

export class AntifloodSettings extends BasePacket implements ChatTypes.IAntifloodSettings {
    charDelayFactor: number = 0;
    messageBaseDelay: number = 0;
    constructor(charDelayFactor?: number, messageBaseDelay?: number) {
        super();
        if (charDelayFactor !== undefined) this.charDelayFactor = charDelayFactor;
        if (messageBaseDelay !== undefined) this.messageBaseDelay = messageBaseDelay;
    }
    read(buffer: Buffer) {
        const r = new BufferReader(buffer);
        this.charDelayFactor = r.readInt32BE();
        this.messageBaseDelay = r.readInt32BE();
    }
    write(): Buffer {
        const w = new BufferWriter();
        w.writeInt32BE(this.charDelayFactor);
        w.writeInt32BE(this.messageBaseDelay);
        return w.getBuffer();
    }
    static getId() {
        return 744948472;
    }
}

export class UnloadLobbyChatPacket extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { }
    write(): Buffer {
        return new BufferWriter().getBuffer();
    }
    static getId(): number {
        return -920985123;
    }
}