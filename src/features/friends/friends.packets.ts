import { BasePacket } from "@/packets/base.packet";
import { PacketSchema, readSchema, writeSchema } from "@/packets/packet-schema";
import { IEmpty } from "@/packets/packet.interfaces";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
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

export class AcceptFriendRequest extends BasePacket implements IAcceptFriendRequest {
    nickname: string | null = null;
    read(buffer: Buffer) {
        this.nickname = new BufferReader(buffer).readOptionalString();
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.nickname).getBuffer();
    }
    static getId() {
        return -1926185291;
    }
}
export class AcknowledgeNewFriend extends BasePacket implements IAcknowledgeNewFriend {
    nickname: string | null;
    constructor(nickname: string | null = null) {
        super();
        this.nickname = nickname;
    }
    read(buffer: Buffer) {
        this.nickname = new BufferReader(buffer).readOptionalString();
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.nickname).getBuffer();
    }
    static getId() {
        return 1286861380;
    }
}
export class AcknowledgeNewFriendRequest extends BasePacket implements IAcknowledgeNewFriendRequest {
    nickname: string | null;
    constructor(nickname: string | null = null) {
        super();
        this.nickname = nickname;
    }
    read(buffer: Buffer) {
        this.nickname = new BufferReader(buffer).readOptionalString();
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.nickname).getBuffer();
    }
    static getId() {
        return -1041660861;
    }
}
export class AlreadyFriends extends BasePacket implements IAlreadyFriends {
    nickname: string | null = null;
    constructor(nickname?: string | null) {
        super();
        if (nickname) {
            this.nickname = nickname;
        }
    }
    read(buffer: Buffer) {
        this.nickname = new BufferReader(buffer).readOptionalString();
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.nickname).getBuffer();
    }
    static getId() {
        return -2089008699;
    }
}
export class CancelFriendRequest extends BasePacket implements ICancelFriendRequest {
    nickname: string | null = null;
    read(buffer: Buffer) {
        this.nickname = new BufferReader(buffer).readOptionalString();
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.nickname).getBuffer();
    }
    static getId() {
        return 84050355;
    }
}
export class CheckUserExistsForFriend extends BasePacket implements ICheckUserExistsForFriend {
    nickname: string | null = null;
    read(buffer: Buffer) {
        this.nickname = new BufferReader(buffer).readOptionalString();
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.nickname).getBuffer();
    }
    static getId() {
        return 126880779;
    }
}
export class DeclineAllFriendRequests extends BasePacket implements IDeclineAllFriendRequests {
    read(buffer: Buffer) { }
    write(): Buffer {
        return new BufferWriter().getBuffer();
    }
    static getId() {
        return -1590185083;
    }
}
export class DeclineFriendRequest extends BasePacket implements IDeclineFriendRequest {
    nickname: string | null = null;
    read(buffer: Buffer) {
        this.nickname = new BufferReader(buffer).readOptionalString();
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.nickname).getBuffer();
    }
    static getId() {
        return -1588006900;
    }
}
export class FriendRemoved extends BasePacket implements IFriendRemoved {
    nickname: string | null = null;
    constructor(nickname?: string | null) {
        super();
        if (nickname) {
            this.nickname = nickname;
        }
    }
    read(buffer: Buffer) {
        this.nickname = new BufferReader(buffer).readOptionalString();
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.nickname).getBuffer();
    }
    static getId() {
        return 1716773193;
    }
}
export class FriendRequestAccepted extends BasePacket implements IFriendRequestAccepted {
    nickname: string | null = null;
    constructor(nickname?: string | null) {
        super();
        if (nickname) {
            this.nickname = nickname;
        }
    }
    read(buffer: Buffer) {
        this.nickname = new BufferReader(buffer).readOptionalString();
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.nickname).getBuffer();
    }
    static getId() {
        return -139645601;
    }
}
export class FriendRequestAlreadySent extends BasePacket implements IFriendRequestAlreadySent {
    nickname: string | null = null;
    constructor(nickname?: string | null) {
        super();
        if (nickname) {
            this.nickname = nickname;
        }
    }
    read(buffer: Buffer) {
        this.nickname = new BufferReader(buffer).readOptionalString();
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.nickname).getBuffer();
    }
    static getId() {
        return 2064692768;
    }
}
export class FriendRequestCanceledOrDeclined extends BasePacket implements IFriendRequestCanceledOrDeclined {
    nickname: string | null = null;
    constructor(nickname?: string | null) {
        super();
        if (nickname) {
            this.nickname = nickname;
        }
    }
    read(buffer: Buffer) {
        this.nickname = new BufferReader(buffer).readOptionalString();
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.nickname).getBuffer();
    }
    static getId() {
        return 614714702;
    }
}
export class FriendRequestDeclined extends BasePacket implements IFriendRequestDeclined {
    nickname: string | null = null;
    constructor(nickname?: string | null) {
        super();
        if (nickname) {
            this.nickname = nickname;
        }
    }
    read(buffer: Buffer) {
        this.nickname = new BufferReader(buffer).readOptionalString();
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.nickname).getBuffer();
    }
    static getId() {
        return -1885167992;
    }
}
export class FriendRequestSent extends BasePacket implements IFriendRequestSent {
    nickname: string | null = null;
    constructor(nickname?: string | null) {
        super();
        if (nickname) {
            this.nickname = nickname;
        }
    }
    read(buffer: Buffer) {
        this.nickname = new BufferReader(buffer).readOptionalString();
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.nickname).getBuffer();
    }
    static getId() {
        return -1241704092;
    }
}
export class FriendsList extends BasePacket implements IFriendsList {
    static readonly schema: PacketSchema = [
        { name: "acceptedFriends", type: "optStringArray" },
        { name: "newAcceptedFriends", type: "optStringArray" },
        { name: "incomingRequests", type: "optStringArray" },
        { name: "newIncomingRequests", type: "optStringArray" },
        { name: "outgoingRequests", type: "optStringArray" },
    ];
    acceptedFriends: string[] = [];
    newAcceptedFriends: string[] = [];
    incomingRequests: string[] = [];
    newIncomingRequests: string[] = [];
    outgoingRequests: string[] = [];
    constructor(data?: IFriendsListProps) {
        super();
        if (data) {
            Object.assign(this, data);
        }
    }
    read(buffer: Buffer): void { readSchema(this, FriendsList.schema, buffer); }
    write(): Buffer { return writeSchema(this, FriendsList.schema); }
    static getId() {
        return 1422563374;
    }
}
export class IncomingFriendRequestExists extends BasePacket implements IIncomingFriendRequestExists {
    nickname: string | null = null;
    constructor(nickname?: string | null) {
        super();
        if (nickname) {
            this.nickname = nickname;
        }
    }
    read(buffer: Buffer) {
        this.nickname = new BufferReader(buffer).readOptionalString();
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.nickname).getBuffer();
    }
    static getId() {
        return -1258754138;
    }
}
export class LoadFriends extends BasePacket implements ILoadFriends {
    unknown: boolean = false;
    read(buffer: Buffer) {
        this.unknown = new BufferReader(buffer).readUInt8() === 1;
    }
    write(): Buffer {
        return new BufferWriter().writeUInt8(this.unknown ? 1 : 0).getBuffer();
    }
    static getId() {
        return -731115522;
    }
}
export class NewFriendRequest extends BasePacket implements INewFriendRequest {
    nickname: string | null = null;
    constructor(nickname?: string | null) {
        super();
        if (nickname) {
            this.nickname = nickname;
        }
    }
    read(buffer: Buffer) {
        this.nickname = new BufferReader(buffer).readOptionalString();
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.nickname).getBuffer();
    }
    static getId() {
        return 553380510;
    }
}
export class RemoveFriend extends BasePacket implements IRemoveFriend {
    nickname: string | null = null;
    read(buffer: Buffer) {
        this.nickname = new BufferReader(buffer).readOptionalString();
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.nickname).getBuffer();
    }
    static getId() {
        return -221757454;
    }
}
export class UserExistsForFriend extends BasePacket implements IEmpty {
    read(buffer: Buffer) { }
    write(): Buffer {
        return new BufferWriter().getBuffer();
    }
    static getId() {
        return -707501253;
    }
}
export class UserInvalidForFriend extends BasePacket implements IEmpty {
    read(buffer: Buffer) { }
    write(): Buffer {
        return new BufferWriter().getBuffer();
    }
    static getId() {
        return -1490761936;
    }
}
export class SendFriendRequest extends BasePacket implements ISendFriendRequest {
    nickname: string | null = null;
    read(buffer: Buffer) {
        this.nickname = new BufferReader(buffer).readOptionalString();
    }
    write(): Buffer {
        return new BufferWriter().writeOptionalString(this.nickname).getBuffer();
    }
    static getId() {
        return -1457773660;
    }
}

export class RequestFriendsListWindow extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { }
    write(): Buffer {
        return new BufferWriter().getBuffer();
    }
    static getId(): number {
        return 1441234714;
    }
}

export class ShowFriendsListWindow extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { }
    write(): Buffer {
        return new BufferWriter().getBuffer();
    }
    static getId(): number {
        return -437587751;
    }
}