import { UpdateCrystals } from "@/features/profile/profile.packets";
import type { GameServer } from "@/server/game.server";
import User, { UserDocument } from "@/shared/models/user.model";
import logger from "@/utils/logger";
import { ResourceManager } from "@/utils/resource.manager";
import { ClanView, ClanMemberView, ClanMissionView } from "./clan.packets";
import Clan, { ClanDocument, IClanMission } from "./clan.model";
import { CLAN_MISSION_TEMPLATES, IClanMissionContribution, IClanMissionTemplate, MISSION_POINTS } from "./clan.missions.data";
import { ClanPermissionFlag, ClanPosition, isValidPosition, outranks, positionHasPermission } from "./clan.roles";
import { saveClanLogo } from "./clan.logo";

/** The clan wire "id" is the creation time in MILLISECONDS (the client derives the founding date from it). */
function msToLong(ms: number): Buffer {
    const b = Buffer.alloc(8);
    b.writeBigInt64BE(BigInt(Math.floor(ms)));
    return b;
}

/** Next 00:00 UTC — when the daily clan mission set regenerates. */
function nextDailyReset(): Date {
    const d = new Date();
    d.setUTCHours(24, 0, 0, 0);
    return d;
}

/** Next Monday 00:00 UTC — when weeklyClanScore resets. */
function nextWeeklyReset(): Date {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    const daysUntilMonday = ((8 - d.getUTCDay()) % 7) || 7;
    d.setUTCDate(d.getUTCDate() + daysUntilMonday);
    return d;
}

export const CLAN_CREATION_COST = 500000; // crystals to found a clan (matches InitUserClanModels)

export class ClanService {
    /** Founds a new clan led by `user`, charging the creation cost. Throws on validation failure. */
    public async createClan(user: UserDocument, name: string, tag: string, description: string): Promise<ClanDocument> {
        if (user.clanId) throw new Error("Você já está em um clã.");
        // The 24h post-leave cooldown only blocks JOINING another clan, not creating one.
        const cleanName = name.trim();
        const cleanTag = tag.trim();
        if (cleanName.length < 3) throw new Error("Nome do clã muito curto.");
        if (cleanTag.length < 2) throw new Error("Tag do clã muito curta.");
        if (user.crystals < CLAN_CREATION_COST) throw new Error("Cristais insuficientes para criar um clã.");
        if (await Clan.findOne({ $or: [{ name: cleanName }, { tag: cleanTag }] })) {
            throw new Error("Já existe um clã com esse nome ou tag.");
        }

        const clan = await Clan.create({
            name: cleanName,
            tag: cleanTag,
            description: description ?? "",
            leaderId: user._id,
            members: [user._id],
            positions: new Map([[String(user._id), ClanPosition.SUPREME_COMMANDER]]),
            memberSince: new Map([[String(user._id), new Date()]]),
            rating: 0,
        });

        user.crystals -= CLAN_CREATION_COST;
        user.clanId = clan._id as any;
        await user.save();

        logger.info(`Clan "${cleanName}" [${cleanTag}] created by ${user.username}.`);
        return clan;
    }

    /** A member's clan position. Legacy clans (no positions map) → leader=Supreme Commander, others=Novice. */
    public getPosition(clan: ClanDocument, userId: unknown): ClanPosition {
        const stored = clan.positions?.get(String(userId));
        if (stored !== undefined && isValidPosition(stored)) return stored;
        return String(clan.leaderId) === String(userId) ? ClanPosition.SUPREME_COMMANDER : ClanPosition.NOVICE;
    }

    /** Whether the member holds a permission flag (via their position's flag set). */
    public memberHasPermission(clan: ClanDocument, userId: unknown, flag: ClanPermissionFlag): boolean {
        return positionHasPermission(this.getPosition(clan, userId), flag);
    }

    public getClanById(id: unknown): Promise<ClanDocument | null> {
        return Clan.findById(id as any).exec();
    }

    public getClanByTag(tag: string): Promise<ClanDocument | null> {
        return Clan.findOne({ tag: tag.trim() }).exec();
    }

    public getClanByName(name: string): Promise<ClanDocument | null> {
        return Clan.findOne({ name: name.trim() }).exec();
    }

    /** Case-insensitive clan lookup by display name (the search/list panel sends the typed name). */
    public getClanByNameInsensitive(name: string): Promise<ClanDocument | null> {
        const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return Clan.findOne({ name: new RegExp(`^${escaped}$`, "i") }).exec();
    }

    /** Records a pending join request from `user` to the given clan. Returns the clan (or null). */
    public async requestJoinToClan(user: UserDocument, clan: ClanDocument | null): Promise<ClanDocument | null> {
        if (user.clanId || !clan) return null; // already in a clan / no clan
        if (this.clanCooldownSeconds(user) > 0) return null; // still on post-leave cooldown
        if (clan.recruiting === false) return null; // clan closed to requests
        if (!clan.joinRequests.some((id) => String(id) === String(user._id))) {
            clan.joinRequests.push(user._id as any);
            await clan.save();
            logger.info(`${user.username} requested to join clan [${clan.tag}].`);
        }
        return clan;
    }

    /** Join request by clan TAG (from the clan-view "request to join" button). */
    public async requestJoin(user: UserDocument, tag: string): Promise<ClanDocument | null> {
        return this.requestJoinToClan(user, await this.getClanByTag(tag));
    }

    /** Join request by clan NAME (from the search/list panel). Name match is case-insensitive. */
    public async requestJoinByName(user: UserDocument, name: string): Promise<ClanDocument | null> {
        return this.requestJoinToClan(user, await this.getClanByNameInsensitive(name));
    }

    /** Withdraws `user`'s pending join request to the clan with `tag`. Returns the clan (or null). */
    public async cancelJoinRequest(user: UserDocument, tag: string): Promise<ClanDocument | null> {
        const clan = await this.getClanByTag(tag);
        if (!clan) return null;
        const before = clan.joinRequests.length;
        clan.joinRequests = clan.joinRequests.filter((id) => String(id) !== String(user._id)) as any;
        if (clan.joinRequests.length !== before) {
            await clan.save();
            logger.info(`${user.username} cancelled the join request to clan [${clan.tag}].`);
        }
        return clan;
    }

    /** Clans the user has a PENDING join request to (for repopulating the "sent requests" modal at login). */
    public getPendingRequests(user: UserDocument): Promise<ClanDocument[]> {
        return Clan.find({ joinRequests: user._id }).exec();
    }

    /** Top clans by rating (for the clan leaderboard). */
    public getRatings(limit: number = 40): Promise<ClanDocument[]> {
        return Clan.find().sort({ rating: -1 }).limit(limit).exec();
    }

    /** A page of the clan leaderboard (by rating desc) built as wire views. */
    public async getRatingsPage(startIndex: number, count: number): Promise<ClanView[]> {
        const clans = await Clan.find().sort({ rating: -1, _id: 1 }).skip(Math.max(0, startIndex)).limit(Math.max(0, count)).exec();
        return Promise.all(clans.map((c) => this.buildClanView(c)));
    }

    /** Whether `leader` can invite the user named `username` — used to toggle the invite button as they type.
     *  Valid = the account exists and isn't already in a clan (and isn't the leader). */
    public async canInviteUser(leader: UserDocument, username: string): Promise<boolean> {
        if (!leader.clanId) return false;
        const clan = await this.getClanById(leader.clanId);
        if (!clan || !this.memberHasPermission(clan, leader._id, ClanPermissionFlag.INVITE)) return false;
        const target = await User.findOne({ login: username.trim().toLowerCase() }).exec();
        if (!target) return false;
        if (String(target._id) === String(leader._id)) return false;
        if (target.clanId) return false;
        return true;
    }

    /** Leader invites a user (by username) to their clan. Returns { clan, target } or null on failure. */
    public async inviteUser(leader: UserDocument, username: string): Promise<{ clan: ClanDocument; target: UserDocument } | null> {
        if (!leader.clanId) return null;
        const clan = await this.getClanById(leader.clanId);
        if (!clan || !this.memberHasPermission(clan, leader._id, ClanPermissionFlag.INVITE)) return null; // needs "invite"
        const target = await User.findOne({ login: username.trim().toLowerCase() }).exec();
        if (!target || target.clanId) return null;
        if (!clan.invites.some((id) => String(id) === String(target._id))) {
            clan.invites.push(target._id as any);
            await clan.save();
            logger.info(`${leader.username} invited ${target.username} to clan [${clan.tag}].`);
        }
        return { clan, target };
    }

    /** Leader cancels a pending invite (by username). Returns { clan, target } or null. */
    public async cancelInvite(leader: UserDocument, username: string): Promise<{ clan: ClanDocument; target: UserDocument } | null> {
        if (!leader.clanId) return null;
        const clan = await this.getClanById(leader.clanId);
        if (!clan || !this.memberHasPermission(clan, leader._id, ClanPermissionFlag.INVITE)) return null;
        const target = await User.findOne({ login: username.trim().toLowerCase() }).exec();
        if (!target) return null;
        const before = clan.invites.length;
        clan.invites = clan.invites.filter((id) => String(id) !== String(target._id)) as any;
        if (clan.invites.length !== before) {
            await clan.save();
            logger.info(`${leader.username} cancelled the invite to ${target.username} [${clan.tag}].`);
        }
        return { clan, target };
    }

    /** Invited user accepts → joins the clan. Returns the clan or null. */
    public async acceptInvite(user: UserDocument, tag: string): Promise<ClanDocument | null> {
        if (user.clanId) return null;
        const clan = await this.getClanByTag(tag);
        if (!clan || !clan.invites.some((id) => String(id) === String(user._id))) return null;
        clan.invites = clan.invites.filter((id) => String(id) !== String(user._id)) as any;
        if (!clan.members.some((id) => String(id) === String(user._id))) clan.members.push(user._id as any);
        clan.positions.set(String(user._id), ClanPosition.NOVICE);
        clan.memberSince.set(String(user._id), new Date());
        await clan.save();
        user.clanId = clan._id as any;
        await user.save();
        logger.info(`${user.username} accepted the invite and joined clan [${clan.tag}].`);
        return clan;
    }

    /** After a user joins a clan, strip every other pending join request / invite (they can only be in one
     *  clan). Returns the affected clans with what was removed, so owners' lists can be updated live. */
    public async clearPendingMembership(user: UserDocument): Promise<{ clan: ClanDocument; removedRequest: boolean; removedInvite: boolean }[]> {
        const clans = await Clan.find({ $or: [{ joinRequests: user._id }, { invites: user._id }] }).exec();
        const result: { clan: ClanDocument; removedRequest: boolean; removedInvite: boolean }[] = [];
        for (const clan of clans) {
            const removedRequest = clan.joinRequests.some((id) => String(id) === String(user._id));
            const removedInvite = clan.invites.some((id) => String(id) === String(user._id));
            clan.joinRequests = clan.joinRequests.filter((id) => String(id) !== String(user._id)) as any;
            clan.invites = clan.invites.filter((id) => String(id) !== String(user._id)) as any;
            await clan.save();
            result.push({ clan, removedRequest, removedInvite });
        }
        return result;
    }

    /** Invited user declines the invite. Returns the clan or null. */
    public async declineInvite(user: UserDocument, tag: string): Promise<ClanDocument | null> {
        const clan = await this.getClanByTag(tag);
        if (!clan) return null;
        clan.invites = clan.invites.filter((id) => String(id) !== String(user._id)) as any;
        await clan.save();
        logger.info(`${user.username} declined the invite to clan [${clan.tag}].`);
        return clan;
    }

    /** Applies an owner edit (description / minRank / recruiting) to the leader's clan. Leader-only. */
    public async editClanSettings(
        owner: UserDocument,
        patch: Partial<Pick<ClanDocument, "description" | "minRank" | "recruiting">>,
    ): Promise<ClanDocument | null> {
        if (!owner.clanId) return null;
        const clan = await this.getClanById(owner.clanId);
        if (!clan || !this.memberHasPermission(clan, owner._id, ClanPermissionFlag.EDIT_SETTINGS)) return null; // needs "edit settings"
        if (patch.description !== undefined) clan.description = patch.description ?? "";
        if (patch.minRank !== undefined) clan.minRank = patch.minRank;
        if (patch.recruiting !== undefined) clan.recruiting = patch.recruiting;
        await clan.save();
        return clan;
    }

    public static readonly LEAVE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h before you can JOIN another clan (creating is allowed)

    /** Seconds left on a user's post-leave clan cooldown (0 if none). */
    public clanCooldownSeconds(user: UserDocument): number {
        const until = user.clanCooldownUntil ? user.clanCooldownUntil.getTime() : 0;
        return Math.max(0, Math.ceil((until - Date.now()) / 1000));
    }

    /** Leader kicks `username` out of the clan. Leader-only, can't kick self / non-members. Returns the
     *  kicked user (clanId cleared) or null. */
    public async kickMember(leader: UserDocument, username: string): Promise<UserDocument | null> {
        if (!leader.clanId) return null;
        const clan = await this.getClanById(leader.clanId);
        if (!clan || !this.memberHasPermission(clan, leader._id, ClanPermissionFlag.KICK)) return null; // needs "kick"
        const target = await User.findOne({ login: username.trim().toLowerCase() }).exec();
        if (!target || String(target._id) === String(leader._id)) return null; // not self
        if (!clan.members.some((id) => String(id) === String(target._id))) return null; // must be a member
        if (!outranks(this.getPosition(clan, leader._id), this.getPosition(clan, target._id))) return null; // must outrank target
        clan.members = clan.members.filter((id) => String(id) !== String(target._id)) as any;
        clan.positions.delete(String(target._id));
        clan.memberSince.delete(String(target._id));
        await clan.save();
        target.clanId = null;
        await target.save();
        logger.info(`${leader.username} kicked ${target.username} from clan [${clan.tag}].`);
        return target;
    }

    /** Changes a member's clan position ("cargo"). The actor needs CHANGE_POSITION and must strictly outrank
     *  BOTH the target's current position AND the new one (can't touch a peer/superior, can't promote to
     *  own rank or above). Can't target the Supreme Commander, can't target self, can't assign Supreme.
     *  Returns { clan, target, position } or null. */
    public async changeMemberPosition(actor: UserDocument, username: string, newPosition: number): Promise<{ clan: ClanDocument; target: UserDocument; position: ClanPosition } | null> {
        if (!actor.clanId) return null;
        if (!isValidPosition(newPosition) || newPosition === ClanPosition.SUPREME_COMMANDER) return null; // assigning Supreme = ownership transfer, not this action
        const clan = await this.getClanById(actor.clanId);
        if (!clan || !this.memberHasPermission(clan, actor._id, ClanPermissionFlag.CHANGE_POSITION)) return null; // needs "change position"
        const target = await User.findOne({ login: username.trim().toLowerCase() }).exec();
        if (!target || String(target._id) === String(actor._id)) return null; // not self
        if (!clan.members.some((id) => String(id) === String(target._id))) return null; // must be a member
        const actorPos = this.getPosition(clan, actor._id);
        const targetPos = this.getPosition(clan, target._id);
        if (targetPos === ClanPosition.SUPREME_COMMANDER) return null; // can't touch the owner
        if (!outranks(actorPos, targetPos) || !outranks(actorPos, newPosition)) return null; // must outrank current & new
        if (targetPos === newPosition) return { clan, target, position: newPosition }; // no-op
        clan.positions.set(String(target._id), newPosition);
        await clan.save();
        logger.info(`${actor.username} set ${target.username}'s position to ${ClanPosition[newPosition]} in clan [${clan.tag}].`);
        return { clan, target, position: newPosition };
    }

    /** Stores an uploaded clan logo image and points `clan.logo` at its served path (cache-busted by version).
     *  Requires the EDIT_SETTINGS permission (same gate as description/minRank/recruiting). Returns the clan. */
    public async setClanLogo(owner: UserDocument, image: Buffer): Promise<ClanDocument | null> {
        if (!owner.clanId || !image.length) return null;
        const clan = await this.getClanById(owner.clanId);
        if (!clan || !this.memberHasPermission(clan, owner._id, ClanPermissionFlag.EDIT_SETTINGS)) return null; // needs "edit settings"
        clan.logo = saveClanLogo(String(clan._id), image);
        await clan.save();
        logger.info(`${owner.username} updated clan [${clan.tag}] logo (${image.length} bytes) -> ${clan.logo}.`);
        return clan;
    }

    /** `user` leaves their clan. A non-leader is just removed; a leader hands off to another member, or
     *  the clan is deleted if they were the last one. Sets the 24h cooldown. Returns details or null. */
    public async leaveClan(user: UserDocument): Promise<{ clan: ClanDocument; wasLeader: boolean; disbanded: boolean } | null> {
        if (!user.clanId) return null;
        const clan = await this.getClanById(user.clanId);
        if (!clan) return null;
        const wasLeader = String(clan.leaderId) === String(user._id);
        clan.members = clan.members.filter((id) => String(id) !== String(user._id)) as any;
        clan.positions.delete(String(user._id));
        clan.memberSince.delete(String(user._id));
        let disbanded = false;
        if (wasLeader) {
            if (clan.members.length > 0) {
                clan.leaderId = clan.members[0] as any; // promote the next member
                clan.positions.set(String(clan.members[0]), ClanPosition.SUPREME_COMMANDER); // new owner
                await clan.save();
            } else {
                await Clan.deleteOne({ _id: clan._id }).exec();
                disbanded = true;
            }
        } else {
            await clan.save();
        }
        user.clanId = null;
        user.clanCooldownUntil = new Date(Date.now() + ClanService.LEAVE_COOLDOWN_MS);
        await user.save();
        logger.info(`${user.username} left clan [${clan.tag}]${disbanded ? " (disbanded)" : wasLeader ? " (leadership transferred)" : ""}.`);
        return { clan, wasLeader, disbanded };
    }

    /** STAFF moderation (/clan kick): removes a user from whatever clan they're in, bypassing the clan's
     *  own permission checks. Refuses the leader ("leader" sentinel) — disband or let them transfer instead. */
    public async staffRemoveMember(username: string): Promise<{ clan: ClanDocument; target: UserDocument } | "leader" | null> {
        const target = await User.findOne({ login: username.trim().toLowerCase() }).exec();
        if (!target?.clanId) return null;
        const clan = await this.getClanById(target.clanId);
        if (!clan) {
            target.clanId = null;
            await target.save();
            return null;
        }
        if (String(clan.leaderId) === String(target._id)) return "leader";
        clan.members = clan.members.filter((id) => String(id) !== String(target._id)) as any;
        clan.positions.delete(String(target._id));
        clan.memberSince.delete(String(target._id));
        await clan.save();
        target.clanId = null;
        await target.save();
        logger.info(`[staff] ${target.username} removed from clan [${clan.tag}].`);
        return { clan, target };
    }

    /** STAFF moderation (/clan disband): deletes a clan by tag, clearing every member's clanId. Returns
     *  the affected members so the caller can notify the online ones. */
    public async staffDisbandClan(tag: string): Promise<{ tag: string; members: UserDocument[] } | null> {
        const clan = await this.getClanByTag(tag);
        if (!clan) return null;
        const members = await this.getMembers(clan);
        for (const m of members) {
            m.clanId = null;
            await m.save();
        }
        await Clan.deleteOne({ _id: clan._id }).exec();
        logger.info(`[staff] clan [${clan.tag}] disbanded (${members.length} member(s) released).`);
        return { tag: clan.tag, members };
    }

    /** Seconds a member has been in the clan (since their join, or the clan's creation for legacy members
     *  that predate per-member join tracking). Drives the member-list "time in clan" display. */
    private secondsInClan(clan: ClanDocument, memberId: unknown): number {
        const joined = clan.memberSince?.get(String(memberId)) ?? clan.createdAt ?? new Date();
        return Math.max(0, Math.floor((Date.now() - new Date(joined).getTime()) / 1000));
    }

    /** The clan tag to show next to a user's nickname, or null if they're not in a clan. */
    public async getTagForUser(user: UserDocument): Promise<string | null> {
        if (!user.clanId) return null;
        const clan = await this.getClanById(user.clanId);
        return clan ? clan.tag : null;
    }

    public async memberCount(clan: ClanDocument): Promise<number> {
        return clan.members.length;
    }

    public getMembers(clan: ClanDocument): Promise<UserDocument[]> {
        // Includes experience/lastLogin/createdAt/stats so the member panel can show real score, last-online
        // and the per-member kills/deaths/mines pulled from the long-term stats (see buildMemberView).
        return User.find({ _id: { $in: clan.members } }, "username rank crystals experience lastLogin createdAt stats").exec();
    }

    /** The clan leader's display username (to notify the owner's online client). */
    public async getLeaderUsername(clan: ClanDocument): Promise<string | null> {
        const leader = await User.findById(clan.leaderId as any, "username").exec();
        return leader ? leader.username : null;
    }

    /** Usernames of users with a pending join request to the clan (shown in the owner's my-clan window). */
    public async getJoinRequestNicks(clan: ClanDocument): Promise<string[]> {
        if (!clan.joinRequests.length) return [];
        const users = await User.find({ _id: { $in: clan.joinRequests } }, "username").exec();
        return users.map((u) => u.username);
    }

    /** Usernames the clan has a pending INVITE out to (shown as "sent invites" in the my-clan window). */
    public async getInviteNicks(clan: ClanDocument): Promise<string[]> {
        if (!clan.invites.length) return [];
        const users = await User.find({ _id: { $in: clan.invites } }, "username").exec();
        return users.map((u) => u.username);
    }

    /** Owner accepts a pending join request → the requester joins the clan. Leader-only. Returns
     *  { clan, requester } or null (requester gone / already in a clan / never requested). */
    public async acceptJoinRequest(leader: UserDocument, username: string): Promise<{ clan: ClanDocument; requester: UserDocument } | null> {
        if (!leader.clanId) return null;
        const clan = await this.getClanById(leader.clanId);
        if (!clan || !this.memberHasPermission(clan, leader._id, ClanPermissionFlag.MANAGE_REQUESTS)) return null; // needs "manage requests"
        const requester = await User.findOne({ login: username.trim().toLowerCase() }).exec();
        if (!requester || requester.clanId) return null;
        if (!clan.joinRequests.some((id) => String(id) === String(requester._id))) return null; // must have requested
        clan.joinRequests = clan.joinRequests.filter((id) => String(id) !== String(requester._id)) as any;
        if (!clan.members.some((id) => String(id) === String(requester._id))) clan.members.push(requester._id as any);
        clan.positions.set(String(requester._id), ClanPosition.NOVICE);
        clan.memberSince.set(String(requester._id), new Date());
        await clan.save();
        requester.clanId = clan._id as any;
        await requester.save();
        logger.info(`${leader.username} accepted ${requester.username} into clan [${clan.tag}].`);
        return { clan, requester };
    }

    /** Owner declines ALL pending join requests. Leader-only. Returns { tag, nicks of removed requesters }. */
    public async declineAllJoinRequests(leader: UserDocument): Promise<{ tag: string; nicks: string[] } | null> {
        if (!leader.clanId) return null;
        const clan = await this.getClanById(leader.clanId);
        if (!clan || !this.memberHasPermission(clan, leader._id, ClanPermissionFlag.MANAGE_REQUESTS)) return null;
        const nicks = await this.getJoinRequestNicks(clan);
        if (clan.joinRequests.length) {
            clan.joinRequests = [] as any;
            await clan.save();
            logger.info(`${leader.username} declined all ${nicks.length} join requests for clan [${clan.tag}].`);
        }
        return { tag: clan.tag, nicks };
    }

    /** Owner declines a pending join request (by requester username). Returns { nick, tag } or null. */
    public async declineJoinRequest(owner: UserDocument, username: string): Promise<{ nick: string; tag: string } | null> {
        if (!owner.clanId) return null;
        const clan = await this.getClanById(owner.clanId);
        if (!clan || !this.memberHasPermission(clan, owner._id, ClanPermissionFlag.MANAGE_REQUESTS)) return null; // needs "manage requests"
        const requester = await User.findOne({ login: username.trim().toLowerCase() }, "username").exec();
        if (!requester) return null;
        const before = clan.joinRequests.length;
        clan.joinRequests = clan.joinRequests.filter((id) => String(id) !== String(requester._id)) as any;
        if (clan.joinRequests.length !== before) {
            await clan.save();
            logger.info(`${owner.username} declined ${requester.username}'s request to join clan [${clan.tag}].`);
        }
        return { nick: requester.username, tag: clan.tag };
    }

    /** Builds the wire view of a clan (for ShowForeignClanWindow). Stats default to 0 for now. */
    public async buildClanView(clan: ClanDocument): Promise<ClanView> {
        const members = await this.getMembers(clan);
        const leader = members.find((m) => String(m._id) === String(clan.leaderId));
        // Leader first, then the rest (the client renders the member list in this order).
        members.sort((a, b) => (String(a._id) === String(clan.leaderId) ? -1 : String(b._id) === String(clan.leaderId) ? 1 : 0));
        return {
            // The client reads the clan "id" Long as the creation timestamp (ms) to show the founding date.
            clanId: msToLong((clan.createdAt ?? new Date()).getTime()),
            leader: leader ? leader.username : (members[0]?.username ?? ""),
            description: clan.description ?? "",
            name: clan.name,
            tag: clan.tag,
            rating: Math.round(clan.rating ?? 0), // stored as float (per-delta contribution points), rounded for the wire
            logo: clan.logo || null,
            recruiting: clan.recruiting ?? true,
            minRank: clan.minRank ?? -1,
            joinRequests: await this.getJoinRequestNicks(clan),
            sentInvites: await this.getInviteNicks(clan),
            members: members.map((m) => this.buildMemberView(clan, m)),
        };
    }

    /** The 10-field member model (row) for a clan member — shared by the panel and the live member-update
     *  broadcast. `permission` = the member's stored clan position; `field1` = seconds in the clan. */
    public buildMemberView(clan: ClanDocument, m: UserDocument): ClanMemberView {
        // kills/deaths/minesUsed come from the player's long-term stats (the client sums them across members
        // into CLAN_TANKS_DESTROYED / CLAN_TANKS_LOST / CLAN_USED_MINES + a K/D ratio). `score` = the
        // member's XP (personal score column). clanScore/weeklyClanScore are per-clan contribution columns
        // we don't track yet, so they stay 0.
        const counters = (m.stats as { counters?: Map<string, number> } | undefined)?.counters;
        const stat = (key: string): number => counters?.get(key) ?? 0;
        const uid = String(m._id);
        return {
            lastOnlineDate: msToLong((m.lastLogin ?? m.createdAt ?? new Date()).getTime()), // member's last login (ms Long)
            nick: m.username,
            deaths: stat("deaths"),
            kills: stat("kills"),
            score: m.experience ?? 0,
            clanScore: Math.round(clan.clanScore?.get(uid) ?? 0), // lifetime clan-mission contribution points (stored as float, rounded for the wire)
            weeklyClanScore: Math.round(clan.weeklyClanScore?.get(uid) ?? 0), // this week's contribution points
            permission: this.getPosition(clan, m._id),
            secondsInClan: this.secondsInClan(clan, m._id),
            minesUsed: stat("mines_used"),
        };
    }

    // ---- Clan missions (daily collective goals — see clan.missions.data) ----

    /** Builds the fresh daily mission set (stable ids within a UTC day so concurrent regens agree). */
    private generateMissions(): IClanMission[] {
        const base = Math.floor(Date.now() / 86_400_000) * 10; // day number × 10 → unique, int32-safe ids
        return CLAN_MISSION_TEMPLATES.map((t, i) => ({
            id: base + i,
            icon: ResourceManager.getIdlowById(t.iconResource), // resolve the named icon → its wire idLow
            metricKey: t.metricKey,
            criteria: t.criteria,
            progress: 0,
            completed: false,
        }));
    }

    /** Regenerates the daily mission set and/or resets weeklyClanScore if their windows have passed. Uses
     *  targeted $set (never a full-doc save) so it can't clobber concurrent contribution $inc's, then returns
     *  the authoritative clan. Called on opening the missions window. */
    public async ensureMissions(clan: ClanDocument): Promise<ClanDocument> {
        const now = Date.now();
        const regen = !clan.missions?.length || !clan.missionResetAt || now >= clan.missionResetAt.getTime();
        const weekly = !clan.weeklyResetAt || now >= clan.weeklyResetAt.getTime();
        if (!regen && !weekly) return clan;
        const set: Record<string, unknown> = {};
        if (regen) { set.missions = this.generateMissions(); set.missionResetAt = nextDailyReset(); }
        if (weekly) { set.weeklyClanScore = {}; set.weeklyResetAt = nextWeeklyReset(); }
        try {
            await Clan.updateOne({ _id: clan._id }, { $set: set });
        } catch (error: any) {
            // Never let a mission-refresh DB error bubble up (the packet dispatcher closes the connection on
            // a thrown handler). Fall back to the in-memory regen so the window still populates.
            logger.error(`[clan-missions] ensureMissions update failed for [${clan.tag}]`, { error: error.message });
            if (regen) { clan.missions = this.generateMissions() as any; clan.missionResetAt = nextDailyReset(); }
            return clan;
        }
        return (await this.getClanById(clan._id)) ?? clan;
    }

    /** Wire views for the mission window (progress clamped to target; shared countdown to the daily reset). */
    public buildMissionViews(clan: ClanDocument): ClanMissionView[] {
        const secondsToReset = clan.missionResetAt
            ? Math.max(0, Math.floor((clan.missionResetAt.getTime() - Date.now()) / 1000))
            : 0;
        return (clan.missions ?? []).map((m) => {
            const t = CLAN_MISSION_TEMPLATES.find((x) => x.metricKey === m.metricKey);
            return {
                id: m.id,
                // Resolve the icon fresh from the template (not the stored m.icon), so missions saved before
                // the icon fix still send a valid, preloaded resource id.
                icon: t ? ResourceManager.getIdlowById(t.iconResource) : m.icon,
                description: t?.description ?? m.metricKey,
                prizes: (t?.prizes ?? []).map((p) => ({ count: p.count, name: p.name })),
                criteria: m.criteria,
                progress: Math.min(m.progress, m.criteria),
                secondsToReset,
                completed: m.completed,
            };
        });
    }

    /**
     * Applies one member's per-round battle contribution to their clan's missions: advances each matching
     * active mission (atomic $inc, guarded on `completed:false`), credits the member's clan/weekly score +
     * the clan rating by the normalised points (round(applied/criteria × MISSION_POINTS)), and on any mission
     * reaching its target flips it complete (once, via an atomic guard) and auto-grants the prize to ALL
     * members. Fire-and-forget from the round-flush sites; the clan doc is shared, so this only uses atomic
     * updates (never a full save).
     */
    public async applyRoundContribution(user: UserDocument, contribution: IClanMissionContribution, server: GameServer): Promise<void> {
        if (!user.clanId) return;
        const clan = await this.getClanById(user.clanId);
        if (!clan || !clan.missions?.length || !clan.missionResetAt) return;
        if (Date.now() >= clan.missionResetAt.getTime()) return; // stale set — regenerates on next window open
        const uid = String(user._id);
        const byMetric: Record<string, number> = {
            kills: contribution.kills,
            battleScore: contribution.battleScore,
            crystals: contribution.crystals,
            goldBox: contribution.goldBox,
        };

        let memberPoints = 0;
        for (const m of clan.missions) {
            if (m.completed) continue;
            const delta = byMetric[m.metricKey] ?? 0;
            const applied = Math.min(delta, Math.max(0, m.criteria - m.progress));
            if (applied <= 0) continue;
            await Clan.updateOne(
                { _id: clan._id, missions: { $elemMatch: { id: m.id, completed: false } } },
                { $inc: { "missions.$.progress": applied } }
            );
            // Kept as a FLOAT (rounded only at the wire — buildMemberView / buildClanView). Contribution now
            // arrives in small per-death deltas; rounding each one would floor sub-point deltas to 0 and lose
            // almost all the score. Float accumulation is exact: Σ(appliedᵢ/criteria) == (Σappliedᵢ)/criteria.
            memberPoints += (applied / m.criteria) * MISSION_POINTS;
        }
        if (memberPoints > 0) {
            await Clan.updateOne(
                { _id: clan._id },
                { $inc: { [`clanScore.${uid}`]: memberPoints, [`weeklyClanScore.${uid}`]: memberPoints, rating: memberPoints } }
            );
        }

        // Detect newly-completed missions from a fresh read; the update that flips `completed` wins the race
        // and grants the prize exactly once.
        const fresh = await this.getClanById(clan._id);
        if (!fresh) return;
        for (const m of fresh.missions) {
            if (m.completed || m.progress < m.criteria) continue;
            const res = await Clan.updateOne(
                { _id: clan._id, missions: { $elemMatch: { id: m.id, completed: false } } },
                { $set: { "missions.$.completed": true } }
            );
            if (res.modifiedCount > 0) {
                const t = CLAN_MISSION_TEMPLATES.find((x) => x.metricKey === m.metricKey);
                if (t) await this.grantClanPrizes(fresh, t, server);
            }
        }
    }

    /** Auto-claim: grants a completed mission's prizes to EVERY current member (persisted via $inc), and
     *  live-refreshes online members (crystal balance + in-memory supply counts). */
    private async grantClanPrizes(clan: ClanDocument, template: IClanMissionTemplate, server: GameServer): Promise<void> {
        for (const p of template.prizes) {
            const field = p.item === "crystals" ? "crystals" : `supplies.${p.item}`;
            await User.updateMany({ _id: { $in: clan.members } }, { $inc: { [field]: p.count } });
        }
        const memberIds = new Set(clan.members.map((id) => String(id)));
        for (const client of server.getClients()) {
            if (!client.user || !memberIds.has(String(client.user._id))) continue;
            for (const p of template.prizes) {
                if (p.item === "crystals") {
                    client.user.crystals += p.count;
                    client.sendPacket(new UpdateCrystals(client.user.crystals));
                } else {
                    client.user.supplies.set(p.item, (client.user.supplies.get(p.item) ?? 0) + p.count);
                }
            }
        }
        logger.info(`Clan [${clan.tag}] completed mission "${template.description}" — prizes granted to ${clan.members.length} members.`);
    }
}
