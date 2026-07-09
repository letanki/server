// O motor de schema foi extraído para a lib compartilhada `protanki-protocol`
// (usada também pelo protanki-bridge). Este arquivo re-exporta a API para manter
// os imports existentes (`@/packets/packet-schema`) funcionando sem alteração.
export {
    PrimitiveType,
    PrimitiveField,
    CompositeField,
    SchemaField,
    PacketSchema,
    readSchema,
    writeSchema,
} from "protanki-protocol";
