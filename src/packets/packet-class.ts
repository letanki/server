import { PacketDef, readSchema, writeSchema } from "protanki-protocol";
import { BasePacket } from "./base.packet";
import { IPacket } from "./packet.interfaces";

/**
 * Gera uma classe de pacote FINA a partir de uma `def` do protanki-protocol.
 *
 * A def é a fonte única de verdade: id, schema (layout de fio) e direção. Esta fábrica
 * cabeia `read`/`write`/`getId` automaticamente delegando o codec de bytes pra lib —
 * eliminando o boilerplate repetido em ~259 classes escritas à mão, SEM mudar os call
 * sites (registry, handlers, `sendPacket`, `new XPacket({...})` continuam iguais).
 *
 * Os campos são tipados a partir do schema (`FieldsOf`), então `new P({ ... })` valida os
 * nomes em tempo de compilação e `packet.campo` mantém autocomplete. `read`/`write` são ambos
 * funcionais (delegam pro schema); a `direction` da def é documental (usada pelo bridge).
 *
 * Uso:
 *   export const SmokyStaticShotPacket = packetClass(defs.weapons.SmokyStaticShot);
 *   export type  SmokyStaticShotPacket = InstanceType<typeof SmokyStaticShotPacket>;
 */

type DefFields<D> = D extends PacketDef<infer F, string> ? F : never;

export interface PacketCtor<F> {
    new (fields?: Partial<F>): IPacket & F;
    getId(): number;
}

export function packetClass<D extends PacketDef<any, string>>(def: D): PacketCtor<DefFields<D>> {
    const cls = class extends BasePacket {
        public constructor(fields: Partial<DefFields<D>> = {}) {
            super();
            Object.assign(this, fields);
        }
        // read e write são ambos funcionais (delegam pro schema), sem impor direção em runtime —
        // fiel às classes antigas, que definiam os dois via readSchema/writeSchema. A `direction`
        // da def continua documental (e usada pelo bridge para rotular capturas).
        public read(buffer: Buffer): void {
            readSchema(this, def.schema!, buffer);
        }
        public write(): Buffer {
            return writeSchema(this, def.schema!);
        }
        public static getId(): number {
            return def.id;
        }
    };
    return cls as unknown as PacketCtor<DefFields<D>>;
}
