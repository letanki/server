import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

// Bonus types defined in getBonusData() — the spawn id prefix must match one of these.
const BONUS_TYPES = ["crystall", "gold", "health", "nitro", "damage", "armor", "special", "moon", "pumpkin"];

/** Test command: drops bonuses of <type> — N at random map areas, or one at your position/coords.
 *  Uso: /bonus <type> [quantidade] | /bonus <type> pos [x y z]. */
export default class BonusCommand implements ICommand {
    name = "bonus";
    description = `Spawna drops. Uso: /bonus <${BONUS_TYPES.join("|")}> [quantidade] (aleatório pelas áreas do mapa) ou /bonus <type> pos [x y z] (na sua posição/coordenadas).`;
    permissionLevel = ChatModeratorLevel.MODERATOR;
    usage = `[${BONUS_TYPES.join("/")}] [quantidade | pos [x y z]]`;
    example = "/bonus gold 5";

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

        // "/bonus <type> pos [x y z]" — one drop at your position or explicit coords (old behavior).
        if ((args[1] ?? "").toLowerCase() === "pos") {
            let position = client.battlePosition;
            if (args.length >= 5) {
                const x = Number(args[2]); const y = Number(args[3]); const z = Number(args[4]);
                if ([x, y, z].some((n) => Number.isNaN(n))) {
                    context.reply("Coordenadas inválidas. Uso: /bonus <type> pos [x y z].");
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
            return;
        }

        // "/bonus <type> [quantidade]" — N drops at random points inside the map's bonus areas.
        const count = args[1] !== undefined ? Number(args[1]) : 1;
        if (!Number.isInteger(count) || count < 1 || count > 100) {
            context.reply("Quantidade inválida (1 a 100). Uso: /bonus <type> [quantidade].");
            return;
        }
        const dropped = context.server.battleService.bonus.spawnRandom(client.currentBattle, type, count);
        if (dropped === 0) {
            context.reply("Este mapa não tem áreas de drop para o modo atual.");
            return;
        }
        context.reply(`${dropped} drop(s) de "${type}" criado(s) em áreas aleatórias do mapa.`);
    }
}
