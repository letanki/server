import { IVector3 } from "@/shared/types/geom/ivector3";

export class BufferWriter {
  private chunks: Buffer[] = [];
  private totalLength: number = 0;

  public writeUInt8(value: number): this {
    const buffer = Buffer.alloc(1);
    buffer.writeUInt8(value, 0);
    this.chunks.push(buffer);
    this.totalLength += 1;
    return this;
  }

  public writeInt8(value: number): this {
    const buffer = Buffer.alloc(1);
    buffer.writeInt8(value, 0);
    this.chunks.push(buffer);
    this.totalLength += 1;
    return this;
  }

  public writeInt16BE(value: number): this {
    const buffer = Buffer.alloc(2);
    buffer.writeInt16BE(value, 0);
    this.chunks.push(buffer);
    this.totalLength += 2;
    return this;
  }

  public writeInt32BE(value: number): this {
    const buffer = Buffer.alloc(4);
    buffer.writeInt32BE(value, 0);
    this.chunks.push(buffer);
    this.totalLength += 4;
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
    const buffer = Buffer.alloc(4);
    buffer.writeFloatBE(value, 0);
    this.chunks.push(buffer);
    this.totalLength += 4;
    return this;
  }

  public writeOptionalString(value: string | null): this {
    const isNull = value === null || value === undefined;
    this.writeUInt8(isNull ? 1 : 0);
    if (!isNull) {
      const valueBuffer = Buffer.from(value, "utf8");
      this.writeInt32BE(valueBuffer.length);
      this.writeBuffer(valueBuffer);
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
    this.chunks.push(buffer);
    this.totalLength += buffer.length;
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
    return Buffer.concat(this.chunks, this.totalLength);
  }

  public getLength(): number {
    return this.totalLength;
  }
}
