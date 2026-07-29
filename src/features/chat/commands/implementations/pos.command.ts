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
        // Altura de repouso = z da origem do tanque − topo do chão embaixo. Meça em CHÃO PLANO e parado para
        // calibrar o RIDE_HEIGHT das minas por carroceria (o gatilho da mina estende a janela vertical esse tanto).
        const ground = context.server.battleService.groundZAt(battle.mapResourceId, pos.x, pos.y, pos.z);
        const ride = ground !== null ? Math.round(pos.z - ground) : null;
        const hull = client.user ? `${client.user.equippedHull}_m${client.user.hulls.get(client.user.equippedHull) ?? 0}` : "?";
        context.reply(`Posição: x=${Math.round(pos.x)} y=${Math.round(pos.y)} z=${Math.round(pos.z)} | hull=${hull} | repouso=${ride ?? "(vazio)"}`);
    }
}
