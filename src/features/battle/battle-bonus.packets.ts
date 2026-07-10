import { packetClass } from "@/packets/packet-class";
import { defs } from "protanki-protocol";

// Bonus (drop) lifecycle packets. The bonus `id` is "<type>#<instance>" (e.g. "crystall#3"); the
// client maps the `<type>` prefix to a definition sent earlier in BonusDataPacket (textures/lifetime).
// IDs e schemas em `protanki-protocol` (defs.battle.*).

// S->C: a bonus drops onto the field. Wire (verified vs log): optString id, vector3 position (parachute
// drop point), i32 disappearingTimeMs. The current client only reads id + position for a spawn.
export const SpawnBonusPacket = packetClass(defs.battle.SpawnBonus);
export type SpawnBonusPacket = InstanceType<typeof SpawnBonusPacket>;

// S->C: a bonus is removed from the field (picked up or expired). Wire: optString id.
export const RemoveBonusPacket = packetClass(defs.battle.RemoveBonus);
export type RemoveBonusPacket = InstanceType<typeof RemoveBonusPacket>;

// S->C: a bonus was taken (plays the pickup animation/sound). Wire: optString id. Usually followed by
// RemoveBonusPacket for the same id.
export const TakeBonusPacket = packetClass(defs.battle.TakeBonus);
export type TakeBonusPacket = InstanceType<typeof TakeBonusPacket>;

// S->C: broadcast to the whole battle when a player picks up the GOLD box — the client shows the localized
// "<nick> picked up the gold box" notification. Wire: optString(nickname).
export const GoldBoxTakenNotificationPacket = packetClass(defs.battle.GoldBoxTakenNotification);
export type GoldBoxTakenNotificationPacket = InstanceType<typeof GoldBoxTakenNotificationPacket>;

// S->C: the gold-box pre-drop SIREN, broadcast to the whole battle ~30-50s before a gold box spawns (the
// client shows "A caixa de ouro será deixada em breve"). Wire (decoded from the client class §continue set§):
// optString(message) + Resource(sound) — the 2nd field is the SIREN sound the client plays with the toast
// (official idLow 401; we send our own registered sound). The sound must be preloaded (login resources).
export const GoldBoxComingNotificationPacket = packetClass(defs.battle.GoldBoxComingNotification);
export type GoldBoxComingNotificationPacket = InstanceType<typeof GoldBoxComingNotificationPacket>;

// C->S: the client touched a bonus and requests to pick it up. Wire: optString id ("type#instance").
// The client detects the collision (after the parachute lands the box), so the server just validates.
export const TakeBonusCommandPacket = packetClass(defs.battle.TakeBonusCommand);
export type TakeBonusCommandPacket = InstanceType<typeof TakeBonusCommandPacket>;
