#!/usr/bin/env node
// ⭐ THE MAJORS' WORKERS-PER-CAPITA CEILING (user-ruled 2026-09-17, BALANCE_FRAMEWORK §10.82.2). The "majors" of ruling 3 ("at most
// 0.8 for top majors") are a SHORTLIST, not the game's prestige rank: GBR, USA, FRA, PRU/NGF/GER, BEL, NET — "significantly large,
// significantly high-tech countries" — and the reading is the POOLED group (the user: "pooled group approach is OK"), which must NOT be
// diluted by low-tech countries that are majors or great powers in game terms (RUS, or an unusually successful CHI / BGL / BHT / TUR /
// SPA — none of them is in the pool). The criterion: the pool's productive workers per capita (salaried − government − military, over
// the strata population; first_run_decomp's definitions and its exact pool) ÷ vanilla's pooled per-run MEDIAN at the same year. At or
// above vanilla's (≥ 1.00×) is a FAILURE — "the depeasantation is on undesirable vanilla level"; the aim is ≤ 0.80×; between the two
// is "above the aim". The per-country rows beneath the verdict are the COMPOSITION of the pooled figure (each member ÷ vanilla's
// per-run median of the same member), a diagnostic, never the criterion; GER is the German state (GER, else NGF, else PRU, per run).
//   node tools/testbed/ledger/majors_workers.mjs --arm <session[,session]>[:<setup>] [--arm …] [--van <session>] [--years 1935[,…]]
//   [--fail 1.0] [--aim 0.8] [--no-members]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { usableRuns, reportDropped } from './lib_runs.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
const SES = join(HERE, '..', 'sessions');
const argv = process.argv.slice(2);
const arms = []; let van = '20260821_131149_vanilla-baseline-n16', YEARS = [1935], FAIL = 1.0, AIM = 0.8, MEMBERS = true;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--arm') arms.push(argv[++i]);
  else if (argv[i] === '--van') van = argv[++i];
  else if (argv[i] === '--years') YEARS = argv[++i].split(',').map(Number);
  else if (argv[i] === '--fail') FAIL = +argv[++i];
  else if (argv[i] === '--aim') AIM = +argv[++i];
  else if (argv[i] === '--no-members') MEMBERS = false;
}
if (!arms.length) { console.error('usage: --arm <session[,session]>[:<setup>] [--arm …] [--van <session>] [--years 1935,…]'); process.exit(1); }
const POOL = new Set(['GBR', 'USA', 'FRA', 'NET', 'BEL', 'UNL', 'PRU', 'NGF', 'GER']); // first_run_decomp's pool, exactly (UNL replaces NET+BEL where it forms)
const MEMBER = ['GBR', 'USA', 'FRA', 'GER', 'BEL', 'NET'];              // the composition rows; GER = the German state
const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const fmt = (x, d = 2) => Number.isFinite(x) ? x.toFixed(d) : '—';
const reading = r => r >= FAIL ? 'FAIL (at or above vanilla)' : r > AIM ? 'above the aim' : 'within the aim';

function runsOf(spec) {
  const [sessions, setup] = spec.split(':');
  const { runs, dropped } = usableRuns(SES, sessions, setup || '');
  reportDropped(dropped);
  return runs.map(rel => ({ rel, dir: join(SES, rel) }));
}
// per run: year -> { pool: {pop, prod, pc}, members: { GBR: {pop, prod, pc, who} | null, … } }
function readRun(r) {
  const out = {};
  const sdir = join(r.dir, 'save_summaries'); if (!existsSync(sdir)) return out;
  const seen = new Set();
  for (const f of readdirSync(sdir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(sdir, f))).toString('utf8')); } catch { continue; }
    const date = j.provenance && j.provenance.date; if (!date) continue;
    const y = +String(date).split('.')[0]; if (!YEARS.includes(y) || seen.has(y)) continue; seen.add(y);
    const C = j.countries || {};
    const get = tag => {
      const c = C[tag]; if (!c) return null;
      const p = c.pop_statistics || {};
      const prod = (+p.population_salaried_workforce || 0) - (+p.population_government_workforce || 0) - (+p.population_military_workforce || 0);
      const pop = Object.values(c.strata || {}).reduce((a, b) => a + b, 0);
      if (!(pop > 0)) return null;
      return { pop, prod, pc: prod / pop, who: tag };
    };
    const pool = { pop: 0, prod: 0 };
    for (const tag of Object.keys(C)) if (POOL.has(tag)) { const g = get(tag); if (g) { pool.pop += g.pop; pool.prod += g.prod; } }
    pool.pc = pool.pop > 0 ? pool.prod / pool.pop : NaN;
    const members = {};
    for (const t of MEMBER) members[t] = t === 'GER' ? (get('GER') || get('NGF') || get('PRU')) : get(t);
    out[y] = { pool, members };
  }
  return out;
}

const V = runsOf(van).map(r => ({ ...r, data: readRun(r) }));
const groups = arms.map(spec => ({ spec, runs: runsOf(spec).map(r => ({ ...r, data: readRun(r) })) }));
console.log('productive workers per capita = (salaried − government − military) ÷ Σ strata, POOLED over GBR/USA/FRA/NET/BEL/PRU/NGF/GER, ÷ the vanilla pooled per-run median');
console.log('FAIL at ≥ ' + fmt(FAIL) + '× (at or above vanilla — user-ruled 2026-09-17), the aim ≤ ' + fmt(AIM) + '×; the member rows are the composition (each ÷ its own vanilla median), not the criterion');
for (const y of YEARS) {
  const vPool = V.map(r => r.data[y] && r.data[y].pool).filter(p => p && p.pop > 0);
  const vPC = med(vPool.map(p => p.pc));
  console.log('\n=== ' + y + ' — vanilla (' + van + '): pooled prod/capita median ' + fmt(vPC, 4) + ' over ' + vPool.length + ' runs (min ' + fmt(Math.min(...vPool.map(p => p.pc)), 4) + ' · max ' + fmt(Math.max(...vPool.map(p => p.pc)), 4) + '; pop median ' + fmt(med(vPool.map(p => p.pop)) / 1e6, 0) + 'M) ===');
  const ref = {};
  for (const t of MEMBER) {
    const rows = V.map(r => r.data[y] && r.data[y].members[t]).filter(Boolean);
    ref[t] = { n: rows.length, pc: med(rows.map(d => d.pc)), who: [...new Set(rows.map(d => d.who))].join('/') };
    if (MEMBERS) console.log('    ' + t.padEnd(4) + ' vanilla median prod/capita ' + fmt(ref[t].pc, 4) + ' over ' + ref[t].n + ' runs' + (t === 'GER' ? ' (' + ref[t].who + ')' : ''));
  }
  for (const g of groups) {
    console.log('\n--- ' + y + ' — ' + g.spec + ' (' + g.runs.length + ' usable run(s)) ---');
    const ratios = [];
    for (const r of g.runs) {
      const d = r.data[y]; if (!d) { console.log('  ' + r.rel + ': no ' + y + ' summary'); continue; }
      const ratio = d.pool.pc / vPC; ratios.push(ratio);
      console.log('  ' + r.rel.padEnd(42) + 'pooled: pop ' + fmt(d.pool.pop / 1e6, 0).padStart(4) + 'M  prod ' + fmt(d.pool.prod / 1e6, 1).padStart(6) + 'M  prod/capita ' + fmt(d.pool.pc, 4) + '  = ' + fmt(ratio) + '× vanilla  ⇒ ' + reading(ratio).toUpperCase());
      if (MEMBERS) for (const t of MEMBER) {
        const c = d.members[t];
        if (!c) { console.log('      ' + t.padEnd(9) + 'absent at ' + y + ' (annexed / not in the save)'); continue; }
        const rr = c.pc / ref[t].pc;
        console.log('      ' + (t + (c.who !== t ? '(' + c.who + ')' : '')).padEnd(9) + 'pop ' + fmt(c.pop / 1e6, 1).padStart(5) + 'M  prod ' + fmt(c.prod / 1e6, 2).padStart(6) + 'M  prod/capita ' + fmt(c.pc, 4) + '  ' + (fmt(rr) + '×').padStart(6) + ' its vanilla median  ' + (rr >= FAIL ? '(at or above vanilla)' : rr > AIM ? '(above 0.8)' : ''));
      }
    }
    if (ratios.length > 1) {
      const m = med(ratios);
      console.log('  median of ' + ratios.length + ' seeds: ' + fmt(m) + '× ⇒ ' + reading(m).toUpperCase() + '; seeds at or above vanilla: ' + ratios.filter(x => x >= FAIL).length + ' of ' + ratios.length + '; seeds above the aim: ' + ratios.filter(x => x > AIM).length);
    }
  }
}
