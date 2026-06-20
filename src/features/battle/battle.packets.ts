// Barrel for battle packets, split by domain for maintainability.
// PacketService scans these split files directly; this re-export keeps existing
// imports (`@/features/battle/battle.packets`) working unchanged.
export * from "./battle-init.packets";
export * from "./battle-combat.packets";
export * from "./battle-flow.packets";
export * from "./battle-flags.packets";
export * from "./battle-bonus.packets";
export * from "./battle-mine.packets";
