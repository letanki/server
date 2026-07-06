'use strict';
/**
 * animated-paint-fullcover (hardware.swf): porta o comportamento do engine de REFERÊNCIA (libs/Game.swf,
 * não-ofuscado) para o nosso AnimatedPaintMaterial.
 *
 * CAUSA RAIZ (descoberta comparando com o Game.swf): nosso AnimatedPaintMaterial NÃO sobrescreve
 * getProgram — ele desenha com o PaintFragmentShader ESTÁTICO, que sampleia a folha DIRETO em v6
 * (`tex(ae2ba, b32df=v6, ...)`) SEM o frac-wrap por frame. O AnimatedPaintFragmentShader (que TEM o wrap
 * `frac(uv/frameSize)*frameSize + frameOffset`, idêntico ao da referência) é CÓDIGO MORTO no nosso build.
 * Sem o wrap, a janela de UV desliza/vaza pelos frames vizinhos da folha → tiles desalinhados + "pulos".
 *
 * FIX (2 frentes):
 *  A. PaintFragmentShader: inserir o wrap antes do primeiro tex (copiado do shader morto) e retargetar
 *     esse tex de v6 (b32df) para o temp wrapped (dbdaf). SEGURO para pinturas estáticas: o fragConst
 *     default do PaintMaterial é [0,0.5,1,2, 0.999,0.999, 0,0] → fc[24]=[0.999,0.999,0,0] → o wrap vira
 *     frac(uv/0.999)*0.999+0 ≈ uv (o engine já reservou esses defaults exatamente pra isso; e com sampler
 *     REPEAT, frac(uv) é matematicamente idêntico).
 *  B. AnimatedPaintMaterial (construtor): scaleX *= 512/details.width; scaleY *= 512/details.height
 *     (details = param3 = o bitmap principal do super). Igual ao update() da referência
 *     (`uvTransformConst[0] = scaleX * 512 / bitmap.width`, bitmap=details) → uvT[0] = 512/sheetW e a
 *     densidade de tiles = 512/framePx (ex.: frame 64px → 8 tiles).
 *
 * Mantidos: drawTransparent chama update() (anima no spawn), remoção da guarda do update() (buffer
 * compartilhado). A fase da animação agora é ABSOLUTA (b4f88b65 = (now/1000*fps) % numFrames via getTimer
 * global) em vez de acumulada por instância — assim carroceria e torreta ficam SEMPRE em sincronia mesmo
 * trocando a torreta (que cria um material novo); isso também substitui a antiga guarda de 1º frame.
 */

const SCALEX = 'QName(PackageNamespace(""), "scaleX")';
const SCALEY = 'QName(PackageNamespace(""), "scaleY")';
const UPDATE = 'QName(PackageNamespace(""), "update")';
const TIME = 'QName(PrivateNamespace("alternativa.tanks.materials:AnimatedPaintMaterial"), "time")';
const WIDTH = 'QName(PackageNamespace(""), "width")';
const HEIGHT = 'QName(PackageNamespace(""), "height")';

// ---------- A. wrap no PaintFragmentShader ----------
// primeiro tex: tex(ae2ba, b32df, a92e7...) — só o 1º usa b32df como fonte
const FIRST_TEX_RE = /(findpropstrict\s+QName\(PackageNamespace\(""\), "tex"\)\s*\n\s*getlex\s+QName\(PackageNamespace\(""\), "ae2ba"\)\s*\n\s*)getlex\s+QName\(PackageNamespace\(""\), "b32df"\)/;
// captura a MultinameL própria do arquivo (usada nos acessos fc[23])
const FC_ML_RE = /getlex\s+QName\(PackageNamespace\(""\), "fc"\)\s*\n\s*pushbyte\s+23\s*\n\s*getproperty\s+(MultinameL\(\[[^\n]*\]\))/;

function buildWrapBlock(ml) {
  const fc24 = `getlex              QName(PackageNamespace(""), "fc")
      pushbyte            24
      getproperty         ${ml}`;
  return `findpropstrict      QName(PackageNamespace(""), "div")
      getlex              QName(PackageNamespace(""), "dbdaf")
      getlex              QName(PackageNamespace(""), "b32df")
      ${fc24}
      callpropvoid        QName(PackageNamespace(""), "div"), 3

      findpropstrict      QName(PackageNamespace(""), "frc")
      getlex              QName(PackageNamespace(""), "dbdaf")
      getlex              QName(PackageNamespace(""), "dbdaf")
      callpropvoid        QName(PackageNamespace(""), "frc"), 2

      findpropstrict      QName(PackageNamespace(""), "mul")
      getlex              QName(PackageNamespace(""), "dbdaf")
      getlex              QName(PackageNamespace(""), "dbdaf")
      ${fc24}
      callpropvoid        QName(PackageNamespace(""), "mul"), 3

      findpropstrict      QName(PackageNamespace(""), "add")
      getlex              QName(PackageNamespace(""), "dbdaf")
      getproperty         QName(PackageNamespace(""), "x")
      getlex              QName(PackageNamespace(""), "dbdaf")
      getproperty         QName(PackageNamespace(""), "x")
      ${fc24}
      getproperty         QName(PackageNamespace(""), "z")
      callpropvoid        QName(PackageNamespace(""), "add"), 3

      findpropstrict      QName(PackageNamespace(""), "add")
      getlex              QName(PackageNamespace(""), "dbdaf")
      getproperty         QName(PackageNamespace(""), "y")
      getlex              QName(PackageNamespace(""), "dbdaf")
      getproperty         QName(PackageNamespace(""), "y")
      ${fc24}
      getproperty         QName(PackageNamespace(""), "w")
      callpropvoid        QName(PackageNamespace(""), "add"), 3

      `;
}

// ---------- B. fator 512/details no construtor do AnimatedPaintMaterial ----------
const CTOR_FRAMEH_RE = /(pushbyte\s+1\s+getlocal\s+5\s+divide\s+setproperty\s+QName\(PrivateNamespace\("alternativa\.tanks\.materials:AnimatedPaintMaterial"\), "frameHeight"\))/;
const factorBlock = (slot, dim) => `
      getlocal0
      getlocal0
      getproperty         ${slot}
      pushshort           512
      multiply
      getlocal3
      getproperty         ${dim}
      divide
      setproperty         ${slot}`;
const MARK_CTOR = 'pushshort           512\n      multiply\n      getlocal3';

const DRAW_TRANSP_RE = /name "drawTransparent"[\s\S]*?callsupervoid\s+QName\(Namespace\("http:\/\/alternativaplatform\.com\/en\/alternativa3d"\), "drawTransparent"\), 7/;
const GUARD_RE = /(getproperty\s+QName\(PrivateNamespace\("alternativa\.tanks\.materials:AnimatedPaintMaterial"\), "a4d5069f"\)\s*getlocal0\s*getproperty\s+QName\(PrivateNamespace\("alternativa\.tanks\.materials:AnimatedPaintMaterial"\), "b4f88b65"\)\s*)ifne(\s+)(L\d+)(\s*returnvoid)/;
// ---------- fase ABSOLUTA no update(): sincroniza TODAS as instâncias (carroceria + torreta) ----------
// Original acumula por instância: b4f88b65 += (dt/1000)*fps ; b4f88b65 %= numFrames — a fase depende de
// QUANDO o material nasceu, então trocar a torreta cria um material novo fora de fase com a carroceria.
// Novo: b4f88b65 = (now/1000*fps) % numFrames, derivado do relógio GLOBAL getTimer (local4 = now, já
// capturado no topo do update) → toda instância mostra o mesmo frame no mesmo instante. Também elimina o
// salto do 1º frame (não usa mais delta), substituindo a antiga guarda de delta.
const B65 = 'QName(PrivateNamespace("alternativa.tanks.materials:AnimatedPaintMaterial"), "b4f88b65")';
const FPS_S = 'QName(PrivateNamespace("alternativa.tanks.materials:AnimatedPaintMaterial"), "fps")';
const NF_S = 'QName(PrivateNamespace("alternativa.tanks.materials:AnimatedPaintMaterial"), "numFrames")';
const ACCUM_RE = new RegExp(
  'getlocal0\\s+getlocal0\\s+getproperty\\s+' + esc(B65) +
  '\\s+getlocal2\\s+pushshort\\s+1000\\s+divide\\s+getlocal0\\s+getproperty\\s+' + esc(FPS_S) +
  '\\s+multiply\\s+add\\s+setproperty\\s+' + esc(B65) +
  '\\s+getlocal0\\s+getlocal0\\s+getproperty\\s+' + esc(B65) +
  '\\s+getlocal0\\s+getproperty\\s+' + esc(NF_S) +
  '\\s+modulo\\s+setproperty\\s+' + esc(B65));
const ABS_BLOCK =
`getlocal0
      getlocal            4
      pushshort           1000
      divide
      getlocal0
      getproperty         ${FPS_S}
      multiply
      getlocal0
      getproperty         ${NF_S}
      modulo
      setproperty         ${B65}`;
const MARK_ABS = `multiply\n      getlocal0\n      getproperty         ${NF_S}\n      modulo`;

module.exports = {
  id: 'animated-paint-fullcover',
  swf: 'hardware',
  description: 'PaintFragmentShader ganha o frac-wrap por frame (= Game.swf); scale = 512/sheet; anima no spawn; fase absoluta (torreta/carroceria sincronizadas).',

  apply({ classes, log }) {
    let seenMat = false, seenFrag = false, edits = 0, already = 0;
    for (const c of classes) {
      // ---------- A: PaintFragmentShader ----------
      if (/instance QName\(PackageNamespace\("alternativa\.tanks\.materials"\), "PaintFragmentShader"\)/.test(c.text)) {
        seenFrag = true;
        let t = c.text;
        if (/pushbyte\s+24/.test(t)) {
          already++;
        } else {
          const mlMatch = t.match(FC_ML_RE);
          if (!mlMatch) throw new Error('fc[23] MultinameL não encontrada no PaintFragmentShader');
          const wrapped = t.replace(FIRST_TEX_RE, buildWrapBlock(mlMatch[1]) + '$1getlex              QName(PackageNamespace(""), "dbdaf")');
          if (wrapped !== t) { t = wrapped; edits++; }
        }
        if (t !== c.text) c.save(t);
        continue;
      }

      // ---------- B + demais: AnimatedPaintMaterial ----------
      if (!/instance QName\(PackageNamespace\("alternativa\.tanks\.materials"\), "AnimatedPaintMaterial"\)/.test(c.text)) continue;
      seenMat = true;
      let t = c.text;

      // B: scaleX/Y *= 512/details (local3)
      if (t.includes(MARK_CTOR)) {
        already++;
      } else {
        const x = t.replace(CTOR_FRAMEH_RE, '$1' + factorBlock(SCALEX, WIDTH) + factorBlock(SCALEY, HEIGHT));
        if (x !== t) { t = x; edits++; }
      }

      // drawTransparent chama update()
      const m = t.match(DRAW_TRANSP_RE);
      if (m) {
        if (new RegExp('callpropvoid\\s+' + esc(UPDATE) + ', 0').test(m[0])) { already++; }
        else {
          const patched = m[0].replace(/(pushscope[^\n]*\n)/, '$1      getlocal0\n      callpropvoid        ' + UPDATE + ', 0\n');
          t = t.replace(m[0], patched); edits++;
        }
      }

      // remove a guarda de early-return do update()
      const g = t.replace(GUARD_RE, '$1pop\n      pop\n      jump$2$3$4');
      if (g !== t) { t = g; edits++; } else if (/pop\n      pop\n      jump/.test(t)) already++;

      // fase ABSOLUTA no update() (sincroniza carroceria + torreta, sem salto de 1º frame)
      if (t.includes(MARK_ABS)) {
        already++;
      } else {
        const d = t.replace(ACCUM_RE, ABS_BLOCK);
        if (d !== t) { t = d; edits++; }
      }

      if (t !== c.text) c.save(t);
    }
    if (!seenMat) throw new Error('AnimatedPaintMaterial não encontrado (base é hardware.swf?)');
    if (!seenFrag) throw new Error('PaintFragmentShader não encontrado');
    if (edits === 0 && already >= 5) return { edits: 0, note: 'já aplicado' };
    if (edits !== 5) throw new Error(`esperava 5 edits, fez ${edits} (already=${already})`);
    log('frac-wrap no PaintFragmentShader + scale*512/details + spawn-anim edits');
    return { edits };
  },
};

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
