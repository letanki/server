import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel, hasModeratorPower } from "@/shared/models/enums/chat-moderator-level.enum";

const MAX_RATING = 999_999;
const MAX_PLACE = 9_999_999;

/**
 * Define o rating e a classificação (place) no topo do painel do lobby. Esses valores vão no LobbyData
 * no login — não há pacote incremental, então o alvo precisa relogar para ver a mudança.
 */
export default class SetRatingCommand implements ICommand {
    name = "setrating";
    description = "Define rating e classificação do painel (precisa relogar). Uso: /setrating [username] <rating> <place>.";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.NONE;
    usage = "[username] <rating> <place>";
    example = "/setrating 85 12";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const { server } = context;
        let targetName: string | null = null;
        let ratingArg: string;
        let placeArg: string;

        if (args.length >= 3) {
            targetName = args[0];
            ratingArg = args[1];
            placeArg = args[2];
        } else if (args.length === 2) {
            ratingArg = args[0];
            placeArg = args[1];
        } else {
            context.reply("Uso: /setrating [username] <rating> <place>.");
            return;
        }

        const ratingRaw = Number(ratingArg);
        const placeRaw = Number(placeArg);
        if (!Number.isFinite(ratingRaw) || !Number.isFinite(placeRaw)) {
            context.reply("Uso: /setrating [username] <rating> <place>.");
            return;
        }

        if (targetName && !hasModeratorPower(context.executor.user!.chatModeratorLevel, ChatModeratorLevel.ADMINISTRATOR)) {
            context.reply("Definir rating de outro jogador exige cargo de Administrador.");
            return;
        }

        const online = targetName ? server.findClientByUsername(targetName) : context.executor;
        const user = online?.user ?? (targetName ? await server.userService.findUserByUsername(targetName) : context.executor.user);
        if (!user) {
            context.reply(`Usuário "${targetName}" não encontrado.`);
            return;
        }

        const rating = Math.max(0, Math.min(Math.floor(ratingRaw), MAX_RATING));
        const place = Math.max(0, Math.min(Math.floor(placeRaw), MAX_PLACE));

        try {
            user.rating = rating;
            user.place = place;
            await user.save();
            if (online?.user) online.user = user;
            context.reply(`${user.username}: rating=${rating}, classificação=${place}. Relogue para atualizar o painel.`);
        } catch (error: any) {
            context.reply(`Erro: ${error.message}`);
        }
    }
}
