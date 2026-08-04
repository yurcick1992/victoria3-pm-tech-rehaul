// Fold ui/builder.html and its generated data files into ONE self-contained page — the balance sheet
// as a single file that runs with no server, no build step and no network, for reading and tuning in a
// remote session.
//
//   node tools/bundle_ui.mjs                     # -> balance_ui_snapshot.html at the repo root
//   node tools/bundle_ui.mjs --out <path>        # somewhere else
//   node tools/bundle_ui.mjs --stale-ok          # build anyway when ui/ is older than the config
//
// or double-click balance-snapshot.cmd.
//
// IT IS A SNAPSHOT, NOT A MIRROR. It carries the config as it stood when the file was written, and the
// page says so in a banner with its own timestamp — because the failure mode of a detached copy is
// someone reading last week's numbers and believing them. Regenerate rather than trusting an old one.
//
// ⚠ ONCE PUBLISHED IN A SESSION, REGENERATE AND REPUBLISH AFTER EVERY CHANGE THAT ALTERS WHAT IT SHOWS —
// a solver `--write`, a build, or an edit to ui/builder.html or ui/econ.js. See CLAUDE.md → "Published UI
// snapshot". A stale snapshot reads as authoritative and gives its reader no way to tell.
//
// ⚠ ui/icons.js IS DELIBERATELY EXCLUDED, and this is not a size decision. It is Paradox art converted
// from the game's .dds files, gitignored precisely because the repo is public (see .gitignore), and a
// snapshot is something you hand to someone else — so shipping it here would leak exactly what that
// rule exists to prevent. The scenario panel already falls back to text-only good names when
// window.PMICONS is absent, so nothing breaks and the rows stay aligned.
//
// ⚠ "Build now" cannot work in a detached copy — it POSTs to tools/ui.ps1 — so it is disabled here with
// a hover explaining why, rather than left to fail at the click. Export mod_config.json still works, so
// the round trip is: tune in the snapshot, export, bring the file back.
import { readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const UI = join(REPO, 'ui');

const argv = process.argv.slice(2);
const argOf = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const OUT = resolve(argOf('--out') || join(REPO, 'balance_ui_snapshot.html'));
const STALE_OK = argv.includes('--stale-ok');

// The generated files builder.html pulls in, in its own order. Named explicitly rather than globbed:
// a new <script src> appearing in builder.html should FAIL here (below) rather than be silently dropped
// from the bundle, which would produce a page that loads and is quietly missing a whole data set.
// econ.js is HAND-AUTHORED rather than generated, but it is loaded the same way and the snapshot needs
// it — the Ladder check panel calls PMECON.ladderFaults().
const INLINE = ['econ.js', 'data.js', 'vanilla.js', 'presets.js'];
// ...and only the GENERATED ones can be stale against the config. Checking econ.js too made editing the
// model — which does not touch config/mod_config.json — look like an out-of-date build.
const GENERATED = ['data.js', 'vanilla.js', 'presets.js'];
const OMIT = [{ file: 'icons.js', why: 'Paradox art (.gitignore\'d) — never redistributed' }];

// ---- staleness: ui/*.js are BUILD OUTPUT, so a snapshot taken without building first ships whatever
// the last build left behind. Cheap to check, and the whole point of the file is to be trusted remotely.
const cfg = join(REPO, 'config', 'mod_config.json');
if (existsSync(cfg)) {
  const cfgAt = statSync(cfg).mtimeMs;
  const stale = GENERATED.filter(f => existsSync(join(UI, f)) && statSync(join(UI, f)).mtimeMs < cfgAt);
  if (stale.length) {
    const msg = `ui/${stale.join(', ui/')} ${stale.length > 1 ? 'are' : 'is'} OLDER than config/mod_config.json`;
    if (!STALE_OK) {
      console.error(`\nSTALE: ${msg}.\n`
        + `The snapshot would ship the previous build's numbers. Run the builder first:\n`
        + `    powershell -ExecutionPolicy Bypass -File tools\\build.ps1\n`
        + `...or pass --stale-ok if that is genuinely what you want.\n`);
      process.exit(1);
    }
    console.warn(`WARNING: ${msg} — bundling anyway (--stale-ok).`);
  }
}

let html = readFileSync(join(UI, 'builder.html'), 'utf8');
const sizes = [];
for (const f of INLINE) {
  const tag = `<script src="${f}"></script>`;
  if (!html.includes(tag)) {
    console.error(`\nbuilder.html does not load "${f}" any more (expected \`${tag}\`).\n`
      + `tools/bundle_ui.mjs lists its data files explicitly so that a change here is a loud failure\n`
      + `rather than a page that silently ships without one. Update INLINE and re-run.\n`);
    process.exit(1);
  }
  const src = readFileSync(join(UI, f), 'utf8');
  sizes.push([f, src.length]);
  html = html.replace(tag, `<script>\n/* inlined from ui/${f} */\n${src}\n</script>`);
}
// Anything builder.html loads that we did NOT plan for: fail rather than emit a half-empty page.
const leftover = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1])
  .filter(f => !OMIT.some(o => o.file === f));
if (leftover.length) {
  console.error(`\nbuilder.html loads unexpected script(s): ${leftover.join(', ')}.\n`
    + `Add them to INLINE (or to OMIT with a reason) in tools/bundle_ui.mjs and re-run.\n`);
  process.exit(1);
}
for (const o of OMIT) html = html.replace(`<script src="${o.file}"></script>`, `<!-- ${o.file} omitted: ${o.why} -->`);

// The Artifact host (and any plain wrapper) supplies <!doctype>, <html>, <head> and <body>; emit only
// the page CONTENT, keeping <title> and the stylesheet.
html = html
  .replace(/^[\s\S]*?<head>\s*/i, '')
  .replace(/<meta[^>]*>\s*/gi, '')
  .replace(/<\/head>\s*<body>/i, '')
  .replace(/<\/body>\s*<\/html>\s*$/i, '');

const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
html += `
<script>
/* added by tools/bundle_ui.mjs — standalone-copy adjustments */
(function () {
  var b = document.getElementById('buildNow');
  if (b) {
    b.disabled = true;
    b.style.opacity = .45; b.style.cursor = 'not-allowed';
    b.title = 'Disabled in the standalone snapshot — Build now needs the local tools/ui.ps1 server';
  }
  var note = document.createElement('div');
  note.style.cssText = 'margin:.6rem 0 1rem;padding:.6rem .8rem;border:1px solid var(--line);'
    + 'border-left:3px solid var(--warn);border-radius:0 4px 4px 0;background:var(--panel);'
    + 'color:var(--muted);font-size:.85rem;line-height:1.5';
  note.innerHTML = '<b style="color:var(--ink)">Standalone snapshot — ${stamp}</b><br>'
    + 'A detached copy of the sheet, for reading and tuning away from the machine. Everything computes '
    + 'live (presets, prices, profitability, the payback and BE tools) and <b>Export mod_config.json</b> '
    + 'works. <b>Build now is disabled</b> — it needs the local <code>tools/ui.ps1</code> server. Goods '
    + 'pictograms are omitted, so the scenario panel shows text-only rows. '
    + 'It does <b>not</b> follow later solver runs: regenerate with <code>balance-snapshot.cmd</code>.';
  var main = document.querySelector('main');
  if (main) main.insertBefore(note, main.firstChild);
})();
</script>`;

writeFileSync(OUT, html, 'utf8');
const mb = n => (n / 1048576).toFixed(2) + ' MB';
console.log(`\nSNAPSHOT WRITTEN  ${OUT}  (${mb(Buffer.byteLength(html))})`);
for (const [f, n] of sizes) console.log(`    inlined  ui/${f.padEnd(12)} ${mb(n)}`);
for (const o of OMIT)       console.log(`    omitted  ui/${o.file.padEnd(12)} ${o.why}`);
console.log(`\nOpen it in any browser, or hand it to someone — it needs no server and no network.\n`);
