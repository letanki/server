import { weaponPhysicsData } from "@/config/physics.data";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import { ItemUtils } from "@/utils/item.utils";
import logger from "@/utils/logger";
import { TankSpecificationPacket, TankTemperaturePacket } from "@/features/battle/battle.packets";
import * as FreezePackets from "./freeze.packets";

// Freeze cooling/thaw model, calibrated from the m0 capture (FuscaVerde under Danlino's freeze):
// each beam tick chills the target by ~0.1 down to a ~-0.5 floor (blue tint); once the beam stops it warms
// back to 0 at ~0.4/s. Movement (speed + turn rates, NOT acceleration) scales by e^(2.9·temp) — at the -0.5
// floor the tank crawls at ~24% speed. Damage per tick = DAMAGE_PER_PERIOD/2 × distance falloff (capture:
// ~20.7 dmg/tick at point-blank for m0=39, ticks ~2/s, matching the Firebird's per-tick divisor).
const FREEZE_DIRECT_DIVISOR = 2;
const FREEZE_STEP = 0.1;
const FREEZE_TEMP_CAP = -0.5;
const FREEZE_SLOW_K = 2.9;
const FREEZE_RECOVERY_TICK_MS = 250;
const FREEZE_RECOVERY_STEP = 0.1;
const FREEZE_IDLE_MS = 700; // no beam contact for this long → start thawing

const slowFactor = (temp: number): number => Math.min(1, Math.exp(FREEZE_SLOW_K * temp));

function distanceFactor(a: GameClient, b: GameClient, maxR: number, minR: number, minPct: number): number {
    if (!a.battlePosition || !b.battlePosition) return 1;
    const dx = a.battlePosition.x - b.battlePosition.x, dy = a.battlePosition.y - b.battlePosition.y, dz = a.battlePosition.z - b.battlePosition.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) / 100;
    if (dist <= maxR) return 1;
    return dist >= minR ? minPct : 1 - (1 - minPct) * ((dist - maxR) / (minR - maxR));
}

/** Resends the target's movement spec scaled by its freeze temperature (1 = normal). Acceleration is left
 *  at base — only top speed and turn rates slow down. The bumped sequence makes the client apply the newer one. */
function broadcastFreezeSpec(battle: NonNullable<GameClient["currentBattle"]>, target: GameClient, factor: number): void {
    if (!target.user) return;
    const base = ItemUtils.getTankSpecifications(target.user);
    battle.broadcast(new TankSpecificationPacket({
        nickname: target.user.username,
        speed: base.speed * factor,
        maxTurnSpeed: base.maxTurnSpeed * factor,
        turretTurnSpeed: base.turretTurnSpeed * factor,
        acceleration: base.acceleration,
        sequence: ++target.specSequence,
    }));
}

/** Warms a frozen tank back to normal once the beam stops touching it: each tick raises the temperature,
 *  re-sends a less-slowed spec and the lighter tint, until it reaches 0 and full speed is restored. */
function scheduleThaw(server: GameServer, battle: NonNullable<GameClient["currentBattle"]>, targetName: string): void {
    battle.timers.set(`freeze:${targetName}`, FREEZE_RECOVERY_TICK_MS, () => {
        const tc = server.findClientByUsername(targetName);
        // Died/left: drop the state so the next freeze re-arms cleanly (respawn re-sends a fresh base spec).
        if (!tc || tc.currentBattle !== battle || tc.battleState !== "active") { if (tc) tc.freezeTemperature = 0; return; }
        // Still being frozen — hold; the hit handler keeps it cold and re-sends the slowed spec.
        if (Date.now() - tc.lastFreezeHit < FREEZE_IDLE_MS) { scheduleThaw(server, battle, targetName); return; }

        tc.freezeTemperature = Math.min(0, tc.freezeTemperature + FREEZE_RECOVERY_STEP);
        battle.broadcast(new TankTemperaturePacket(targetName, tc.freezeTemperature));
        broadcastFreezeSpec(battle, tc, slowFactor(tc.freezeTemperature));
        if (tc.freezeTemperature < 0) scheduleThaw(server, battle, targetName); // else fully thawed: base spec already sent
    });
}

/**
 * Freeze beam tick: the cone can chill SEVERAL tanks at once. Per target — damage (DAMAGE_PER_PERIOD ×
 * distance falloff), chill the temperature toward the -0.5 floor (blue tint), and slow its movement by
 * re-sending the spec. A thaw timer warms it back up once the beam stops.
 */
export class FreezeHitCommandHandler implements IPacketHandler<FreezePackets.FreezeHitCommandPacket> {
    public readonly packetId = FreezePackets.FreezeHitCommandPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: FreezePackets.FreezeHitCommandPacket): Promise<void> {
        const { user, currentBattle } = client;
        if (!user || !currentBattle || packet.targets.length === 0 || client.battleState !== "active") return;

        const turretMod = ItemUtils.getItemModification(user, "turret");
        const perPeriod = ItemUtils.getPropertyValue(turretMod, "DAMAGE_PER_SECOND", "DAMAGE_PER_PERIOD") ?? 0;
        const physics = weaponPhysicsData.weapons.find((w) => w.id === `${user.equippedTurret}_m${user.turrets.get(user.equippedTurret) ?? 0}`);

        for (const targetName of packet.targets) {
            const targetClient = server.findClientByUsername(targetName);
            if (!targetClient || targetClient === client || targetClient.currentBattle !== currentBattle || targetClient.battleState !== "active") continue;
            const factor = distanceFactor(client, targetClient, physics?.max_damage_radius ?? 5, physics?.min_damage_radius ?? 18.39, (physics?.min_damage_percent ?? 30) / 100);

            await server.battleService.applyDamage(currentBattle, client, targetClient, (perPeriod / FREEZE_DIRECT_DIVISOR) * factor, 0);
            if (targetClient.battleState !== "active") continue; // the hit killed it — don't freeze a corpse

            // Chill toward the floor, blue tint, and slow its movement.
            targetClient.freezeTemperature = Math.max(FREEZE_TEMP_CAP, targetClient.freezeTemperature - FREEZE_STEP);
            targetClient.lastFreezeHit = Date.now();
            currentBattle.broadcast(new TankTemperaturePacket(targetName, targetClient.freezeTemperature));
            broadcastFreezeSpec(currentBattle, targetClient, slowFactor(targetClient.freezeTemperature));
            if (!currentBattle.timers.has(`freeze:${targetName}`)) scheduleThaw(server, currentBattle, targetName);
        }
    }
}

export class StartShootingFreezeCommandHandler implements IPacketHandler<FreezePackets.StartShootingFreezeCommandPacket> {
    public readonly packetId = FreezePackets.StartShootingFreezeCommandPacket.getId();
    public execute(client: GameClient, server: GameServer, packet: FreezePackets.StartShootingFreezeCommandPacket): void {
        const { user, currentBattle } = client;
        if (!user || !currentBattle) {
            logger.warn("StartShootingFreezeCommandHandler received a packet from a client not in a battle.", { client: client.getRemoteAddress() });
            return;
        }
        const startShootingPacket = new FreezePackets.StartShootingFreezePacket(user.username);
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

export class StopShootingFreezeCommandHandler implements IPacketHandler<FreezePackets.StopShootingFreezeCommandPacket> {
    public readonly packetId = FreezePackets.StopShootingFreezeCommandPacket.getId();
    public execute(client: GameClient, server: GameServer, packet: FreezePackets.StopShootingFreezeCommandPacket): void {
        const { user, currentBattle } = client;
        if (!user || !currentBattle) {
            logger.warn("StopShootingFreezeCommandHandler received a packet from a client not in a battle.", { client: client.getRemoteAddress() });
            return;
        }
        const stopShootingPacket = new FreezePackets.StopShootingFreezePacket(user.username);
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