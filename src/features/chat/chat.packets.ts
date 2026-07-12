import { packetClass } from "@/packets/packet-class";
import { defs } from "protanki-protocol";

// IDs e schemas em `protanki-protocol` (defs.chat.*).

export const SendChatMessage = packetClass(defs.chat.SendChatMessage);
export type SendChatMessage = InstanceType<typeof SendChatMessage>;

export const ChatHistory = packetClass(defs.chat.ChatHistory);
export type ChatHistory = InstanceType<typeof ChatHistory>;

export const ChatProperties = packetClass(defs.chat.ChatProperties);
export type ChatProperties = InstanceType<typeof ChatProperties>;

export const AntifloodSettings = packetClass(defs.chat.AntifloodSettings);
export type AntifloodSettings = InstanceType<typeof AntifloodSettings>;

export const UnloadLobbyChatPacket = packetClass(defs.chat.UnloadLobbyChat);
export type UnloadLobbyChatPacket = InstanceType<typeof UnloadLobbyChatPacket>;

/** S->C: moderação — remove TODAS as mensagens do usuário do chat do lobby (limpa spam). */
export const RemoveUserChatMessagesPacket = packetClass(defs.chat.RemoveUserChatMessages);
export type RemoveUserChatMessagesPacket = InstanceType<typeof RemoveUserChatMessagesPacket>;
