import { flyTankToZ, stopFly } from "@/features/battle/teleport.util";
import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

const DEFAULT_SPEED = 800;
const MIN_SPEED = 50;
const MAX_SPEED = 20000;

/**
 * Locks/glides only your height (Z). XY keep coming from normal driving. Uso: /flyto <z> [speed] | stop.
 */
export default class FlyToCommand implements ICommand {
    name = "flyto";
    description = "Trava/sobe só a altura (Z); movimento XY continua normal. Uso: /flyto <z> [speed] | stop.";
    permissionLevel = ChatModeratorLevel.MODERATOR;
    usage = "<z> [speed] | stop";
    example = "/flyto 500 800";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const client = context.executor;
        if (!client.user || !client.currentBattle) {
            context.reply("Você precisa estar em uma batalha.");
            return;
        }

        if (args[0]?.toLowerCase() === "stop") {
            context.reply(stopFly(client) ? "Altura liberada." : "Você não estava com /flyto ativo.");
            return;
        }

        if (args.length < 1) {
            context.reply("Uso: /flyto <z> [speed] | /flyto stop.");
            return;
        }
        if (!client.battlePosition) {
            context.reply("Você precisa estar em campo.");
            return;
        }

        const z = Number(args[0]);
        const speedRaw = args[1] !== undefined ? Number(args[1]) : DEFAULT_SPEED;
        if ([z, speedRaw].some((n) => Number.isNaN(n))) {
            context.reply("Altura/speed inválidos. Uso: /flyto <z> [speed].");
            return;
        }
        const speed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, speedRaw));

        flyTankToZ(client, z, speed);
        context.reply(`Altura → ${z} a ${speed} u/s (XY livre). /flyto stop para soltar.`);
    }
}
