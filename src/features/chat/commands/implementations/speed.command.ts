import { broadcastMovementSpec } from "@/features/weapons/freeze/freeze.handlers";
import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

const SPEED_MIN = 0.1, SPEED_MAX = 10;

/** Sets the caller's tank speed multiplier (physics test). Composes with nitro/freeze; 1 = normal.
 *  Resets on leaving the battle. NOTE: a respawn re-sends the base spec — re-run /speed after dying. */
export default class SpeedCommand implements ICommand {
    name = "speed";
    description = "Multiplica a velocidade do seu tanque (1 = normal; reseta ao sair). Uso: /speed <mult>.";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.ADMINISTRATOR;
    usage = "<mult>";
    example = "/speed 2";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const client = context.executor;
        const battle = client.currentBattle;
        if (!client.user || !battle) {
            context.reply("Você precisa estar em uma batalha.");
            return;
        }
        const mult = parseFloat(args[0]);
        if (isNaN(mult) || mult < SPEED_MIN || mult > SPEED_MAX) {
            context.reply(`Uso: /speed <mult> (${SPEED_MIN} a ${SPEED_MAX}).`);
            return;
        }

        client.speedMultiplier = mult;
        broadcastMovementSpec(battle, client);
        context.reply(`Velocidade x${mult}${mult === 1 ? " (normal)" : ""}.`);
    }
}
