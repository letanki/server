'use strict';
/**
 * Helpers compartilhados pelos patches do cliente (ASASM / RABCDAsm).
 * Multinames copiados crus da disassembly do library.swf.
 */

// --- multinames (obfuscados) ---------------------------------------------
const IF_NATIVE = 'QName(PackageNamespace("521423162502316263123423632234"), "if native")';
const STATIC_COLORING_T = 'QName(PackageNamespace("implements use var"), "5214232504232517123423632234")';
const MULTIFRAME_T = 'QName(PackageNamespace("implements use var"), "finally for implements")';
const ICOLORING = 'Namespace("projects.tanks.clients.flash.commons.models.coloring:IColoring")';
const IS_ANIMATED = `QName(${ICOLORING}, "5214235758235771123423632234")`;
const ANIM_COLORING = `QName(${ICOLORING}, "super package extends")`;
const STATIC_COLORING_M = `QName(${ICOLORING}, "521423153202315333123423632234")`;
const VIEWER_FIELD = 'QName(PackageNamespace("", "#0"), "5214239080239093123423632234")';
const ANIM_METHOD = 'QName(PackageNamespace("", "#0"), "animColorLT")'; // metodo NOVO que adicionamos

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
const ind = (l) => (l.endsWith(':') ? l : '      ' + l);

// --- (A) mount routing: new IfNative(null, Static(res)) -> branch por tipo -
const MOUNT_RE = new RegExp(
  'findpropstrict\\s+' + esc(IF_NATIVE) + '\\s*' +
  'pushnull\\s*' +
  'getlex\\s+' + esc(STATIC_COLORING_T) + '\\s*' +
  'getglobalscope\\s*' +
  '(getlex\\s+QName\\(PrivateNamespace\\("projects\\.tanks\\.server\\.garage\\.models\\.garage:ServerGarageModel"\\), "521423104832310496123423632234"\\))\\s*' +
  '(getlex\\s+QName\\(PackageNamespace\\("5214232264232277123423632234"\\), "5214237893237906123423632234"\\))\\s*' +
  '(getlocal\\s+5)\\s*' +
  '(getproperty\\s+Multiname\\("coloring",[^\\n]*\\))\\s*' +
  '(callproperty\\s+QName\\(PackageNamespace\\("", "#0"\\), "for super static"\\), 1)\\s*' +
  '(callproperty\\s+QName\\(Namespace\\("platform\\.client\\.fp10\\.core\\.registry:ResourceRegistry"\\), "include for use"\\), 1)\\s*' +
  'call\\s+1\\s*' +
  'constructprop\\s+' + esc(IF_NATIVE) + ', 2',
  'g'
);

function patchMountRouting(text) {
  let n = 0;
  const out = text.replace(MOUNT_RE, (_m, gReg, gRid, gLoc, gCol, cFor, cInc) => {
    const i = n++, LS = `LstMount${i}`, LD = `LdnMount${i}`;
    return [
      'findpropstrict      ' + IF_NATIVE,
      gReg, gRid, gLoc, gCol, cFor, cInc,
      'dup',
      'istype              ' + MULTIFRAME_T,
      'iffalse             ' + LS,
      'pushnull',
      'constructprop       ' + IF_NATIVE + ', 2',
      'jump                ' + LD,
      LS + ':',
      'pushnull',
      'swap',
      'coerce              ' + STATIC_COLORING_T,
      'constructprop       ' + IF_NATIVE + ', 2',
      LD + ':',
    ].map(ind).join('\n');
  });
  return { text: out, count: n };
}

// --- (B) preview builder: branch isAnimated antes de staticColoring() -----
// Se a pintura e animada, chama viewer.animColorLT(anim) (setter animado real).
const BUILDER_RE = new RegExp(
  '(dup\\s*setlocal\\s+5\\s*)(callproperty\\s+' + esc(STATIC_COLORING_M) + ', 0)',
  'g'
);

function patchBuilder(text) {
  let n = 0;
  const out = text.replace(BUILDER_RE, (_m, head, tailCall) => {
    n++;
    const ins = [
      'getlocal            5',
      'callproperty        ' + IS_ANIMATED + ', 0',
      'iffalse             LnotAnimColor',
      'getlex              ' + VIEWER_FIELD,
      'getlocal            5',
      'callproperty        ' + ANIM_COLORING + ', 0',
      'callpropvoid        ' + ANIM_METHOD + ', 1',
      'pop',
      'jump                L158',
      'LnotAnimColor:',
    ].map(ind).join('\n');
    return head + '\n' + ins + '\n      ' + tailCall;
  });
  return { text: out, count: n };
}

// --- (C) adicionar metodo forwarder (v2) ----------------------------------
// Insere um `trait method` novo logo apos o `end ; trait` de um metodo ancora.
function insertTraitAfter(text, anchorMethodName, traitBlock) {
  const marker = `trait method QName(PackageNamespace("", "#0"), "${anchorMethodName}")`;
  const at = text.indexOf(marker);
  if (at < 0) return { text, count: 0 };
  const end = text.indexOf('end ; trait', at);
  if (end < 0) return { text, count: 0 };
  const insPos = text.indexOf('\n', end) + 1;
  return { text: text.slice(0, insPos) + traitBlock + '\n' + text.slice(insPos), count: 1 };
}

// forwarder em §if final§ (Tank3DViewer proxy): animColorLT(mf) -> preview.animColorLT(mf)
const IF_FINAL_ANIM = [
  '  trait method ' + ANIM_METHOD,
  '   method',
  '    name "animColorLT"',
  '    param ' + MULTIFRAME_T,
  '    returns QName(PackageNamespace("", "#0"), "void")',
  '    body',
  '     maxstack 2',
  '     localcount 2',
  '     initscopedepth 0',
  '     maxscopedepth 1',
  '     code',
  '      getlocal0',
  '      pushscope',
  '      getlocal0',
  '      getproperty         QName(PrivateNamespace("alternativa.tanks.model.garage:Tank3DViewer"), "52142373923752123423632234")',
  '      pushnull',
  '      ifeq                LskipIfFinalAnim',
  '      getlocal0',
  '      getproperty         QName(PrivateNamespace("alternativa.tanks.model.garage:Tank3DViewer"), "52142373923752123423632234")',
  '      getlocal1',
  '      callpropvoid        ' + ANIM_METHOD + ', 1',
  '     LskipIfFinalAnim:',
  '      returnvoid',
  '     end ; code',
  '    end ; body',
  '   end ; method',
  '  end ; trait',
].join('\n');

// forwarder em §5214237251237264§ (TankPreviewWindow): animColorLT(mf) -> tankPart.setTextureAnimation(mf); refresh
const PREVIEW_ANIM = [
  '  trait method ' + ANIM_METHOD,
  '   method',
  '    name "animColorLT"',
  '    param ' + MULTIFRAME_T,
  '    returns QName(PackageNamespace("", "#0"), "void")',
  '    body',
  '     maxstack 2',
  '     localcount 2',
  '     initscopedepth 0',
  '     maxscopedepth 1',
  '     code',
  '      getlocal0',
  '      pushscope',
  '      getlocal0',
  '      getproperty         QName(PrivateNamespace("alternativa.tanks.gui.tankpreview:TankPreviewWindow"), "5214238518238531123423632234")',
  '      getlocal1',
  '      callpropvoid        QName(PackageNamespace("", "#0"), "5214237380237393123423632234"), 1',
  '      getlocal0',
  '      callpropvoid        QName(PrivateNamespace("alternativa.tanks.gui.tankpreview:TankPreviewWindow"), "import package function"), 0',
  '      returnvoid',
  '     end ; code',
  '    end ; body',
  '   end ; method',
  '  end ; trait',
].join('\n');

module.exports = {
  patchMountRouting, patchBuilder, insertTraitAfter,
  IF_FINAL_ANIM, PREVIEW_ANIM,
  // matchers de classe
  isMountHandler: (t) => /name "initDepot"|name "initMarket"/.test(t),
  isBuilder: (t) => /instance QName\(PackageNamespace\("521423160592316072123423632234"\), "false const in"\)/.test(t),
  isIfFinal: (t) => /instance QName\(PackageNamespace\("521423115542311567123423632234"\), "if final"\)/.test(t),
  isPreview: (t) => /instance QName\(PackageNamespace\("5214234413234426123423632234"\), "5214237251237264123423632234"\)/.test(t),
};
