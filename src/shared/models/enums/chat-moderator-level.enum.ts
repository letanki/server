export enum ChatModeratorLevel {
    NONE = 0,
    COMMUNITY_MANAGER = 1,
    ADMINISTRATOR = 2,
    MODERATOR = 3,
    CANDIDATE = 4,
}

/**
 * The client uses these values as role TAGS (badge/colour), and among staff a LOWER number means a
 * HIGHER rank (COMMUNITY_MANAGER > ADMINISTRATOR > MODERATOR > CANDIDATE) — except NONE=0, which is a
 * regular user with no power. A plain numeric compare therefore can't gate commands. This maps each
 * role to an ordinal "power" where a regular user is the lowest (0) and COMMUNITY_MANAGER is the
 * highest. Permission checks compare power, not the raw enum value.
 */
const CHAT_MODERATOR_POWER: Record<ChatModeratorLevel, number> = {
    [ChatModeratorLevel.NONE]: 0,
    [ChatModeratorLevel.CANDIDATE]: 1,
    [ChatModeratorLevel.MODERATOR]: 2,
    [ChatModeratorLevel.ADMINISTRATOR]: 3,
    [ChatModeratorLevel.COMMUNITY_MANAGER]: 4,
};

/** Ordinal power of a role: higher = more privileged. Regular users (NONE) are 0. */
export function chatModeratorPower(level: ChatModeratorLevel): number {
    return CHAT_MODERATOR_POWER[level] ?? 0;
}

/** True if `userLevel` is allowed to use something requiring at least `requiredLevel`. */
export function hasModeratorPower(userLevel: ChatModeratorLevel, requiredLevel: ChatModeratorLevel): boolean {
    return chatModeratorPower(userLevel) >= chatModeratorPower(requiredLevel);
}