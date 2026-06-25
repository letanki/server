import { getBonusData } from "@/config/bonus.data";
import { IPacket } from "@/packets/packet.interfaces";
import { CALLBACK } from "@/config/constants";
import { hullPhysicsData, turretPhysicsData } from "@/config/hull-physics.data";
import { mapThemeConfigs } from "@/config/map-themes.data";
import { weaponPhysicsData } from "@/config/physics.data";
import { sfxBlueprints } from "@/config/sfx.blueprints";
import { suppliesData } from "@/config/supplies.data";
import { UnloadLobbyChatPacket } from "@/features/chat/chat.packets";
import { LoadDependencies } from "@/features/loader/loader.packets";
import { UnloadBattleListPacket } from "@/features/lobby/lobby.packets";
import { ConfirmLayoutChange, SetLayout } from "@/features/system/system.packets";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { UserDocument } from "@/shared/models/user.model";
import { IVector3 } from "@/shared/types/geom/ivector3";
import { ResourceId } from "@/generated/resourceTypes";
import { ItemUtils } from "@/utils/item.utils";
import logger from "@/utils/logger";
import { ResourceManager } from "@/utils/resource.manager";
import { Battle, BattleMode, IDomPointState, MapTheme } from "./battle.model";
import * as BattlePackets from "./battle.packets";
import { BonusType, IBattleUser, IBattleUserInfo } from "./battle.types";

export class BattleWorkflow {
    public static async enterBattle(client: GameClient, server: GameServer, battle: Battle, isReconnect: boolean = false): Promise<void> {
        if (!client.user) {
            logger.error("Attempted to enter battle without a user authenticated.", { client: client.getRemoteAddress() });
            return;
        }

        client.isJoiningBattle = true;
        client.setState("battle");
        logger.info(`User ${client.user.username} is entering battle ${battle.battleId}`);

        client.sendPacket(new SetLayout(3));
        // Lobby-teardown packets: only valid when entering FROM the lobby. On reconnect the player is
        // still in the battle (never went to the lobby), and UnloadLobbyChat (id -920985123, the
        // client's UnloadBattleEntity) null-derefs on a client with no lobby loaded (#1009).
        if (!isReconnect) {
            client.sendPacket(new UnloadBattleListPacket());
            client.sendPacket(new UnloadLobbyChatPacket());
        }
        client.isChatLoaded = false;
        client.startTimeChecker();
        client.sendPacket(new BattlePackets.WeaponPhysicsPacket(JSON.stringify(weaponPhysicsData)));
        client.sendPacket(new BattlePackets.BonusDataPacket(JSON.stringify(getBonusData())));

        const dependencies = { resources: battle.mapLibraryDependencies };
        client.sendPacket(new LoadDependencies(dependencies, CALLBACK.BATTLE_MAP_LIBS_LOADED));
    }

    public static loadMapResources(client: GameClient, server: GameServer, battle: Battle): void {
        logger.info(`User ${client.user?.username} is loading skybox for battle ${battle.battleId}.`);
        const mapIdWithoutPrefix = battle.settings.mapId.replace("map_", "");
        const skyboxDependencies = ResourceManager.getSkyboxResources(mapIdWithoutPrefix, battle.settings.mapTheme);
        const dependencies = { resources: skyboxDependencies };
        client.sendPacket(new LoadDependencies(dependencies, CALLBACK.BATTLE_SKYBOX_LOADED));
    }

    public static loadMapGeometry(client: GameClient, server: GameServer, battle: Battle): void {
        logger.info(`User ${client.user?.username} is loading map geometry for battle ${battle.battleId}.`);

        const dependencies = { resources: ResourceManager.getBulkResources([battle.mapResourceId]) };
        client.sendPacket(new LoadDependencies(dependencies, CALLBACK.BATTLE_MAP_GEOMETRY_LOADED));
    }

    public static loadGeneralBattleResources(client: GameClient, server: GameServer, battle: Battle): void {
        logger.info(`User ${client.user?.username} is loading general battle resources for battle ${battle.battleId}.`);

        const generalResources: ResourceId[] = [
            "sounds/maps/sandbox_ambient", "effects/dust", "sounds/mine_activate", "effects/mine/blue_mine_texture", "sounds/mine_deactivate", "effects/mine/enemy_mine_texture",
            "effects/mine/explosion_mark_texture", "sounds/mine_explosion", "effects/mine/friendly_mine_texture", "effects/mine/idle_explosion_texture", "effects/mine/main_explosion_texture",
            "effects/mine/model", "effects/mine/red_mine_texture", "sounds/hull/engine_idle", "sounds/hull/engine_start", "sounds/hull/engine_move", "sounds/turret/turn",
            "effects/bonus/drop_location_marker", "effects/explosions/fire", "effects/explosions/shockwave", "effects/explosions/smoke", "paint/destroyed/texture",
            "effects/flamethrower/fire_texture", "sounds/flamethrower/flame", "effects/flamethrower/m0/muzzle_plane_texture", "effects/flamethrower/m1/muzzle_plane_texture",
            "effects/flamethrower/m2/muzzle_plane_texture", "effects/flamethrower/m3/muzzle_plane_texture", "effects/freeze/particle_texture", "effects/freeze/plane_texture",
            "sounds/freeze/shot", "effects/isida/damaging_ball", "effects/isida/damaging_ray", "sounds/isida/damaging", "effects/isida/healing_ball", "effects/isida/healing_ray",
            "sounds/isida/healing", "sounds/isida/idle", "sounds/machinegun/chain_start", "effects/machinegun/crumbs_texture", "effects/machinegun/dust_texture",
            "effects/machinegun/fire_across_texture", "effects/machinegun/fire_along_texture", "sounds/machinegun/hit", "sounds/machinegun/long_fail", "sounds/machinegun/shoot_end",
            "sounds/machinegun/shoot", "effects/machinegun/smoke_texture", "effects/machinegun/sparkles_texture", "sounds/machinegun/tank_hit", "effects/machinegun/tank_sparkles_texture",
            "effects/machinegun/tracer_texture", "sounds/machinegun/turbine_start", "effects/railgun/charging_part1", "effects/railgun/charging_part2", "effects/railgun/charging_part3",
            "effects/railgun/hit_mark_texture", "effects/railgun/pow_texture", "effects/railgun/rings_texture", "sounds/railgun/shot", "effects/railgun/smoke_image", "effects/railgun/sphere_texture",
            "effects/railgun/trail_image", "effects/ricochet/bump_flash_texture", "effects/ricochet/explosion_texture", "sounds/ricochet/explosion", "sounds/ricochet/ricochet",
            "effects/ricochet/shot_flash_texture", "sounds/ricochet/shot", "effects/ricochet/shot_texture", "effects/ricochet/tail_trail_texutre", "turret/shaft/m0/reticle",
            "turret/shaft/m1/reticle", "turret/shaft/m2/reticle", "turret/shaft/m3/reticle", "sounds/shaft/explosion", "effects/shaft/explosion_texture", "effects/shaft/hit_mark_texture",
            "effects/shaft/muzzle_flash_texture", "sounds/shaft/shot", "sounds/shaft/targeting", "effects/shaft/trail_texture", "sounds/shaft/zoom_mode", "sounds/shotgun/magazine_reload",
            "sounds/shotgun/reload", "sounds/shotgun/shot", "effects/shotgun/explosion_mark_texture0", "effects/shotgun/explosion_mark_texture1", "effects/shotgun/explosion_mark_texture2",
            "effects/shotgun/explosion_mark_texture3", "effects/shotgun/smoke_texture", "effects/shotgun/sparkle_texture", "effects/shotgun/pellet_trail_texture",
            "effects/shotgun/shot_along_texture", "effects/shotgun/shot_across_texture", "effects/smoky/critical_hit", "effects/smoky/explosion_mark", "sounds/smoky/explosion",
            "effects/smoky/explosion/m0", "effects/smoky/explosion/m1", "effects/smoky/explosion/m2", "effects/smoky/explosion/m3", "sounds/smoky/shot", "effects/smoky/shot",
            "effects/thunder/explosion_mark", "sounds/thunder/explosion", "effects/thunder/explosion/m0", "sounds/thunder/shot", "effects/thunder/shot", "effects/thunder/explosion/m1",
            "effects/thunder/explosion/m2", "effects/thunder/explosion/m3", "effects/twins/explosion", "effects/twins/hit_mark", "effects/twins/muzzle_flash", "sounds/twins/shot", "effects/twins/shot",
            "flags/blue_flag_sprite", "flags/blue_pedestal", "flags/red_flag_sprite", "flags/red_pedestal", "sounds/flags/flag_drop", "sounds/flags/flag_return", "sounds/flags/flag_take",
            "sounds/flags/win", "effects/cp/big_letters", "effects/cp/blue_circle", "effects/cp/blue_pedestal_texture", "effects/cp/blue_ray", "effects/cp/blue_ray_tip",
            "effects/cp/neutral_circle", "effects/cp/neutral_pedestal_texture", "effects/cp/pedestal", "effects/cp/red_circle", "effects/cp/red_pedestal_texture",
            "effects/cp/red_ray", "effects/cp/red_ray_tip", "sounds/cp/point_capture_start_negative", "sounds/cp/point_capture_start_positive", "sounds/cp/point_capture_stop_negative",
            "sounds/cp/point_capture_stop_positive", "sounds/cp/point_captured_negative", "sounds/cp/point_captured_positive", "sounds/cp/point_neutralized_negative",
            "sounds/cp/point_neutralized_positive", "sounds/cp/point_score_decreasing", "sounds/cp/point_score_increasing",
        ];

        const dependencies = { resources: ResourceManager.getBulkResources(generalResources) };
        client.sendPacket(new LoadDependencies(dependencies, CALLBACK.BATTLE_GENERAL_RESOURCES_LOADED));
    }

    public static loadPlayerEquipment(client: GameClient, server: GameServer, battle: Battle): void {
        logger.info(`User ${client.user?.username} is loading player equipment for battle ${battle.battleId}.`);

        const allPlayers = [...battle.users, ...battle.usersRed, ...battle.usersBlue];
        const resourceSet = new Set<ResourceId>();

        allPlayers.forEach((player) => {
            const turretId = player.equippedTurret;
            const turretMod = player.turrets.get(turretId) ?? 0;
            resourceSet.add(`turret/${turretId}/m${turretMod}/model` as ResourceId);

            const hullId = player.equippedHull;
            const hullMod = player.hulls.get(hullId) ?? 0;
            resourceSet.add(`hull/${hullId}/m${hullMod}/model` as ResourceId);

            const paintId = player.equippedPaint;
            resourceSet.add(`paint/${paintId}/texture` as ResourceId);
        });

        const dependencies = { resources: ResourceManager.getBulkResources(Array.from(resourceSet)) };
        client.sendPacket(new LoadDependencies(dependencies, CALLBACK.BATTLE_PLAYER_EQUIPMENT_LOADED));
    }

    private static mapUserToBattleUser(user: UserDocument): IBattleUser {
        return {
            chatModeratorLevel: user.chatModeratorLevel,
            deaths: 0,
            kills: 0,
            rank: user.rank,
            score: 0,
            uid: user.username,
        };
    }

    public static getTankModelDataJson(client: GameClient, battle: Battle): string {
        const user = client.user!;
        const hullMod = ItemUtils.getItemModification(user, "hull");
        const turretMod = ItemUtils.getItemModification(user, "turret");

        const toRadians = (degrees: number) => degrees * (Math.PI / 180);

        const hullTurnSpeed = ItemUtils.getPropertyValue(hullMod, "HULL_TURN_SPEED") ?? 0;
        const turretTurnSpeed = ItemUtils.getPropertyValue(turretMod, "TURRET_TURN_SPEED") ?? 0;
        const maxArmor = ItemUtils.getHullArmor(user);
        const clientHealth = (client.currentHealth / maxArmor) * 10000;
        const baseImpactForce = ItemUtils.getPropertyValue(turretMod, "IMPACT_FORCE") ?? 0;
        const finalImpactForce = baseImpactForce / 100;

        const team_type = battle.isTeamMode() ? (battle.usersBlue.some((u: UserDocument) => u.id === user.id) ? "BLUE" : "RED") : "NONE";

        // Per-item physics captured from the original server (see hull-physics.data). Where an item
        // isn't captured yet, these are undefined and we fall back to the old formula/defaults below.
        const hullPhys = hullPhysicsData[`${user.equippedHull}_m${user.hulls.get(user.equippedHull) ?? 0}`];
        const turretPhys = turretPhysicsData[`${user.equippedTurret}_m${user.turrets.get(user.equippedTurret) ?? 0}`];

        const partsObject: { [key: string]: number } = {
            engineIdleSound: ResourceManager.getIdlowById("sounds/hull/engine_idle"),
            engineStartMovingSound: ResourceManager.getIdlowById("sounds/hull/engine_start"),
            engineMovingSound: ResourceManager.getIdlowById("sounds/hull/engine_move"),
            turretRotationSound: ResourceManager.getIdlowById("sounds/turret/turn"),
        };

        const sfxKey = `${user.equippedTurret}_m${user.turrets.get(user.equippedTurret) ?? 0}`;
        const blueprint = sfxBlueprints[sfxKey];

        if (!blueprint) {
            throw new Error(`SFX blueprint for turret ${sfxKey} not found.`);
        }

        const finalSfxData: { [key: string]: any } = {};
        for (const key in blueprint) {
            const value = blueprint[key];
            if (typeof value === "string") {
                try {
                    finalSfxData[key] = ResourceManager.getIdlowById(value as ResourceId);
                } catch (e) {
                    throw new Error(`SFX resource ID "${value}" for turret ${sfxKey} could not be resolved.`);
                }
            } else {
                finalSfxData[key] = value;
            }
        }

        const isSpawningOrDead = client.battleState === "suicide";

        const data: any = {
            battleId: battle.battleId,
            colormap_id: ResourceManager.getIdlowById(`paint/${user.equippedPaint}/texture` as ResourceId),
            hull_id: `${user.equippedHull}_m${user.hulls.get(user.equippedHull) ?? 0}`,
            turret_id: `${user.equippedTurret}_m${user.turrets.get(user.equippedTurret) ?? 0}`,
            team_type: team_type,
            partsObject: JSON.stringify(partsObject),
            hullResource: ResourceManager.getIdlowById(`hull/${user.equippedHull}/m${user.hulls.get(user.equippedHull) ?? 0}/model` as ResourceId),
            turretResource: ResourceManager.getIdlowById(`turret/${user.equippedTurret}/m${user.turrets.get(user.equippedTurret) ?? 0}/model` as ResourceId),
            sfxData: JSON.stringify(finalSfxData),
            // The current client reads these as Resources during InitTank decode;
            // omitting them yields undefined -> TypeError #1009.
            deadColoring: ResourceManager.getIdlowById("paint/destroyed/texture"),
            // Rank-up beam effect resources (rare event). Our old resource map lacks
            // dedicated entries. The client casts beam/wave/spark to the same texture
            // type as deadColoring, so reuse that texture to keep the cast valid
            // (a wrong resource type triggers a #1034 coercion error). levelUpSound is
            // cast to a Sound type, so reuse a loaded sound.
            beamTexture: ResourceManager.getIdlowById("paint/destroyed/texture"),
            waveTexture: ResourceManager.getIdlowById("paint/destroyed/texture"),
            sparkTexture: ResourceManager.getIdlowById("paint/destroyed/texture"),
            levelUpSound: ResourceManager.getIdlowById("sounds/battle/tank_explosion"),
            tank_id: user.username,
            nickname: user.username,
            state: client.battleState,
            incarnation: client.battleIncarnation,
            state_null: isSpawningOrDead,
            maxSpeed: ItemUtils.getPropertyValue(hullMod, "HULL_SPEED") ?? 10,
            maxTurnSpeed: toRadians(hullTurnSpeed),
            acceleration: ItemUtils.getPropertyValue(hullMod, "HULL_POWER", "HULL_ACCELERATION") ?? 14,
            reverseAcceleration: hullPhys?.reverseAcceleration ?? 18,
            sideAcceleration: hullPhys?.sideAcceleration ?? 16,
            turnAcceleration: hullPhys?.turnAcceleration ?? toRadians(hullTurnSpeed) * 1.15,
            reverseTurnAcceleration: hullPhys?.reverseTurnAcceleration ?? toRadians(hullTurnSpeed) * 2.0,
            mass: hullPhys?.mass ?? ItemUtils.getPropertyValue(hullMod, "HULL_MASS") ?? 2000,
            power: ItemUtils.getPropertyValue(hullMod, "HULL_POWER", "HULL_ACCELERATION") ?? 14,
            dampingCoeff: hullPhys?.dampingCoeff ?? 1500,
            turret_turn_speed: toRadians(turretTurnSpeed),
            health: isSpawningOrDead ? 0 : clientHealth,
            rank: user.rank,
            kickback: turretPhys?.kickback ?? 2.5,
            turretTurnAcceleration: turretPhys?.turretTurnAcceleration ?? toRadians(turretTurnSpeed) * 1.6,
            impact_force: finalImpactForce,
        };

        if (isSpawningOrDead) {
            data.position = { x: 0, y: 0, z: 0 };
            data.orientation = { x: 0, y: 0, z: 0 };
            data.turretAngle = 0;
            data.turretControl = 0;
        } else {
            data.position = client.battlePosition;
            data.orientation = client.battleOrientation;
            data.turretAngle = client.turretAngle;
            data.turretControl = client.turretControl;
        }

        return JSON.stringify(data);
    }

    public static initializeBattle(client: GameClient, server: GameServer, battle: Battle): void {
        if (client.isSpectator) {
            this._initializeSpectatorBattleView(client, server, battle);
        } else {
            this._initializePlayerBattleView(client, server, battle);
        }
    }

    private static _initializePlayerBattleView(client: GameClient, server: GameServer, battle: Battle) {
        try {
            const user = client.user!;
            logger.info(`User ${user.username} finished loading all battle resources for ${battle.battleId}. Initializing map...`);
            this._sendCommonBattleData(client, server, battle);

            const allOtherClientsInBattle = server.getClients().filter((c) => c.currentBattle?.battleId === battle.battleId && c.user && c.user.id !== user.id);
            const establishedClients = allOtherClientsInBattle.filter((c) => !c.isJoiningBattle);
            const establishedPlayers = establishedClients.filter((c) => !c.isSpectator);

            for (const existingPlayer of establishedPlayers) {
                const existingTankJson = this.getTankModelDataJson(existingPlayer, battle);
                client.sendPacket(new BattlePackets.TankModelDataPacket(existingTankJson));
            }

            if (establishedClients.length === 0) {
                logger.info(`Battle has no established players. Spawning ${user.username} immediately.`);
                const joiningUserTankJson = this.getTankModelDataJson(client, battle);
                client.sendPacket(new BattlePackets.TankModelDataPacket(joiningUserTankJson));
            } else {
                this._handleConcurrentJoin(client, server, battle, establishedClients);
            }
            this._sendFinalBattlePackets(client, battle);
        } catch (error: any) {
            logger.error(`Error initializing battle for ${client.user?.username}. Disconnecting client.`, { error: error.message });
            server.battleService.removeUserFromBattle(client.user!, battle);
            setTimeout(() => client.closeConnection(), 500);
        }
    }

    private static _initializeSpectatorBattleView(client: GameClient, server: GameServer, battle: Battle) {
        try {
            const user = client.user!;
            logger.info(`Spectator ${user.username} finished loading resources for ${battle.battleId}. Initializing map view...`);
            this._sendCommonBattleData(client, server, battle);

            const spectatorNames = battle.spectators.map((s: UserDocument) => s.username);
            const spectatorListString = spectatorNames.join("\n");
            client.sendPacket(new BattlePackets.UpdateSpectatorListPacket(spectatorListString));

            const allActivePlayers = [...battle.users, ...battle.usersBlue, ...battle.usersRed];
            for (const player of allActivePlayers) {
                const playerClient = server.findClientByUsername(player.username);
                if (playerClient) {
                    const playerTankJson = this.getTankModelDataJson(playerClient, battle);
                    client.sendPacket(new BattlePackets.TankModelDataPacket(playerTankJson));
                }
            }
            this._sendFinalBattlePackets(client, battle);
        } catch (error: any) {
            logger.error(`Error initializing spectator view for ${client.user?.username}.`, { error: error.message });
            setTimeout(() => client.closeConnection(), 500);
        }
    }

    private static _sendCommonBattleData(client: GameClient, server: GameServer, battle: Battle): void {
        const settings = battle.settings;
        const mapIdWithPrefix = settings.mapId;
        const mapIdWithoutPrefix = mapIdWithPrefix.replace("map_", "");

        const skyboxResourceIds = ResourceManager.getSkyboxResourceIds(mapIdWithoutPrefix, settings.mapTheme);
        const skyboxData = {
            top: ResourceManager.getIdlowById(skyboxResourceIds[4]),
            front: ResourceManager.getIdlowById(skyboxResourceIds[0]),
            back: ResourceManager.getIdlowById(skyboxResourceIds[1]),
            bottom: ResourceManager.getIdlowById(skyboxResourceIds[5]),
            left: ResourceManager.getIdlowById(skyboxResourceIds[2]),
            right: ResourceManager.getIdlowById(skyboxResourceIds[3]),
        };

        const themeConfig = mapThemeConfigs[settings.mapTheme];
        const gc: any = themeConfig.graphicConfig;
        // The current client reads these exact keys; missing fields -> TypeError #1009.
        const mapGraphicData = {
            lightColor: gc.lightColor,
            shadowColor: gc.shadowColor,
            shadowAngleX: gc.angleX,
            shadowAngleZ: gc.angleZ,
            ssaoColor: gc.ssaoColor,
            fogAlpha: gc.fogAlpha,
            fogColor: gc.fogColor,
            fogFarLimit: gc.farLimit,
            fogNearLimit: gc.nearLimit,
            gravity: gc.gravity,
            skyboxRevolutionSpeed: gc.skyboxRevolutionSpeed,
        };

        const lightingData = {
            ctfLighting: { redColor: 16711680, redColorIntensity: 1, blueColor: 26367, blueColorIntensity: 1, attenuationBegin: 100, attenuationEnd: 1000 },
            dominationLighting: { redPointColor: 16711680, redPointIntensity: 1, bluePointColor: 26367, bluePointIntensity: 1, neutralPointColor: 16777215, neutralPointIntensity: 0.7, attenuationBegin: 100, attenuationEnd: 1000 },
        };

        const mapInitData: any = {
            kick_period_ms: 300000,
            map_id: mapIdWithPrefix,
            mapId: ResourceManager.getIdlowById(battle.mapResourceId),
            invisible_time: 3500,
            spectator: client.isSpectator,
            active: true,
            dustParticle: ResourceManager.getIdlowById("effects/dust"),
            battleId: battle.battleId,
            minRank: settings.minRank,
            maxRank: settings.maxRank,
            skybox: JSON.stringify(skyboxData),
            ambientSound: ResourceManager.getIdlowById("sounds/maps/sandbox_ambient"),
            tankExplosionSound: ResourceManager.getIdlowById("sounds/battle/tank_explosion"),
            explosionTextureId: ResourceManager.getIdlowById("effects/explosions/fire"),
            shockWaveTextureId: ResourceManager.getIdlowById("effects/explosions/shockwave"),
            smokeTextureId: ResourceManager.getIdlowById("effects/explosions/smoke"),
            map_graphic_data: JSON.stringify(mapGraphicData),
            dustAlpha: gc.dustAlpha,
            dustDensity: gc.dustDensity,
            dustFarDistance: gc.dustFarDistance,
            dustNearDistance: gc.dustNearDistance,
            dustSize: gc.dustSize,
            reArmorEnabled: settings.reArmorEnabled,
            bonusLightIntensity: themeConfig.bonusLightIntensity ?? 0,
            lighting: JSON.stringify(lightingData),
        };

        if (themeConfig.bonusColorAdjust) {
            mapInitData.bonusColorAdjust = themeConfig.bonusColorAdjust;
        }

        client.sendPacket(new BattlePackets.InitMapPacket(JSON.stringify(mapInitData)));

        let timeLeftInSec = battle.settings.timeLimitInSec;
        if (battle.roundStarted && battle.roundStartTime) {
            const elapsedSeconds = Math.floor((Date.now() - battle.roundStartTime) / 1000);
            timeLeftInSec = Math.max(0, battle.settings.timeLimitInSec - elapsedSeconds);
        }

        const battleStatsData = {
            battleMode: settings.battleMode,
            equipmentConstraintsMode: settings.equipmentConstraintsMode,
            fund: battle.fund,
            scoreLimit: settings.scoreLimit,
            timeLimitInSec: settings.timeLimitInSec,
            mapName: settings.name,
            maxPeopleCount: settings.maxPeopleCount,
            parkourMode: settings.parkourMode,
            premiumBonusInPercent: 100,
            spectator: client.isSpectator,
            suspiciousUserIds: [],
            timeLeft: timeLeftInSec,
        };

        client.sendPacket(new BattlePackets.BattleStatsPacket(battleStatsData));
        client.sendPacket(new BattlePackets.LoadBattleChatPacket());

        // Mines properties must be sent before InitBattleDM/Team and InitModelPost
        // (the client finalizes its battle models in InitModelPost; sending mines
        // afterwards leaves the mines model uninitialized -> TypeError #1009).
        client.sendPacket(new BattlePackets.BattleMinesPropertiesPacket(this._buildMineProps()));

        if (battle.settings.battleMode === BattleMode.CTF) {
            const adjustZ = (pos: IVector3 | null): IVector3 | null => {
                if (!pos) return null;
                return { x: pos.x, y: pos.y, z: pos.z + 80 };
            };
            // flagPosition must be null when the flag sits on its base (client renders it
            // static); a non-null position makes the client show the "dropped" (slow-blink)
            // state. Only send a position when the flag is actually dropped away from base.
            const droppedPosition = (pos: IVector3 | null, base: IVector3 | null): IVector3 | null => {
                if (!pos || pos === base) return null;
                return adjustZ(pos);
            };
            const ctfPacket = new BattlePackets.InitCtfFlagsPacket({
                flagBasePositionBlue: adjustZ(battle.flagBasePositionBlue),
                flagCarrierIdBlue: battle.flagCarrierBlue?.username ?? null,
                flagPositionBlue: droppedPosition(battle.flagPositionBlue, battle.flagBasePositionBlue),
                blueFlagSprite: ResourceManager.getIdlowById("flags/blue_flag_sprite"),
                bluePedestalModel: ResourceManager.getIdlowById("flags/blue_pedestal"),
                flagBasePositionRed: adjustZ(battle.flagBasePositionRed),
                flagCarrierIdRed: battle.flagCarrierRed?.username ?? null,
                flagPositionRed: droppedPosition(battle.flagPositionRed, battle.flagBasePositionRed),
                redFlagSprite: ResourceManager.getIdlowById("flags/red_flag_sprite"),
                redPedestalModel: ResourceManager.getIdlowById("flags/red_pedestal"),
                flagDropSound: ResourceManager.getIdlowById("sounds/flags/flag_drop"),
                flagReturnSound: ResourceManager.getIdlowById("sounds/flags/flag_return"),
                flagTakeSound: ResourceManager.getIdlowById("sounds/flags/flag_take"),
                winSound: ResourceManager.getIdlowById("sounds/flags/win"),
            });
            client.sendPacket(ctfPacket);
        }

        if (battle.settings.battleMode === BattleMode.CP) {
            const domPacket = new BattlePackets.InitDomPointsPacket({
                keypointTriggerRadius: 10,
                keypointVisorHeight: 500,
                minesRestrictionRadius: 5,
                points: battle.domPoints.map((p: IDomPointState) => ({ id: p.id, name: p.name, position: p.position, score: p.score, scoreChangeRate: 0, state: p.state, tankIds: p.tanksOnPoint.map((t: UserDocument) => t.username) })),
                bigLetters: ResourceManager.getIdlowById("effects/cp/big_letters"),
                blueCircle: ResourceManager.getIdlowById("effects/cp/blue_circle"),
                bluePedestalTexture: ResourceManager.getIdlowById("effects/cp/blue_pedestal_texture"),
                blueRay: ResourceManager.getIdlowById("effects/cp/blue_ray"),
                blueRayTip: ResourceManager.getIdlowById("effects/cp/blue_ray_tip"),
                neutralCircle: ResourceManager.getIdlowById("effects/cp/neutral_circle"),
                neutralPedestalTexture: ResourceManager.getIdlowById("effects/cp/neutral_pedestal_texture"),
                pedestal: ResourceManager.getIdlowById("effects/cp/pedestal"),
                redCircle: ResourceManager.getIdlowById("effects/cp/red_circle"),
                redPedestalTexture: ResourceManager.getIdlowById("effects/cp/red_pedestal_texture"),
                redRay: ResourceManager.getIdlowById("effects/cp/red_ray"),
                redRayTip: ResourceManager.getIdlowById("effects/cp/red_ray_tip"),
                pointCaptureStartNegativeSound: ResourceManager.getIdlowById("sounds/cp/point_capture_start_negative"),
                pointCaptureStartPositiveSound: ResourceManager.getIdlowById("sounds/cp/point_capture_start_positive"),
                pointCaptureStopNegativeSound: ResourceManager.getIdlowById("sounds/cp/point_capture_stop_negative"),
                pointCaptureStopPositiveSound: ResourceManager.getIdlowById("sounds/cp/point_capture_stop_positive"),
                pointCapturedNegativeSound: ResourceManager.getIdlowById("sounds/cp/point_captured_negative"),
                pointCapturedPositiveSound: ResourceManager.getIdlowById("sounds/cp/point_captured_positive"),
                pointNeutralizedNegativeSound: ResourceManager.getIdlowById("sounds/cp/point_neutralized_negative"),
                pointNeutralizedPositiveSound: ResourceManager.getIdlowById("sounds/cp/point_neutralized_positive"),
                pointScoreDecreasingSound: ResourceManager.getIdlowById("sounds/cp/point_score_decreasing"),
                pointScoreIncreasingSound: ResourceManager.getIdlowById("sounds/cp/point_score_increasing"),
            });
            client.sendPacket(domPacket);
        }

        if (battle.isTeamMode()) {
            client.sendPacket(new BattlePackets.InitBattleTeamPacket());
            const onlineUsersBlue = battle.usersBlue.filter((u: UserDocument) => server.findClientByUsername(u.username));
            const onlineUsersRed = battle.usersRed.filter((u: UserDocument) => server.findClientByUsername(u.username));
            const usersBlue = onlineUsersBlue.map(this.mapUserToBattleUser);
            const usersRed = onlineUsersRed.map(this.mapUserToBattleUser);
            client.sendPacket(new BattlePackets.InitBattleUsersTeamPacket(battle.scoreBlue, battle.scoreRed, usersBlue, usersRed));
        } else {
            client.sendPacket(new BattlePackets.InitBattleDMPacket());
            const onlineUsers = battle.users.filter((u: UserDocument) => server.findClientByUsername(u.username));
            const users = onlineUsers.map(this.mapUserToBattleUser);
            client.sendPacket(new BattlePackets.InitBattleUsersDMPacket(users));
        }

        client.sendPacket(new BattlePackets.InitializeBattleStatisticsPacket());
    }

    private static _handleConcurrentJoin(client: GameClient, server: GameServer, battle: Battle, establishedClients: GameClient[]): void {
        const user = client.user!;
        logger.info(`Waiting for ${establishedClients.length} established players to load resources for ${user.username}.`);
        client.pendingResourceAcks = new Set(establishedClients.map((p) => p.user!.username));
        let spawnTriggered = false;

        const triggerSpawn = (timedOut: boolean) => {
            if (spawnTriggered) return;
            spawnTriggered = true;
            clearTimeout(spawnTimeout);
            server.removeDynamicCallback(callbackId);
            if (timedOut) {
                logger.warn(`Spawning ${user.username} after timeout. The following players did not acknowledge:`, [...client.pendingResourceAcks]);
            } else {
                logger.info(`All established players loaded resources for ${user.username}. Spawning tank.`);
            }
            const joiningUserTankJson = this.getTankModelDataJson(client, battle);
            // Broadcast only to established clients: a client still loading hasn't registered this
            // player in its stats model yet, and InitTank does statsModel.get(tankId).nickname →
            // #1009 on null. Such clients pick this tank up in their own entry snapshot instead.
            battle.broadcast(new BattlePackets.TankModelDataPacket(joiningUserTankJson));
        };

        const spawnTimeout = setTimeout(() => triggerSpawn(true), 10000);

        const onResourcesLoadedCallback = (acknowledgingClient: GameClient) => {
            if (spawnTriggered) return;
            const ackUsername = acknowledgingClient.user!.username;
            logger.info(`${ackUsername} has loaded resources for ${user.username}.`);
            if (client.pendingResourceAcks.has(ackUsername)) {
                client.pendingResourceAcks.delete(ackUsername);
            }
            if (client.pendingResourceAcks.size === 0) {
                triggerSpawn(false);
            }
        };

        var callbackId = server.registerDynamicCallback(onResourcesLoadedCallback);

        const hullId = user.equippedHull,
            hullMod = user.hulls.get(hullId) ?? 0;
        const turretId = user.equippedTurret,
            turretMod = user.turrets.get(turretId) ?? 0;
        const paintId = user.equippedPaint;
        const resourcesToLoad: ResourceId[] = [`turret/${turretId}/m${turretMod}/model` as ResourceId, `hull/${hullId}/m${hullMod}/model` as ResourceId, `paint/${paintId}/texture` as ResourceId];
        const depsPacket = new LoadDependencies({ resources: ResourceManager.getBulkResources(resourcesToLoad) }, callbackId);

        // Known players only: finished joining (!isJoiningBattle) plus the joiner (drops ghosts and
        // mid-join players → avoids null-hole #1009).
        const known = (p: UserDocument) => {
            const c = server.findClientByUsername(p.username);
            return c != null && (!c.isJoiningBattle || p.id === user.id);
        };

        let userConnectPacket: IPacket;
        if (battle.isTeamMode()) {
            // The client REBUILDS the joiner's TEAM COLUMN from this packet's entries, so send every
            // player on the joiner's team (not just the joiner — else an existing same-team player's
            // row vanishes; not the whole roster — else the other team's column is wiped). When the
            // joiner's team has only them, this is the single-entry packet the official sends.
            const team = battle.usersBlue.some((u) => u.id === user.id) ? 1 : 0;
            const teamMembers = (team === 1 ? battle.usersBlue : battle.usersRed).filter(known);
            const usersInfoForPacket: IBattleUserInfo[] = teamMembers.map((p) => ({
                ChatModeratorLevel: p.chatModeratorLevel, deaths: 0, kills: 0, rank: p.rank, score: 0, nickname: p.username,
            }));
            userConnectPacket = new BattlePackets.UserConnectTeamPacket(user.username, usersInfoForPacket, team);
        } else {
            // DM: the client rebuilds its whole array, so include every known player.
            const usersInfoForPacket: IBattleUserInfo[] = [...battle.users, ...battle.usersBlue, ...battle.usersRed].filter(known).map((p) => ({
                ChatModeratorLevel: p.chatModeratorLevel, deaths: 0, kills: 0, rank: p.rank, score: 0, nickname: p.username,
            }));
            userConnectPacket = new BattlePackets.UserConnectDMPacket(user.username, usersInfoForPacket);
        }

        for (const existingClient of establishedClients) {
            existingClient.sendPacket(depsPacket);
            existingClient.sendPacket(userConnectPacket);
        }
    }

    private static _buildMineProps() {
        return {
            activateSound: ResourceManager.getIdlowById("sounds/mine_activate"),
            activateTimeMsec: 1000,
            battleMines: [],
            blueMineTexture: ResourceManager.getIdlowById("effects/mine/blue_mine_texture"),
            deactivateSound: ResourceManager.getIdlowById("sounds/mine_deactivate"),
            enemyMineTexture: ResourceManager.getIdlowById("effects/mine/enemy_mine_texture"),
            explosionMarkTexture: ResourceManager.getIdlowById("effects/mine/explosion_mark_texture"),
            explosionSound: ResourceManager.getIdlowById("sounds/mine_explosion"),
            farVisibilityRadius: 10,
            friendlyMineTexture: ResourceManager.getIdlowById("effects/mine/friendly_mine_texture"),
            idleExplosionTexture: ResourceManager.getIdlowById("effects/mine/idle_explosion_texture"),
            impactForce: 3,
            mainExplosionTexture: ResourceManager.getIdlowById("effects/mine/main_explosion_texture"),
            minDistanceFromBase: 5,
            model3ds: ResourceManager.getIdlowById("effects/mine/model"),
            nearVisibilityRadius: 7,
            radius: 0.5,
            redMineTexture: ResourceManager.getIdlowById("effects/mine/red_mine_texture"),
        };
    }

    private static _sendFinalBattlePackets(client: GameClient, battle: Battle): void {
        const user = client.user!;
        const withoutSupplies = battle.settings.withoutSupplies;
        const userHasNoSupplies = Array.from(user.supplies.values()).every((count) => count === 0);
        if (!withoutSupplies && !userHasNoSupplies && !client.isSpectator) {
            const userSupplies = user.supplies;
            let availableSupplies = suppliesData;
            if (battle.settings.withoutMines) availableSupplies = availableSupplies.filter((s) => s.id !== "mine");
            if (battle.settings.withoutMedkit) availableSupplies = availableSupplies.filter((s) => s.id !== "health");
            const consumableItems = availableSupplies.map((si) => ({ id: si.id, count: userSupplies.get(si.id) || 0, slotId: si.slotId, itemEffectTime: si.itemEffectTime, itemRestSec: si.itemRestSec }));
            client.sendPacket(new BattlePackets.BattleConsumablesPacket(JSON.stringify({ items: consumableItems })));
        }
        if (!client.isSpectator) {
            // Team and DM battles use different statistics models on the client; sending the
            // wrong score-update variant looks the user up in an empty collection -> #1009.
            if (battle.isTeamMode()) {
                const team = battle.usersBlue.some((u: UserDocument) => u.id === user.id) ? 0 : 1;
                client.sendPacket(new BattlePackets.UpdateBattleUserTeamPacket({ deaths: 0, kills: 0, score: 0, nickname: user.username, team }));
            } else {
                client.sendPacket(new BattlePackets.UpdateBattleUserDMPacket({ deaths: 0, kills: 0, score: 0, nickname: user.username }));
            }
        }

        // Replay supply effects active on other tanks so this joiner applies them (e.g. nitro:
        // the InitTank carries the BASE maxSpeed, and the client derives the boost from the effect
        // — without this the joiner simulates the tank too slow and it visibly teleports).
        const now = Date.now();
        const effects: { userID: string; itemIndex: number; durationTime: number; activeAfterDeath: boolean; effectLevel: number }[] = [];
        for (const other of battle.clients) {
            if (other === client || other.isJoiningBattle || !other.user) continue;
            for (const e of other.activeEffects) {
                if (e.endAt <= now) continue;
                effects.push({ userID: other.user.username, itemIndex: e.itemIndex, durationTime: e.durationTime, activeAfterDeath: false, effectLevel: 0 });
            }
        }
        client.sendPacket(new BattlePackets.BattleUserEffectsPacket(JSON.stringify({ effects })));
        const bonusMarkerResource = ResourceManager.getIdlowById("effects/bonus/drop_location_marker");
        const bonusRegionsPacket = new BattlePackets.BonusRegionsPacket({
            bonusRegionResources: [
                { bonusResource: bonusMarkerResource, bonusType: BonusType.GOLD },
                { bonusResource: bonusMarkerResource, bonusType: BonusType.MOON },
                { bonusResource: bonusMarkerResource, bonusType: BonusType.PUMPKIN },
                { bonusResource: bonusMarkerResource, bonusType: BonusType.SPECIAL },
            ],
            bonusRegionData: [],
        });
        client.sendPacket(bonusRegionsPacket);
        const activeBonuses = [...battle.activeBonuses.values()].map((b) => ({ id: b.id, position: b.position, timeFromAppearing: Date.now() - b.spawnedAt }));
        client.sendPacket(new BattlePackets.InitBonusesPacket(JSON.stringify(activeBonuses)));
        client.sendPacket(new ConfirmLayoutChange(3, 3));
        client.isJoiningBattle = false;
    }
}