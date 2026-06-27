import { weaponPhysicsData } from "@/config/physics.data";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import { ItemUtils } from "@/utils/item.utils";
import logger from "@/utils/logger";
import * as FlamethrowerPackets from "./flamethrower.packets";

// Firebird residual burn: ignited to ~FLAME_TEMPERATURE_LIMIT dmg/sec, decaying linearly to 0 over BURN_SECONDS
// (capture: 6.8 → 1.23 at ~0.93/s ≈ over ~7s), ticking once per second.
const BURN_TICK_MS = 1000;
const BURN_SECONDS = 7;
const FLAME_DIRECT_DIVISOR = 2; // direct hit per tick = DAMAGE_PER_PERIOD/2 (~16 for m0=32, ticks ~2/s)

// Visual "burning" glow (Temperature packet). Calibrated from the m0 capture: each flame contact bumps the
// heat by ~0.1 up to a ~0.2 cap, then it cools ~0.032/s back to 0 over ~7s once the flame leaves.
const FIRE_TEMP_CAP = 0.2;
const FIRE_TEMP_STEP = 0.1;
const FIRE_TEMP_DECAY = 0.032;

function distanceFactor(a: GameClient, b: GameClient, maxR: number, minR: number, minPct: number): number {
    if (!a.battlePosition || !b.battlePosition) return 1;
    const dx = a.battlePosition.x - b.battlePosition.x, dy = a.battlePosition.y - b.battlePosition.y, dz = a.battlePosition.z - b.battlePosition.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) / 100;
    if (dist <= maxR) return 1;
    return dist >= minR ? minPct : 1 - (1 - minPct) * ((dist - maxR) / (minR - maxR));
}

/** Schedules/continues the residual-burn DoT on a target until its temperature decays to 0. Each tick also
 *  cools the visual glow and rebroadcasts it, so the red tint fades in step with the burn after the flame leaves. */
function scheduleBurn(server: GameServer, battle: GameClient["currentBattle"], targetName: string, decayPerTick: number): void {
    if (!battle) return;
    battle.timers.set(`burn:${targetName}`, BURN_TICK_MS, async () => {
        const tc = server.findClientByUsername(targetName);
        // Target died/left while burning. Clear its state and snap the glow off — without this the stale
        // flameTemperature would block the next ignite (no burn) and the red tint would never reset.
        if (!tc || tc.currentBattle !== battle || tc.battleState !== "active" || tc.flameTemperature <= 0) {
            if (tc) {
                tc.flameTemperature = 0;
                tc.visualTemperature = 0;
                tc.flameSource = null;
                if (tc.currentBattle === battle) battle.broadcast(new FlamethrowerPackets.TankTemperaturePacket(targetName, 0));
            }
            return;
        }
        const src = (tc.flameSource ? server.findClientByUsername(tc.flameSource) : null) ?? tc;
        await server.battleService.applyDamage(battle, src, tc, tc.flameTemperature, 0);
        tc.flameTemperature = Math.max(0, tc.flameTemperature - decayPerTick);
        if (tc.flameTemperature > 0) {
            tc.visualTemperature = Math.max(0, tc.visualTemperature - FIRE_TEMP_DECAY);
            battle.broadcast(new FlamethrowerPackets.TankTemperaturePacket(targetName, tc.visualTemperature));
            scheduleBurn(server, battle, targetName, decayPerTick);
        } else {
            // Burn finished — always force the glow fully off (don't rely on the decay rate landing on 0).
            tc.visualTemperature = 0;
            tc.flameSource = null;
            battle.broadcast(new FlamethrowerPackets.TankTemperaturePacket(targetName, 0));
        }
    });
}

/**
 * Firebird flame tick: the flame cone can hit SEVERAL tanks at once (packet.targets). For each, direct damage
 * (DAMAGE_PER_PERIOD/2 × distance falloff — hurts more up close) PLUS it (re)ignites the target's residual
 * burn (FLAME_TEMPERATURE_LIMIT dmg/sec, decaying after the flame leaves) and heats its red "burning" glow.
 */
export class FirebirdHitCommandHandler implements IPacketHandler<FlamethrowerPackets.FirebirdHitCommandPacket> {
    public readonly packetId = FlamethrowerPackets.FirebirdHitCommandPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: FlamethrowerPackets.FirebirdHitCommandPacket): Promise<void> {
        const { user, currentBattle } = client;
        if (!user || !currentBattle || packet.targets.length === 0 || client.battleState !== "active") return;

        const turretMod = ItemUtils.getItemModification(user, "turret");
        const perPeriod = ItemUtils.getPropertyValue(turretMod, "DAMAGE_PER_SECOND", "DAMAGE_PER_PERIOD") ?? 0;
        const tempLimit = ItemUtils.getPropertyValue(turretMod, "FIRE_DAMAGE", "FLAME_TEMPERATURE_LIMIT") ?? 6;
        const physics = weaponPhysicsData.weapons.find((w) => w.id === `${user.equippedTurret}_m${user.turrets.get(user.equippedTurret) ?? 0}`);

        for (const targetName of packet.targets) {
            const targetClient = server.findClientByUsername(targetName);
            if (!targetClient || targetClient === client || targetClient.currentBattle !== currentBattle || targetClient.battleState !== "active") continue;
            const factor = distanceFactor(client, targetClient, physics?.max_damage_radius ?? 5, physics?.min_damage_radius ?? 17, (physics?.min_damage_percent ?? 50) / 100);

            // Direct flame contact.
            await server.battleService.applyDamage(currentBattle, client, targetClient, (perPeriod / FLAME_DIRECT_DIVISOR) * factor, 0);
            if (targetClient.battleState !== "active") continue; // the direct hit killed it — don't ignite a corpse

            // (Re)ignite the residual burn and heat the visual glow, then refresh it on every client.
            targetClient.flameTemperature = tempLimit;
            targetClient.flameSource = user.username;
            targetClient.visualTemperature = Math.min(FIRE_TEMP_CAP, targetClient.visualTemperature + FIRE_TEMP_STEP);
            currentBattle.broadcast(new FlamethrowerPackets.TankTemperaturePacket(targetName, targetClient.visualTemperature));
            // Arm the decay timer only if one isn't already running (re-arming each ~2/s hit would reset the
            // 1s countdown so the tick never fires). Keying off the live timer, not flameTemperature, means a
            // tank left burning at death no longer blocks its next ignite.
            if (!currentBattle.timers.has(`burn:${targetName}`)) scheduleBurn(server, currentBattle, targetName, tempLimit / BURN_SECONDS);
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