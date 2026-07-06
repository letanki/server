import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

export interface CommandContext {
    executor: GameClient;
    server: GameServer;
    reply: (message: string) => void;
}

export interface ICommand {
    name: string;
    description: string;
    permissionLevel: ChatModeratorLevel;

    /**
     * Parameter spec shown by /help, e.g. "<nick> [none/moderador/administrador/cm]". Convention:
     * <obrigatório>, [opcional], and choice lists as [opt1/opt2/...]. Omit for no-parameter commands.
     */
    usage?: string;
    /** A concrete example invocation shown by /help, e.g. "/setcargo Joao moderador". */
    example?: string;

    execute(context: CommandContext, args: string[]): Promise<void>;
}