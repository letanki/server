import { BasePacket } from "@/packets/base.packet";
import { readSchema, writeSchema } from "@/packets/packet-schema";
import { IEmpty } from "@/packets/packet.interfaces";
import { defs } from "protanki-protocol";
import * as ChatTypes from "./chat.types";

// IDs e schemas em `protanki-protocol` (defs.chat.*).

export class SendChatMessage extends BasePacket implements ChatTypes.ISendChatMessage {
    targetNickname: string | null = null;
    message: string | null;
    constructor(targetNickname: string | null, message: string | null) {
        super();
        this.targetNickname = targetNickname;
        this.message = message;
    }
    read(buffer: Buffer): void { readSchema(this, defs.chat.SendChatMessage.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.chat.SendChatMessage.schema!); }
    static getId() { return defs.chat.SendChatMessage.id; }
}

export class ChatHistory extends BasePacket implements ChatTypes.IChatHistory {
    messages: ChatTypes.IChatMessageData[] = [];
    constructor(messages?: ChatTypes.IChatMessageData[]) {
        super();
        if (messages) {
            this.messages = messages;
        }
    }
    read(buffer: Buffer): void { readSchema(this, defs.chat.ChatHistory.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.chat.ChatHistory.schema!); }
    static getId() { return defs.chat.ChatHistory.id; }
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
    read(buffer: Buffer) { readSchema(this, defs.chat.ChatProperties.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.chat.ChatProperties.schema!); }
    static getId() { return defs.chat.ChatProperties.id; }
}

export class AntifloodSettings extends BasePacket implements ChatTypes.IAntifloodSettings {
    charDelayFactor: number = 0;
    messageBaseDelay: number = 0;
    constructor(charDelayFactor?: number, messageBaseDelay?: number) {
        super();
        if (charDelayFactor !== undefined) this.charDelayFactor = charDelayFactor;
        if (messageBaseDelay !== undefined) this.messageBaseDelay = messageBaseDelay;
    }
    read(buffer: Buffer): void { readSchema(this, defs.chat.AntifloodSettings.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.chat.AntifloodSettings.schema!); }
    static getId() { return defs.chat.AntifloodSettings.id; }
}

export class UnloadLobbyChatPacket extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { readSchema(this, defs.chat.UnloadLobbyChat.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.chat.UnloadLobbyChat.schema!); }
    static getId(): number { return defs.chat.UnloadLobbyChat.id; }
}
