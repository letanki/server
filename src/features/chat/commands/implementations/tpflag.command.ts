import { BattleMode } from "@/features/battle/battle.model";
import { teleportTank } from "@/features/battle/teleport.util";
import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/** Teleports the caller to a CTF flag's current position. Uso: /tpflag <red|blue>. */
export default class TpFlagCommand implements ICommand {
    name = "tpflag";
    description = "Teleporta você até a posição da bandeira. Uso: /tpflag <red|blue>.";
    permissionLevel = ChatModeratorLevel.MODERATOR;
    usage = "[red/blue]";
    example = "/tpflag red";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const client = context.executor;
        const battle = client.currentBattle;
        if (!client.user || !battle) {
            context.reply("Você precisa estar em uma batalha.");
            return;
        }

        if (battle.settings.battleMode !== BattleMode.CTF) {
            context.reply("Esta batalha não é Capture the Flag.");
            return;
        }

        const which = (args[0] ?? "").toLowerCase();
        const isRed = which === "red" || which === "r";
        const isBlue = which === "blue" || which === "b";
        if (!isRed && !isBlue) {
            context.reply("Uso: /tpflag <red|blue>.");
            return;
        }

        const flagPosition = isRed ? battle.flagPositionRed : battle.flagPositionBlue;
        const flagName = isRed ? "vermelha" : "azul";
        if (!flagPosition) {
            context.reply(`A bandeira ${flagName} está sendo carregada.`);
            return;
        }

        teleportTank(client, flagPosition);
        context.reply(`Teleportando até a bandeira ${flagName}...`);
    }
}
