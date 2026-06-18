import { Battle, BattleMode, EquipmentConstraintsMode, IBattleCreationSettings, MapTheme } from "@/features/battle/battle.model";
import { UserDocument } from "@/shared/models/user.model";
import { mapCtfFlags } from "@/types/mapCtfFlags";
import { mapDomKeypoints } from "@/types/mapDomKeypoints";
import logger from "@/utils/logger";
import { ValidationUtils } from "@/utils/validation.utils";

export class LobbyService {
    private activeBattles: Map<string, Battle> = new Map();

    constructor() {
        this.createDefaultBattle();
    }

    public validateName(name: string): string {
        if (ValidationUtils.isNicknameInappropriate(name)) {
            return "****";
        }
        return name;
    }

    private createDefaultBattle(): void {
        const defaultBattleSettings: IBattleCreationSettings = {
            name: "Batalha para Novatos",
            privateBattle: false,
            proBattle: false,
            battleMode: BattleMode.DM,
            mapId: "map_sandbox",
            // The client's BattlefieldModel holds tanks in a fixed Vector(60); the 61st tank
            // overflows it with RangeError #1125. Never let a battle exceed MAX_TANKS_PER_BATTLE.
            maxPeopleCount: 60,
            minRank: 1,
            maxRank: 30,
            timeLimitInSec: 600,
            scoreLimit: 20,
            autoBalance: true,
            friendlyFire: false,
            parkourMode: false,
            equipmentConstraintsMode: EquipmentConstraintsMode.NONE,
            reArmorEnabled: true,
            mapTheme: MapTheme.SUMMER,
            withoutBonuses: false,
            withoutCrystals: false,
            withoutSupplies: false,
            withoutUpgrades: false,
            reducedResistances: false,
            esportDropTiming: false,
            withoutGoldBoxes: false,
            withoutGoldSiren: false,
            withoutGoldZone: false,
            withoutMedkit: false,
            withoutMines: false,
            randomGold: true,
            dependentCooldownEnabled: false,
        };
        this.createBattle(defaultBattleSettings);
    }

    public createBattle(settings: IBattleCreationSettings, creator?: UserDocument): Battle {
        try {
            const battle = new Battle(settings);

            if (settings.battleMode === BattleMode.CTF) {
                const flags = mapCtfFlags[battle.mapResourceId];
                if (flags) {
                    battle.flagBasePositionBlue = flags.blue;
                    battle.flagPositionBlue = flags.blue;
                    battle.flagBasePositionRed = flags.red;
                    battle.flagPositionRed = flags.red;
                } else {
                    logger.warn(`CTF flag positions not found for map ${battle.mapResourceId}.`);
                }
            }

            if (settings.battleMode === BattleMode.CP) {
                const keypoints = mapDomKeypoints[battle.mapResourceId];
                if (keypoints) {
                    battle.domPoints = keypoints.map((kp, index) => ({
                        id: index,
                        name: kp.name,
                        position: kp.position,
                        state: 2,
                        score: 0,
                        tanksOnPoint: [],
                    }));
                } else {
                    logger.warn(`DOM keypoints not found for map ${battle.mapResourceId}.`);
                }
            }

            this.activeBattles.set(battle.battleId, battle);
            logger.info(`Battle created`, {
                battleId: battle.battleId,
                name: settings.name,
                creator: creator?.username ?? "System",
            });
            return battle;
        } catch (error: any) {
            logger.error(`Failed to create battle due to missing map resource: ${error.message}`);
            throw new Error("Não foi possível criar a batalha. O mapa selecionado não está disponível no servidor.");
        }
    }

    public getBattles(): Battle[] {
        return Array.from(this.activeBattles.values());
    }

    public getBattleById(id: string): Battle | undefined {
        return this.activeBattles.get(id);
    }

    public isUserInBattle(username: string): boolean {
        const lowercasedUsername = username.toLowerCase();
        for (const battle of this.activeBattles.values()) {
            const isUserInBattle =
                battle.users.some((u) => u.username.toLowerCase() === lowercasedUsername) ||
                battle.usersBlue.some((u) => u.username.toLowerCase() === lowercasedUsername) ||
                battle.usersRed.some((u) => u.username.toLowerCase() === lowercasedUsername) ||
                battle.spectators.some((u) => u.username.toLowerCase() === lowercasedUsername);

            if (isUserInBattle) {
                return true;
            }
        }
        return false;
    }

    public findBattleForPlayer(user: UserDocument): Battle | undefined {
        return this.getBattles().find((battle) => {
            const settings = battle.settings;
            return !settings.privateBattle && user.rank >= settings.minRank && user.rank <= settings.maxRank;
        });
    }
}