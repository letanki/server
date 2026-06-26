import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import { ItemUtils } from "@/utils/item.utils";
import * as ShaftPackets from "./shaft.packets";

// Time (ms) from entering aiming mode (the scope opening) to the shot reaching FULL sniper damage
// (SHAFT_AIMING_MODE_MAX_DAMAGE) — i.e. the aim-charge duration, NOT the weapon's energy reload (that's
// physics `charge_rate`, a separate thing). Calibrated from the official capture: 1865ms→97.7, ~4200ms→153.
const SHAFT_FULL_CHARGE_MS = 4200;

// The shot relay's "power" float (impact strength → tells the client which beam to draw). From the capture:
// arcade = 1.67 (= IMPACT_FORCE 167 / 100), aiming = 4.30.
const SHAFT_ARCADE_POWER = 1.67;
const SHAFT_AIMING_POWER = 4.3;

function turretDamage(user: GameClient["user"]): { from: number; to: number; aimMax: number } {
    const mod = ItemUtils.getItemModification(user!, "turret");
    const from = ItemUtils.getPropertyValue(mod, "DAMAGE", "DAMAGE_FROM") ?? 0;
    const to = ItemUtils.getPropertyValue(mod, "DAMAGE", "DAMAGE_TO") ?? from;
    const aimMax = ItemUtils.getPropertyValue(mod, "AIMING_MODE_DAMAGE", "SHAFT_AIMING_MODE_MAX_DAMAGE") ?? to;
    return { from, to, aimMax };
}

/** Shaft entered aiming mode → start the sniper charge timer. */
export class ShaftEnterAimingHandler implements IPacketHandler<ShaftPackets.ShaftEnterAimingPacket> {
    public readonly packetId = ShaftPackets.ShaftEnterAimingPacket.getId();
    public execute(client: GameClient, server: GameServer): void {
        client.shaftAimStart = Date.now();
        // Tell the other players this tank entered aiming mode (so they render the laser + don't read the
        // aim-track as the tank itself rotating).
        const { user, currentBattle } = client;
        if (!user || !currentBattle) return;
        const relay = new ShaftPackets.ShaftAimEnterRelayPacket(user.username);
        currentBattle.broadcastRaw(relay.write(), relay.getId(), user.id);
    }
}

/** Relays the shaft laser-sight tracking to the other players so they see the beam while it aims. */
export class ShaftAimTrackHandler implements IPacketHandler<ShaftPackets.ShaftAimTrackCommandPacket> {
    public readonly packetId = ShaftPackets.ShaftAimTrackCommandPacket.getId();
    public execute(client: GameClient, server: GameServer, packet: ShaftPackets.ShaftAimTrackCommandPacket): void {
        const { user, currentBattle } = client;
        if (!user || !currentBattle) return;
        const relay = new ShaftPackets.ShaftAimTrackPacket(user.username, packet.target, packet.direction);
        currentBattle.broadcastRaw(relay.write(), relay.getId(), user.id);
    }
}

/** Shaft ARCADE (quick) shot → random(DAMAGE_FROM..DAMAGE_TO), no falloff (radius is 100/100/100%). */
export class ShaftArcadeShotCommandHandler implements IPacketHandler<ShaftPackets.ShaftArcadeShotCommandPacket> {
    public readonly packetId = ShaftPackets.ShaftArcadeShotCommandPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: ShaftPackets.ShaftArcadeShotCommandPacket): Promise<void> {
        const { user, currentBattle } = client;
        if (!user || !currentBattle || client.battleState !== "active") return;

        // Relay the beam to the others — on a HIT and on a MISS (wall/void) alike.
        const relay = new ShaftPackets.ShaftShotPacket(user.username, packet.origin, packet.target, packet.hit, SHAFT_ARCADE_POWER);
        currentBattle.broadcastRaw(relay.write(), relay.getId(), user.id);

        // Damage only when an actual tank was hit.
        const targetClient = packet.target ? server.findClientByUsername(packet.target) : undefined;
        if (targetClient && targetClient !== client && targetClient.currentBattle === currentBattle && targetClient.battleState === "active") {
            const { from, to } = turretDamage(user);
            await server.battleService.applyDamage(currentBattle, client, targetClient, from + Math.random() * (to - from), 0);
        }
    }
}

/** Shaft AIMING (sniper) shot → damage ramps from DAMAGE_TO to SHAFT_AIMING_MODE_MAX_DAMAGE with the charge
 *  held since entering aiming mode (ShaftEnterAiming). */
export class ShaftAimingShotCommandHandler implements IPacketHandler<ShaftPackets.ShaftAimingShotCommandPacket> {
    public readonly packetId = ShaftPackets.ShaftAimingShotCommandPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: ShaftPackets.ShaftAimingShotCommandPacket): Promise<void> {
        const { user, currentBattle } = client;
        if (!user || !currentBattle || client.battleState !== "active") return;

        const elapsed = client.shaftAimStart ? Date.now() - client.shaftAimStart : SHAFT_FULL_CHARGE_MS;
        client.shaftAimStart = 0;
        const ratio = Math.max(0, Math.min(1, elapsed / SHAFT_FULL_CHARGE_MS));

        // Relay the beam (hit or miss), then exit aiming for everyone — firing ALWAYS leaves aim mode, so
        // the laser must clear even when the shot missed a wall / the void (else it lingers on others).
        const relay = new ShaftPackets.ShaftShotPacket(user.username, packet.origin, packet.target, packet.hit, SHAFT_AIMING_POWER);
        currentBattle.broadcastRaw(relay.write(), relay.getId(), user.id);
        const exit = new ShaftPackets.ShaftAimExitRelayPacket(user.username);
        currentBattle.broadcastRaw(exit.write(), exit.getId(), user.id);

        // Damage only when an actual tank was hit.
        const targetClient = packet.target ? server.findClientByUsername(packet.target) : undefined;
        if (targetClient && targetClient !== client && targetClient.currentBattle === currentBattle && targetClient.battleState === "active") {
            const { to, aimMax } = turretDamage(user);
            await server.battleService.applyDamage(currentBattle, client, targetClient, to + (aimMax - to) * ratio, 0);
        }
    }
}
