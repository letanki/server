# Rank 31 "Lenda" — asset do cliente

O ícone de rank é um **asset embutido** no `library.swf` (não um resource) e o **nome**
vem do `localized.data`. Tudo o que o cliente precisa para o rank 31 é instalado por
**um único script**: `scripts/add-legend-rank.js`.

## Arquivos

- `BigRank31.png` — 64×64 (base do rank 31)
- `SmallRank31.png` — 15×15 (base do rank 31)

Redimensionados da arte 256² com o mesmo recorte dos ranks oficiais. A versão dourada
(premium) é composta em runtime pelo cliente — não precisa de bitmap próprio.

## Instalar / reverter

```
node scripts/add-legend-rank.js              # imagens + classes ABC + arrays 30->31 + nomes, e deploy
node scripts/add-legend-rank.js --no-deploy  # só grava no base resources/, sem publicar
node scripts/add-legend-rank.js --revert     # desfaz (git checkout do base + localized) e rebuild .resource
```

O script, sobre uma **cópia temporária** da base (o `resources/library.swf` pristino
**nunca** é editado): (1) embute `BigRank31`/`SmallRank31` (DefineBitsJPEG2 + SymbolClass)
via ffdec; (2) cria as classes `BitmapData` no ABC (senão dá `#1065`); (3) cresce os dois
arrays de `DefaultRanksBitmaps` e os caches de 30→31. Em cima dessa temp, o `patch-client`
aplica os demais patches de library e grava `resources/library-patch.swf` + o servido
`.resource/library.swf`. Por fim (4) acrescenta o nome à chave `RANK_NAMES` nos
`localized.data_<lang>` (en/pt_BR/ru/ua, que não têm pipeline de patch).
Idempotente (parte sempre da base pristina). ffdec em `C:\Program Files (x86)\FFDec\ffdec-cli.exe` (ou `$FFDEC`).

## Lado servidor (NÃO tocado por este script)

Rank 31 + nível de Lenda dinâmico vivem em `src/config/rank.data.ts` e
`src/shared/services/rank.service.ts` (+ `/whois`). Reaplicar manualmente ao reativar.
