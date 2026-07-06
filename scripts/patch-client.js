#!/usr/bin/env node
/**
 * patch-client.js — sistema MODULAR de patches dos SWFs do cliente (RABCDAsm).
 * -------------------------------------------------------------------------
 * Cada patch vive em scripts/patches/<id>.js e exporta { id, swf?, description,
 * conflicts?, apply({classes, log}) }. `swf` (padrão "library") diz em QUAL SWF
 * o patch age (ex.: "hardware" p/ o AnimatedPaintMaterial). O runner processa
 * cada SWF alvo UMA vez: extrai/desmonta, aplica os patches daquele SWF, remonta
 * só os ABCs alterados, grava o artefato patcheado e (opcional) faz deploy.
 *
 * FLUXO por SWF <name> (pristine + artefato + deploy):
 *   resources/<name>.swf        -> BASE pristine (nunca patchada direto)
 *   resources/<name>-patch.swf  -> artefato patcheado
 *   .resource/<name>.swf        -> arquivo SERVIDO (alvo do deploy)
 *
 * Uso (ou via npm: patch:list / patch:client / patch:deploy):
 *   node scripts/patch-client.js --list
 *   node scripts/patch-client.js --all --deploy         # patch + deploy (todos os SWFs)
 *   node scripts/patch-client.js --only animated-paint-fullcover --deploy
 *   node scripts/patch-client.js --deploy-only          # move os -patch.swf p/ .resource
 *   node scripts/patch-client.js --ip <addr> [--port <n>]  # reescreve resources/config.xml (endereço do
 *       game server que o cliente conecta) + deploya em .resource; combina com qualquer modo ou roda só:
 *       npm run patch:deploy -- --ip 192.168.0.10
 * Overrides (só com UM SWF alvo): --base/--out/--deploy-to <swf>. Outros:
 *   --rabcdasm <dir>, --keep, --backup.
 *
 * ATENÇÃO À ORDEM: `npm run build:resources` copia resources/<name>.swf (pristine)
 * por cima de .resource/<name>.swf. Rode `npm run patch:deploy` DEPOIS do build.
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
const swfOf = (p) => p.swf || 'library';

function loadPatches() {
  return fs.readdirSync(PATCH_DIR)
    .filter((f) => f.endsWith('.js') && !f.startsWith('_'))
    .map((f) => require(path.join(PATCH_DIR, f)))
    .filter((p) => p && p.id && typeof p.apply === 'function');
}

function parseArgs(argv, patches) {
  const o = { rabcdasm: path.join(ROOT, 'tools', 'rabcdasm'), keep: false, backup: false,
    list: false, select: null, deploy: false, deployOnly: false, base: null, out: null, deployTo: null,
    ip: null, port: null };
  let only = null, except = null, all = false;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base' || a === '--in') o.base = path.resolve(argv[++i]);
    else if (a === '--out') o.out = path.resolve(argv[++i]);
    else if (a === '--deploy-to') o.deployTo = path.resolve(argv[++i]);
    else if (a === '--rabcdasm') o.rabcdasm = path.resolve(argv[++i]);
    else if (a === '--only') only = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--except') except = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--ip') o.ip = argv[++i];
    else if (a === '--port') o.port = argv[++i];
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

/** Rewrites the client bootstrap config.xml (game-server address/port) in resources/ AND deploys it to
 *  .resource/ — used by --ip/--port so pointing the client at another host is one flag away. */
function updateConfigXml(ip, port) {
  const src = path.join(ROOT, 'resources', 'config.xml');
  if (!fs.existsSync(src)) die('resources/config.xml nao existe');
  let xml = fs.readFileSync(src, 'utf8');
  if (ip) xml = xml.replace(/(<server address=")[^"]*(")/, `$1${ip}$2`);
  if (port) xml = xml.replace(/(<port>)[^<]*(<\/port>)/, `$1${port}$2`);
  fs.writeFileSync(src, xml);
  const dst = path.join(ROOT, '.resource', 'config.xml');
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  log(`config.xml atualizado (${ip ? 'address=' + ip : ''}${ip && port ? ', ' : ''}${port ? 'port=' + port : ''}) + deploy em .resource/`);
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

/** Patcheia UM swf com seus patches. Retorna true se gravou. */
function processSwf(o, swfName, swfPatches, base, out, deployTo) {
  for (const t of TOOLS) if (!fs.existsSync(toolPath(o.rabcdasm, t))) die('RABCDAsm ausente: ' + toolPath(o.rabcdasm, t));
  if (!fs.existsSync(base)) die('base nao existe: ' + base);
  log(`[${swfName}] base: ${base}  ->  out: ${out}`);
  log(`[${swfName}] patches: ${swfPatches.map((p) => p.id).join(', ')}`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cpatch-'));
  try {
    const workSwf = path.join(tmp, 'work.swf');
    fs.copyFileSync(base, workSwf);
    run(o.rabcdasm, 'abcexport', ['work.swf'], tmp);
    const abcs = fs.readdirSync(tmp).filter((f) => /^work-\d+\.abc$/.test(f)).sort();
    if (!abcs.length) die('abcexport nao gerou .abc');

    const changedAbc = new Set();
    const classes = [];
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
    for (const p of swfPatches) {
      const rec = new Set();
      let res;
      try { res = p.apply(api(rec)); } catch (e) { die(`patch "${p.id}": ${e.message}`); }
      for (const idx of rec) changedAbc.add(idx);
      log(`[${swfName}] ${p.id}: ${res.note || (res.edits + ' edit(s)')}`);
    }
    for (const c of classes) if (c.dirty) fs.writeFileSync(c.file, c.text, 'latin1');
    if (!changedAbc.size) { log(`[${swfName}] nenhuma alteracao (tudo ja aplicado?).`); }
    else {
      for (const idx of changedAbc) {
        run(o.rabcdasm, 'rabcasm', [path.join(`work-${idx}`, `work-${idx}.main.asasm`)], tmp);
        run(o.rabcdasm, 'abcreplace', ['work.swf', idx, path.join(`work-${idx}`, `work-${idx}.main.abc`)], tmp);
      }
    }
    if (o.backup && base === out && !fs.existsSync(out + '.bak')) { fs.copyFileSync(out, out + '.bak'); log('backup: ' + out + '.bak'); }
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.copyFileSync(workSwf, out);
    log(`[${swfName}] SWF salvo: ${out}`);
    if (o.deploy) deploy(out, deployTo);
  } finally {
    if (o.keep) log('temp: ' + tmp); else fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function main() {
  const patches = loadPatches();
  const o = parseArgs(process.argv, patches);

  // --ip/--port: rewrite + deploy the client bootstrap config.xml. Combines with any mode (patch,
  // deploy-only) or runs standalone (e.g. `npm run patch:deploy -- --ip 192.168.0.10`).
  if (o.ip || o.port) {
    updateConfigXml(o.ip, o.port);
    if (!o.select && !o.deployOnly && !o.list) return; // standalone config update
  }

  if (o.list || (!o.select && !o.deployOnly)) {
    console.log('Patches disponiveis:');
    for (const p of patches) console.log(`  ${p.id.padEnd(26)} [${swfOf(p).padEnd(8)}] ${p.description}${p.conflicts ? '  (conflita: ' + p.conflicts.join(',') + ')' : ''}`);
    if (!o.select) console.log('\nEscolha com --only <ids>, --except <ids> ou --all.');
    return;
  }

  const selected = patches.filter((p) => (o.select || patches.map((x) => x.id)).includes(p.id));
  // conflitos
  const selIds = selected.map((p) => p.id);
  for (const p of selected) for (const c of (p.conflicts || [])) if (selIds.includes(c)) die(`patches em conflito: ${p.id} x ${c}`);

  // agrupa por swf
  const bySwf = {};
  for (const p of selected) (bySwf[swfOf(p)] ||= []).push(p);
  const swfNames = Object.keys(bySwf);
  if ((o.base || o.out || o.deployTo) && swfNames.length > 1) die('--base/--out/--deploy-to só com UM SWF alvo (use --only)');

  if (o.deployOnly) {
    for (const name of swfNames) deploy(o.out || path.join(ROOT, 'resources', `${name}-patch.swf`), o.deployTo || path.join(ROOT, '.resource', `${name}.swf`));
    return;
  }

  for (const name of swfNames) {
    const base = o.base || path.join(ROOT, 'resources', `${name}.swf`);
    const out = o.out || path.join(ROOT, 'resources', `${name}-patch.swf`);
    const deployTo = o.deployTo || path.join(ROOT, '.resource', `${name}.swf`);
    processSwf(o, name, bySwf[name], base, out, deployTo);
  }
}

main();
