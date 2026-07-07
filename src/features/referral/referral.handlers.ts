import { sendWebPanel } from "@/features/webpanel/webpanel.service";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import logger from "@/utils/logger";
import * as ReferralPackets from "./referral.packets";

// The referral button is REPURPOSED as the entry point for the in-game web panel (Partida Competitiva).
// Its request packet (RequestReferralInfo) now opens the OPAQUE HTMLLoader panel instead of returning
// referral data. Both share the response packet id 1587315905; the client patch (webpanel-button.js)
// JSON.parses the first string, so we must ALWAYS answer with the panel config here (never raw referral
// text, which would crash the client with JSON #1132).
export class RequestReferralInfoHandler implements IPacketHandler<ReferralPackets.RequestReferralInfo> {
    public readonly packetId = ReferralPackets.RequestReferralInfo.getId();

    public async execute(client: GameClient, _server: GameServer): Promise<void> {
        if (!client.user) {
            logger.warn("RequestReferralInfo received from unauthenticated client.", { client: client.getRemoteAddress() });
            return;
        }
        sendWebPanel(client, { width: 0, height: 0 }, "referral-button"); // 0 = tela cheia (modal)
    }
}
