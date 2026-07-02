import User, { UserDocument } from "@/shared/models/user.model";
import logger from "@/utils/logger";
import { ClanView, ClanMemberView } from "./clan.packets";
import Clan, { ClanDocument } from "./clan.model";
import { ClanPermissionFlag, ClanPosition, isValidPosition, outranks, positionHasPermission } from "./clan.roles";
import { saveClanLogo } from "./clan.logo";

/** The clan wire "id" is the creation time in MILLISECONDS (the client derives the founding date from it). */
function msToLong(ms: number): Buffer {
    const b = Buffer.alloc(8);
    b.writeBigInt64BE(BigInt(Math.floor(ms)));
    return b;
}

export const CLAN_CREATION_COST = 500000; // crystals to found a clan (matches InitUserClanModels)

export class ClanService {
    /** Founds a new clan led by `user`, charging the creation cost. Throws on validation failure. */
    public async createClan(user: UserDocument, name: string, tag: string, description: string): Promise<ClanDocument> {
        if (user.clanId) throw new Error("Você já está em um clã.");
        if (this.clanCooldownSeconds(user) > 0) throw new Error("Você precisa esperar antes de entrar em outro clã.");
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

    public static readonly LEAVE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h before you can create/join again

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
            rating: clan.rating ?? 0,
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
        return {
            lastOnlineDate: msToLong((m.lastLogin ?? m.createdAt ?? new Date()).getTime()), // member's last login (ms Long)
            nick: m.username,
            deaths: stat("deaths"),
            kills: stat("kills"),
            score: m.experience ?? 0,
            clanScore: 0,
            weeklyClanScore: 0,
            permission: this.getPosition(clan, m._id),
            secondsInClan: this.secondsInClan(clan, m._id),
            minesUsed: stat("mines_used"),
        };
    }
}
