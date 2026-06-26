import User, { UserDocument } from "@/shared/models/user.model";
import logger from "@/utils/logger";
import { ClanView } from "./clan.packets";
import Clan, { ClanDocument } from "./clan.model";

/** A Mongo ObjectId (12 bytes) compressed into a stable 8-byte Long for the member wire id. */
function objectIdToLong(id: unknown): Buffer {
    const hex = String(id).padEnd(24, "0").slice(0, 24);
    return Buffer.from(hex.slice(0, 16), "hex"); // first 8 bytes
}

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
            rating: 0,
        });

        user.crystals -= CLAN_CREATION_COST;
        user.clanId = clan._id as any;
        await user.save();

        logger.info(`Clan "${cleanName}" [${cleanTag}] created by ${user.username}.`);
        return clan;
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
        if (!clan || String(clan.leaderId) !== String(leader._id)) return null; // only the leader invites (for now)
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
        if (!clan || String(clan.leaderId) !== String(leader._id)) return null;
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
        if (!clan || String(clan.leaderId) !== String(owner._id)) return null; // only the leader edits
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
        if (!clan || String(clan.leaderId) !== String(leader._id)) return null; // leader only
        const target = await User.findOne({ login: username.trim().toLowerCase() }).exec();
        if (!target || String(target._id) === String(leader._id)) return null; // not self
        if (!clan.members.some((id) => String(id) === String(target._id))) return null; // must be a member
        clan.members = clan.members.filter((id) => String(id) !== String(target._id)) as any;
        await clan.save();
        target.clanId = null;
        await target.save();
        logger.info(`${leader.username} kicked ${target.username} from clan [${clan.tag}].`);
        return target;
    }

    /** `user` leaves their clan. A non-leader is just removed; a leader hands off to another member, or
     *  the clan is deleted if they were the last one. Sets the 24h cooldown. Returns details or null. */
    public async leaveClan(user: UserDocument): Promise<{ clan: ClanDocument; wasLeader: boolean; disbanded: boolean } | null> {
        if (!user.clanId) return null;
        const clan = await this.getClanById(user.clanId);
        if (!clan) return null;
        const wasLeader = String(clan.leaderId) === String(user._id);
        clan.members = clan.members.filter((id) => String(id) !== String(user._id)) as any;
        let disbanded = false;
        if (wasLeader) {
            if (clan.members.length > 0) {
                clan.leaderId = clan.members[0] as any; // promote the next member
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
        return User.find({ _id: { $in: clan.members } }, "username rank crystals").exec();
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

    /** Owner accepts a pending join request → the requester joins the clan. Leader-only. Returns
     *  { clan, requester } or null (requester gone / already in a clan / never requested). */
    public async acceptJoinRequest(leader: UserDocument, username: string): Promise<{ clan: ClanDocument; requester: UserDocument } | null> {
        if (!leader.clanId) return null;
        const clan = await this.getClanById(leader.clanId);
        if (!clan || String(clan.leaderId) !== String(leader._id)) return null; // leader only
        const requester = await User.findOne({ login: username.trim().toLowerCase() }).exec();
        if (!requester || requester.clanId) return null;
        if (!clan.joinRequests.some((id) => String(id) === String(requester._id))) return null; // must have requested
        clan.joinRequests = clan.joinRequests.filter((id) => String(id) !== String(requester._id)) as any;
        if (!clan.members.some((id) => String(id) === String(requester._id))) clan.members.push(requester._id as any);
        await clan.save();
        requester.clanId = clan._id as any;
        await requester.save();
        logger.info(`${leader.username} accepted ${requester.username} into clan [${clan.tag}].`);
        return { clan, requester };
    }

    /** Owner declines a pending join request (by requester username). Returns { nick, tag } or null. */
    public async declineJoinRequest(owner: UserDocument, username: string): Promise<{ nick: string; tag: string } | null> {
        if (!owner.clanId) return null;
        const clan = await this.getClanById(owner.clanId);
        if (!clan || String(clan.leaderId) !== String(owner._id)) return null; // only the leader (for now)
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
            logo: null,
            recruiting: clan.recruiting ?? true,
            minRank: clan.minRank ?? -1,
            joinRequests: await this.getJoinRequestNicks(clan),
            members: members.map((m) => ({
                userId: objectIdToLong(m._id),
                nick: m.username,
                deaths: 0, kills: 0, score: 0, clanScore: 0, weeklyClanScore: 0,
                permission: String(m._id) === String(clan.leaderId) ? 0 : 6, // 0 = leader, 6 = recruit (official default)
                field1: 0, field8: 0,
            })),
        };
    }
}
