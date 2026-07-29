import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";
import { getMapThemeConfig } from "@/config/map-themes.data";

/**
 * Define a gravidade da partida atual (override no InitMap). O cliente congela o valor na entrada —
 * quem já está dentro precisa SAIR E ENTRAR de novo para sentir a mudança. Sem argumento mostra o
 * valor atual; `reset` volta ao padrão do tema.
 */
export default class GravityCommand implements ICommand {
    name = "gravity";
    description = "Define a gravidade da partida (vale ao reentrar). Uso: /gravity [valor|reset].";
    permissionLevel = ChatModeratorLevel.ADMINISTRATOR;
    usage = "[valor|reset]";
    example = "/gravity 100";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const battle = context.executor.currentBattle;
        if (!context.executor.user || !battle) {
            context.reply("Você precisa estar em uma batalha.");
            return;
        }

        const mapId = battle.settings.mapId.replace(/^map_/, "");
        const themeGravity = getMapThemeConfig(mapId, battle.settings.mapTheme).graphicConfig.gravity;
        const effective = battle.gravityOverride ?? themeGravity;

        const arg = args[0];
        if (arg === undefined) {
            const src = battle.gravityOverride === null ? "tema" : "override";
            context.reply(`Gravidade atual: ${effective} (${src}; tema=${themeGravity}). Uso: /gravity [valor|reset].`);
            return;
        }
        if (arg.toLowerCase() === "reset") {
            battle.gravityOverride = null;
            context.reply(`Gravidade resetada para o tema (${themeGravity}). Saia e entre de novo na batalha para aplicar.`);
            return;
        }

        const value = Number(arg);
        if (!Number.isFinite(value)) {
            context.reply("Uso: /gravity [valor|reset].");
            return;
        }

        battle.gravityOverride = value;
        context.reply(`Gravidade da partida = ${value}. Saia e entre de novo na batalha para aplicar (não muda ao vivo).`);
    }
}
