import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import logger from "@/utils/logger";
import * as ReferralPackets from "./referral.packets";

// NOTE: the in-game web panel experiment (server-driven OpenWebPanel over this same packet) was
// SHELVED — the HTMLLoader can't be made transparent/borderless under the game's Stage3D direct
// render mode. The client patch is kept but disabled (scripts/patches/_webpanel-button.js), and the
// webpanel/* files remain as unused reference. This handler is back to the original referral flow.
export class RequestReferralInfoHandler implements IPacketHandler<ReferralPackets.RequestReferralInfo> {
    public readonly packetId = ReferralPackets.RequestReferralInfo.getId();

    public async execute(client: GameClient, server: GameServer): Promise<void> {
        if (!client.user) {
            logger.warn("RequestReferralInfo received from unauthenticated client.", { client: client.getRemoteAddress() });
            return;
        }

        const details = await server.referralService.getReferralDetails(client.user);

        client.sendPacket(
            new ReferralPackets.ReferralInfoDetails({
                referredUsers: details.referredUsers,
                url: details.url,
                bannerCode: details.bannerCodeString,
                defaultMessage: details.defaultRefMessage,
            })
        );
    }
}
