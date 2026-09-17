#!/usr/bin/env node
// ⭐⭐ THE CRITERIA REGISTER — AIM / SOFT BOUNDARY / HARD BOUNDARY (user-ruled 2026-09-17, BALANCE_FRAMEWORK §10.83): ONE rule set for the
// config iterator and the batch report, replacing the scattered labour / depeasantation / capital criteria of §10.82, the capital-abundance
// flag, the persistent-hoarding tests and the plateau test. Three tiers:
//   AIM   — what the iteration is trying to reach;
//   SOFT  — beyond it is not acceptable, but the economy is not broken, so every reading of the run is taken in full;
//   HARD  — beyond it the economy IS broken and the run's recorded outcome is binary: "broken by stall" or "broken by runoff".
// Scopes: the SHORTLIST pool GBR/USA/FRA/NET/BEL/PRU/NGF/GER taken TOGETHER (per-country only where a line says so) and the WORLD.
// Every condition is about the END STATE — the mean over the last five yearly summaries, 1932.1.1 … 1936.1.1 (`--end`), the 1935 point printed
// beside it for continuity with earlier findings — unless the line names its own years. HARD boundaries are checked PER RUN; everything else on
// the CONSENSUS: the median of two runs, or of the two ALIGNED runs when the first pair diverged and a third ran (the two closest on world GDP).
// Quantities (the ratios are to the vanilla per-run median of the same scope and window, n=16 unless --van says otherwise):
//   GDP  world GDP; the pool's GDP                           W   productive workers per capita = (salaried − government − military) ÷ Σ strata
//   U*   total unemployment INCLUDING peasants = (unemployed + peasants) ÷ (salaried + unemployed + peasants)
//   H    the investment-pool hoard ÷ GDP                    Y   GDP ÷ productive workers (W × Y = GDP per capita, the decomposition)
//   T0…T3  workers in the tiered industries' era-0 … era-3 rungs = Σ staffed levels × per-level employment × workforce_mult, BY THE RUNG'S ERA
//          (an industry that starts at e2, automotive, contributes nothing to T0 — the era rule, never the rung index)
// The lines, verbatim in §10.83; the numbers here: shortlist W aim 0.6–0.7 soft > 1.0 · U* aim ≥ 2, soft < 1.0, HARD < 10% pooled, HARD < 5% in
// every year 1926–1935 for a member ≥ 50M people not in civil war · H aim < 1, HARD > 5× vanilla for a member ≥ 50M, HARD > 3× vanilla in every
// year 1931–1936 for such a member unless its pool fell by ≥ 2.5 × its 1931 GDP over those years · T0 aim 0 at 1936 or falling decade over decade
// after 1900, soft 1935 > 1.3 × the 1900–1909 mean · T3 aim ≥ X% of the tiered workers (X to be ruled; --t3-min) · GDP aim ≈ 1.1 (Y high enough),
// soft < 0.95 or > 1.5; world GDP aim 1.0, soft outside [0.75, 1.33], HARD: 1836–1845 world GDP outside vanilla's 90% CI widened by 10% in more
// than two years · world W aim 0.6–0.95, soft > 1.0 · world U* soft < 1.0 · world H aim < 1. Priorities: world GDP, then the pool's W × Y, then W.
// ⚠ ASSUMPTIONS, flagged for the ruling (the register's own §10.83 lists them): "of vanilla" on a per-country hard line means the vanilla POOLED
// shortlist reference (one absolute line for every big member; --h-ref country reads each member against its own vanilla median instead); a civil
// war is not in the summaries, so a member-year whose population fell > 15% year on year is exempt from the per-country lines; "under 5% and not
// rising above that in 1926–1935" is read as U* < 5% in EVERY year 1926–1935.
//   node tools/testbed/ledger/criteria.mjs --arm <session[,session]>[:<setup>] [--config <path>] [--van <session>] [--end 1932-1936]
//        [--t3-min 25] [--h-ref pool|world|country] [--big 50] [--json <out.json>]
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { usableRuns, reportDropped } from './lib_runs.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
const SES = join(HERE, '..', 'sessions');
const REPO = resolve(HERE, '..', '..', '..');
const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ARM = argOf('--arm', ''); const VAN = argOf('--van', '20260821_131149_vanilla-baseline-n16');
const CONFIG = argOf('--config', ''); const T3MIN = +argOf('--t3-min', '25'); const HREF = argOf('--h-ref', 'pool'); const BIG = +argOf('--big', '50') * 1e6;
const [E0, E1] = argOf('--end', '1932-1936').split('-').map(Number); const JSON_OUT = argOf('--json', '');
if (!ARM) { console.error('usage: --arm <session[,session]>[:<setup>] [--config <path>] [--van <session>] [--end 1932-1936] [--t3-min X] [--h-ref pool|world|country] [--json out]'); process.exit(2); }
const POOL = ['GBR', 'USA', 'FRA', 'NET', 'BEL', 'PRU', 'NGF', 'GER'];
const MEMBER = ['GBR', 'USA', 'FRA', 'GER', 'BEL', 'NET']; // GER = the German state: GER, else NGF, else PRU
const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = a => { const s = a.filter(Number.isFinite); return s.length ? s.reduce((x, y) => x + y, 0) / s.length : NaN; };
const pct = (a, p) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const f2 = (x, d = 2) => Number.isFinite(x) ? x.toFixed(d) : '—';
const r2 = x => Math.round(x * 100) / 100; // verdicts compare the PRINTED two-decimal figure, so a line and its verdict never disagree
const pc = x => Number.isFinite(x) ? (100 * x).toFixed(1) + '%' : '—';

// ---- the config (for T0…T3): the run's own build_state.json names it, or --config
function configFor(runDir) {
  let p = CONFIG;
  if (!p) {
    try { const bs = JSON.parse(readFileSync(join(runDir, 'build_state.json'), 'utf8')); const d = bs.deterministic || {}; const m = d.mod_under_test || {}; p = m.built_from_config || d.built_from_config || ''; } catch { p = ''; }
  }
  if (!p) return null;
  const abs = existsSync(p) ? p : join(REPO, p);
  if (!existsSync(abs)) return null;
  const cfg = JSON.parse(readFileSync(abs, 'utf8'));
  const tier = {};
  for (const ind of cfg.industries || []) { if (ind.disabled) continue; for (const t of ind.tiers || []) tier[t.key] = { era: t.era, emp: Object.values(t.employment || {}).reduce((a, b) => a + (+b || 0), 0) * (t.workforce_mult || 1) }; }
  return { path: abs, tier };
}
// ---- one run: every yearly summary → the quantities per scope
const agg = () => ({ gdp: 0, pop: 0, prod: 0, sal: 0, un: 0, pe: 0, pool: 0 });
const addC = (a, c) => {
  const p = c.pop_statistics || {};
  const sal = +p.population_salaried_workforce || 0, un = +p.population_unemployed_workforce || 0, pe = (+p.population_subsisting_workforce || 0) * 100000;
  a.gdp += +c.gdp || 0; a.pop += Object.values(c.strata || {}).reduce((x, y) => x + y, 0);
  a.prod += sal - (+p.population_government_workforce || 0) - (+p.population_military_workforce || 0);
  a.sal += sal; a.un += un; a.pe += pe; a.pool += +c.investment_pool || 0;
};
const fin = a => ({ ...a, W: a.pop > 0 ? a.prod / a.pop : NaN, U: (a.sal + a.un + a.pe) > 0 ? (a.un + a.pe) / (a.sal + a.un + a.pe) : NaN, H: a.gdp > 0 ? a.pool / a.gdp : NaN, Y: a.prod > 0 ? a.gdp / a.prod : NaN });
function readRun(rel, tier) {
  const dir = join(SES, rel, 'save_summaries'); const years = new Map();
  if (!existsSync(dir)) return years;
  for (const fn of readdirSync(dir).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, fn))).toString('utf8')); } catch { continue; }
    const y = +String((j.provenance && j.provenance.date) || '').split('.')[0]; if (!y || years.has(y)) continue;
    const C = j.countries || {}; const world = agg(), pool = agg(); const members = {}; const T = { w: [0, 0, 0, 0], s: [0, 0, 0, 0] };
    const ger = C.GER ? 'GER' : C.NGF ? 'NGF' : C.PRU ? 'PRU' : null;
    for (const [tag, c] of Object.entries(C)) {
      addC(world, c); const inPool = POOL.includes(tag); if (inPool) addC(pool, c);
      if (tier) for (const [k, b] of Object.entries(c.buildings || {})) { const t = tier[k]; if (!t) continue; const w = (+b.staffing || 0) * t.emp; T.w[t.era] += w; if (inPool) T.s[t.era] += w; }
    }
    world.gdp = +j.world.gdp || world.gdp; // the save's own world GDP
    for (const m of MEMBER) { const tag = m === 'GER' ? ger : m; const c = tag && C[tag]; if (!c) { members[m] = null; continue; } const a = agg(); addC(a, c); members[m] = { tag, ...fin(a) }; }
    years.set(y, { world: fin(world), pool: fin(pool), members, T });
  }
  return years;
}
const runsOf = spec => { const [s, setup] = spec.split(':'); const { runs, dropped } = usableRuns(SES, s, setup || ''); reportDropped(dropped); return runs; };
const winMean = (years, key, sub, lo = E0, hi = E1) => mean([...years.entries()].filter(([y]) => y >= lo && y <= hi).map(([, v]) => v[key] && v[key][sub]));
const at = (years, y, key, sub) => years.has(y) ? years.get(y)[key][sub] : NaN;

// ---- vanilla reference: per-run window means → medians; the per-year 90% CI of world GDP for the anchor
const vanRuns = runsOf(VAN).map(rel => ({ rel, years: readRun(rel, null) }));
const ref = {};
for (const scope of ['world', 'pool']) for (const q of ['gdp', 'W', 'U', 'H', 'Y']) ref[scope + '.' + q] = med(vanRuns.map(r => winMean(r.years, scope, q)));
for (const m of MEMBER) ref['member.' + m + '.H'] = med(vanRuns.map(r => mean([...r.years.entries()].filter(([y]) => y >= E0 && y <= E1).map(([, v]) => v.members[m] && v.members[m].H))));
const ci = {}; for (let y = 1836; y <= 1845; y++) { const v = vanRuns.map(r => at(r.years, y, 'world', 'gdp')).filter(Number.isFinite); if (v.length >= 8) ci[y] = { lo: pct(v, 0.05), hi: pct(v, 0.95), n: v.length }; }
const hRefFor = m => HREF === 'world' ? ref['world.H'] : HREF === 'country' ? ref['member.' + m + '.H'] : ref['pool.H'];

// ---- the arm
const armRels = runsOf(ARM); if (!armRels.length) { console.error('no usable runs'); process.exit(2); }
const cfgInfo = configFor(join(SES, armRels[0]));
const runs = armRels.map(rel => { const years = readRun(rel, cfgInfo && cfgInfo.tier); const r = { rel, years, hard: [], side: [] };
  // per-run scalars
  r.gdpW = winMean(years, 'world', 'gdp') / ref['world.gdp']; r.gdp35 = at(years, 1935, 'world', 'gdp') / med(vanRuns.map(v => at(v.years, 1935, 'world', 'gdp')));
  r.gdpP = winMean(years, 'pool', 'gdp') / ref['pool.gdp'];
  for (const s of ['world', 'pool']) for (const q of ['W', 'U', 'H', 'Y']) r[s + q] = winMean(years, s, q) / ref[s + '.' + q];
  r.poolU_abs = winMean(years, 'pool', 'U'); r.worldU_abs = winMean(years, 'world', 'U'); r.poolH_abs = winMean(years, 'pool', 'H'); r.worldH_abs = winMean(years, 'world', 'H');
  r.poolW_abs = winMean(years, 'pool', 'W'); r.worldW_abs = winMean(years, 'world', 'W');
  if (cfgInfo) {
    const tw = (y, i) => years.has(y) ? years.get(y).T.s[i] : NaN;
    const dec = (a, b, i) => mean([...years.keys()].filter(y => y >= a && y <= b).map(y => tw(y, i)));
    r.T = { end: [0, 1, 2, 3].map(i => mean([...years.keys()].filter(y => y >= E0 && y <= E1).map(y => tw(y, i)))), t35: [0, 1, 2, 3].map(i => tw(1935, i)), t36: [0, 1, 2, 3].map(i => tw(1936, i)),
      dec0: [dec(1900, 1909, 0), dec(1910, 1919, 0), dec(1920, 1929, 0), dec(1930, 1936, 0)], worldEnd: [0, 1, 2, 3].map(i => mean([...years.keys()].filter(y => y >= E0 && y <= E1).map(y => years.get(y).T.w[i]))) };
    const tot = r.T.end.reduce((x, y) => x + y, 0); r.T.share3 = tot > 0 ? r.T.end[3] / tot : NaN; r.T.share0 = tot > 0 ? r.T.end[0] / tot : NaN;
    r.T.soft0 = r.T.t35[0] / r.T.dec0[0];
  }
  // ---- HARD, per run
  { let viol = 0, below = 0, above = 0; const det = [];
    for (let y = 1836; y <= 1845; y++) { const c = ci[y], g = at(years, y, 'world', 'gdp'); if (!c || !Number.isFinite(g)) continue; if (g < 0.9 * c.lo) { viol++; below++; det.push(y + ' ' + f2(g / c.lo) + '×lo'); } else if (g > 1.1 * c.hi) { viol++; above++; det.push(y + ' ' + f2(g / c.hi) + '×hi'); } }
    r.anchor = { viol, det }; if (viol > 2) { r.hard.push('1836–1845 world GDP outside vanilla\'s 90% CI ±10% in ' + viol + ' years (' + det.join(', ') + ')'); r.side.push(below >= above ? 'stall' : 'runoff'); } }
  if (Number.isFinite(r.poolU_abs) && r.poolU_abs < 0.10) { r.hard.push('pooled shortlist U* ' + pc(r.poolU_abs) + ' < 10% at the end state'); r.side.push('runoff'); }
  for (const m of MEMBER) {
    const ys = [...years.keys()].sort((a, b) => a - b);
    const big = y => years.get(y).members[m] && years.get(y).members[m].pop >= BIG;
    const civil = y => { const p = years.get(y).members[m], q = years.has(y - 1) && years.get(y - 1).members[m]; return p && q && q.pop > 0 && p.pop < 0.85 * q.pop; };
    // U* < 5% in every year 1926–1935 while ≥ 50M and not in a civil war year
    const w = ys.filter(y => y >= 1926 && y <= 1935); const rows = w.map(y => years.get(y).members[m]);
    if (w.length >= 8 && rows.every(Boolean) && w.every(y => big(y)) && !w.some(civil) && rows.every(x => x.U < 0.05)) { r.hard.push(m + ' (' + rows[0].tag + ', ' + f2(rows[rows.length - 1].pop / 1e6, 0) + 'M) U* under 5% in every year 1926–1935 (' + pc(Math.max(...rows.map(x => x.U))) + ' at most)'); r.side.push('runoff'); }
    // H > 5 × ref at the end state while ≥ 50M
    const endYs = ys.filter(y => y >= E0 && y <= E1 && years.get(y).members[m]); const hEnd = mean(endYs.map(y => years.get(y).members[m].H)); const popEnd = mean(endYs.map(y => years.get(y).members[m].pop));
    if (endYs.length && popEnd >= BIG && !endYs.some(civil) && hEnd > 5 * hRefFor(m)) { r.hard.push(m + ' (' + years.get(endYs[0]).members[m].tag + ', ' + f2(popEnd / 1e6, 0) + 'M) hoard ' + f2(hEnd) + ' GDP = ' + f2(hEnd / hRefFor(m), 1) + '× vanilla (> 5×) at the end state'); r.side.push('stall'); }
    // H > 3 × ref in every year 1931–1936, not declining by 2.5 × the 1931 GDP over the five years
    const w2 = ys.filter(y => y >= 1931 && y <= 1936); const rows2 = w2.map(y => years.get(y).members[m]);
    if (w2.length >= 5 && rows2.every(Boolean) && w2.every(y => big(y)) && !w2.some(civil) && rows2.every(x => x.H > 3 * hRefFor(m))) {
      const first = rows2[0], last = rows2[rows2.length - 1]; const decline = (first.pool - last.pool) / (first.gdp || 1);
      if (!(decline >= 2.5)) { r.hard.push(m + ' (' + first.tag + ') hoard above 3× vanilla in every year ' + w2[0] + '–' + w2[w2.length - 1] + ' (' + f2(Math.min(...rows2.map(x => x.H))) + '–' + f2(Math.max(...rows2.map(x => x.H))) + ' GDP) and not spent down (' + f2(decline, 1) + ' of the ' + w2[0] + ' GDP, needs 2.5)'); r.side.push('stall'); }
    }
  }
  r.broken = r.hard.length ? (r.side.filter(s => s === 'runoff').length >= r.side.filter(s => s === 'stall').length ? (r.side.includes('runoff') && r.side.includes('stall') ? (r.gdpW >= 1 ? 'runoff' : 'stall') : r.side[0]) : 'stall') : null;
  return r; });

// ---- consensus
let cons = [], consNote = '';
if (runs.length === 1) { cons = runs; consNote = 'n=1 — no consensus, the single run read as is'; }
else if (runs.length === 2) { cons = runs; consNote = 'n=2 — the median (mean) of both runs'; }
else if (runs.length === 3) { let best = null; for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) { const d = Math.abs(runs[i].gdpW - runs[j].gdpW); if (!best || d < best.d) best = { d, i, j }; } cons = [runs[best.i], runs[best.j]]; consNote = 'n=3 — the two runs closest on world GDP (' + cons.map(r => r.rel.split('/')[1]).join(' + ') + '), the third set aside'; }
else { cons = runs; consNote = 'n=' + runs.length + ' — the median of all'; }
const cmed = key => med(cons.map(r => key.split('.').reduce((o, k) => o && o[k], r)));
const C = { gdpW: cmed('gdpW'), gdp35: cmed('gdp35'), gdpP: cmed('gdpP'), poolW: cmed('poolW'), poolU: cmed('poolU'), poolH: cmed('poolH'), poolY: cmed('poolY'), worldW: cmed('worldW'), worldU: cmed('worldU'), worldH: cmed('worldH'), worldY: cmed('worldY'),
  poolW_abs: cmed('poolW_abs'), worldW_abs: cmed('worldW_abs'), poolU_abs: cmed('poolU_abs'), worldU_abs: cmed('worldU_abs'), poolH_abs: cmed('poolH_abs'), worldH_abs: cmed('worldH_abs') };
if (cfgInfo) { C.T = { share3: cmed('T.share3'), share0: cmed('T.share0'), soft0: cmed('T.soft0'), t36: cmed('T.t36.0'), end0: cmed('T.end.0'), dec0: [0, 1, 2, 3].map(i => cmed('T.dec0.' + i)), end: [0, 1, 2, 3].map(i => cmed('T.end.' + i)) }; C.T.declining = C.T.dec0.every((v, i, a) => i === 0 || !(Number.isFinite(v) && Number.isFinite(a[i - 1])) || v < a[i - 1]); }

// ---- print
const verdictBand = (v0, aimLo, aimHi, softTest, softText) => { const v = r2(v0); return softTest(v) ? 'BEYOND THE SOFT BOUNDARY (' + softText + ')' : (v >= aimLo && v <= aimHi) ? 'AT THE AIM' : v < aimLo ? 'inside, below the aim' : 'inside, above the aim'; };
console.log('CRITERIA REGISTER (§10.83, user-ruled 2026-09-17) — ' + ARM + ' · ' + runs.length + ' usable run(s) · end state = mean over ' + E0 + '–' + E1 + ' · vanilla ' + VAN + ' (n=' + vanRuns.length + ')' + (cfgInfo ? ' · config ' + cfgInfo.path.replace(REPO, '').replace(/^[\\/]/, '') : ' · no config → T0…T3 not read'));
console.log('vanilla reference (window medians): world GDP £' + f2(ref['world.gdp'] / 1e6, 0) + 'M · W ' + f2(ref['world.W'], 4) + ' · U* ' + pc(ref['world.U']) + ' · H ' + f2(ref['world.H']) + '  |  pool GDP £' + f2(ref['pool.gdp'] / 1e6, 0) + 'M · W ' + f2(ref['pool.W'], 4) + ' · U* ' + pc(ref['pool.U']) + ' · H ' + f2(ref['pool.H']) + '  |  per-member vanilla H medians: ' + MEMBER.map(m => m + ' ' + f2(ref['member.' + m + '.H'])).join(' · ') + '  |  --h-ref ' + HREF + ' ⇒ the per-country hard lines at ' + f2(3 * (HREF === 'pool' ? ref['pool.H'] : ref['world.H'])) + ' / ' + f2(5 * (HREF === 'pool' ? ref['pool.H'] : ref['world.H'])) + ' GDP' + (HREF === 'country' ? ' (per member)' : ''));
console.log('\n=== HARD BOUNDARIES — per run (binary: broken by stall / broken by runoff) ===');
for (const r of runs) {
  console.log('  ' + r.rel.padEnd(44) + (r.broken ? '⛔ BROKEN BY ' + r.broken.toUpperCase() : '✅ intact') + '   [1836–1845 anchor: ' + r.anchor.viol + ' year(s) outside' + (r.anchor.det.length ? ' — ' + r.anchor.det.join(', ') : '') + '; pooled U* ' + pc(r.poolU_abs) + '; world GDP ' + f2(r.gdpW) + '×]');
  for (const h of r.hard) console.log('        ⛔ ' + h);
}
console.log('\n=== CONSENSUS: ' + consNote + ' ===');
const line = (label, v, verdict, extra = '') => console.log('  ' + label.padEnd(30) + (f2(v) + '×').padStart(7) + '  ' + verdict + (extra ? '   ' + extra : ''));
console.log('\n--- SHORTLIST (GBR/USA/FRA/NET/BEL/PRU/NGF/GER pooled) ---');
line('W (workers per capita)', C.poolW, verdictBand(C.poolW, 0.6, 0.7, v => v > 1.0, '> 1.0'), 'abs ' + f2(C.poolW_abs, 4) + ' vs vanilla ' + f2(ref['pool.W'], 4) + '; aim 0.6–0.7');
line('U* (unemp. incl. peasants)', C.poolU, r2(C.poolU) < 1.0 ? 'BEYOND THE SOFT BOUNDARY (< 1.0)' : r2(C.poolU) >= 2.0 ? 'AT THE AIM (≥ 2)' : 'inside, below the aim', 'abs ' + pc(C.poolU_abs) + ' vs vanilla ' + pc(ref['pool.U']) + '; hard < 10% per run');
line('H (hoard ÷ GDP)', C.poolH, r2(C.poolH) < 1.0 ? 'AT THE AIM (< 1)' : 'above the aim (no soft line)', 'abs ' + f2(C.poolH_abs) + ' vs vanilla ' + f2(ref['pool.H']));
line('GDP (pooled)', C.gdpP, r2(C.gdpP) < 0.95 ? 'BEYOND THE SOFT BOUNDARY (< 0.95)' : r2(C.gdpP) > 1.5 ? 'BEYOND THE SOFT BOUNDARY (> 1.5)' : Math.abs(r2(C.gdpP) - 1.1) <= 0.05 ? 'AT THE AIM (≈ 1.1)' : C.gdpP < 1.1 ? 'inside, below the aim 1.1' : 'inside, above the aim 1.1', 'W × Y = ' + f2(C.poolW) + ' × ' + f2(C.poolY) + ' (Y compensates W)');
if (C.T) {
  line('T0 (rung-0 workers, 1935 ÷ 1900s)', C.T.soft0, r2(C.T.soft0) > 1.3 ? 'BEYOND THE SOFT BOUNDARY (> 1.3× the 1900–1909 mean)' : (C.T.t36 === 0 || C.T.declining) ? 'AT THE AIM (' + (C.T.t36 === 0 ? 'zero at 1936' : 'declining decade over decade') + ')' : 'inside, not yet declining every decade', 'decades 1900s/10s/20s/30s: ' + C.T.dec0.map(v => f2(v / 1e6, 2) + 'M').join(' / ') + '; end ' + f2(C.T.end0 / 1e6, 2) + 'M = ' + pc(C.T.share0) + ' of the tiered workers');
  line('T3 (share of tiered workers)', C.T.share3, C.T.share3 >= T3MIN / 100 ? 'AT THE AIM (≥ ' + T3MIN + '%, X provisional)' : 'below the provisional X = ' + T3MIN + '%', 'T0/T1/T2/T3 at the end: ' + C.T.end.map(v => f2(v / 1e6, 2) + 'M').join(' / '));
}
console.log('\n--- WORLD ---');
line('GDP', C.gdpW, r2(C.gdpW) < 0.75 || r2(C.gdpW) > 1.33 ? 'BEYOND THE SOFT BOUNDARY (outside 0.75–1.33)' : Math.abs(r2(C.gdpW) - 1.0) <= 0.05 ? 'AT THE AIM (≈ 1.0)' : C.gdpW < 1 ? 'inside, below the aim 1.0' : 'inside, above the aim 1.0', 'the 1935 point ' + f2(C.gdp35) + '× (PRIORITY 1)');
line('W (workers per capita)', C.worldW, verdictBand(C.worldW, 0.6, 0.95, v => v > 1.0, '> 1.0'), 'abs ' + f2(C.worldW_abs, 4) + ' vs vanilla ' + f2(ref['world.W'], 4) + '; aim 0.6–0.95');
line('U* (unemp. incl. peasants)', C.worldU, r2(C.worldU) < 1.0 ? 'BEYOND THE SOFT BOUNDARY (< 1.0)' : 'inside (no aim set)', 'abs ' + pc(C.worldU_abs) + ' vs vanilla ' + pc(ref['world.U']));
line('H (hoard ÷ GDP)', C.worldH, r2(C.worldH) < 1.0 ? 'AT THE AIM (< 1)' : 'above the aim (no soft line)', 'abs ' + f2(C.worldH_abs) + ' vs vanilla ' + f2(ref['world.H']));
console.log('\nper run (end-state ratios): ' + runs.map(r => r.rel.split('/')[1] + ': world GDP ' + f2(r.gdpW) + ' W ' + f2(r.worldW) + ' U* ' + f2(r.worldU) + ' H ' + f2(r.worldH) + ' | pool GDP ' + f2(r.gdpP) + ' W ' + f2(r.poolW) + ' U* ' + f2(r.poolU) + ' H ' + f2(r.poolH) + (r.T ? ' T3 ' + pc(r.T.share3) + ' T0 ' + f2(r.T.soft0) : '')).join('\n                            '));
console.log('priorities: 1 world GDP at 1935 · 2 the pool\'s W × Y · 3 W (pool and world). Readings of a run beyond a HARD boundary are not taken; beyond a SOFT one they are taken in full.');
if (JSON_OUT) { writeFileSync(JSON_OUT, JSON.stringify({ arm: ARM, van: VAN, end: [E0, E1], ref, ci, runs: runs.map(r => ({ rel: r.rel, broken: r.broken, hard: r.hard, anchor: r.anchor, gdpW: r.gdpW, gdp35: r.gdp35, gdpP: r.gdpP, poolW: r.poolW, poolU: r.poolU, poolH: r.poolH, poolY: r.poolY, worldW: r.worldW, worldU: r.worldU, worldH: r.worldH, worldY: r.worldY, T: r.T })), consensus: { note: consNote, runs: cons.map(r => r.rel), ...C } }, null, 1)); console.log('wrote ' + JSON_OUT); }
