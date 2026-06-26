import { DEFAULT_PORT } from "@/config/constants";
import { DebugConsole } from "@/console/debug.console";
import { ConfigService } from "@/core/config/config.service";
import { connectToDatabase, disconnectFromDatabase } from "@/database";
import { AuthService } from "@/features/authentication/auth.service";
import { BattleService } from "@/features/battle/battle.service";
import { ChatService } from "@/features/chat/chat.service";
import { CommandService } from "@/features/chat/commands/command.service";
import { FriendsService } from "@/features/friends/friends.service";
import { GarageService } from "@/features/garage/garage.service";
import { InviteService } from "@/features/invite/invite.service";
import { LobbyService } from "@/features/lobby/lobby.service";
import { ProfileService } from "@/features/profile/profile.service";
import { ClanService } from "@/features/clan/clan.service";
import { QuestService } from "@/features/quests/quests.service";
import { ReferralService } from "@/features/referral/referral.service";
import { SettingsService } from "@/features/settings/settings.service";
import { ShopService } from "@/features/shop/shop.service";
import { PacketHandlerService } from "@/packets/packet-handler.service";
import { PacketService } from "@/packets/packet.service";
import { GameServer } from "@/server/game.server";
import { ResourceServer } from "@/server/resource.server";
import { RankService } from "@/shared/services/rank.service";
import { UserService } from "@/shared/services/user.service";
import logger from "@/utils/logger";
import { ResourceManager } from "@/utils/resource.manager";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT) : DEFAULT_PORT;

async function bootstrap() {
  logger.info("Starting server initialization");

  ResourceManager.loadResources();
  logger.info("Resource configurations loaded");

  const commandService = new CommandService();
  const configService = new ConfigService();
  const rankService = new RankService();
  const userService = new UserService(rankService);
  const settingsService = new SettingsService(userService);
  const inviteService = new InviteService();
  const chatService = new ChatService(userService);
  const packetHandlerService = new PacketHandlerService();
  const packetService = new PacketService();
  const shopService = new ShopService();
  const questService = new QuestService();
  const garageService = new GarageService();
  const friendsService = new FriendsService(userService);
  const authService = new AuthService(userService);
  const lobbyService = new LobbyService();
  const referralService = new ReferralService();
  const profileService = new ProfileService();
  const clanService = new ClanService();
  let battleService: BattleService;

  await connectToDatabase();
  logger.info("Database connection established");

  const configPath = path.join(__dirname, "initial-config.json");
  const defaultConfigs = JSON.parse(fs.readFileSync(configPath, "utf8"));
  await configService.initializeDefaultConfigs(defaultConfigs);

  await configService.loadAndCacheConfigs();

  const server = new GameServer(
    {
      port: PORT,
      maxClients: configService.getMaxClients(),
      needInviteCode: configService.getNeedInviteCode(),
      socialNetworks: configService.getSocialNetworksForServer(),
      loginForm: {
        bgResource: ResourceManager.getIdlowById("ui/login_background"),
        enableRequiredEmail: false,
        maxPasswordLength: 64,
        minPasswordLength: 3,
      },
    },
    () => battleService,
    {
      commandService,
      configService,
      userService,
      inviteService,
      chatService,
      packetHandlerService,
      packetService,
      shopService,
      rankService,
      questService,
      garageService,
      friendsService,
      authService,
      lobbyService,
      settingsService,
      referralService,
      profileService,
      clanService,
    }
  );

  battleService = new BattleService(server, lobbyService);

  const resourceServer = new ResourceServer();
  const debugConsole = new DebugConsole(server, userService);

  logger.info("Starting LeTanki and Resource servers");
  server.start();
  resourceServer.start();
  debugConsole.start();

  process.on("SIGTERM", async () => {
    logger.info("Received SIGTERM. Initiating graceful shutdown...");
    try {
      await server.stop();
      logger.info("LeTanki server stopped");

      await resourceServer.stop();
      logger.info("Resource server stopped");

      await disconnectFromDatabase();
      logger.info("Database connection closed");
    } catch (error) {
      logger.error("Error during graceful shutdown", { error });
      process.exit(1);
    } finally {
      logger.info("Flushing logs before shutdown");
      logger.on("finish", () => {
        logger.info("Logger flushed and closed");
        process.exit(0);
      });
      logger.end();
    }
  });
}

(async () => {
  try {
    await bootstrap();
  } catch (error) {
    const errorDetails = error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error), stack: undefined };

    logger.error("Failed to bootstrap server", { error: errorDetails });
  }
})();