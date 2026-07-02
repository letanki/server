'use strict';
/**
 * supplies-center: centraliza horizontalmente o painel de suprimentos
 * (InventoryModel.onResize) do HUD in-battle. Porta do antigo
 * patch-supplies-center.js. Idempotente (pula se ja tiver stageWidth).
 * Opcoes via env: SUPPLIES_OFFSET (padrao 130).
 */
const OFFSET = parseInt(process.env.SUPPLIES_OFFSET || '130', 10);

function patchOnResize(text) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const idxName = text.indexOf('name "onResize"');
  if (idxName < 0) return { text, count: 0, seen: false };
  const idxEnd = text.indexOf('end ; method', idxName);
  if (idxEnd < 0) return { text, count: 0, seen: true };
  let method = text.slice(idxName, idxEnd);
  if (/"stageWidth"/.test(method)) return { text, count: 0, seen: true, already: true };

  const ratioRe = /([ \t]*)getlex[^\n]*\r?\n[ \t]*getproperty[^\n]*"stage"\)[^\n]*\r?\n[ \t]*getproperty[^\n]*"stageHeight"\)[^\n]*\r?\n[ \t]*getlex[^\n]*\r?\n[ \t]*getproperty[^\n]*\r?\n[ \t]*divide/;
  const ratio = method.match(ratioRe);
  if (!ratio) throw new Error('bloco stageHeight/SCALE nao encontrado no onResize');
  const ratioWidth = ratio[0].replace('"stageHeight"', '"stageWidth"');

  const xRe = /([ \t]*)pushbyte[ \t]+0[ \t]*(\r?\n[ \t]*setproperty[^\n]*"x"\))/;
  if (!xRe.test(method)) throw new Error('`pushbyte 0` (X) nao encontrado no onResize');
  method = method.replace(xRe, (_m, indent, t) =>
    ratioWidth + eol + indent + 'pushbyte 2' + eol + indent + 'divide' + eol +
    indent + 'pushshort ' + OFFSET + eol + indent + 'subtract' + t);
  method = method.replace(/maxstack[ \t]+(\d+)/, (m, n) => (parseInt(n, 10) < 4 ? 'maxstack 4' : m));
  return { text: text.slice(0, idxName) + method + text.slice(idxEnd), count: 1, seen: true };
}

module.exports = {
  id: 'supplies-center',
  description: 'Centraliza o painel de suprimentos (InventoryModel.onResize). offset=' + OFFSET + 'px.',

  apply({ classes, log }) {
    let seen = false, already = false;
    for (const c of classes) {
      if (!/inventory:InventoryModel/.test(c.text) || !/name "onResize"/.test(c.text)) continue;
      seen = true;
      const r = patchOnResize(c.text);
      if (r.already) { already = true; continue; }
      if (r.count) { c.save(r.text); log('onResize centralizado (offset ' + OFFSET + ')'); return { edits: 1 }; }
    }
    if (already) return { edits: 0, note: 'ja aplicado' };
    if (!seen) throw new Error('InventoryModel/onResize nao encontrado');
    return { edits: 0, note: 'nada a fazer' };
  },
};
