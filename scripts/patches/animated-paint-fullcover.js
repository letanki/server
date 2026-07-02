'use strict';
/**
 * animated-paint-fullcover (hardware.swf): faz cada FRAME da pintura animada
 * cobrir o tanque/torreta INTEIROS (efeito "piscar"/blink) e animar em todas as
 * fases (inclusive antes do activateTank).
 *
 * O AnimatedPaintMaterial monta o uvTransform como:
 *     outU = inU * scaleX + (frameCol * frameWidth)    (scaleX = details.width/sheet.width)
 * Quando o frame NÃO tem a resolução da textura de detalhe (ex.: Spectrum = frames 1x1),
 * scaleX != frameWidth e a UV do tanque varre um TRECHO da folha (gradiente deslizando).
 *
 * Além disso, o `update()` (que avança o frame E aplica o uvTransform) só é chamado
 * pelo `drawOpaque`, NÃO pelo `drawTransparent`. No spawn (fade-in transparente, antes
 * do activateTank) o material fica no uvTransform padrão (identidade) -> tira espalhada,
 * frame 0 congelado ("modelo antigo").
 *
 * Edits (3):
 *   1. getproperty scaleX -> frameWidth   (uvTransformConst[0])  -> 1 frame cobre o tanque
 *   2. getproperty scaleY -> frameHeight  (uvTransformConst[5])
 *   3. drawTransparent chama update()     (como o drawOpaque)     -> anima/janela no spawn
 * Para folhas "corretas" (frame == detail) scaleX já == frameWidth (no-op). Só afeta
 * pinturas (nenhum efeito usa AnimatedPaintMaterial).
 */

const FRAME_W = 'QName(PrivateNamespace("alternativa.tanks.materials:AnimatedPaintMaterial"), "frameWidth")';
const FRAME_H = 'QName(PrivateNamespace("alternativa.tanks.materials:AnimatedPaintMaterial"), "frameHeight")';
const UPDATE = 'QName(PackageNamespace(""), "update")';
// bloco do drawTransparent, do nome até o callsupervoid (p/ inserir o update() dentro dele)
const DRAW_TRANSP_RE = /name "drawTransparent"[\s\S]*?callsupervoid\s+QName\(Namespace\("http:\/\/alternativaplatform\.com\/en\/alternativa3d"\), "drawTransparent"\), 7/;

module.exports = {
  id: 'animated-paint-fullcover',
  swf: 'hardware',
  description: 'AnimatedPaintMaterial: cada frame cobre o tanque/torreta inteiros (blink) e anima já no spawn.',

  apply({ classes, log }) {
    let seen = false, edits = 0, already = 0;
    for (const c of classes) {
      if (!/instance QName\(PackageNamespace\("alternativa\.tanks\.materials"\), "AnimatedPaintMaterial"\)/.test(c.text)) continue;
      seen = true;
      let t = c.text;

      // 1 + 2: escala do uvTransform = frameWidth/frameHeight (não scaleX/scaleY)
      const a = t.replace(/getproperty(\s+)QName\(PackageNamespace\(""\), "scaleX"\)/, 'getproperty$1' + FRAME_W);
      const b = a.replace(/getproperty(\s+)QName\(PackageNamespace\(""\), "scaleY"\)/, 'getproperty$1' + FRAME_H);
      if (a !== t) edits++; else already++;
      if (b !== a) edits++; else already++;
      t = b;

      // 3: drawTransparent chama update() (mirror do drawOpaque)
      const m = t.match(DRAW_TRANSP_RE);
      if (m) {
        if (new RegExp('callpropvoid\\s+' + esc(UPDATE) + ', 0').test(m[0])) { already++; }
        else {
          const patched = m[0].replace(/(pushscope[^\n]*\n)/, '$1      getlocal0\n      callpropvoid        ' + UPDATE + ', 0\n');
          t = t.replace(m[0], patched); edits++;
        }
      }

      if (t !== c.text) c.save(t);
    }
    if (!seen) throw new Error('AnimatedPaintMaterial não encontrado (base é hardware.swf?)');
    if (edits === 0 && already >= 3) return { edits: 0, note: 'já aplicado' };
    if (edits !== 3) throw new Error(`esperava 3 edits, fez ${edits} (already=${already})`);
    log('scaleX/Y→frameWidth/Height + drawTransparent chama update()');
    return { edits };
  },
};

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
