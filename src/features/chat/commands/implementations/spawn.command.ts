import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/** Forces the respawn flow for a player stuck dead/waiting (own tank by default). An ACTIVE tank is
 *  refused — use /destroy to blow it up (it respawns on its own). */
export default class SpawnCommand implements ICommand {
    name = "spawn";
    description = "Força o respawn de um jogador travado (morto/aguardando; vazio = você). Uso: /spawn [username].";
    permissionLevel = ChatModeratorLevel.MODERATOR;
    usage = "[username]";
    example = "/spawn Joao";

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
            if (!found?.user || found.currentBattle?.battleId !== client.currentBattle.battleId) {
                context.reply(`Jogador "${args[0]}" não está nesta batalha.`);
                return;
            }
            target = found;
        }
        if (target.isSpectator) {
            context.reply(`${target.user?.username} é espectador.`);
            return;
        }
        if (target.battleState === "active") {
            context.reply(`${target.user?.username} já está em campo — use /destroy para destruir e respawnar.`);
            return;
        }

        server.battleService.prepareRespawn(target);
        context.reply(`Respawn forçado para ${target.user?.username}.`);
    }
}
