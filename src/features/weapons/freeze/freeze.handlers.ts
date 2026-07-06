import { weaponPhysicsData } from "@/config/physics.data";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import { ItemUtils } from "@/utils/item.utils";
import logger from "@/utils/logger";
import { TankSpecificationPacket, TankTemperaturePacket } from "@/features/battle/battle.packets";
import { SupplyService, SUPPLY_SLOT } from "@/features/battle/supply.service";
import * as FreezePackets from "./freeze.packets";

// Freeze cooling/thaw model, calibrated from the 2026-07-01 captures (s4/s5/s6, Temperature packet 581377054 +
// DamageIndicator -1165230470 on "Desert"): each beam tick chills the target toward a -1 floor (the blue tint
// fills to 100%); once the beam stops it warms back to 0. The per-tick chill AND the damage both scale by the
// same distance falloff (capture: point-blank tick chilled -0.1425 / dealt 19; a distant session chilled
// -0.0675 / dealt 9 — same 0.474 factor on both), so FREEZE_STEP is the point-blank chill. Recovery warms
// +0.3 per ~0.5s (capture: -1 → 0 in ~1.7s of ticks). Movement (speed + turn rates, NOT acceleration) scales
// by e^(FREEZE_SLOW_K·temp) — at the -1 floor the tank crawls at ~24% speed. Damage per tick =
// DAMAGE_PER_PERIOD/2 × distance falloff (~19 dmg/tick point-blank for m0=39, ~2 ticks/s).
const FREEZE_DIRECT_DIVISOR = 2;
const FREEZE_STEP = 0.1425; // point-blank chill per beam tick; scaled by the distance falloff (see handler)
const FREEZE_TEMP_CAP = -1;
const FREEZE_SLOW_K = 1.45;
const FREEZE_RECOVERY_TICK_MS = 500;
const FREEZE_RECOVERY_STEP = 0.3;
const FREEZE_IDLE_MS = 700; // no beam contact for this long → start thawing
const FREEZE_RELIEF_STEP = 0.5; // repair-kit relief: warm-up applied per heal tick (see relieveFreeze)

const slowFactor = (temp: number): number => Math.min(1, Math.exp(FREEZE_SLOW_K * temp));

function distanceFactor(a: GameClient, b: GameClient, maxR: number, minR: number, minPct: number): number {
    if (!a.battlePosition || !b.battlePosition) return 1;
    const dx = a.battlePosition.x - b.battlePosition.x, dy = a.battlePosition.y - b.battlePosition.y, dz = a.battlePosition.z - b.battlePosition.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) / 100;
    if (dist <= maxR) return 1;
    return dist >= minR ? minPct : 1 - (1 - minPct) * ((dist - maxR) / (minR - maxR));
}

// Nitro (n2o) movement buff — kept alongside the freeze factor so the combined spec has ONE source of truth.
const NITRO_SPEED_MULT = 1.3;
const NITRO_ACCEL_BONUS = 0.5;

/** Broadcasts the target's EFFECTIVE movement spec, combining every active movement modifier: the nitro
 *  buff (speed×1.3 + acceleration) and the freeze slowdown (speed + turn rates × the temperature factor,
 *  1 = normal). Both nitro and freeze funnel through here so neither clobbers the other — previously freeze
 *  re-sent the raw BASE spec, which wiped an active nitro (the tank stayed at base speed after thawing, as
 *  if the nitro had ended). Acceleration only gets the nitro bonus — freeze doesn't touch it. The bumped
 *  sequence makes the client apply the newer spec. */
export function broadcastMovementSpec(battle: NonNullable<GameClient["currentBattle"]>, target: GameClient): void {
    if (!target.user) return;
    const base = ItemUtils.getTankSpecifications(target.user);
    const nitro = SupplyService.hasEffect(target, SUPPLY_SLOT.NITRO);
    const freeze = slowFactor(target.freezeTemperature); // 1 when not cold
    battle.broadcast(new TankSpecificationPacket({
        nickname: target.user.username,
        speed: base.speed * (nitro ? NITRO_SPEED_MULT : 1) * freeze * target.speedMultiplier, // speedMultiplier = staff /speed (1 = normal)
        maxTurnSpeed: base.maxTurnSpeed * freeze,
        turretTurnSpeed: base.turretTurnSpeed * freeze,
        acceleration: base.acceleration + (nitro ? NITRO_ACCEL_BONUS : 0),
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
        broadcastMovementSpec(battle, tc);
        if (tc.freezeTemperature < 0) scheduleThaw(server, battle, targetName); // else fully thawed: base spec already sent
    });
}

/** Repair-kit relief: warms a frozen tank toward 0 by FREEZE_RELIEF_STEP and re-broadcasts the lighter tint
 *  + un-slowed spec. Called each heal tick (from SupplyService.startHealing), so using a med-kit thaws the
 *  freeze fast — it out-paces the beam even while still under fire. No-op when the tank isn't cold. */
export function relieveFreeze(battle: NonNullable<GameClient["currentBattle"]>, client: GameClient): void {
    if (!client.user || client.freezeTemperature >= 0) return;
    client.freezeTemperature = Math.min(0, client.freezeTemperature + FREEZE_RELIEF_STEP);
    battle.broadcast(new TankTemperaturePacket(client.user.username, client.freezeTemperature));
    broadcastMovementSpec(battle, client);
}

/**
 * Freeze beam tick: the cone can chill SEVERAL tanks at once. Per target — damage (DAMAGE_PER_PERIOD ×
 * distance falloff), chill the temperature toward the -1 floor (blue tint), and slow its movement by
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
            // Friendly fire: skip teammates entirely (no damage AND no chill/slow) — applyDamage would drop
            // the damage but the freeze effect below runs separately, so allies were being frozen anyway.
            if (targetClient.user && currentBattle.isFriendlyBlocked(user, targetClient.user)) continue;
            const factor = distanceFactor(client, targetClient, physics?.max_damage_radius ?? 5, physics?.min_damage_radius ?? 18.39, (physics?.min_damage_percent ?? 30) / 100);

            await server.battleService.applyDamage(currentBattle, client, targetClient, (perPeriod / FREEZE_DIRECT_DIVISOR) * factor, 0);
            if (targetClient.battleState !== "active") continue; // the hit killed it — don't freeze a corpse

            // Chill toward the floor (scaled by the same distance falloff as the damage), blue tint, and slow movement.
            targetClient.freezeTemperature = Math.max(FREEZE_TEMP_CAP, targetClient.freezeTemperature - FREEZE_STEP * factor);
            targetClient.lastFreezeHit = Date.now();
            currentBattle.broadcast(new TankTemperaturePacket(targetName, targetClient.freezeTemperature));
            broadcastMovementSpec(currentBattle, targetClient);
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