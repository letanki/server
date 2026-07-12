import { BasePacket } from "@/packets/base.packet";
import { packetClass } from "@/packets/packet-class";
import { defs, encodeBody, decodeBody } from "protanki-protocol";
import * as SystemTypes from "./system.types";

// IDs e schemas em `protanki-protocol` (defs.system.*).

export const SystemMessage = packetClass(defs.system.SystemMessage);
export type SystemMessage = InstanceType<typeof SystemMessage>;

/** S->C: aviso de reinício do servidor (payload vazio). O cliente mostra o alerta e re-exibe no login. */
export const ServerRestartWarning = packetClass(defs.system.ServerRestartWarning);
export type ServerRestartWarning = InstanceType<typeof ServerRestartWarning>;

/** S->C: modal genérico com botão OK. {text}. */
export const ShowAlertMessage = packetClass(defs.system.ShowAlertMessage);
export type ShowAlertMessage = InstanceType<typeof ShowAlertMessage>;

export const Ping = packetClass(defs.system.Ping);
export type Ping = InstanceType<typeof Ping>;

export const Pong = packetClass(defs.system.Pong);
export type Pong = InstanceType<typeof Pong>;

export class CaptchaLocation extends BasePacket implements SystemTypes.ICaptchaLocation {
    captchaLocations: Array<number> = [];
    constructor(captchaLocations?: Array<number>) {
        super();
        if (captchaLocations) { this.captchaLocations = captchaLocations; }
    }
    // Lógica: classe guarda number[]; o wire é uma list de { location }. Map aqui, bytes na lib.
    read(buffer: Buffer): void {
        const { fields } = decodeBody(defs.system.CaptchaLocation, buffer);
        this.captchaLocations = fields.captchaLocations.map((x) => x.location);
    }
    write(): Buffer {
        return encodeBody(defs.system.CaptchaLocation, {
            captchaLocations: this.captchaLocations.map((location) => ({ location })),
        });
    }
    static getId(): number { return defs.system.CaptchaLocation.id; }
}

export const InviteEnabled = packetClass(defs.system.InviteEnabled);
export type InviteEnabled = InstanceType<typeof InviteEnabled>;

export const ConfirmLayoutChange = packetClass(defs.system.ConfirmLayoutChange);
export type ConfirmLayoutChange = InstanceType<typeof ConfirmLayoutChange>;

export const SetLayout = packetClass(defs.system.SetLayout);
export type SetLayout = InstanceType<typeof SetLayout>;
