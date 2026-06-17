import { IVector3 } from "@/shared/types/geom/ivector3";

export class BufferWriter {
  private buffer: Buffer;
  private length: number = 0;

  constructor(initialCapacity: number = 64) {
    this.buffer = Buffer.allocUnsafe(initialCapacity);
  }

  /** Ensures at least `extra` more bytes fit, growing (capacity doubling) if needed. */
  private ensureCapacity(extra: number): void {
    const required = this.length + extra;
    if (required <= this.buffer.length) {
      return;
    }
    let newCapacity = this.buffer.length * 2;
    while (newCapacity < required) {
      newCapacity *= 2;
    }
    const grown = Buffer.allocUnsafe(newCapacity);
    this.buffer.copy(grown, 0, 0, this.length);
    this.buffer = grown;
  }

  public writeUInt8(value: number): this {
    this.ensureCapacity(1);
    this.length = this.buffer.writeUInt8(value, this.length);
    return this;
  }

  public writeInt8(value: number): this {
    this.ensureCapacity(1);
    this.length = this.buffer.writeInt8(value, this.length);
    return this;
  }

  public writeInt16BE(value: number): this {
    this.ensureCapacity(2);
    this.length = this.buffer.writeInt16BE(value, this.length);
    return this;
  }

  public writeInt32BE(value: number): this {
    this.ensureCapacity(4);
    this.length = this.buffer.writeInt32BE(value, this.length);
    return this;
  }

  /**
   * Writes a client Resource id (idHigh int32 + idLow int32). Our resources
   * always have idHigh = 0, so only the idLow is meaningful. The current client
   * reads every binary resource field as 8 bytes; writing a single int32 desyncs
   * the packet and yields "Resource <garbage id> not found".
   */
  public writeResource(idLow: number): this {
    this.writeInt32BE(0);
    this.writeInt32BE(idLow);
    return this;
  }

  public writeFloatBE(value: number): this {
    this.ensureCapacity(4);
    this.length = this.buffer.writeFloatBE(value, this.length);
    return this;
  }

  public writeOptionalString(value: string | null): this {
    const isNull = value === null || value === undefined;
    this.writeUInt8(isNull ? 1 : 0);
    if (!isNull) {
      const byteLength = Buffer.byteLength(value, "utf8");
      this.writeInt32BE(byteLength);
      this.ensureCapacity(byteLength);
      this.length += this.buffer.write(value, this.length, "utf8");
    }
    return this;
  }

  public writeOptionalStringArray(array: string[] | null): this {
    const isEmpty = !array || array.length === 0;
    this.writeUInt8(isEmpty ? 1 : 0);

    if (!isEmpty) {
      this.writeInt32BE(array.length);
      for (const item of array) {
        this.writeOptionalString(item);
      }
    }
    return this;
  }

  public writeStringArray(array: string[] | null): this {
    this.writeUInt8(0);
    const finalArray = array ?? [];
    this.writeInt32BE(finalArray.length);
    for (const item of finalArray) {
      this.writeOptionalString(item);
    }
    return this;
  }

  public writeInt16Array(array: number[] | null): this {
    const isEmpty = !array || array.length === 0;
    this.writeUInt8(isEmpty ? 1 : 0);

    if (!isEmpty) {
      this.writeInt32BE(array.length);
      for (const item of array) {
        this.writeInt16BE(item);
      }
    }
    return this;
  }

  public writeVector3Array(array: (IVector3 | null)[] | null): this {
    const isEmpty = !array || array.length === 0;
    this.writeUInt8(isEmpty ? 1 : 0);

    if (!isEmpty) {
      this.writeInt32BE(array.length);
      for (const item of array) {
        this.writeOptionalVector3(item);
      }
    }
    return this;
  }

  public writeBuffer(buffer: Buffer): this {
    this.ensureCapacity(buffer.length);
    buffer.copy(this.buffer, this.length);
    this.length += buffer.length;
    return this;
  }

  public writeOptionalVector3(vector: IVector3 | null): this {
    const isNull = !vector;
    this.writeUInt8(isNull ? 1 : 0);
    if (!isNull) {
      this.writeFloatBE(vector!.x);
      this.writeFloatBE(vector!.y);
      this.writeFloatBE(vector!.z);
    }
    return this;
  }

  public getBuffer(): Buffer {
    return this.buffer.subarray(0, this.length);
  }

  public getLength(): number {
    return this.length;
  }
}
