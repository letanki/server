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

/** Shaft entered aiming mode → start the sniper charge timer. This is NOT relayed: the laser is only
 *  engaged ~0.5s later (ShaftAimEngaged), which is what drives the aim-enter relay. */
export class ShaftEnterAimingHandler implements IPacketHandler<ShaftPackets.ShaftEnterAimingPacket> {
    public readonly packetId = ShaftPackets.ShaftEnterAimingPacket.getId();
    public execute(client: GameClient): void {
        client.shaftAimStart = Date.now();
    }
}

/** Shaft aiming fully engaged (zoom complete, laser on) → NOW tell the others so their laser starts at
 *  the right moment (~0.5s after enter, matching the official server — relaying on enter showed it early)
 *  and they render aiming as turret-only rotation instead of reading the aim-track as the tank spinning. */
export class ShaftAimEngagedHandler implements IPacketHandler<ShaftPackets.ShaftAimEngagedPacket> {
    public readonly packetId = ShaftPackets.ShaftAimEngagedPacket.getId();
    public execute(client: GameClient): void {
        const { user, currentBattle } = client;
        if (!user || !currentBattle) return;
        const relay = new ShaftPackets.ShaftAimEnterRelayPacket(user.username);
        currentBattle.broadcastRaw(relay.write(), relay.getId(), user.id);
    }
}

/** Shaft left aiming mode (after firing or on cancel) → tell the others so they stop the laser. The
 *  official server drives the exit relay from THIS command (~0.4s after the aim shot), not from the shot
 *  itself — verified in 2026-07-04_23-56_s6-54824.ndjson. */
export class ShaftExitAimingHandler implements IPacketHandler<ShaftPackets.ShaftExitAimingPacket> {
    public readonly packetId = ShaftPackets.ShaftExitAimingPacket.getId();
    public execute(client: GameClient): void {
        const { user, currentBattle } = client;
        if (!user || !currentBattle) return;
        const relay = new ShaftPackets.ShaftAimExitRelayPacket(user.username);
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

        // Relay the beam to the others — hit(s) and miss (wall/void) alike.
        const relay = new ShaftPackets.ShaftShotPacket(user.username, packet.staticHitPoint, packet.targets, packet.localHitPoints, SHAFT_ARCADE_POWER);
        currentBattle.broadcastRaw(relay.write(), relay.getId(), user.id);

        // Damage cada tank perfurado (o shaft atravessa vários).
        const { from, to } = turretDamage(user);
        for (const nick of packet.targets ?? []) {
            const targetClient = server.findClientByUsername(nick);
            if (targetClient && targetClient !== client && targetClient.currentBattle === currentBattle && targetClient.battleState === "active") {
                await server.battleService.applyDamage(currentBattle, client, targetClient, from + Math.random() * (to - from), 0);
            }
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

        // Relay the beam (hit or miss). The aim-EXIT relay is sent separately, driven by the client's
        // ShaftExitAiming (843751647) command that follows the shot — matching the official ordering.
        const relay = new ShaftPackets.ShaftShotPacket(user.username, packet.staticHitPoint, packet.targets, packet.localHitPoints, SHAFT_AIMING_POWER);
        currentBattle.broadcastRaw(relay.write(), relay.getId(), user.id);

        // Damage cada tank perfurado, com o dano de mira carregado.
        const { to, aimMax } = turretDamage(user);
        for (const nick of packet.targets ?? []) {
            const targetClient = server.findClientByUsername(nick);
            if (targetClient && targetClient !== client && targetClient.currentBattle === currentBattle && targetClient.battleState === "active") {
                await server.battleService.applyDamage(currentBattle, client, targetClient, to + (aimMax - to) * ratio, 0);
            }
        }
    }
}
