import { UpdateCrystals } from "@/features/profile/profile.packets";
import * as ProfilePackets from "@/features/profile/profile.packets";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import logger from "@/utils/logger";
import { LoadDependencies } from "@/features/loader/loader.packets";
import { ResourceManager } from "@/utils/resource.manager";
import * as ClanPackets from "./clan.packets";
import type { ClanDocument } from "./clan.model";
import { CLAN_MISSION_ICON_RESOURCES } from "./clan.missions.data";
import { positionPermissions } from "./clan.roles";

/** The images the not-in-clan window shows (intro illustration + clan card), plus the rankings podium. */
const CLAN_MODAL_RESOURCES = ["clan/intro", "clan/card", "clan/podium"] as const;

/** Preload the clan-modal images, then run `then` once the client has them (avoids "Resource not found"). */
function loadClanModalResources(client: GameClient, server: GameServer, then: (c: GameClient) => void): void {
    const callbackId = server.registerDynamicCallback((c) => {
        server.removeDynamicCallback(callbackId);
        then(c);
    });
    const resources = ResourceManager.getBulkResources([...CLAN_MODAL_RESOURCES]);
    client.sendPacket(new LoadDependencies({ resources }, callbackId));
}

/** If the clan's leader is online, push the real-time "new join request" notify (card add). */
async function notifyOwnerRequestAdded(server: GameServer, clan: ClanDocument, requesterNick: string): Promise<void> {
    const owner = await server.clanService.getLeaderUsername(clan);
    const ownerClient = owner ? server.findClientByUsername(owner) : undefined;
    if (!ownerClient) return;
    ownerClient.sendPacket(new ClanPackets.NotifyJoinRequestPacket(requesterNick));
    ownerClient.sendPacket(new ClanPackets.AddJoinRequestPacket(requesterNick));
}

/** If the clan's leader is online, push the real-time "request removed" notify (card remove). */
async function notifyOwnerRequestRemoved(server: GameServer, clan: ClanDocument, requesterNick: string): Promise<void> {
    const owner = await server.clanService.getLeaderUsername(clan);
    const ownerClient = owner ? server.findClientByUsername(owner) : undefined;
    if (!ownerClient) return;
    ownerClient.sendPacket(new ClanPackets.JoinRequestDeclinedPacket(requesterNick));
    ownerClient.sendPacket(new ClanPackets.RemoveJoinRequestPacket(requesterNick));
}

/** If the clan's leader is online, drop the SENT-invite card for `username` from their list. */
async function notifyOwnerInviteRemoved(server: GameServer, clan: ClanDocument, username: string): Promise<void> {
    const owner = await server.clanService.getLeaderUsername(clan);
    const ownerClient = owner ? server.findClientByUsername(owner) : undefined;
    if (ownerClient) ownerClient.sendPacket(new ClanPackets.ClanInviteCancelledAckPacket(username));
}

/** Open the right clan window based on the SERVER's truth, regardless of which open-packet the client
 *  sent. A kicked/left member's client may still think it's in a clan (its login state is stale) and send
 *  the member open-packet — but if our user.clanId is null we must show the not-in-clan modal, not the
 *  my-clan window. (Otherwise it only corrects on relogin.) */
async function openClanWindowForState(client: GameClient, server: GameServer): Promise<void> {
    if (!client.user) return;
    if (client.user.clanId) {
        const clan = await server.clanService.getClanById(client.user.clanId);
        if (clan) {
            await server.clanService.promoteEligibleNovices(clan); // lazy Novice→Private (24h) on window open
            const view = await server.clanService.buildClanView(clan);
            client.sendPacket(new ClanPackets.MyClanWindowPacket(view));
            // Tell the client which clan actions this member may use (gates the UI buttons by their position).
            client.sendPacket(new ClanPackets.ClanPermissionsPacket(positionPermissions(server.clanService.getPosition(clan, client.user._id))));
            return;
        }
        client.user.clanId = null; // clan no longer exists (disbanded) → fall through to not-in-clan
    }
    // Not in a clan: load the window images first, then show it (+ the leave cooldown if still active).
    const cooldown = server.clanService.clanCooldownSeconds(client.user);
    loadClanModalResources(client, server, (c) => {
        c.sendPacket(new ClanPackets.ShowNotInClanWindowPacket());
        if (cooldown > 0) c.sendPacket(new ClanPackets.ClanCooldownPacket(cooldown));
    });
}

/** Clan view opened (non-member open-packet). Routes by the server's membership truth. */
export class ShowNotInClanPanelHandler implements IPacketHandler<ClanPackets.ShowNotInClanPanelPacket> {
    public readonly packetId = ClanPackets.ShowNotInClanPanelPacket.getId();
    public async execute(client: GameClient, server: GameServer): Promise<void> {
        await openClanWindowForState(client, server);
    }
}

/** Owner edits the clan description → persist and echo it back (the official confirms the description). */
export class SetClanDescriptionHandler implements IPacketHandler<ClanPackets.SetClanDescriptionPacket> {
    public readonly packetId = ClanPackets.SetClanDescriptionPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: ClanPackets.SetClanDescriptionPacket): Promise<void> {
        if (!client.user) return;
        const clan = await server.clanService.editClanSettings(client.user, { description: packet.description ?? "" });
        if (clan) client.sendPacket(new ClanPackets.SetClanDescriptionPacket(clan.description));
    }
}

/** Owner edits the minimum rank to request to join → persist. */
export class SetClanMinRankHandler implements IPacketHandler<ClanPackets.SetClanMinRankPacket> {
    public readonly packetId = ClanPackets.SetClanMinRankPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: ClanPackets.SetClanMinRankPacket): Promise<void> {
        if (!client.user) return;
        await server.clanService.editClanSettings(client.user, { minRank: packet.minRank });
    }
}

/** Owner toggles recruiting (open/closed) → persist. */
export class SetClanRecruitingHandler implements IPacketHandler<ClanPackets.SetClanRecruitingPacket> {
    public readonly packetId = ClanPackets.SetClanRecruitingPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: ClanPackets.SetClanRecruitingPacket): Promise<void> {
        if (!client.user) return;
        await server.clanService.editClanSettings(client.user, { recruiting: packet.recruiting });
    }
}

/** Leader kicks a member → remove them, drop from the owner's list, and clear the kicked member's clan.
 *  (Official response packets weren't captured; mirrors the leave flow.) */
export class KickClanMemberHandler implements IPacketHandler<ClanPackets.KickClanMemberPacket> {
    public readonly packetId = ClanPackets.KickClanMemberPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: ClanPackets.KickClanMemberPacket): Promise<void> {
        if (!client.user || !packet.username) return;
        const kicked = await server.clanService.kickMember(client.user, packet.username);
        if (!kicked) return;
        // Owner: drop the member from the open window + clear their tag display.
        client.sendPacket(new ClanPackets.RemoveClanMemberPacket(kicked.username));
        client.sendPacket(new ClanPackets.MemberStatusNotifyPacket(kicked.username));
        client.sendPacket(new ProfilePackets.ClanNotifierData(kicked.username, null));
        // Kicked member (if online): sync their live session (the DB write above hit a different document
        // instance) so reopening the modal shows NotInClan, then close the window and clear their tag.
        const kickedClient = server.findClientByUsername(kicked.username);
        if (kickedClient) {
            if (kickedClient.user) kickedClient.user.clanId = null;
            kickedClient.sendPacket(new ClanPackets.CloseClanWindowPacket());
            kickedClient.sendPacket(new ProfilePackets.ClanNotifierData(kicked.username, null));
        }
    }
}

/** Owner/officer changes a member's clan position ("cargo"). The service validates the actor's permission +
 *  rank (must outrank the target and the new position, target ≠ owner/self); on success we push the target's
 *  new permission set to their live session so their clan UI updates. */
export class SetClanMemberPositionHandler implements IPacketHandler<ClanPackets.SetClanMemberPositionPacket> {
    public readonly packetId = ClanPackets.SetClanMemberPositionPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: ClanPackets.SetClanMemberPositionPacket): Promise<void> {
        if (!client.user || !packet.username) return;
        const result = await server.clanService.changeMemberPosition(client.user, packet.username, packet.position);
        if (!result) return;
        // Live-update the member's row (cargo) in EVERY online clan member's open panel (same packet the
        // official server uses for position changes).
        const memberView = server.clanService.buildMemberView(result.clan, result.target);
        const clanId = String(result.clan._id);
        for (const c of server.getClients()) {
            if (c.user && String(c.user.clanId) === clanId) c.sendPacket(new ClanPackets.AddClanMemberPacket(memberView));
        }
        // Push the target's new permission set to their live session so their own clan UI re-gates.
        const targetClient = server.findClientByUsername(result.target.username);
        if (targetClient) targetClient.sendPacket(new ClanPackets.ClanPermissionsPacket(positionPermissions(result.position)));
        logger.info(`${client.user.username} changed ${result.target.username}'s clan position to ${result.position}.`);
    }
}

/** Member with EDIT_SETTINGS uploads a new clan logo → store the image + point clan.logo at the served path.
 *  The official server sends no echo (the editor already shows the uploaded bytes locally); other members pick
 *  up the new logo from the clan model the next time they open the window. */
export class SetClanLogoHandler implements IPacketHandler<ClanPackets.SetClanLogoPacket> {
    public readonly packetId = ClanPackets.SetClanLogoPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: ClanPackets.SetClanLogoPacket): Promise<void> {
        if (!client.user || !packet.image.length) return;
        await server.clanService.setClanLogo(client.user, packet.image);
    }
}

/** Client opens the clan missions ("DAILY_QUEST_MISSIONS") tab → refresh the daily set (regenerate if the
 *  day/week rolled over), then send the mission list. Prizes are auto-claimed on completion, so there's no
 *  claim packet to handle. */
export class OpenClanMissionsHandler implements IPacketHandler<ClanPackets.OpenClanMissionsPacket> {
    public readonly packetId = ClanPackets.OpenClanMissionsPacket.getId();
    public async execute(client: GameClient, server: GameServer): Promise<void> {
        if (!client.user?.clanId) return;
        const clan = await server.clanService.getClanById(client.user.clanId);
        if (!clan) return;
        const fresh = await server.clanService.ensureMissions(clan);
        const views = server.clanService.buildMissionViews(fresh);
        // The mission icon is a Resource on the wire and the client resolves it DURING deserialization —
        // if the icon isn't loaded it throws "Resource <id> not found" and drops the whole packet (the
        // window stays on the loading spinner). So preload the icons first, then send the list.
        const iconResources = ResourceManager.getBulkResources([...CLAN_MISSION_ICON_RESOURCES]);
        const callbackId = server.registerDynamicCallback((c) => {
            server.removeDynamicCallback(callbackId);
            c.sendPacket(new ClanPackets.ShowClanMissionsPacket(views));
        });
        client.sendPacket(new LoadDependencies({ resources: iconResources }, callbackId));
    }
}

/** Member leaves the clan → remove them, start their 24h cooldown, and update both sides. */
export class LeaveClanHandler implements IPacketHandler<ClanPackets.LeaveClanPacket> {
    public readonly packetId = ClanPackets.LeaveClanPacket.getId();
    public async execute(client: GameClient, server: GameServer): Promise<void> {
        if (!client.user) return;
        const username = client.user.username;
        const result = await server.clanService.leaveClan(client.user);
        if (!result) return;
        // Leaver: close the window, notify, start the cooldown, clear their clan tag.
        client.sendPacket(new ClanPackets.CloseClanWindowPacket());
        client.sendPacket(new ClanPackets.MemberStatusNotifyPacket(username));
        client.sendPacket(new ClanPackets.ClanCooldownPacket(server.clanService.clanCooldownSeconds(client.user)));
        client.sendPacket(new ProfilePackets.ClanNotifierData(username, null));
        // Owner (if a regular member left and they're online): drop the member from the list.
        if (!result.wasLeader) {
            const owner = await server.clanService.getLeaderUsername(result.clan);
            const ownerClient = owner ? server.findClientByUsername(owner) : undefined;
            if (ownerClient) {
                ownerClient.sendPacket(new ClanPackets.RemoveClanMemberPacket(username));
                ownerClient.sendPacket(new ClanPackets.MemberStatusNotifyPacket(username));
                ownerClient.sendPacket(new ProfilePackets.ClanNotifierData(username, null));
            }
        }
    }
}

/** A member/owner opens their clan window (member open-packet). Routes by the server's membership truth,
 *  so a stale client that was kicked still gets the not-in-clan modal instead of the my-clan window. */
export class OpenMyClanWindowHandler implements IPacketHandler<ClanPackets.OpenMyClanWindowPacket> {
    public readonly packetId = ClanPackets.OpenMyClanWindowPacket.getId();
    public async execute(client: GameClient, server: GameServer): Promise<void> {
        await openClanWindowForState(client, server);
    }
}

/** Owner accepts a pending join request → the requester joins. Mirrors the invite-accept member-add
 *  (official response packets not captured): owner's request card becomes a member; requester gets the clan. */
export class AcceptJoinRequestHandler implements IPacketHandler<ClanPackets.AcceptJoinRequestPacket> {
    public readonly packetId = ClanPackets.AcceptJoinRequestPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: ClanPackets.AcceptJoinRequestPacket): Promise<void> {
        if (!client.user || !packet.username) return;
        const result = await server.clanService.acceptJoinRequest(client.user, packet.username);
        if (!result) return;
        const { clan, requester } = result;
        const view = await server.clanService.buildClanView(clan);
        const member = view.members.find((m) => m.nick === requester.username);
        // Owner: drop the request card, add the new member to the list.
        if (member) {
            client.sendPacket(new ClanPackets.JoinRequestDeclinedPacket(requester.username));
            client.sendPacket(new ClanPackets.RemoveJoinRequestPacket(requester.username));
            client.sendPacket(new ClanPackets.AddClanMemberPacket(member));
            client.sendPacket(new ClanPackets.MemberAddedNotifyPacket(requester.username));
            client.sendPacket(new ClanPackets.ClanLeaderNotifyPacket(requester.username));
            client.sendPacket(new ProfilePackets.ClanNotifierData(requester.username, clan.tag));
        }
        // Requester (if online): sync their live session, drop their sent-request card, show the clan.
        const reqClient = server.findClientByUsername(requester.username);
        if (reqClient) {
            if (reqClient.user) reqClient.user.clanId = clan._id as any;
            reqClient.sendPacket(new ClanPackets.JoinRequestCancelledPacket(clan.tag));
            reqClient.sendPacket(new ClanPackets.HideNotInClanPanelPacket());
            reqClient.sendPacket(new ClanPackets.ClanTagNotifyPacket(clan.tag));
            reqClient.sendPacket(new ClanPackets.ClanNameNotifyPacket(clan.name));
            reqClient.sendPacket(new ClanPackets.MyClanWindowPacket(view));
            reqClient.sendPacket(new ProfilePackets.ClanNotifierData(requester.username, clan.tag));
        }
    }
}

/** Owner selected a pending request (sent before accept/decline) — no state change. */
export class SelectJoinRequestHandler implements IPacketHandler<ClanPackets.SelectJoinRequestPacket> {
    public readonly packetId = ClanPackets.SelectJoinRequestPacket.getId();
    public async execute(_client: GameClient, _server: GameServer): Promise<void> {
        /* no-op: this just selects the request row on the client */
    }
}

/** Owner viewed a member/notification → clear its "new" badge (echo MemberStatusNotify back). */
export class MarkMemberSeenHandler implements IPacketHandler<ClanPackets.MarkMemberSeenPacket> {
    public readonly packetId = ClanPackets.MarkMemberSeenPacket.getId();
    public async execute(client: GameClient, _server: GameServer, packet: ClanPackets.MarkMemberSeenPacket): Promise<void> {
        if (!packet.username) return;
        client.sendPacket(new ClanPackets.MemberStatusNotifyPacket(packet.username));
    }
}

/** Owner declines ALL pending join requests → clears them and drops every card (both sides). */
export class DeclineAllJoinRequestsHandler implements IPacketHandler<ClanPackets.DeclineAllJoinRequestsPacket> {
    public readonly packetId = ClanPackets.DeclineAllJoinRequestsPacket.getId();
    public async execute(client: GameClient, server: GameServer): Promise<void> {
        if (!client.user) return;
        const result = await server.clanService.declineAllJoinRequests(client.user);
        if (!result) return;
        for (const nick of result.nicks) {
            // Owner: drop each request card.
            client.sendPacket(new ClanPackets.JoinRequestDeclinedPacket(nick));
            client.sendPacket(new ClanPackets.RemoveJoinRequestPacket(nick));
            // Requester (if online): remove their sent-request card.
            const reqClient = server.findClientByUsername(nick);
            if (reqClient) reqClient.sendPacket(new ClanPackets.JoinRequestCancelledPacket(result.tag));
        }
    }
}

/** Owner declines a pending join request → removes it and tells the client to drop the request card. */
export class DeclineJoinRequestHandler implements IPacketHandler<ClanPackets.DeclineJoinRequestPacket> {
    public readonly packetId = ClanPackets.DeclineJoinRequestPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: ClanPackets.DeclineJoinRequestPacket): Promise<void> {
        if (!client.user || !packet.username) return;
        const result = await server.clanService.declineJoinRequest(client.user, packet.username);
        if (!result) return;
        // Drop the request card on the owner's own list.
        client.sendPacket(new ClanPackets.JoinRequestDeclinedPacket(result.nick));
        client.sendPacket(new ClanPackets.RemoveJoinRequestPacket(result.nick));
        // And tell the requester (if online) their pending request is gone — otherwise their "sent
        // requests" card lingers until relogin (same packet as a self-cancel).
        const requesterClient = server.findClientByUsername(result.nick);
        if (requesterClient) requesterClient.sendPacket(new ClanPackets.JoinRequestCancelledPacket(result.tag));
    }
}

/** Close the clan window: echo the packet back so the client actually closes the view. */
export class CloseClanWindowHandler implements IPacketHandler<ClanPackets.CloseClanWindowPacket> {
    public readonly packetId = ClanPackets.CloseClanWindowPacket.getId();
    public async execute(client: GameClient, _server: GameServer): Promise<void> {
        client.sendPacket(new ClanPackets.CloseClanWindowPacket());
    }
}

export class HideNotInClanPanelHandler implements IPacketHandler<ClanPackets.HideNotInClanPanelPacket> {
    public readonly packetId = ClanPackets.HideNotInClanPanelPacket.getId();
    public async execute(_client: GameClient, _server: GameServer): Promise<void> {
        /* nothing to do server-side */
    }
}

/** Clan leaderboard request → reply with the requested page (clans by rating desc) as light models. */
export class GetClanRatingsDataHandler implements IPacketHandler<ClanPackets.GetClanRatingsDataPacket> {
    public readonly packetId = ClanPackets.GetClanRatingsDataPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: ClanPackets.GetClanRatingsDataPacket): Promise<void> {
        const clans = await server.clanService.getRatingsPage(packet.startIndex, packet.count);
        client.sendPacket(new ClanPackets.SetClanRatingsDataPacket(packet.startIndex, clans));
    }
}

/** View a clan by tag → send the full clan-details window (byte-perfect ClanModel). */
export class ShowForeignClanHandler implements IPacketHandler<ClanPackets.ShowForeignClanPacket> {
    public readonly packetId = ClanPackets.ShowForeignClanPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: ClanPackets.ShowForeignClanPacket): Promise<void> {
        const clan = packet.clanTag ? await server.clanService.getClanByTag(packet.clanTag) : null;
        if (!clan) {
            logger.info(`Foreign clan view: "${packet.clanTag}" not found.`);
            return;
        }
        const view = await server.clanService.buildClanView(clan);
        client.sendPacket(new ClanPackets.ShowForeignClanWindowPacket(view));
    }
}

/** Live TAG availability check (create form). Replies with the available/taken empty packet. */
export class CheckClanTagHandler implements IPacketHandler<ClanPackets.CheckClanTagPacket> {
    public readonly packetId = ClanPackets.CheckClanTagPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: ClanPackets.CheckClanTagPacket): Promise<void> {
        const taken = !!packet.tag && !!(await server.clanService.getClanByTag(packet.tag));
        client.sendPacket(taken ? new ClanPackets.ClanTagTakenPacket() : new ClanPackets.ClanTagAvailablePacket());
    }
}

/** Live NAME availability check (create form). Replies with the available/taken empty packet. */
export class CheckClanNameHandler implements IPacketHandler<ClanPackets.CheckClanNamePacket> {
    public readonly packetId = ClanPackets.CheckClanNamePacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: ClanPackets.CheckClanNamePacket): Promise<void> {
        const taken = !!packet.name && !!(await server.clanService.getClanByName(packet.name));
        client.sendPacket(taken ? new ClanPackets.ClanNameTakenPacket() : new ClanPackets.ClanNameAvailablePacket());
    }
}

/** Search/list panel: clan exists by name? → reply ClanSearchFound when a match exists (enables the button). */
export class SearchClanByNameHandler implements IPacketHandler<ClanPackets.SearchClanByNamePacket> {
    public readonly packetId = ClanPackets.SearchClanByNamePacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: ClanPackets.SearchClanByNamePacket): Promise<void> {
        if (!client.user || !packet.name) return;
        const clan = await server.clanService.getClanByNameInsensitive(packet.name);
        // 1726541163 = exists AND recruiting (enable); -866005248 = not found OR not recruiting (disable).
        const joinable = !!clan && clan.recruiting !== false;
        client.sendPacket(joinable ? new ClanPackets.ClanSearchFoundPacket() : new ClanPackets.ClanSearchUnavailablePacket());
    }
}

/** "Request to join" from the search/list panel (by clan name) → same result as the clan-view request. */
export class JoinClanByNameHandler implements IPacketHandler<ClanPackets.JoinClanByNamePacket> {
    public readonly packetId = ClanPackets.JoinClanByNamePacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: ClanPackets.JoinClanByNamePacket): Promise<void> {
        if (!client.user || !packet.name) return;
        const clan = await server.clanService.requestJoinByName(client.user, packet.name);
        if (!clan) return;
        const view = await server.clanService.buildClanView(clan);
        client.sendPacket(new ClanPackets.JoinRequestModelPacket(view));
        client.sendPacket(new ClanPackets.JoinRequestSentPacket(clan.tag));
        await notifyOwnerRequestAdded(server, clan, client.user.username);
    }
}

/** Cancel a pending join request from the "sent requests" modal → removes it and acks. */
export class CancelJoinRequestFromModalHandler implements IPacketHandler<ClanPackets.CancelJoinRequestFromModalPacket> {
    public readonly packetId = ClanPackets.CancelJoinRequestFromModalPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: ClanPackets.CancelJoinRequestFromModalPacket): Promise<void> {
        if (!client.user || !packet.tag) return;
        const clan = await server.clanService.cancelJoinRequest(client.user, packet.tag);
        if (!clan) return;
        client.sendPacket(new ClanPackets.JoinRequestCancelledPacket(clan.tag));
        await notifyOwnerRequestRemoved(server, clan, client.user.username);
    }
}

/** "Request to join" a clan → records the pending request and acks the client. */
export class JoinClanRequestHandler implements IPacketHandler<ClanPackets.JoinClanRequestPacket> {
    public readonly packetId = ClanPackets.JoinClanRequestPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: ClanPackets.JoinClanRequestPacket): Promise<void> {
        if (!client.user || !packet.tag) return;
        const clan = await server.clanService.requestJoin(client.user, packet.tag);
        if (!clan) return;
        // Official order: the request-card model (325031295), then the simple ack — so the request
        // shows up in the "sent requests" modal.
        const view = await server.clanService.buildClanView(clan);
        client.sendPacket(new ClanPackets.JoinRequestModelPacket(view));
        client.sendPacket(new ClanPackets.JoinRequestSentPacket(clan.tag));
        await notifyOwnerRequestAdded(server, clan, client.user.username);
    }
}

/** Cancel a pending join request → removes it and acks the client. */
export class CancelJoinClanRequestHandler implements IPacketHandler<ClanPackets.CancelJoinClanRequestPacket> {
    public readonly packetId = ClanPackets.CancelJoinClanRequestPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: ClanPackets.CancelJoinClanRequestPacket): Promise<void> {
        if (!client.user || !packet.tag) return;
        const clan = await server.clanService.cancelJoinRequest(client.user, packet.tag);
        if (!clan) return;
        client.sendPacket(new ClanPackets.JoinRequestCancelledPacket(clan.tag));
        await notifyOwnerRequestRemoved(server, clan, client.user.username);
    }
}

/** Live validation as the leader types a username in the invite field → toggles the "send invite" button.
 *  Replies with the valid/invalid empty packet (the id encodes the result). */
export class CheckInviteUserHandler implements IPacketHandler<ClanPackets.CheckInviteUserPacket> {
    public readonly packetId = ClanPackets.CheckInviteUserPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: ClanPackets.CheckInviteUserPacket): Promise<void> {
        if (!client.user) return;
        const valid = !!packet.username && (await server.clanService.canInviteUser(client.user, packet.username));
        client.sendPacket(valid ? new ClanPackets.InviteUserValidPacket() : new ClanPackets.InviteUserInvalidPacket());
    }
}

/** Owner sends a clan invite → records it, acks the owner, and pushes the invite to the target if online. */
export class SendClanInviteHandler implements IPacketHandler<ClanPackets.SendClanInvitePacket> {
    public readonly packetId = ClanPackets.SendClanInvitePacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: ClanPackets.SendClanInvitePacket): Promise<void> {
        if (!client.user || !packet.username) return;
        const result = await server.clanService.inviteUser(client.user, packet.username);
        if (!result) return;
        client.sendPacket(new ClanPackets.ClanInviteSentAckPacket(result.target.username));
        const targetClient = server.findClientByUsername(result.target.username);
        if (targetClient) {
            // The invited user gets the clan card (325031295) then the invite notify (134379747).
            const view = await server.clanService.buildClanView(result.clan);
            targetClient.sendPacket(new ClanPackets.JoinRequestModelPacket(view));
            targetClient.sendPacket(new ClanPackets.ClanInviteNotifyPacket(result.clan.tag));
        }
    }
}

/** Owner cancels a pending invite → removes it, acks the owner, and tells the target to drop the invite. */
export class CancelClanInviteHandler implements IPacketHandler<ClanPackets.CancelClanInvitePacket> {
    public readonly packetId = ClanPackets.CancelClanInvitePacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: ClanPackets.CancelClanInvitePacket): Promise<void> {
        if (!client.user || !packet.username) return;
        const result = await server.clanService.cancelInvite(client.user, packet.username);
        if (!result) return;
        client.sendPacket(new ClanPackets.ClanInviteCancelledAckPacket(result.target.username));
        const targetClient = server.findClientByUsername(result.target.username);
        if (targetClient) targetClient.sendPacket(new ClanPackets.ClanInviteAckPacket(result.clan.tag));
    }
}

/** Invited user opens the clan attached to an invite → echo the tag back. */
export class ViewInviteClanHandler implements IPacketHandler<ClanPackets.ViewInviteClanPacket> {
    public readonly packetId = ClanPackets.ViewInviteClanPacket.getId();
    public async execute(client: GameClient, _server: GameServer, packet: ClanPackets.ViewInviteClanPacket): Promise<void> {
        if (!packet.tag) return;
        client.sendPacket(new ClanPackets.ViewInviteClanResponsePacket(packet.tag));
    }
}

/** Invited user accepts → joins the clan and is taken to the clan profile. */
export class AcceptClanInviteHandler implements IPacketHandler<ClanPackets.AcceptClanInvitePacket> {
    public readonly packetId = ClanPackets.AcceptClanInvitePacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: ClanPackets.AcceptClanInvitePacket): Promise<void> {
        if (!client.user || !packet.tag) return;
        const clan = await server.clanService.acceptInvite(client.user, packet.tag);
        if (!clan) return;
        const view = await server.clanService.buildClanView(clan);
        // Official accept sequence for the new member: hide the not-in-clan panel, drop the invite card,
        // set the clan tag + name, then show the clan window.
        client.sendPacket(new ClanPackets.HideNotInClanPanelPacket());
        client.sendPacket(new ClanPackets.ClanInviteAckPacket(clan.tag));
        client.sendPacket(new ClanPackets.ClanTagNotifyPacket(clan.tag));
        client.sendPacket(new ClanPackets.ClanNameNotifyPacket(clan.name));
        client.sendPacket(new ClanPackets.MyClanWindowPacket(view));
        client.sendPacket(new ProfilePackets.ClanNotifierData(client.user.username, clan.tag));
        // Notify the online owner: clear the pending invite and add the new member to their window.
        const owner = await server.clanService.getLeaderUsername(clan);
        const ownerClient = owner ? server.findClientByUsername(owner) : undefined;
        const member = view.members.find((m) => m.nick === client.user!.username);
        if (ownerClient && member) {
            // Official order: clear invite, add member model, two username notifies, then set the tag.
            ownerClient.sendPacket(new ClanPackets.ClanInviteCancelledAckPacket(client.user.username));
            ownerClient.sendPacket(new ClanPackets.AddClanMemberPacket(member));
            ownerClient.sendPacket(new ClanPackets.MemberAddedNotifyPacket(client.user.username));
            ownerClient.sendPacket(new ClanPackets.ClanLeaderNotifyPacket(client.user.username));
            ownerClient.sendPacket(new ProfilePackets.ClanNotifierData(client.user.username, clan.tag));
        }
        // She can only be in one clan now: strip her dangling requests/invites elsewhere and clear those
        // owners' cards (the "convite enviado ou recebido" / pending request must disappear).
        const cleared = await server.clanService.clearPendingMembership(client.user);
        for (const { clan: other, removedRequest, removedInvite } of cleared) {
            if (removedRequest) await notifyOwnerRequestRemoved(server, other, client.user.username);
            if (removedInvite && String(other._id) !== String(clan._id)) await notifyOwnerInviteRemoved(server, other, client.user.username);
        }
    }
}

/** Invited user declines → removes the invite and acks. */
export class DeclineClanInviteHandler implements IPacketHandler<ClanPackets.DeclineClanInvitePacket> {
    public readonly packetId = ClanPackets.DeclineClanInvitePacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: ClanPackets.DeclineClanInvitePacket): Promise<void> {
        if (!client.user || !packet.tag) return;
        const clan = await server.clanService.declineInvite(client.user, packet.tag);
        if (!clan) return;
        client.sendPacket(new ClanPackets.ClanInviteAckPacket(clan.tag)); // remove her received-invite card
        await notifyOwnerInviteRemoved(server, clan, client.user.username); // remove the owner's sent-invite card
    }
}

/** Create-clan form submit. Founds the clan + charges the cost. (Best-guess packet id — verify in-game.) */
export class CreateClanHandler implements IPacketHandler<ClanPackets.CreateClanPacket> {
    public readonly packetId = ClanPackets.CreateClanPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: ClanPackets.CreateClanPacket): Promise<void> {
        const user = client.user;
        if (!user || !packet.name || !packet.tag) return;
        try {
            const clan = await server.clanService.createClan(user, packet.name, packet.tag, "");
            // Send the user straight to the clan profile (the official order: close form, tag, window,
            // leader, crystals, clan tag).
            client.sendPacket(new ClanPackets.HideNotInClanPanelPacket());
            client.sendPacket(new ClanPackets.ClanTagNotifyPacket(clan.tag));
            const view = await server.clanService.buildClanView(clan);
            client.sendPacket(new ClanPackets.MyClanWindowPacket(view));
            client.sendPacket(new ClanPackets.ClanLeaderNotifyPacket(user.username));
            client.sendPacket(new UpdateCrystals(user.crystals)); // cost was deducted
            client.sendPacket(new ProfilePackets.ClanNotifierData(user.username, clan.tag)); // show the tag
            logger.info(`${user.username} created clan ${clan.name} [${clan.tag}].`);
        } catch (error: any) {
            logger.warn(`Clan creation failed for ${user.username}: ${error.message}`);
        }
    }
}
