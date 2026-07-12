import { IPacket } from "@/packets/packet.interfaces";
import { IVector3 } from "@/shared/types/geom/ivector3";

export interface IThunderShotNoTargetCommand extends IPacket {
    clientTime: number;
}
export interface IThunderShotNoTargetPacket extends IPacket {
    nickname: string | null;
}

export interface IThunderStaticShotCommand extends IPacket {
    clientTime: number;
    position: IVector3 | null;
}
export interface IThunderStaticShotPacketData {
    nickname: string | null;
    position: IVector3 | null;
}
export interface IThunderStaticShotPacket extends IPacket, IThunderStaticShotPacketData { }

export interface IThunderTargetShotCommand extends IPacket {
    clientTime: number;
    hitLocalPosition: IVector3 | null;
    nicknameTarget: string | null;
    incarnationTarget: number;
    targetPosition: IVector3 | null;
    hitGlobalPosition: IVector3 | null;
}
export interface IThunderTargetShotPacketData {
    nicknameShooter: string | null;
    nicknameTarget: string | null;
    internalPosition: IVector3 | null;
}
export interface IThunderTargetShotPacket extends IPacket, IThunderTargetShotPacketData { }