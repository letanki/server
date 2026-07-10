import { BasePacket } from "@/packets/base.packet";
import { defs, encodeBody, decodeBody } from "protanki-protocol";
import * as SocialTypes from "./social.types";

// ID e schema em `protanki-protocol` (defs.social.*). A lib escreve os bytes (list de botões).

export class SocialNetwork extends BasePacket implements SocialTypes.ISocialNetwork {
    socialNetworkParams: Array<Array<String>>;

    constructor(socialNetworkParams: Array<Array<String>>) {
        super();
        this.socialNetworkParams = socialNetworkParams;
    }

    // Lógica: cada botão é um par [url, label]; o wire é uma list de { url, label }.
    read(buffer: Buffer): void {
        const { fields } = decodeBody(defs.social.SocialNetwork, buffer);
        this.socialNetworkParams = fields.socialNetworkParams.map((b) => [b.url ?? "unknow", b.label ?? "unknow"]);
    }

    write(): Buffer {
        return encodeBody(defs.social.SocialNetwork, {
            socialNetworkParams: this.socialNetworkParams.map((b) => ({ url: String(b[0]), label: String(b[1]) })),
        });
    }

    static getId(): number { return defs.social.SocialNetwork.id; }
}
