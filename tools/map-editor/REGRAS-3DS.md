# Regras de renderização dos props (.3ds) — engenharia reversa

Como o editor decide o que renderizar de cada mesh das bibliotecas, replicando o cliente do jogo.
Cada regra nasceu de um prop real quebrado, foi medida nos arquivos e validada visualmente.
Implementação: `getPropTemplate()` em `index.html` (parsers: `parseTara`, `parsePivot`,
`parse3dsBindings`).

## Formatos

- **library.tara**: arquivo tara (uint32 count BE; TOC tag/len; blobs) com `library.xml`
  (`<library><prop-group><prop><mesh file="x.3ds"><texture name diffuse-map/>` ou
  `<sprite file= origin-y= scale=>`), meshes `.3ds` e texturas.
- **Posicionamento**: mundo = vértices CRUS − translação do pivô do PRIMEIRO objeto (chunk 0x4160).
  Não confiar na matriz do TDSLoader (transposição quebra bases não-identidade) — desfazemos o
  transform dele por completo e subtraímos o pivô parseado por nós. Sem pivô: centro XY do bbox,
  base Z. Convenção verificada: pivô ≈ centro XY do bbox com Z na base (pontes têm offset Z
  proposital).

## Política de visibilidade por objeto (duas passadas)

Lida dos vínculos de material do próprio .3ds (0x4130 objeto→material, 0xA300 material→arquivo):

1. **`occl*`** → oculto (geometria de oclusão do cliente). *(NuBu 12)*
2. **Material vinculado SEM textura** ("Default") → caixa auxiliar de colisão → oculto.
   *(SmHouse2/Box121, NuBu 12/Box25)*
3. **Material com textura AUSENTE na lib** → oculto, como o cliente. Texturas resolvem SÓ no tara
   da própria lib (índice global entre libs acha arquivo errado: "grass.jpg" da terrain é asfalto).
   *(sombra preta do slope_1, tile3_3 dos pisos 3x3)*
4. **UV exatamente 0..1 nos dois eixos** (vinculado) → lixo de autoria (o atlas inteiro esmagado
   num plano) → oculto, exceto se for tudo que restou (decal legítimo). *(Plane39/42/110 do
   Bridge rise)*
5. **Sem vínculo de material** → helper oculto *(Plane35/Box17 do Wall Straight, Box113/114 do
   Billboard)* — EXCETO quando nenhum objeto vinculado sobreviveu: aí é a superfície de fallback,
   texturizada com a variante do library.xml ou com a primeira textura existente dos materiais do
   arquivo. *(Plane27 dos pisos 3x3 com variante; sem essa textura de fallback a rampa da ponte
   renderizava branca)*

## Moldes de posicionamento (a solução dos túneis/pontes)

Alguns meshes carregam a cópia visual TEXTURIZADA numa célula deslocada + objetos sem vínculo
("moldes") marcando o lugar verdadeiro. O cliente desenha o visual NO LUGAR do molde.

- **Detecção**: moldes = objetos sem vínculo cujo centro XY cai FORA do bbox da união texturizada
  (peças de decoração, como o arco dos túneis, têm centro dentro ou vão para uma 3ª célula) E que
  têm CORPO (ambas as dimensões XY > 20u — linhas degeneradas de largura 0, como os tri02_* nas
  bordas do Bridge 6, têm centro na fronteira e disparavam shift indevido).
- **Âncora**: o MAIOR molde por área XY (a laje/piso da célula verdadeira). Média de todos era
  poluída por peças em terceiras células (arco do Tunnel 2 dava +375 em vez de +250).
- **Delta XY** = centro do maior molde − centro da união texturizada; **Delta Z** = base (minZ) da
  UNIÃO dos moldes − base da união texturizada (não usar o maior molde no Z: nos túneis ele é a
  laje do TETO, z 542). Tubes: cano autorado meio enterrado (z −150) sobe +150; túneis/pontes
  dz = 0. Aplica-se a TODA a geometria texturizada. Guardas: ≥2 moldes (Tubes só têm 2: caixa da
  célula + lajinha) e |delta| > 50u.
- Casos medidos: **Bridge rise pro** (bridge_1_1: deslocado 1 célula, delta +1000,0 — cópia NÃO
  sobrepõe o molde), **Tunnel 1** (Box01: meia célula, delta 0,−250 — cópia SOBREPÕE o molde;
  por isso critério de "isolamento" não basta), **Tunnel 2** (Box02: delta 0,+250, com arco em
  3ª célula poluindo a média — daí o maior-molde), **Tube 1/Tube 3** (delta 0,+250,+150 — só 2
  moldes E componente Z), **Bridge 6** (contra-exemplo: NÃO tem molde; os tri degenerados não
  podem contar).
- Objeto isolado (só encosta na borda dos demais) SEM molde disponível → oculto (cópia de autoria).

## Materiais e texturas

- Materiais nativos (TDSLoader/Phong): **specular preto** (reflexo estourado) + **cor branca** nos
  texturizados (three multiplica textura × cor; a cor escura do arquivo deixava tudo "na sombra").
- **DoubleSide** em tudo (faces com winding invertido somem com backface culling — placas).
- Variante do library.xml (selecionada pelo `texture-name` do mapa) substitui a textura dos
  objetos visíveis; `flipY` fica no default do three (false global quebrou tudo — testado).
- Textura que falha no load → `material.visible = false` (propaga aos clones; material é
  compartilhado).
- **Sprites** (`<sprite>`): billboard de câmera (THREE.Sprite), tamanho = pixels × scale,
  `center.y = 1 − origin-y` (0.99 ≈ base no chão). flipY default (correto para sprites).

## Ferramenta de diagnóstico

Prop selecionada → painel "objetos (marque = visível)": um checkbox por objeto do .3ds, aplicado
ao vivo a todas as instâncias (overrides por sessão). Foi assim que os gabaritos das pontes e
túneis foram descobertos — para o próximo prop estranho, use o inspetor, ache a combinação que
bate com o jogo e derive a regra dos dados (dissecar o mesh: objetos, bboxes, pivôs, vínculos,
UVs), NUNCA por tentativa cega no render global.

**Importante**: tudo aqui é só a LENTE do editor — o map.xml salvo não guarda nada disso; o jogo
renderiza os props pelas regras internas dele, sempre.
