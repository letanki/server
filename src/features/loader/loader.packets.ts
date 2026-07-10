import { BasePacket } from "@/packets/base.packet";
import { packetClass } from "@/packets/packet-class";
import { defs, encodeBody, decodeBody } from "protanki-protocol";
import * as LoaderTypes from "./loader.types";

// IDs e schemas em `protanki-protocol` (defs.loader.*).

export const RequestNextTipPacket = packetClass(defs.loader.RequestNextTip);
export type RequestNextTipPacket = InstanceType<typeof RequestNextTipPacket>;

export const SetLoadingScreenImagePacket = packetClass(defs.loader.SetLoadingScreenImage);
export type SetLoadingScreenImagePacket = InstanceType<typeof SetLoadingScreenImagePacket>;

export const ResourceCallback = packetClass(defs.loader.ResourceCallback);
export type ResourceCallback = InstanceType<typeof ResourceCallback>;

// A LÓGICA (o cliente faz JSON.parse(str) as Array, então o corpo é um array bare de descritores)
// fica aqui; os BYTES vão pela lib. Wire = defs.loader.LoadDependencies { dependenciesJson, callbackId }.
export class LoadDependencies extends BasePacket implements LoaderTypes.ILoadDependencies {
    dependencies: { resources: LoaderTypes.IDependency[] };
    callbackId: number;

    constructor(dependencies: { resources: LoaderTypes.IDependency[] }, callbackId: number) {
        super();
        this.dependencies = dependencies;
        this.callbackId = callbackId;
    }

    read(buffer: Buffer): void {
        const { fields } = decodeBody(defs.loader.LoadDependencies, buffer);
        const parsed = fields.dependenciesJson ? JSON.parse(fields.dependenciesJson) : [];
        this.dependencies = { resources: Array.isArray(parsed) ? parsed : parsed.resources ?? [] };
        this.callbackId = fields.callbackId;
    }

    write(): Buffer {
        return encodeBody(defs.loader.LoadDependencies, {
            dependenciesJson: JSON.stringify(this.dependencies.resources),
            callbackId: this.callbackId,
        });
    }
    static getId(): number { return defs.loader.LoadDependencies.id; }
}

export const HideLoader = packetClass(defs.loader.HideLoader);
export type HideLoader = InstanceType<typeof HideLoader>;
