import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IVector3 } from "@/shared/types/geom/ivector3";
import { mapSpawns } from "@/types/mapSpawns";
import { ItemUtils } from "@/utils/item.utils";
import logger from "@/utils/logger";
import { Battle, BattleMode, BattleRoundState } from "./battle.model";
import { PrepareToSpawnPacket, TankSpecificationPacket } from "./battle.packets";

/**
 * Picks spawn points and drives the spawn flow (spec broadcast + PrepareToSpawn). The client replies
 * ReadyToPlace, which the ReadyToPlaceHandler completes. Extracted from BattleService.
 */
export class SpawnService {
    constructor(private readonly server: GameServer) {}

    /** A free-ish spawn point for the team (avoids points within ~100u of an active tank). */
    public getSpawnPoint(battle: Battle, team: "DM" | "BLUE" | "RED"): { position: IVector3; rotation: IVector3 } {
        const allMapSpawns = mapSpawns[battle.mapResourceId];
        if (!allMapSpawns || allMapSpawns.length === 0) {
            logger.warn(`No spawn points found for map ${battle.mapResourceId}. Using fallback.`);
            return { position: { x: 0, y: 0, z: 200 }, rotation: { x: 0, y: 0, z: 0 } };
        }

        const teamType = team.toLowerCase();
        let candidateSpawns;
        if (battle.settings.battleMode === BattleMode.CP) {
            candidateSpawns = allMapSpawns.filter((sp) => sp.type.toLowerCase() === "dom");
        } else {
            candidateSpawns = allMapSpawns.filter((sp) => sp.type.toLowerCase() === teamType);
        }

        if (candidateSpawns.length === 0) {
            logger.warn(`No specific spawn points of type for this mode on map ${battle.mapResourceId}. Using all available as fallback.`);
            candidateSpawns = allMapSpawns;
        }

        const activePlayers = this.server.getClients().filter((c) => c.currentBattle?.battleId === battle.battleId && c.battleState === "active" && c.battlePosition);
        const occupiedPositions = activePlayers.map((p) => p.battlePosition!);

        const isOccupied = (spawnPos: IVector3) => {
            const MIN_SPAWN_DISTANCE_SQ = 100 * 100;
            for (const playerPos of occupiedPositions) {
                const dx = spawnPos.x - playerPos.x;
                const dy = spawnPos.y - playerPos.y;
                const dz = spawnPos.z - playerPos.z;
                if (dx * dx + dy * dy + dz * dz < MIN_SPAWN_DISTANCE_SQ) {
                    return true;
                }
            }
            return false;
        };

        let availableSpawns = candidateSpawns.filter((sp) => !isOccupied(sp.position));
        if (availableSpawns.length === 0) {
            logger.warn(`All candidate spawn points are occupied. Using any candidate as fallback.`);
            availableSpawns = candidateSpawns;
        }

        const chosenSpawn = availableSpawns[Math.floor(Math.random() * availableSpawns.length)];
        return { position: chosenSpawn.position, rotation: chosenSpawn.rotation };
    }

    /** Send a player into the spawn flow (spec + PrepareToSpawn). The client replies ReadyToPlace,
     *  which the existing ReadyToPlaceHandler completes. Shared by the spawn handler and round restart. */
    public prepareRespawn(client: GameClient): void {
        const { user, currentBattle: battle } = client;
        if (!user || !battle) return;

        // During the round-finish freeze, hold the spawn — nobody (not even a player joining now) gets
        // PrepareToSpawn until restartRound spawns everyone. restartRound leaves the FINISHED state
        // first, so its own respawn loop isn't blocked by this guard.
        if (battle.roundState === BattleRoundState.FINISHED) return;

        const specs = ItemUtils.getTankSpecifications(user);
        battle.broadcast(new TankSpecificationPacket({ ...specs, nickname: user.username, sequence: ++client.specSequence }));

        let teamType: "DM" | "BLUE" | "RED" = "DM";
        if (battle.isTeamMode()) {
            if (battle.usersBlue.some((u) => u.id === user.id)) teamType = "BLUE";
            if (battle.usersRed.some((u) => u.id === user.id)) teamType = "RED";
        }
        const spawnPoint = this.getSpawnPoint(battle, teamType);
        const finalSpawnPosition = { x: spawnPoint.position.x, y: spawnPoint.position.y, z: spawnPoint.position.z + 200 };
        client.pendingSpawnPoint = { position: finalSpawnPosition, rotation: spawnPoint.rotation };
        client.sendPacket(new PrepareToSpawnPacket(finalSpawnPosition, spawnPoint.rotation));
    }
}
