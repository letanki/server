import { weaponPhysicsData } from "@/config/physics.data";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { UserDocument } from "@/shared/models/user.model";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import { IVector3 } from "@/shared/types/geom/ivector3";
import { ItemUtils } from "@/utils/item.utils";
import logger from "@/utils/logger";
import * as ThunderPackets from "./thunder.packets";

// Thunder is a plasma ball that explodes at the impact point and deals AREA damage. Per-mod splash
// shape lives in physics.data (id `thunder_m{mod}`): full damage within `max_damage_radius`, falling
// linearly to `min_damage_percent`% at `min_damage_radius`, nothing beyond. Damage base = DAMAGE_TO.
function getThunderSplash(user: UserDocument): { baseDamage: number; maxRadius: number; minRadius: number; minPercent: number } {
    const mod = user.turrets.get(user.equippedTurret) ?? 0;
    const weapon = weaponPhysicsData.weapons.find((w) => w.id === `${user.equippedTurret}_m${mod}`) as any;
    const turretMod = ItemUtils.getItemModification(user, "turret");
    const dmgTo = ItemUtils.getPropertyValue(turretMod, "DAMAGE", "DAMAGE_TO") ?? ItemUtils.getPropertyValue(turretMod, "DAMAGE", "DAMAGE_FROM") ?? 0;
    return {
        baseDamage: dmgTo,
        maxRadius: weapon?.max_damage_radius ?? 60,
        minRadius: weapon?.min_damage_radius ?? 120,
        minPercent: weapon?.min_damage_percent ?? 50,
    };
}

async function detonateThunder(server: GameServer, client: GameClient, center: IVector3 | null): Promise<void> {
    const { user, currentBattle } = client;
    if (!user || !currentBattle || !center || client.battleState !== "active") return;
    const s = getThunderSplash(user);
    logger.info(`Thunder explosion by ${user.username} at (${center.x | 0},${center.y | 0},${center.z | 0}) — base ${s.baseDamage}, radius ${s.maxRadius}-${s.minRadius}`);
    await server.battleService.applySplashDamage(currentBattle, client, center, s.baseDamage, s.maxRadius, s.minRadius, s.minPercent);
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

        // The plasma explodes at the world hit point; the direct target sits at the center (full
        // damage) and nearby tanks take splash. Fall back to the target's position if needed.
        let center = packet.positionInWorld ?? packet.positionTarget;
        if (!center && packet.nicknameTarget) {
            center = server.findClientByUsername(packet.nicknameTarget)?.battlePosition ?? null;
        }
        await detonateThunder(server, client, center);
    }
}