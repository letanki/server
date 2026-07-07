#!/usr/bin/env node
'use strict';
/**
 * add-legend-rank.js — instala (ou reverte) TODO o lado-cliente do rank 31 "Lenda".
 * =========================================================================
 * O ícone de rank é um asset embutido no library.swf (não um resource) e o NOME vem
 * do localized.data. Este script único faz as quatro coisas necessárias:
 *
 *   1. IMAGENS   — embute BigRank31 (64x64) e SmallRank31 (15x15) como DefineBitsJPEG2
 *                  + SymbolClass, via ffdec (swf2xml -> injeta tags -> xml2swf).
 *   2. CLASSES   — cria as classes BitmapData BigRank31/SmallRank31 no ABC (senão o
 *                  cinit de DefaultRanksBitmaps dá ReferenceError #1065), via RABCDAsm.
 *   3. ARRAYS    — cresce os dois Vector<BitmapData> de DefaultRanksBitmaps e os dois
 *                  caches de 30->31 e acrescenta a entrada índice 30 (mesma passada ABC).
 *   4. NOMES     — acrescenta "Lenda"/"Legend"/"Легенда" à chave RANK_NAMES (CSV) nos
 *                  localized.data_<lang> (en/pt_BR/ru/ua), corrigindo o tamanho U32.
 *
 * IMPORTANTE: `resources/library.swf` é a BASE pristina e NUNCA é editada. As etapas
 * 1-3 rodam sobre uma CÓPIA temporária; em cima dela o patch-client aplica os demais
 * patches de library e grava o artefato (resources/library-patch.swf) + o servido
 * (.resource/library.swf). Só os localized.data (que não têm pipeline de patch) são
 * editados em resources/ e sincronizados para .resource/.
 *
 * NOTA: o lado-SERVIDOR (rank 31 em src/config/rank.data.ts + rank.service.ts + /whois)
 * é código TypeScript e NÃO é tocado por este script.
 *
 * Uso:
 *   node scripts/add-legend-rank.js            # instala (temp) + patch-client + deploy do library
 *   node scripts/add-legend-rank.js --no-deploy# prepara/reverte sem publicar (útil p/ inspeção)
 *   node scripts/add-legend-rank.js --revert   # reverte: rebuild do servido sem Lenda + localized
 * Flags: --base <library.swf>, --ffdec <cli>.  Sempre parte da base pristina (idempotente).
 * =========================================================================
 */
const zlib = require('zlib');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const RABCDASM = path.join(ROOT, 'tools', 'rabcdasm');
const PATCH_CLIENT = path.join(ROOT, 'scripts', 'patch-client.js');
const PATCH_DIR = path.join(ROOT, 'scripts', 'patches');

// --- identificadores do library.swf (crus da disassembly) ----------------
const PKG = '521423188942318907123423632234';            // pacote dos BigRank/SmallRank oficiais
const OVR = 'static set override';                        // pacote de DefaultRanksBitmaps + caches
const CLS_BITMAPS = '521423188122318825123423632234';     // forms.ranks.DefaultRanksBitmaps
const CLS_CACHE = '521423163702316383123423632234';       // cache de bitmaps (Vector fixos)
const ARR_SMALL = '521423112472311260123423632234';       // array1 = SmallRankNN
const ARR_BIG = '5214239796239809123423632234';           // array2 = BigRankNN
const ID_BIG = 441, ID_SMALL = 442;                        // > maior characterID (440) no oficial
const LOC_NAMES = { en: 'Legend', pt_BR: 'Lenda', ru: 'Легенда', ua: 'Легенда' };

// --- args ----------------------------------------------------------------
function arg(name, def) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; }
const REVERT = process.argv.includes('--revert');
const NO_DEPLOY = process.argv.includes('--no-deploy');
const BASE_SWF = path.resolve(arg('--base', path.join(ROOT, 'resources', 'library.swf')));
const FFDEC = arg('--ffdec', process.env.FFDEC || 'C:\\Program Files (x86)\\FFDec\\ffdec-cli.exe');
const ASSETS = path.join(ROOT, 'scripts', 'patches', 'assets', 'legend-rank');
const BIG_PNG = path.join(ASSETS, 'BigRank31.png');
const SMALL_PNG = path.join(ASSETS, 'SmallRank31.png');
const LOC_FILES = Object.keys(LOC_NAMES).map((l) => 'localized.data_' + l);

function die(m) { console.error('ERRO: ' + m); process.exit(1); }
function tool(n) { return path.join(RABCDASM, n + (process.platform === 'win32' ? '.exe' : '')); }
function run(exe, args, cwd) {
  try { return execFileSync(exe, args, { cwd, encoding: 'latin1', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { throw new Error(`${path.basename(exe)} falhou (exit ${e.status}):\n${((e.stdout || '') + (e.stderr || '')).trim()}`); }
}

// ids dos patches que agem no library.swf (para o patch-client rodar em cima do temp)
function libraryPatchIds() {
  return fs.readdirSync(PATCH_DIR)
    .filter((f) => f.endsWith('.js') && !f.startsWith('_'))
    .map((f) => { try { return require(path.join(PATCH_DIR, f)); } catch (_) { return null; } })
    .filter((p) => p && p.id && (p.swf || 'library') === 'library')
    .map((p) => p.id);
}

// =========================================================================
// (1) IMAGENS — ffdec swf2xml / xml2swf (opera sobre `swf`, um TEMP)
// =========================================================================
function embedImages(tmp, swf) {
  const xml = path.join(tmp, 'lib.xml'), xmlOut = path.join(tmp, 'lib_patched.xml');
  execFileSync(FFDEC, ['-swf2xml', swf, xml], { stdio: 'inherit' });
  let x = fs.readFileSync(xml, 'utf8');
  const hexBig = fs.readFileSync(BIG_PNG).toString('hex');
  const hexSmall = fs.readFileSync(SMALL_PNG).toString('hex');
  const tagBig = `    <item type="DefineBitsJPEG2Tag" characterID="${ID_BIG}" forceWriteAsLong="true" imageData="${hexBig}"/>\n`;
  const tagSmall = `    <item type="DefineBitsJPEG2Tag" characterID="${ID_SMALL}" forceWriteAsLong="true" imageData="${hexSmall}"/>\n`;
  let sc = x.indexOf('<item type="SymbolClassTag"');
  if (sc < 0) die('SymbolClassTag não encontrado');
  x = x.slice(0, sc) + tagBig + tagSmall + x.slice(sc);
  sc = x.indexOf('<item type="SymbolClassTag"');
  const tc = x.indexOf('</tags>', sc);
  x = x.slice(0, tc) + `        <item>${ID_BIG}</item>\n        <item>${ID_SMALL}</item>\n        ` + x.slice(tc);
  const nc = x.indexOf('</names>', sc);
  x = x.slice(0, nc) + `        <item>${PKG}.BigRank31</item>\n        <item>${PKG}.SmallRank31</item>\n        ` + x.slice(nc);
  fs.writeFileSync(xmlOut, x);
  execFileSync(FFDEC, ['-xml2swf', xmlOut, swf], { stdio: 'inherit' });
  console.log('[1/4] imagens BigRank31/SmallRank31 embutidas (+SymbolClass)');
}

// --- ASASM de uma classe BitmapData de rank (espelha as oficiais) --------
function classAsasm(cls, linkage) {
  return `class
 refid "${PKG}:${cls}"
 instance QName(PackageNamespace("${PKG}"), "${cls}")
  extends QName(PackageNamespace("flash.display"), "BitmapData")
  flag SEALED
  iinit
   name "${linkage}"
   refid "${PKG}:${cls}/instance/init"
   param QName(PackageNamespace("", "#0"), "int")
   param QName(PackageNamespace("", "#0"), "int")
   body
    maxstack 3
    localcount 3
    initscopedepth 0
    maxscopedepth 1
    code
     getlocal0
     pushscope
     getlocal0
     getlocal1
     getlocal2
     constructsuper      2
     returnvoid
    end ; code
   end ; body
  end ; method
 end ; instance
 cinit
  refid "${PKG}:${cls}/class/init"
  body
   maxstack 0
   localcount 1
   initscopedepth 0
   maxscopedepth 0
   code
    returnvoid
   end ; code
  end ; body
 end ; method
end ; class
`;
}
function scriptAsasm(cls) {
  return `script
 sinit
  refid "${PKG}:${cls}/init"
  body
   maxstack 3
   localcount 1
   initscopedepth 0
   maxscopedepth 3
   code
    getlocal0
    pushscope
    getscopeobject      0
    getlex              QName(PackageNamespace("", "#0"), "Object")
    pushscope
    getlex              QName(PackageNamespace("flash.display"), "BitmapData")
    dup
    pushscope
    newclass            "${PKG}:${cls}"
    popscope
    popscope
    initproperty        QName(PackageNamespace("${PKG}"), "${cls}")
    returnvoid
   end ; code
  end ; body
 end ; method
 trait class QName(PackageNamespace("${PKG}"), "${cls}")
  #include "${cls}.class.asasm"
 end ; trait
end ; script
`;
}

// --- (3) crescer um array 30->31 + inserir a entrada índice 30 -----------
function growArray(text, arrName, className) {
  const spMatch = text.match(/setproperty +MultinameL\(\[PrivateNamespace\("forms\.ranks:DefaultRanksBitmaps"\)[^\n]*\)/);
  if (!spMatch) throw new Error('setproperty (MultinameL) de DefaultRanksBitmaps não encontrado');
  const entry = [
    '    dup',
    '    pushbyte            30',
    `    findpropstrict      QName(PackageNamespace("${PKG}"), "${className}")`,
    '    pushbyte            0',
    '    pushbyte            0',
    `    constructprop       QName(PackageNamespace("${PKG}"), "${className}"), 2`,
    '    ' + spMatch[0],
    '',
  ].join('\n');
  const storeRe = new RegExp('(\\n\\s*findproperty +QName\\(PackageNamespace\\("", "#0"\\), "' + arrName + '"\\))');
  if (!storeRe.test(text)) throw new Error('store (findproperty) do array ' + arrName + ' não encontrado');
  return text.replace(storeRe, '\n' + entry + '$1');
}

// =========================================================================
// (2)+(3) CLASSES + ARRAYS — uma passada RABCDAsm (opera sobre `swf`, um TEMP)
// =========================================================================
function patchAbc(tmp, swf) {
  for (const t of ['abcexport', 'rabcdasm', 'rabcasm', 'abcreplace']) if (!fs.existsSync(tool(t))) die('RABCDAsm ausente: ' + tool(t));
  const work = path.join(tmp, 'work.swf');
  fs.copyFileSync(swf, work);
  run(tool('abcexport'), ['work.swf'], tmp);
  const abcs = fs.readdirSync(tmp).filter((f) => /^work-\d+\.abc$/.test(f)).sort();
  if (!abcs.length) die('abcexport não gerou .abc');
  let idx = null, root = null;
  for (const abc of abcs) {
    const i = abc.match(/^work-(\d+)\.abc$/)[1];
    run(tool('rabcdasm'), [abc], tmp);
    if (fs.existsSync(path.join(tmp, `work-${i}`, PKG))) { idx = i; root = path.join(tmp, `work-${i}`); break; }
  }
  if (!idx) die('ABC do pacote ' + PKG + ' não encontrado');
  const pkgDir = path.join(root, PKG);
  const enc = (s) => s.replace(/ /g, '%20');
  const bitmapsFile = path.join(root, enc(OVR), CLS_BITMAPS + '.class.asasm');
  const cacheFile = path.join(root, enc(OVR), CLS_CACHE + '.class.asasm');
  const mainFile = path.join(root, `work-${idx}.main.asasm`);

  // (2) classes ABC + includes no main
  const defs = [['BigRank31', 'BigRank31Bd'], ['SmallRank31', 'SmallRank31Bd']];
  for (const [cls, link] of defs) {
    fs.writeFileSync(path.join(pkgDir, `${cls}.class.asasm`), classAsasm(cls, link), 'latin1');
    fs.writeFileSync(path.join(pkgDir, `${cls}.script.asasm`), scriptAsasm(cls), 'latin1');
  }
  let main = fs.readFileSync(mainFile, 'latin1');
  const inc = defs.map(([cls]) => ` #include "${PKG}/${cls}.script.asasm"`).join('\n') + '\n';
  const anchor = main.lastIndexOf(`#include "${PKG}/`);
  const lineEnd = main.indexOf('\n', anchor) + 1;
  fs.writeFileSync(mainFile, main.slice(0, lineEnd) + inc + main.slice(lineEnd), 'latin1');

  // (3) arrays 30->31 (small+big) + caches 30->31
  let bt = fs.readFileSync(bitmapsFile, 'latin1');
  bt = growArray(bt, ARR_SMALL, 'SmallRank31');
  bt = growArray(bt, ARR_BIG, 'BigRank31');
  bt = bt.replace(/pushbyte(\s+)30(\s*\n\s*construct\s+1)/g, 'pushbyte$131$2');
  fs.writeFileSync(bitmapsFile, bt, 'latin1');
  const ct = fs.readFileSync(cacheFile, 'latin1').replace(/pushbyte(\s+)30(\s*\n\s*construct\s+1)/g, 'pushbyte$131$2');
  fs.writeFileSync(cacheFile, ct, 'latin1');

  run(tool('rabcasm'), [path.join(`work-${idx}`, `work-${idx}.main.asasm`)], tmp);
  run(tool('abcreplace'), ['work.swf', idx, path.join(`work-${idx}`, `work-${idx}.main.abc`)], tmp);
  fs.copyFileSync(work, swf);
  console.log('[2-3/4] classes ABC + arrays/caches 30->31');
}

// =========================================================================
// (4) NOMES — localized.data RANK_NAMES (resources/ + sync .resource/)
// =========================================================================
function patchLocalized() {
  const KEY = Buffer.from('RANK_NAMES');
  for (const [lang, name] of Object.entries(LOC_NAMES)) {
    const rel = 'localized.data_' + lang;
    const src = path.join(ROOT, 'resources', rel);
    if (!fs.existsSync(src)) { console.log('[4/4] ' + lang + ': ausente'); continue; }
    const d = zlib.inflateSync(fs.readFileSync(src));
    const i = d.indexOf(KEY);
    if (i < 0) { console.log('[4/4] ' + lang + ': sem RANK_NAMES'); continue; }
    const ke = i + KEY.length, len = d.readUInt32BE(ke + 1), valStart = ke + 5;
    const val = d.slice(valStart, valStart + len);
    if (val.toString('utf8').split(',').includes(name)) { syncResource(rel); continue; }
    const add = Buffer.from(',' + name, 'utf8');
    const out = Buffer.concat([d.slice(0, ke + 1), Buffer.alloc(4), val, add, d.slice(valStart + len)]);
    out.writeUInt32BE(len + add.length, ke + 1);
    fs.writeFileSync(src, zlib.deflateSync(out));
    syncResource(rel);
    console.log('[4/4] ' + lang + ': +"' + name + '"');
  }
}
function syncResource(rel) {
  const src = path.join(ROOT, 'resources', rel), dst = path.join(ROOT, '.resource', rel);
  if (fs.existsSync(path.dirname(dst))) fs.copyFileSync(src, dst);
}

// =========================================================================
function installPatchClient(baseSwf) {
  const ids = libraryPatchIds();
  console.log('[deploy] patch-client (base temp) --only ' + ids.join(',') + ' --deploy...');
  execFileSync(process.execPath, [PATCH_CLIENT, '--only', ids.join(','), '--base', baseSwf, '--deploy'], { stdio: 'inherit' });
}

// REVERT: sem Lenda. library.swf nunca foi editado, então basta reconstruir o servido
// a partir da base pristina (patch-client normal) e restaurar os localized.
function revert() {
  console.log('[revert] restaurando localized + rebuild do servido...');
  execFileSync('git', ['checkout', '--', ...LOC_FILES.map((f) => 'resources/' + f)], { cwd: ROOT, stdio: 'inherit' });
  for (const f of LOC_FILES) syncResource(f);
  if (!NO_DEPLOY) execFileSync(process.execPath, [PATCH_CLIENT, '--all', '--deploy'], { stdio: 'inherit' });
  console.log('[revert] pronto — cliente sem Lenda (base intocada; servidor TS não é tocado).');
}

// =========================================================================
function main() {
  for (const p of [BASE_SWF, FFDEC, BIG_PNG, SMALL_PNG]) if (!fs.existsSync(p)) die('não encontrado: ' + p);
  if (REVERT) return revert();

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'legend-rank-'));
  try {
    // CÓPIA temporária da base pristina — a base resources/library.swf NUNCA é escrita.
    const prepared = path.join(tmp, 'library-prepared.swf');
    fs.copyFileSync(BASE_SWF, prepared);
    embedImages(tmp, prepared);
    patchAbc(tmp, prepared);
    console.log('[ok] base temporária preparada com o rank 31.');
    if (!NO_DEPLOY) installPatchClient(prepared);
    else console.log('[ok] --no-deploy: base temp descartada; rode sem --no-deploy para publicar.');
  } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} }
  patchLocalized();
  console.log('[ok] rank 31 "Lenda" ' + (NO_DEPLOY ? 'preparado (localized aplicado)' : 'publicado em .resource/'));
}
main();
