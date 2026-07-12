import { LobbyService } from "@/features/lobby/lobby.service";
import { UserDocument } from "@/shared/models/user.model";
import { UserService } from "@/shared/services/user.service";
import logger from "@/utils/logger";
import ChatMessage from "./chat.model";

export interface PopulatedChatMessage {
    sourceUser: UserDocument | null;
    targetUser: UserDocument | null;
    message: string;
    isSystemMessage: boolean;
    isWarning: boolean;
}

// Máximo de mensagens mantidas no histórico persistido (bate com o `chatHistoryLimit` do config, que
// limita a CARGA). Ao passar disso, o excedente mais antigo é apagado a cada nova mensagem.
const CHAT_HISTORY_LIMIT = 70;

export class ChatService {
    private userService: UserService;

    constructor(userService: UserService) {
        this.userService = userService;
    }

    public async getChatHistory(limit: number): Promise<PopulatedChatMessage[]> {
        try {
            const messages = await ChatMessage.find().sort({ timestamp: -1 }).limit(limit).populate<{ sourceUser: UserDocument | null }>("sourceUser", "username rank chatModeratorLevel").populate<{ targetUser: UserDocument | null }>("targetUser", "username rank chatModeratorLevel").exec();

            return messages.reverse() as unknown as PopulatedChatMessage[];
        } catch (error) {
            logger.error("Failed to get chat history", { error });
            return [];
        }
    }

    private async _parseBattleLinks(message: string, lobbyService: LobbyService): Promise<string> {
        const regex = /#\/battle\/([a-f0-9]+)/gi;
        const matches = Array.from(message.matchAll(regex));
        let processedMessage = message;

        for (const match of matches) {
            const fullPattern = match[0];
            const battleId = match[1];

            const battle = lobbyService.getBattleById(battleId);

            if (battle) {
                const battleName = battle.settings.name;
                const replacement = `#battle|${battleName}|${battleId}`;
                processedMessage = processedMessage.replace(fullPattern, replacement);
            }
        }

        return processedMessage;
    }

    public async postMessage(sourceUser: UserDocument, targetNickname: string | null, message: string, lobbyService: LobbyService): Promise<PopulatedChatMessage> {
        let targetUser: UserDocument | null = null;
        if (targetNickname) {
            targetUser = await this.userService.findUserByUsername(targetNickname);
        }

        const processedMessage = await this._parseBattleLinks(message, lobbyService);

        const chatMessage = new ChatMessage({
            sourceUser: sourceUser._id,
            targetUser: targetUser ? targetUser._id : null,
            message: processedMessage,
        });

        await chatMessage.save();
        await this._trimHistory();

        sourceUser.lastMessageTimestamp = new Date();
        await sourceUser.save();

        return {
            sourceUser,
            targetUser,
            message: processedMessage,
            isSystemMessage: false,
            isWarning: false,
        };
    }

    /** Mantém só as `CHAT_HISTORY_LIMIT` mensagens mais recentes; apaga o excedente mais antigo. */
    private async _trimHistory(): Promise<void> {
        try {
            const overflow = await ChatMessage.find().sort({ timestamp: -1 }).skip(CHAT_HISTORY_LIMIT).limit(1).select("timestamp").lean();
            if (overflow.length > 0) {
                await ChatMessage.deleteMany({ timestamp: { $lt: (overflow[0] as { timestamp: Date }).timestamp } });
            }
        } catch (error) {
            logger.error("Failed to trim chat history", { error });
        }
    }

    /** Remove do histórico TODAS as mensagens enviadas por um usuário. Retorna quantas foram apagadas. */
    public async removeUserMessages(user: UserDocument): Promise<number> {
        try {
            const res = await ChatMessage.deleteMany({ sourceUser: user._id });
            return res.deletedCount ?? 0;
        } catch (error) {
            logger.error(`Failed to remove chat messages of ${user.username}`, { error });
            return 0;
        }
    }
}