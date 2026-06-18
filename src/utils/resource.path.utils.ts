/**
 * Resource id/version <-> path encoding, matching the client exactly (decompiled). A resource path
 * is `/{idHigh}/{(idLow>>16)&0xFFFF}/{(idLow>>8)&0xFF}/{idLow&0xFF}/{version}/`, every component in
 * OCTAL. The version component packs BOTH versionHigh and versionLow via 6-bit-group interleaving
 * (for tiny versions like 1 this coincides with a plain octal of versionLow, which is why the old
 * versionLow-only code worked for freshly-built resources but broke on real CDN versions).
 */
export class ResourcePathUtils {
    private static oct2(v: number): string {
        return (v < 8 ? "0" : "") + v.toString(8);
    }

    /** Encode versionHigh+versionLow into the path's version component (client algorithm). */
    public static encodeVersion(versionHigh: number, versionLow: number): string {
        let shift = 0;
        let hi = "";
        let lo = "";
        for (let i = 0; i < 5; i++) {
            const h = (((versionHigh & ((0x3f << (4 + shift)) >>> 0)) >>> 0) >>> (shift + 4)) >>> 0;
            const l = (((versionLow & ((0x3f << shift) >>> 0)) >>> 0) >>> shift) >>> 0;
            hi = this.oct2(h) + hi;
            lo = this.oct2(l) + lo;
            shift += 6;
        }
        const mid = (((versionHigh & 0x0f) << 2) + (versionLow >>> 30)) >>> 0;
        const full = hi + this.oct2(mid) + lo;
        let k = 0;
        while (k < full.length - 1 && full[k] === "0") k++;
        return full.substr(k);
    }

    /** Inverse of encodeVersion: the octal version component -> { versionHigh, versionLow }. */
    public static decodeVersion(component: string): { versionHigh: number; versionLow: number } {
        const padded = component.padStart(22, "0"); // 5 hi pairs + 1 mid pair + 5 lo pairs
        const grp = (pairIndex: number) => parseInt(padded.substr(pairIndex * 2, 2), 8);
        // During encode the hi/lo pairs are prepended, so pair 0 = h4 / l4 ... and the mid pair is 5.
        const h = [grp(4), grp(3), grp(2), grp(1), grp(0)]; // h0..h4
        const mid = grp(5);
        const l = [grp(10), grp(9), grp(8), grp(7), grp(6)]; // l0..l4

        const versionLow = l[0] + l[1] * 64 + l[2] * 4096 + l[3] * 262144 + l[4] * 16777216 + (mid & 0x3) * 1073741824;
        const versionHigh = ((mid >>> 2) & 0x0f) + h[0] * 16 + h[1] * 1024 + h[2] * 65536 + h[3] * 4194304 + h[4] * 268435456;
        return { versionHigh, versionLow };
    }

    public static parseResourcePath(resourcePath: string): { idHigh: number; idLow: number; versionHigh: number; versionLow: number } {
        const parts = resourcePath.replace(/^\/|\/$/g, "").split("/");
        if (parts.length !== 5) {
            throw new Error(`Invalid path format: ${resourcePath}`);
        }
        const idHigh = parseInt(parts[0], 8);
        const part2 = parseInt(parts[1], 8);
        const part3 = parseInt(parts[2], 8);
        const part4 = parseInt(parts[3], 8);
        const idLow = (part2 << 16) | (part3 << 8) | part4;
        const { versionHigh, versionLow } = this.decodeVersion(parts[4]);
        return { idHigh, idLow, versionHigh, versionLow };
    }

    public static getResourcePath({ idLow, versionLow, idHigh = 0, versionHigh = 0 }: { idLow: number; versionLow: number; idHigh?: number; versionHigh?: number }): string {
        const part2 = (idLow >> 16) & 0xff;
        const part3 = (idLow >> 8) & 0xff;
        const part4 = idLow & 0xff;
        return `/${idHigh.toString(8)}/${part2.toString(8)}/${part3.toString(8)}/${part4.toString(8)}/${this.encodeVersion(versionHigh, versionLow)}/`;
    }
}
