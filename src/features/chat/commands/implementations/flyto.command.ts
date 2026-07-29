import { flyTankTo, stopFly } from "@/features/battle/teleport.util";
import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

const DEFAULT_SPEED = 800;
const MIN_SPEED = 50;
const MAX_SPEED = 20000;

/**
 * Glides your tank toward (x,y,z) tick-by-tick (MovePackets with velocity) — like walking through
 * the air. While flying, your client's own Move/FullMove are ignored so physics can't fight the path.
 * Uso: /flyto <x> <y> <z> [speed] | /flyto stop
 */
export default class FlyToCommand implements ICommand {
    name = "flyto";
    description = "Desliza seu tanque até (x,y,z) por tick (como voar). Uso: /flyto <x> <y> <z> [speed] | stop.";
    permissionLevel = ChatModeratorLevel.MODERATOR;
    usage = "<x> <y> <z> [speed] | stop";
    example = "/flyto 100 0 200 800";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const client = context.executor;
        if (!client.user || !client.currentBattle) {
            context.reply("Você precisa estar em uma batalha.");
            return;
        }

        if (args[0]?.toLowerCase() === "stop") {
            context.reply(stopFly(client) ? "Voo cancelado." : "Você não estava voando.");
            return;
        }

        if (args.length < 3) {
            context.reply("Uso: /flyto <x> <y> <z> [speed] | /flyto stop.");
            return;
        }
        if (!client.battlePosition) {
            context.reply("Você precisa estar em campo.");
            return;
        }

        const x = Number(args[0]);
        const y = Number(args[1]);
        const z = Number(args[2]);
        const speedRaw = args[3] !== undefined ? Number(args[3]) : DEFAULT_SPEED;
        if ([x, y, z, speedRaw].some((n) => Number.isNaN(n))) {
            context.reply("Coordenadas/speed inválidos. Uso: /flyto <x> <y> <z> [speed].");
            return;
        }
        const speed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, speedRaw));

        flyTankTo(client, { x, y, z }, speed);
        context.reply(`Voando para (${x}, ${y}, ${z}) a ${speed} u/s. /flyto stop para cancelar.`);
    }
}
