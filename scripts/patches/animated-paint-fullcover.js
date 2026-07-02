'use strict';
/**
 * animated-paint-fullcover (hardware.swf): faz cada FRAME da pintura animada
 * cobrir o tanque/torreta INTEIROS (efeito "piscar"/blink), em vez de deslizar
 * a textura ao longo do casco.
 *
 * O AnimatedPaintMaterial monta o uvTransform como:
 *     outU = inU * scaleX + (frameCol * frameWidth)
 *     outV = inV * scaleY + (frameRow * frameHeight)
 * com scaleX = details.width/sheet.width. Quando o frame NÃO tem a mesma
 * resolução da textura de detalhe (ex.: Spectrum = frames 1x1), scaleX != frameWidth
 * e a UV do tanque acaba varrendo um TRECHO da folha (gradiente deslizando).
 *
 * Fix: usar frameWidth/frameHeight na ESCALA da UV (não scaleX/scaleY). Assim a
 * UV 0..1 do tanque mapeia para EXATAMENTE um frame -> o frame inteiro cobre o
 * tanque; avançar o frame troca a cor do tanque todo. Para folhas "corretas"
 * (frame == tamanho do detail) scaleX já == frameWidth, então é no-op p/ elas.
 *
 * Edit: no método de update do material, troca
 *   getproperty scaleX  -> getproperty frameWidth   (uvTransformConst[0])
 *   getproperty scaleY  -> getproperty frameHeight  (uvTransformConst[5])
 */

const FRAME_W = 'QName(PrivateNamespace("alternativa.tanks.materials:AnimatedPaintMaterial"), "frameWidth")';
const FRAME_H = 'QName(PrivateNamespace("alternativa.tanks.materials:AnimatedPaintMaterial"), "frameHeight")';

module.exports = {
  id: 'animated-paint-fullcover',
  swf: 'hardware',
  description: 'AnimatedPaintMaterial: cada frame cobre o tanque/torreta inteiros (blink), não desliza.',

  apply({ classes, log }) {
    let seen = false, edits = 0;
    for (const c of classes) {
      if (!/instance QName\(PackageNamespace\("alternativa\.tanks\.materials"\), "AnimatedPaintMaterial"\)/.test(c.text)) continue;
      seen = true;
      let t = c.text;
      const x = t.replace(/getproperty(\s+)QName\(PackageNamespace\(""\), "scaleX"\)/, 'getproperty$1' + FRAME_W);
      const y = x.replace(/getproperty(\s+)QName\(PackageNamespace\(""\), "scaleY"\)/, 'getproperty$1' + FRAME_H);
      if (y !== t) { c.save(y); edits = (x !== t ? 1 : 0) + (y !== x ? 1 : 0); }
    }
    if (!seen) throw new Error('AnimatedPaintMaterial não encontrado (base é hardware.swf?)');
    if (edits === 0) return { edits: 0, note: 'já aplicado' };
    if (edits !== 2) throw new Error(`esperava 2 edits (scaleX/scaleY), fez ${edits}`);
    log('scaleX→frameWidth, scaleY→frameHeight (frame cobre o tanque todo)');
    return { edits };
  },
};
