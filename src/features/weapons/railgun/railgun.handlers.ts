import { weaponPhysicsData } from "@/config/physics.data";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { UserDocument } from "@/shared/models/user.model";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import { ItemUtils } from "@/utils/item.utils";
import logger from "@/utils/logger";
import * as RailgunPackets from "./railgun.packets";

// Damage depends ONLY on where the beam hits the tank (no distance/charge): a dead-center hit does
// DAMAGE_TO, the edge does DAMAGE_FROM. RAILGUN_TANK_RADIUS is the horizontal offset (from the
// tank's central axis) at which damage reaches the minimum — tune to taste.
const RAILGUN_TANK_RADIUS = 250;
const RAILGUN_CHARGE_TOLERANCE_MS = 250; // network jitter allowance for the charge gate

// Per-mod railgun config lives in physics.data (id `${turret}_m{0..3}`, e.g. `railgun_m2`;
// note `railgun_xt_*` is a DIFFERENT special weapon): `chargingTimeMsec` is the fixed charge time
// (anti fire-rate hack) and `weakeningCoeff` is the pierce retention (each next tank in the beam
// keeps this fraction; m0=0.3536 .. m3=1.0 = no weakening).
function getRailgunPhysics(user: UserDocument): { chargeMs: number; weakeningCoeff: number } {
    const mod = user.turrets.get(user.equippedTurret) ?? 0;
    const weapon = weaponPhysicsData.weapons.find((w) => w.id === `${user.equippedTurret}_m${mod}`);
    const se = (weapon?.special_entity ?? {}) as { chargingTimeMsec?: number; weakeningCoeff?: number };
    return { chargeMs: se.chargingTimeMsec ?? 1100, weakeningCoeff: se.weakeningCoeff ?? 1 };
}

export class RailgunShotCommandHandler implements IPacketHandler<RailgunPackets.RailgunShotCommandPacket> {
    public readonly packetId = RailgunPackets.RailgunShotCommandPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: RailgunPackets.RailgunShotCommandPacket): Promise<void> {
        const { user, currentBattle } = client;
        if (!user || !currentBattle || client.battleState !== "active") {
            return;
        }

        const { chargeMs, weakeningCoeff } = getRailgunPhysics(user);

        // Anti fire-rate hack: the shot must come after the (per-mod) fixed charge time elapsed
        // since the player started charging. A shot with no/too-little charge is dropped entirely.
        const charged = client.railgunChargeStart ? Date.now() - client.railgunChargeStart : 0;
        client.railgunChargeStart = 0;
        if (charged < chargeMs - RAILGUN_CHARGE_TOLERANCE_MS) {
            logger.warn(`Dropping railgun shot from ${user.username}: charged only ${charged}ms (min ${chargeMs - RAILGUN_CHARGE_TOLERANCE_MS}ms) — possible fire-rate hack.`);
            return;
        }

        // Relay the shot visual to the other players (the beam).
        const shotPacket = new RailgunPackets.RailgunShotPacket({
            shooterNickname: user.username,
            hitPosition: packet.position,
            targets: packet.targets.map((target) => ({ nickname: target.nickname, position: target.position })),
        });
        currentBattle.broadcastRaw(shotPacket.write(), shotPacket.getId(), user.id);

        // Damage range from the shooter's turret (DAMAGE_FROM..DAMAGE_TO).
        const turretMod = ItemUtils.getItemModification(user, "turret");
        const dmgFrom = ItemUtils.getPropertyValue(turretMod, "DAMAGE", "DAMAGE_FROM") ?? 0;
        const dmgTo = ItemUtils.getPropertyValue(turretMod, "DAMAGE", "DAMAGE_TO") ?? dmgFrom;

        logger.info(`User ${user.username} fired railgun (dmg ${dmgFrom}-${dmgTo}) at [${packet.targets.map((t) => t.nickname).join(", ")}]`);

        // The beam pierces aligned tanks: each next one keeps `weakeningCoeff` of the damage (per-mod).
        let pierceIndex = 0;
        for (const target of packet.targets) {
            const targetClient = server.findClientByUsername(target.nickname);
            if (!targetClient || targetClient === client || targetClient.currentBattle !== currentBattle || targetClient.battleState !== "active") continue;

            // Centrality: target.position is the local hit point; the closer the HORIZONTAL offset
            // is to the tank's central axis, the more damage (DAMAGE_TO at center, DAMAGE_FROM at edge).
            const hit = target.position;
            const offset = hit ? Math.hypot(hit.x, hit.y) : RAILGUN_TANK_RADIUS;
            const centrality = Math.max(0, Math.min(1, 1 - offset / RAILGUN_TANK_RADIUS));
            const damage = (dmgFrom + (dmgTo - dmgFrom) * centrality) * Math.pow(weakeningCoeff, pierceIndex);
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
        // Mark the charge start (the shot's timing is validated against this) and relay the
        // charging light to the other players. The charge is a fixed time; it doesn't affect damage.
        client.railgunChargeStart = Date.now();
        const startChargingPacket = new RailgunPackets.StartChargingPacket({ nickname: user.username });
        currentBattle.broadcastRaw(startChargingPacket.write(), startChargingPacket.getId(), user.id);
    }
}