import { weaponPhysicsData } from "@/config/physics.data";
import { isReportedHitValid } from "@/features/weapons/hit-validation";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import { ItemUtils } from "@/utils/item.utils";
import * as TwinsPackets from "./twins.packets";

/** Relays each twins shot to the other players in the battle so they see the plasma (visual only). */
export class TwinsShotCommandHandler implements IPacketHandler<TwinsPackets.TwinsShotCommandPacket> {
    public readonly packetId = TwinsPackets.TwinsShotCommandPacket.getId();
    public execute(client: GameClient, server: GameServer, packet: TwinsPackets.TwinsShotCommandPacket): void {
        const { user, currentBattle } = client;
        if (!user || !currentBattle) return;
        const relay = new TwinsPackets.TwinsShotPacket({ nickname: user.username, barrel: packet.barrel, direction: packet.direction });
        currentBattle.broadcastRaw(relay.write(), relay.getId(), user.id);
    }
}

/**
 * Twins plasma hit. Damage = random(DAMAGE_FROM..DAMAGE_TO) × distance falloff (full within
 * max_damage_radius, down to min_damage_percent% at min_damage_radius), NO critical — same model as
 * smoky, decoded from the official capture (close hits ~full base, farther hits fall off). damageType 0.
 */
export class TwinsTargetShotCommandHandler implements IPacketHandler<TwinsPackets.TwinsTargetShotCommandPacket> {
    public readonly packetId = TwinsPackets.TwinsTargetShotCommandPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: TwinsPackets.TwinsTargetShotCommandPacket): Promise<void> {
        const { user, currentBattle } = client;
        if (!user || !currentBattle || !packet.target || client.battleState !== "active") return;

        const targetClient = server.findClientByUsername(packet.target);
        if (!targetClient || targetClient === client || targetClient.currentBattle !== currentBattle || targetClient.battleState !== "active") return;
        // Anti-cheat: valida a posição do alvo (twins não carrega incarnation) antes de aplicar dano.
        if (!isReportedHitValid(targetClient, { targetPosition: packet.targetPosition })) return;

        const turretMod = ItemUtils.getItemModification(user, "turret");
        const dmgFrom = ItemUtils.getPropertyValue(turretMod, "DAMAGE", "DAMAGE_FROM") ?? 0;
        const dmgTo = ItemUtils.getPropertyValue(turretMod, "DAMAGE", "DAMAGE_TO") ?? dmgFrom;

        const weaponId = `${user.equippedTurret}_m${user.turrets.get(user.equippedTurret) ?? 0}`;
        const physics = weaponPhysicsData.weapons.find((w) => w.id === weaponId);
        const maxR = physics?.max_damage_radius ?? 15;
        const minR = physics?.min_damage_radius ?? 67;
        const minPct = (physics?.min_damage_percent ?? 10) / 100;
        // Twins' hit-position units make the falloff line up at /200 (not /100 like smoky) — verified by
        // back-calculating the base across both distance clusters in the official capture (lands on m1's
        // 9.8-11.9 only at /200; /100 gives an inconsistent 15-19).
        let dist = 0;
        if (client.battlePosition && packet.targetPosition) {
            const dx = client.battlePosition.x - packet.targetPosition.x;
            const dy = client.battlePosition.y - packet.targetPosition.y;
            const dz = client.battlePosition.z - packet.targetPosition.z;
            dist = Math.sqrt(dx * dx + dy * dy + dz * dz) / 200;
        }
        let factor = 1;
        if (dist > maxR) factor = dist >= minR ? minPct : 1 - (1 - minPct) * ((dist - maxR) / (minR - maxR));

        const damage = (dmgFrom + Math.random() * (dmgTo - dmgFrom)) * factor;
        await server.battleService.applyDamage(currentBattle, client, targetClient, damage, 0);
    }
}
