// ⭐ TECHNOLOGY TIMING AGAINST THE NARRATIVE ONSET, ACROSS ARMS (2026-10-05, BALANCE_FRAMEWORK §10.95) — written for the extra research
// entries' batch (20261005_154629_jex-n16): are the technologies AHEAD of the same book without the entries, and of the canon?
//
//   node tools/testbed/ledger/tech_timing.mjs <label>=<session>[,<session>][:<setup>] [...] [--control <label>] [--cat production|military|society|all]
//        [--tree config/tech_tree_options.json] [--book <config with research_events.extra_entries>] [--techs a,b,c] [--all-techs]
//
// Per run and technology: the HALF-MAJORS YEAR = the first yearly summary in which at least half of the tech majors present hold it (the majors =
// lib_markets.resolveMembers: GBR, USA, FRA, the German state, NET, BEL, UNL where formed; held at the first summary counts as that year).
// Per arm: the median over its runs ("—" when fewer than half of its runs get there by 1936). ON TARGET = within ten years of the tree's narrative
// `onset`, either side (the user's ideal, 2026-10-05). With --control, each technology prints the control's per-run range and marks an arm's
// median OUTSIDE it (« earlier, » later) — the reading at small n; a pooled count over the whole tree carries more than any one technology.
// Only completed runs count (lib_runs.usableRuns). It reads the yearly save summaries' technologies_held; it never walks a book's industries.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { usableRuns } from './lib_runs.mjs';
import { resolveMembers } from './lib_markets.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const SES = join(REPO, 'tools/testbed/sessions');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const CAT = opt('--cat', 'production');
const TREE = JSON.parse(readFileSync(join(REPO, opt('--tree', 'config/tech_tree_options.json')), 'utf8')).options.find(o => o.ships);
const T = Object.fromEntries(TREE.techs.map(t => [t.id, t]));
const CONTROL = opt('--control', null);
const arms = args.filter((a, i) => a.includes('=') && !args[i - 1]?.startsWith('--')).map(a => {
  const [label, rest] = a.split('='); const [ses, setup = ''] = rest.split(':');
  const runs = ses.split(',').flatMap(s => usableRuns(SES, s, setup).runs);
  return { label, runs };
});
if (!arms.length) { console.error('usage: tech_timing.mjs <label>=<session>[,<session>][:<setup>] ... [--control <label>]'); process.exit(2); }
const BOOK = opt('--book', null);
const EXTRA = BOOK ? Object.keys((JSON.parse(readFileSync(join(REPO, BOOK), 'utf8')).research_events || {}).extra_entries || {}).filter(k => !k.startsWith('_')) : [];
const ERA1 = ['lathe', 'distillation', 'steelworking'];
let ids = TREE.techs.filter(t => CAT === 'all' || t.category === CAT).map(t => t.id);
if (opt('--techs', null)) ids = opt('--techs', '').split(',');

function readRun(r) {
  const dir = join(SES, r, 'save_summaries'); const out = [];
  if (!existsSync(dir)) return out;
  const seen = new Set();
  for (const f of readdirSync(dir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort()) {
    const j = JSON.parse(gunzipSync(readFileSync(join(dir, f))).toString());
    const y = +String(j.provenance.date).split('.')[0]; if (seen.has(y)) continue; seen.add(y);
    const mem = resolveMembers(j.countries);
    out.push({ y, held: Object.values(mem).map(tag => new Set(j.countries[tag].technologies_held || [])) });
  }
  return out.sort((a, b) => a.y - b.y);
}
const halfYear = (series, id) => { for (const s of series) { const n = s.held.length; if (n && s.held.filter(h => h.has(id)).length >= Math.ceil(n / 2)) return s.y; } return null; };
const med = a => { const s = a.slice().sort((x, y) => (x ?? 9999) - (y ?? 9999)); const v = s[Math.floor(s.length / 2)]; return s.length ? v : null; };
for (const a of arms) {
  a.series = a.runs.map(readRun).filter(s => s.length);
  a.half = Object.fromEntries(ids.map(id => [id, a.series.map(s => halfYear(s, id))]));
  a.med = Object.fromEntries(ids.map(id => [id, med(a.half[id])]));
  // technologies of the category held at the last summary, per major, median over majors and runs
  a.heldEnd = med(a.series.flatMap(s => s[s.length - 1].held.map(h => ids.filter(id => h.has(id)).length)));
  console.error(`${a.label}: ${a.series.length} run(s)`);
}
const ctl = CONTROL ? arms.find(a => a.label === CONTROL) : null;
const fmtY = y => y == null ? '—' : String(y);
const onT = (y, on) => y != null && Math.abs(y - on) <= 10;
const groupOf = id => EXTRA.includes(id) ? 'X' : ERA1.includes(id) ? '1' : ' ';
console.log(`${CAT} technologies, half-majors year (median over runs; — = under half the runs by 1936). X = an extra entry, 1 = era-1 rung entry.`);
console.log('   tech'.padEnd(31) + 'onset  ' + arms.map(a => a.label.padStart(8)).join(' ') + (ctl ? '   control range' : ''));
for (const id of ids.slice().sort((p, q) => (T[p].onset ?? 0) - (T[q].onset ?? 0) || p.localeCompare(q))) {
  const on = T[id].onset;
  const cells = arms.map(a => { const v = a.med[id]; let mark = onT(v, on) ? '✓' : ' ';
    if (ctl && a !== ctl) { const r = ctl.half[id].map(x => x ?? 9999); const lo = Math.min(...r), hi = Math.max(...r); const x = v ?? 9999; if (x < lo) mark += '«'; else if (x > hi) mark += '»'; }
    return (fmtY(v) + mark).padStart(8); });
  const rng = ctl ? (() => { const r = ctl.half[id]; const g = r.filter(x => x != null); return `${g.length ? Math.min(...g) : '—'}–${r.some(x => x == null) ? 'never' : Math.max(...g)}`; })() : '';
  console.log(` ${groupOf(id)} ${id.padEnd(28)}${String(on ?? '?').padEnd(7)}${cells.join(' ')}   ${rng}`);
}
// a technology whose onset is more than ten years before the 1836 start can never be on target: the summary counts the reachable ones
const REACH = ids.filter(id => (T[id].onset ?? 0) >= 1826 && (T[id].onset ?? 9999) <= 1926);
console.log(`\nsummary over the ${REACH.length} technologies whose onset is 1826–1926 (✓ = within ten years of it; a technology no major half holds by 1936 counts as late):`);
for (const a of arms) {
  const on = REACH.filter(id => onT(a.med[id], T[id].onset)).length;
  const early = REACH.filter(id => a.med[id] != null && a.med[id] < T[id].onset - 10).length;
  const late = REACH.length - on - early;
  const dev = REACH.map(id => a.med[id] == null ? null : a.med[id] - T[id].onset).filter(x => x != null);
  const ahead = ctl && a !== ctl ? ids.filter(id => (a.med[id] ?? 9999) < (ctl.med[id] ?? 9999)).length : null;
  const behind = ctl && a !== ctl ? ids.filter(id => (a.med[id] ?? 9999) > (ctl.med[id] ?? 9999)).length : null;
  const sub = (set) => { const xs = set.filter(id => ctl && a !== ctl && a.med[id] != null && ctl.med[id] != null).map(id => a.med[id] - ctl.med[id]); return xs.length ? `median shift ${med(xs)} y over ${xs.length}` : ''; };
  console.log(`  ${a.label.padEnd(10)} on target ${on}/${REACH.length} (early ${early}, late ${late}) · median (half-year − onset) ${med(dev) ?? '—'} y · held at the last summary ${a.heldEnd}/${ids.length} per major` +
    (ahead != null ? ` · vs ${ctl.label}: earlier ${ahead}, later ${behind}` + (EXTRA.length ? ` · extras ${sub(EXTRA)} · others ${sub(ids.filter(id => !EXTRA.includes(id) && !ERA1.includes(id)))}` : '') : ''));
}
