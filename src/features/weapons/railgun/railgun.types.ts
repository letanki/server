import { IPacket } from "@/packets/packet.interfaces";
import { IVector3 } from "@/shared/types/geom/ivector3";

export interface IRailgunShotTargetData {
    nickname: string;
    /** Ponto de impacto em espaço LOCAL do alvo (para o relay/visual do raio). */
    localHitPoint: IVector3;
    incarnation: number;
    /** Posição do CORPO do alvo no mundo (para a validação anti-cheat). */
    targetPosition: IVector3;
}

export interface IRailgunShotCommand extends IPacket {
    clientTime: number;
    /** Ponto onde o raio tocou o CENÁRIO (null se só atravessou tanques). */
    staticHitPoint: IVector3 | null;
    targets: IRailgunShotTargetData[];
}

export interface IRailgunShotPacketData {
    shooterNickname: string | null;
    staticHitPoint: IVector3 | null;
    targets: {
        nickname: string;
        localHitPoint: IVector3;
    }[];
}

export interface IRailgunShotPacket extends IPacket, IRailgunShotPacketData { }

export interface IStartChargingCommand extends IPacket {
    clientTime: number;
}

export interface IStartChargingPacketData {
    nickname: string | null;
}

export interface IStartChargingPacket extends IPacket, IStartChargingPacketData { }