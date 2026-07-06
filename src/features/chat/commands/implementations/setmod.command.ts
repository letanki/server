import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { GarageWorkflow } from "@/features/garage/garage.workflow";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

/** Changes the modification (m0-m3) of an OWNED hull/turret. If it's equipped and the target is in a
 *  battle, the change applies on the next respawn/garage pass. */
export default class SetModCommand implements ICommand {
    name = "setmod";
    description = "Muda a modificação de um item possuído (hull/turret). Uso: /setmod <username> <itemId> <mod>.";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.ADMINISTRATOR;
    usage = "<username> <itemId> [0/1/2/3]";
    example = "/setmod Joao railgun 3";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const mod = parseInt(args[2], 10);
        if (args.length < 3 || isNaN(mod) || mod < 0 || mod > 3) {
            context.reply("Uso: /setmod <username> <itemId> <mod 0-3>.");
            return;
        }
        const online = context.server.findClientByUsername(args[0]);
        const user = online?.user ?? (await context.server.userService.findUserByUsername(args[0]));
        if (!user) {
            context.reply(`Usuário "${args[0]}" não encontrado.`);
            return;
        }
        const itemId = args[1].toLowerCase();

        if (user.hulls.has(itemId)) user.hulls.set(itemId, mod);
        else if (user.turrets.has(itemId)) user.turrets.set(itemId, mod);
        else {
            context.reply(`${user.username} não possui "${itemId}" (só hulls/turrets possuídos).`);
            return;
        }

        await user.save();
        if (online) GarageWorkflow.reloadGarage(online, context.server);
        context.reply(`"${itemId}" de ${user.username} agora é m${mod}.`);
    }
}
