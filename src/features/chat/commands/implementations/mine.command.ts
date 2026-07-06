import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

const DEFAULT_RADIUS = 400;                       // disc radius (world units) when no radius is given
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // phyllotaxis angle — spreads points evenly, no clumping
const PLACE_CHUNK = 50;                            // mines placed per tick (throttle a huge count)
const PLACE_DELAY_MS = 100;                        // ~500 mines/s — chunked so it doesn't spike clients

/** Debug: drops N mines spread in a disc around you. Throttled so a big count doesn't blast everyone's client
 *  with one broadcast burst. Uso: /mine <amount> [radius]. */
export default class MineAroundCommand implements ICommand {
    name = "mine";
    description = "Coloca N minas em volta de você. Uso: /mine <amount> [radius].";
    permissionLevel = ChatModeratorLevel.MODERATOR;
    usage = "<amount> [radius]";
    example = "/mine 50 400";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const client = context.executor;
        const battle = client.currentBattle;
        const center = client.battlePosition;
        if (!client.user || !battle || !center) {
            context.reply("Você precisa estar em uma batalha, em campo.");
            return;
        }
        if (battle.settings.withoutMines) {
            context.reply("Esta batalha está com minas desativadas.");
            return;
        }

        const count = parseInt(args[0], 10);
        if (isNaN(count) || count <= 0) {
            context.reply("Uso: /mine <amount> [radius].");
            return;
        }
        const radius = args[1] !== undefined ? Number(args[1]) : DEFAULT_RADIUS;
        if (isNaN(radius) || radius < 0) {
            context.reply("Raio inválido.");
            return;
        }

        // Sunflower distribution: evenly fills a disc of `radius` centred on you (r ∝ √i, angle = i·golden).
        const positions = Array.from({ length: count }, (_, i) => {
            const r = radius * Math.sqrt((i + 0.5) / count);
            const theta = i * GOLDEN_ANGLE;
            return { x: center.x + r * Math.cos(theta), y: center.y + r * Math.sin(theta), z: center.z };
        });

        const mine = context.server.battleService.mine;
        let i = 0;
        const placeChunk = (): void => {
            if (client.isDestroyed || client.currentBattle !== battle) return; // left the battle mid-placement
            const end = Math.min(i + PLACE_CHUNK, positions.length);
            for (; i < end; i++) mine.placeMineAt(client, battle, positions[i]);
            if (i < positions.length) setTimeout(placeChunk, PLACE_DELAY_MS);
        };
        placeChunk();

        context.reply(`Colocando ${count} mina(s) em volta de você (raio ${radius}).`);
    }
}
