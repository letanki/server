import { ResourceManager } from "@/utils/resource.manager";

export const getBonusData = () => ({
  // Our own bonus-type ids (the client already knows these resources). The maps' <bonus-region>
  // bonus-types (crystal/crystal_100/crystal_500/medkit/damageup/armorup) are mapped onto these in
  // BonusService (REGION_TYPE_MAP) instead of renaming ids, to avoid breaking the client.
  bonuses: [
    { id: "nitro", resourceId: ResourceManager.getIdlowById("bonuses/nitro/model"), lifeTimeMs: 86400000, lighting: { attenuationBegin: 50, attenuationEnd: 500, color: 16164153, intensity: 0.5 } },
    { id: "damage", resourceId: ResourceManager.getIdlowById("bonuses/damage/model"), lifeTimeMs: 86400000, lighting: { attenuationBegin: 50, attenuationEnd: 500, color: 5889080, intensity: 0.5 } },
    { id: "armor", resourceId: ResourceManager.getIdlowById("bonuses/armor/model"), lifeTimeMs: 86400000, lighting: { attenuationBegin: 50, attenuationEnd: 500, color: 8972345, intensity: 0.5 } },
    { id: "health", resourceId: ResourceManager.getIdlowById("bonuses/health/model"), lifeTimeMs: 86400000, lighting: { attenuationBegin: 50, attenuationEnd: 500, color: 16220575, intensity: 0.5 } },
    { id: "crystall", resourceId: ResourceManager.getIdlowById("bonuses/crystal"), lifeTimeMs: 86400000, lighting: { attenuationBegin: 50, attenuationEnd: 500, color: 3789046, intensity: 0.5 } },
    { id: "gold", resourceId: ResourceManager.getIdlowById("bonuses/gold"), lifeTimeMs: 86400000, lighting: { attenuationBegin: 50, attenuationEnd: 500, color: 16175161, intensity: 0.5 } },
    { id: "special", resourceId: ResourceManager.getIdlowById("bonuses/special"), lifeTimeMs: 86400000, lighting: { attenuationBegin: 50, attenuationEnd: 500, color: 16175161, intensity: 0.5 } },
    { id: "moon", resourceId: ResourceManager.getIdlowById("bonuses/moon"), lifeTimeMs: 86400000, lighting: { attenuationBegin: 100, attenuationEnd: 500, color: 15044128, intensity: 1 } },
    { id: "pumpkin", resourceId: ResourceManager.getIdlowById("bonuses/pumpkin"), lifeTimeMs: 86400000, lighting: { attenuationBegin: 100, attenuationEnd: 500, color: 15044128, intensity: 1 } },
  ],
  cordResource: ResourceManager.getIdlowById("bonuses/parachute/cord"),
  parachuteInnerResource: ResourceManager.getIdlowById("bonuses/parachute/inner"),
  parachuteResource: ResourceManager.getIdlowById("bonuses/parachute/main"),
  pickupSoundResource: ResourceManager.getIdlowById("sounds/bonus_pickup"),
});
