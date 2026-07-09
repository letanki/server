import { MapTheme } from "@/features/battle/map-theme.enum";

export interface IMapGraphicConfig {
    angleX: number;
    angleZ: number;
    lightColor: number;
    shadowColor: number;
    fogAlpha: number;
    fogColor: number;
    farLimit: number;
    nearLimit: number;
    gravity: number;
    skyboxRevolutionSpeed: number;
    ssaoColor: number;
    dustAlpha: number;
    dustDensity: number;
    dustFarDistance: number;
    dustNearDistance: number;
    dustParticle: string;
    dustSize: number;
}

export interface IBonusColorAdjust {
    redMultiplier: number;
    greenMultiplier: number;
    blueMultiplier: number;
    alphaMultiplier: number;
    redOffset: number;
    greenOffset: number;
    blueOffset: number;
    alphaOffset: number;
}

export interface IMapThemeConfig {
    graphicConfig: IMapGraphicConfig;
    /** Name of a skybox SET under resources/skybox/<name>/v1/{front,back,left,right,top,bottom}.jpg —
     *  e.g. "default_summer". Reusing an existing set (on another map/theme's row) needs no new files,
     *  just the same name string; a genuinely new skybox needs a new named folder + `npm run build:resources`. */
    skybox: string;
    bonusColorAdjust?: IBonusColorAdjust;
    bonusLightIntensity?: number;
}

const baseGraphicConfig: IMapGraphicConfig = {
    angleX: -0.85,
    angleZ: 2.5,
    lightColor: 13090219,
    shadowColor: 5530735,
    fogAlpha: 0.25,
    fogColor: 10543615,
    farLimit: 10000,
    nearLimit: 5000,
    gravity: 1000,
    skyboxRevolutionSpeed: 0.0,
    ssaoColor: 2045258,
    dustAlpha: 0.75,
    dustDensity: 0.15,
    dustFarDistance: 7000,
    dustNearDistance: 5000,
    dustParticle: "summer",
    dustSize: 200,
};

const nightGraphicConfig: Partial<IMapGraphicConfig> = {
    angleX: -0.6,
    angleZ: -0.8,
    lightColor: 3163220,
    shadowColor: 1382169,
    fogColor: 68116,
};

const nightBonusConfig = {
    bonusColorAdjust: {
        redMultiplier: 2,
        greenMultiplier: 2,
        blueMultiplier: 2,
        alphaMultiplier: 1,
        redOffset: 60,
        greenOffset: 10,
        blueOffset: 20,
        alphaOffset: 0,
    },
    bonusLightIntensity: 1,
};

/** THE DEFAULT ROW per theme — every map uses this unless it has its own row in `mapOverrides` below.
 *  SUMMER_DAY/WINTER_DAY have no dedicated skybox set yet, so they reuse summer's/winter's. */
export const mapThemeConfigs: Record<MapTheme, IMapThemeConfig> = {
    [MapTheme.SUMMER]: { skybox: "default_summer", graphicConfig: { ...baseGraphicConfig } },
    [MapTheme.WINTER]: { skybox: "default_winter", graphicConfig: { ...baseGraphicConfig } },
    [MapTheme.SPACE]: {
        skybox: "default_space",
        graphicConfig: {
            ...baseGraphicConfig,
            lightColor: 7829351,
            shadowColor: 5926009,
            gravity: 300,
            skyboxRevolutionSpeed: 0.005,
        },
    },
    [MapTheme.SUMMER_DAY]: { skybox: "default_summer", graphicConfig: { ...baseGraphicConfig } },
    [MapTheme.WINTER_DAY]: { skybox: "default_winter", graphicConfig: { ...baseGraphicConfig } },
    [MapTheme.SUMMER_NIGHT]: {
        skybox: "default_summer_night",
        graphicConfig: { ...baseGraphicConfig, ...nightGraphicConfig },
        ...nightBonusConfig,
    },
    [MapTheme.WINTER_NIGHT]: {
        skybox: "default_winter_night",
        graphicConfig: { ...baseGraphicConfig, ...nightGraphicConfig },
        ...nightBonusConfig,
    },
};

/**
 * CUSTOMIZATIONS — one row per "mapId:TEMA" that should differ from its theme's default row above.
 * Spread the default row and change only what you need; anything you don't touch stays identical to it.
 * A map+theme with no entry here just uses `mapThemeConfigs[theme]` untouched.
 *
 * Examples:
 *   "gravity:SPACE": { ...mapThemeConfigs[MapTheme.SPACE], graphicConfig: { ...mapThemeConfigs[MapTheme.SPACE].graphicConfig, gravity: 80 } },
 *   "sandbox:SUMMER_NIGHT": { ...mapThemeConfigs[MapTheme.SUMMER_NIGHT], skybox: "zone_summer_night" }, // reuse an existing set, no new files
 */
export const mapOverrides: Record<string, IMapThemeConfig> = {};

/** Resolves the effective config for a map+theme: its own row in `mapOverrides` if it customized this
 *  exact theme, else the theme's default row. `mapId` is without the "map_" prefix. */
export function getMapThemeConfig(mapId: string, theme: MapTheme): IMapThemeConfig {
    return mapOverrides[`${mapId}:${MapTheme[theme]}`] ?? mapThemeConfigs[theme];
}