import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/**
 * DEBUG: solta uma mina na sua posição com +dz no Z (padrão +500), SEM o snap-to-ground do servidor —
 * o pacote PutMine carrega o Z cru. Serve para observar em jogo se o CLIENTE assenta a mina no chão
 * (ignorando o Z enviado, como a memória client-mine-rendering indica) ou se a mostra flutuando no Z.
 * Uso: /mineup [dz].
 */
export default class MineUpCommand implements ICommand {
    name = "mineup";
    description = "Debug: solta uma mina na sua posição +dz no Z (padrão 500), sem snap. Uso: /mineup [dz].";
    permissionLevel = ChatModeratorLevel.MODERATOR;
    usage = "[dz]";
    example = "/mineup 500";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const client = context.executor;
        const battle = client.currentBattle;
        const pos = client.battlePosition;
        if (!client.user || !battle || !pos) {
            context.reply("Você precisa estar em uma batalha, em campo.");
            return;
        }
        if (battle.settings.withoutMines) {
            context.reply("Esta batalha está com minas desativadas.");
            return;
        }

        const dz = args[0] !== undefined ? Number(args[0]) : 500;
        if (isNaN(dz)) {
            context.reply("Uso: /mineup [dz].");
            return;
        }

        const raw = { x: pos.x, y: pos.y, z: pos.z + dz };
        const id = context.server.battleService.mine.placeMineAt(client, battle, raw, false); // snap=false → Z cru
        if (id) {
            context.reply(`Mina ${id} solta em z=${raw.z.toFixed(0)} (sua z=${pos.z.toFixed(0)} +${dz}), SEM snap. Veja se ela aparece flutuando ou no chão.`);
        } else {
            context.reply("Não foi possível colocar a mina.");
        }
    }
}
