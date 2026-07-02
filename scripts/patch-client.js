#!/usr/bin/env node
/**
 * patch-client.js — sistema MODULAR de patches do SWF do cliente (RABCDAsm).
 * -------------------------------------------------------------------------
 * Cada patch vive em scripts/patches/<id>.js e exporta { id, description,
 * conflicts?, apply({classes, log}) }. Este runner extrai/desmonta o SWF UMA
 * vez, aplica os patches escolhidos e remonta so os ABCs alterados.
 *
 * FLUXO (fonte pristine + artefato patcheado + deploy explicito):
 *   resources/library.swf         -> BASE pristine (nunca patchada direto)
 *   resources/library-patch.swf   -> artefato patcheado (--out)
 *   .resource/library.swf         -> arquivo SERVIDO (alvo do deploy)
 *
 * Uso (ou via npm: patch:list / patch:client / patch:deploy):
 *   node scripts/patch-client.js --list
 *   node scripts/patch-client.js --all --deploy        # patch + deploy
 *   node scripts/patch-client.js --only garage-animated-paint
 *   node scripts/patch-client.js --deploy-only         # so move library-patch.swf -> .resource
 * Flags: --base <swf> (padrao resources/library.swf), --out <swf> (padrao
 *        resources/library-patch.swf), --deploy-to <swf> (padrao .resource/library.swf),
 *        --deploy, --deploy-only, --rabcdasm <dir>, --keep, --backup.
 *
 * ATENCAO A ORDEM: `npm run build:resources` copia resources/library.swf (pristine)
 * por cima de .resource/library.swf. Rode `npm run patch:deploy` DEPOIS do build
 * para reservir o patcheado. Patches sao idempotentes e declaram `conflicts`.
 * -------------------------------------------------------------------------
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PATCH_DIR = path.join(__dirname, 'patches');
const TOOLS = ['abcexport', 'rabcdasm', 'rabcasm', 'abcreplace'];

function die(m) { console.error('ERRO: ' + m); process.exit(1); }
function log(m) { console.log('[patch] ' + m); }

function loadPatches() {
  return fs.readdirSync(PATCH_DIR)
    .filter((f) => f.endsWith('.js') && !f.startsWith('_'))
    .map((f) => require(path.join(PATCH_DIR, f)))
    .filter((p) => p && p.id && typeof p.apply === 'function');
}

function parseArgs(argv, patches) {
  const o = {
    // fonte PRISTINE (nunca patchada direto) e artefato patcheado (separado):
    base: path.join(ROOT, 'resources', 'library.swf'),
    out: path.join(ROOT, 'resources', 'library-patch.swf'),
    deployTo: path.join(ROOT, '.resource', 'library.swf'),
    rabcdasm: path.join(ROOT, 'tools', 'rabcdasm'),
    keep: false, backup: false, list: false, select: null, deploy: false, deployOnly: false,
  };
  let only = null, except = null, all = false;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base' || a === '--in') o.base = path.resolve(argv[++i]);
    else if (a === '--out') o.out = path.resolve(argv[++i]);
    else if (a === '--deploy-to') o.deployTo = path.resolve(argv[++i]);
    else if (a === '--rabcdasm') o.rabcdasm = path.resolve(argv[++i]);
    else if (a === '--only') only = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--except') except = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--all') all = true;
    else if (a === '--deploy') o.deploy = true;
    else if (a === '--deploy-only') o.deployOnly = true;
    else if (a === '--keep') o.keep = true;
    else if (a === '--backup') o.backup = true;
    else if (a === '--list') o.list = true;
    else die('opcao desconhecida: ' + a);
  }
  const ids = patches.map((p) => p.id);
  if (only) { for (const id of only) if (!ids.includes(id)) die('patch inexistente: ' + id); o.select = only; }
  else if (except) o.select = ids.filter((id) => !except.includes(id));
  else if (all) o.select = ids;
  return o;
}

function toolPath(dir, n) { return path.join(dir, n + (process.platform === 'win32' ? '.exe' : '')); }
function run(dir, tool, args, cwd) {
  try { return execFileSync(toolPath(dir, tool), args, { cwd, encoding: 'latin1', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { throw new Error(`${tool} falhou (exit ${e.status}):\n${((e.stdout || '') + (e.stderr || '')).trim()}`); }
}
function walk(dir, out = []) { for (const n of fs.readdirSync(dir)) { const f = path.join(dir, n); if (fs.statSync(f).isDirectory()) walk(f, out); else out.push(f); } return out; }

function deploy(src, dst) {
  if (!fs.existsSync(src)) die('artefato patcheado nao existe: ' + src + ' (rode o patch antes)');
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  log('deploy: ' + src + '  ->  ' + dst);
}

function main() {
  const patches = loadPatches();
  const o = parseArgs(process.argv, patches);

  if (o.deployOnly) { deploy(o.out, o.deployTo); return; }

  if (o.list || !o.select) {
    console.log('Patches disponiveis:');
    for (const p of patches) console.log(`  ${p.id.padEnd(28)} ${p.description}${p.conflicts ? '  [conflita: ' + p.conflicts.join(',') + ']' : ''}`);
    if (!o.select) console.log('\nEscolha com --only <ids>, --except <ids> ou --all.');
    return;
  }
  // conflitos
  const selected = patches.filter((p) => o.select.includes(p.id));
  for (const p of selected) for (const c of (p.conflicts || [])) if (o.select.includes(c)) die(`patches em conflito selecionados: ${p.id} x ${c}`);
  for (const t of TOOLS) if (!fs.existsSync(toolPath(o.rabcdasm, t))) die('RABCDAsm ausente: ' + toolPath(o.rabcdasm, t));
  if (!fs.existsSync(o.base)) die('base nao existe: ' + o.base);
  log('base: ' + o.base + '  ->  out: ' + o.out);
  log('patches: ' + selected.map((p) => p.id).join(', '));

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cpatch-'));
  try {
    const workSwf = path.join(tmp, 'work.swf');
    fs.copyFileSync(o.base, workSwf);
    run(o.rabcdasm, 'abcexport', ['work.swf'], tmp);
    const abcs = fs.readdirSync(tmp).filter((f) => /^work-\d+\.abc$/.test(f)).sort();
    if (!abcs.length) die('abcexport nao gerou .abc');

    // desmonta todos e monta o indice de classes
    const changedAbc = new Set();
    const classes = []; // { file, text, abcIdx, dirty }
    for (const abc of abcs) {
      const idx = abc.match(/^work-(\d+)\.abc$/)[1];
      run(o.rabcdasm, 'rabcdasm', [abc], tmp);
      for (const file of walk(path.join(tmp, `work-${idx}`)).filter((x) => x.endsWith('.class.asasm'))) {
        classes.push({ file, text: fs.readFileSync(file, 'latin1'), abcIdx: idx, dirty: false });
      }
    }
    const api = (rec) => ({
      classes: classes.map((c) => ({ get text() { return c.text; }, save(t) { c.text = t; c.dirty = true; rec.add(c.abcIdx); } })),
      log: (m) => log('  · ' + m),
    });

    for (const p of selected) {
      const rec = new Set();
      let res;
      try { res = p.apply(api(rec)); }
      catch (e) { die(`patch "${p.id}": ${e.message}`); }
      for (const idx of rec) changedAbc.add(idx);
      log(`${p.id}: ${res.note || (res.edits + ' edit(s)')}`);
    }

    // grava arquivos sujos e remonta os ABCs afetados
    for (const c of classes) if (c.dirty) fs.writeFileSync(c.file, c.text, 'latin1');
    if (!changedAbc.size) { log('nenhuma alteracao (tudo ja aplicado?). SWF nao regravado.'); return; }
    for (const idx of changedAbc) {
      run(o.rabcdasm, 'rabcasm', [path.join(`work-${idx}`, `work-${idx}.main.asasm`)], tmp);
      run(o.rabcdasm, 'abcreplace', ['work.swf', idx, path.join(`work-${idx}`, `work-${idx}.main.abc`)], tmp);
    }
    if (o.backup && o.base === o.out && !fs.existsSync(o.out + '.bak')) { fs.copyFileSync(o.out, o.out + '.bak'); log('backup: ' + o.out + '.bak'); }
    fs.mkdirSync(path.dirname(o.out), { recursive: true });
    fs.copyFileSync(workSwf, o.out);
    log('SWF salvo: ' + o.out + `  (ABCs remontados: ${[...changedAbc].join(',')})`);
    if (o.deploy) deploy(o.out, o.deployTo);
  } finally {
    if (o.keep) log('temp: ' + tmp); else fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main();
