import { teleportTank } from "@/features/battle/teleport.util";
import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/** Teleports every active player in the battle to the caller's position. */
export default class TpAllCommand implements ICommand {
    name = "tpall";
    description = "Teleporta todos os jogadores da batalha até você. Uso: /tpall.";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.ADMINISTRATOR;
    example = "/tpall";

    async execute(context: CommandContext, _args: string[]): Promise<void> {
        const client = context.executor;
        const battle = client.currentBattle;
        const pos = client.battlePosition;
        if (!client.user || !battle || !pos) {
            context.reply("Você precisa estar em uma batalha, em campo.");
            return;
        }

        let moved = 0;
        for (const other of battle.clients) {
            if (other === client || !other.user || other.isSpectator || other.battleState !== "active") continue;
            teleportTank(other, pos);
            moved++;
        }
        context.reply(moved > 0 ? `${moved} jogador(es) teleportado(s) até você.` : "Nenhum outro jogador ativo na batalha.");
    }
}
