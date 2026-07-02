/**
 * Clan positions ("cargos") + permission flags, decoded from the official capture (see memory clan-roles).
 * Two enums travel the wire as a single int32 each:
 *  - ClanPosition (client CodecClanPermission): the rank/cargo, 0 (highest) .. 6 (lowest).
 *  - ClanPermissionFlag: individual rights (0..7). The server sends a member the SET of flags for their
 *    position (SetClanPermissionsPacket); the client gates its UI on it, and we enforce it server-side.
 */

export enum ClanPosition {
    SUPREME_COMMANDER = 0, // founder/owner
    COMMANDER = 1,
    OFFICER = 2,
    SERGEANT = 3,
    VETERAN = 4,
    PRIVATE = 5,
    NOVICE = 6, // default for a newly joined member
}

/** Localization keys the client uses per position (for reference / any name lookups). */
export const CLAN_POSITION_KEY: Record<ClanPosition, string> = {
    [ClanPosition.SUPREME_COMMANDER]: "CLAN_POSITION_SUPREME_COMMANDER",
    [ClanPosition.COMMANDER]: "CLAN_POSITION_COMMANDER",
    [ClanPosition.OFFICER]: "CLAN_POSITION_OFFICER",
    [ClanPosition.SERGEANT]: "CLAN_POSITION_SERGEANT",
    [ClanPosition.VETERAN]: "CLAN_POSITION_VETERAN",
    [ClanPosition.PRIVATE]: "CLAN_POSITION_PRIVATE",
    [ClanPosition.NOVICE]: "CLAN_POSITION_NOVICE",
};

/** Individual permission flags (action → flag mapping from the client UI gates; see memory clan-roles). */
export enum ClanPermissionFlag {
    SUPREME = 0, // supreme-commander only (transfer/disband) — not a normal action
    CHANGE_POSITION = 1, // promote/demote a member's cargo
    KICK = 2, // remove a member
    MANAGE_REQUESTS = 3, // accept/decline join requests
    OFFICER_MISC = 4, // officer-level (unmapped in client UI); kept for exact set parity
    MEMBER = 5, // base member (view/chat)
    INVITE = 6, // invite players
    EDIT_SETTINGS = 7, // edit clan profile: description / minRank / recruiting / logo
}

/**
 * Position → exact permission-flag set, EMPIRICAL from the capture (SetClanPermissionsPacket the official
 * server sent to Giovana at each position). Supreme=all and Novice={} are inferred. Note Sergeant==Veteran
 * (same flags; the rank difference is cosmetic) — matched to the wire on purpose.
 */
const POSITION_PERMISSIONS: Record<ClanPosition, ClanPermissionFlag[]> = {
    [ClanPosition.SUPREME_COMMANDER]: [0, 1, 2, 3, 4, 5, 6, 7],
    [ClanPosition.COMMANDER]: [1, 2, 3, 4, 5, 6, 7],
    [ClanPosition.OFFICER]: [1, 2, 3, 4, 5, 6],
    [ClanPosition.SERGEANT]: [5, 6],
    [ClanPosition.VETERAN]: [5, 6],
    [ClanPosition.PRIVATE]: [5],
    [ClanPosition.NOVICE]: [],
};

/** The permission-flag values granted by a position (as sent in SetClanPermissionsPacket). */
export function positionPermissions(position: ClanPosition): number[] {
    return POSITION_PERMISSIONS[position] ?? [];
}

/** Whether a position grants a given permission flag. */
export function positionHasPermission(position: ClanPosition, flag: ClanPermissionFlag): boolean {
    return (POSITION_PERMISSIONS[position] ?? []).includes(flag);
}

/** True if `actor` outranks `target` (strictly higher rank = strictly lower numeric value). Kicking and
 *  changing a member's position both require the actor to outrank the target (and hold the flag). */
export function outranks(actor: ClanPosition, target: ClanPosition): boolean {
    return actor < target;
}

export const isValidPosition = (v: number): v is ClanPosition => Number.isInteger(v) && v >= 0 && v <= 6;
