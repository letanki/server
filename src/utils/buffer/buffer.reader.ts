import { IVector3 } from "@/shared/types/geom/ivector3";

export class BufferReader {
  private buffer: Buffer;
  private offset: number = 0;

  constructor(buffer: Buffer) {
    this.buffer = buffer;
  }

  public get hasRemaining(): boolean {
    return this.offset < this.buffer.length;
  }

  private checkCanRead(length: number): void {
    if (this.offset + length > this.buffer.length) {
      throw new Error("Attempt to read beyond buffer bounds.");
    }
  }

  public readUInt8(): number {
    this.checkCanRead(1);
    const value = this.buffer.readUInt8(this.offset);
    this.offset += 1;
    return value;
  }

  public readInt8(): number {
    this.checkCanRead(1);
    const value = this.buffer.readInt8(this.offset);
    this.offset += 1;
    return value;
  }

  public readInt16BE(): number {
    this.checkCanRead(2);
    const value = this.buffer.readInt16BE(this.offset);
    this.offset += 2;
    return value;
  }

  public readInt32BE(): number {
    this.checkCanRead(4);
    const value = this.buffer.readInt32BE(this.offset);
    this.offset += 4;
    return value;
  }

  /** Reads a client Resource id (idHigh int32 + idLow int32), returning the idLow. */
  public readResource(): number {
    this.readInt32BE(); // idHigh (always 0 for our resources)
    return this.readInt32BE(); // idLow
  }

  public readFloatBE(): number {
    this.checkCanRead(4);
    const value = this.buffer.readFloatBE(this.offset);
    this.offset += 4;
    return value;
  }

  public readOptionalString(): string | null {
    const isNull = this.readUInt8() === 1;
    if (isNull) {
      return null;
    }

    const length = this.readInt32BE();
    if (length < 0) {
      throw new Error("Invalid string length in buffer: cannot be negative.");
    }

    this.checkCanRead(length);
    const value = this.buffer.toString("utf-8", this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  public readStringArray(): string[] {
    const isEmpty = this.readUInt8() === 1;
    if (isEmpty) {
      return [];
    }

    const count = this.readInt32BE();
    const array: string[] = [];
    for (let i = 0; i < count; i++) {
      const str = this.readOptionalString();
      if (str !== null) {
        array.push(str);
      }
    }
    return array;
  }

  public readInt16Array(): number[] {
    const isEmpty = this.readUInt8() === 1;
    if (isEmpty) {
      return [];
    }
    const count = this.readInt32BE();
    const array: number[] = [];
    for (let i = 0; i < count; i++) {
      array.push(this.readInt16BE());
    }
    return array;
  }

  public readVector3Array(): (IVector3 | null)[] {
    const isEmpty = this.readUInt8() === 1;
    if (isEmpty) {
      return [];
    }
    const count = this.readInt32BE();
    const array: (IVector3 | null)[] = [];
    for (let i = 0; i < count; i++) {
      array.push(this.readOptionalVector3());
    }
    return array;
  }

  public readBytes(length: number): Buffer {
    this.checkCanRead(length);
    const value = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  public readOptionalVector3(): IVector3 | null {
    const isNull = this.readUInt8() === 1;
    if (isNull) {
      return null;
    }
    return {
      x: this.readFloatBE(),
      y: this.readFloatBE(),
      z: this.readFloatBE(),
    };
  }
}
