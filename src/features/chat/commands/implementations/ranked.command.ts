import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { sendWebPanel } from "@/features/webpanel/webpanel.service";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/**
 * /ranked — abre o painel de Partida Competitiva (webview opaco). SPIKE da Fase 0: valida que o
 * HTMLLoader opaco renderiza e recebe input sobre o Stage3D. A busca real (fila/pareamento) entra
 * na Fase 1; a ponte JS↔AS na Fase 0b.
 */
export default class RankedCommand implements ICommand {
    name = "ranked";
    description = "Abre o painel de Partida Competitiva (ranqueada).";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.NONE;

    async execute(context: CommandContext, _args: string[]): Promise<void> {
        sendWebPanel(context.executor, { width: 0, height: 0 }, "ranked-command"); // 0 = tela cheia (modal)
        context.reply("Abrindo painel de Partida Competitiva…");
    }
}
