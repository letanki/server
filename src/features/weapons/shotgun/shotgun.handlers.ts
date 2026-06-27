import { weaponPhysicsData } from "@/config/physics.data";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import { ItemUtils } from "@/utils/item.utils";
import * as ShotgunPackets from "./shotgun.packets";

// Nominal pellet count of a Hammer blast: per-pellet damage = DAMAGE_PER_PERIOD / this. Calibrated from
// the official capture (21 pellets → 66.57 at close ⇒ ~3.17/pellet = 44.1/14).
const SHOTGUN_NOMINAL_PELLETS = 14;

/**
 * Hammer (shotgun) damage: per tank hit, damage = pelletsHit × (DAMAGE_PER_PERIOD / 14) × distance falloff
 * (full within max_damage_radius, → min_damage_percent% at min_damage_radius). Closer ⇒ both more pellets
 * land AND more damage per pellet, so the blast hits much harder up close.
 */
export class ShotgunShotCommandHandler implements IPacketHandler<ShotgunPackets.ShotgunShotCommandPacket> {
    public readonly packetId = ShotgunPackets.ShotgunShotCommandPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: ShotgunPackets.ShotgunShotCommandPacket): Promise<void> {
        const { user, currentBattle } = client;
        if (!user || !currentBattle || client.battleState !== "active") return;

        // Relay the blast (cone + pellet impacts) to the others — every shot, hit or miss.
        const relay = new ShotgunPackets.ShotgunShotPacket(
            user.username, packet.direction,
            [...packet.hitsByTarget].map(([nick, t]) => ({ hit: t.hit, pellets: t.pellets, nick })),
        );
        currentBattle.broadcastRaw(relay.write(), relay.getId(), user.id);

        if (packet.hitsByTarget.size === 0) return;
        const turretMod = ItemUtils.getItemModification(user, "turret");
        const perPellet = (ItemUtils.getPropertyValue(turretMod, "DAMAGE_PER_SECOND", "DAMAGE_PER_PERIOD") ?? 0) / SHOTGUN_NOMINAL_PELLETS;
        const physics = weaponPhysicsData.weapons.find((w) => w.id === `${user.equippedTurret}_m${user.turrets.get(user.equippedTurret) ?? 0}`);
        const maxR = physics?.max_damage_radius ?? 47;
        const minR = physics?.min_damage_radius ?? 52;
        const minPct = (physics?.min_damage_percent ?? 0) / 100;

        for (const [target, { pellets }] of packet.hitsByTarget) {
            const targetClient = server.findClientByUsername(target);
            if (!targetClient || targetClient === client || targetClient.currentBattle !== currentBattle || targetClient.battleState !== "active") continue;

            let factor = 1;
            if (client.battlePosition && targetClient.battlePosition) {
                const dx = client.battlePosition.x - targetClient.battlePosition.x;
                const dy = client.battlePosition.y - targetClient.battlePosition.y;
                const dz = client.battlePosition.z - targetClient.battlePosition.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) / 100;
                if (dist > maxR) factor = dist >= minR ? minPct : 1 - (1 - minPct) * ((dist - maxR) / (minR - maxR));
            }
            await server.battleService.applyDamage(currentBattle, client, targetClient, pellets * perPellet * factor, 0);
        }
    }
}
