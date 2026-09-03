// ============================================================================================
// UI 2.0 — THE BALANCE SHEET, POINTED AT THE FOUR-RUNG BOOK.
//
// ⭐⭐ THIS IS THE OLD UI, NOT A LOOKALIKE (user-corrected 2026-08-29). The first attempt built a
// separate report page and gave it the sheet's colours; that is not what "the way the old UI looked"
// means. The sheet IS the UI — industry cards, a row per tier, editable input and output goods, the
// Number column, BE and profit, the workforce column, the scenario panel as a market screen, the
// preset bar, the ladder chart, the all-buildings explorer. So this tool ships `ui/builder.html`
// ITSELF, byte-for-byte, with a DIFFERENT data payload underneath it. One implementation of the
// sheet, two books — a second copy would drift within a week.
//
// What it swaps:
//   PMDATA.config   -> config/mod_config.tier4.json  (18 industries, 66 tier buildings)
//   PMDATA.inverse  -> config/era_inverse.tier4.json (the red `recipes: solver 2` button)
//   PMPRESETS       -> ui2/gen/presets.tier4.js, produced by
//                      `tools/extract_presets.ps1 -Config config/mod_config.tier4.json`
//                      (⚠ that script writes ui/presets.js — back it up and restore it, or run this
//                      tool with --refresh-presets, which does exactly that)
// and keeps ui/econ.js and ui/vanilla.js unchanged, because neither depends on which book is loaded.
//
//   node tools/build_ui2.mjs [--refresh-presets] [--out <path>] [--report <path>]
//
// Everything else — every button, every column, the Export that writes a mod_config.json back out —
// is the sheet's own code and behaves as it does there. "Build now" is inert in a detached copy (it
// POSTs to tools/ui.ps1), exactly as in balance_ui_snapshot.html.
//
// `--report` additionally writes the analysis page (obsolescence matrix, margin anchor, price paths);
// see buildReport() at the bottom. That page is a READING instrument and does not replace the sheet.
// ============================================================================================
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const UI = join(REPO, 'ui'), UI2 = join(REPO, 'ui2'), GEN = join(UI2, 'gen');
const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const abs = p => isAbsolute(p) ? p : join(REPO, p);

const SUFFIX = argOf('--suffix', 'tier4');
const CFG_PATH = abs(argOf('--config', `config/mod_config.${SUFFIX}.json`));
const INV_PATH = abs(argOf('--inverse', `config/era_inverse.${SUFFIX}.json`));
const MRG_PATH = abs(argOf('--margins', 'config/vanilla_margins_1836.json'));
const OUT = abs(argOf('--out', 'ui2/ladder_sheet.html'));
const REPORT = argv.includes('--report') ? abs(argOf('--report', 'ui2/ladder_workbench.html')) : null;
const PRESETS_GEN = join(GEN, `presets.${SUFFIX}.js`);

mkdirSync(GEN, { recursive: true });

// ---------------------------------------------------------------------------------------------
// the tier4 presets. extract_presets.ps1 writes ui/presets.js and takes no output path, so the only
// safe way to run it for another book is to move the canonical file aside and put it back. Guarded
// with try/finally: leaving the canonical presets replaced by another book's would be a silent,
// far-reaching corruption of the real sheet.
// ---------------------------------------------------------------------------------------------
if (argv.includes('--refresh-presets') || !existsSync(PRESETS_GEN)) {
  const live = join(UI, 'presets.js'), bak = join(UI, `presets.js.bak_ui2_${process.pid}`);
  const had = existsSync(live);
  if (had) copyFileSync(live, bak);
  try {
    console.log(`  running extract_presets.ps1 against ${CFG_PATH.replace(REPO, '').replace(/^[\\/]/, '')} …`);
    execFileSync('powershell', ['-ExecutionPolicy', 'Bypass', '-File', join(REPO, 'tools', 'extract_presets.ps1'),
      '-Config', CFG_PATH], { stdio: ['ignore', 'pipe', 'inherit'] });
    copyFileSync(live, PRESETS_GEN);
  } finally {
    if (had) { copyFileSync(bak, live); rmSync(bak, { force: true }); }
  }
}

// ---------------------------------------------------------------------------------------------
const read = p => readFileSync(p, 'utf8');
const loadWin = files => { const win = {}, ctx = vm.createContext({ window: win });
  for (const f of files) vm.runInContext(read(f), ctx, { filename: f }); return win; };

const base = loadWin([join(UI, 'data.js')]).PMDATA;      // for prices / techs / start_exceptions
// ⭐⭐ THE SHEET MUST NOT RENDER A BOOK IT CANNOT NAME (user-directed 2026-09-01). It is a SNAPSHOT, so
//   it necessarily carries a build-time copy of the config — and a copy that silently falls behind is
//   indistinguishable from a current one while being wrong about everything. Three refusals, all
//   BEFORE a byte is written, because a half-built sheet is the failure mode worth preventing:
//     1. the config must exist and parse;
//     2. the solver artifact must exist and parse — the sheet's prices, counts and presets come from
//        it, and without it the page would show a recipe book against no market at all;
//     3. the artifact must be NO OLDER than the config. That is the real staleness: edit the book,
//        skip the re-solve, and every scenario on the page describes the previous recipes.
//   ⚠ Deliberately an mtime comparison and not a hash: the question is "was this solved AFTER the book
//     last moved", which is an ordering question. `--allow-stale` overrides for a deliberate
//     mismatch (comparing a new book against an old solve), and says so in the banner.
for (const [what, p] of [['config', CFG_PATH], ['solver artifact', INV_PATH]]) {
  if (!existsSync(p)) throw new Error(`build_ui2: no ${what} at ${p} — the sheet would ship an unnamed book. `
    + `Pass --config/--inverse, or run era_inverse.mjs --write first.`);
  try { JSON.parse(read(p)); }
  catch (e) { throw new Error(`build_ui2: the ${what} at ${p} does not parse (${e.message}) — refusing to build.`); }
}
{
  const cfgM = statSync(CFG_PATH).mtimeMs, invM = statSync(INV_PATH).mtimeMs;
  const stale = invM < cfgM - 1000;
  if (stale && !argv.includes('--allow-stale'))
    throw new Error(`build_ui2: ${INV_PATH} is OLDER than ${CFG_PATH} by `
      + `${Math.round((cfgM - invM) / 1000)}s — the book moved after it was last solved, so every scenario `
      + `on the sheet would describe the PREVIOUS recipes. Re-run era_inverse.mjs --write, or pass `
      + `--allow-stale if the mismatch is deliberate.`);
  if (stale) console.log("  WARNING --allow-stale: the artifact predates the config; the scenarios are not this book’s recipes");
}
const CFG = JSON.parse(read(CFG_PATH));
let INV = null; try { INV = JSON.parse(read(INV_PATH)); } catch { }

const PMDATA = {
  generated: new Date().toISOString().replace('T', ', ').slice(0, 17) + ' UTC',
  config: CFG,
  prices: base.prices,
  techs: base.techs,
  inverse: INV ? { recipes: INV.recipes, mandate: INV.mandate, ladder_yields: INV.ladder_yields } : null,
  start_exceptions: base.start_exceptions,
};

// ---------------------------------------------------------------------------------------------
// bundle: builder.html with its four <script src> files inlined, same rule as tools/bundle_ui.mjs.
// ⚠ ui/icons.js is deliberately EXCLUDED — Paradox art, gitignored because the repo is public, and a
// bundled page is something you hand to someone. The scenario panel degrades to text-only good names.
// ---------------------------------------------------------------------------------------------
let html = read(join(UI, 'builder.html'));
const inline = {
  'econ.js': read(join(UI, 'econ.js')),
  'data.js': '// GENERATED by tools/build_ui2.mjs — the FOUR-RUNG book\nwindow.PMDATA = ' + JSON.stringify(PMDATA) + ';\n',
  'vanilla.js': read(join(UI, 'vanilla.js')),
  'presets.js': read(PRESETS_GEN),
};
const wanted = new Set(Object.keys(inline));
const seen = new Set();
html = html.replace(/[ \t]*<script src="([^"]+)"><\/script>\r?\n?/g, (m, src) => {
  if (src === 'icons.js') return `<!-- icons.js omitted: Paradox art, never redistributed -->\n`;
  if (!wanted.has(src)) throw new Error(`builder.html loads an unexpected <script src="${src}"> — add it to the inline list or omit it deliberately`);
  seen.add(src);
  return `<script>\n/* ==== ${src} (inlined) ==== */\n${inline[src]}\n</script>\n`;
});
for (const f of wanted) if (!seen.has(f)) throw new Error(`builder.html no longer loads ${f} — the bundle would ship without it`);

// the tech-tree page rides along in builder.html via window.__TECHTREE_HTML; we do NOT ship it (this
// book has no tech tree of its own yet), so the frame shows the sheet's own "not available" message.
// Say so where the reader will see it, rather than leaving a blank frame to be discovered.
const banner = `<script>
window.__UI2 = ${JSON.stringify({ suffix: SUFFIX, generated: PMDATA.generated,
  config: CFG_PATH.replace(REPO, '').replace(/^[\\/]/, ''),
  industries: CFG.industries.filter(i => !i.disabled).length,
  tiers: CFG.industries.filter(i => !i.disabled).reduce((a, i) => a + i.tiers.length, 0),
  vanilla: CFG.industries.filter(i => i.disabled).map(i => i.id) })};
document.addEventListener('DOMContentLoaded', function(){
  var u = window.__UI2, h = document.querySelector('header h1');
  if (h) h.textContent = 'PM & Tech Rehaul — Balance UI 2.0 · four-rung book';
  var b = document.createElement('div');
  b.style.cssText = 'padding:7px 16px;background:#222a36;border-bottom:1px solid #2e3947;color:#93a1b3;font-size:12px';
  b.innerHTML = '<b style="color:#e6ebf2">Four-rung book</b> — ' + u.industries + ' tiered industries, '
    + u.tiers + ' tier buildings, eras 1836 / 1875 / 1905 / 1940. Vanilla again (so they appear below, '
    + 'among the reference buildings, not as tier cards): <b style="color:#e6ebf2">' + u.vanilla.join(', ') + '</b>. '
    + 'Built ' + u.generated + ' from <code>' + u.config + '</code>. '
    + 'A DETACHED copy: <b>Build now</b> is inert (it POSTs to tools/ui.ps1), and there is no tech tree for this book yet. '
    // ⚠ Export is a download link, and the ARTIFACT VIEWER grants no download permission — the button
    // does nothing there, silently (CLAUDE.md, bundle_ui.mjs). Saying "Export works" flat would be a
    // lie in exactly the copy most people open, so the banner names both cases.
    + '<b>Export mod_config.json</b> works in a local or downloaded copy; in the published artifact the '
    + 'viewer blocks downloads, so it does nothing — download the page or use the served UI to get a file back.';
  document.body.insertBefore(b, document.querySelector('main'));
});
</script>`;
html = html.replace('</body>', banner + '\n</body>');
if (!html.includes('window.__UI2')) throw new Error('failed to inject the banner — builder.html has no </body>?');

writeFileSync(OUT, html);

// ---------------------------------------------------------------------------------------------
// …and an ARTIFACT-SAFE twin. A published artifact is wrapped in its own
// `<!doctype html><head>…</head><body>` skeleton, so the page must not bring its own document tags —
// shipping a full document produces nested <html>/<body> and a page that renders wrong in ways that
// are hard to see. Keep <title> and <style> (both legal in the wrapper's head), drop the rest.
// ---------------------------------------------------------------------------------------------
const ART = OUT.replace(/\.html$/, '.artifact.html');
let art = html
  .replace(/^﻿?<!DOCTYPE html>\s*/i, '')
  .replace(/<html[^>]*>\s*/i, '').replace(/<\/html>\s*$/i, '')
  .replace(/<head>\s*/i, '').replace(/<\/head>\s*/i, '')
  .replace(/<body[^>]*>\s*/i, '').replace(/<\/body>\s*/i, '')
  .replace(/<meta[^>]*>\s*/gi, '')
  // the sheet's own <title> is the canonical book's; in a gallery beside other artifacts this page
  // has to say WHICH book it is
  .replace(/<title>[^<]*<\/title>/i, '<title>Four-Rung Balance Sheet</title>');
for (const tag of ['<!DOCTYPE', '<html', '</html>', '<head>', '</head>', '<body', '</body>'])
  if (art.toLowerCase().includes(tag.toLowerCase())) throw new Error(`the artifact twin still carries ${tag} — the strip missed it`);
writeFileSync(ART, art);

const kb = p => (statSync(p).size / 1024).toFixed(0);
const on = CFG.industries.filter(i => !i.disabled);
console.log(`BALANCE SHEET → ${OUT.replace(REPO, '').replace(/^[\\/]/, '')}  (${kb(OUT)} KB)`);
console.log(`  ${on.length} tiered industries · ${on.reduce((a, i) => a + i.tiers.length, 0)} tier buildings`
  + ` · vanilla again: ${CFG.industries.filter(i => i.disabled).map(i => i.id).join(', ')}`);
console.log(`  presets: ${PRESETS_GEN.replace(REPO, '').replace(/^[\\/]/, '')}`
  + ` · recipes: solver 2 ${INV ? 'available' : 'ABSENT (button disabled)'}`);

// ============================================================================================
// the analysis page — a READING instrument beside the sheet, not a replacement for it
// ============================================================================================
if (REPORT) {
  const { buildReport } = await import('./build_ui2_report.mjs');
  buildReport({ REPO, INV, INV_PATH, MRG_PATH, CMP_PATH: join(REPO, 'config/era_inverse.json'), OUT: REPORT });
}
