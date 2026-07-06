import { UnloadSpaceBattlePacket } from "@/features/battle/battle-init.packets";
import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { LobbyWorkflow } from "@/features/lobby/lobby.workflow";
import { ChatModeratorLevel, chatModeratorPower } from "@/shared/models/enums/chat-moderator-level.enum";

/** Removes a player from whatever battle they're in and sends them back to the lobby (they stay
 *  connected). Mirrors the voluntary exit flow (ExitFromBattleHandler). */
export default class KickBattleCommand implements ICommand {
    name = "kickbattle";
    description = "Remove um jogador da partida (volta pro lobby, sem desconectar). Uso: /kickbattle <username>.";
    permissionLevel = ChatModeratorLevel.MODERATOR;
    usage = "<username>";
    example = "/kickbattle Joao";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        if (args.length < 1) {
            context.reply("Uso: /kickbattle <username>.");
            return;
        }
        const target = context.server.findClientByUsername(args[0]);
        if (!target?.user) {
            // Offline but possibly still held in a battle roster (closed the game mid-match — the 60s
            // reconnect grace, or a stale entry): force-remove straight from the roster.
            const battleId = await context.server.battleService.kickOfflineFromBattle(args[0]);
            context.reply(
                battleId
                    ? `${args[0]} (offline) foi removido da partida ${battleId}.`
                    : `Jogador "${args[0]}" não está online nem preso em alguma partida.`
            );
            return;
        }
        const battle = target.currentBattle;
        if (!battle) {
            context.reply(`${target.user.username} não está em uma batalha.`);
            return;
        }
        if (target !== context.executor &&
            chatModeratorPower(target.user.chatModeratorLevel) >= chatModeratorPower(context.executor.user!.chatModeratorLevel)) {
            context.reply(`Você não pode remover ${target.user.username} (cargo igual ou superior ao seu).`);
            return;
        }

        // Same sequence as the voluntary exit (ExitFromBattleHandler, layout 0 → lobby).
        const isSpectator = target.isSpectator;
        if (!isSpectator) {
            context.server.battleService.announceTankRemoval(target.user, battle, target.battlePosition);
        }
        await context.server.battleService.finalizeBattleExit(target.user, battle, target.friendsCache, isSpectator);
        target.sendPacket(new UnloadSpaceBattlePacket());
        target.currentBattle = null;
        target.isSpectator = false;
        target.battleState = "suicide";
        target.stopTimeChecker();
        await LobbyWorkflow.returnToLobby(target, context.server, false);

        context.reply(`${target.user.username} foi removido da partida ${battle.battleId}.`);
    }
}
