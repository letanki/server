import { weaponPhysicsData } from "@/config/physics.data";
import { isReportedHitValid } from "@/features/weapons/hit-validation";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import { ItemUtils } from "@/utils/item.utils";
import logger from "@/utils/logger";
import { TankTemperaturePacket } from "@/features/battle/battle.packets";
import * as FlamethrowerPackets from "./flamethrower.packets";

// Firebird burn = a single "heat" value (visualTemperature 0..1) that drives BOTH the red glow AND the residual
// burn damage. Each flame contact heats +FIRE_TEMP_STEP toward 1.0; once the flame leaves it cools at
// FIRE_TEMP_DECAY/sec down to 0. The burn DoT each 1s tick = FLAME_TEMPERATURE_LIMIT × heat (min BURN_MIN_DAMAGE),
// so it ramps up WITH the heat while flaming and fades WITH it afterward. Calibrated from the 2026-07-01 captures
// (s1/s2, Temperature packet 581377054 + DamageIndicator -1165230470 on "Desert"): heat climbs +0.1 per contact
// (10 hits → full), then cools 0.032/tick so a full-heat tank burns for ~31s, the burn dmg tracking the heat
// (7.5 → … → 1.0 floor over that time). Direct contact is separate (DAMAGE_PER_PERIOD/2 × falloff, ~2 ticks/s).
const BURN_TICK_MS = 1000;
const FLAME_DIRECT_DIVISOR = 2; // direct hit per tick = DAMAGE_PER_PERIOD/2 (~16 for m0=32, ticks ~2/s)
const BURN_MIN_DAMAGE = 1; // burn DoT floor: while any heat remains it deals at least this per tick (capture floor)

// Heat axis (Temperature packet): +FIRE_TEMP_STEP per flame contact toward a 1.0 cap (red tint fills to 100%),
// cooling FIRE_TEMP_DECAY per 1s tick back to 0 (1.0/0.032 ≈ 31s) once the flame leaves.
const FIRE_TEMP_CAP = 1.0;
const FIRE_TEMP_STEP = 0.1;
const FIRE_TEMP_DECAY = 0.032;
// Repair-kit relief applied per heal tick (see relieveBurn): cooling the heat cuts glow AND burn together.
const BURN_RELIEF_GLOW = 0.5; // cool the heat this much each heal tick

function distanceFactor(a: GameClient, b: GameClient, maxR: number, minR: number, minPct: number): number {
    if (!a.battlePosition || !b.battlePosition) return 1;
    const dx = a.battlePosition.x - b.battlePosition.x, dy = a.battlePosition.y - b.battlePosition.y, dz = a.battlePosition.z - b.battlePosition.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) / 100;
    if (dist <= maxR) return 1;
    return dist >= minR ? minPct : 1 - (1 - minPct) * ((dist - maxR) / (minR - maxR));
}

/** Schedules/continues the residual-burn DoT on a target until its heat decays to 0. Each 1s tick deals
 *  FLAME_TEMPERATURE_LIMIT × heat (min BURN_MIN_DAMAGE), then cools the heat and rebroadcasts it — so both the
 *  burn damage and the red tint fade together in step with the heat after the flame leaves. tempLimit is fixed
 *  from the igniting hit. */
function scheduleBurn(server: GameServer, battle: GameClient["currentBattle"], targetName: string, tempLimit: number): void {
    if (!battle) return;
    battle.timers.set(`burn:${targetName}`, BURN_TICK_MS, async () => {
        const tc = server.findClientByUsername(targetName);
        // Target died/left / fully cooled. Clear its state and snap the glow off — without this the stale heat
        // would block the next ignite and the red tint would never reset.
        if (!tc || tc.currentBattle !== battle || tc.battleState !== "active" || tc.visualTemperature <= 0) {
            if (tc) {
                tc.visualTemperature = 0;
                tc.flameSource = null;
                if (tc.currentBattle === battle) battle.broadcast(new TankTemperaturePacket(targetName, 0));
            }
            return;
        }
        const src = (tc.flameSource ? server.findClientByUsername(tc.flameSource) : null) ?? tc;
        await server.battleService.applyDamage(battle, src, tc, Math.max(BURN_MIN_DAMAGE, tempLimit * tc.visualTemperature), 0);
        tc.visualTemperature = Math.max(0, tc.visualTemperature - FIRE_TEMP_DECAY);
        if (tc.visualTemperature > 0) {
            battle.broadcast(new TankTemperaturePacket(targetName, tc.visualTemperature));
            scheduleBurn(server, battle, targetName, tempLimit);
        } else {
            // Burn finished — always force the glow fully off (don't rely on the decay rate landing on 0).
            tc.flameSource = null;
            battle.broadcast(new TankTemperaturePacket(targetName, 0));
        }
    });
}

/** Repair-kit relief: cuts the residual-burn DoT and the red glow sharply and rebroadcasts the fainter tint.
 *  Called each heal tick (from SupplyService.startHealing), so using a med-kit puts a fire out fast. Once the
 *  DoT is spent the glow snaps off and the source clears (the scheduleBurn timer then finishes idle). No-op
 *  when the tank isn't burning. */
export function relieveBurn(battle: NonNullable<GameClient["currentBattle"]>, client: GameClient): void {
    if (!client.user || client.visualTemperature <= 0) return;
    client.visualTemperature = Math.max(0, client.visualTemperature - BURN_RELIEF_GLOW);
    if (client.visualTemperature <= 0) client.flameSource = null;
    battle.broadcast(new TankTemperaturePacket(client.user.username, client.visualTemperature));
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

        for (const t of packet.targets) {
            const targetName = t.nickname;
            const targetClient = server.findClientByUsername(targetName);
            if (!targetClient || targetClient === client || targetClient.currentBattle !== currentBattle || targetClient.battleState !== "active") continue;
            // Friendly fire: skip teammates entirely (no damage AND no burn/glow) — applyDamage drops the
            // damage, but the ignite + visual glow below run separately, so allies were catching fire anyway.
            if (targetClient.user && currentBattle.isFriendlyBlocked(user, targetClient.user)) continue;
            // Anti-cheat: valida o hit reportado (incarnation da vida atual + posição do alvo) antes de
            // aplicar dano/queimadura — descarta hit obsoleto (alvo já morreu/renasceu) ou alvo forjado.
            if (!isReportedHitValid(targetClient, t)) continue;
            const factor = distanceFactor(client, targetClient, physics?.max_damage_radius ?? 5, physics?.min_damage_radius ?? 17, (physics?.min_damage_percent ?? 50) / 100);

            // Direct flame contact.
            await server.battleService.applyDamage(currentBattle, client, targetClient, (perPeriod / FLAME_DIRECT_DIVISOR) * factor, 0);
            if (targetClient.battleState !== "active") continue; // the direct hit killed it — don't ignite a corpse

            // Heat the tank toward full: this single value drives both the red glow and the residual burn.
            targetClient.flameSource = user.username;
            targetClient.visualTemperature = Math.min(FIRE_TEMP_CAP, targetClient.visualTemperature + FIRE_TEMP_STEP);
            currentBattle.broadcast(new TankTemperaturePacket(targetName, targetClient.visualTemperature));
            // Arm the burn timer only if one isn't already running (re-arming each ~2/s hit would reset the
            // 1s countdown so the tick never fires). Keying off the live timer, not the heat, means a tank left
            // burning at death no longer blocks its next ignite.
            if (!currentBattle.timers.has(`burn:${targetName}`)) scheduleBurn(server, currentBattle, targetName, tempLimit);
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
        const startShootingPacket = new FlamethrowerPackets.StartShootingFlamethrowerPacket({ nickname: user.username });
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
        const stopShootingPacket = new FlamethrowerPackets.StopShootingFlamethrowerPacket({ nickname: user.username });
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