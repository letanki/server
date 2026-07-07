import { CLAN_LOGO_DIR, CLAN_LOGO_ROUTE } from "@/features/clan/clan.logo";
import { RankedMatchmakingService } from "@/features/ranked/ranked.matchmaking.service";
import { PanelSession, resolvePanelToken } from "@/features/webpanel/webpanel.auth";
import logger from "@/utils/logger";
import cors from "cors";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import { Server } from "http";
import path from "path";

dotenv.config();

export class ResourceServer {
  private app: express.Application;
  private port: number;
  private resourceDir: string;
  private server: Server | null = null;

  constructor(private matchmaking: RankedMatchmakingService) {
    this.app = express();
    this.app.use(cors());
    this.port = process.env.RESOURCE_PORT ? parseInt(process.env.RESOURCE_PORT) : 9999;
    this.resourceDir = path.join(__dirname, "../../.resource");
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.use(express.static(this.resourceDir));
    // Uploaded clan logos live outside .resource (which build:resources overwrites); served under /clanlogo.
    this.app.use(CLAN_LOGO_ROUTE, express.static(CLAN_LOGO_DIR));
    // In-game web panel (HTMLLoader target) — served OPAQUE now (competitive matchmaking UI). The old
    // transparent/borderless idea was the blocker under Stage3D; an opaque modal renders fine. Paired with
    // scripts/patches/webpanel-button.js. no-store so the AIR WebKit never shows a stale page.
    this.app.use(
      "/panel",
      express.static(path.join(__dirname, "../../webpanel"), {
        etag: false,
        lastModified: false,
        setHeaders: (res) => {
          res.setHeader("Cache-Control", "no-store");
          // StageWebView (Windows) usa o motor IE/Trident e abre em modo IE7 por padrão. Este header
          // força o modo IE11 standards (Date.now/textContent/CSS-animations/flexbox funcionam).
          res.setHeader("X-UA-Compatible", "IE=edge");
        },
      })
    );
    this.setupRankedApi();
    this.app.get("/", (req: Request, res: Response) => {
      res.send("Resource Server is running");
    });
    this.app.use((req: Request, res: Response) => {
      res.status(404).send("Resource not found");
    });
  }

  /**
   * API HTTP do painel de Partida Competitiva. Autenticada pelo token de sessão que o servidor injeta na
   * URL do painel (?token=...) — o mesmo processo do game server, então o token store é compartilhado.
   * FASE 0b: só valida a ponte (whoami/echo). Os endpoints reais de fila/ranking entram na Fase 1.
   */
  private setupRankedApi(): void {
    this.app.use("/ranked", express.json());

    // resolve o token da querystring e anexa a sessão em res.locals; 401 se inválido
    const auth = (req: Request, res: Response, next: () => void): void => {
      const token = typeof req.query.token === "string" ? req.query.token : undefined;
      const session = resolvePanelToken(token);
      if (!session) {
        res.status(401).json({ error: "token inválido ou expirado" });
        return;
      }
      res.locals.session = session;
      next();
    };

    // GET /ranked/whoami → identidade da sessão (prova a ponte autenticada)
    this.app.get("/ranked/whoami", auth, async (_req: Request, res: Response) => {
      const s = res.locals.session as PanelSession;
      res.json({ username: s.username, tag: await this.matchmaking.getUserTag(s.userId) });
    });

    // GET /ranked/status → estado atual do jogador na fila/partida
    this.app.get("/ranked/status", auth, async (_req: Request, res: Response) => {
      const s = res.locals.session as PanelSession;
      res.json(await this.matchmaking.status(s.userId));
    });

    // POST /ranked/enqueue → entra na fila (modo XP/BP)
    this.app.post("/ranked/enqueue", auth, async (_req: Request, res: Response) => {
      const s = res.locals.session as PanelSession;
      const r = await this.matchmaking.enqueue(s.userId, s.username);
      res.status(r.ok ? 200 : 409).json(r);
    });

    // POST /ranked/cancel → sai da fila / cancela o pareamento (tela "partida encontrada")
    this.app.post("/ranked/cancel", auth, (_req: Request, res: Response) => {
      const s = res.locals.session as PanelSession;
      res.json(this.matchmaking.cancel(s.userId));
    });

    // POST /ranked/enter → o painel confirma o fim da contagem local → servidor entra os dois
    this.app.post("/ranked/enter", auth, (_req: Request, res: Response) => {
      const s = res.locals.session as PanelSession;
      res.json(this.matchmaking.playerReady(s.userId));
    });

    // POST /ranked/dismiss → dispensa a tela de resultado ("Sair")
    this.app.post("/ranked/dismiss", auth, (_req: Request, res: Response) => {
      const s = res.locals.session as PanelSession;
      res.json(this.matchmaking.dismissResult(s.userId));
    });

    // GET /ranked/leaderboard → classificação do modo (top N) + posição do jogador
    this.app.get("/ranked/leaderboard", auth, async (_req: Request, res: Response) => {
      const s = res.locals.session as PanelSession;
      const [top, you] = await Promise.all([
        this.matchmaking.getLeaderboard(20),
        this.matchmaking.getPlayerPosition(s.userId),
      ]);
      res.json({ top, you });
    });

    // GET /ranked/miners → rank de maiores mineiros do servidor (quem mais colocou minas)
    this.app.get("/ranked/miners", auth, async (_req: Request, res: Response) => {
      res.json({ top: await this.matchmaking.getTopMiners(20) });
    });
  }

  public start(): void {
    this.server = this.app.listen(this.port, () => {
      logger.info(`Resource Server started`, {
        port: this.port,
        resourceDir: this.resourceDir,
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        logger.info("Resource Server not running");
        return resolve();
      }
      this.server.close((err?: Error) => {
        if (err) {
          logger.error("Error stopping Resource Server", { error: err });
          return reject(err);
        }
        resolve();
      });
    });
  }
}
