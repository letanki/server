import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";
import { isCrystalAbonementActive } from "@/shared/models/passes";

/**
 * Ativa (ou desativa) o abonement de Dobro de Cristais na PRÓPRIA conta — para testar a UI (card no
 * depósito + indicador de dobro no shop). Seta `crystalAbonementExpiresAt`. O efeito aparece ao REABRIR
 * a garagem/loja (não há pacote incremental para isso). Dobra só cristais de DOAÇÃO, não ganhos em jogo.
 */
export default class SetAbonementCommand implements ICommand {
    name = "setabonement";
    description = "Ativa o Dobro de Cristais na sua conta por N horas (padrão 24; 0 desativa). Uso: /setabonement [horas].";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.ADMINISTRATOR;
    usage = "[horas]";
    example = "/setabonement 24";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const user = context.executor.user;
        if (!user) return;

        const hours = args[0] !== undefined ? parseInt(args[0], 10) : 24;
        if (isNaN(hours)) {
            context.reply("Uso: /setabonement [horas] (padrão 24; 0 desativa).");
            return;
        }

        try {
            if (hours <= 0) {
                user.crystalAbonementExpiresAt = null;
                await user.save();
                context.reply("Dobro de Cristais desativado. Reabra a garagem/loja para atualizar.");
                return;
            }
            user.crystalAbonementExpiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
            await user.save();
            context.reply(`Dobro de Cristais ativado por ${hours}h (ativo=${isCrystalAbonementActive(user)}). Reabra a garagem/loja para atualizar.`);
        } catch (error: any) {
            context.reply(`Erro: ${error.message}`);
        }
    }
}
