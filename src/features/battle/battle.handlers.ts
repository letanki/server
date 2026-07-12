import { battleDataObject } from "@/config/battle.data";
import { suppliesData } from "@/config/supplies.data";
import { HEAL_MAX_GIVEN } from "./supply.service";
import { CommandContext } from "@/features/chat/commands/command.types";
import { GarageWorkflow } from "@/features/garage/garage.workflow";
import { AddUserToBattleDmPacket, AddUserTeamPacket, CreateBattleResponse, NotifyFriendOfBattlePacket, OnReserveSlotTeamPacket, ReservePlayerSlotDmPacket, UnloadBattleListPacket } from "@/features/lobby/lobby.packets";
import { BattleHaltPacket } from "@/features/system/halt.packets";
import { SystemMessage } from "@/features/system/system.packets";
import * as ProfilePackets from "@/features/profile/profile.packets";
import { isProBattleActive, PRO_BATTLE_ENTER_PRICE } from "@/shared/models/passes";
import { LobbyWorkflow } from "@/features/lobby/lobby.workflow";
import { GameClient } from "@/server/game.client";
import { GameServer } from "@/server/game.server";
import { IPacketHandler } from "@/shared/interfaces/ipacket-handler";
import User, { UserDocument } from "@/shared/models/user.model";
import logger from "@/utils/logger";
import { Battle, BattleMode } from "./battle.model";
import { EquipmentConstraintError } from "./battle.service";
import * as BattlePackets from "./battle.packets";
import { BattleWorkflow } from "./battle.workflow";

// The official server holds a delay between receiving ReadyToPlace and broadcasting the Spawn — the
// tank materialises rather than popping in instantly. Measured from the 2026-07-01 capture:
// ReadyToPlace → Spawn was ~2280ms including ~280ms client↔server RTT, i.e. a ~2000ms server-side wait
// (very consistent across respawns: 2278/2285/2280/2280). Replicated here (tunable).
const SPAWN_DELAY_MS = 2000;

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

        // Server about to restart: refuse the join, echoing the battleId the player tried to enter.
        if (server.isRestartPending()) {
            client.sendPacket(new BattleHaltPacket(client.lastViewedBattleId));
            return;
        }

        // Buscando ranqueada: não pode entrar em nenhuma batalha (senão o matchmaking pega ele já em jogo).
        if (server.rankedService?.isBusy(client.user.id)) {
            client.sendPacket(new BattleHaltPacket(client.lastViewedBattleId));
            server.rankedService.notifyChat(client, "Você está buscando uma partida ranqueada. Cancele a busca para entrar em outra batalha.");
            return;
        }

        // Entrada em Batalha PRO: quem NÃO tem o passe paga PRO_BATTLE_ENTER_PRICE — mas só 1x por batalha
        // (reentrar na mesma, após sair, é grátis). Portador do passe entra sempre grátis. Pré-checa os
        // cristais aqui (bloqueia mantendo no lobby); a cobrança em si só ocorre APÓS entrar com sucesso,
        // para não cobrar se addUserToBattle falhar (batalha cheia, restrição de equipamento, etc.).
        const targetBattle = server.lobbyService.getBattleById(client.lastViewedBattleId);
        const mustPayProEntry = !!targetBattle?.settings.proBattle && !isProBattleActive(client.user) && !targetBattle.paidEntryUserIds.has(client.user.id);
        if (mustPayProEntry && client.user.crystals < PRO_BATTLE_ENTER_PRICE) {
            client.sendPacket(new SystemMessage({ text: `Cristais insuficientes para entrar nesta Batalha PRO (custa ${PRO_BATTLE_ENTER_PRICE}).` }));
            client.sendPacket(new BattleHaltPacket(client.lastViewedBattleId));
            return;
        }

        try {
            const battle = server.battleService.addUserToBattle(client.user, client.lastViewedBattleId, packet.battleTeam);
            client.currentBattle = battle;

            // Entrou com sucesso → cobra a entrada da Batalha PRO e marca como pago nesta batalha.
            if (mustPayProEntry) {
                client.user.crystals -= PRO_BATTLE_ENTER_PRICE;
                await client.user.save();
                battle.paidEntryUserIds.add(client.user.id);
                client.sendPacket(new ProfilePackets.UpdateCrystals({ crystals: client.user.crystals }));
                logger.info(`User ${client.user.username} paid ${PRO_BATTLE_ENTER_PRICE} to enter PRO battle ${battle.battleId}.`);
            }

            await BattleWorkflow.enterBattle(client, server, battle);

            const battleDetailWatchers = server.getClients().filter((c) => (c.getState() === "chat_lobby" || c.getState() === "battle_lobby") && c.lastViewedBattleId === battle.battleId);

            if (battle.settings.battleMode === BattleMode.DM) {
                server.broadcastToBattleList(new ReservePlayerSlotDmPacket({ battleId: battle.battleId, nickname: client.user.username }));
                const addUserPacket = new AddUserToBattleDmPacket({ battleId: battle.battleId, nickname: client.user.username, kills: 0, score: 0, suspicious: false });
                for (const watcher of battleDetailWatchers) watcher.sendPacket(addUserPacket);
            } else {
                // Team modes (CTF/TDM/DOM): the lobby roster uses the team variants + the player's team.
                const team = battle.usersRed.some((u) => u.id === client.user!.id) ? 0 : 1;
                server.broadcastToBattleList(new OnReserveSlotTeamPacket({ battleId: battle.battleId, nickname: client.user.username, team }));
                const addUserPacket = new AddUserTeamPacket({ battleId: battle.battleId, nickname: client.user.username, kills: 0, score: 0, suspicious: false, team });
                for (const watcher of battleDetailWatchers) watcher.sendPacket(addUserPacket);
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
            // Equipment-constraint rejection (XP/BP): pacote OFICIAL do erro de ENTRADA com equipamento
            // fora das restrições ("BATTLE_ENTER_ERROR_EQUIPMENT_NOT_MATCH_CONSTRAINTS"); mantém o jogador
            // no lobby, ecoando o battleId que tentou entrar.
            if (error instanceof EquipmentConstraintError) {
                client.sendPacket(new BattlePackets.EquipmentConstraintsNotMatchPacket({ battleId: client.lastViewedBattleId }));
            }
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
        // A new life starts with a clean assist ledger (damage taken is tracked per-life). Activation is
        // the single reset point every death path funnels through, so this covers combat/suicide/void.
        client.damageFromAttackers.clear();
        // Supplies only become usable when the tank ACTIVATES, so this is the single reset point for the
        // server-side supply cooldowns (a new life starts with free slots, matching the client). Clearing
        // earlier (spawn prep / battle entry) would be redundant — activation always happens in between.
        client.supplyReadyAt.clear();

        const battle = client.currentBattle;
        battle.broadcast(new BattlePackets.ActivateTankPacket({ nickname: client.user.username }));
    }
}

export class ReadyToPlaceHandler implements IPacketHandler<BattlePackets.ReadyToPlacePacket> {
    public readonly packetId = BattlePackets.ReadyToPlacePacket.getId();

    public execute(client: GameClient, server: GameServer, packet: BattlePackets.ReadyToPlacePacket): void {
        if (!client.user || !client.currentBattle || client.isSpectator) {
            return;
        }

        // Equipment was changed while the player was dead/waiting to spawn, and the other clients are
        // still loading the new equipment resources. Spawning now would broadcast the new InitTank/Spawn
        // before they have the resources → invisible tank / #1009 on them. Hold the placement; the
        // resource-load acks (garage.workflow) will perform it once everyone is ready.
        if (client.equipmentResourcesLoading) {
            client.deferredPlacement = true;
            logger.info(`Holding placement for ${client.user.username} until other clients load the new equipment.`);
            return;
        }

        // Replicate the official ~2s hold between ReadyToPlace and Spawn (the tank materialises). Keyed
        // per user so a repeated ReadyToPlace just re-arms it, and cleared on battle teardown (clearAll).
        const battle = client.currentBattle;
        const user = client.user;

        // Ranked: the first spawn of a match must be simultaneous — hold each player's placement until
        // ALL players have sent ReadyToPlace, then release them together. Subsequent respawns are normal.
        const ranked = server.rankedService?.gateRankedFirstSpawn(client);
        if (ranked !== null && ranked !== undefined) {
            for (const c of ranked) {
                if (!c.user) continue;
                const b = c.currentBattle;
                if (!b) continue;
                logger.info(`Placing user ${c.user.username} on battlefield ${b.battleId} in ${SPAWN_DELAY_MS}ms (ranked simultaneous start).`);
                b.timers.set(`spawn:${c.user.id}`, SPAWN_DELAY_MS, () => {
                    if (c.isDestroyed || c.currentBattle !== b || c.isSpectator) return;
                    BattleWorkflow.placeTank(c);
                });
            }
            return;
        }

        logger.info(`Placing user ${user.username} on battlefield ${battle.battleId} in ${SPAWN_DELAY_MS}ms.`);
        battle.timers.set(`spawn:${user.id}`, SPAWN_DELAY_MS, () => {
            // Re-validate at fire time: the player may have left, disconnected or gone spectator meanwhile.
            if (client.isDestroyed || client.currentBattle !== battle || client.isSpectator) return;
            BattleWorkflow.placeTank(client);
        });
    }
}

// Client left the pause state — no server response is expected (verified against the reference
// capture). No-op handler purely to stop it logging as an unknown packet.
export class DisablePauseHandler implements IPacketHandler<BattlePackets.DisablePausePacket> {
    public readonly packetId = BattlePackets.DisablePausePacket.getId();
    public execute(): void { /* fire-and-forget */ }
}

export class ReadyToSpawnHandler implements IPacketHandler<BattlePackets.ReadyToSpawnPacket> {
    public readonly packetId = BattlePackets.ReadyToSpawnPacket.getId();

    public execute(client: GameClient, server: GameServer, packet: BattlePackets.ReadyToSpawnPacket): void {
        if (!client.user || !client.currentBattle) {
            return;
        }

        logger.info(`Client ${client.user.username} is ready to spawn in battle ${client.currentBattle.battleId}.`);
        server.battleService.prepareRespawn(client);
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

// Relays the continuous turret-direction stream (bare angle) the client sends every frame while turning,
// alongside the discrete RotateTurretCommand. Without it, remote turrets only move on the sparse control
// commands → jerky/stuck aim on other players (notably visible with the shaft's slow aim sweep).
export class TurretDirectionCommandHandler implements IPacketHandler<BattlePackets.TurretDirectionCommandPacket> {
    public readonly packetId = BattlePackets.TurretDirectionCommandPacket.getId();

    public execute(client: GameClient, server: GameServer, packet: BattlePackets.TurretDirectionCommandPacket): void {
        if (!client.user || !client.currentBattle) return;
        client.turretAngle = packet.angle;
        const relay = new BattlePackets.TurretDirectionPacket({ nickname: client.user.username, angle: packet.angle });
        client.currentBattle.broadcastRaw(relay.write(), relay.getId(), client.user.id);
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
            // Command replies use the battle chat's SYSTEM message channel (606668848) — no nickname or
            // team involved, so it also works for spectators (whose nickname isn't in the scoreboard and
            // would #1009 the client on a regular chat line — see spectator-chat).
            const replyFunction = (message: string) => {
                client.sendPacket(new BattlePackets.BattleSystemMessagePacket({ message }));
            };

            const context: CommandContext = {
                executor: client,
                server: server,
                reply: replyFunction,
            };
            await server.commandService.process(packet.message, context);
            return;
        }

        // Staff mute: silenced users can't post battle-chat messages (commands above still work).
        if (user.mutedUntil && user.mutedUntil > new Date()) {
            const minutesLeft = Math.ceil((user.mutedUntil.getTime() - Date.now()) / 60000);
            client.sendPacket(new BattlePackets.BattleChatMessagePacket({ nickname: null, message: `Você está silenciado por mais ${minutesLeft} minuto(s).`, team: 2 }));
            return;
        }

        const isSpectator = client.isSpectator || battle.spectators.some((s: UserDocument) => s.id === user.id);

        let senderTeamId = 2;
        let senderTeam: UserDocument[] = [];

        if (battle.isTeamMode() && !isSpectator) {
            if (battle.usersBlue.some((p: UserDocument) => p.id === user.id)) {
                senderTeamId = 1;
                senderTeam = battle.usersBlue;
            } else if (battle.usersRed.some((p: UserDocument) => p.id === user.id)) {
                senderTeamId = 0;
                senderTeam = battle.usersRed;
            }
        }

        const sendTo = (users: UserDocument[], pkt: BattlePackets.BattleChatMessagePacket | BattlePackets.BattleChatTeamMessagePacket | BattlePackets.BattleSpectatorMessagePacket): void => {
            for (const recipient of users) {
                const recipientClient = server.findClientByUsername(recipient.username);
                if (recipientClient && recipientClient.currentBattle?.battleId === battle.battleId) {
                    recipientClient.sendPacket(pkt);
                }
            }
        };

        // A spectator isn't a registered battle player, so the client crashes (#1009) rendering a normal
        // battle-chat line whose sender it can't look up in the scoreboard. Two spectator channels:
        // • TEAM message → the dedicated spectator-team packet (1532749363, confirmed in-game): YELLOW
        //   "Espectador:" line, delivered to spectators only.
        // • GENERAL message → nickname-null white line ("Espectador: <msg>" render path, no player
        //   lookup): fellow spectators see who spoke (name prefixed), players get the plain text.
        if (isSpectator) {
            if (packet.team) {
                // Message goes CLEAN — the spectator-name client patch renders the uid as the yellow
                // name label ("nick: msg"); unpatched clients just show the generic "Espectador: msg".
                sendTo([...battle.spectators], new BattlePackets.BattleSpectatorMessagePacket({ message: packet.message, uid: user.username }));
                return;
            }
            // Spectators' copy carries the sender as the "*nick" sentinel — the spectator-name client
            // patch detects the marker, treats the line as spectator (no scoreboard lookup) and renders
            // "nick: msg" (white). Players keep the plain nickname-null line → "Espectador: msg".
            sendTo([...battle.spectators], new BattlePackets.BattleChatMessagePacket({ nickname: `*${user.username}`, message: packet.message, team: senderTeamId }));
            const players = [...battle.users, ...battle.usersBlue, ...battle.usersRed];
            sendTo(players, new BattlePackets.BattleChatMessagePacket({ nickname: null, message: packet.message, team: senderTeamId }));
            return;
        }

        const messageData = {
            nickname: user.username,
            message: packet.message,
            team: senderTeamId,
        };

        if (packet.team && battle.isTeamMode()) {
            sendTo([...senderTeam, ...battle.spectators], new BattlePackets.BattleChatTeamMessagePacket(messageData));
        } else {
            sendTo(battle.getAllParticipants(), new BattlePackets.BattleChatMessagePacket(messageData));
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

            const destroyPacket = new BattlePackets.DestroyTankPacket({ nickname: user.username, readyToSpawnInMs: 3000 });
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

        // Inviting a player to a private battle grants them list visibility (and pushes the card so the
        // battle shows in their list even though it was hidden at creation).
        if (battle.settings.privateBattle && battle.grantViewer(targetClient.user)) {
            targetClient.sendPacket(new CreateBattleResponse({ jsonData: JSON.stringify(LobbyWorkflow.buildBattleListEntry(battle)) }));
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
            inviterClient.sendPacket(new BattlePackets.BattleInviteDeclinedPacket({ targetNickname: client.user.username }));
        }
    }
}

export class AcceptBattleInviteHandler implements IPacketHandler<BattlePackets.AcceptBattleInvitePacket> {
    public readonly packetId = BattlePackets.AcceptBattleInvitePacket.getId();

    public async execute(client: GameClient, server: GameServer, packet: BattlePackets.AcceptBattleInvitePacket): Promise<void> {
        if (!client.user || !packet.inviterNickname) return;
        const inviterClient = server.findClientByUsername(packet.inviterNickname);
        if (inviterClient) {
            inviterClient.sendPacket(new BattlePackets.BattleInviteAcceptedPacket({ targetNickname: client.user.username }));
        }
    }
}

export class RequestBattleEntranceHandler implements IPacketHandler<BattlePackets.RequestBattleEntrancePacket> {
    public readonly packetId = BattlePackets.RequestBattleEntrancePacket.getId();

    public async execute(client: GameClient, server: GameServer, packet: BattlePackets.RequestBattleEntrancePacket): Promise<void> {
        // Ack the entrance request so the client proceeds to open the battle (RequestBattleByLink).
        client.sendPacket(new BattlePackets.BattleEntranceAckPacket({ battleId: packet.battleId }));
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

        // SERVER-SIDE cooldown: the client's countdown is only visual, so a macro / lag-burst of
        // activation packets (e.g. 1ms spam of every slot) would consume one supply per packet.
        // Activations arriving before the supply's ready time are discarded without consuming.
        // Latency works in our favor: the client only re-enables the slot after receiving the
        // ActivatedSupplyPacket, so a legitimate re-activation always arrives after readyAt.
        // NOTE: field-drop pickups (BonusService.takeBonus → applyEffect/startHealing directly) NEVER
        // touch supplyReadyAt — by design. Chaining 200 nitro boxes resets the buff every time, and an
        // inventory activation right after still works (drops never advance the inventory cooldown).
        const now = Date.now();
        if (now < (client.supplyReadyAt.get(supplyId) ?? 0)) return;

        // Health kits can NEVER be activated on a full tank — in ANY mode (don't waste the supply).
        // Parkour's difference is only DURING the effect: reaching full doesn't end it (see startHealing).
        if (supplyId === "health" && client.currentHealth >= 10000) return;

        const count = user.supplies.get(supplyId) ?? 0;
        if (count <= 0) return;

        // Mines can be REFUSED (placement throttle, withoutMines, no position) — attempt the placement
        // BEFORE consuming the supply, so a discarded packet doesn't eat a mine from the inventory.
        if (supplyId === "mine" && !server.battleService.mine.placeMine(client, battle)) return;

        // Decrement in memory synchronously (so back-to-back activations see the new count) and persist
        // with an atomic $inc instead of user.save(). A full save() on the same Mongoose document from
        // concurrent activations (e.g. rapid parkour mine drops) throws ParallelSaveError.
        user.supplies.set(supplyId, count - 1);
        await User.updateOne({ _id: user._id }, { $inc: { [`supplies.${supplyId}`]: -1 } });

        // Metrics: a supply was consumed from inventory (all types, incl. mine). Accumulated here and
        // persisted at the next flush trigger (death / disconnect / leave / round-finish).
        client.roundStats.suppliesUsed++;
        client.roundStats.suppliesUsedByItem[supplyId] = (client.roundStats.suppliesUsedByItem[supplyId] ?? 0) + 1;
        if (supplyId === "mine") client.roundStats.minesUsed++;

        if (supplyId === "health") {
            // Inventory repair kit: gradual regen up to a full repair. No parkour, o cooldown de reativação
            // acompanha a DURAÇÃO do efeito (= hullHP/30 s, retornada por startHealing): reabilita quando a
            // cura termina, escalando com a vida máxima do tanque. Fora do parkour, é o itemRestSec normal.
            const effectMs = server.battleService.supply.startHealing(client, battle, HEAL_MAX_GIVEN.INVENTORY);
            const cooldownMs = battle.settings.parkourMode ? effectMs : supply.itemRestSec * 1000;
            client.supplyReadyAt.set(supplyId, now + cooldownMs);
            client.sendPacket(new BattlePackets.ActivatedSupplyPacket(supplyId, cooldownMs, 1));
            return;
        }

        if (supplyId === "mine") {
            // (Already placed above, before the supply was consumed.) Parkour mode: mines have no delay —
            // reactivation is instant so the player can stack one mine on top of another (the 150ms
            // placement throttle in MineService is the only floor there).
            const cooldownMs = battle.settings.parkourMode ? 0 : (supply.itemEffectTime + supply.itemRestSec) * 1000;
            client.supplyReadyAt.set(supplyId, now + cooldownMs);
            client.sendPacket(new BattlePackets.ActivatedSupplyPacket(supplyId, cooldownMs, 1));
            return;
        }

        const cooldownMs = server.battleService.supply.applyEffect(client, battle, supplyId);
        client.supplyReadyAt.set(supplyId, now + cooldownMs);
        client.sendPacket(new BattlePackets.ActivatedSupplyPacket(supplyId, cooldownMs, 1));
    }
}

// C->S: the client touched a field bonus and asks to pick it up. BonusService validates + applies.
export class TakeBonusCommandHandler implements IPacketHandler<BattlePackets.TakeBonusCommandPacket> {
    public readonly packetId = BattlePackets.TakeBonusCommandPacket.getId();

    public execute(client: GameClient, server: GameServer, packet: BattlePackets.TakeBonusCommandPacket): void {
        const battle = client.currentBattle;
        if (!battle || !packet.id) return;
        server.battleService.bonus.takeBonus(client, battle, packet.id);
    }
}
