import { battleDataObject } from "@/config/battle.data";
import { suppliesData } from "@/config/supplies.data";
import { CommandContext } from "@/features/chat/commands/command.types";
import { GarageWorkflow } from "@/features/garage/garage.workflow";
import { AddUserToBattleDmPacket, NotifyFriendOfBattlePacket, ReservePlayerSlotDmPacket, UnloadBattleListPacket } from "@/features/lobby/lobby.packets";
import { LobbyWorkflow } from "@/features/lobby/lobby.workflow";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IPacket } from "@/packets/packet.interfaces";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import { UserDocument } from "@/shared/models/user.model";
import { ItemUtils } from "@/utils/item.utils";
import logger from "@/utils/logger";
import { Battle, BattleMode } from "./battle.model";
import * as BattlePackets from "./battle.packets";
import { BattleWorkflow } from "./battle.workflow";

export class EnterBattleAsSpectatorHandler implements IPacketHandler<BattlePackets.EnterBattleAsSpectatorPacket> {
    public readonly packetId = BattlePackets.EnterBattleAsSpectatorPacket.getId();

    public async execute(client: GameClient, server: GameServer, packet: BattlePackets.EnterBattleAsSpectatorPacket): Promise<void> {
        if (!client.user || !client.lastViewedBattleId) {
            logger.warn(`Tentativa de entrar como espectador sem batalha selecionada.`, { user: client.user?.username, client: client.getRemoteAddress() });
            return;
        }

        try {
            const battle = server.battleService.addSpectatorToBattle(client.user, client.lastViewedBattleId);
            client.currentBattle = battle;
            client.isSpectator = true;

            server.battleService.broadcastSpectatorListUpdate(battle, client);

            await BattleWorkflow.enterBattle(client, server, battle);
        } catch (error: any) {
            logger.warn(`Usuário ${client.user.username} falhou ao entrar na batalha ${client.lastViewedBattleId} como espectador`, {
                error: error.message,
                client: client.getRemoteAddress(),
            });
        }
    }
}

export class EnterBattleHandler implements IPacketHandler<BattlePackets.EnterBattlePacket> {
    public readonly packetId = BattlePackets.EnterBattlePacket.getId();

    public async execute(client: GameClient, server: GameServer, packet: BattlePackets.EnterBattlePacket): Promise<void> {
        if (!client.user || !client.lastViewedBattleId) {
            logger.warn(`Tentativa de entrar em batalha sem batalha selecionada.`, { user: client.user?.username, client: client.getRemoteAddress() });
            return;
        }

        try {
            const battle = server.battleService.addUserToBattle(client.user, client.lastViewedBattleId, packet.battleTeam);
            client.currentBattle = battle;

            await BattleWorkflow.enterBattle(client, server, battle);

            if (battle.settings.battleMode === BattleMode.DM) {
                const reserveSlotPacket = new ReservePlayerSlotDmPacket(battle.battleId, client.user.username);
                server.broadcastToBattleList(reserveSlotPacket);

                const addUserPacket = new AddUserToBattleDmPacket({
                    battleId: battle.battleId,
                    nickname: client.user.username,
                    kills: 0,
                    score: 0,
                    suspicious: false,
                });

                const battleDetailWatchers = server.getClients().filter((c) => (c.getState() === "chat_lobby" || c.getState() === "battle_lobby") && c.lastViewedBattleId === battle.battleId);

                for (const watcher of battleDetailWatchers) {
                    watcher.sendPacket(addUserPacket);
                }
            }

            const joiningUser = client.user;
            if (client.friendsCache.length > 0) {
                const mapInfo = battleDataObject.maps.find((m) => m.mapId === battle.settings.mapId);
                const mapName = mapInfo ? mapInfo.mapName : battle.settings.mapId;

                const notifyFriendsPacket = new NotifyFriendOfBattlePacket({
                    battleId: battle.battleId,
                    mapName: mapName,
                    mode: battle.settings.battleMode,
                    privateBattle: battle.settings.privateBattle,
                    probattle: battle.settings.proBattle,
                    maxRank: battle.settings.maxRank,
                    minRank: battle.settings.minRank,
                    serverNumber: 1,
                    nickname: joiningUser.username,
                });

                for (const friendUsername of client.friendsCache) {
                    const friendClient = server.findClientByUsername(friendUsername);
                    if (friendClient) {
                        friendClient.sendPacket(notifyFriendsPacket);
                    }
                }
            }
        } catch (error: any) {
            logger.warn(`Usuário ${client.user.username} falhou ao entrar na batalha ${client.lastViewedBattleId}`, {
                error: error.message,
                client: client.getRemoteAddress(),
            });
        }
    }
}

export class ExitFromBattleHandler implements IPacketHandler<BattlePackets.ExitFromBattlePacket> {
    public readonly packetId = BattlePackets.ExitFromBattlePacket.getId();

    public async execute(client: GameClient, server: GameServer, packet: BattlePackets.ExitFromBattlePacket): Promise<void> {
        const user = client.user;
        const battle = client.currentBattle;
        const isSpectator = client.isSpectator;

        if (!user || !battle) {
            return;
        }

        if (!isSpectator) {
            server.battleService.announceTankRemoval(user, battle, client.battlePosition);
        }
        await server.battleService.finalizeBattleExit(user, battle, client.friendsCache, isSpectator);

        client.sendPacket(new BattlePackets.UnloadSpaceBattlePacket());

        client.currentBattle = null;
        client.isSpectator = false;
        client.battleState = "suicide";
        client.stopTimeChecker();

        if (packet.layout === 0) {
            if (client.getState() === "battle_lobby") {
                client.sendPacket(new UnloadBattleListPacket());
            }
            LobbyWorkflow.returnToLobby(client, server, false);
        } else if (packet.layout === 1) {
            GarageWorkflow.enterGarage(client, server);
        }
    }
}

export class FullMoveCommandHandler implements IPacketHandler<BattlePackets.FullMoveCommandPacket> {
    public readonly packetId = BattlePackets.FullMoveCommandPacket.getId();

    public async execute(client: GameClient, server: GameServer, packet: BattlePackets.FullMoveCommandPacket): Promise<void> {
        if (!client.user || !client.currentBattle) {
            return;
        }

        client.battlePosition = packet.position;
        client.battleOrientation = packet.orientation;
        client.turretControl = packet.control;

        const battle = client.currentBattle;

        const fullMovePacket = new BattlePackets.FullMovePacket({
            nickname: client.user.username,
            angularVelocity: packet.angularVelocity,
            control: packet.control,
            linearVelocity: packet.linearVelocity,
            orientation: packet.orientation,
            position: packet.position,
            direction: packet.direction,
        });

        battle.broadcastRaw(fullMovePacket.write(), fullMovePacket.getId(), client.user.id);

        await server.battleService.checkPlayerPosition(client);
    }
}

export class MoveCommandHandler implements IPacketHandler<BattlePackets.MoveCommandPacket> {
    public readonly packetId = BattlePackets.MoveCommandPacket.getId();

    public async execute(client: GameClient, server: GameServer, packet: BattlePackets.MoveCommandPacket): Promise<void> {
        if (!client.user || !client.currentBattle) {
            return;
        }

        client.battlePosition = packet.position;
        client.battleOrientation = packet.orientation;
        client.turretControl = packet.control;

        const battle = client.currentBattle;

        const movePacket = new BattlePackets.MovePacket({
            nickname: client.user.username,
            angularVelocity: packet.angularVelocity,
            control: packet.control,
            linearVelocity: packet.linearVelocity,
            orientation: packet.orientation,
            position: packet.position,
        });

        battle.broadcastRaw(movePacket.write(), movePacket.getId(), client.user.id);

        await server.battleService.checkPlayerPosition(client);
    }
}

export class ReadyToActivateHandler implements IPacketHandler<BattlePackets.ReadyToActivatePacket> {
    public readonly packetId = BattlePackets.ReadyToActivatePacket.getId();

    public execute(client: GameClient, server: GameServer, packet: BattlePackets.ReadyToActivatePacket): void {
        if (!client.user || !client.currentBattle) {
            return;
        }

        logger.info(`Activating tank for user ${client.user.username} in battle ${client.currentBattle.battleId}.`);

        client.battleState = "active";

        const battle = client.currentBattle;
        battle.broadcast(new BattlePackets.ActivateTankPacket(client.user.username));
    }
}

export class ReadyToPlaceHandler implements IPacketHandler<BattlePackets.ReadyToPlacePacket> {
    public readonly packetId = BattlePackets.ReadyToPlacePacket.getId();

    public execute(client: GameClient, server: GameServer, packet: BattlePackets.ReadyToPlacePacket): void {
        if (!client.user || !client.currentBattle || client.isSpectator) {
            return;
        }

        logger.info(`Placing user ${client.user.username} on the battlefield ${client.currentBattle.battleId}.`);

        try {
            const battle = client.currentBattle;
            const user = client.user;

            const broadcastToBattle = (packetToBroadcast: IPacket) => {
                battle.broadcast(packetToBroadcast);
            };

            if (client.pendingEquipmentRespawn) {
                client.pendingEquipmentRespawn = false;

                broadcastToBattle(new BattlePackets.RemoveTankPacket(user.username));

                const tankModelJson = BattleWorkflow.getTankModelDataJson(client, battle);
                broadcastToBattle(new BattlePackets.TankModelDataPacket(tankModelJson));

                broadcastToBattle(new BattlePackets.EquipmentChangedPacket(user.username));
            }

            client.battleState = "newcome";
            // A fresh life starts with no supply effects (they don't survive death/respawn).
            client.activeEffects = [];

            // Health is tracked on the client's normalized 0-10000 scale (full on (re)spawn).
            const clientHealth = 10000;
            client.currentHealth = clientHealth;

            client.sendPacket(new BattlePackets.SetHealthPacket({ nickname: user.username, health: clientHealth }));

            const spawnPoint = client.pendingSpawnPoint;
            if (!spawnPoint) {
                logger.error(`No pending spawn point for ${client.user.username}. This should not happen.`);
                client.closeConnection();
                return;
            }
            client.pendingSpawnPoint = null;

            const spawnPosition = spawnPoint.position;
            const spawnRotation = spawnPoint.rotation;

            client.battlePosition = spawnPosition;
            client.battleOrientation = spawnRotation;

            let teamId = 2;
            if (battle.isTeamMode()) {
                if (battle.usersBlue.some((u: UserDocument) => u.id === user.id)) teamId = 1;
                if (battle.usersRed.some((u: UserDocument) => u.id === user.id)) teamId = 0;
            }

            const spawnPacket = new BattlePackets.SpawnPacket({
                nickname: user.username,
                team: teamId,
                position: spawnPosition,
                orientation: spawnRotation,
                health: clientHealth,
                incarnation: client.battleIncarnation,
            });

            broadcastToBattle(spawnPacket);
        } catch (error: any) {
            logger.error(`Failed to execute spawn logic for user ${client.user.username}`, { error });
        }
    }
}

export class ReadyToSpawnHandler implements IPacketHandler<BattlePackets.ReadyToSpawnPacket> {
    public readonly packetId = BattlePackets.ReadyToSpawnPacket.getId();

    public execute(client: GameClient, server: GameServer, packet: BattlePackets.ReadyToSpawnPacket): void {
        if (!client.user || !client.currentBattle) {
            return;
        }

        logger.info(`Client ${client.user.username} is ready to spawn in battle ${client.currentBattle.battleId}.`);

        const battle = client.currentBattle;

        const specs = ItemUtils.getTankSpecifications(client.user);
        const specPacket = new BattlePackets.TankSpecificationPacket({ ...specs, nickname: client.user.username, sequence: ++client.specSequence });
        battle.broadcast(specPacket);

        let teamType: "DM" | "BLUE" | "RED" = "DM";
        if (battle.isTeamMode()) {
            if (battle.usersBlue.some((u: UserDocument) => u.id === client.user!.id)) teamType = "BLUE";
            if (battle.usersRed.some((u: UserDocument) => u.id === client.user!.id)) teamType = "RED";
        }

        const spawnPoint = server.battleService.getSpawnPoint(battle, teamType);

        const finalSpawnPosition = {
            x: spawnPoint.position.x,
            y: spawnPoint.position.y,
            z: spawnPoint.position.z + 200,
        };

        client.pendingSpawnPoint = {
            position: finalSpawnPosition,
            rotation: spawnPoint.rotation,
        };

        client.sendPacket(new BattlePackets.PrepareToSpawnPacket(finalSpawnPosition, spawnPoint.rotation));
    }
}

export class RotateTurretCommandHandler implements IPacketHandler<BattlePackets.RotateTurretCommandPacket> {
    public readonly packetId = BattlePackets.RotateTurretCommandPacket.getId();

    public execute(client: GameClient, server: GameServer, packet: BattlePackets.RotateTurretCommandPacket): void {
        if (!client.user || !client.currentBattle) {
            return;
        }

        client.turretAngle = packet.angle;
        client.turretControl = packet.control;

        const battle = client.currentBattle;

        const turretRotationPacket = new BattlePackets.TurretRotationPacket({
            nickname: client.user.username,
            angle: packet.angle,
            control: packet.control,
        });

        battle.broadcastRaw(turretRotationPacket.write(), turretRotationPacket.getId(), client.user.id);
    }
}

export class SendBattleChatMessageHandler implements IPacketHandler<BattlePackets.SendBattleChatMessagePacket> {
    public readonly packetId = BattlePackets.SendBattleChatMessagePacket.getId();

    public async execute(client: GameClient, server: GameServer, packet: BattlePackets.SendBattleChatMessagePacket): Promise<void> {
        const user = client.user;
        const battle = client.currentBattle;

        if (!user || !battle || !packet.message) {
            return;
        }

        if (packet.message.startsWith("/")) {
            const replyFunction = (message: string) => {
                let senderTeamId = 2;
                if (battle.isTeamMode()) {
                    if (battle.usersBlue.some((p) => p.id === user.id)) senderTeamId = 1;
                    else if (battle.usersRed.some((p) => p.id === user.id)) senderTeamId = 0;
                }

                const replyData = {
                    nickname: user.username,
                    message: message,
                    team: senderTeamId,
                };
                client.sendPacket(new BattlePackets.BattleChatMessagePacket(replyData));
            };

            const context: CommandContext = {
                executor: client,
                server: server,
                reply: replyFunction,
            };
            await server.commandService.process(packet.message, context);
            return;
        }

        let senderTeamId = 2;
        let senderTeam: UserDocument[] = [];

        if (battle.isTeamMode()) {
            if (battle.usersBlue.some((p: UserDocument) => p.id === user.id)) {
                senderTeamId = 1;
                senderTeam = battle.usersBlue;
            } else if (battle.usersRed.some((p: UserDocument) => p.id === user.id)) {
                senderTeamId = 0;
                senderTeam = battle.usersRed;
            }
        }

        const messageData = {
            nickname: user.username,
            message: packet.message,
            team: senderTeamId,
        };

        let messagePacket: BattlePackets.BattleChatMessagePacket | BattlePackets.BattleChatTeamMessagePacket;
        let recipients: UserDocument[];

        if (packet.team && battle.isTeamMode()) {
            messagePacket = new BattlePackets.BattleChatTeamMessagePacket(messageData);
            recipients = [...senderTeam, ...battle.spectators];
        } else {
            messagePacket = new BattlePackets.BattleChatMessagePacket(messageData);
            recipients = battle.getAllParticipants();
        }

        for (const recipient of recipients) {
            const recipientClient = server.findClientByUsername(recipient.username);
            if (recipientClient && recipientClient.currentBattle?.battleId === battle.battleId) {
                recipientClient.sendPacket(messagePacket);
            }
        }
    }
}

export class SuicidePacketHandler implements IPacketHandler<BattlePackets.SuicidePacket> {
    public readonly packetId = BattlePackets.SuicidePacket.getId();

    public execute(client: GameClient, server: GameServer, packet: BattlePackets.SuicidePacket): void {
        const { user, currentBattle } = client;

        if (!user || !currentBattle) {
            logger.warn(`SuicidePacket received from client without user or battle.`, {
                client: client.getRemoteAddress(),
            });
            return;
        }

        // The tank must stay FULLY ACTIVE during the countdown — it can still shoot, take damage,
        // pick up / capture the flag, and be killed. We do NOT change battleState here; only the
        // delayed destruction below ends the life. We just remember which incarnation is counting
        // down (so a second press is a no-op and the destruction is exclusive to this life).
        if (client.battleState !== "active") return;
        if (client.selfDestructIncarnation === client.battleIncarnation) return;

        const currentIncarnation = client.battleIncarnation;
        client.selfDestructIncarnation = currentIncarnation;
        logger.info(`User ${user.username} initiated self-destruct sequence in battle ${currentBattle.battleId}.`);

        setTimeout(() => {
            // Exclusive to the incarnation that started it: abort if the tank already died/respawned,
            // the player left/rejoined, or it's no longer active.
            if (
                client.selfDestructIncarnation !== currentIncarnation ||
                client.battleIncarnation !== currentIncarnation ||
                client.currentBattle !== currentBattle ||
                client.battleState !== "active"
            ) {
                logger.info(`Self-destruct for ${user.username} aborted (died, left, or rejoined).`);
                return;
            }

            logger.info(`Tank for ${user.username} was destroyed by self-destruct.`);
            client.selfDestructIncarnation = null;

            // Self-destruct counts as a death on the scoreboard (no killer).
            server.battleService.registerSuicideDeath(currentBattle, client);

            server.battleService.dropFlag(user, currentBattle, client.battlePosition);

            const destroyPacket = new BattlePackets.DestroyTankPacket(user.username, 3000);
            const allParticipants = currentBattle.getAllParticipants();
            allParticipants.forEach((participant: UserDocument) => {
                const participantClient = server.findClientByUsername(participant.username);
                if (participantClient && participantClient.currentBattle?.battleId === currentBattle.battleId) {
                    participantClient.sendPacket(destroyPacket);
                }
            });

            client.battleIncarnation++;
            client.battleState = "suicide";
        }, 10000);
    }
}

export class TimeCheckerResponseHandler implements IPacketHandler<BattlePackets.TimeCheckerResponsePacket> {
    public readonly packetId = BattlePackets.TimeCheckerResponsePacket.getId();

    public execute(client: GameClient, server: GameServer, packet: BattlePackets.TimeCheckerResponsePacket): void {
        client.handleTimeCheckerResponse(packet.clientTime, packet.serverTime);
    }
}

export class DropFlagRequestHandler implements IPacketHandler<BattlePackets.DropFlagRequestPacket> {
    public readonly packetId = BattlePackets.DropFlagRequestPacket.getId();

    public async execute(client: GameClient, server: GameServer, packet: BattlePackets.DropFlagRequestPacket): Promise<void> {
        const user = client.user;
        const battle = client.currentBattle;

        if (!user || !battle || client.isSpectator) {
            return;
        }

        try {
            server.battleService.dropFlag(user, battle, client.battlePosition);
        } catch (error: any) {
            logger.warn(`User ${user.username} failed to drop flag in battle ${battle.battleId}`, {
                error: error.message,
                client: client.getRemoteAddress(),
            });
        }
    }
}

export class SendBattleInviteHandler implements IPacketHandler<BattlePackets.SendBattleInvitePacket> {
    public readonly packetId = BattlePackets.SendBattleInvitePacket.getId();

    public async execute(client: GameClient, server: GameServer, packet: BattlePackets.SendBattleInvitePacket): Promise<void> {
        const inviter = client.user;
        if (!inviter || !packet.targetNickname || !packet.battleId) return;

        const targetClient = server.findClientByUsername(packet.targetNickname);
        const battle = server.lobbyService.getBattleById(packet.battleId);
        if (!targetClient || !battle) {
            logger.warn(`Battle invite from ${inviter.username} to ${packet.targetNickname} could not be delivered (target offline or battle gone).`);
            return;
        }

        targetClient.sendPacket(new BattlePackets.ShowBattleInvitePacket({
            inviterNickname: inviter.username,
            flag1: battle.settings.privateBattle,
            flag2: battle.settings.proBattle,
            battleId: battle.battleId,
            battleName: battle.settings.name,
            battleMode: battle.settings.battleMode,
            flag3: battle.settings.parkourMode,
            flag4: false,
        }));
        logger.info(`${inviter.username} invited ${packet.targetNickname} to battle ${packet.battleId}`);
    }
}

export class DeclineBattleInviteHandler implements IPacketHandler<BattlePackets.DeclineBattleInvitePacket> {
    public readonly packetId = BattlePackets.DeclineBattleInvitePacket.getId();

    public async execute(client: GameClient, server: GameServer, packet: BattlePackets.DeclineBattleInvitePacket): Promise<void> {
        if (!client.user || !packet.inviterNickname) return;
        const inviterClient = server.findClientByUsername(packet.inviterNickname);
        if (inviterClient) {
            inviterClient.sendPacket(new BattlePackets.BattleInviteDeclinedPacket(client.user.username));
        }
    }
}

export class AcceptBattleInviteHandler implements IPacketHandler<BattlePackets.AcceptBattleInvitePacket> {
    public readonly packetId = BattlePackets.AcceptBattleInvitePacket.getId();

    public async execute(client: GameClient, server: GameServer, packet: BattlePackets.AcceptBattleInvitePacket): Promise<void> {
        if (!client.user || !packet.inviterNickname) return;
        const inviterClient = server.findClientByUsername(packet.inviterNickname);
        if (inviterClient) {
            inviterClient.sendPacket(new BattlePackets.BattleInviteAcceptedPacket(client.user.username));
        }
    }
}

export class RequestBattleEntranceHandler implements IPacketHandler<BattlePackets.RequestBattleEntrancePacket> {
    public readonly packetId = BattlePackets.RequestBattleEntrancePacket.getId();

    public async execute(client: GameClient, server: GameServer, packet: BattlePackets.RequestBattleEntrancePacket): Promise<void> {
        // Ack the entrance request so the client proceeds to open the battle (RequestBattleByLink).
        client.sendPacket(new BattlePackets.BattleEntranceAckPacket(packet.battleId));
    }
}

export class MovementControlCommandHandler implements IPacketHandler<BattlePackets.MovementControlCommandPacket> {
    public readonly packetId = BattlePackets.MovementControlCommandPacket.getId();

    public async execute(client: GameClient, server: GameServer, packet: BattlePackets.MovementControlCommandPacket): Promise<void> {
        if (!client.user || !client.currentBattle) return;
        const battle = client.currentBattle;

        // Relay the input/control state to the other players so their physics simulation of
        // this tank starts/stops correctly (key-release included).
        const controlPacket = new BattlePackets.MovementControlPacket({ nickname: client.user.username, control: packet.control });
        battle.broadcastRaw(controlPacket.write(), controlPacket.getId(), client.user.id);
    }
}

export class ActivateSupplyCommandHandler implements IPacketHandler<BattlePackets.ActivateSupplyCommandPacket> {
    public readonly packetId = BattlePackets.ActivateSupplyCommandPacket.getId();

    public async execute(client: GameClient, server: GameServer, packet: BattlePackets.ActivateSupplyCommandPacket): Promise<void> {
        const user = client.user;
        const battle = client.currentBattle;
        if (!user || !battle || !packet.itemId || client.battleState !== "active") return;

        const supplyId = packet.itemId;
        const supply = suppliesData.find((s) => s.id === supplyId);
        if (!supply) return;

        // Implemented one at a time.
        if (supplyId !== "n2o") {
            logger.info(`Supply '${supplyId}' activation not implemented yet (user ${user.username}).`);
            return;
        }

        const count = user.supplies.get(supplyId) ?? 0;
        if (count <= 0) return;
        user.supplies.set(supplyId, count - 1);
        await user.save();

        // Broadcasts EffectStarted, tracks the effect for join-replay (InitEffects), and schedules
        // EffectStopped at the end. `onEnd` runs at expiry (e.g. nitro reverts its spec there).
        const startEffect = (durationMs: number, onEnd?: () => void) => {
            const endAt = Date.now() + durationMs;
            client.activeEffects = client.activeEffects.filter((e) => e.itemIndex !== supply.slotId);
            client.activeEffects.push({ itemIndex: supply.slotId, durationTime: durationMs, endAt });
            battle.broadcast(new BattlePackets.EffectStartedPacket(user.username, supply.slotId, durationMs, 0));
            setTimeout(() => {
                if (client.isDestroyed) return;
                const cur = client.activeEffects.find((e) => e.itemIndex === supply.slotId);
                if (cur && cur.endAt !== endAt) return; // superseded by a re-activation
                client.activeEffects = client.activeEffects.filter((e) => e.itemIndex !== supply.slotId);
                if (client.currentBattle !== battle || client.battleState !== "active") return;
                battle.broadcast(new BattlePackets.EffectStoppedPacket(user.username, supply.slotId));
                onEnd?.();
            }, durationMs);
        };

        // Nitro: cooldown (effectTime+restSec)*1000 = 75000, effect 60000. The boost is real
        // only because the server resends TankSpecificationPacket with a higher speed.
        const cooldownMs = (supply.itemEffectTime + supply.itemRestSec) * 1000;
        const durationMs = supply.itemEffectTime * 1000;
        const baseSpecs = ItemUtils.getTankSpecifications(user);
        const sendSpec = (specs: typeof baseSpecs) => battle.broadcast(new BattlePackets.TankSpecificationPacket({ ...specs, nickname: user.username, sequence: ++client.specSequence }));

        // Boosted spec FIRST (speed x1.3: 12.0->15.6, acceleration +0.5: 11.33->11.83), then the
        // activation confirm, then the effect. Revert the base spec when it ends.
        sendSpec({ ...baseSpecs, speed: baseSpecs.speed * 1.3, acceleration: baseSpecs.acceleration + 0.5 });
        client.sendPacket(new BattlePackets.ActivatedSupplyPacket(supplyId, cooldownMs, 1));
        startEffect(durationMs, () => sendSpec(baseSpecs));
    }
}
