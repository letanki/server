import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import { ItemUtils } from "@/utils/item.utils";
import { isReportedHitValid } from "@/features/weapons/hit-validation";
import { awardScore } from "@/features/battle/score-award";
import { HEAL_SCORE_PER_SEC } from "@/features/battle/scoring";
import { SetHealthPacket, DamageIndicatorPacket } from "@/features/battle/battle.packets";
import * as IsidaPackets from "./isida.packets";

// A Isida aplica dano/cura em "períodos" de 1s (garage: DAMAGE_PER_PERIOD / ISIS_HEALING_PER_PERIOD = por
// segundo). O cliente envia IsisTargetTick ~4x/s, mas o efeito é aplicado a cada ISIS_TICK_MS: cada
// aplicação vale (valor_por_segundo × ISIS_TICK_MS/1000). Com 500ms: m0 = 30×0.5=15 dano, 15×0.5=7.5 cura
// — bate com a captura oficial (DamageIndicator 15 a cada ~500ms). O relay visual (SetIsisState) vai a
// CADA tick; só o efeito é throttlado.
const ISIS_TICK_MS = 500;
// Lacuna máxima entre sinais de jato (tick/pos) ainda considerada o MESMO jato contínuo. Ticks chegam
// ~260ms; acima disto (ou num STOP) o jato foi interrompido → recomeça o âncora de 500ms.
const ISIS_GAP_MS = 500;
const ISIS_STATE = { NO_TARGET: 1, HEALING: 2, DAMAGING: 3 } as const;
// DamageIndicatorType do cliente: 0 normal, 1 crítico, 2 fatal, 3 CURA (número verde). Reusamos o mesmo
// pacote de indicador de dano com type 3 para mostrar a cura em verde, como no servidor oficial.
const HEAL_INDICATOR_TYPE = 3;

/** Mostra o número flutuante VERDE de cura sobre `targetName`, para o atirador (se não desativou "mostrar
 *  dano") e para os espectadores — mesmo canal do indicador de dano, com damageType=3. */
function showHealIndicator(battle: NonNullable<GameClient["currentBattle"]>, shooter: GameClient, targetName: string, healed: number): void {
    if (healed <= 0) return;
    const ind = new DamageIndicatorPacket(targetName, Math.round(healed), HEAL_INDICATOR_TYPE);
    if (shooter.showDamage !== false) shooter.sendPacket(ind);
    battle.broadcastToSpectators(ind);
}

/**
 * Heartbeat do jato: registra que o feixe está ativo AGORA. Se a lacuna desde o último sinal passou de
 * ISIS_GAP_MS (jato novo — 1º tick, ou após soltar/lacuna), reancora o gate de 500ms (isisLastEffectAt),
 * de forma que o 1º dano/cura só saia após 500ms de jato CONTÍNUO. Retorna `now`. Chamado por tick E pos.
 */
function isisBeat(client: GameClient): number {
    const now = Date.now();
    if (now - client.isisLastBeamAt > ISIS_GAP_MS) client.isisLastEffectAt = now;
    client.isisLastBeamAt = now;
    return now;
}

/** Envia um pacote a todos os participantes da batalha, menos o próprio atirador. */
function relayToOthers(server: GameServer, battle: NonNullable<GameClient["currentBattle"]>, self: GameClient, pkt: any): void {
    for (const p of battle.getAllParticipants()) {
        if (p.id === self.user?.id) continue;
        const oc = server.findClientByUsername(p.username);
        if (oc && oc.currentBattle?.battleId === battle.battleId) oc.sendPacket(pkt);
    }
}

/** Cura `realHP` (unidades de HP do garage) em `target`, sem passar da vida cheia; retorna o HP real dado.
 *  Vida no cliente é normalizada 0-10000 (REGRA DE 3: norm = realHP × 10000 / hullHP). */
function applyHeal(battle: NonNullable<GameClient["currentBattle"]>, target: GameClient, realHP: number): number {
    if (!target.user || realHP <= 0 || target.currentHealth >= 10000) return 0;
    const hullHP = ItemUtils.getHullArmor(target.user);
    const before = target.currentHealth;
    target.currentHealth = Math.min(10000, target.currentHealth + (realHP * 10000) / hullHP);
    battle.broadcastToTeamOf(new SetHealthPacket({ nickname: target.user.username, health: Math.round(target.currentHealth) }), target.user);
    return ((target.currentHealth - before) / 10000) * hullHP;
}

/** Jato ligado (nem sempre enviado pelo cliente — pode ir direto pros ticks) → heartbeat + relay. */
export class IsisStartCommandHandler implements IPacketHandler<IsidaPackets.IsisStartCommandPacket> {
    public readonly packetId = IsidaPackets.IsisStartCommandPacket.getId();
    public execute(client: GameClient, server: GameServer, _packet: IsidaPackets.IsisStartCommandPacket): void {
        const { user, currentBattle } = client;
        if (!user || !currentBattle) return;
        isisBeat(client);
        relayToOthers(server, currentBattle, client, new IsidaPackets.StartShootingIsisPacket({ nickname: user.username }));
    }
}

/** Jato desligado → zera o heartbeat: o próximo sinal de jato começa um jato NOVO (recomeça os 500ms),
 *  impedindo que os toques do tap se somem. */
export class IsisStopCommandHandler implements IPacketHandler<IsidaPackets.IsisStopCommandPacket> {
    public readonly packetId = IsidaPackets.IsisStopCommandPacket.getId();
    public execute(client: GameClient, server: GameServer, _packet: IsidaPackets.IsisStopCommandPacket): void {
        const { user, currentBattle } = client;
        if (!user || !currentBattle) return;
        client.isisLastBeamAt = 0;
        relayToOthers(server, currentBattle, client, new IsidaPackets.StopShootingIsisPacket({ nickname: user.username }));
    }
}

/**
 * Tick do jato sobre um alvo. Determina aliado (mesma equipe) → CURA, ou inimigo → DANO; relaya o
 * SetIsisState (visual) a cada tick e aplica o efeito no máximo a cada ISIS_TICK_MS. Ao danar inimigo o
 * atirador se auto-cura (ISIS_SELF_HEALING_PERCENT do dano). Valida incarnation antes de aplicar.
 */
export class IsisTargetTickCommandHandler implements IPacketHandler<IsidaPackets.IsisTargetTickCommandPacket> {
    public readonly packetId = IsidaPackets.IsisTargetTickCommandPacket.getId();
    public async execute(client: GameClient, server: GameServer, packet: IsidaPackets.IsisTargetTickCommandPacket): Promise<void> {
        const { user, currentBattle } = client;
        if (!user || !currentBattle || client.battleState !== "active" || !packet.target) return;

        // Heartbeat do jato (mantém vivo e recomeça os 500ms se foi um jato novo). Roda mesmo que o alvo
        // saia logo em seguida — o feixe continua "ligado" pelo cliente estar mandando ticks.
        const now = isisBeat(client);

        const targetClient = server.findClientByUsername(packet.target);
        if (!targetClient || !targetClient.user || targetClient.currentBattle?.battleId !== currentBattle.battleId || targetClient.battleState !== "active") return;

        const isSelf = targetClient.user.id === user.id;
        const ally = !isSelf && currentBattle.isTeamMode() && currentBattle.teamOf(user) === currentBattle.teamOf(targetClient.user);
        const state = isSelf ? ISIS_STATE.NO_TARGET : ally ? ISIS_STATE.HEALING : ISIS_STATE.DAMAGING;

        // Relay visual a cada tick (cadência ~4x/s, como na captura).
        relayToOthers(server, currentBattle, client, new IsidaPackets.SetIsisStatePacket({
            nickname: user.username,
            state,
            position: packet.localHitPoint,
            localHitPoint: packet.localHitPoint,
            incarnation: packet.incarnation,
            target: packet.target,
        }));

        if (isSelf) return; // não se auto-mira

        // Anti-cheat: incarnation da vida atual do alvo (posição não vem neste comando; validada por incarnation).
        if (!isReportedHitValid(targetClient, { incarnation: packet.incarnation })) return;

        // Efeito throttlado ao período do jato (só sai após 500ms de jato contínuo — ver isisBeat).
        if (now - client.isisLastEffectAt < ISIS_TICK_MS) return;
        client.isisLastEffectAt = now;

        const turretMod = ItemUtils.getItemModification(user, "turret");
        const periodFactor = ISIS_TICK_MS / 1000;

        if (ally) {
            // Cura aliado + pontua o atirador (HEAL_SCORE_PER_SEC).
            const healPerSec = ItemUtils.getPropertyValue(turretMod, "ISIS_HEALING_PER_SECOND", "ISIS_HEALING_PER_PERIOD") ?? 0;
            const healed = applyHeal(currentBattle, targetClient, healPerSec * periodFactor);
            if (healed > 0) {
                showHealIndicator(currentBattle, client, targetClient.user.username, healed);
                await awardScore(currentBattle, client, HEAL_SCORE_PER_SEC * periodFactor);
            }
            return;
        }

        // Dano ao inimigo + auto-cura do atirador (ISIS_SELF_HEALING_PERCENT do dano nominal).
        const dmgPerSec = ItemUtils.getPropertyValue(turretMod, "ISIS_DAMAGE", "DAMAGE_PER_PERIOD") ?? 0;
        const dmg = dmgPerSec * periodFactor;
        if (dmg <= 0) return;
        // sourceWeapon default = turret equipado (isida) → resistência ISIS_RESISTANCE aplicada sozinha.
        await server.battleService.applyDamage(currentBattle, client, targetClient, dmg, 0);

        const selfHealPct = ItemUtils.getPropertyValue(turretMod, "ISIS_SELF_HEALING_PERCENT") ?? 0;
        if (selfHealPct > 0 && client.battleState === "active") {
            const selfHealed = applyHeal(currentBattle, client, (dmg * selfHealPct) / 100);
            showHealIndicator(currentBattle, client, user.username, selfHealed);
        }
    }
}

/** Variante posição-do-alvo (sem id): acompanha o feixe (inclusive atirando no vazio). Só faz heartbeat —
 *  mantém o jato "vivo" para a contagem contínua; o efeito/relay são dirigidos pelo IsisTargetTick. */
export class IsisTargetPositionCommandHandler implements IPacketHandler<IsidaPackets.IsisTargetPositionCommandPacket> {
    public readonly packetId = IsidaPackets.IsisTargetPositionCommandPacket.getId();
    public execute(client: GameClient, _server: GameServer, _packet: IsidaPackets.IsisTargetPositionCommandPacket): void {
        if (!client.user || !client.currentBattle || client.battleState !== "active") return;
        isisBeat(client);
    }
}
