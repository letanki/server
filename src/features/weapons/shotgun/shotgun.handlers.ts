import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import { IVector3 } from "@/shared/types/geom/ivector3";
import { ItemUtils } from "@/utils/item.utils";
import logger from "@/utils/logger";
import * as ShotgunPackets from "./shotgun.packets";

// A Hammer blast is 21 pellets; per-pellet damage = DAMAGE_PER_PERIOD / 21 (e.g. m1 66.6/21 = 3.17,
// matching the wiki's per-pellet column). Verified vs official capture (2026-07-01): the DamageIndicator
// per hit is EXACTLY pelletsHit × per-pellet, with NO distance falloff — the range drop-off comes purely
// from fewer pellets landing at distance (the client only reports pellets that actually hit).
const SHOTGUN_PELLET_COUNT = 21;

const fmt = (v: IVector3 | null): string => (v ? `(${v.x.toFixed(0)},${v.y.toFixed(0)},${v.z.toFixed(0)})` : "null");

export class ShotgunShotCommandHandler implements IPacketHandler<ShotgunPackets.ShotgunShotCommandPacket> {
    public readonly packetId = ShotgunPackets.ShotgunShotCommandPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: ShotgunPackets.ShotgunShotCommandPacket): Promise<void> {
        const { user, currentBattle } = client;
        if (!user || !currentBattle || client.battleState !== "active") return;

        const turretMod = ItemUtils.getItemModification(user, "turret");
        const perPellet = (ItemUtils.getPropertyValue(turretMod, "DAMAGE_PER_SECOND", "DAMAGE_PER_PERIOD") ?? 0) / SHOTGUN_PELLET_COUNT;

        // For each hit target: turn the WORLD impact point into the target's LOCAL frame (relative to its
        // centre, un-rotated by its yaw) for the relay. The client re-applies the tank transform to place
        // the knockback impulse at the right spot ON the tank — relaying the raw world point pushes the
        // wrong end (rear lifts when you hit the front). Then apply damage (pellets × per-pellet, no falloff).
        const relayTargets: { hit: IVector3 | null; pellets: number; nick: string }[] = [];
        for (const [nick, hitData] of packet.hitsByTarget) {
            const targetClient = server.findClientByUsername(nick);
            const yaw = targetClient?.battleOrientation?.z ?? 0;
            const localHit = this._toLocalHit(hitData.worldHit, hitData.center, yaw);
            relayTargets.push({ hit: localHit, pellets: hitData.pellets, nick });

            logger.info(`[shotgun] ${user.username} -> ${nick}: pellets=${hitData.pellets} dmg=${(hitData.pellets * perPellet).toFixed(1)} world=${fmt(hitData.worldHit)} center=${fmt(hitData.center)} yaw=${yaw.toFixed(3)} local=${fmt(localHit)}`);

            if (!targetClient || targetClient === client || targetClient.currentBattle !== currentBattle || targetClient.battleState !== "active") continue;
            await server.battleService.applyDamage(currentBattle, client, targetClient, hitData.pellets * perPellet, 0);
        }

        // Relay the blast (cone + pellet impacts) to EVERYONE, including the shooter (the official echoes
        // 471157826 back to the firer). Sent every shot, hit or miss (empty target list on a miss).
        const relay = new ShotgunPackets.ShotgunShotPacket(user.username, packet.direction, relayTargets);
        currentBattle.broadcast(relay);
    }

    /** World impact point -> the target tank's LOCAL frame: subtract the tank centre (v3), then un-rotate
     *  by its yaw (Rz(-yaw)). Verified against the official relay — reproduces its local hit exactly. */
    private _toLocalHit(worldHit: IVector3 | null, center: IVector3 | null, yaw: number): IVector3 | null {
        if (!worldHit || !center) return worldHit;
        const dx = worldHit.x - center.x;
        const dy = worldHit.y - center.y;
        const dz = worldHit.z - center.z;
        return { x: Math.cos(yaw) * dx + Math.sin(yaw) * dy, y: -Math.sin(yaw) * dx + Math.cos(yaw) * dy, z: dz };
    }
}
