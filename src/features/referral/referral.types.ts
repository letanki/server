import { IEmpty, IPacket } from "@/packets/packet.interfaces";

export interface IReferralInfo extends IPacket {
    hash: string;
    host: string;
}

export interface IReferredUser {
    user: string;
    income: number;
}

export interface IReferralInfoDetails extends IPacket {
    referredUsers: IReferredUser[];
    url: string;
    bannerCodeString: string;
    defaultRefMessage: string;
}

export interface IRequestReferralInfo extends IEmpty { }