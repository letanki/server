import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/** Shows the caller's current battle coordinates (handy for /tp and /bonus). */
export default class PosCommand implements ICommand {
    name = "pos";
    description = "Mostra suas coordenadas atuais na batalha. Uso: /pos.";
    permissionLevel = ChatModeratorLevel.MODERATOR;
    example = "/pos";

    async execute(context: CommandContext, _args: string[]): Promise<void> {
        const client = context.executor;
        const pos = client.battlePosition;
        const battle = client.currentBattle;
        if (!battle || !pos) {
            context.reply("Você precisa estar em uma batalha, em campo.");
            return;
        }
        const fmt = (n: number) => n.toFixed(6);
        const ground = context.server.battleService.groundZAt(battle.mapResourceId, pos.x, pos.y, pos.z);
        const ride = ground !== null ? (pos.z - ground).toFixed(6) : null;
        const hull = client.user ? `${client.user.equippedHull}_m${client.user.hulls.get(client.user.equippedHull) ?? 0}` : "?";
        // Valores com casas decimais (o que o servidor recebeu no último Move/FullMove — não lê a memória do cliente).
        context.reply(`Posição: x=${fmt(pos.x)} y=${fmt(pos.y)} z=${fmt(pos.z)} | hull=${hull} | repouso=${ride ?? "(vazio)"}`);
    }
}
