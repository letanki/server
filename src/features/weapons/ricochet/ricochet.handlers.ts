import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import { ItemUtils } from "@/utils/item.utils";
import logger from "@/utils/logger";
import * as RicochetPackets from "./ricochet.packets";

export class RicochetShotCommandHandler implements IPacketHandler<RicochetPackets.RicochetShotCommandPacket> {
    public readonly packetId = RicochetPackets.RicochetShotCommandPacket.getId();
    public execute(client: GameClient, server: GameServer, packet: RicochetPackets.RicochetShotCommandPacket): void {
        const { user, currentBattle } = client;
        if (!user || !currentBattle) {
            logger.warn("RicochetShotCommandHandler received a packet from a client not in a battle.", { client: client.getRemoteAddress() });
            return;
        }
        const shotPacket = new RicochetPackets.RicochetShotPacket({
            nickname: user.username,
            x: packet.x,
            y: packet.y,
            z: packet.z,
        });
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

/** The ricochet ball hit a tank. Damage = random(DAMAGE_FROM..DAMAGE_TO), CONSTANT (no distance falloff,
 *  no critical — decoded from the official capture: hits were a flat 16-19 at any range). A bounced ball
 *  CAN come back and hit the shooter, so self-hits are NOT skipped. The projectile visual already came
 *  from the static shot relay. */
export class RicochetTargetShotCommandHandler implements IPacketHandler<RicochetPackets.RicochetTargetShotCommandPacket> {
    public readonly packetId = RicochetPackets.RicochetTargetShotCommandPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: RicochetPackets.RicochetTargetShotCommandPacket): Promise<void> {
        const { user, currentBattle } = client;
        if (!user || !currentBattle || !packet.target || client.battleState !== "active") return;

        const targetClient = server.findClientByUsername(packet.target);
        if (!targetClient || targetClient.currentBattle !== currentBattle || targetClient.battleState !== "active") return;

        const turretMod = ItemUtils.getItemModification(user, "turret");
        const dmgFrom = ItemUtils.getPropertyValue(turretMod, "DAMAGE", "DAMAGE_FROM") ?? 0;
        const dmgTo = ItemUtils.getPropertyValue(turretMod, "DAMAGE", "DAMAGE_TO") ?? dmgFrom;
        const damage = dmgFrom + Math.random() * (dmgTo - dmgFrom);

        // No self-skip: a ricochet can bounce back onto the shooter.
        await server.battleService.applyDamage(currentBattle, client, targetClient, damage, 0);
    }
}