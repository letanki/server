import fs from "fs";
import path from "path";

/**
 * Uploaded clan logos live here (persisted; served by ResourceServer at CLAN_LOGO_ROUTE). Kept OUTSIDE
 * `.resource/` so `build:resources` never wipes them. The stored path (returned by saveClanLogo) goes into
 * ClanDocument.logo and the client loads it as `<resourceBase><logo>` — same as any CDN resource path.
 */
export const CLAN_LOGO_DIR = path.join(__dirname, "../../../clan-logos");
export const CLAN_LOGO_ROUTE = "/clanlogo";

/**
 * Persists a clan's uploaded logo image under a fresh version folder and returns the CDN-relative path the
 * client loads (e.g. `/clanlogo/<clanId>/<version>/BIG`). The version (upload time) busts the client cache on
 * change. Writes BIG + SMALL variants (same bytes) since the client may request either. Old versions for the
 * clan are removed first so logos don't pile up.
 */
export function saveClanLogo(clanId: string, image: Buffer): string {
    const clanDir = path.join(CLAN_LOGO_DIR, clanId);
    fs.rmSync(clanDir, { recursive: true, force: true }); // drop previous version(s)
    const version = Date.now();
    const dir = path.join(clanDir, String(version));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "BIG"), image);
    fs.writeFileSync(path.join(dir, "SMALL"), image);
    return `${CLAN_LOGO_ROUTE}/${clanId}/${version}/BIG`;
}
