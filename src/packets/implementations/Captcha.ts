import { BufferReader } from "../../utils/buffer/BufferReader";
import { BufferWriter } from "../../utils/buffer/BufferWriter";
import { ICaptcha } from "../interfaces/ICaptcha";
import { BasePacket } from "./BasePacket";

export default class Captcha extends BasePacket implements ICaptcha {
  view: number;
  image: Buffer;

  constructor(view: number = 0, image: Buffer = Buffer.alloc(0)) {
    super();
    this.view = view;
    this.image = image;
  }

  read(buffer: Buffer): void {
    const reader = new BufferReader(buffer);
    this.view = reader.readInt32BE();
    const imageLen = reader.readInt32BE();
    this.image = reader.readBytes(imageLen);
  }

  write(): Buffer {
    const writer = new BufferWriter();
    writer.writeInt32BE(this.view);
    writer.writeInt32BE(this.image.length);
    writer.writeBuffer(this.image);
    return writer.getBuffer();
  }

  toString(): string {
    return `Captcha(view=${this.view}, imageLen=${this.image.length})`;
  }

  static getId(): number {
    return -1670408519;
  }
}
