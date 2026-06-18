import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import { ItemUtils } from "@/utils/item.utils";
import logger from "@/utils/logger";
import * as RailgunPackets from "./railgun.packets";

const RAILGUN_FULL_CHARGE_MS = 1000; // time to reach full charge
const RAILGUN_MIN_FACTOR = 0.25; // a tap still does some damage
const PIERCE_FALLOFF = 0.75; // each subsequent tank in the beam takes 25% less

export class RailgunShotCommandHandler implements IPacketHandler<RailgunPackets.RailgunShotCommandPacket> {
    public readonly packetId = RailgunPackets.RailgunShotCommandPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: RailgunPackets.RailgunShotCommandPacket): Promise<void> {
        const { user, currentBattle } = client;
        if (!user || !currentBattle || client.battleState !== "active") {
            return;
        }

        // Relay the shot visual to the other players (the beam).
        const shotPacket = new RailgunPackets.RailgunShotPacket({
            shooterNickname: user.username,
            hitPosition: packet.position,
            targets: packet.targets.map((target) => ({ nickname: target.nickname, position: target.position })),
        });
        currentBattle.broadcastRaw(shotPacket.write(), shotPacket.getId(), user.id);

        // Real damage from the shooter's turret (DAMAGE_TO, scaled by charge time). Varies with
        // distance/hit spot in the real game; DAMAGE_TO is a solid hit.
        const turretMod = ItemUtils.getItemModification(user, "turret");
        const dmgTo = ItemUtils.getPropertyValue(turretMod, "DAMAGE", "DAMAGE_TO") ?? ItemUtils.getPropertyValue(turretMod, "DAMAGE", "DAMAGE_FROM") ?? 0;
        const chargeMs = client.railgunChargeStart ? Date.now() - client.railgunChargeStart : RAILGUN_FULL_CHARGE_MS;
        client.railgunChargeStart = 0;
        const factor = Math.min(1, Math.max(RAILGUN_MIN_FACTOR, chargeMs / RAILGUN_FULL_CHARGE_MS));
        const baseDamage = dmgTo * factor;

        logger.info(`User ${user.username} fired railgun (dmg ${Math.round(baseDamage)}, charge ${(factor * 100) | 0}%) at [${packet.targets.map((t) => t.nickname).join(", ")}]`);

        // The beam pierces aligned tanks: each next one takes 25% less.
        let pierceIndex = 0;
        for (const target of packet.targets) {
            const targetClient = server.findClientByUsername(target.nickname);
            if (!targetClient || targetClient === client || targetClient.currentBattle !== currentBattle || targetClient.battleState !== "active") continue;
            const damage = baseDamage * Math.pow(PIERCE_FALLOFF, pierceIndex);
            pierceIndex++;
            await server.battleService.applyDamage(currentBattle, client, targetClient, damage);
        }
    }
}

export class StartChargingCommandHandler implements IPacketHandler<RailgunPackets.StartChargingCommandPacket> {
    public readonly packetId = RailgunPackets.StartChargingCommandPacket.getId();
    public execute(client: GameClient, server: GameServer, packet: RailgunPackets.StartChargingCommandPacket): void {
        const { user, currentBattle } = client;
        if (!user || !currentBattle) {
            return;
        }
        // Remember when the charge began (railgun damage scales with charge time).
        client.railgunChargeStart = Date.now();

        // Relay the charging visual to the other players.
        const startChargingPacket = new RailgunPackets.StartChargingPacket({ nickname: user.username });
        currentBattle.broadcastRaw(startChargingPacket.write(), startChargingPacket.getId(), user.id);
    }
}