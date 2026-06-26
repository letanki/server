import { weaponPhysicsData } from "@/config/physics.data";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import { ItemUtils } from "@/utils/item.utils";
import logger from "@/utils/logger";
import * as FlamethrowerPackets from "./flamethrower.packets";

// Each flame tick ("hit record") deals DAMAGE_PER_PERIOD/FLAME_TICKS_PER_PERIOD, scaled by distance.
// Calibrated from the official capture: 21 ticks → 66.57 dmg at close (≈3.17/tick = 32/10).
const FLAME_TICKS_PER_PERIOD = 10;

// Firebird residual burn: ignited to ~FLAME_TEMPERATURE_LIMIT dmg/sec, decaying linearly to 0 over BURN_SECONDS
// (capture: 6.8 → 1.23 at ~0.93/s ≈ over ~7s), ticking once per second.
const BURN_TICK_MS = 1000;
const BURN_SECONDS = 7;
const FLAME_DIRECT_DIVISOR = 2; // direct hit per tick = DAMAGE_PER_PERIOD/2 (~16 for m0=32, ticks ~2/s)

function distanceFactor(a: GameClient, b: GameClient, maxR: number, minR: number, minPct: number): number {
    if (!a.battlePosition || !b.battlePosition) return 1;
    const dx = a.battlePosition.x - b.battlePosition.x, dy = a.battlePosition.y - b.battlePosition.y, dz = a.battlePosition.z - b.battlePosition.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) / 100;
    if (dist <= maxR) return 1;
    return dist >= minR ? minPct : 1 - (1 - minPct) * ((dist - maxR) / (minR - maxR));
}

/** Schedules/continues the residual-burn DoT on a target until its temperature decays to 0. */
function scheduleBurn(server: GameServer, battle: GameClient["currentBattle"], targetName: string, decayPerTick: number): void {
    if (!battle) return;
    battle.timers.set(`burn:${targetName}`, BURN_TICK_MS, async () => {
        const tc = server.findClientByUsername(targetName);
        if (!tc || tc.currentBattle !== battle || tc.battleState !== "active" || tc.flameTemperature <= 0) {
            if (tc) tc.flameTemperature = 0;
            return;
        }
        const src = (tc.flameSource ? server.findClientByUsername(tc.flameSource) : null) ?? tc;
        await server.battleService.applyDamage(battle, src, tc, tc.flameTemperature, 0);
        tc.flameTemperature = Math.max(0, tc.flameTemperature - decayPerTick);
        if (tc.flameTemperature > 0) scheduleBurn(server, battle, targetName, decayPerTick);
    });
}

/**
 * Firebird flame tick: direct damage (DAMAGE_PER_PERIOD/2 × distance falloff — hurts more up close) PLUS it
 * (re)ignites the target's residual burn (FLAME_TEMPERATURE_LIMIT dmg/sec, decaying after the flame leaves).
 */
export class FirebirdHitCommandHandler implements IPacketHandler<FlamethrowerPackets.FirebirdHitCommandPacket> {
    public readonly packetId = FlamethrowerPackets.FirebirdHitCommandPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: FlamethrowerPackets.FirebirdHitCommandPacket): Promise<void> {
        const { user, currentBattle } = client;
        if (!user || !currentBattle || !packet.target || client.battleState !== "active") return;
        const targetClient = server.findClientByUsername(packet.target);
        if (!targetClient || targetClient === client || targetClient.currentBattle !== currentBattle || targetClient.battleState !== "active") return;

        const turretMod = ItemUtils.getItemModification(user, "turret");
        const perPeriod = ItemUtils.getPropertyValue(turretMod, "DAMAGE_PER_SECOND", "DAMAGE_PER_PERIOD") ?? 0;
        const tempLimit = ItemUtils.getPropertyValue(turretMod, "FIRE_DAMAGE", "FLAME_TEMPERATURE_LIMIT") ?? 6;
        const physics = weaponPhysicsData.weapons.find((w) => w.id === `${user.equippedTurret}_m${user.turrets.get(user.equippedTurret) ?? 0}`);
        const factor = distanceFactor(client, targetClient, physics?.max_damage_radius ?? 5, physics?.min_damage_radius ?? 17, (physics?.min_damage_percent ?? 50) / 100);

        // Direct flame contact.
        await server.battleService.applyDamage(currentBattle, client, targetClient, (perPeriod / FLAME_DIRECT_DIVISOR) * factor, 0);

        // (Re)ignite the residual burn and (re)start its decay timer.
        const wasBurning = targetClient.flameTemperature > 0;
        targetClient.flameTemperature = tempLimit;
        targetClient.flameSource = user.username;
        if (!wasBurning) scheduleBurn(server, currentBattle, packet.target, tempLimit / BURN_SECONDS);
    }
}

/**
 * Flame damage: for each tank touched this period, damage = ticks × (DAMAGE_PER_PERIOD/10) × distance
 * falloff (full within max_damage_radius, down to min_damage_percent% at min_damage_radius — the flame
 * hurts more up close). NOTE: the post-flame BURN (FLAME_TEMPERATURE_LIMIT residual DoT) isn't modelled yet.
 */
export class FlamethrowerHitCommandHandler implements IPacketHandler<FlamethrowerPackets.FlamethrowerHitCommandPacket> {
    public readonly packetId = FlamethrowerPackets.FlamethrowerHitCommandPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: FlamethrowerPackets.FlamethrowerHitCommandPacket): Promise<void> {
        const { user, currentBattle } = client;
        if (!user || !currentBattle || client.battleState !== "active" || packet.hitsByTarget.size === 0) return;

        const turretMod = ItemUtils.getItemModification(user, "turret");
        const perPeriod = ItemUtils.getPropertyValue(turretMod, "DAMAGE_PER_SECOND", "DAMAGE_PER_PERIOD") ?? 0;
        const perTick = perPeriod / FLAME_TICKS_PER_PERIOD;
        const physics = weaponPhysicsData.weapons.find((w) => w.id === `${user.equippedTurret}_m${user.turrets.get(user.equippedTurret) ?? 0}`);
        const maxR = physics?.max_damage_radius ?? 5;
        const minR = physics?.min_damage_radius ?? 17;
        const minPct = (physics?.min_damage_percent ?? 50) / 100;

        for (const [target, ticks] of packet.hitsByTarget) {
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
            await server.battleService.applyDamage(currentBattle, client, targetClient, ticks * perTick * factor, 0);
        }
    }
}

export class StartShootingFlamethrowerCommandHandler implements IPacketHandler<FlamethrowerPackets.StartShootingFlamethrowerCommandPacket> {
    public readonly packetId = FlamethrowerPackets.StartShootingFlamethrowerCommandPacket.getId();
    public execute(client: GameClient, server: GameServer, packet: FlamethrowerPackets.StartShootingFlamethrowerCommandPacket): void {
        const { user, currentBattle } = client;
        if (!user || !currentBattle) {
            logger.warn("StartShootingFlamethrowerCommandHandler received a packet from a client not in a battle.", { client: client.getRemoteAddress() });
            return;
        }
        const startShootingPacket = new FlamethrowerPackets.StartShootingFlamethrowerPacket(user.username);
        const allParticipants = currentBattle.getAllParticipants();
        for (const participant of allParticipants) {
            if (participant.id === user.id) {
                continue;
            }
            const otherClient = server.findClientByUsername(participant.username);
            if (otherClient && otherClient.currentBattle?.battleId === currentBattle.battleId) {
                otherClient.sendPacket(startShootingPacket);
            }
        }
    }
}

export class StopShootingFlamethrowerCommandHandler implements IPacketHandler<FlamethrowerPackets.StopShootingFlamethrowerCommandPacket> {
    public readonly packetId = FlamethrowerPackets.StopShootingFlamethrowerCommandPacket.getId();
    public execute(client: GameClient, server: GameServer, packet: FlamethrowerPackets.StopShootingFlamethrowerCommandPacket): void {
        const { user, currentBattle } = client;
        if (!user || !currentBattle) {
            logger.warn("StopShootingFlamethrowerCommandHandler received a packet from a client not in a battle.", { client: client.getRemoteAddress() });
            return;
        }
        const stopShootingPacket = new FlamethrowerPackets.StopShootingFlamethrowerPacket(user.username);
        const allParticipants = currentBattle.getAllParticipants();
        for (const participant of allParticipants) {
            if (participant.id === user.id) {
                continue;
            }
            const otherClient = server.findClientByUsername(participant.username);
            if (otherClient && otherClient.currentBattle?.battleId === currentBattle.battleId) {
                otherClient.sendPacket(stopShootingPacket);
            }
        }
    }
}