#!/usr/bin/env node
// THE COMPANY ANOMALY CHECK (user-ruled 2026-09-02): after the first run of an arm carrying the
// company-target gate (emit_companies, BUGS_AND_FIXES 2026-09-02), did companies still form, prosper,
// charter and open regional HQs, and did company ownership of the tiered sector move? World and the
// SHORTLIST (GBR USA FRA NET BEL PRU GER), against reference arms, at the sample years. Reads the save
// summaries' per-country `companies` register (v7+: type, prosperity, prosperous, charters, regional_hqs)
// and `ownership_levels` (host-side levels by owner class).
//
//   node tools/testbed/ledger/company_check.mjs --arm <session>[:<setup>] [--ref <session>[:<setup>]] … [--years 1860,1900,1935]
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const SES = join(HERE, '..', 'sessions');
const argv = process.argv.slice(2);
const specs = []; let YEARS = [1860, 1900, 1935];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--arm' || argv[i] === '--ref') specs.push({ kind: argv[i].slice(2), spec: argv[++i] });
  else if (argv[i] === '--years') YEARS = argv[++i].split(',').map(Number);
}
if (!specs.length) { console.error('usage: --arm <session>[:<setup>] [--ref <session>[:<setup>]] [--years …]'); process.exit(1); }
const SHORT = new Set(['GBR', 'USA', 'FRA', 'NET', 'BEL', 'PRU', 'GER']);
const med = a => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const fmt = (x, d = 1) => Number.isFinite(x) ? x.toFixed(d) : '—';
function runDirs(spec) { const [session, setup] = spec.split(':'); const root = join(SES, session);
  return readdirSync(root).filter(d => /^run\d+/.test(d) && statSync(join(root, d)).isDirectory() && (!setup || d.endsWith('_' + setup))).map(d => join(root, d)); }
function readRun(dir) {
  const out = {}; const sdir = join(dir, 'save_summaries'); if (!existsSync(sdir)) return out; const seen = new Set();
  for (const f of readdirSync(sdir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(sdir, f))).toString('utf8')); } catch { continue; }
    const date = j.provenance && j.provenance.date; if (!date) continue; const y = +String(date).split('.')[0]; if (!YEARS.includes(y) || seen.has(y)) continue; seen.add(y);
    const agg = () => ({ n: 0, prosp: [], prosperous: 0, charters: 0, hqs: 0, own: {}, types: new Map(), countriesWith: 0 });
    const W = agg(), S = agg();
    for (const [tag, c] of Object.entries(j.countries || {})) {
      const cos = c.companies || []; const targets = [W]; if (SHORT.has(tag)) targets.push(S);
      for (const T of targets) {
        if (cos.length) T.countriesWith++;
        for (const co of cos) { T.n++; T.prosp.push(+co.prosperity || 0); if (co.prosperous) T.prosperous++; T.charters += +co.charters || 0; T.hqs += +co.regional_hqs || 0; T.types.set(co.type, (T.types.get(co.type) || 0) + 1); }
        for (const [k, v] of Object.entries(c.ownership_levels || {})) T.own[k] = (T.own[k] || 0) + (+v || 0);
      }
    }
    out[y] = { world: W, short: S };
  }
  return out;
}
const groups = specs.map(s => ({ ...s, runs: runDirs(s.spec).map(d => ({ dir: d, data: readRun(d) })) }));
for (const scope of ['world', 'short']) {
  console.log(`\n=== ${scope === 'world' ? 'WORLD' : 'SHORTLIST GBR/USA/FRA/NET/BEL/PRU/GER'} — companies (medians over runs) ===`);
  console.log('year  arm                                    runs  companies  countries-with  prosperity  %prosperous  charters  regional HQs  company-held levels (company + regional) / all owned');
  for (const y of YEARS) for (const g of groups) {
    const rows = g.runs.map(r => r.data[y] && r.data[y][scope]).filter(Boolean); if (!rows.length) continue;
    const ownShare = rows.map(r => { const all = Object.values(r.own).reduce((a, b) => a + b, 0); return all ? ((r.own.company || 0) + (r.own.company_regional || 0)) / all : NaN; });
    console.log(`${y}  ${(g.kind + ' ' + g.spec).slice(0, 38).padEnd(39)} ${String(rows.length).padStart(4)}  ${fmt(med(rows.map(r => r.n)), 0).padStart(9)}  ${fmt(med(rows.map(r => r.countriesWith)), 0).padStart(14)}  ${fmt(med(rows.map(r => med(r.prosp)))).padStart(10)}  ${fmt(100 * med(rows.map(r => r.n ? r.prosperous / r.n : NaN)), 0).padStart(10)}%  ${fmt(med(rows.map(r => r.charters)), 0).padStart(8)}  ${fmt(med(rows.map(r => r.hqs)), 0).padStart(12)}  ${fmt(100 * med(ownShare)).padStart(6)}%`);
  }
}
// which company TYPES formed in the shortlist, arm vs the first reference, at the last year — a type present
// in the reference and absent in the arm is the anomaly the company-target gate could produce
const last = YEARS[YEARS.length - 1];
const arm = groups.find(g => g.kind === 'arm'), ref = groups.find(g => g.kind === 'ref');
if (arm && ref) {
  const typesOf = g => { const m = new Map(); let n = 0; for (const r of g.runs) { const d = r.data[last]; if (!d) continue; n++; for (const [t, c] of d.short.types) m.set(t, (m.get(t) || 0) + c); } return { m, n }; };
  const A = typesOf(arm), R = typesOf(ref);
  const missing = [...R.m.keys()].filter(t => !A.m.has(t)).map(t => `${t} (ref ${(R.m.get(t) / R.n).toFixed(1)}/run)`);
  const extra = [...A.m.keys()].filter(t => !R.m.has(t)).map(t => `${t} (arm ${(A.m.get(t) / A.n).toFixed(1)}/run)`);
  console.log(`\n=== shortlist company TYPES at ${last}: arm ${A.m.size} types over ${A.n} run(s), ref ${R.m.size} types over ${R.n} run(s) ===`);
  console.log('  in the reference, absent in the arm: ' + (missing.length ? missing.join(', ') : 'none'));
  console.log('  in the arm, absent in the reference: ' + (extra.length ? extra.join(', ') : 'none'));
}
console.log('\n⚠ n=1 first-run reads resolve only gross anomalies (no companies, prosperity collapse, HQs gone); type lists vary by playthrough.');
