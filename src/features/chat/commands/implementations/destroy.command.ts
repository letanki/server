import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/** Destroys a tank in the current battle — your own by default, or another player's when a nick is given. */
export default class DestroyTankCommand implements ICommand {
    name = "destroy";
    description = "Destrói o tanque de um jogador (vazio = você). Uso: /destroy [username].";
    permissionLevel = ChatModeratorLevel.MODERATOR;
    usage = "[username]";
    example = "/destroy Joao";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const client = context.executor;
        const { server } = context;
        if (!client.user || !client.currentBattle) {
            context.reply("Você precisa estar em uma batalha.");
            return;
        }

        let target = client;
        if (args.length >= 1) {
            const found = server.findClientByUsername(args[0]);
            if (!found || found.currentBattle?.battleId !== client.currentBattle.battleId) {
                context.reply(`Jogador "${args[0]}" não está nesta batalha.`);
                return;
            }
            target = found;
        }

        const destroyed = server.battleService.forceDestroyTank(target);
        context.reply(
            destroyed
                ? `Tanque de ${target.user?.username} destruído.`
                : `Não foi possível destruir: ${target.user?.username} não está com o tanque ativo em campo.`
        );
    }
}
