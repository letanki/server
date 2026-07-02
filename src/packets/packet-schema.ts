import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";

/**
 * Declarative packet field schema. Defining the wire format once (field order +
 * type) and generating read/write removes the recurring class of bugs from
 * hand-written codecs (wrong int width, swapped order, resource = 8 bytes, etc.).
 *
 * `string` is the optional-string encoding used everywhere (1-byte null flag +
 * int32 length + utf8). `optStringArray` reads like a string array but writes
 * with the "optional" empty flag, matching the existing helpers. `bytes` is an
 * int32 length followed by that many raw bytes (e.g. captcha images).
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
    | "vector3Array"
    | "bytes";

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
    bytes: (r) => r.readBytes(r.readInt32BE()),
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
    bytes: (w, v: Buffer) => { w.writeInt32BE(v.length); w.writeBuffer(v); },
};

/**
 * PERFORMANCE — why this is compiled instead of a single reflective loop.
 *
 * A naive `for (const field of schema) target[field.name] = READERS[field.type](r)` shares ONE
 * property-access bytecode site across EVERY packet type. Under load (movement relay + mine broadcast
 * flood) V8's inline cache at that site sees dozens of object shapes and degrades to MEGAMORPHIC — a
 * slow dictionary lookup. A CPU profile of two players mine-spamming showed ~38% of the whole process
 * in `KeyedLoadIC_Megamorphic` / `LoadIC_Megamorphic` from exactly this.
 *
 * Fix: compile each schema ONCE into an array of per-field closures, cached by schema identity. Each
 * closure's `src[name]` / `target[name] = …` site is only ever reached with a SINGLE packet shape
 * (only that schema's packet uses that schema), so every IC stays MONOMORPHIC — the fast path. The
 * closure also captures the concrete reader/writer fn, dropping the `READERS[field.type]` dictionary
 * lookup too. Byte output is identical to the old reflective version (same ops, same order).
 */
type WriteStep = (w: BufferWriter, src: any) => void;
type ReadStep = (r: BufferReader, target: any) => void;

// Keyed by schema identity (the static readonly arrays are stable singletons). WeakMap so a schema
// that's ever GC'd takes its compiled steps with it.
const WRITE_STEPS = new WeakMap<object, WriteStep[]>();
const READ_STEPS = new WeakMap<object, ReadStep[]>();

function writeStepsFor(schema: PacketSchema): WriteStep[] {
    let steps = WRITE_STEPS.get(schema);
    if (steps) return steps;
    steps = schema.map((field): WriteStep => {
        const name = field.name;
        if (field.type === "list") {
            const of = field.of;
            return (w, src) => {
                const items: any[] = src[name] ?? [];
                w.writeInt32BE(items.length);
                const sub = writeStepsFor(of);
                for (const item of items) for (let i = 0; i < sub.length; i++) sub[i](w, item);
            };
        }
        if (field.type === "object") {
            const of = field.of;
            return (w, src) => {
                const value = src[name];
                const sub = writeStepsFor(of);
                for (let i = 0; i < sub.length; i++) sub[i](w, value);
            };
        }
        if (field.type === "optObject") {
            const of = field.of;
            return (w, src) => {
                const value = src[name];
                const isEmpty = value === null || value === undefined;
                w.writeUInt8(isEmpty ? 1 : 0);
                if (isEmpty) return;
                const sub = writeStepsFor(of);
                for (let i = 0; i < sub.length; i++) sub[i](w, value);
            };
        }
        const fn = WRITERS[field.type];
        return (w, src) => fn(w, src[name]);
    });
    WRITE_STEPS.set(schema, steps);
    return steps;
}

function readStepsFor(schema: PacketSchema): ReadStep[] {
    let steps = READ_STEPS.get(schema);
    if (steps) return steps;
    steps = schema.map((field): ReadStep => {
        const name = field.name;
        if (field.type === "list") {
            const of = field.of;
            return (r, target) => {
                const count = r.readInt32BE();
                const items: Record<string, any>[] = [];
                const sub = readStepsFor(of);
                for (let n = 0; n < count; n++) {
                    const item: Record<string, any> = {};
                    for (let i = 0; i < sub.length; i++) sub[i](r, item);
                    items.push(item);
                }
                target[name] = items;
            };
        }
        if (field.type === "object") {
            const of = field.of;
            return (r, target) => {
                const obj: Record<string, any> = {};
                const sub = readStepsFor(of);
                for (let i = 0; i < sub.length; i++) sub[i](r, obj);
                target[name] = obj;
            };
        }
        if (field.type === "optObject") {
            const of = field.of;
            return (r, target) => {
                if (r.readUInt8() === 1) {
                    target[name] = null;
                    return;
                }
                const obj: Record<string, any> = {};
                const sub = readStepsFor(of);
                for (let i = 0; i < sub.length; i++) sub[i](r, obj);
                target[name] = obj;
            };
        }
        const fn = READERS[field.type];
        return (r, target) => { target[name] = fn(r); };
    });
    READ_STEPS.set(schema, steps);
    return steps;
}

/** Reads `buffer` into `target`'s fields according to `schema` (in order). */
export function readSchema(target: Record<string, any>, schema: PacketSchema, buffer: Buffer): void {
    const reader = new BufferReader(buffer);
    const steps = readStepsFor(schema);
    for (let i = 0; i < steps.length; i++) steps[i](reader, target);
}

/** Serializes `source`'s fields according to `schema` (in order). */
export function writeSchema(source: Record<string, any>, schema: PacketSchema): Buffer {
    const writer = new BufferWriter();
    const steps = writeStepsFor(schema);
    for (let i = 0; i < steps.length; i++) steps[i](writer, source);
    return writer.getBuffer();
}
