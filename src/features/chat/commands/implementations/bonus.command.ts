import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

// Bonus types defined in getBonusData() — the spawn id prefix must match one of these.
const BONUS_TYPES = ["crystall", "gold", "health", "nitro", "damage", "armor", "special", "moon", "pumpkin"];

/** Test command: drops a bonus of <type> at your position (or given coords). Uso: /bonus <type> [x y z]. */
export default class BonusCommand implements ICommand {
    name = "bonus";
    description = `Spawna um drop. Uso: /bonus <${BONUS_TYPES.join("|")}> [x y z].`;
    permissionLevel = ChatModeratorLevel.NONE;

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const client = context.executor;
        if (!client.user || !client.currentBattle) {
            context.reply("Você precisa estar em uma batalha.");
            return;
        }

        const type = (args[0] ?? "").toLowerCase();
        if (!BONUS_TYPES.includes(type)) {
            context.reply(`Tipo inválido. Use um de: ${BONUS_TYPES.join(", ")}.`);
            return;
        }

        let position = client.battlePosition;
        if (args.length >= 4) {
            const x = Number(args[1]); const y = Number(args[2]); const z = Number(args[3]);
            if ([x, y, z].some((n) => Number.isNaN(n))) {
                context.reply("Coordenadas inválidas. Uso: /bonus <type> [x y z].");
                return;
            }
            position = { x, y, z };
        }
        if (!position) {
            context.reply("Você não está em campo (sem posição).");
            return;
        }

        const id = context.server.battleService.bonus.spawnBonus(client.currentBattle, type, position);
        context.reply(`Drop "${id}" criado.`);
    }
}
