import fs from "fs";
import path from "path";
import logger from "@/utils/logger";

export interface ILoadedModule {
    file: string;
    fullPath: string;
    module: Record<string, any>;
}

/**
 * Recursively walks `dir`, `require`s every file whose name passes `fileFilter`,
 * and returns the loaded modules. Require failures are logged and skipped so one
 * bad file does not abort the whole scan. Shared by PacketService and
 * PacketHandlerService, which only differ in their file filter and how they
 * inspect the resulting exports.
 */
export function loadModulesFromDir(dir: string, fileFilter: (fileName: string) => boolean): ILoadedModule[] {
    const result: ILoadedModule[] = [];
    walk(dir, fileFilter, result);
    return result;
}

function walk(dir: string, fileFilter: (fileName: string) => boolean, result: ILoadedModule[]): void {
    if (!fs.existsSync(dir)) {
        logger.warn(`Directory not found, skipping module scan: ${dir}`);
        return;
    }

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            walk(fullPath, fileFilter, result);
            continue;
        }

        if (!fileFilter(entry.name)) {
            continue;
        }

        try {
            result.push({ file: entry.name, fullPath, module: require(fullPath) });
        } catch (error: any) {
            logger.error(`Failed to load module from ${entry.name}`, { error: error.message, stack: error.stack });
        }
    }
}
