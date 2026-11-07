// AUTO-DOWNSIZING IN THE LEDGER (BALANCE_FRAMEWORK §10.107.6, user-ruled 2026-11-07: two scorecard lines and one section). Reads
// <outDir>/downsize.json (downsize_telemetry.mjs --json, the mod arm and the vanilla arm; fill_ledger.sh writes it) and writes the section
// for both views: downsize_world.html and downsize_pool.html, spliced by fill_assemble.mjs as __DOWNSIZE_W__ / __DOWNSIZE_S__. The two
// scorecard lines (capital destroyed, possible workforce lost) are fill_scorecard.mjs's, from the same json.
//   Levels per decade by tier class (§10.107.2), mod / vanilla, mean a run; the century's levels, possible workforce and capital destroyed
//   beside them, never instead of them (§10.107.4). Vanilla = the vanilla runs that carried the downsizing poll (telemetry v15 on): an older
//   vanilla run has no poll and is left out, never read as zero.
//   node tools/testbed/ledger/fill_downsizing.mjs <outDir>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const DIR = process.argv[2];
if (!DIR) { console.error('usage: fill_downsizing.mjs <outDir>'); process.exit(2); }
const src = join(DIR, 'downsize.json');
const notRead = why => `<div class="card"><h3>Auto-downsizing</h3><p class="dim">Not read for this report (${why}).</p></div>`;
if (!existsSync(src)) {
  for (const f of ['downsize_world.html', 'downsize_pool.html']) writeFileSync(join(DIR, f), notRead('no downsize.json — run downsize_telemetry.mjs --json'));
  console.log('downsizing: no downsize.json, the section says so'); process.exit(0);
}
const D = JSON.parse(readFileSync(src, 'utf8'));
const arms = Object.entries(D).filter(([, a]) => a.n > 0);
const MOD = arms.find(([, a]) => a.kind === 'config'), VAN = arms.find(([, a]) => a.kind === 'control');
if (!MOD || !VAN) {
  for (const f of ['downsize_world.html', 'downsize_pool.html']) writeFileSync(join(DIR, f), notRead(!MOD ? 'no mod run carried the downsizing poll' : 'no vanilla run carried the downsizing poll'));
  console.log('downsizing: an arm without the poll, the section says so'); process.exit(0);
}
const [ml, m] = MOD, [, v] = VAN;
const CLS = ['t0 craft', 't0 non-craft', 't1', 't2', 't3', 'outside the ladder'];
const extra = [...new Set([...m.classes, ...v.classes])].filter(c => !CLS.includes(c));   // e.g. a vanilla industry with no known method
const COLS = [...CLS, ...extra];
const fin = Number.isFinite;
const n0 = x => fin(x) ? Math.round(x).toLocaleString('en-GB') : '—';
const k0 = x => fin(x) ? Math.round(x / 1e3).toLocaleString('en-GB') : '—';
const cell = (a, b, f = n0) => `<td class="num">${f(a)} <span class="dim">/ ${f(b)}</span></td>`;
const dec = (A, scope, d, c) => { const o = A.decades[scope][d]; if (!o) return 0; return c === 'all' ? Object.values(o).reduce((s, x) => s + x[0], 0) : (o[c] || [0])[0]; };
const tot = (A, scope, c, i) => (A.totals[scope][c] || { mean: [0, 0, 0] }).mean[i];
const DECS = [...new Set([...Object.keys(m.decades.world), ...Object.keys(v.decades.world)])].map(Number).sort((a, b) => a - b);

function section(scope) {
  const head = `<tr><th>decade</th>${[...COLS, 'all'].map(c => `<th class="num">${c === 'outside the ladder' ? 'outside the ladder' : c}</th>`).join('')}</tr>`;
  const rows = DECS.map(d => `<tr><td>${d}s</td>${[...COLS, 'all'].map(c => cell(dec(m, scope, d, c), dec(v, scope, d, c))).join('')}</tr>`);
  const sum = (label, i, f) => `<tr><td><b>${label}</b></td>${[...COLS, 'all'].map(c => cell(tot(m, scope, c, i), tot(v, scope, c, i), f)).join('')}</tr>`;
  const title = scope === 'pool' ? 'the shortlist' : 'world';
  const cap = [
    `Private levels lost to auto-downsizing (an under-staffed building that cannot hire loses a level a week), mean a run: <b>this batch (${m.n} runs) / vanilla (${v.n} runs)</b>. A vanilla building counts at the tier of the canon rung made from its active method; a merged host is split by its methods.`,
    'The century rows put the levels beside two like-for-like measures: the jobs those levels offered, and their construction cost.',
    'Gold fields, auto-scaling buildings (subsistence, urban centres, manor houses, financial districts, company and regional HQs) and non-economic ones are left out. A drop logged on 1 January counts in the year before.',
    scope === 'pool' ? 'Shortlist = Britain, the USA, France, the Netherlands, Belgium, the United Netherlands, Prussia, the North German Federation and Germany, placed by the country’s name (the drop record carries no tag), so a revolution under a shortlist country’s name counts with it. This table is the fixed shortlist; the country selection above does not change it.' : '',
  ].filter(Boolean).join(' ');
  return `<div class="card tablewrap">
  <h3>Plants shrunk by auto-downsizing, by tier <span class="dim">— ${title}</span></h3>
  <table>${head}${rows.join('')}${sum('century, levels', 0, n0)}${sum('century, jobs (thousands)', 1, k0)}${sum('century, construction points (thousands)', 2, k0)}</table>
  <p class="small">${cap}</p>
  </div>`;
}
writeFileSync(join(DIR, 'downsize_world.html'), section('world'));
writeFileSync(join(DIR, 'downsize_pool.html'), section('pool'));
const W = (A, i) => tot(A, 'world', 'all', i);
console.log(`downsizing: ${ml} ${m.n} runs, vanilla ${v.n} runs · world a run: levels ${n0(W(m, 0))} vs ${n0(W(v, 0))} · jobs ${k0(W(m, 1))}k vs ${k0(W(v, 1))}k · points ${k0(W(m, 2))}k vs ${k0(W(v, 2))}k`);
