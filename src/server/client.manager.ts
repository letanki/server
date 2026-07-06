import { IPacket } from "@/packets/packet.interfaces";
import { ClientState } from "./client.state";
import { GameClient } from "./game.client";

export class ClientManager {
  private clients: GameClient[] = [];
  // O(1) lookup by (lowercased) username, populated once a client authenticates.
  private byUsername = new Map<string, GameClient>();

  public addClient(client: GameClient): void {
    this.clients.push(client);
  }

  public removeClient(client: GameClient): void {
    this.clients = this.clients.filter((c) => c !== client);
    const username = client.user?.username.toLowerCase();
    // Only drop the index entry if it still points to this client (guards against a
    // reconnect having replaced it).
    if (username && this.byUsername.get(username) === client) {
      this.byUsername.delete(username);
    }
  }

  /** Registers an authenticated client in the username index (call after client.user is set). */
  public indexUsername(client: GameClient): void {
    if (client.user) {
      this.byUsername.set(client.user.username.toLowerCase(), client);
    }
  }

  public getClients(): GameClient[] {
    return this.clients;
  }

  public getClientCount(): number {
    return this.clients.length;
  }

  public findClientByIp(ip: string): GameClient | undefined {
    return this.clients.find((c) => c.getRemoteAddress() === ip);
  }

  public findClientByUsername(username: string): GameClient | undefined {
    return this.byUsername.get(username.toLowerCase());
  }

  public sendToLobbyChatListeners(packet: IPacket): void {
    const lobbyChatStates: ClientState[] = ["chat_lobby", "chat_garage"];
    this.clients.forEach((client) => {
      if (lobbyChatStates.includes(client.getState())) {
        client.sendPacket(packet);
      }
    });
  }

  public sendToBattleListWatchers(packet: IPacket, filter?: (client: GameClient) => boolean): void {
    const battleListStates: ClientState[] = ["chat_lobby", "battle_lobby"];
    this.clients.forEach((client) => {
      if (battleListStates.includes(client.getState()) && (!filter || filter(client))) {
        client.sendPacket(packet);
      }
    });
  }
}