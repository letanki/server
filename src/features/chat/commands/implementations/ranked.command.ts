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
        // Se já está buscando/em partida encontrada, reabre no tamanho pequeno (widget), não fullscreen.
        const size = context.server.rankedService?.panelSizeFor(context.executor.user!.id) ?? { width: 0, height: 0 };
        sendWebPanel(context.executor, size, "ranked-command");
        context.reply("Abrindo painel de Partida Competitiva…");
    }
}
