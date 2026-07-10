import { weaponPhysicsData } from "@/config/physics.data";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import { ItemUtils } from "@/utils/item.utils";
import logger from "@/utils/logger";
import { TankTemperaturePacket } from "@/features/battle/battle.packets";
import * as MachinegunPackets from "./machinegun.packets";

// Vulcan overheat, calibrated from THREE official captures (2026-07-06: s1-49319 m3/500hp full ramp + two
// health activations; s2-59778 m3 four firing pauses incl. a residual-burn death; s3-51423 m0/titan-336hp
// which DISAMBIGUATED the mod-dependence — supersedes the earlier partial m0 "0.22 cap" misread). Model:
// • GRACE: fire continuously for temperatureHittingTime (physics special_entity: 4390ms m0 … 7000ms m3)
//   before the barrel heats (confirmed on both mods: temp starts grace+~0.7s after the first shot cmd).
//   The grace RE-APPLIES on every trigger resume — even a 2.6s pause with heat remaining restarts it, and
//   during the fresh grace the heat keeps COOLING while already firing (s2: 0.73 → fell to 0.44 over
//   ~7.7s of resumed fire, then climbed again).
// • RAMP: past the grace, +0.01 PER SHOT COMMAND — tied to the burst cadence, which is mod-specific
//   (m0 ~264ms, m3 ~285ms), so the heat is accrued in the shot handler, not on a clock. Cap 1.0.
// • SELF-BURN: `30 real HP × heat` per second — MOD/DPS-INDEPENDENT (m3/500hp: 600 norm/s at heat 1.0;
//   m0/titan-336hp: damage tick = 892 norm × heat = the same 30 real; a DPS-scaled model only fit m3 by
//   the 60×0.5=30 coincidence and is off by 2.2× on m0). Keeps burning through pauses — s2 shows a death
//   from residual burn after releasing. Matches HEAL_HP_PER_TICK×... no relation, just 30.
// • COOLDOWN: whenever not (firing && past grace), heat falls a constant −0.032/s (both mods, exact:
//   0.618→0.010 in 19×1s ticks; full scale ≈ 31s). Firing is "over" after ~spinDownTime (1500ms) without
//   a shot command.
// • HEALTH KIT: each 0.5s heal tick shaves −0.12 heat (relieveMachinegunHeat, wired into SupplyService),
//   the ramp still adding +0.01/shot underneath (both mods: relief steps of exactly −0.12).
const MG_HEAT_CAP = 1.0;
const MG_RAMP_PER_SHOT = 0.01;       // heat added per shot command past the grace (mod-independent)
const MG_COOL_PER_MS = 0.032 / 1000; // constant cooldown (both captures: −0.032 per 1s tick)
const MG_SELF_BURN_HP_PER_SEC = 30;  // self-burn real HP/s at heat 1.0, × current heat (mod-independent)
const MG_HEAL_RELIEF = 0.12;        // heat shaved per repair-kit heal tick (capture: 1.00→0 in ~9 ticks under fire)
const MG_OVERHEAT_TICK_MS = 500;
const MG_FIRE_GAP_MS = 1500;        // no shot for this long ⇒ trigger released (heatTime resets, grace re-applies)
const MG_SHOT_MIN_MS = 50, MG_SHOT_MAX_MS = 300; // clamp for per-shot elapsed time (target damage)
const MG_GRACE_FALLBACK_MS = 4390; // used only if physics is missing

function distanceFactor(a: GameClient, b: GameClient, maxR: number, minR: number, minPct: number): number {
    if (!a.battlePosition || !b.battlePosition) return 1;
    const dx = a.battlePosition.x - b.battlePosition.x, dy = a.battlePosition.y - b.battlePosition.y, dz = a.battlePosition.z - b.battlePosition.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) / 100;
    if (dist <= maxR) return 1;
    return dist >= minR ? minPct : 1 - (1 - minPct) * ((dist - maxR) / (minR - maxR));
}

/** Drives the shooter's overheat while/after they hold the trigger: ramps the heat (red tint) past the grace
 *  period, burns them for it, and cools back down once they stop. Self-clears on death/full cooldown. */
function scheduleOverheat(server: GameServer, battle: NonNullable<GameClient["currentBattle"]>, name: string, graceMs: number): void {
    battle.timers.set(`overheat:${name}`, MG_OVERHEAT_TICK_MS, async () => {
        const sc = server.findClientByUsername(name);
        if (!sc || sc.currentBattle !== battle || sc.battleState !== "active") {
            if (sc) { sc.machinegunHeat = 0; sc.machinegunHeatTime = 0; }
            return;
        }
        const firing = Date.now() - sc.lastMachinegunShot < MG_FIRE_GAP_MS;
        // Continuous-fire clock: resets on release, so the grace RE-APPLIES on every trigger resume.
        // The climb itself happens in the SHOT handler (+0.01 per shot command past the grace).
        sc.machinegunHeatTime = firing ? sc.machinegunHeatTime + MG_OVERHEAT_TICK_MS : 0;
        if (!(firing && sc.machinegunHeatTime > graceMs)) {
            // Constant cooldown — runs when released AND during a fresh grace while firing (per capture).
            sc.machinegunHeat = Math.max(0, sc.machinegunHeat - MG_COOL_PER_MS * MG_OVERHEAT_TICK_MS);
        }
        battle.broadcast(new TankTemperaturePacket(name, sc.machinegunHeat));
        if (sc.machinegunHeat > 0) {
            // Self-burn scales with the CURRENT heat: 30 real HP × heat per second (mod-independent).
            const selfReal = MG_SELF_BURN_HP_PER_SEC * sc.machinegunHeat * (MG_OVERHEAT_TICK_MS / 1000);
            await server.battleService.applyDamage(battle, sc, sc, selfReal, 0);
            if (sc.battleState === "active") scheduleOverheat(server, battle, name, graceMs);
        } else if (firing) {
            scheduleOverheat(server, battle, name, graceMs);
        }
    });
}

/** Using a health kit cools an overheating Vulcan barrel: each heal tick shaves the shooter's heat by
 *  MG_HEAL_RELIEF (capture: −0.12/tick, temp 1.00→0 in ~9 ticks while STILL firing). Called from
 *  SupplyService's heal tick like relieveBurn/relieveFreeze; no-op when the barrel is cold. The overheat
 *  timer keeps ramping/burning underneath — beating the heat to 0 just restarts the climb (no new grace). */
export function relieveMachinegunHeat(battle: NonNullable<GameClient["currentBattle"]>, client: GameClient): void {
    if (!client.user || client.machinegunHeat <= 0) return;
    client.machinegunHeat = Math.max(0, client.machinegunHeat - MG_HEAL_RELIEF);
    battle.broadcast(new TankTemperaturePacket(client.user.username, client.machinegunHeat));
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

        const startShootingPacket = new MachinegunPackets.StartShootingMachinegunPacket({ nickname: user.username });
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

        // Track continuous fire and arm the overheat loop (cooldown + self-burn + tint broadcast).
        client.lastMachinegunShot = now;
        const special = physics?.special_entity as any;
        const graceMs = special?.temperatureHittingTime ?? MG_GRACE_FALLBACK_MS;
        // Heat climbs PER SHOT COMMAND once continuous fire outlasts the grace — tied to the burst
        // cadence (mod-specific: m0 ~264ms, m3 ~285ms), exactly like the official ramp.
        if (client.machinegunHeatTime > graceMs) {
            client.machinegunHeat = Math.min(MG_HEAT_CAP, client.machinegunHeat + MG_RAMP_PER_SHOT);
        }
        if (!currentBattle.timers.has(`overheat:${user.username}`)) {
            scheduleOverheat(server, currentBattle, user.username, graceMs);
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
        const stopShootingPacket = new MachinegunPackets.StopShootingMachinegunPacket({ nickname: user.username });
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