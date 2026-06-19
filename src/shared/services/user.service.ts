import Invite from "@/features/invite/invite.model";
import User, { UserDocument } from "@/shared/models/user.model";
import { RankService } from "@/shared/services/rank.service";
import logger from "@/utils/logger";
import crypto from "crypto";

export interface UserCreationAttributes {
    username: string;
    password: string;
    email?: string | null;
    crystals?: number;
    experience?: number;
}

export class UserService {
    private rankService: RankService;

    constructor(rankService: RankService) {
        this.rankService = rankService;
    }

    public async findUserByLoginToken(token: string): Promise<UserDocument | null> {
        if (!token) return null;
        try {
            return await User.findOne({ loginToken: token });
        } catch (error) {
            logger.error(`Error finding user by login token`, { error });
            throw error;
        }
    }

    public async generateAndSetLoginToken(user: UserDocument): Promise<string> {
        try {
            const token = crypto.randomBytes(16).toString("hex");
            user.loginToken = token;
            await user.save();
            logger.info(`Generated new login token for user ${user.username}`);
            return token;
        } catch (error) {
            logger.error(`Error generating login token for user ${user.username}`, { error });
            throw error;
        }
    }

    public async findUserByUsername(username: string): Promise<UserDocument | null> {
        try {
            // `login` is the lowercase, indexed key — an equality lookup that is case-insensitive by
            // construction (no collection-scanning case-insensitive regex).
            return await User.findOne({ login: username.toLowerCase() });
        } catch (error) {
            logger.error(`Error finding user by username ${username}`, { error });
            throw error;
        }
    }

    public async findUserByEmail(email: string): Promise<UserDocument | null> {
        try {
            return await User.findOne({ email: email.toLowerCase() });
        } catch (error) {
            logger.error(`Error finding user by email ${email}`, { error });
            throw error;
        }
    }

    public async isEmailInUse(email: string, userIdToExclude?: string): Promise<boolean> {
        try {
            const query: any = { email: email.toLowerCase() };
            if (userIdToExclude) {
                query._id = { $ne: userIdToExclude };
            }
            const user = await User.findOne(query);
            return !!user;
        } catch (error) {
            logger.error(`Error checking if email is in use: ${email}`, { error });
            throw error;
        }
    }

    public async isUsernameAvailable(username: string): Promise<boolean> {
        try {
            const user = await User.findOne({ login: username.toLowerCase() });
            return !user;
        } catch (error) {
            logger.error(`Error checking username availability for ${username}`, { error });
            throw error;
        }
    }

    public async generateUsernameSuggestions(baseUsername: string): Promise<string[]> {
        const suggestions: string[] = [];
        const MAX_SUGGESTIONS = 5;

        for (let i = 1; suggestions.length < MAX_SUGGESTIONS; i++) {
            const suffix = Math.floor(Math.random() * 100) + i;
            const newName = `${baseUsername}${suffix}`;

            if (newName.length > 20) continue;

            const isAvailable = await this.isUsernameAvailable(newName);
            if (isAvailable) {
                suggestions.push(newName);
            }

            if (i > 20) break;
        }
        return suggestions;
    }

    public async createUser(attributes: UserCreationAttributes): Promise<UserDocument> {
        try {
            const isUsernameTaken = !(await this.isUsernameAvailable(attributes.username));
            if (isUsernameTaken) {
                throw new Error(`Username ${attributes.username} already exists`);
            }

            if (attributes.email) {
                const isEmailTaken = await this.isEmailInUse(attributes.email);
                if (isEmailTaken) {
                    throw new Error(`Email ${attributes.email} already exists`);
                }
            }

            const initialRankData = this.rankService.getInitialRankData();

            const user = new User({
                username: attributes.username,
                password: attributes.password,
                email: attributes.email,
                emailConfirmed: false,
                crystals: attributes.crystals,
                experience: attributes.experience ?? initialRankData.score,
                rank: initialRankData.rank,
                nextRankScore: initialRankData.nextRankScore,
                isActive: true,
                referralHash: crypto.randomBytes(16).toString("hex"),
            });

            return await user.save();
        } catch (error) {
            logger.error(`Error creating user ${attributes.username}`, { error });
            throw error;
        }
    }

    public async login(username: string, password: string, inviteCode: string | null): Promise<UserDocument> {
        try {
            const user = await this.findUserByUsername(username);

            if (!user) {
                throw new Error("Invalid username or password");
            }
            if (!user.isActive) {
                throw new Error("Account is deactivated");
            }

            await new Promise<void>((resolve, reject) => {
                user.verifyPassword(password, (err, isMatch) => {
                    if (err) return reject(err);
                    if (!isMatch) return reject(new Error("Invalid username or password"));
                    resolve();
                });
            });

            user.lastLogin = new Date();

            if (inviteCode) {
                const invite = await Invite.findOne({ code: inviteCode });
                if (!invite) {
                    throw new Error("Invalid invite code");
                }
                if (invite.userId) {
                    throw new Error("Invite code already used");
                }
                invite.userId = user._id as any;
                invite.player = username;
                await invite.save();
            }

            return await user.save();
        } catch (error) {
            logger.error(`Error during login for user ${username}`, { error });
            throw error;
        }
    }

    public async punishUser(username: string, durationMs: number, reason: string | null): Promise<UserDocument> {
        const user = await this.findUserByUsername(username);
        if (!user) {
            throw new Error(`User ${username} not found.`);
        }

        user.isPunished = true;
        user.punishmentExpiresAt = new Date(Date.now() + durationMs);
        user.punishmentReason = reason;

        await user.save();
        logger.info(`User ${username} has been punished`, {
            reason,
            expiresAt: user.punishmentExpiresAt,
        });

        return user;
    }

    public async updateResources(userId: string, updates: { crystals?: number; experience?: number }): Promise<UserDocument> {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error("User not found");
        }

        if (updates.crystals !== undefined) {
            user.crystals = updates.crystals;
        }
        if (updates.experience !== undefined) {
            user.experience = updates.experience;
            this.rankService.updateRank(user);
        }

        return await user.save();
    }
}