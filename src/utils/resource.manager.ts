import { MapTheme } from "@/features/battle/map-theme.enum";
import { getMapThemeConfig } from "@/config/map-themes.data";
import { IDependency } from "@/features/loader/loader.types";
import { mapDependencies } from "@/generated/mapDependencies";
import { ResourceData, ResourceId } from "@/generated/resourceTypes";
import fs from "fs";
import path from "path";
import logger from "./logger";
import { ResourcePathUtils } from "./resource.path.utils";

export class ResourceManager {
    private static dependencies: Map<ResourceId, IDependency> = new Map();

    private static resourceDir = path.join(__dirname, "../../.resource");

    private static fileNameToType: { [key: string]: number } = {
        "image.jpg": 10,
        "image.png": 10,
        "sound.swf": 4,
        "sound.mp3": 4,
        "map.xml": 7,
        "object.3ds": 17,
        "library.tara": 8,
        "image.tara": 11,
    };

    public static loadResources(): void {
        try {
            const resourceIds = Object.keys(ResourceData) as ResourceId[];

            resourceIds.forEach((id) => {
                const config = ResourceData[id];
                const dependency = this.createDependency(id, config.path);
                this.dependencies.set(id, dependency);
            });

            logger.info(`Loaded ${resourceIds.length} resource configurations`);
        } catch (error) {
            logger.error("Error loading resource configurations", { error });
            throw error;
        }
    }

    private static createDependency(id: ResourceId, resourceBuildPath: string): IDependency {
        const fullResourcePath = path.join(this.resourceDir, resourceBuildPath);

        if (!fs.existsSync(fullResourcePath)) {
            throw new Error(`Path not found for resource ${id} at ${fullResourcePath}. Run 'npm run build:resources'.`);
        }

        const files = fs.readdirSync(fullResourcePath);
        const resourceType = this.resolveResourceType(files);

        if (resourceType === undefined) {
            throw new Error(`Could not determine resource type for id "${id}".`);
        }

        const { idHigh, idLow, versionHigh, versionLow } = ResourcePathUtils.parseResourcePath(resourceBuildPath);

        const dependency: IDependency = {
            idhigh: idHigh.toString(),
            idlow: idLow,
            versionhigh: versionHigh.toString(),
            versionlow: versionLow,
            lazy: id.includes("preview"),
            // Texturas normais usam "alpha.jpg"; localizadas (type 13) trazem "<lang>_alpha.jpg".
            alpha: files.includes("alpha.jpg") || files.some((f) => /_alpha\.(jpg|png)$/.test(f)),
            type: resourceType,
        };

        if (resourceType === 13) {
            dependency.fileNames = files.filter((file) => file.endsWith(".jpg") || file.endsWith(".png"));
        }

        if (resourceType === 11) {
            const propsPath = path.join(fullResourcePath, "properties.json");
            if (fs.existsSync(propsPath)) {
                try {
                    const props = JSON.parse(fs.readFileSync(propsPath, "utf8"));
                    dependency.weight = props.weight;
                    dependency.height = props.height;
                    dependency.numFrames = props.numFrames;
                    dependency.fps = props.fps;
                } catch (e) {
                    logger.error(`Failed to parse properties.json for resource ${id}`, { error: e });
                }
            }
        }

        return dependency;
    }

    private static resolveResourceType(files: string[]): number | undefined {
        const hasLanguageFile = files.some((file) => file.match(/^(en|pt_br|ru|ua)\.(jpg|png)$/));
        if (hasLanguageFile) {
            return 13;
        }

        const matchedFile = files.find((file) => this.fileNameToType[file]);
        return matchedFile ? this.fileNameToType[matchedFile] : undefined;
    }

    public static getResourceById(id: ResourceId): IDependency {
        const resource = this.dependencies.get(id);
        if (!resource) {
            throw new Error(`Resource dependency with ID '${id}' not found.`);
        }
        return resource;
    }

    public static getBulkResources(ids: ResourceId[]): IDependency[] {
        return ids.map((id) => this.getResourceById(id));
    }

    public static getIdlowById(id: ResourceId): number {
        const resourceInfo = ResourceData[id];
        if (!resourceInfo) {
            throw new Error(`Resource idLow with ID '${id}' not found.`);
        }
        return resourceInfo.idLow;
    }

    private static _getMapLibsByIdLow(mapIdLow: number): ResourceId[] {
        return mapDependencies[mapIdLow] || [];
    }

    /** The 6 face resource ids for the skybox SET assigned to this map+theme (map-themes.data.ts) —
     *  purely config-driven, resources/skybox/<name>/v1/{front,back,left,right,top,bottom}.jpg. */
    public static getSkyboxResourceIds(mapIdWithoutPrefix: string, theme: MapTheme): ResourceId[] {
        const skyboxParts = ["front", "back", "left", "right", "top", "bottom"];
        const { skybox } = getMapThemeConfig(mapIdWithoutPrefix, theme);
        return skyboxParts.map((part) => `skybox/${skybox}/${part}` as ResourceId);
    }

    public static getSkyboxResources(mapIdWithoutPrefix: string, theme: MapTheme): IDependency[] {
        const skyboxResourceIds = this.getSkyboxResourceIds(mapIdWithoutPrefix, theme);

        try {
            return this.getBulkResources(skyboxResourceIds);
        } catch (error) {
            const basePath = skyboxResourceIds.length > 0 ? skyboxResourceIds[0].substring(0, skyboxResourceIds[0].lastIndexOf("/")) : "unknown";
            logger.error(`Failed to get skybox resources. This likely means the resources for the path "${basePath}" are missing.`, { error });
            return [];
        }
    }

    public static getMapResources(mapId: string, theme: string): IDependency[] {
        const themeEnumKey = theme.toUpperCase() as keyof typeof MapTheme;
        const themeEnumValue = MapTheme[themeEnumKey];

        if (themeEnumValue === undefined) {
            throw new Error(`Invalid map theme string provided: ${theme}`);
        }

        const mapXmlResourceId = this.getMapResourceIdWithFallback(mapId, themeEnumValue);
        const mapResource = this.getResourceById(mapXmlResourceId);
        const libraryResourceIds = this._getMapLibsByIdLow(mapResource.idlow);
        return this.getBulkResources(libraryResourceIds);
    }

    public static getMapResourceIdWithFallback(mapIdWithoutPrefix: string, theme: MapTheme): ResourceId {
        const themeStr = MapTheme[theme].toLowerCase();
        const specificResourceId = `map/${mapIdWithoutPrefix}/${themeStr}/xml` as ResourceId;

        if (ResourceData[specificResourceId]) {
            return specificResourceId;
        }

        logger.debug(`Specific map resource not found for '${specificResourceId}', attempting fallback.`);

        let fallbackTheme: MapTheme | null = null;
        if (theme === MapTheme.SPACE || theme === MapTheme.SUMMER_NIGHT || theme === MapTheme.SUMMER_DAY) {
            fallbackTheme = MapTheme.SUMMER;
        } else if (theme === MapTheme.WINTER_NIGHT || theme === MapTheme.WINTER_DAY) {
            fallbackTheme = MapTheme.WINTER;
        }

        if (fallbackTheme !== null) {
            const fallbackThemeStr = MapTheme[fallbackTheme].toLowerCase();
            const fallbackResourceId = `map/${mapIdWithoutPrefix}/${fallbackThemeStr}/xml` as ResourceId;
            if (ResourceData[fallbackResourceId]) {
                logger.debug(`Using fallback map resource '${fallbackResourceId}'.`);
                return fallbackResourceId;
            }
        }

        throw new Error(`Could not find a valid map resource for map '${mapIdWithoutPrefix}' with theme '${themeStr}' or its fallback.`);
    }
}