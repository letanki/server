import { battleDataObject } from "@/config/battle.data";
import { CALLBACK, WEBPANEL } from "@/config/constants";
import { newsData } from "@/config/news.data";
import { HideLoginForm, Punishment } from "@/features/authentication/auth.packets";
import { Battle, BattleMode, EquipmentConstraintsMode, MapTheme } from "@/features/battle/battle.model";
import { BattleWorkflow } from "@/features/battle/battle.workflow";
import * as ChatPackets from "@/features/chat/chat.packets";
import { PopulatedChatMessage } from "@/features/chat/chat.service";
import { IChatMessageData } from "@/features/chat/chat.types";
import * as ClanPackets from "@/features/clan/clan.packets";
import { UnloadGaragePacket } from "@/features/garage/garage.packets";
import { LoadDependencies } from "@/features/loader/loader.packets";
import * as ProfilePackets from "@/features/profile/profile.packets";
import { AchievementTips, EmailInfo, PremiumInfo } from "@/features/profile/profile.packets";
import * as QuestPackets from "@/features/quests/quests.packets";
import { ReferralInfo } from "@/features/referral/referral.packets";
import { LocalizationInfo } from "@/features/shop/shop.packets";
import { ConfirmLayoutChange, SetLayout } from "@/features/system/system.packets";
import { sendWebPanel } from "@/features/webpanel/webpanel.service";
import { ResourceId } from "@/generated/resourceTypes";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { Achievement } from "@/shared/models/enums/achievement.enum";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";
import { isNewbieActive, isProBattleActive, isCrystalAbonementActive, NEWBIE_CRYSTAL_BONUS_PERCENT, PRO_BATTLE_ENTER_PRICE, secondsLeft, XP_BONUS_PERCENT } from "@/shared/models/passes";
import { UserDocument, UserDocumentWithFriends } from "@/shared/models/user.model";
import { FormatUtils } from "@/utils/format.utils";
import logger from "@/utils/logger";
import { ResourceManager } from "@/utils/resource.manager";
import * as LobbyPackets from "./lobby.packets";
import { UnloadBattleListPacket } from "./lobby.packets";

const mapUserToObject = (user: UserDocument) => ({
    kills: 0,
    score: 0,
    suspicious: false,
    user: user.username,
});

export class LobbyWorkflow {
    public static async enterLobby(client: GameClient, server: GameServer): Promise<void> {
        if (!client.user) {
            logger.error("Attempted to enter lobby without a user authenticated.", { client: client.getRemoteAddress() });
            return;
        }

        const populatedUser = (await client.user.populate("friends", "username")) as UserDocumentWithFriends;
        client.friendsCache = populatedUser.friends.map((friend) => friend.username);
        logger.info(`Friends list for ${client.user.username} cached with ${client.friendsCache.length} friends.`);

        await this.returnToLobby(client, server, false);
    }

    public static async postAuthenticationFlow(client: GameClient, server: GameServer): Promise<boolean> {
        const user = client.user!;
        server.indexAuthenticatedClient(client);

        // Session takeover: if this account already has another live connection — a second PC/client, or a
        // stale/dead socket from an abrupt drop (power/internet loss) that never fired TCP 'close' — drop it
        // so only this newest session survives. Closing it runs the normal disconnect flow, which (if it was
        // in a battle) starts that battle's 60s reconnect grace; the reconnect block below then pulls THIS
        // session back into that battle. Without this the dead client kept the player stuck in the match and
        // a returning player was treated as a brand-new login (never re-seated). removeClient's index guard
        // makes the order safe even though we already indexed this client above.
        for (const other of server.getClients()) {
            if (other !== client && other.user?.id === user.id) {
                logger.info(`User ${user.username} opened a new session; dropping the previous connection (${other.getRemoteAddress()}).`);
                other.closeConnection();
            }
        }

        if (user.isPunished && user.punishmentExpiresAt && user.punishmentExpiresAt > new Date()) {
            const now = new Date();
            const timeLeftMs = user.punishmentExpiresAt.getTime() - now.getTime();
            const days = Math.floor(timeLeftMs / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeLeftMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));

            client.sendPacket(new Punishment({ reason: user.punishmentReason, days, hours, minutes }));
            logger.info(`Punished user ${user.username} attempted to login`, { client: client.getRemoteAddress() });
            return false;
        }

        client.sendPacket(new HideLoginForm());
        // Clan module must be initialized BEFORE the lobby panel (LobbyData / official "InitPanel",
        // id 907073245) is built, or the panel renders without the clan button — the official sends
        // it as the first post-login init. Send it ahead of sendPlayerVitals (which sends LobbyData).
        // Repopulate the "sent requests" modal: send the request card (325031295) for each pending join
        // request BEFORE InitUserClanModels, and feed the same tags into InitUserClanModels (the client
        // renders the sent-requests list from that vector at init). Without either the request "disappears".
        let pendingTags: string[] = [];
        if (!user.clanId) {
            const pending = await server.clanService.getPendingRequests(user);
            for (const clan of pending) {
                const view = await server.clanService.buildClanView(clan);
                client.sendPacket(new ClanPackets.JoinRequestModelPacket(view));
            }
            pendingTags = pending.map((c) => c.tag);
        }
        // Dados reais do módulo de clã para o painel (antes eram todos placeholder):
        //  - tag do PRÓPRIO clã → título "[TAG] nick"; convites recebidos; pedidos ao clã do dono;
        //    cooldown de entrar/criar (após sair de um clã); e se pode criar (rank >= mínimo).
        const ownClan = user.clanId ? await server.clanService.getClanById(user.clanId) : null;
        const ownClanTag = ownClan ? ownClan.tag : null;
        const incomingInviteTags = user.clanId ? [] : await server.clanService.getInvitingClanTags(user);
        const joinRequestNicks = ownClan ? await server.clanService.getJoinRequestNicks(ownClan) : [];
        let clanJoinCooldownSeconds = 0;
        if (user.clanCooldownUntil && user.clanCooldownUntil > new Date()) {
            clanJoinCooldownSeconds = Math.max(0, Math.round((user.clanCooldownUntil.getTime() - Date.now()) / 1000));
        }
        client.sendPacket(new LobbyPackets.InitUserClanModelsPacket({
            selfClanTag: ownClanTag,
            outgoingRequestTags: pendingTags,
            incomingInviteTags,
            joinRequestNicks,
            joinCooldownSeconds: clanJoinCooldownSeconds,
            canCreateClan: user.rank >= LobbyPackets.InitUserClanModelsPacket.MIN_RANK_TO_CREATE,
        }));
        // Janela do Passe Iniciante enquanto ativo (+50% XP + 100% cristais/batalha). A imagem da janela
        // é servida por NÓS (resources/passes/newbie/window, idLow local) — pré-carregamos no cliente e só
        // então disparamos o InitNewbieBonus (no callback do load), garantindo a imagem pronta.
        // Mostra só UMA vez (no 1º login após ganhar o passe) — depois `newbieBonusShown` fica true e a
        // janela não reaparece a cada login, mesmo com o passe ainda ativo.
        if (isNewbieActive(user) && !user.newbieBonusShown) {
            user.newbieBonusShown = true;
            await user.save();
            const windowResource = "passes/newbie/window" as ResourceId;
            const windowImageIdLow = ResourceManager.getIdlowById(windowResource);
            const newbieCbId = server.registerDynamicCallback((acking) => {
                if (acking !== client) return;
                server.removeDynamicCallback(newbieCbId);
                client.sendPacket(new LobbyPackets.InitNewbieBonusPacket({
                    durationSeconds: secondsLeft(user.newbieExpiresAt),
                    crystalBonusPercent: NEWBIE_CRYSTAL_BONUS_PERCENT,
                    experienceBonusPercent: XP_BONUS_PERCENT.NEWBIE,
                    windowImageId: { high: 0, low: windowImageIdLow },
                }));
            });
            client.sendPacket(new LoadDependencies({ resources: ResourceManager.getBulkResources([windowResource]) }, newbieCbId));
        }

        // Notícias do lobby: envia só as que este usuário ainda NÃO viu (cada uma aparece 1x por pessoa)
        // e as marca como vistas. O `id` de cada notícia é interno (rastreio), não vai no pacote.
        const unseenNews = newsData.filter((n) => !user.seenNewsIds.includes(n.id));
        if (unseenNews.length > 0) {
            client.sendPacket(new LobbyPackets.InitNewsPacket({
                news: unseenNews.map((n) => ({ imageUrl: n.imageUrl, date: n.date, textHtml: n.textHtml })),
            }));
            user.seenNewsIds.push(...unseenNews.map((n) => n.id));
            await user.save();
        }
        this.sendPlayerVitals(user, client, server);
        // Tag do próprio clã também no ClanNotifierData/SetClan (rende a tag ao lado do nick no chat).
        // O TÍTULO do painel "[TAG] nick" vem do InitUserClanModels.tag acima; este complementa o chat.
        client.sendPacket(new ProfilePackets.ClanNotifierData(user.username, ownClanTag));
        this.sendInitialSettings(client, server);
        this.sendAchievementTips(user, client);

        // Reconnect: the player is still in the battle roster (held by the 1-min reconnect timer), so we
        // re-enter the battle directly — the player is in the battle, NOT the lobby. enterBattle skips
        // the lobby-teardown packet (UnloadLobbyChat, id -920985123) on reconnect, which otherwise
        // null-derefs on a client that never loaded the lobby (#1009).
        const reconnectData = server.battleService.handlePlayerReconnection(user);
        if (reconnectData) {
            const battle = server.lobbyService.getBattleById(reconnectData.battleId);
            if (battle) {
                logger.info(`User ${user.username} is reconnecting to battle ${battle.battleId}`);
                client.currentBattle = battle;

                server.notifySubscribersOfStatusChange(user.username, true);
                await BattleWorkflow.enterBattle(client, server, battle, true);
                return true;
            }
        }

        await LobbyWorkflow.enterLobby(client, server);
        server.notifySubscribersOfStatusChange(user.username, true);

        // Auto-open the daily-missions window if a mission completed while the player was away and they
        // haven't seen it yet (matches the official; getQuestsForUser then marks it viewed).
        if (server.questService.hasUnviewedCompletion(user)) {
            const questData = await server.questService.getQuestsForUser(user);
            client.sendPacket(
                questData.quests.length === 0
                    ? new QuestPackets.QuestSummaryWindow(questData)
                    : new QuestPackets.ShowQuestsWindow(questData)
            );
        }

        return true;
    }

    public static async returnToLobby(client: GameClient, server: GameServer, fromGarage: boolean = true): Promise<void> {
        if (fromGarage) {
            client.sendPacket(new UnloadGaragePacket());
        }

        if (client.user && !client.isChatLoaded) {
            await this.sendChatSetup(client.user, client, server);
        }

        client.setState("chat_lobby");
        client.sendPacket(new SetLayout({ layoutId: 0 }));

        const resourceIds: ResourceId[] = [];
        const dependencies = { resources: ResourceManager.getBulkResources(resourceIds) };
        client.sendPacket(new LoadDependencies(dependencies, CALLBACK.LOBBY_DATA));

        // Modal informativo da Ranqueada: só na PRIMEIRA vez que o cliente chega ao lobby NESTA sessão.
        // returnToLobby é o ponto único de chegada ao lobby (login→lobby via enterLobby, e sair da
        // batalha/garagem→lobby), então reconectar direto na batalha não passa por aqui — e ao sair da
        // batalha depois, este é o 1º acesso ao lobby da sessão e o modal aparece.
        if (!client.rankedIntroShown) {
            client.rankedIntroShown = true;
            sendWebPanel(client, { url: `${WEBPANEL.URL}?intro=1`, width: 460, height: 300, x: -1, y: -1 }, "ranked-intro");
        }
    }

    public static enterBattleLobbyView(client: GameClient, server: GameServer): void {
        client.setState("battle_lobby");
        client.sendPacket(new SetLayout({ layoutId: 0 }));
        client.sendPacket(new LoadDependencies({ resources: [] }, CALLBACK.LOBBY_DATA));
        client.sendPacket(new ConfirmLayoutChange({ fromLayout: 3, toLayout: 0 }));
    }

    public static transitionFromGarageToLobby(client: GameClient, server: GameServer): void {
        client.sendPacket(new UnloadGaragePacket());
        this.enterBattleLobbyView(client, server);
    }

    public static returnToBattleView(client: GameClient, server: GameServer): void {
        client.setState("battle");
        client.sendPacket(new SetLayout({ layoutId: 3 }));
        client.sendPacket(new UnloadBattleListPacket());
        client.sendPacket(new ConfirmLayoutChange({ fromLayout: 3, toLayout: 3 }));
    }

    public static async initializeLobby(client: GameClient, server: GameServer): Promise<void> {
        this.sendBattleInfo(client);
        this.sendBattleList(client, server);

        let targetBattle: Battle | undefined;

        if (client.lastViewedBattleId) {
            targetBattle = server.lobbyService.getBattleById(client.lastViewedBattleId);
        }

        if (!targetBattle && client.user) {
            targetBattle = server.lobbyService.findBattleForPlayer(client.user);
        }

        if (targetBattle) {
            client.lastViewedBattleId = targetBattle.battleId;
            await this.sendBattleDetails(client, server, targetBattle);
        }

        client.sendPacket(new ConfirmLayoutChange({ fromLayout: 0, toLayout: 0 }));
    }

    private static sendPlayerVitals(user: UserDocument, client: GameClient, server: GameServer): void {
        let premiumSecondsLeft = 0;
        if (user.premiumExpiresAt && user.premiumExpiresAt > new Date()) {
            premiumSecondsLeft = Math.round((user.premiumExpiresAt.getTime() - Date.now()) / 1000);
        }
        client.sendPacket(new PremiumInfo({ lifeTimeInSeconds: premiumSecondsLeft }));

        // Duração do abonement de Dobro de Cristais em MILISSEGUNDOS (o cliente espera ms — captura ativa
        // ~86399992 = 24h). -1 quando não há abonement temporizado (captura inativa: -1 / false).
        let crystalAbonementMsLeft = -1;
        if (user.crystalAbonementExpiresAt && user.crystalAbonementExpiresAt > new Date()) {
            crystalAbonementMsLeft = user.crystalAbonementExpiresAt.getTime() - Date.now();
        }

        const rankInfo = server.rankService.getRankById(user.rank);
        const currentRankMinScore = rankInfo ? rankInfo.minScore : 0;

        client.sendPacket(
            new LobbyPackets.LobbyData({
                crystals: user.crystals,
                currentRankScore: currentRankMinScore,
                durationCrystalAbonement: crystalAbonementMsLeft,
                hasDoubleCrystal: isCrystalAbonementActive(user),
                nextRankScore: user.nextRankScore,
                place: 0,
                rank: user.rank,
                rating: 0,
                score: user.experience,
                serverNumber: 1,
                nickname: user.username,
                userProfileUrl: "http://ratings.example.com/pt_br/user/",
            })
        );

        const maskedEmail = user.email ? FormatUtils.maskEmail(user.email) : null;
        client.sendPacket(new EmailInfo({ email: maskedEmail, emailConfirmed: user.emailConfirmed }));

        client.sendPacket(new ReferralInfo({ hash: user.referralHash, host: "s.pro-tanki.com" }));
    }

    private static sendInitialSettings(client: GameClient, server: GameServer): void {
        const countries = server.configService.getShopEnabledCountries();
        const locationSwitchingEnabled = server.configService.getShopLocationSwitchingEnabled();
        client.sendPacket(new LocalizationInfo(countries, "BR", locationSwitchingEnabled));

        const battleInviteSoundId = ResourceManager.getIdlowById("sounds/notifications/battle_invite");
        client.sendPacket(new LobbyPackets.SetBattleInviteSound({ soundIdLow: battleInviteSoundId }));
    }

    private static sendAchievementTips(user: UserDocument, client: GameClient): void {
        const tipsToSend: Achievement[] = [];
        if (!user.unlockedAchievements.includes(Achievement.FIRST_PURCHASE)) {
            tipsToSend.push(Achievement.FIRST_PURCHASE);
        }
        if (!user.unlockedAchievements.includes(Achievement.FIGHT_FIRST_BATTLE)) {
            tipsToSend.push(Achievement.FIGHT_FIRST_BATTLE);
        }
        client.sendPacket(new AchievementTips(tipsToSend));
    }

    public static async sendChatSetup(user: UserDocument, client: GameClient, server: GameServer): Promise<void> {
        const configService = server.configService;

        client.sendPacket(
            new ChatPackets.ChatProperties({
                admin: user.chatModeratorLevel === ChatModeratorLevel.ADMINISTRATOR,
                antifloodEnabled: configService.getChatAntifloodEnabled(),
                bufferSize: configService.getChatBufferSize(),
                chatEnabled: configService.getChatEnabled(),
                chatModeratorLevel: user.chatModeratorLevel,
                linksWhiteList: configService.getChatLinksWhitelist(),
                minChar: configService.getChatMinChar(),
                minWord: configService.getChatMinWord(),
                selfName: user.username,
                showLinks: configService.getChatShowLinks(),
                typingSpeedAntifloodEnabled: configService.getChatTypingSpeedAntifloodEnabled(),
            })
        );

        client.sendPacket(new ChatPackets.AntifloodSettings({ charDelayFactor: configService.getChatCharDelayFactor(), messageBaseDelay: configService.getChatMessageBaseDelay() }));

        const historyLimit = configService.getChatHistoryLimit();
        const messages = await server.chatService.getChatHistory(historyLimit);
        const messageData: IChatMessageData[] = messages.map((msg: PopulatedChatMessage) => ({
            message: msg.message,
            isSystem: msg.isSystemMessage,
            isWarning: msg.isWarning,
            source: msg.sourceUser
                ? {
                    uid: msg.sourceUser.username,
                    rank: msg.sourceUser.rank,
                    moderatorLevel: msg.sourceUser.chatModeratorLevel,
                    ip: null,
                }
                : null,
            target: msg.targetUser
                ? {
                    uid: msg.targetUser.username,
                    rank: msg.targetUser.rank,
                    moderatorLevel: msg.targetUser.chatModeratorLevel,
                    ip: null,
                }
                : null,
        }));
        client.sendPacket(new ChatPackets.ChatHistory({ messages: messageData }));

        client.isChatLoaded = true;
    }

    private static sendBattleInfo(client: GameClient): void {
        const battleData = JSON.parse(JSON.stringify(battleDataObject));

        // Tempo restante do Passe de Batalha PRO do próprio usuário (0 sem passe) — o estático do
        // battle.data.ts é só placeholder.
        battleData.proBattleTimeLeftInSec = client.user ? secondsLeft(client.user.proBattleExpiresAt) : 0;

        battleData.maps.forEach((map: any) => {
            if (map.previewResource) {
                try {
                    map.preview = ResourceManager.getIdlowById(map.previewResource as ResourceId);
                } catch (error) {
                    logger.error(`Failed to get preview resource for map: ${map.previewResource}`, { error });
                    map.preview = 0;
                }
                delete map.previewResource;
            }
        });

        const jsonData = JSON.stringify(battleData);
        client.sendPacket(new LobbyPackets.BattleInfo({ jsonData }));
    }

    /** Builds a single battle's entry for the battle LIST (uses plain username strings — the battle
     *  DETAILS/ShowBattleInfo use objects; sending objects here breaks player count, friend matching
     *  and add/remove-by-username on join/leave). Reused by the full list, CreateBattle and the
     *  private-battle preview grant so the card shape stays identical everywhere. */
    public static buildBattleListEntry(battle: Battle): object {
        const preview = this.getMapPreviewResourceId(battle);
        const basePayload = {
            battleId: battle.battleId,
            battleMode: BattleMode[battle.settings.battleMode],
            map: battle.settings.mapId,
            maxPeople: battle.settings.maxPeopleCount,
            name: battle.settings.name,
            privateBattle: battle.settings.privateBattle,
            proBattle: battle.settings.proBattle,
            minRank: battle.settings.minRank,
            maxRank: battle.settings.maxRank,
            preview: preview,
            parkourMode: battle.settings.parkourMode,
            equipmentConstraintsMode: EquipmentConstraintsMode[battle.settings.equipmentConstraintsMode],
            suspicionLevel: "NONE",
        };

        if (battle.isTeamMode()) {
            return {
                ...basePayload,
                usersBlue: battle.usersBlue.map((u) => u.username),
                usersRed: battle.usersRed.map((u) => u.username),
            };
        }
        return {
            ...basePayload,
            users: battle.users.map((u) => u.username),
        };
    }

    private static sendBattleList(client: GameClient, server: GameServer): void {
        // Private battles are hidden from everyone except the creator, invited players and anyone who
        // opened the battle's preview from a chat link (see Battle.canBeSeenBy).
        const battles = server.lobbyService.getBattles().filter((battle) => battle.canBeSeenBy(client.user));

        const battleListPayload = battles.map((battle) => this.buildBattleListEntry(battle));

        const jsonData = JSON.stringify({ battles: battleListPayload });
        client.sendPacket(new LobbyPackets.BattleList({ jsonData }));
    }

    public static getMapPreviewResourceId(battle: Battle): number {
        const battleThemeStr = MapTheme[battle.settings.mapTheme];
        const mapInfo = battleDataObject.maps.find((m) => m.mapId === battle.settings.mapId && m.theme === battleThemeStr);

        if (mapInfo) {
            try {
                return ResourceManager.getIdlowById(mapInfo.previewResource as ResourceId);
            } catch (error) {
                logger.warn(`Could not find resource for map preview: ${mapInfo.previewResource}`);
            }
        } else {
            logger.warn(`Could not find map info for mapId: ${battle.settings.mapId} and theme: ${battleThemeStr}`);
        }
        return 0;
    }

    public static async sendBattleDetails(client: GameClient, server: GameServer, battle: Battle): Promise<void> {
        client.sendPacket(new LobbyPackets.SelectBattlePacket(battle.battleId));

        const preview = this.getMapPreviewResourceId(battle);

        let timeLeftInSec = battle.settings.timeLimitInSec;
        if (battle.roundStarted && battle.roundStartTime) {
            const elapsedSeconds = Math.floor((Date.now() - battle.roundStartTime) / 1000);
            timeLeftInSec = Math.max(0, battle.settings.timeLimitInSec - elapsedSeconds);
        }

        const baseDetailsPayload = {
            battleMode: BattleMode[battle.settings.battleMode],
            itemId: battle.battleId,
            scoreLimit: battle.settings.scoreLimit,
            timeLimitInSec: battle.settings.timeLimitInSec,
            preview: preview,
            maxPeopleCount: battle.settings.maxPeopleCount,
            name: battle.settings.name,
            proBattle: battle.settings.proBattle,
            minRank: battle.settings.minRank,
            maxRank: battle.settings.maxRank,
            roundStarted: battle.roundStarted,
            spectator: true,
            withoutBonuses: battle.settings.withoutBonuses,
            withoutCrystals: battle.settings.withoutCrystals,
            withoutSupplies: battle.settings.withoutSupplies,
            proBattleEnterPrice: PRO_BATTLE_ENTER_PRICE,
            timeLeftInSec: timeLeftInSec,
            // Estado do passe PRO do próprio espectador: tempo restante do passe e se entra sem pagar —
            // porque tem o passe OU já pagou a entrada nesta batalha (reentrada grátis). 0/false sem passe.
            userPaidNoSuppliesBattle: client.user ? (isProBattleActive(client.user) || battle.paidEntryUserIds.has(client.user.id)) : false,
            proBattleTimeLeftInSec: client.user ? secondsLeft(client.user.proBattleExpiresAt) : 0,
            parkourMode: battle.settings.parkourMode,
            equipmentConstraintsMode: EquipmentConstraintsMode[battle.settings.equipmentConstraintsMode],
            reArmorEnabled: battle.settings.reArmorEnabled,
            reducedResistance: battle.settings.reducedResistances,
            esportDropTiming: battle.settings.esportDropTiming,
            withoutGoldBoxes: battle.settings.withoutGoldBoxes,
            withoutGoldSiren: battle.settings.withoutGoldSiren,
            withoutGoldZone: battle.settings.withoutGoldZone,
            withoutMedkit: battle.settings.withoutMedkit,
            withoutMines: battle.settings.withoutMines,
            randomGold: battle.settings.randomGold,
            dependentCooldownEnabled: battle.settings.dependentCooldownEnabled,
        };

        let finalPayload;
        if (battle.isTeamMode()) {
            finalPayload = {
                ...baseDetailsPayload,
                usersBlue: battle.usersBlue.map(mapUserToObject),
                usersRed: battle.usersRed.map(mapUserToObject),
                scoreRed: battle.scoreRed,
                scoreBlue: battle.scoreBlue,
                autoBalance: battle.settings.autoBalance,
                friendlyFire: battle.settings.friendlyFire,
            };
        } else {
            finalPayload = {
                ...baseDetailsPayload,
                users: battle.users.map(mapUserToObject),
            };
        }

        const jsonData = JSON.stringify(finalPayload);
        client.sendPacket(new LobbyPackets.BattleDetails({ jsonData }));
    }
}