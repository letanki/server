// Notícias exibidas na janela do lobby (InitNews). Cada notícia aparece UMA vez por jogador — o `id`
// (interno, NÃO enviado ao cliente) rastreia o que cada usuário já viu (user.seenNewsIds). Para lançar
// uma notícia nova, adicione um item com um `id` novo e único; ela aparecerá no próximo login de quem
// ainda não a viu. NÃO reutilize um `id` antigo (senão quem já viu não veria a nova).
export interface NewsItem {
    /** Identificador estável e único (só servidor) para rastrear "já visto". Não vai para o cliente. */
    id: string;
    /** URL da imagem (o cliente carrega via Loader). */
    imageUrl: string;
    /** Data exibida no topo (texto pequeno), ex.: "11.07.2026". */
    date: string;
    /** Corpo em HTML. */
    textHtml: string;
}

export const newsData: NewsItem[] = [
    {
        id: "welcome",
        imageUrl: "http://146.59.110.103/icons/xt.png",
        date: "11.07.2026",
        textHtml: "<div><b>Bem-vindo ao LeTanki!</b><br/>Divirta-se nas batalhas.</div>",
    },
];
