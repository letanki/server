import { UserNotInBattlePacket } from "@/features/lobby/lobby.packets";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import { secondsLeft } from "@/shared/models/passes";
import logger from "@/utils/logger";
import * as ProfilePackets from "./profile.packets";

export class GetUserInfoHandler implements IPacketHandler<ProfilePackets.GetUserInfo> {
    public readonly packetId = ProfilePackets.GetUserInfo.getId();

    public async execute(client: GameClient, server: GameServer, packet: ProfilePackets.GetUserInfo): Promise<void> {
        if (!packet.nickname) {
            return;
        }

        const userInfo = await server.profileService.getFullUserInfo(server, packet.nickname);
        if (!userInfo) {
            return;
        }

        const { user, isOnline, isInBattle } = userInfo;

        client.subscriptions.add(user.username.toLowerCase());
        logger.info(`Client ${client.user?.username} subscribed to updates for ${user.username}`);

        client.sendPacket(new ProfilePackets.OnlineNotifierData({ isOnline, server: 1, nickname: user.username }));
        client.sendPacket(new ProfilePackets.RankNotifierData({ rank: user.rank, nickname: user.username }));

        client.sendPacket(new ProfilePackets.PremiumNotifierData({ premiumTimeLeftInSeconds: secondsLeft(user.premiumExpiresAt), nickname: user.username }));

        if (!isInBattle) {
            client.sendPacket(new UserNotInBattlePacket({ nickname: user.username }));
        }

        // Per-user clan tag shown next to the nickname (null = no clan).
        const clanTag = await server.clanService.getTagForUser(user);
        client.sendPacket(new ProfilePackets.ClanNotifierData(user.username, clanTag));
    }
}