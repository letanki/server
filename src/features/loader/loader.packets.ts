import { BasePacket } from "@/packets/base.packet";
import { readSchema, writeSchema } from "@/packets/packet-schema";
import { IEmpty } from "@/packets/packet.interfaces";
import { defs, encodeBody, decodeBody } from "protanki-protocol";
import * as LoaderTypes from "./loader.types";

// IDs e schemas em `protanki-protocol` (defs.loader.*).

export class RequestNextTipPacket extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { readSchema(this, defs.loader.RequestNextTip.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.loader.RequestNextTip.schema!); }
    static getId(): number { return defs.loader.RequestNextTip.id; }
}

export class SetLoadingScreenImagePacket extends BasePacket implements LoaderTypes.ISetLoadingScreenImage {
    resourceImageIdLow: number = 0;

    constructor(resourceImageIdLow?: number) {
        super();
        if (resourceImageIdLow !== undefined) {
            this.resourceImageIdLow = resourceImageIdLow;
        }
    }

    read(buffer: Buffer): void { readSchema(this, defs.loader.SetLoadingScreenImage.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.loader.SetLoadingScreenImage.schema!); }
    static getId(): number { return defs.loader.SetLoadingScreenImage.id; }
}

export class ResourceCallback extends BasePacket implements LoaderTypes.IResourceCallback {
    callbackId: number;

    constructor(callbackId: number = 0) {
        super();
        this.callbackId = callbackId;
    }

    read(buffer: Buffer): void { readSchema(this, defs.loader.ResourceCallback.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.loader.ResourceCallback.schema!); }
    static getId(): number { return defs.loader.ResourceCallback.id; }
}

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

export class HideLoader extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { readSchema(this, defs.loader.HideLoader.schema!, buffer); }
    write(): Buffer { return writeSchema(this, defs.loader.HideLoader.schema!); }
    static getId(): number { return defs.loader.HideLoader.id; }
}
