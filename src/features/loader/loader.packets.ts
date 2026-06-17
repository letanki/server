import { BasePacket } from "@/packets/base.packet";
import { IEmpty } from "@/packets/packet.interfaces";
import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";
import * as LoaderTypes from "./loader.types";

export class RequestNextTipPacket extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { }
    write(): Buffer {
        return new BufferWriter().getBuffer();
    }
    static getId(): number {
        return -1376947245;
    }
}

export class SetLoadingScreenImagePacket extends BasePacket implements LoaderTypes.ISetLoadingScreenImage {
    resourceImageIdLow: number = 0;

    constructor(resourceImageIdLow?: number) {
        super();
        if (resourceImageIdLow !== undefined) {
            this.resourceImageIdLow = resourceImageIdLow;
        }
    }

    read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        this.resourceImageIdLow = reader.readResource();
    }

    write(): Buffer {
        const writer = new BufferWriter();
        writer.writeResource(this.resourceImageIdLow);
        return writer.getBuffer();
    }
    static getId(): number {
        return 2094741924;
    }
}

export class ResourceCallback extends BasePacket implements LoaderTypes.IResourceCallback {
    callbackId: number;

    constructor(callbackId: number = 0) {
        super();
        this.callbackId = callbackId;
    }

    read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        this.callbackId = reader.readInt32BE();
    }

    write(): Buffer {
        const writer = new BufferWriter();
        writer.writeInt32BE(this.callbackId);
        return writer.getBuffer();
    }
    static getId(): number {
        return -82304134;
    }
}

export class LoadDependencies extends BasePacket implements LoaderTypes.ILoadDependencies {
    dependencies: { resources: LoaderTypes.IDependency[] };
    callbackId: number;

    constructor(dependencies: { resources: LoaderTypes.IDependency[] }, callbackId: number) {
        super();
        this.dependencies = dependencies;
        this.callbackId = callbackId;
    }

    read(buffer: Buffer): void {
        const reader = new BufferReader(buffer);
        const jsonString = reader.readOptionalString();
        // The client parses this JSON with `JSON.parse(str) as Array`, so it must be
        // a bare array of resource descriptors, not wrapped in an object.
        const parsed = jsonString ? JSON.parse(jsonString) : [];
        this.dependencies = { resources: Array.isArray(parsed) ? parsed : parsed.resources ?? [] };
        this.callbackId = reader.readInt32BE();
    }

    write(): Buffer {
        const writer = new BufferWriter();
        const jsonString = JSON.stringify(this.dependencies.resources);
        writer.writeOptionalString(jsonString);
        writer.writeInt32BE(this.callbackId);
        return writer.getBuffer();
    }
    static getId(): number {
        return -1797047325;
    }
}

export class HideLoader extends BasePacket implements IEmpty {
    read(buffer: Buffer): void { }
    write(): Buffer {
        return new BufferWriter().getBuffer();
    }
    static getId(): number {
        return -1282173466;
    }
}