'use strict';
/**
 * garage-animated-paint: correcao COMPLETA de pinturas animadas (coloring
 * type-11 / image.tara sprite sheet). A batalha ja roteia por `is
 * MultiframeImage`; este patch faz a GARAGEM (mount + preview) tratar a
 * coloring animada tambem, ANIMANDO no preview (nao so estatica).
 *
 * Edits (bytecode ASASM, espelham o caminho da batalha):
 *  1. mount handler `5214238150238163` (initDepot/initMarket): rotear
 *     `new IfNative(null, Static(res))` -> `res is MultiframeImage ?
 *     IfNative(res,null) : IfNative(null,Static(res))` (mata o #1034 e monta
 *     o container de recursos correto).
 *  2. preview builder `false const in`/`finally package break`: antes de
 *     `staticColoring()`, `if (paint.isAnimated()) viewer.animColorLT(anim)`.
 *  3. adiciona o forwarder `animColorLT(mf)` em §if final§ e no preview
 *     §5214237251237264§, ligando o setter animado (setTextureAnimation) da
 *     peca -> AnimatedPaintMaterial renderiza e anima na garagem.
 *
 * Confirmado funcionando em batalha E garagem. Ver [[animated-paints]].
 */
const S = require('./_shared');

module.exports = {
  id: 'garage-animated-paint',
  description: 'Pintura animada — correcao completa (mount + preview animado na garagem).',

  apply({ classes, log }) {
    let mount = 0, builder = 0, ifFinal = 0, preview = 0;
    let mountSeen = false, builderSeen = false, ifFinalSeen = false, previewSeen = false;
    for (const c of classes) {
      if (S.isMountHandler(c.text)) {
        mountSeen = true;
        if (/istype\s+QName\(PackageNamespace\("implements use var"\), "finally for implements"\)/.test(c.text)) { mount = -1; }
        else { const r = S.patchMountRouting(c.text); if (r.count) { c.save(r.text); mount += r.count; } }
      }
      if (S.isBuilder(c.text)) {
        builderSeen = true;
        if (/LnotAnimColor/.test(c.text)) { builder = -1; }
        else { const r = S.patchBuilder(c.text); if (r.count) { c.save(r.text); builder += r.count; } }
      }
      if (S.isIfFinal(c.text)) {
        ifFinalSeen = true;
        if (/"animColorLT"/.test(c.text)) { ifFinal = -1; }
        else { const r = S.insertTraitAfter(c.text, 'with while switch', S.IF_FINAL_ANIM); if (r.count) { c.save(r.text); ifFinal += r.count; } }
      }
      if (S.isPreview(c.text)) {
        previewSeen = true;
        if (/"animColorLT"/.test(c.text)) { preview = -1; }
        else { const r = S.insertTraitAfter(c.text, 'include super use', S.PREVIEW_ANIM); if (r.count) { c.save(r.text); preview += r.count; } }
      }
    }
    if ([mount, builder, ifFinal, preview].every((x) => x === -1)) return { edits: 0, note: 'ja aplicado' };
    if (!mountSeen || !builderSeen || !ifFinalSeen || !previewSeen) throw new Error('classes-alvo nao encontradas (SWF errado?)');
    if ([mount, builder, ifFinal, preview].some((x) => x === 0)) {
      throw new Error(`sitios nao casaram (mount=${mount}, builder=${builder}, ifFinal=${ifFinal}, preview=${preview})`);
    }
    log('mount x' + Math.max(mount, 0) + ', builder x' + Math.max(builder, 0) + ', forwarders: ifFinal+preview');
    return { edits: 4 };
  },
};
