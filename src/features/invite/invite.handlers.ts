import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import * as InvitePackets from "./invite.packets";

export class InviteCodeHandler implements IPacketHandler<InvitePackets.InviteCode> {
    public readonly packetId = InvitePackets.InviteCode.getId();

    public async execute(client: GameClient, server: GameServer, packet: InvitePackets.InviteCode): Promise<void> {
        if (!packet.inviteCode) {
            client.sendPacket(new InvitePackets.InviteCodeInvalid());
            return;
        }

        const result = await server.validateInviteCode(packet.inviteCode);

        if (!result.isValid) {
            client.sendPacket(new InvitePackets.InviteCodeInvalid());
            return;
        }

        if (result.nickname) {
            client.sendPacket(new InvitePackets.InviteCodeLogin({ nickname: result.nickname }));
            return;
        }

        client.sendPacket(new InvitePackets.InviteCodeRegister());
    }
}