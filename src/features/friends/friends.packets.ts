import { BasePacket } from "@/packets/base.packet";
import { readSchema, writeSchema } from "@/packets/packet-schema";
import { IEmpty } from "@/packets/packet.interfaces";
import { defs } from "protanki-protocol";
import {
    IAcceptFriendRequest,
    IAcknowledgeNewFriend,
    IAcknowledgeNewFriendRequest,
    IAlreadyFriends,
    ICancelFriendRequest,
    ICheckUserExistsForFriend,
    IDeclineAllFriendRequests,
    IDeclineFriendRequest,
    IFriendRemoved,
    IFriendRequestAccepted,
    IFriendRequestAlreadySent,
    IFriendRequestCanceledOrDeclined,
    IFriendRequestDeclined,
    IFriendRequestSent,
    IFriendsList,
    IFriendsListProps,
    IIncomingFriendRequestExists,
    ILoadFriends,
    INewFriendRequest,
    IRemoveFriend,
    ISendFriendRequest,
} from "./friends.types";

// IDs e schemas em `protanki-protocol` (defs.friends.*).

export class AcceptFriendRequest extends BasePacket implements IAcceptFriendRequest {
    nickname: string | null = null;
    read(buffer: Buffer) { readSchema(this, defs.friends.AcceptFriendRequest.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.friends.AcceptFriendRequest.schema!); }
    static getId() { return defs.friends.AcceptFriendRequest.id; }
}
export class AcknowledgeNewFriend extends BasePacket implements IAcknowledgeNewFriend {
    nickname: string | null;
    constructor(nickname: string | null = null) { super(); this.nickname = nickname; }
    read(buffer: Buffer) { readSchema(this, defs.friends.AcknowledgeNewFriend.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.friends.AcknowledgeNewFriend.schema!); }
    static getId() { return defs.friends.AcknowledgeNewFriend.id; }
}
export class AcknowledgeNewFriendRequest extends BasePacket implements IAcknowledgeNewFriendRequest {
    nickname: string | null;
    constructor(nickname: string | null = null) { super(); this.nickname = nickname; }
    read(buffer: Buffer) { readSchema(this, defs.friends.AcknowledgeNewFriendRequest.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.friends.AcknowledgeNewFriendRequest.schema!); }
    static getId() { return defs.friends.AcknowledgeNewFriendRequest.id; }
}
export class AlreadyFriends extends BasePacket implements IAlreadyFriends {
    nickname: string | null = null;
    constructor(nickname?: string | null) { super(); if (nickname) { this.nickname = nickname; } }
    read(buffer: Buffer) { readSchema(this, defs.friends.AlreadyFriends.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.friends.AlreadyFriends.schema!); }
    static getId() { return defs.friends.AlreadyFriends.id; }
}
export class CancelFriendRequest extends BasePacket implements ICancelFriendRequest {
    nickname: string | null = null;
    read(buffer: Buffer) { readSchema(this, defs.friends.CancelFriendRequest.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.friends.CancelFriendRequest.schema!); }
    static getId() { return defs.friends.CancelFriendRequest.id; }
}
export class CheckUserExistsForFriend extends BasePacket implements ICheckUserExistsForFriend {
    nickname: string | null = null;
    read(buffer: Buffer) { readSchema(this, defs.friends.CheckUserExistsForFriend.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.friends.CheckUserExistsForFriend.schema!); }
    static getId() { return defs.friends.CheckUserExistsForFriend.id; }
}
export class DeclineAllFriendRequests extends BasePacket implements IDeclineAllFriendRequests {
    read(buffer: Buffer) { readSchema(this, defs.friends.DeclineAllFriendRequests.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.friends.DeclineAllFriendRequests.schema!); }
    static getId() { return defs.friends.DeclineAllFriendRequests.id; }
}
export class DeclineFriendRequest extends BasePacket implements IDeclineFriendRequest {
    nickname: string | null = null;
    read(buffer: Buffer) { readSchema(this, defs.friends.DeclineFriendRequest.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.friends.DeclineFriendRequest.schema!); }
    static getId() { return defs.friends.DeclineFriendRequest.id; }
}
export class FriendRemoved extends BasePacket implements IFriendRemoved {
    nickname: string | null = null;
    constructor(nickname?: string | null) { super(); if (nickname) { this.nickname = nickname; } }
    read(buffer: Buffer) { readSchema(this, defs.friends.FriendRemoved.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.friends.FriendRemoved.schema!); }
    static getId() { return defs.friends.FriendRemoved.id; }
}
export class FriendRequestAccepted extends BasePacket implements IFriendRequestAccepted {
    nickname: string | null = null;
    constructor(nickname?: string | null) { super(); if (nickname) { this.nickname = nickname; } }
    read(buffer: Buffer) { readSchema(this, defs.friends.FriendRequestAccepted.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.friends.FriendRequestAccepted.schema!); }
    static getId() { return defs.friends.FriendRequestAccepted.id; }
}
export class FriendRequestAlreadySent extends BasePacket implements IFriendRequestAlreadySent {
    nickname: string | null = null;
    constructor(nickname?: string | null) { super(); if (nickname) { this.nickname = nickname; } }
    read(buffer: Buffer) { readSchema(this, defs.friends.FriendRequestAlreadySent.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.friends.FriendRequestAlreadySent.schema!); }
    static getId() { return defs.friends.FriendRequestAlreadySent.id; }
}
export class FriendRequestCanceledOrDeclined extends BasePacket implements IFriendRequestCanceledOrDeclined {
    nickname: string | null = null;
    constructor(nickname?: string | null) { super(); if (nickname) { this.nickname = nickname; } }
    read(buffer: Buffer) { readSchema(this, defs.friends.FriendRequestCanceledOrDeclined.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.friends.FriendRequestCanceledOrDeclined.schema!); }
    static getId() { return defs.friends.FriendRequestCanceledOrDeclined.id; }
}
export class FriendRequestDeclined extends BasePacket implements IFriendRequestDeclined {
    nickname: string | null = null;
    constructor(nickname?: string | null) { super(); if (nickname) { this.nickname = nickname; } }
    read(buffer: Buffer) { readSchema(this, defs.friends.FriendRequestDeclined.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.friends.FriendRequestDeclined.schema!); }
    static getId() { return defs.friends.FriendRequestDeclined.id; }
}
export class FriendRequestSent extends BasePacket implements IFriendRequestSent {
    nickname: string | null = null;
    constructor(nickname?: string | null) { super(); if (nickname) { this.nickname = nickname; } }
    read(buffer: Buffer) { readSchema(this, defs.friends.FriendRequestSent.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.friends.FriendRequestSent.schema!); }
    static getId() { return defs.friends.FriendRequestSent.id; }
}
export class FriendsList extends BasePacket implements IFriendsList {
    acceptedFriends: string[] = [];
    newAcceptedFriends: string[] = [];
    incomingRequests: string[] = [];
    newIncomingRequests: string[] = [];
    outgoingRequests: string[] = [];
    constructor(data?: IFriendsListProps) { super(); if (data) { Object.assign(this, data); } }
    read(buffer: Buffer): void { readSchema(this, defs.friends.FriendsList.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.friends.FriendsList.schema!); }
    static getId() { return defs.friends.FriendsList.id; }
}
export class IncomingFriendRequestExists extends BasePacket implements IIncomingFriendRequestExists {
    nickname: string | null = null;
    constructor(nickname?: string | null) { super(); if (nickname) { this.nickname = nickname; } }
    read(buffer: Buffer) { readSchema(this, defs.friends.IncomingFriendRequestExists.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.friends.IncomingFriendRequestExists.schema!); }
    static getId() { return defs.friends.IncomingFriendRequestExists.id; }
}
export class LoadFriends extends BasePacket implements ILoadFriends {
    unknown: boolean = false;
    read(buffer: Buffer) { readSchema(this, defs.friends.LoadFriends.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.friends.LoadFriends.schema!); }
    static getId() { return defs.friends.LoadFriends.id; }
}
export class NewFriendRequest extends BasePacket implements INewFriendRequest {
    nickname: string | null = null;
    constructor(nickname?: string | null) { super(); if (nickname) { this.nickname = nickname; } }
    read(buffer: Buffer) { readSchema(this, defs.friends.NewFriendRequest.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.friends.NewFriendRequest.schema!); }
    static getId() { return defs.friends.NewFriendRequest.id; }
}
export class RemoveFriend extends BasePacket implements IRemoveFriend {
    nickname: string | null = null;
    read(buffer: Buffer) { readSchema(this, defs.friends.RemoveFriend.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.friends.RemoveFriend.schema!); }
    static getId() { return defs.friends.RemoveFriend.id; }
}
export class UserExistsForFriend extends BasePacket implements IEmpty {
    read(buffer: Buffer) { readSchema(this, defs.friends.UserExistsForFriend.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.friends.UserExistsForFriend.schema!); }
    static getId() { return defs.friends.UserExistsForFriend.id; }
}
export class UserInvalidForFriend extends BasePacket implements IEmpty {
    read(buffer: Buffer) { readSchema(this, defs.friends.UserInvalidForFriend.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.friends.UserInvalidForFriend.schema!); }
    static getId() { return defs.friends.UserInvalidForFriend.id; }
}
export class SendFriendRequest extends BasePacket implements ISendFriendRequest {
    nickname: string | null = null;
    read(buffer: Buffer) { readSchema(this, defs.friends.SendFriendRequest.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.friends.SendFriendRequest.schema!); }
    static getId() { return defs.friends.SendFriendRequest.id; }
}

export class RequestFriendsListWindow extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { readSchema(this, defs.friends.RequestFriendsListWindow.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.friends.RequestFriendsListWindow.schema!); }
    static getId(): number { return defs.friends.RequestFriendsListWindow.id; }
}

export class ShowFriendsListWindow extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { readSchema(this, defs.friends.ShowFriendsListWindow.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.friends.ShowFriendsListWindow.schema!); }
    static getId(): number { return defs.friends.ShowFriendsListWindow.id; }
}
