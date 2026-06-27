import { weaponPhysicsData } from "@/config/physics.data";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import { ItemUtils } from "@/utils/item.utils";
import logger from "@/utils/logger";
import { TankTemperaturePacket } from "@/features/battle/battle.packets";
import * as MachinegunPackets from "./machinegun.packets";

// Vulcan overheat, calibrated from the m0 capture (FuscaVerde): you may fire for the weapon's
// temperatureHittingTime (physics special_entity, = WEAPON_RELOAD_TIME×1000: 4390ms m0 … 7000ms m3) before
// the barrel heats; after that the heat ramps over that same time to a ~0.22 cap (red tint) and burns the
// shooter (~702 normalized/s ≈ weapon DPS × 0.31 at the cap). Pausing cools it back to 0 over spinDownTime,
// the residual heat still burning meanwhile. Sustained fire can cook the shooter to death.
// Cap and self-burn fraction aren't in the equipment configs (empirical from the capture); the grace/ramp
// time and the cooldown ARE read per-mod from physics (see the call site).
const MG_HEAT_CAP = 0.22;
const MG_SELF_BURN_FRACTION = 0.31; // self-burn DPS at the cap = weapon DPS × this
const MG_OVERHEAT_TICK_MS = 500;
const MG_FIRE_GAP_MS = 600;         // no shot for this long ⇒ no longer firing (start cooling)
const MG_SHOT_MIN_MS = 50, MG_SHOT_MAX_MS = 300; // clamp for per-shot elapsed time (target damage)
const MG_GRACE_FALLBACK_MS = 4390, MG_COOL_FALLBACK_MS = 1500; // used only if physics is missing

function distanceFactor(a: GameClient, b: GameClient, maxR: number, minR: number, minPct: number): number {
    if (!a.battlePosition || !b.battlePosition) return 1;
    const dx = a.battlePosition.x - b.battlePosition.x, dy = a.battlePosition.y - b.battlePosition.y, dz = a.battlePosition.z - b.battlePosition.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) / 100;
    if (dist <= maxR) return 1;
    return dist >= minR ? minPct : 1 - (1 - minPct) * ((dist - maxR) / (minR - maxR));
}

/** Drives the shooter's overheat while/after they hold the trigger: ramps the heat (red tint) past the grace
 *  period, burns them for it, and cools back down once they stop. Self-clears on death/full cooldown. */
function scheduleOverheat(server: GameServer, battle: NonNullable<GameClient["currentBattle"]>, name: string, graceMs: number, coolMs: number, dps: number): void {
    battle.timers.set(`overheat:${name}`, MG_OVERHEAT_TICK_MS, async () => {
        const sc = server.findClientByUsername(name);
        if (!sc || sc.currentBattle !== battle || sc.battleState !== "active") {
            if (sc) { sc.machinegunHeat = 0; sc.machinegunHeatTime = 0; }
            return;
        }
        const firing = Date.now() - sc.lastMachinegunShot < MG_FIRE_GAP_MS;
        if (firing) {
            sc.machinegunHeatTime += MG_OVERHEAT_TICK_MS;
            const past = Math.max(0, sc.machinegunHeatTime - graceMs); // grace then ramp over the same time
            sc.machinegunHeat = Math.min(MG_HEAT_CAP, (past / graceMs) * MG_HEAT_CAP);
        } else {
            sc.machinegunHeatTime = 0;
            sc.machinegunHeat = Math.max(0, sc.machinegunHeat - MG_HEAT_CAP * (MG_OVERHEAT_TICK_MS / coolMs));
        }
        battle.broadcast(new TankTemperaturePacket(name, sc.machinegunHeat));
        if (sc.machinegunHeat > 0) {
            const selfReal = dps * MG_SELF_BURN_FRACTION * (sc.machinegunHeat / MG_HEAT_CAP) * (MG_OVERHEAT_TICK_MS / 1000);
            await server.battleService.applyDamage(battle, sc, sc, selfReal, 0);
            if (sc.battleState === "active") scheduleOverheat(server, battle, name, graceMs, coolMs, dps);
        } else if (firing) {
            scheduleOverheat(server, battle, name, graceMs, coolMs, dps);
        }
    });
}

export class StartShootingMachinegunCommandHandler implements IPacketHandler<MachinegunPackets.StartShootingMachinegunCommandPacket> {
    public readonly packetId = MachinegunPackets.StartShootingMachinegunCommandPacket.getId();
    public execute(client: GameClient, server: GameServer, packet: MachinegunPackets.StartShootingMachinegunCommandPacket): void {
        const { user, currentBattle } = client;
        if (!user || !currentBattle) {
            logger.warn("StartShootingMachinegunCommandHandler received packet from a client not in a battle.", { client: client.getRemoteAddress() });
            return;
        }
        // Fresh trigger pull: reset the continuous-fire clock so the grace period starts over.
        client.machinegunHeatTime = 0;
        client.lastMachinegunShot = Date.now();

        const startShootingPacket = new MachinegunPackets.StartShootingMachinegunPacket(user.username);
        const allParticipants = currentBattle.getAllParticipants();
        for (const participant of allParticipants) {
            if (participant.id === user.id) continue;
            const otherClient = server.findClientByUsername(participant.username);
            if (otherClient && otherClient.currentBattle?.battleId === currentBattle.battleId) {
                otherClient.sendPacket(startShootingPacket);
            }
        }
    }
}

export class MachinegunShotCommandHandler implements IPacketHandler<MachinegunPackets.MachinegunShotCommandPacket> {
    public readonly packetId = MachinegunPackets.MachinegunShotCommandPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: MachinegunPackets.MachinegunShotCommandPacket): Promise<void> {
        const { user, currentBattle } = client;
        if (!user || !currentBattle) {
            logger.warn("MachinegunShotCommandHandler received packet from a client not in a battle.", { client: client.getRemoteAddress() });
            return;
        }

        // Relay the burst (cone + per-target impacts) to the others.
        const shotPacket = new MachinegunPackets.MachinegunShotPacket({
            nickname: user.username,
            shotDirection: packet.shotDirection,
            targets: packet.targets.map((targetCmd) => ({
                nickname: targetCmd.nickname,
                localHitPoint: targetCmd.localHitPoint,
                direction: packet.shotDirection,
                numberHits: 1,
            })),
        });
        const allParticipants = currentBattle.getAllParticipants();
        for (const participant of allParticipants) {
            if (participant.id === user.id) continue;
            const otherClient = server.findClientByUsername(participant.username);
            if (otherClient && otherClient.currentBattle?.battleId === currentBattle.battleId) {
                otherClient.sendPacket(shotPacket);
            }
        }

        if (client.battleState !== "active") return;

        // Damage accrues by TIME: the machinegun is a continuous DPS weapon, so each burst command deals
        // DAMAGE_PER_PERIOD (≈ DPS) × seconds-since-last-shot × distance falloff to each tank it hit.
        const turretMod = ItemUtils.getItemModification(user, "turret");
        const dps = ItemUtils.getPropertyValue(turretMod, "DAMAGE_PER_SECOND", "DAMAGE_PER_PERIOD") ?? 0;
        const physics = weaponPhysicsData.weapons.find((w) => w.id === `${user.equippedTurret}_m${user.turrets.get(user.equippedTurret) ?? 0}`);
        const now = Date.now();
        const elapsed = Math.min(MG_SHOT_MAX_MS, Math.max(MG_SHOT_MIN_MS, now - client.lastMachinegunShot)) / 1000;

        for (const target of packet.targets) {
            if (!target.nickname) continue;
            const targetClient = server.findClientByUsername(target.nickname);
            if (!targetClient || targetClient === client || targetClient.currentBattle !== currentBattle || targetClient.battleState !== "active") continue;
            const factor = distanceFactor(client, targetClient, physics?.max_damage_radius ?? 33, physics?.min_damage_radius ?? 130, (physics?.min_damage_percent ?? 25) / 100);
            await server.battleService.applyDamage(currentBattle, client, targetClient, dps * elapsed * factor, 0);
        }

        // Track continuous fire and arm the overheat loop (the barrel heats only past the grace period).
        client.lastMachinegunShot = now;
        if (!currentBattle.timers.has(`overheat:${user.username}`)) {
            const special = physics?.special_entity as any;
            const graceMs = special?.temperatureHittingTime ?? MG_GRACE_FALLBACK_MS;
            const coolMs = special?.spinDownTime ?? MG_COOL_FALLBACK_MS;
            scheduleOverheat(server, currentBattle, user.username, graceMs, coolMs, dps);
        }
    }
}

export class StopShootingMachinegunCommandHandler implements IPacketHandler<MachinegunPackets.StopShootingMachinegunCommandPacket> {
    public readonly packetId = MachinegunPackets.StopShootingMachinegunCommandPacket.getId();
    public execute(client: GameClient, server: GameServer, packet: MachinegunPackets.StopShootingMachinegunCommandPacket): void {
        const { user, currentBattle } = client;
        if (!user || !currentBattle) {
            logger.warn("StopShootingMachinegunCommandHandler received packet from a client not in a battle.", { client: client.getRemoteAddress() });
            return;
        }
        const stopShootingPacket = new MachinegunPackets.StopShootingMachinegunPacket(user.username);
        const allParticipants = currentBattle.getAllParticipants();
        for (const participant of allParticipants) {
            if (participant.id === user.id) continue;
            const otherClient = server.findClientByUsername(participant.username);
            if (otherClient && otherClient.currentBattle?.battleId === currentBattle.battleId) {
                otherClient.sendPacket(stopShootingPacket);
            }
        }
    }
}