/**
 * Standalone (zero-dependency) so config files can safely use `MapTheme.X` as an object key at module
 * top level. Defining this enum inside battle.model.ts caused a circular-require crash: battle.model.ts
 * imports resource.manager.ts BEFORE its own enum declaration, and resource.manager.ts (transitively,
 * via map-themes.data.ts) needed the enum's VALUES immediately, at that module's own top level — getting
 * back battle.model.ts's still-partial exports (MapTheme undefined) mid-load. Import this file directly
 * wherever the value is needed at module-init time; battle.model.ts re-exports it for existing consumers
 * that only use it inside function bodies (safe, since by call time everything has finished loading).
 */
export enum MapTheme {
    SUMMER,
    WINTER,
    SPACE,
    SUMMER_DAY,
    SUMMER_NIGHT,
    WINTER_DAY,
    WINTER_NIGHT,
}
