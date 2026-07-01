import { weaponPhysicsData } from "@/config/physics.data";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { UserDocument } from "@/shared/models/user.model";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import { IVector3 } from "@/shared/types/geom/ivector3";
import { ItemUtils } from "@/utils/item.utils";
import logger from "@/utils/logger";
import * as ThunderPackets from "./thunder.packets";

// Thunder is a plasma ball that explodes at the impact point and deals AREA damage. Two independent
// falloffs (both in physics.data `thunder_m{mod}`, matching the wiki):
//  • DISTANCE (shooter → explosion): top-level `max_damage_radius`(m0 53.5)/`min_damage_radius`(107)/
//    `min_damage_percent`(50) — full within max range, linear to 50% at min range, 0 beyond.
//  • SPLASH (explosion → each tank): `special_entity` `radiusOfMaxSplashDamage`(0)/`splashDamageRadius`(12)/
//    `minSplashDamagePercent`(25) — full within max radius, linear to 25% at min radius, 0 beyond.
// Base damage is a UNIFORM RANDOM roll in [DAMAGE_FROM, DAMAGE_TO], rolled ONCE per explosion.
const THUNDER_WORLD_SCALE = 100; // world units per "metre" (same as the shotgun's distance falloff)

function getThunderParams(user: UserDocument) {
    const mod = user.turrets.get(user.equippedTurret) ?? 0;
    const w = weaponPhysicsData.weapons.find((x) => x.id === `${user.equippedTurret}_m${mod}`) as any;
    const se = (w?.special_entity ?? {}) as { radiusOfMaxSplashDamage?: number; splashDamageRadius?: number; minSplashDamagePercent?: number };
    const turretMod = ItemUtils.getItemModification(user, "turret");
    const from = ItemUtils.getPropertyValue(turretMod, "DAMAGE", "DAMAGE_FROM") ?? 0;
    const to = ItemUtils.getPropertyValue(turretMod, "DAMAGE", "DAMAGE_TO") ?? from;
    return {
        from, to,
        maxRange: w?.max_damage_radius ?? 53.5,          // distance falloff (shooter → impact)
        minRange: w?.min_damage_radius ?? 107,
        rangeWeak: (w?.min_damage_percent ?? 50) / 100,  // as a fraction
        maxSplash: se.radiusOfMaxSplashDamage ?? 0,      // splash falloff (impact → tank)
        minSplash: se.splashDamageRadius ?? 12,
        splashPercent: se.minSplashDamagePercent ?? 25,  // as a PERCENT (applySplashDamage divides by 100)
    };
}

async function detonateThunder(server: GameServer, client: GameClient, center: IVector3 | null): Promise<void> {
    const { user, currentBattle } = client;
    if (!user || !currentBattle || !center || client.battleState !== "active") return;
    const p = getThunderParams(user);

    // Roll the base once, then apply the shooter→impact DISTANCE falloff. The remaining splash falloff
    // (impact→each tank) is done per-target inside applySplashDamage.
    let base = p.from + Math.random() * (p.to - p.from);
    if (client.battlePosition) {
        const d = Math.hypot(client.battlePosition.x - center.x, client.battlePosition.y - center.y, client.battlePosition.z - center.z) / THUNDER_WORLD_SCALE;
        const rangeFactor = d <= p.maxRange ? 1 : d >= p.minRange ? 0 : 1 - (1 - p.rangeWeak) * ((d - p.maxRange) / (p.minRange - p.maxRange));
        base *= rangeFactor;
    }

    logger.info(`Thunder explosion by ${user.username} at (${center.x | 0},${center.y | 0},${center.z | 0}) — base ${base.toFixed(1)}, splash ${p.maxSplash}-${p.minSplash}m@${p.splashPercent}%`);
    await server.battleService.applySplashDamage(currentBattle, client, center, base, p.maxSplash, p.minSplash, p.splashPercent);
}

export class ThunderShotNoTargetCommandHandler implements IPacketHandler<ThunderPackets.ThunderShotNoTargetCommandPacket> {
    public readonly packetId = ThunderPackets.ThunderShotNoTargetCommandPacket.getId();
    public execute(client: GameClient, server: GameServer, packet: ThunderPackets.ThunderShotNoTargetCommandPacket): void {
        const { user, currentBattle } = client;
        if (!user || !currentBattle) {
            logger.warn("ThunderShotNoTargetCommandHandler received a packet from a client not in a battle.", { client: client.getRemoteAddress() });
            return;
        }
        const shotPacket = new ThunderPackets.ThunderShotNoTargetPacket(user.username);
        const allParticipants = currentBattle.getAllParticipants();
        for (const participant of allParticipants) {
            if (participant.id === user.id) {
                continue;
            }
            const otherClient = server.findClientByUsername(participant.username);
            if (otherClient && otherClient.currentBattle?.battleId === currentBattle.battleId) {
                otherClient.sendPacket(shotPacket);
            }
        }
    }
}

export class ThunderStaticShotCommandHandler implements IPacketHandler<ThunderPackets.ThunderStaticShotCommandPacket> {
    public readonly packetId = ThunderPackets.ThunderStaticShotCommandPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: ThunderPackets.ThunderStaticShotCommandPacket): Promise<void> {
        const { user, currentBattle } = client;
        if (!user || !currentBattle) {
            logger.warn("ThunderStaticShotCommandHandler received a packet from a client not in a battle.", { client: client.getRemoteAddress() });
            return;
        }
        // Relay the explosion visual, then deal splash damage at the impact point (ground/wall).
        const shotPacket = new ThunderPackets.ThunderStaticShotPacket({ nickname: user.username, position: packet.position });
        currentBattle.broadcastRaw(shotPacket.write(), shotPacket.getId(), user.id);

        await detonateThunder(server, client, packet.position);
    }
}

export class ThunderTargetShotCommandHandler implements IPacketHandler<ThunderPackets.ThunderTargetShotCommandPacket> {
    public readonly packetId = ThunderPackets.ThunderTargetShotCommandPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: ThunderPackets.ThunderTargetShotCommandPacket): Promise<void> {
        const { user, currentBattle } = client;
        if (!user || !currentBattle) {
            logger.warn("ThunderTargetShotCommandHandler received a packet from a client not in a battle.", { client: client.getRemoteAddress() });
            return;
        }
        // Relay the explosion visual on the hit tank.
        const shotPacket = new ThunderPackets.ThunderTargetShotPacket({ nicknameShooter: user.username, nicknameTarget: packet.nicknameTarget, internalPosition: packet.internalPosition });
        currentBattle.broadcastRaw(shotPacket.write(), shotPacket.getId(), user.id);

        // Direct hit: centre the explosion on the TARGET's position so it sits at distance 0 (splash
        // factor 1 → full damage), and nearby tanks take the splash falloff from there. Fall back to the
        // reported world/target hit point if the target isn't resolvable.
        const directTarget = packet.nicknameTarget ? server.findClientByUsername(packet.nicknameTarget) : null;
        const center = directTarget?.battlePosition ?? packet.positionInWorld ?? packet.positionTarget ?? null;
        await detonateThunder(server, client, center);
    }
}