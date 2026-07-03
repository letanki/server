export interface ISupplyData {
  id: string;
  slotId: number;
  itemEffectTime: number;
  itemRestSec: number;
}

// Cooldowns aligned to official captures (NORMAL mode). Buffs (armor/dd/n2o) = 60s effect + 15s rest = 75s
// cooldown; parkour drops the 15s rest → 60s cooldown (handled in supply.service.applyEffect). The 60s buff
// DURATION is identical in both modes and for inventory vs drop pickups. health/mine have no timed buff, so
// their cooldown = itemRestSec alone (health 35.5s, mine 60s in normal); parkour overrides them to 5s / 0s
// in ActivateSupplyCommandHandler.
export const suppliesData: ISupplyData[] = [
  { id: "health", slotId: 1, itemEffectTime: 0, itemRestSec: 35.5 },
  { id: "armor", slotId: 2, itemEffectTime: 60, itemRestSec: 15 },
  { id: "double_damage", slotId: 3, itemEffectTime: 60, itemRestSec: 15 },
  { id: "n2o", slotId: 4, itemEffectTime: 60, itemRestSec: 15 },
  { id: "mine", slotId: 5, itemEffectTime: 0, itemRestSec: 60 },
];
