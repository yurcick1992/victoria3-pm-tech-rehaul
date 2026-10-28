// dead_gates.mjs — a rung whose gate technology NO country holds at the campaign end, in ANY run of the arm: dead content.
//
//   node tools/testbed/ledger/dead_gates.mjs --arm <session[,session]>[:<setup>] [--config <book>]      (exit 1 on a dead gate)
//
// ⭐ WHY (BUGS_AND_FIXES 2026-08-30): two technologies the tier-4 tree had added were researched by nobody in any run, so four frontier
// rungs existed in the files, passed every linter and could never be built. Nothing flagged it. A tier's anchor sits AFTER 1936 for t3
// (CLAUDE.md §2.2), so a t3 gate held by nobody in ONE run is expected; the defect is a gate held by nobody in EVERY run, pooled.
// Read beside the ledger, not in preflight: it needs the arm's whole set of runs.
//
// The book: --config, else the first run's build_state.json (built_from_config), else the session's schedule.json for the setup.
// The end state: each run's newest save summary (`technologies_held` per country; every summary version carries it).
// Prints every gate with the runs holding it and the median number of holders; FAILs on the gates no run holds.
import { readFileSync, existsSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { indexRun, readSum, med, ROOT, SESSIONS } from './lib_sumidx.mjs';
import { usableRuns, reportDropped } from './lib_runs.mjs';

const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ARM = argOf('--arm', null);
if (!ARM) { console.error('usage: dead_gates.mjs --arm <session[,session]>[:<setup>] [--config <book>]'); process.exit(2); }
const cut = ARM.lastIndexOf(':');
const [sessions, setup] = cut > 0 && !/^[A-Za-z]:\\/.test(ARM.slice(cut - 1)) ? [ARM.slice(0, cut), ARM.slice(cut + 1)] : [ARM, ''];
const { runs, dropped } = usableRuns(SESSIONS, sessions, setup);
reportDropped(dropped);
if (!runs.length) { console.error(`dead_gates: no usable run in ${ARM}`); process.exit(2); }

function bookOf() {
  const c = argOf('--config', null);
  if (c) return isAbsolute(c) ? c : join(ROOT, c);
  const bs = join(SESSIONS, runs[0], 'build_state.json');
  if (existsSync(bs)) { const p = JSON.parse(readFileSync(bs, 'utf8')).deterministic?.mod_under_test?.built_from_config; if (p && existsSync(p)) return p; }
  const sch = join(SESSIONS, runs[0].split('/')[0], 'schedule.json');
  const st = runs[0].split('/')[1].replace(/^run\d+_/, '');
  if (existsSync(sch)) { const p = JSON.parse(readFileSync(sch, 'utf8')).setups?.[st]?.config; if (p) return join(ROOT, p); }
  throw new Error(`dead_gates: no book for ${runs[0]} - pass --config`);
}
const BOOK = bookOf();
const cfg = JSON.parse(readFileSync(BOOK, 'utf8'));
const gates = new Map();   // tech -> [rung labels]
for (const ind of cfg.industries || []) {
  if (ind.disabled) continue;   // L27: a disabled industry is vanilla's
  for (const t of ind.tiers || []) if (t.tech) (gates.get(t.tech) ?? gates.set(t.tech, []).get(t.tech)).push(`${ind.id} t${t.era}${t.method_of ? ' (merged)' : ''}`);
}

const per = new Map([...gates.keys()].map(k => [k, []]));   // tech -> holders per run
for (const rel of runs) {
  const idx = indexRun(join(SESSIONS, rel)); const last = Object.keys(idx).sort((a, b) => {
    const p = s => s.split('.').map(Number); const [x, y] = [p(a), p(b)]; return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; }).pop();
  if (!last) { console.error(`dead_gates: ${rel} has no save summary`); process.exit(2); }
  const j = readSum(idx[last]); const n = new Map();
  for (const c of Object.values(j.countries || {})) for (const tk of c.technologies_held || []) if (gates.has(tk)) n.set(tk, (n.get(tk) || 0) + 1);
  for (const tk of gates.keys()) per.get(tk).push(n.get(tk) || 0);
}

console.log(`DEAD GATES — ${ARM} · ${runs.length} usable run(s) · book ${BOOK.replace(ROOT, '').replace(/^[\\/]/, '')} · end state = each run's newest summary`);
const rows = [...per.entries()].map(([tk, h]) => ({ tk, rungs: gates.get(tk), live: h.filter(x => x > 0).length, med: med(h) }))
  .sort((a, b) => a.live - b.live || a.med - b.med || a.tk.localeCompare(b.tk));
for (const r of rows) console.log(`  ${(r.live ? '' : 'DEAD ').padEnd(5)}${r.tk.padEnd(34)} held in ${String(r.live).padStart(2)}/${runs.length} runs · median ${String(r.med).padStart(4)} countries · gates ${r.rungs.join(', ')}`);
const dead = rows.filter(r => !r.live);
if (dead.length) {
  console.log(`FAIL: ${dead.length} gate technolog${dead.length > 1 ? 'ies' : 'y'} held by no country in any run — ${dead.map(r => `${r.tk} (${r.rungs.join(', ')})`).join('; ')}: those rungs can never be built`);
  process.exit(1);
}
console.log(`PASS: every one of ${rows.length} gate technologies is held by some country in at least one run`);
