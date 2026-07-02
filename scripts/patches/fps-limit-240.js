'use strict';
/**
 * fps-limit-240 (library.swf): aumenta o limite máximo do slider de FPS de 120
 * para 240 (setting SETTINGS_FPS_LIMIT).
 *
 * Na classe do slider (§5214239888239901§/§5214235483235496§), o construtor faz
 * `slider.max = 120` (pushbyte 120 ; setproperty "false catch default"). O valor
 * escolhido flui direto p/ stage.frameRate (sem outro clamp a 120; AIR suporta
 * frameRate alto). Trocamos 120 -> 240 (pushbyte não cabe 240, então pushshort).
 * Min/step (30/5) e o piso por refreshRate ficam iguais. Ajustável via env FPS_MAX.
 */
const MAX = parseInt(process.env.FPS_MAX || '240', 10);
const SLIDER_MAX_SET = 'setproperty         QName(PackageNamespace("", "#0"), "false catch default")';
const RE = /pushbyte(\s+)120(\s*\n\s*setproperty\s+QName\(PackageNamespace\("", "#0"\), "false catch default"\))/;

module.exports = {
  id: 'fps-limit-240',
  swf: 'library',
  description: 'Aumenta o limite do slider de FPS de 120 para ' + MAX + '.',

  apply({ classes, log }) {
    let seen = false, edits = 0, already = 0;
    for (const c of classes) {
      if (!/instance QName\(PackageNamespace\("5214239888239901123423632234"\), "5214235483235496123423632234"\)/.test(c.text)) continue;
      seen = true;
      if (RE.test(c.text)) {
        c.save(c.text.replace(RE, 'pushshort$1' + MAX + '$2'));
        edits = 1;
      } else if (c.text.includes('pushshort           ' + MAX) && c.text.includes(SLIDER_MAX_SET)) {
        already = 1;
      }
    }
    if (!seen) throw new Error('classe do slider de FPS não encontrada (base é library.swf?)');
    if (edits === 0 && already) return { edits: 0, note: 'já aplicado' };
    if (edits === 0) throw new Error('não achei o `slider.max = 120` (estrutura mudou?)');
    log('slider FPS max 120 -> ' + MAX);
    return { edits };
  },
};
