import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { itemBlueprints } from "@/features/garage/garage.data";
import { GarageWorkflow } from "@/features/garage/garage.workflow";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/** Grants a specific garage item to a user — hulls/turrets always at their FIRST modification (m0);
 *  use /setmod afterwards to change it. */
export default class GiveItemCommand implements ICommand {
    name = "giveitem";
    description = "Dá um item a um usuário (hull/turret em m0 — ajuste com /setmod — ou pintura). Uso: /giveitem <username> <itemId>.";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.ADMINISTRATOR;
    usage = "<username> <itemId>";
    example = "/giveitem Joao railgun";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        if (args.length < 2) {
            context.reply("Uso: /giveitem <username> <itemId>.");
            return;
        }
        const online = context.server.findClientByUsername(args[0]);
        const user = online?.user ?? (await context.server.userService.findUserByUsername(args[0]));
        if (!user) {
            context.reply(`Usuário "${args[0]}" não encontrado.`);
            return;
        }
        const itemId = args[1].toLowerCase();

        const hull = itemBlueprints.hulls.find((h) => h.id === itemId);
        const turret = itemBlueprints.turrets.find((t) => t.id === itemId);
        const paint = itemBlueprints.paints.find((p) => p.id === itemId);

        if (hull) {
            user.hulls.set(itemId, 0);
            await user.save();
            context.reply(`${user.username} recebeu o hull "${itemId}" m0 (use /setmod para mudar).`);
        } else if (turret) {
            user.turrets.set(itemId, 0);
            await user.save();
            context.reply(`${user.username} recebeu a torreta "${itemId}" m0 (use /setmod para mudar).`);
        } else if (paint) {
            if (!user.paints.includes(itemId)) user.paints.push(itemId);
            await user.save();
            context.reply(`${user.username} recebeu a pintura "${itemId}".`);
        } else {
            context.reply(`Item "${itemId}" não existe (hulls/turrets/pinturas do garage).`);
            return;
        }

        if (online) GarageWorkflow.reloadGarage(online, context.server);
    }
}
