import { CommandContext, ICommand } from "@/features/chat/commands/command.types";
import { ChatModeratorLevel } from "@/shared/models/enums/chat-moderator-level.enum";

const MODES = ["dm", "tdm", "ctf", "cp", "as"] as const;
const TYPES = ["normal", "xpbp", "parkour"] as const;

/** Debug: dumps a user's persisted long-term stats (see StatsService). `/stats` for self, `/stats <nick>`
 *  for someone else. Read-only; shows the last flushed values (NOT the current in-progress round). */
export default class StatsCommand implements ICommand {
    name: string = "stats";
    description: string = "Mostra as estatísticas de longo prazo. Uso: /stats [usuário] (vazio = você).";
    permissionLevel: ChatModeratorLevel = ChatModeratorLevel.NONE;
    usage = "[usuário]";
    example = "/stats Joao";

    async execute(context: CommandContext, args: string[]): Promise<void> {
        const target = args.length >= 1
            ? await context.server.userService.findUserByUsername(args[0])
            : context.executor.user;
        if (!target) {
            context.reply(`Usuário "${args[0]}" não encontrado.`);
            return;
        }

        const st: any = target.stats;
        const counters: Map<string, number> = st?.counters ?? new Map();
        const c = (key: string): number => counters.get(key) ?? 0;
        const s = (field: string): number => st?.[field] ?? 0;
        const ratio = (a: number, b: number): string => (b > 0 ? (a / b).toFixed(2) : a.toFixed(2));

        const kills = c("kills");
        const deaths = c("deaths");
        const wins = c("wins");
        const losses = c("losses");

        context.reply(`=== Stats de ${target.username} (persistido, sem o round atual) ===`);
        context.reply(
            `Partidas: ${c("battles_played")} | Vitórias: ${wins} | Derrotas: ${losses} | W/L: ${ratio(wins, losses)}`
        );
        context.reply(
            `Kills: ${kills} | Mortes: ${deaths} | K/D: ${ratio(kills, deaths)} | Suicídios: ${c("suicides")}`
        );
        context.reply(
            `XP: ${c("xp_earned")} | Cristais: ${c("crystals_earned")} | Dano dado/recebido: ${c("damage_dealt")}/${c("damage_taken")}`
        );
        context.reply(
            `Suprimentos usados: ${c("supplies_used")} (minas: ${c("mines_used")}) | Pegos: ${c("supplies_picked")}`
        );
        context.reply(
            `Recordes/partida — kills: ${s("maxKillsInBattle")}, mortes: ${s("maxDeathsInBattle")}, cristais: ${s("maxCrystalsInBattle")}, xp: ${s("maxXpInBattle")}, dano: ${s("maxDamageInBattle")}`
        );
        context.reply(
            `Sequências — vitórias: ${s("currentWinStreak")} (máx ${s("maxWinStreak")}) | derrotas: ${s("currentLossStreak")} (máx ${s("maxLossStreak")})`
        );

        // Per-mode breakdown (only modes actually played), each split by type when present.
        const perMode: string[] = [];
        for (const m of MODES) {
            const played = c(`battles_played:${m}`);
            if (played <= 0) continue;
            const typeParts = TYPES.map((t) => {
                const n = c(`battles_played:${m}:${t}`);
                return n > 0 ? `${t} ${n}` : null;
            }).filter(Boolean);
            perMode.push(
                `  ${m.toUpperCase()}: ${played}p V${c(`wins:${m}`)}/D${c(`losses:${m}`)} K${c(`kills:${m}`)}/M${c(`deaths:${m}`)}` +
                    (typeParts.length ? ` [${typeParts.join(", ")}]` : "")
            );
        }
        if (perMode.length) {
            context.reply("Por modo (partidas, V/D, K/M):");
            for (const line of perMode) context.reply(line);
        }
    }
}
