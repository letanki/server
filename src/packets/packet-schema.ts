import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";

/**
 * Declarative packet field schema. Defining the wire format once (field order +
 * type) and generating read/write removes the recurring class of bugs from
 * hand-written codecs (wrong int width, swapped order, resource = 8 bytes, etc.).
 *
 * `string` is the optional-string encoding used everywhere (1-byte null flag +
 * int32 length + utf8). `optStringArray` reads like a string array but writes
 * with the "optional" empty flag, matching the existing helpers.
 *
 * Composite types:
 *  - `list`      — an int32 count followed by N items, each described by `of`.
 *  - `object`    — a nested object serialized inline by `of` (no length/flag).
 *  - `optObject` — a 1-byte null flag (1 = absent) then, if present, `of` inline.
 */
export type PrimitiveType =
    | "u8"
    | "i8"
    | "i16"
    | "i32"
    | "f32"
    | "bool"
    | "resource"
    | "string"
    | "stringArray"
    | "optStringArray"
    | "i16Array"
    | "vector3"
    | "vector3Array";

export interface PrimitiveField {
    name: string;
    type: PrimitiveType;
}

export interface CompositeField {
    name: string;
    type: "list" | "object" | "optObject";
    of: PacketSchema;
}

export type SchemaField = PrimitiveField | CompositeField;
export type PacketSchema = readonly SchemaField[];

const READERS: Record<PrimitiveType, (r: BufferReader) => unknown> = {
    u8: (r) => r.readUInt8(),
    i8: (r) => r.readInt8(),
    i16: (r) => r.readInt16BE(),
    i32: (r) => r.readInt32BE(),
    f32: (r) => r.readFloatBE(),
    bool: (r) => r.readUInt8() === 1,
    resource: (r) => r.readResource(),
    string: (r) => r.readOptionalString(),
    stringArray: (r) => r.readStringArray(),
    optStringArray: (r) => r.readStringArray(),
    i16Array: (r) => r.readInt16Array(),
    vector3: (r) => r.readOptionalVector3(),
    vector3Array: (r) => r.readVector3Array(),
};

const WRITERS: Record<PrimitiveType, (w: BufferWriter, value: any) => void> = {
    u8: (w, v) => w.writeUInt8(v),
    i8: (w, v) => w.writeInt8(v),
    i16: (w, v) => w.writeInt16BE(v),
    i32: (w, v) => w.writeInt32BE(v),
    f32: (w, v) => w.writeFloatBE(v),
    bool: (w, v) => w.writeUInt8(v ? 1 : 0),
    resource: (w, v) => w.writeResource(v),
    string: (w, v) => w.writeOptionalString(v),
    stringArray: (w, v) => w.writeStringArray(v),
    optStringArray: (w, v) => w.writeOptionalStringArray(v),
    i16Array: (w, v) => w.writeInt16Array(v),
    vector3: (w, v) => w.writeOptionalVector3(v),
    vector3Array: (w, v) => w.writeVector3Array(v),
};

function readInto(target: Record<string, any>, schema: PacketSchema, reader: BufferReader): void {
    for (const field of schema) {
        if (field.type === "list") {
            const count = reader.readInt32BE();
            const items: Record<string, any>[] = [];
            for (let i = 0; i < count; i++) {
                const item: Record<string, any> = {};
                readInto(item, field.of, reader);
                items.push(item);
            }
            target[field.name] = items;
        } else if (field.type === "object") {
            const obj: Record<string, any> = {};
            readInto(obj, field.of, reader);
            target[field.name] = obj;
        } else if (field.type === "optObject") {
            if (reader.readUInt8() === 1) {
                target[field.name] = null;
            } else {
                const obj: Record<string, any> = {};
                readInto(obj, field.of, reader);
                target[field.name] = obj;
            }
        } else {
            target[field.name] = READERS[field.type](reader);
        }
    }
}

function writeInto(source: Record<string, any>, schema: PacketSchema, writer: BufferWriter): void {
    for (const field of schema) {
        if (field.type === "list") {
            const items: any[] = source[field.name] ?? [];
            writer.writeInt32BE(items.length);
            for (const item of items) {
                writeInto(item, field.of, writer);
            }
        } else if (field.type === "object") {
            writeInto(source[field.name], field.of, writer);
        } else if (field.type === "optObject") {
            const value = source[field.name];
            const isEmpty = value === null || value === undefined;
            writer.writeUInt8(isEmpty ? 1 : 0);
            if (!isEmpty) {
                writeInto(value, field.of, writer);
            }
        } else {
            WRITERS[field.type](writer, source[field.name]);
        }
    }
}

/** Reads `buffer` into `target`'s fields according to `schema` (in order). */
export function readSchema(target: Record<string, any>, schema: PacketSchema, buffer: Buffer): void {
    readInto(target, schema, new BufferReader(buffer));
}

/** Serializes `source`'s fields according to `schema` (in order). */
export function writeSchema(source: Record<string, any>, schema: PacketSchema): Buffer {
    const writer = new BufferWriter();
    writeInto(source, schema, writer);
    return writer.getBuffer();
}
