import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/**
 * Liga/desliga o relay da sua posição (Move/FullMove → outros). Com relay off o servidor ainda
 * atualiza battlePosition (combate/minas), mas não reenvia o movimento — útil com /tpothers e /tpself.
 * Reseta ao sair da batalha.
 */
export default class RelayCommand implements ICommand {
    name = "relay";
    description = "Liga/desliga o relay da sua posição para os outros. Uso: /relay [on|off].";
    permissionLevel = ChatModeratorLevel.MODERATOR;
    usage = "[on|off]";
    example = "/relay off";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const client = context.executor;
        if (!client.user || !client.currentBattle) {
            context.reply("Você precisa estar em uma batalha.");
            return;
        }

        const arg = args[0]?.toLowerCase();
        if (arg === undefined) {
            client.relayPosition = !client.relayPosition;
        } else if (arg === "on" || arg === "1" || arg === "true") {
            client.relayPosition = true;
        } else if (arg === "off" || arg === "0" || arg === "false") {
            client.relayPosition = false;
        } else {
            context.reply("Uso: /relay [on|off].");
            return;
        }

        context.reply(`Relay de posição: ${client.relayPosition ? "LIGADO" : "DESLIGADO"}.`);
    }
}
