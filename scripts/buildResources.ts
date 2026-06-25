import crc32 from "crc-32";
import fs from "fs";
import fse from "fs-extra";
import path from "path";
import { rimraf } from "rimraf";
import { Builder, parseStringPromise } from "xml2js";
import { create } from "xmlbuilder2";
import { ResourcePathUtils } from "../src/utils/resource.path.utils";
import { extractCtfFlags, extractDomKeypoints, extractPropLibs, extractSpawnPoints, extractSpecialGeometries, idToFile, IBonusRegion, parseBonusRegions } from "./lib/mapData";

const ROOT_DIR = path.join(__dirname, "..");
const RESOURCES_DIR = path.join(ROOT_DIR, "resources");
const RESOURCE_BUILD_DIR = path.join(ROOT_DIR, ".resource");
const TYPES_DIR = path.join(ROOT_DIR, "src", "generated"); // generated output (data + literal modules)

interface ResourceDefinition {
  id: string;
  idLow: number;
  versionLow: number;
  sourcePath: string;
  buildPath: string;
}

function generateResourceId(friendlyPath: string): number {
  return (crc32.str(friendlyPath) & 0xffffff) >>> 0;
}

async function findResources(dir: string, parentPath: string = ""): Promise<ResourceDefinition[]> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  let resources: ResourceDefinition[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const relativePath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
      const versionDirs = (await fs.promises.readdir(fullPath, { withFileTypes: true }))
        .filter((d) => d.isDirectory() && d.name.startsWith("v"))
        .map((d) => parseInt(d.name.substring(1), 10))
        .filter((version) => !isNaN(version))
        .sort((a, b) => b - a);

      if (versionDirs.length > 0) {
        const latestVersion = versionDirs[0];
        const id = relativePath.replace(/\\/g, "/");
        const sourcePath = path.join(fullPath, `v${latestVersion}`);
        let idLow: number;

        const idFilePath = path.join(sourcePath, "id.json");

        if (fs.existsSync(idFilePath)) {
          const idFileContent = await fs.promises.readFile(idFilePath, "utf8");
          const idData = JSON.parse(idFileContent);
          if (typeof idData.idlow !== "number") {
            throw new Error(`"idlow" inválido ou ausente em ${idFilePath}`);
          }
          idLow = idData.idlow;
          console.log(`ID Fixo encontrado para "${id}": ${idLow}`);
        } else {
          idLow = generateResourceId(id);
        }

        const buildPath = ResourcePathUtils.getResourcePath({ idLow, versionLow: latestVersion });

        resources.push({ id, idLow, versionLow: latestVersion, sourcePath: path.join(fullPath, `v${latestVersion}`), buildPath });
      } else {
        resources = resources.concat(await findResources(fullPath, relativePath));
      }
    }
  }
  return resources;
}

async function copyRootFiles() {
  const entries = await fs.promises.readdir(RESOURCES_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) {
      const sourceFile = path.join(RESOURCES_DIR, entry.name);
      const destFile = path.join(RESOURCE_BUILD_DIR, entry.name);
      await fse.copy(sourceFile, destFile);
      console.log(`Copied root file: ${entry.name}`);
    }
  }
}

function generateResourceTypesFileContent(resources: ResourceDefinition[]): string {
  let content = `// Arquivo gerado automaticamente. Não edite manualmente.\n\n`;

  content += `export const ResourceData = {\n`;
  resources.forEach((res) => {
    content += `    "${res.id}": { idLow: ${res.idLow}, path: "${res.buildPath}", versionLow: ${res.versionLow} },\n`;
  });
  content += `} as const;\n\n`;

  content += `export type ResourceId = keyof typeof ResourceData;\n`;

  return content;
}

function friendlyNameToResourceId(name: string): string {
  return `library/${name.toLowerCase().replace(/\s+/g, "_")}`;
}

const MAP_DATA_DIR = path.join(TYPES_DIR, "map-data"); // one JSON per map (battle data), loaded lazily at runtime by src/maps/mapData.ts

/**
 * Single pass over every map.xml: ONE read + ONE xml2js parse per map, from which we derive
 * proplibs.xml, map dependencies, the per-map battle JSON (spawns/geometry/ctf/dom/bonus) and the
 * cleaned client XML (battle nodes stripped). Replaces the old generatePropLibsXmls +
 * generateMapDependenciesFile + inline loop, which parsed each map three times.
 */
async function processMaps(resources: ResourceDefinition[]): Promise<void> {
  console.log("Processing maps (single parse per map)...");
  const resourceMap = new Map<string, ResourceDefinition>(resources.map((r) => [r.id, r]));
  const mapResources = resources.filter((r) => r.id.startsWith("map/") && r.id.endsWith("/xml"));

  const builder = new Builder();

  fs.rmSync(MAP_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(MAP_DATA_DIR, { recursive: true });

  let depsContent = `// Arquivo gerado automaticamente. Não edite manualmente.\n\n`;
  depsContent += `import { ResourceId } from "./resourceTypes";\n\n`;
  depsContent += `export const mapDependencies: { [key: number]: ResourceId[] } = {\n`;

  for (const mapResource of mapResources) {
    const mapXmlPath = path.join(mapResource.sourcePath, "map.xml");
    if (!fs.existsSync(mapXmlPath)) continue;

    try {
      const raw = await fs.promises.readFile(mapXmlPath, "utf8");
      const parsed = await parseStringPromise(raw, { trim: true });

      // 1) Prop libraries -> proplibs.xml (.resource) + map dependencies (extracted once).
      const propLibs = extractPropLibs(parsed);
      const root = create({ version: "1.0", encoding: "UTF-8" }).ele("proplibs");
      const libResourceIds: string[] = [];
      for (const libName of propLibs) {
        const resourceId = friendlyNameToResourceId(libName);
        const libResource = resourceMap.get(resourceId);
        if (libResource) {
          root.ele("library", { name: libName, "resource-id": libResource.idLow.toString(16), version: libResource.versionLow });
          libResourceIds.push(resourceId);
        } else {
          console.warn(`Warning: Library "${libName}" referenced in map "${mapResource.id}" not found.`);
        }
      }
      await fs.promises.writeFile(path.join(RESOURCE_BUILD_DIR, mapResource.buildPath, "proplibs.xml"), root.end({ prettyPrint: true }));
      depsContent += `    ${mapResource.idLow}: [${libResourceIds.map((id) => `"${id}"`).join(", ")}],\n`;

      // 2) Battle data (same parse) — accumulate for the eager literals + the per-map JSON, then strip
      //    the extracted nodes from the shipped client XML (same behaviour as before).
      const spawns = extractSpawnPoints(parsed);
      const geometries = extractSpecialGeometries(parsed);
      const ctfFlags = extractCtfFlags(parsed);
      const domKeypoints = extractDomKeypoints(parsed, mapResource.id);
      const bonus = parseBonusRegions(raw);

      // Strip the battle nodes from the shipped client XML (same behaviour as before).
      if (spawns) delete parsed.map["spawn-points"];
      if (geometries) delete parsed.map["special-geometry"];
      if (ctfFlags) delete parsed.map["ctf-flags"];
      if (domKeypoints) delete parsed.map["dom-keypoints"];

      fs.writeFileSync(path.join(MAP_DATA_DIR, idToFile(mapResource.id)), JSON.stringify({
        spawns: spawns ?? [], geometries: geometries ?? [], ctfFlags: ctfFlags ?? null, domKeypoints: domKeypoints ?? [], bonusRegions: bonus,
      }));

      // 3) Cleaned client XML (battle nodes removed).
      await fs.promises.writeFile(path.join(RESOURCE_BUILD_DIR, mapResource.buildPath, "map.xml"), builder.buildObject(parsed));
    } catch (error) {
      console.error(`Failed to process map ${mapResource.id}:`, error);
    }
  }

  depsContent += `};\n`;
  await fs.promises.writeFile(path.join(TYPES_DIR, "mapDependencies.ts"), depsContent);

  console.log(`Processed ${mapResources.length} maps (1 parse each).`);
}

async function validateSkyboxDirectories(resources: ResourceDefinition[]): Promise<void> {
  console.log("Validating skybox directories...");
  const skyboxSourceDir = path.join(RESOURCES_DIR, "skybox");
  if (!fs.existsSync(skyboxSourceDir)) {
    console.log("No skybox directory found, skipping validation.");
    return;
  }

  const mapNames = new Set<string>();
  resources.forEach((res) => {
    if (res.id.startsWith("map/")) {
      const parts = res.id.split("/");
      if (parts.length > 1) {
        mapNames.add(parts[1]);
      }
    }
  });

  const skyboxDirs = await fs.promises.readdir(skyboxSourceDir, { withFileTypes: true });
  for (const dir of skyboxDirs) {
    if (dir.isDirectory() && dir.name !== "default") {
      if (!mapNames.has(dir.name)) {
        console.warn(`Warning: Skybox directory "/skybox/${dir.name}/" does not correspond to any known map.`);
      }
    }
  }
}

async function validateTaraResources(resources: ResourceDefinition[]): Promise<void> {
  console.log("Validating .tara resources...");
  for (const resource of resources) {
    const sourceFiles = await fs.promises.readdir(resource.sourcePath);
    const isImageTara = sourceFiles.includes("image.tara");
    const hasProperties = sourceFiles.includes("properties.json");

    if (isImageTara && !hasProperties) {
      throw new Error(`Resource "${resource.id}" is an image.tara resource but is missing the required "properties.json" file in its source directory: ${resource.sourcePath}`);
    }
  }
}

async function build() {
  console.log("Starting resource build process...");

  await rimraf(RESOURCE_BUILD_DIR);
  await fs.promises.mkdir(RESOURCE_BUILD_DIR, { recursive: true });
  await fs.promises.mkdir(TYPES_DIR, { recursive: true }); // src/generated is build output; ensure it exists

  console.log("Discovering resources from 'resources' directory...");
  const resources = await findResources(RESOURCES_DIR);

  const idMap = new Map<number, string>();
  for (const res of resources) {
    if (idMap.has(res.idLow)) {
      throw new Error(`Hash collision detected! Both "${res.id}" and "${idMap.get(res.idLow)}" produce the same ID (${res.idLow}). Please rename one.`);
    }
    idMap.set(res.idLow, res.id);
  }
  console.log(`Found ${resources.length} resources. No collisions detected.`);

  await validateSkyboxDirectories(resources);
  await validateTaraResources(resources);

  console.log("Generating 'resourceTypes.ts'...");
  const typesContent = generateResourceTypesFileContent(resources);
  await fs.promises.writeFile(path.join(TYPES_DIR, "resourceTypes.ts"), typesContent);

  console.log("Copying categorized resource files to '.resource' directory...");
  for (const res of resources) {
    const destPath = path.join(RESOURCE_BUILD_DIR, res.buildPath);
    await fse.copy(res.sourcePath, destPath);
  }

  // Single pass: proplibs.xml, mapDependencies, per-map battle JSON, eager literals + cleaned XML.
  await processMaps(resources);

  await copyRootFiles();
  console.log("Resource build process completed successfully!");
}

build().catch((error) => {
  console.error("Resource build failed:", error);
  process.exit(1);
});