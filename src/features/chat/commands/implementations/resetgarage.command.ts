import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { GarageWorkflow } from "@/features/garage/garage.workflow";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";
import { UserDocument } from "@/shared/models/user.model";

/** Resets a user's garage to the new-account loadout (wasp/smoky/holiday). Rank/crystals untouched. */
export function resetGarageInventory(user: UserDocument): void {
    user.hulls = new Map([["wasp", 0]]);
    user.turrets = new Map([["smoky", 0]]);
    user.paints = ["green", "holiday"];
    user.equippedHull = "wasp";
    user.equippedTurret = "smoky";
    user.equippedPaint = "holiday";
}

export default class ResetGarageCommand implements ICommand {
    name = "resetgarage";
    description = "Reseta a garagem de um usuário para o padrão de conta nova. Uso: /resetgarage <username>.";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.ADMINISTRATOR;
    usage = "<username>";
    example = "/resetgarage Joao";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        if (args.length < 1) {
            context.reply("Uso: /resetgarage <username>.");
            return;
        }
        const online = context.server.findClientByUsername(args[0]);
        const user = online?.user ?? (await context.server.userService.findUserByUsername(args[0]));
        if (!user) {
            context.reply(`Usuário "${args[0]}" não encontrado.`);
            return;
        }

        resetGarageInventory(user);
        await user.save();
        if (online) GarageWorkflow.reloadGarage(online, context.server);
        context.reply(`Garagem de ${user.username} resetada para o padrão (wasp/smoky/holiday).`);
    }
}
