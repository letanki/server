import { CLAN_LOGO_DIR, CLAN_LOGO_ROUTE } from "@/features/clan/clan.logo";
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

  constructor() {
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
    // In-game web panel (HTMLLoader target): extra client features (e.g. per-weapon shot color). SHELVED —
    // the HTMLLoader can't be made transparent/borderless under Stage3D direct render mode. Kept disabled
    // as reference; re-enable together with scripts/patches/_webpanel-button.js if the idea is revived.
    // this.app.use(
    //   "/panel",
    //   express.static(path.join(__dirname, "../../webpanel"), {
    //     etag: false,
    //     lastModified: false,
    //     setHeaders: (res) => res.setHeader("Cache-Control", "no-store"),
    //   })
    // );
    this.app.get("/", (req: Request, res: Response) => {
      res.send("Resource Server is running");
    });
    this.app.use((req: Request, res: Response) => {
      res.status(404).send("Resource not found");
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
