import { GameServer } from "@/server/game.server";
import { UserDocument } from "@/shared/models/user.model";
import { ItemUtils } from "@/utils/item.utils";
import logger from "@/utils/logger";

export interface FullUserInfo {
    user: UserDocument;
    isOnline: boolean;
    isInBattle: boolean;
}

export class ProfileService {
    public async getFullUserInfo(server: GameServer, username: string): Promise<FullUserInfo | null> {
        const targetUser = await server.userService.findUserByUsername(username);
        if (!targetUser) {
            logger.warn(`User info requested for non-existent user: ${username}`);
            return null;
        }

        // Ponto central de "solicitar a info do usuário" (inclui premium): reconcilia LAZY o estado
        // derivado do premium (pintura premium equipada → green quando expira) e persiste se mudou, para
        // que qualquer leitor — inclusive o perfil de OUTRO jogador — veja o banco já corrigido.
        await ItemUtils.reconcilePremiumEquipment(targetUser);

        const targetClient = server.findClientByUsername(username);
        const isOnline = !!targetClient;
        const isInBattle = isOnline ? server.lobbyService.isUserInBattle(username) : false;

        return {
            user: targetUser,
            isOnline,
            isInBattle,
        };
    }
}