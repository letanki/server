import { ResourceManager } from "@/utils/resource.manager";

// In esport-drop-timing battles NO field box expires on the ground — every type only leaves when
// collected (buffs respawn on a fixed cooldown; crystal/gold boxes drop via their own fund-based system
// — see [[bonus-drop-model]] and the "Crystal boxes" wiki page). The official esport config reports this
// as a 24h lifetime for ALL types in packet 228171466 — the client reads its blink/disappear timer from
// HERE (not the per-spawn packet), so esport battles must be sent these lifetimes or the client would
// fade boxes out while the server keeps them alive. Only the DROP SYSTEM differs per type, not the lifetime.
export const ESPORT_BONUS_LIFETIME_MS = 86400000;
const esportLife = (esport: boolean, base: number) => (esport ? ESPORT_BONUS_LIFETIME_MS : base);

export const getBonusData = (esportDropTiming = false) => ({
  // Our own bonus-type ids (the client already knows these resources). The maps' <bonus-region>
  // bonus-types (crystal/crystal_100/crystal_500/medkit/damageup/armorup) are mapped onto these in
  // BonusService (REGION_TYPE_MAP) instead of renaming ids, to avoid breaking the client.
  // lifeTimeMs = time until the box starts blinking (official values decoded from packet 228171466):
  // supply drops 30s; small crystal 15min; big crystals / event drops effectively never (~8h). The
  // server removes the box BONUS_BLINK_GRACE_MS after this (see BonusService). In esport mode every type
  // is overridden to ESPORT_BONUS_LIFETIME_MS (never expire on the ground).
  bonuses: [
    { id: "nitro", resourceId: ResourceManager.getIdlowById("bonuses/nitro/model"), lifeTimeMs: esportLife(esportDropTiming, 30000), lighting: { attenuationBegin: 50, attenuationEnd: 500, color: 16164153, intensity: 0.5 } },
    { id: "damage", resourceId: ResourceManager.getIdlowById("bonuses/damage/model"), lifeTimeMs: esportLife(esportDropTiming, 30000), lighting: { attenuationBegin: 50, attenuationEnd: 500, color: 5889080, intensity: 0.5 } },
    { id: "armor", resourceId: ResourceManager.getIdlowById("bonuses/armor/model"), lifeTimeMs: esportLife(esportDropTiming, 30000), lighting: { attenuationBegin: 50, attenuationEnd: 500, color: 8972345, intensity: 0.5 } },
    { id: "health", resourceId: ResourceManager.getIdlowById("bonuses/health/model"), lifeTimeMs: esportLife(esportDropTiming, 30000), lighting: { attenuationBegin: 50, attenuationEnd: 500, color: 16220575, intensity: 0.5 } },
    { id: "crystall", resourceId: ResourceManager.getIdlowById("bonuses/crystal"), lifeTimeMs: esportLife(esportDropTiming, 900000), lighting: { attenuationBegin: 50, attenuationEnd: 500, color: 3789046, intensity: 0.5 } },
    { id: "gold", resourceId: ResourceManager.getIdlowById("bonuses/gold"), lifeTimeMs: esportLife(esportDropTiming, 30000000), lighting: { attenuationBegin: 50, attenuationEnd: 500, color: 16175161, intensity: 0.5 } },
    { id: "special", resourceId: ResourceManager.getIdlowById("bonuses/special"), lifeTimeMs: esportLife(esportDropTiming, 30000000), lighting: { attenuationBegin: 50, attenuationEnd: 500, color: 16175161, intensity: 0.5 } },
    { id: "moon", resourceId: ResourceManager.getIdlowById("bonuses/moon"), lifeTimeMs: esportLife(esportDropTiming, 30000000), lighting: { attenuationBegin: 100, attenuationEnd: 500, color: 15044128, intensity: 1 } },
    { id: "pumpkin", resourceId: ResourceManager.getIdlowById("bonuses/pumpkin"), lifeTimeMs: esportLife(esportDropTiming, 30000000), lighting: { attenuationBegin: 100, attenuationEnd: 500, color: 15044128, intensity: 1 } },
  ],
  cordResource: ResourceManager.getIdlowById("bonuses/parachute/cord"),
  parachuteInnerResource: ResourceManager.getIdlowById("bonuses/parachute/inner"),
  parachuteResource: ResourceManager.getIdlowById("bonuses/parachute/main"),
  pickupSoundResource: ResourceManager.getIdlowById("sounds/bonus_pickup"),
});
