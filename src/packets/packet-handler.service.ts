import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import logger from "@/utils/logger";
import { loadModulesFromDir } from "@/utils/module-loader";
import path from "path";

export class PacketHandlerService {
    private handlers = new Map<number, IPacketHandler<any>>();

    public constructor() {
        logger.debug("Initializing PacketHandlerService...");
        this.loadHandlersFromDir(path.join(__dirname, "../features"));

        logger.info(`PacketHandlerService initialized. Total handlers registered: ${this.handlers.size}.`);
        if (this.handlers.size > 0) {
            logger.debug(`Registered handler IDs: [${Array.from(this.handlers.keys()).join(", ")}]`);
        }
    }

    private loadHandlersFromDir(dir: string): void {
        const modules = loadModulesFromDir(dir, (file) => {
            const lower = file.toLowerCase();
            return lower.endsWith("handlers.ts") || lower.endsWith("handler.ts");
        });

        for (const { file, module } of modules) {
            try {
                const classesToRegister: any[] = [];
                if (module.default) {
                    classesToRegister.push(module.default);
                }
                for (const key in module) {
                    if (key !== "default") {
                        classesToRegister.push(module[key]);
                    }
                }

                for (const HandlerClass of classesToRegister) {
                    if (HandlerClass && typeof HandlerClass === "function" && HandlerClass.prototype.execute) {
                        const handlerInstance: IPacketHandler<any> = new HandlerClass();
                        if (handlerInstance.packetId !== undefined) {
                            this.register(handlerInstance, file);
                        }
                    }
                }
            } catch (error: any) {
                logger.error(`Failed to register handlers from ${file}`, { errorMessage: error.message, errorStack: error.stack });
            }
        }
    }

    private register(handler: IPacketHandler<any>, fileName: string): void {
        if (this.handlers.has(handler.packetId)) {
            logger.warn(`Packet handler for ID ${handler.packetId} is being overwritten. Check for duplicate handlers.`);
        }
        this.handlers.set(handler.packetId, handler);
        logger.info(`Packet handler registered for packet ID: ${handler.packetId} from ${fileName}`);
    }

    public getHandler(packetId: number): IPacketHandler<any> | undefined {
        return this.handlers.get(packetId);
    }
}