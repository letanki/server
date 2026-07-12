import { weaponPhysicsData } from "@/config/physics.data";
import { EquipmentConstraintsMode } from "@/features/battle/battle.model";
import { isReportedHitValid } from "@/features/weapons/hit-validation";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { UserDocument } from "@/shared/models/user.model";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import { ItemUtils } from "@/utils/item.utils";
import logger from "@/utils/logger";
import * as RailgunPackets from "./railgun.packets";

const RAILGUN_CHARGE_TOLERANCE_MS = 250; // network jitter allowance for the charge gate

// XP/BP modes: the railgun deals a FIXED fraction of the TARGET's max HP instead of its random roll,
// so kills take a deterministic number of shots regardless of the rolled damage or the hull (m2 and m3
// behave identically). The fraction must be in [2/3, 1) for the supply matrix to hold — a base hit (no
// supplies) takes 2 shots; the shooter's Double Damage (x2) makes it a 1-shot hitkill, the target's
// Double Armor (x0.5) pushes it to 3 shots, and both together back to 2.
const XP_BP_DAMAGE_FRACTION = 0.75;

// Fixed per-mod charge time (anti fire-rate hack) from physics.data (id `${turret}_m{0..3}`, e.g.
// `railgun_m2`; note `railgun_xt_*` is a DIFFERENT special weapon). It only gates the fire rate and
// never affects damage.
function getRailgunChargeMs(user: UserDocument): number {
    const mod = user.turrets.get(user.equippedTurret) ?? 0;
    const weapon = weaponPhysicsData.weapons.find((w) => w.id === `${user.equippedTurret}_m${mod}`);
    const se = (weapon?.special_entity ?? {}) as { chargingTimeMsec?: number };
    return se.chargingTimeMsec ?? 1100;
}

export class RailgunShotCommandHandler implements IPacketHandler<RailgunPackets.RailgunShotCommandPacket> {
    public readonly packetId = RailgunPackets.RailgunShotCommandPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: RailgunPackets.RailgunShotCommandPacket): Promise<void> {
        const { user, currentBattle } = client;
        if (!user || !currentBattle || client.battleState !== "active") {
            return;
        }

        const chargeMs = getRailgunChargeMs(user);

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
            staticHitPoint: packet.staticHitPoint,
            targets: packet.targets.map((target) => ({ nickname: target.nickname, localHitPoint: target.localHitPoint })),
        });
        currentBattle.broadcastRaw(shotPacket.write(), shotPacket.getId(), user.id);

        // Damage is a single uniform random roll in [DAMAGE_FROM, DAMAGE_TO]. Verified against official
        // captures it depends on NEITHER distance NOR where the beam hits the tank — the old centrality
        // model was wrong. The beam pierces aligned tanks: each next tank in the line takes
        // WEAPON_WEAKENING_COEFF% of the previous tank's damage (m0=18, m1=45, m2=73, m3=100), i.e.
        // damage_i = base * coeff^i.
        const turretMod = ItemUtils.getItemModification(user, "turret");
        const dmgFrom = ItemUtils.getPropertyValue(turretMod, "DAMAGE", "DAMAGE_FROM") ?? 0;
        const dmgTo = ItemUtils.getPropertyValue(turretMod, "DAMAGE", "DAMAGE_TO") ?? dmgFrom;
        const weakeningCoeff = (ItemUtils.getPropertyValue(turretMod, "WEAPON_WEAKENING_COEFF") ?? 100) / 100;
        const baseDamage = dmgFrom + Math.random() * (dmgTo - dmgFrom);

        // XP/BP modes normalize damage to a fixed fraction of each target's HP (see XP_BP_DAMAGE_FRACTION);
        // the random roll is used only in normal battles. Supply multipliers (Double Damage/Armor) are
        // applied later in applyDamage.
        const twoShotMode = currentBattle.settings.equipmentConstraintsMode !== EquipmentConstraintsMode.NONE;

        logger.info(`User ${user.username} fired railgun (base ${baseDamage.toFixed(1)} of ${dmgFrom}-${dmgTo}) at [${packet.targets.map((t) => t.nickname).join(", ")}]`);

        let pierceIndex = 0;
        for (const target of packet.targets) {
            const targetClient = server.findClientByUsername(target.nickname);
            if (!targetClient || !targetClient.user || targetClient === client || targetClient.currentBattle !== currentBattle || targetClient.battleState !== "active") continue;
            // Anti-cheat: valida a vida (incarnation) e a posição do CORPO do alvo (targetPosition = mundo;
            // NÃO o localHitPoint) — hit obsoleto ou alvo forjado não consome nem um índice de perfuração.
            // (A regressão do "elétrico" era usar o localHitPoint como posição-mundo; o def novo separa os dois.)
            if (!isReportedHitValid(targetClient, { incarnation: target.incarnation, targetPosition: target.targetPosition })) continue;

            const rawDamage = twoShotMode ? XP_BP_DAMAGE_FRACTION * ItemUtils.getHullArmor(targetClient.user) : baseDamage;
            const damage = rawDamage * Math.pow(weakeningCoeff, pierceIndex);
            pierceIndex++;

            await server.battleService.applyDamage(currentBattle, client, targetClient, damage, 0);
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
/** C→S: railgun disparou sem alvo → relaya o efeito visual do tiro para os outros jogadores. */
export class RailgunShotNoTargetCommandHandler implements IPacketHandler<RailgunPackets.RailgunShotNoTargetCommandPacket> {
    public readonly packetId = RailgunPackets.RailgunShotNoTargetCommandPacket.getId();
    public execute(client: GameClient, _server: GameServer, _packet: RailgunPackets.RailgunShotNoTargetCommandPacket): void {
        const { user, currentBattle } = client;
        if (!user || !currentBattle || client.battleState !== "active") return;
        currentBattle.broadcast(new RailgunPackets.RailgunShotNoTargetPacket({ nickname: user.username }), user.id);
    }
}
