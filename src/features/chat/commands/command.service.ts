import { hasModeratorPower } from "@/shared/models/enums/chat-moderator-level.enum";
import logger from "@/utils/logger";
import fs from "fs";
import path from "path";
import { CommandContext, ICommand } from "./command.types";

export class CommandService {
    private commands = new Map<string, ICommand>();

    public constructor() {
        this.loadCommands();
    }

    private loadCommands(): void {
        const commandDir = path.join(__dirname, "implementations");
        const files = fs.readdirSync(commandDir).filter((file) => file.endsWith(".ts") || file.endsWith(".js"));

        for (const file of files) {
            try {
                const module = require(path.join(commandDir, file));
                const CommandClass = module.default;

                if (CommandClass && typeof CommandClass === "function") {
                    const commandInstance = new CommandClass();
                    if (commandInstance.name) {
                        this.register(commandInstance);
                    }
                }
            } catch (error: any) {
                logger.error(`Failed to load command from ${file}`, { error: error.message });
            }
        }
    }

    private register(command: ICommand): void {
        this.commands.set(command.name.toLowerCase(), command);
        logger.info(`Command registered: /${command.name}`);
    }

    public async process(rawMessage: string, context: CommandContext): Promise<void> {
        if (!rawMessage.startsWith("/")) return;

        const parts = rawMessage.slice(1).split(" ");
        const commandName = parts[0].toLowerCase();
        const args = parts.slice(1);

        const command = this.commands.get(commandName);

        if (!command) {
            context.reply(`Comando "${commandName}" não encontrado.`);
            return;
        }

        if (!hasModeratorPower(context.executor.user!.chatModeratorLevel, command.permissionLevel)) {
            context.reply("Você não tem permissão para usar este comando.");
            return;
        }

        try {
            await command.execute(context, args);
        } catch (error: any) {
            logger.error(`Error executing command /${commandName}`, { error: error.message, user: context.executor.user?.username });
            context.reply(`Ocorreu um erro ao executar o comando: ${error.message}`);
        }
    }
}