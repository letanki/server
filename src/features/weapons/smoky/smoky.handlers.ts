import { weaponPhysicsData } from "@/config/physics.data";
import { isReportedHitValid } from "@/features/weapons/hit-validation";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import { ItemUtils } from "@/utils/item.utils";
import logger from "@/utils/logger";
import * as SmokyPackets from "./smoky.packets";

// Impact (knockback) multiplier the relay carries: distance-LINEAR, ~1.45 at point-blank falling ~0.0075
// per metre — it PEAKS ABOVE 1 up close (unlike the damage falloff, which caps at 1). Reverse-engineered
// from official smoky captures (2026-06-23 / 06-25: impactForce 1.40@6m → 0.92@70m → 0.59@99m, one clean
// line across mods). The client multiplies the tank's base impact_force (spec) by this value.
const SMOKY_IMPACT_AT_ZERO = 1.45;
const SMOKY_IMPACT_FALLOFF_PER_M = 0.0075;

export class SmokyStaticShotCommandHandler implements IPacketHandler<SmokyPackets.SmokyStaticShotCommandPacket> {
    public readonly packetId = SmokyPackets.SmokyStaticShotCommandPacket.getId();
    public execute(client: GameClient, server: GameServer, packet: SmokyPackets.SmokyStaticShotCommandPacket): void {
        const { user, currentBattle } = client;
        if (!user || !currentBattle) {
            logger.warn("SmokyStaticShotCommandHandler received packet from client not in battle.", { client: client.getRemoteAddress() });
            return;
        }
        const staticShotPacket = new SmokyPackets.SmokyStaticShotPacket({ nickname: user.username, hitPosition: packet.hitPosition });
        const allParticipants = currentBattle.getAllParticipants();
        for (const participant of allParticipants) {
            if (participant.id === user.id) continue;
            const otherClient = server.findClientByUsername(participant.username);
            if (otherClient && otherClient.currentBattle?.battleId === currentBattle.battleId) {
                otherClient.sendPacket(staticShotPacket);
            }
        }
    }
}

export class SmokyTargetShotCommandHandler implements IPacketHandler<SmokyPackets.SmokyTargetShotCommandPacket> {
    public readonly packetId = SmokyPackets.SmokyTargetShotCommandPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: SmokyPackets.SmokyTargetShotCommandPacket): Promise<void> {
        const { user, currentBattle } = client;
        if (!user || !currentBattle || !packet.targetUserId) {
            logger.warn("SmokyTargetShotCommandHandler received incomplete packet.", { client: client.getRemoteAddress() });
            return;
        }
        const turretMod = ItemUtils.getItemModification(user, "turret");
        const critChance = ItemUtils.getPropertyValue(turretMod, "CRITICAL_HIT_CHANCE") ?? 0;
        const isCritical = Math.random() * 100 < critChance;

        // Shooter→impact distance (world units / 100), and the smoky damage-falloff radii from physics.
        const weaponId = `${user.equippedTurret}_m${user.turrets.get(user.equippedTurret) ?? 0}`;
        const physics = weaponPhysicsData.weapons.find((w) => w.id === weaponId);
        let distance = 0;
        const shooterPosition = client.battlePosition;
        if (shooterPosition && packet.hitGlobalPosition) {
            const dx = shooterPosition.x - packet.hitGlobalPosition.x;
            const dy = shooterPosition.y - packet.hitGlobalPosition.y;
            const dz = shooterPosition.z - packet.hitGlobalPosition.z;
            distance = Math.sqrt(dx * dx + dy * dy + dz * dz) / 100;
        }
        const maxR = physics?.max_damage_radius ?? 40;
        const minR = physics?.min_damage_radius ?? 120;
        const minPct = (physics?.min_damage_percent ?? 10) / 100;
        // Distance factor: 1 within maxR, linearly down to minPct at minR, then minPct beyond.
        let factor = 1;
        if (distance > maxR) factor = distance >= minR ? minPct : 1 - (1 - minPct) * ((distance - maxR) / (minR - maxR));

        // Knockback multiplier: its OWN distance-linear curve (peaks ~1.45 at point-blank), NOT the damage
        // factor (which caps at 1). `distance` is the shooter→impact distance in metres computed above.
        const finalImpactForce = Math.max(0.01, SMOKY_IMPACT_AT_ZERO - SMOKY_IMPACT_FALLOFF_PER_M * distance);
        const targetShotPacket = new SmokyPackets.SmokyTargetShotPacket({
            nickname: user.username,
            targetNickname: packet.targetUserId,
            hitPosition: packet.hitLocalPosition,
            impactForce: finalImpactForce,
            critical: isCritical,
        });
        const allParticipants = currentBattle.getAllParticipants();
        for (const participant of allParticipants) {
            if (participant.id === user.id) continue;
            const otherClient = server.findClientByUsername(participant.username);
            if (otherClient && otherClient.currentBattle?.battleId === currentBattle.battleId) {
                otherClient.sendPacket(targetShotPacket);
            }
        }

        // Apply the damage. A NORMAL hit = random(DAMAGE_FROM..DAMAGE_TO) × distance factor. A CRITICAL is
        // the flat CRITICAL_HIT_DAMAGE property (distance- and roll-independent; = DAMAGE_FROM+DAMAGE_TO in
        // the data — official crits dealt exactly that). damageType 0 = normal, 1 = critical.
        const targetClient = server.findClientByUsername(packet.targetUserId);
        // Anti-cheat: valida a vida (incarnation) e a posição do alvo antes de aplicar dano.
        if (targetClient && targetClient !== client && targetClient.currentBattle === currentBattle && targetClient.battleState === "active"
            && isReportedHitValid(targetClient, { incarnation: packet.targetIncarnation, targetPosition: packet.targetPosition })) {
            const dmgFrom = ItemUtils.getPropertyValue(turretMod, "DAMAGE", "DAMAGE_FROM") ?? 0;
            const dmgTo = ItemUtils.getPropertyValue(turretMod, "DAMAGE", "DAMAGE_TO") ?? dmgFrom;
            const critDamage = ItemUtils.getPropertyValue(turretMod, "CRITICAL_HIT_DAMAGE") ?? dmgFrom + dmgTo;
            const damage = isCritical ? critDamage : (dmgFrom + Math.random() * (dmgTo - dmgFrom)) * factor;
            await server.battleService.applyDamage(currentBattle, client, targetClient, damage, isCritical ? 1 : 0);
        }

        logger.info(`Smoky from ${user.username} -> ${packet.targetUserId}: dist=${distance.toFixed(1)} factor=${factor.toFixed(2)} crit=${isCritical}`);
    }
}