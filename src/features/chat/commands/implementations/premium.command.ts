import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { UpdatePremiumTimePacket } from "@/features/profile/profile.packets";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";
import { secondsLeft } from "@/shared/models/passes";
import { ItemUtils } from "@/utils/item.utils";

/**
 * Consulta e DEFINE o premium de um jogador por HORAS (valor absoluto, não incremental):
 *   /premium <usuário>        → mostra quanto de premium a pessoa tem
 *   /premium <usuário> <horas> → define as horas de premium (0 = sem premium)
 * O usuário é SEMPRE obrigatório — para dar a si mesmo, o admin informa o próprio nick. No alvo ONLINE
 * envia o `UpdatePremiumTime` em tempo real; ao definir 0, a reconciliação reverte a pintura premium
 * equipada para green (ver ItemUtils.reconcilePremiumEquipment). Persiste também para alvos offline.
 */
export default class PremiumCommand implements ICommand {
    name = "premium";
    description = "Consulta/define o premium de um jogador em horas (0 = sem premium). Uso: /premium <usuário> [horas].";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.ADMINISTRATOR;
    usage = "<usuário> [horas]";
    example = "/premium Danlino 24";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const { server } = context;
        if (args.length < 1) {
            context.reply("Uso: /premium <usuário> [horas] (sem horas = consulta; 0 = sem premium).");
            return;
        }

        const targetName = args[0];
        const online = server.findClientByUsername(targetName);
        const user = online?.user ?? await server.userService.findUserByUsername(targetName);
        if (!user) {
            context.reply(`Usuário "${targetName}" não encontrado.`);
            return;
        }

        // Sem horas → consulta.
        if (args[1] === undefined) {
            const secs = secondsLeft(user.premiumExpiresAt);
            if (secs <= 0) {
                context.reply(`${user.username} não tem premium ativo.`);
            } else {
                const h = Math.floor(secs / 3600);
                const m = Math.floor((secs % 3600) / 60);
                context.reply(`${user.username} tem ${h}h${m > 0 ? ` ${m}min` : ""} de premium.`);
            }
            return;
        }

        // Com horas → define (absoluto; mínimo 0).
        const hours = parseInt(args[1], 10);
        if (isNaN(hours) || hours < 0) {
            context.reply("Erro: as horas devem ser um número >= 0 (0 = sem premium).");
            return;
        }

        try {
            user.premiumExpiresAt = hours > 0 ? new Date(Date.now() + hours * 60 * 60 * 1000) : null;
            await user.save();

            // Definiu 0 → reverte a pintura premium equipada para green (persiste se mudou).
            await ItemUtils.reconcilePremiumEquipment(user);

            // Alvo online: atualiza o tempo de premium em tempo real (sem relogar).
            if (online?.user) {
                online.user = user;
                online.sendPacket(new UpdatePremiumTimePacket({ timeLeft: secondsLeft(user.premiumExpiresAt) }));
            }

            context.reply(hours > 0
                ? `Premium de ${user.username} definido para ${hours}h.`
                : `Premium de ${user.username} removido (0h).`);
        } catch (error: any) {
            context.reply(`Erro: ${error.message}`);
        }
    }
}
