import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { GarageWorkflow } from "@/features/garage/garage.workflow";
import { UpdateRankPacket, UpdateScorePacket } from "@/features/profile/profile.packets";
import { ChatModeratorLevel, hasModeratorPower } from "@/shared/models/enums/chat-moderator-level.enum";
import { broadcastPlayerRankToOthers } from "@/features/profile/rank.notify";

/** Jumps straight to rank N by setting the experience to that rank's threshold. Self-use is public
 *  (sandbox server); targeting ANOTHER user requires Administrator (checked inside). */
export default class SetRankCommand implements ICommand {
    name = "setrank";
    description = "Pula direto para o rank N (em outro jogador: só administrador). Uso: /setrank [username] <rank>.";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.NONE;
    usage = "[username] <rank>";
    example = "/setrank 15";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const { server } = context;
        let targetName: string | null = null;
        let rankArg: string;
        if (args.length >= 2) { targetName = args[0]; rankArg = args[1]; }
        else if (args.length === 1) { rankArg = args[0]; }
        else {
            context.reply("Uso: /setrank [username] <rank>.");
            return;
        }

        const rank = parseInt(rankArg, 10);
        const rankInfo = isNaN(rank) ? null : server.rankService.getRankById(rank);
        if (!rankInfo) {
            context.reply(`Rank inválido "${rankArg}".`);
            return;
        }

        // Targeting someone else is a staff action; self-use stays public.
        if (targetName && !hasModeratorPower(context.executor.user!.chatModeratorLevel, ChatModeratorLevel.ADMINISTRATOR)) {
            context.reply("Definir o rank de outro jogador exige cargo de Administrador.");
            return;
        }

        const online = targetName ? server.findClientByUsername(targetName) : context.executor;
        const user = online?.user ?? (targetName ? await server.userService.findUserByUsername(targetName) : context.executor.user);
        if (!user) {
            context.reply(`Usuário "${targetName}" não encontrado.`);
            return;
        }

        try {
            // updateResources recomputes rank/nextRankScore from the experience.
            const updated = await server.userService.updateResources(user.id, { experience: rankInfo.minScore });
            if (online?.user) {
                online.user = updated;
                online.sendPacket(new UpdateScorePacket({ score: updated.experience }));
                online.sendPacket(new UpdateRankPacket({
                    rank: updated.rank,
                    score: updated.experience,
                    currentRankScore: rankInfo.minScore,
                    nextRankScore: updated.nextRankScore,
                    reward: 0,
                }));
                // Rank-dependent garage lists don't rebuild in place — reload if they have it open.
                GarageWorkflow.reloadGarage(online, server);
            }
            // Atualiza o rank visual do alvo para todos os demais online.
            broadcastPlayerRankToOthers(server, updated);
            context.reply(`${updated.username} agora é rank ${updated.rank} (${rankInfo.name ?? ""}).`);
        } catch (error: any) {
            context.reply(`Erro: ${error.message}`);
        }
    }
}
