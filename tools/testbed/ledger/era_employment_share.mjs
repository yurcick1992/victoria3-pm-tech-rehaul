#!/usr/bin/env node
// ⭐ T0…T3 SHARE OF EMPLOYMENT IN THE SHORTLIST POOL, BY DECADE (user-asked 2026-09-20).
//
// Read-only, off the yearly save summaries. Per decade, for the pooled shortlist (GBR USA FRA NET BEL PRU NGF GER —
// GLOSSARY's "shortlist pool"), the workers sitting on each NARRATIVE ERA's rungs, as a share of
//   (a) TIERED employment — the register's own basis for T0 ÷ rest and T3 ÷ rest, and
//   (b) the pool's TOTAL WORKFORCE (salaried + unemployed + peasants), which is what "share of employment" means if
//       the question is about the labour force rather than about the ladder.
// Both are printed because they answer different questions and differ by a factor of three or more.
//
// ⚠ WORKERS ARE MODELLED, because a save summary has no per-building headcount: `staffing` counts STAFFED LEVELS, not
//   people (tiered_panel.mjs §). workers = staffed levels × Σ(the rung's own `employment`) × `workforce_mult` where set.
//   Secondary methods are NOT modelled (automation removes laborers), so both sides are overstated and the SHARE
//   survives better than the level. The art academy employs nobody in its main method (its jobs live in the ownership
//   PMG), so it contributes no workers here — as in every other reader.
// ⚠ THE ERA IS THE RUNG'S OWN `era` FROM THE RUN'S OWN CONFIG, never a rung index (the era rule, §10.78 rule 3).
// ⚠ `disabled` industries are skipped (landmine L27).
//
// usage: node tools/testbed/ledger/era_employment_share.mjs --session <stamp>[:<setup>] --config <book>
//        [--tags GBR,USA,...] [--years 1840,1850,...]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const SESSION = arg('--session', '');
if (!SESSION) { console.error('usage: --session <stamp>[:<setup>] --config <book>'); process.exit(2); }
const [STAMP, SETUP] = SESSION.split(':');
const CFG = arg('--config', 'config/mod_config.json');
const TAGS = arg('--tags', 'GBR,USA,FRA,NET,BEL,PRU,NGF,GER').split(',');
const YEARS = arg('--years', '1840,1850,1860,1870,1880,1890,1900,1910,1920,1930,1935').split(',').map(Number);

const cfg = JSON.parse(readFileSync(join(REPO, CFG), 'utf8'));
const RUNG = {};   // building key -> { era, emp }
for (const ind of cfg.industries || []) {
  if (ind.disabled) continue;                                   // landmine L27
  for (const t of ind.tiers || []) {
    const emp = Object.values(t.employment || {}).reduce((a, b) => a + (b || 0), 0);
    RUNG[t.key] = { era: t.era, emp: emp * (t.workforce_mult != null ? +t.workforce_mult : 1), ind: ind.id };
  }
}

const root = join(REPO, 'tools/testbed/sessions', STAMP);
if (!existsSync(root)) { console.error('no such session: ' + root); process.exit(2); }
const runs = readdirSync(root).filter(d => d.startsWith('run') && (!SETUP || d.includes(SETUP))).sort();

const median = a => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };

const perRun = [];
for (const r of runs) {
  const d = join(root, r, 'save_summaries');
  if (!existsSync(d)) continue;
  const years = {};
  for (const f of readdirSync(d).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.'))) {
    let j;
    try { j = JSON.parse(gunzipSync(readFileSync(join(d, f)))); } catch { continue; }
    const y = +String((j.provenance || {}).date || '').split('.')[0];
    if (!y || !YEARS.includes(y)) continue;
    const era = [0, 0, 0, 0];
    let workforce = 0;
    for (const tag of TAGS) {
      const c = (j.countries || {})[tag];
      if (!c) continue;
      const wp = c.workforce_by_profession || null;
      if (wp) workforce += Object.values(wp).reduce((a, b) => a + (b || 0), 0);
      for (const [key, b] of Object.entries(c.buildings || {})) {
        const g = RUNG[key];
        if (!g) continue;
        era[g.era] += (b.staffing || 0) * g.emp;
      }
    }
    years[y] = { era, workforce };
  }
  if (Object.keys(years).length) perRun.push({ run: r, years });
}
if (!perRun.length) { console.error('no usable summaries'); process.exit(2); }

console.log(`T0…T3 EMPLOYMENT SHARE — pooled ${TAGS.join(' ')} · ${STAMP}${SETUP ? ':' + SETUP : ''} · ${perRun.length} run(s) · ${CFG}`);
console.log('workers = staffed levels × the rung’s own per-level employment (secondaries not modelled; the art academy employs nobody in its main method)');
console.log('⚠ NGF/GER do not exist early; the pool is whichever of the eight are alive that year.\n');

console.log('               ——— share of TIERED employment ———        ——— share of the pool’s TOTAL WORKFORCE ———     tiered');
console.log('year        T0      T1      T2      T3        T0      T1      T2      T3      all tiered    workers (M)');
for (const y of YEARS) {
  const rows = perRun.map(p => p.years[y]).filter(Boolean);
  if (!rows.length) continue;
  const e = [0, 1, 2, 3].map(i => median(rows.map(r => r.era[i])));
  const tot = e.reduce((a, b) => a + b, 0);
  const wf = median(rows.map(r => r.workforce));
  const pct = (x, d) => d > 0 ? (100 * x / d).toFixed(1) + '%' : '—';
  console.log(String(y).padEnd(8),
    [0, 1, 2, 3].map(i => pct(e[i], tot).padStart(7)).join(' '), '  ',
    [0, 1, 2, 3].map(i => pct(e[i], wf).padStart(7)).join(' '),
    pct(tot, wf).padStart(12),
    ('  ' + (tot / 1e6).toFixed(2)).padStart(14));
}

console.log('\nper run, T0 and T3 share of TIERED employment (the spread across seeds):');
console.log('year     ' + perRun.map(p => (p.run.replace(/_.*/, '')).padEnd(16)).join(''));
for (const y of YEARS) {
  const cells = perRun.map(p => {
    const r = p.years[y];
    if (!r) return '—'.padEnd(16);
    const tot = r.era.reduce((a, b) => a + b, 0);
    return (tot > 0 ? `${(100 * r.era[0] / tot).toFixed(0)}% / ${(100 * r.era[3] / tot).toFixed(0)}%` : '—').padEnd(16);
  });
  console.log(String(y).padEnd(9) + cells.join(''));
}
console.log('(T0% / T3%)');
