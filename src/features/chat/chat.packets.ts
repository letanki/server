import { BasePacket } from "@/packets/base.packet";
import { PacketSchema, readSchema, writeSchema } from "@/packets/packet-schema";
import { IEmpty } from "@/packets/packet.interfaces";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import * as ChatTypes from "./chat.types";

export class SendChatMessage extends BasePacket implements ChatTypes.ISendChatMessage {
    static readonly schema: PacketSchema = [
        { name: "targetNickname", type: "string" },
        { name: "message", type: "string" },
    ];
    targetNickname: string | null = null;
    message: string | null;
    constructor(targetNickname: string | null, message: string | null) {
        super();
        this.targetNickname = targetNickname;
        this.message = message;
    }
    read(buffer: Buffer): void { readSchema(this, SendChatMessage.schema, buffer); }
    write(): Buffer { return writeSchema(this, SendChatMessage.schema); }
    static getId() {
        return 705454610;
    }
}

const CHAT_USER: PacketSchema = [
    { name: "moderatorLevel", type: "i32" },
    { name: "ip", type: "string" },
    { name: "rank", type: "i32" },
    { name: "uid", type: "string" },
];

export class ChatHistory extends BasePacket implements ChatTypes.IChatHistory {
    static readonly schema: PacketSchema = [
        { name: "messages", type: "list", of: [
            { name: "source", type: "optObject", of: CHAT_USER },
            { name: "isSystem", type: "bool" },
            { name: "target", type: "optObject", of: CHAT_USER },
            { name: "message", type: "string" },
            { name: "isWarning", type: "bool" },
        ] },
    ];
    messages: ChatTypes.IChatMessageData[] = [];
    constructor(messages?: ChatTypes.IChatMessageData[]) {
        super();
        if (messages) {
            this.messages = messages;
        }
    }
    read(buffer: Buffer): void { readSchema(this, ChatHistory.schema, buffer); }
    write(): Buffer { return writeSchema(this, ChatHistory.schema); }
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
    static readonly schema: PacketSchema = [
        { name: "admin", type: "bool" },
        { name: "antifloodEnabled", type: "bool" },
        { name: "bufferSize", type: "i32" },
        { name: "chatEnabled", type: "bool" },
        { name: "chatModeratorLevel", type: "i32" },
        { name: "linksWhiteList", type: "optStringArray" },
        { name: "minChar", type: "i32" },
        { name: "minWord", type: "i16" },
        { name: "selfName", type: "string" },
        { name: "showLinks", type: "bool" },
        { name: "typingSpeedAntifloodEnabled", type: "bool" },
    ];
    constructor(data?: ChatTypes.IChatPropertiesProps) {
        super();
        if (data) Object.assign(this, data);
    }
    read(buffer: Buffer) { readSchema(this, ChatProperties.schema, buffer); }
    write(): Buffer { return writeSchema(this, ChatProperties.schema); }
    static getId() {
        return 178154988;
    }
}

export class AntifloodSettings extends BasePacket implements ChatTypes.IAntifloodSettings {
    static readonly schema: PacketSchema = [
        { name: "charDelayFactor", type: "i32" },
        { name: "messageBaseDelay", type: "i32" },
    ];
    charDelayFactor: number = 0;
    messageBaseDelay: number = 0;
    constructor(charDelayFactor?: number, messageBaseDelay?: number) {
        super();
        if (charDelayFactor !== undefined) this.charDelayFactor = charDelayFactor;
        if (messageBaseDelay !== undefined) this.messageBaseDelay = messageBaseDelay;
    }
    read(buffer: Buffer): void { readSchema(this, AntifloodSettings.schema, buffer); }
    write(): Buffer { return writeSchema(this, AntifloodSettings.schema); }
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