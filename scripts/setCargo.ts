import "dotenv/config";
import { connectToDatabase, disconnectFromDatabase } from "@/database";
import {
    chatModeratorLevelName,
    parseChatModeratorLevel,
} from "@/shared/models/enums/chat-moderator-level.enum";
import User from "@/shared/models/user.model";

/**
 * Bootstrap script to set a user's staff cargo directly in the DB — mainly to create the FIRST Community
 * Manager, who then manages everyone else's cargo in-game via /setcargo.
 *
 *   npm run set-cargo -- <usuário> <cargo>
 *   (cargos: none, candidato, moderador, administrador, cm)
 */
async function main(): Promise<void> {
    const [username, cargoArg] = process.argv.slice(2);

    if (!username || !cargoArg) {
        console.error("Uso: npm run set-cargo -- <usuário> <cargo>");
        console.error("Cargos: none, candidato, moderador, administrador, cm");
        process.exit(1);
    }

    const level = parseChatModeratorLevel(cargoArg);
    if (level === null) {
        console.error(`Cargo inválido "${cargoArg}". Válidos: none, candidato, moderador, administrador, cm.`);
        process.exit(1);
    }

    await connectToDatabase();
    try {
        const user = await User.findOne({ login: username.toLowerCase() });
        if (!user) {
            console.error(`Usuário "${username}" não encontrado.`);
            process.exitCode = 1;
            return;
        }

        user.chatModeratorLevel = level;
        await user.save();
        console.log(`Cargo de ${user.username} definido para ${chatModeratorLevelName(level)} (nível ${level}).`);
    } finally {
        await disconnectFromDatabase();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
