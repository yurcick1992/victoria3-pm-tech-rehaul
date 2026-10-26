// ERROR CLASSES OF SEVERAL RUNS, SIDE BY SIDE — the no-DLC load test's reader (FINDINGS F250, 2026-10-26).
// A CLASS is an error.log line without its timestamp, with every number, quoted string and handle reduced to a token, so one bug that fires on
// many countries is one class. Per run: non-empty lines and classes; the classes no other listed run has; and every line naming a file the mod
// emits (zzz_pm_rehaul*) or a vanilla-path file the mod REPLACES (any file under mod/ whose relative path also exists in the game folder),
// matched by relative path. Read each run's own mirror (<run>/logs_live/error.log), never the shared ring.
//   node tools/testbed/ledger/error_classes.mjs <label>=<path to error.log> [...] [--mod mod]
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const MOD = join(REPO, opt('--mod', 'mod'));
if (!existsSync(join(GAME, 'common'))) throw new Error(`no game folder at ${GAME} (set VIC3_GAME): the replaced-file list cannot be built`);
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const owned = walk(MOD).map(p => relative(MOD, p).replace(/\\/g, '/'))
  .filter(r => !r.startsWith('.metadata') && !/zzz_pm_rehaul/.test(r) && existsSync(join(GAME, r)));
console.log(`${relative(REPO, MOD)} replaces ${owned.length} vanilla-path files`);
const cls = l => l.replace(/^\[\d\d:\d\d:\d\d\]/, '').replace(/'[^']*'/g, "'S'").replace(/"[^"]*"/g, '"S"').replace(/\b\d+(\.\d+)*\b/g, 'N').replace(/\s+/g, ' ').trim();
const runs = args.filter((a, i) => a.includes('=') && !a.startsWith('--') && args[i - 1] !== '--mod').map(a => {
  const i = a.indexOf('='); const label = a.slice(0, i), path = a.slice(i + 1);
  const lines = readFileSync(path, 'utf8').split(/\r?\n/).filter(l => l.trim());
  const by = new Map(); for (const l of lines) { const c = cls(l); by.set(c, (by.get(c) || 0) + 1); }
  const ours = lines.filter(l => /zzz_pm_rehaul/.test(l) || owned.some(r => l.includes(r)));
  return { label, lines, by, ours }; });
if (runs.length < 2) throw new Error('give at least two runs as <label>=<error.log>: the reader compares');
for (const r of runs) console.log(`\n${r.label}: ${r.lines.length} lines, ${r.by.size} classes; lines naming a mod file or a replaced vanilla file: ${r.ours.length}`);
for (const r of runs) {
  const only = [...r.by].filter(([c]) => runs.every(o => o === r || !o.by.has(c))).sort((a, b) => b[1] - a[1]);
  console.log(`\n== classes only in ${r.label} (${only.length}):`);
  for (const [c, n] of only.slice(0, 40)) console.log(`  ${String(n).padStart(6)}  ${c.slice(0, 230)}`);
  if (only.length > 40) console.log(`  … ${only.length - 40} more`);
}
for (const r of runs) if (r.ours.length) {
  const by = new Map(); for (const l of r.ours) { const c = cls(l); by.set(c, (by.get(c) || 0) + 1); }
  console.log(`\n== ${r.label}: lines naming a mod file or a replaced vanilla file, by class:`);
  for (const [c, n] of [...by].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`  ${String(n).padStart(6)}  ${c.slice(0, 230)}`);
}
