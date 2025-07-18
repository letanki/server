import { ProTankiClient } from "../../server/ProTankiClient";
import { ProTankiServer } from "../../server/ProTankiServer";
import { IPacketHandler } from "../IPacketHandler";
import RotateTurretCommandPacket from "../../packets/implementations/RotateTurretCommandPacket";
import TurretRotationPacket from "../../packets/implementations/TurretRotationPacket";

export default class RotateTurretCommandHandler implements IPacketHandler<RotateTurretCommandPacket> {
  public readonly packetId = RotateTurretCommandPacket.getId();

  public execute(client: ProTankiClient, server: ProTankiServer, packet: RotateTurretCommandPacket): void {
    if (!client.user || !client.currentBattle) {
      return;
    }

    client.turretAngle = packet.angle;
    client.turretControl = packet.control;

    const battle = client.currentBattle;

    const turretRotationPacket = new TurretRotationPacket({
      nickname: client.user.username,
      angle: packet.angle,
      control: packet.control,
    });

    const allParticipants = battle.getAllParticipants();

    for (const participant of allParticipants) {
      if (participant.id === client.user.id) {
        continue;
      }

      const otherClient = server.findClientByUsername(participant.username);
      if (otherClient && otherClient.currentBattle?.battleId === battle.battleId) {
        otherClient.sendPacket(turretRotationPacket);
      }
    }
  }
}
