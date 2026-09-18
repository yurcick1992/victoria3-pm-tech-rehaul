#!/usr/bin/env node
// ⭐⭐ THE CRITERIA REGISTER — AIM / SOFT BOUNDARY / HARD BOUNDARY (user-ruled 2026-09-17 midday, calibrated and amended that afternoon;
// BALANCE_FRAMEWORK §10.83): ONE rule set for the config iterator and the batch report. Three tiers:
//   AIM   — what the iteration is trying to reach;
//   SOFT  — beyond it is not acceptable, but the economy is not broken, so every reading of the run is taken in full;
//   HARD  — beyond it the economy IS broken; the run's recorded outcome is binary — "broken by stall" or "broken by runoff" — and ONE broken
//           run ends the config (the batch-flow rule; a soft breach never stops a batch).
// Scopes: the SHORTLIST pool GBR/USA/FRA/NET/BEL/PRU/NGF/GER taken TOGETHER (per country only where a line says so) and the WORLD. Every
// condition is about the END STATE — the mean over the last five yearly summaries, 1932.1.1 … 1936.1.1 (`--end`; the 1935 point printed
// beside) — unless the line names its own years. HARD lines are checked PER RUN; everything else on the CONSENSUS of the INTACT runs (the
// median of two; with three, the two closest on world GDP; with more, the median of all).
// Quantities (ratios are to the vanilla per-run MEDIAN of the same scope and window, n=16 unless --van says otherwise):
//   GDP  world GDP; the pool's GDP            W   productive workers per capita = (salaried − government − military) ÷ Σ strata
//   U*   total unemployment INCLUDING peasants = (unemployed + peasants) ÷ (salaried + unemployed + peasants)
//   H    the investment-pool hoard ÷ GDP     Y   GDP ÷ productive workers (W × Y = GDP per capita, the decomposition)
//   T0…T3  workers in the tiered industries' era-0 … era-3 rungs = Σ staffed levels × per-level employment × workforce_mult, BY THE RUNG'S
//          ERA from the run's own config (an industry that starts at e2, automotive, contributes nothing to T0); T3's line is "the more the
//          better" on T3 ÷ (T0 + T1 + T2), low weight — no X (user-ruled 2026-09-17 afternoon)
//   PI   the building-input goods' price index — steel, tools, engines, fertilizer, explosives, dye, paper: the median over the scoped
//          shortlist markets (British, American, French, Dutch) of price ÷ base at 1935, ÷ vanilla's; aim ≤ 0.8, soft > 1.0; plus its
//          decade path 1900 → 1935 (falling decade over decade is the aim's second half)
//   PP   the pop goods' price index IN WAGE UNITS — groceries, clothes, furniture, glass, fine art, automobiles, telephones, radios: the
//          median over the same markets of price ÷ the owner's base wage at 1935, ÷ vanilla's; aim ≤ 0.8, soft > 1.1 (pop goods stay near
//          base in pounds — pop wealth absorbs the glut — so the decline the design needs shows in labour terms, F97)
//   PM   the war goods (small arms, artillery, ammunition) — read only; the army's demand is exogenous to the ladder
// HARD lines: the 1836–1845 anchor (world GDP outside vanilla's 90% CI ± 10% in more than two years: below → stall, above → runoff);
//   pooled U* < 10% (runoff); CAPITAL ABUNDANCE — a shortlist member of ≥ 50M people, not in civil war, with U* < 5% in FIVE or more
//   consecutive years ending by 1936 AND a mean hoard over those years ≥ 1.5 of its own GDP (runoff; agreed 2026-09-17 13:30 — vanilla's
//   own seeds break it in 2 of 16, Britain at 1.5 and 2.1 GDP); world GDP at the end state > 1.5× (runoff) or < 0.5× (stall) — proposed
//   the same afternoon. A hoard alone, or low unemployment only by the very late game, is SOFT: three or more years at ≥ 1.0 GDP, five or
//   more at any hoard, or a member's hoard > 3 GDP at the end / > 2 in every year 1931–1936 without a 2.5-GDP spend-down.
// THE LOSS (user-asked 2026-09-17: "a formula to minimize with weights", distances "relying on natural distributions" and validated so
//   that the actual best batches score best): L = Σ w · d, where d is the distance from the aim interval in units of the metric's NATURAL
//   SPREAD — the standard deviation of the same ratio across vanilla's sixteen seeds (σ), capped at 5 — and, for the T terms with no
//   vanilla reference, the spread across the mod runs read in the same invocation; T3 enters as −w · ln(T3 ÷ (T0 + T1 + T2)) and, SINCE
//   2026-09-18, T0 as its share T0 ÷ (T1 + T2 + T3) — the less the better — in the mod runs' spread of that share (fallback 0.02). A broken run
//   has no loss; a config's loss is its intact consensus's. THE SOFT LINE IS A KINK (user-ruled 2026-09-18; §10.83.5): beyond a soft boundary the
//   excess distance (in σ, capped at 5) counts SOFT_SLOPE (2) MORE times on top of the aim distance, so the loss is continuous through the line
//   and steeper past it — a book 1% over a soft line scores a hair worse than one 1% under, not a step worse; the breach still marks the book
//   'not final' in the report and in the ranking's soft column. The 2026-09-17 flat 10 × w step (which made a soft crossing a discontinuity of
//   20–30 points and would have "broken the minimisation process") survives only as --soft-pen (default 0). A consensus pair that DIVERGES under
//   F114's bands (different bands and ≥ 0.15 apart on world GDP, or ≥ 0.10 on world W) has no consensus — it needs its third run and is unranked.
//   `--sigma mod` takes every σ from the INTACT mod runs read in the invocation instead of vanilla's seeds (the same population the loss is
//   validated on; wider on the price and hoard lines, where vanilla barely moves between seeds).
//   Weights (`--weights k=v,…` overrides; user-ruled 2026-09-18 "balance more equally, reduce pool GDP, raise the low ones, especially T3/rest
//   and T0/rest"): world GDP 2, pool W 1.5, T0 1.5, T3 1.5, pool GDP 1.25, world W 1.25, pool U* 1, PI 1, PP 0.75, world U* 0.75, pool H 0.75,
//   world H 0.5 (the 2026-09-17 provisional set — 3 / 2 / 2 / 1.5 / 1 / 1 / 1 / 0.5 / 0.5 / 0.5 / 0.3 / 0.25 — is reproduced with
//   --weights gdpW=3,gdpP=2,poolW=2,worldW=1.5,poolU=1,T0=1,PI=1,PP=0.5,worldU=0.5,poolH=0.5,T3=0.3,worldH=0.25 --soft-pen 10 --soft-slope 0,
//   apart from T0's form).
// Not in the summaries: a civil war — a member-year whose population fell more than 15% year on year is exempt from the per-member lines.
//   node tools/testbed/ledger/criteria.mjs --arm <session[,session]>[:<setup>] [--arm …] [--config <path>] [--van <session>]
//        [--end 1932-1936] [--big 50] [--weights k=v,…] [--sigma vanilla|mod] [--soft-slope 2] [--soft-pen 0] [--json <out.json>] [--quiet]
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
const ARMS = []; for (let i = 0; i < argv.length; i++) if (argv[i] === '--arm') ARMS.push(argv[i + 1]);
const VAN = argOf('--van', '20260821_131149_vanilla-baseline-n16'); const CONFIG = argOf('--config', ''); const BIG = +argOf('--big', '50') * 1e6;
const [E0, E1] = argOf('--end', '1932-1936').split('-').map(Number); const JSON_OUT = argOf('--json', ''); const QUIET = argv.includes('--quiet'); const SIGMA = argOf('--sigma', 'vanilla');
// THE WEIGHTS (user-ruled 2026-09-18: "balance weights more equally — reduce pool GDP, increase the now low-weighted options, especially T3/rest and T0/rest";
// the 2026-09-17 provisional set was gdpW 3, gdpP 2, poolW 2, worldW 1.5, poolU 1, T0 1, PI 1, PP 0.5, worldU 0.5, poolH 0.5, T3 0.3, worldH 0.25 — a 12× range; this is 4×)
const W = { gdpW: 2, gdpP: 1.25, poolW: 1.5, worldW: 1.25, poolU: 1, T0: 1.5, T3: 1.5, PI: 1, PP: 0.75, worldU: 0.75, poolH: 0.75, worldH: 0.5 };
for (const kv of (argOf('--weights', '') || '').split(',').filter(Boolean)) { const [k, v] = kv.split('='); if (k in W) W[k] = +v; else throw new Error('unknown weight ' + k); }
if (!ARMS.length) { console.error('usage: --arm <session[,session]>[:<setup>] [--arm …] [--config <path>] [--van <session>] [--end 1932-1936] [--weights k=v,…] [--json out]'); process.exit(2); }
const POOL = ['GBR', 'USA', 'FRA', 'NET', 'BEL', 'PRU', 'NGF', 'GER'];
const MEMBER = ['GBR', 'USA', 'FRA', 'GER', 'BEL', 'NET']; // GER = the German state: GER, else NGF, else PRU
const MARKETS = { 'British Market': 'GBR', 'American Market': 'USA', 'French Market': 'FRA', 'Dutch Market': 'NET' }; // the scoped shortlist markets
const GI = ['steel', 'tools', 'engines', 'fertilizer', 'explosives', 'dye', 'paper'], GP = ['groceries', 'clothes', 'furniture', 'glass', 'fine_art', 'automobiles', 'telephones', 'radios'], GM = ['small_arms', 'artillery', 'ammunition'];
const PYEARS = [1900, 1910, 1920, 1930, 1935];
const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = a => { const s = a.filter(Number.isFinite); return s.length ? s.reduce((x, y) => x + y, 0) / s.length : NaN; };
const sd = a => { const s = a.filter(Number.isFinite); if (s.length < 3) return NaN; const m = mean(s); return Math.sqrt(s.reduce((x, y) => x + (y - m) ** 2, 0) / (s.length - 1)); };
const pct = (a, p) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const f2 = (x, d = 2) => Number.isFinite(x) ? x.toFixed(d) : '—'; const r2 = x => Math.round(x * 100) / 100;
const pc = x => Number.isFinite(x) ? (100 * x).toFixed(1) + '%' : '—';
const BASE = Object.fromEntries(readFileSync(join(REPO, 'tools', 'goods_prices.tsv'), 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#')).map(l => l.split('\t')).map(([g, p]) => [g.trim(), +p]));

// ---- the config (T0…T3): --config, else the run's own build_state.json
function configFor(runDir) {
  let p = CONFIG;
  if (!p) { try { const bs = JSON.parse(readFileSync(join(runDir, 'build_state.json'), 'utf8')); const d = bs.deterministic || {}; p = (d.mod_under_test || {}).built_from_config || d.built_from_config || ''; } catch { p = ''; } }
  if (!p) return null; const abs = existsSync(p) ? p : join(REPO, p); if (!existsSync(abs)) return null;
  const cfg = JSON.parse(readFileSync(abs, 'utf8')); const tier = {};
  for (const ind of cfg.industries || []) { if (ind.disabled) continue; for (const t of ind.tiers || []) tier[t.key] = { era: t.era, emp: Object.values(t.employment || {}).reduce((a, b) => a + (+b || 0), 0) * (t.workforce_mult || 1) }; }
  return { path: abs.replace(REPO, '').replace(/^[\\/]/, ''), tier };
}
// ---- one run's yearly summaries
const agg = () => ({ gdp: 0, pop: 0, prod: 0, sal: 0, un: 0, pe: 0, pool: 0 });
const addC = (a, c) => { const p = c.pop_statistics || {}; const sal = +p.population_salaried_workforce || 0, un = +p.population_unemployed_workforce || 0, pe = (+p.population_subsisting_workforce || 0) * 1e5;
  a.gdp += +c.gdp || 0; a.pop += Object.values(c.strata || {}).reduce((x, y) => x + y, 0); a.prod += sal - (+p.population_government_workforce || 0) - (+p.population_military_workforce || 0); a.sal += sal; a.un += un; a.pe += pe; a.pool += +c.investment_pool || 0; };
const fin = a => ({ ...a, W: a.pop > 0 ? a.prod / a.pop : NaN, U: (a.sal + a.un + a.pe) > 0 ? (a.un + a.pe) / (a.sal + a.un + a.pe) : NaN, H: a.gdp > 0 ? a.pool / a.gdp : NaN, Y: a.prod > 0 ? a.gdp / a.prod : NaN });
function readRun(rel, tier) {
  const dir = join(SES, rel, 'save_summaries'); const years = new Map(); const wage = {}; // wage[year][tag] = base wage
  if (!existsSync(dir)) return { years, wage };
  for (const fn of readdirSync(dir).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, fn))).toString('utf8')); } catch { continue; }
    const y = +String((j.provenance && j.provenance.date) || '').split('.')[0]; if (!y || years.has(y)) continue;
    const C = j.countries || {}; const world = agg(), pool = agg(); const members = {}; const T = { w: [0, 0, 0, 0], s: [0, 0, 0, 0] };
    const ger = C.GER ? 'GER' : C.NGF ? 'NGF' : C.PRU ? 'PRU' : null;
    for (const [tag, c] of Object.entries(C)) { addC(world, c); const inPool = POOL.includes(tag); if (inPool) addC(pool, c);
      if (tier) for (const [k, b] of Object.entries(c.buildings || {})) { const t = tier[k]; if (!t) continue; const w = (+b.staffing || 0) * t.emp; T.w[t.era] += w; if (inPool) T.s[t.era] += w; } }
    world.gdp = +j.world.gdp || world.gdp;
    for (const m of MEMBER) { const tag = m === 'GER' ? ger : m; const c = tag && C[tag]; if (!c) { members[m] = null; continue; } const a = agg(); addC(a, c); members[m] = { tag, ...fin(a) }; }
    wage[y] = {}; for (const tag of Object.values(MARKETS)) if (C[tag]) wage[y][tag] = +C[tag].base_wage || NaN;
    years.set(y, { world: fin(world), pool: fin(pool), members, T });
  }
  return { years, wage };
}
// ---- prices from markets.tsv: per dump year, per market, per good → the absolute price
function readPrices(rel) {
  const f = join(SES, rel, 'markets.tsv'); const out = {}; if (!existsSync(f)) return out;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const c = line.split('\t'); if (c.length < 8) continue; const y = +String(c[1]).split('.')[0]; if (!PYEARS.includes(y)) continue;
    const tag = MARKETS[c[2]]; if (!tag) continue; const g = c[4], p = +c[7]; if (!(p > 0) || !BASE[g]) continue;
    ((out[y] ||= {})[tag] ||= {})[g] = p;
  }
  return out;
}
const priceIdx = (P, wage, y, goods, unit) => med(Object.entries(P[y] || {}).flatMap(([tag, gs]) => goods.map(g => gs[g] ? (unit === 'wage' ? gs[g] / (wage[y] && wage[y][tag]) : gs[g] / BASE[g]) : NaN)));
const winMean = (years, key, sub, lo = E0, hi = E1) => mean([...years.entries()].filter(([y]) => y >= lo && y <= hi).map(([, v]) => v[key] && v[key][sub]));
const at = (years, y, key, sub) => years.has(y) ? years.get(y)[key][sub] : NaN;
const runsOf = spec => { const [s, setup] = spec.split(':'); const { runs, dropped } = usableRuns(SES, s, setup || ''); if (!QUIET) reportDropped(dropped); return runs; };

// ---- vanilla: window medians, their seed spread σ (in ratio units), the anchor's per-year 90% CI, the price references
const vanRuns = runsOf(VAN).map(rel => { const r = readRun(rel, null); return { rel, ...r, P: readPrices(rel) }; });
const ref = {}, sig = {};
const setRef = (key, vals) => { const m = med(vals); ref[key] = m; sig[key] = m ? sd(vals.map(v => v / m)) : NaN; };
for (const scope of ['world', 'pool']) for (const q of ['gdp', 'W', 'U', 'H', 'Y']) setRef(scope + '.' + q, vanRuns.map(r => winMean(r.years, scope, q)));
setRef('PI', vanRuns.map(r => priceIdx(r.P, r.wage, 1935, GI, 'base'))); setRef('PP', vanRuns.map(r => priceIdx(r.P, r.wage, 1935, GP, 'wage'))); setRef('PM', vanRuns.map(r => priceIdx(r.P, r.wage, 1935, GM, 'base')));
for (const y of PYEARS) ref['PI.' + y] = med(vanRuns.map(r => priceIdx(r.P, r.wage, y, GI, 'base')));
const ci = {}; for (let y = 1836; y <= 1845; y++) { const v = vanRuns.map(r => at(r.years, y, 'world', 'gdp')).filter(Number.isFinite); if (v.length >= 8) ci[y] = { lo: pct(v, 0.05), hi: pct(v, 0.95) }; }

// ---- an arm's runs
function scoreRun(rel, tier) {
  const { years, wage } = readRun(rel, tier); const P = readPrices(rel); const r = { rel, hard: [], soft: [], side: [] };
  r.gdpW = winMean(years, 'world', 'gdp') / ref['world.gdp']; r.gdp35 = at(years, 1935, 'world', 'gdp') / med(vanRuns.map(v => at(v.years, 1935, 'world', 'gdp'))); r.gdpP = winMean(years, 'pool', 'gdp') / ref['pool.gdp'];
  for (const s of ['world', 'pool']) for (const q of ['W', 'U', 'H', 'Y']) { r[s + q] = winMean(years, s, q) / ref[s + '.' + q]; r[s + q + '_abs'] = winMean(years, s, q); }
  r.PI = priceIdx(P, wage, 1935, GI, 'base') / ref.PI; r.PI_abs = priceIdx(P, wage, 1935, GI, 'base'); r.PP = priceIdx(P, wage, 1935, GP, 'wage') / ref.PP; r.PM = priceIdx(P, wage, 1935, GM, 'base') / ref.PM;
  r.PIpath = PYEARS.map(y => priceIdx(P, wage, y, GI, 'base')); r.PIfalling = r.PIpath.every((v, i, a) => i === 0 || !(Number.isFinite(v) && Number.isFinite(a[i - 1])) || v <= a[i - 1]);
  if (tier) {
    const tw = (y, i) => years.has(y) ? years.get(y).T.s[i] : NaN; const dec = (a, b, i) => mean([...years.keys()].filter(y => y >= a && y <= b).map(y => tw(y, i)));
    const end = [0, 1, 2, 3].map(i => mean([...years.keys()].filter(y => y >= E0 && y <= E1).map(y => tw(y, i))));
    r.T = { end, t36: tw(1936, 0), dec0: [dec(1900, 1909, 0), dec(1910, 1919, 0), dec(1920, 1929, 0), dec(1930, 1936, 0)], worldEnd: [0, 1, 2, 3].map(i => mean([...years.keys()].filter(y => y >= E0 && y <= E1).map(y => years.get(y).T.w[i]))) };
    r.T.ratio0 = tw(1935, 0) / r.T.dec0[0]; r.T.declining = r.T.dec0.every((v, i, a) => i === 0 || !(Number.isFinite(v) && Number.isFinite(a[i - 1])) || v < a[i - 1]);
    r.T.r3 = (end[0] + end[1] + end[2]) > 0 ? end[3] / (end[0] + end[1] + end[2]) : NaN; r.T.r0 = (end[1] + end[2] + end[3]) > 0 ? end[0] / (end[1] + end[2] + end[3]) : NaN; r.T.share3 = end.reduce((x, y) => x + y, 0) > 0 ? end[3] / end.reduce((x, y) => x + y, 0) : NaN;
  }
  // ---- HARD and SOFT, per run
  { let viol = 0, below = 0, above = 0; const det = [];
    for (let y = 1836; y <= 1845; y++) { const c = ci[y], g = at(years, y, 'world', 'gdp'); if (!c || !Number.isFinite(g)) continue; if (g < 0.9 * c.lo) { viol++; below++; det.push(y + ' ' + f2(g / c.lo) + '×lo'); } else if (g > 1.1 * c.hi) { viol++; above++; det.push(y + ' ' + f2(g / c.hi) + '×hi'); } }
    r.anchor = { viol, det }; if (viol > 2) { r.hard.push('1836–1845 world GDP outside vanilla\'s 90% CI ±10% in ' + viol + ' years (' + det.join(', ') + ')'); r.side.push(below >= above ? 'stall' : 'runoff'); } }
  if (r2(r.gdpW) > 1.5) { r.hard.push('world GDP ' + f2(r.gdpW) + '× vanilla at the end state (> 1.5)'); r.side.push('runoff'); }
  if (r2(r.gdpW) < 0.5) { r.hard.push('world GDP ' + f2(r.gdpW) + '× vanilla at the end state (< 0.5)'); r.side.push('stall'); }
  if (Number.isFinite(r.poolU_abs) && r.poolU_abs < 0.10) { r.hard.push('pooled shortlist U* ' + pc(r.poolU_abs) + ' < 10% at the end state'); r.side.push('runoff'); }
  const ys = [...years.keys()].sort((a, b) => a - b);
  r.abundance = [];
  for (const m of MEMBER) {
    const civil = y => { const p = years.get(y).members[m], q = years.has(y - 1) && years.get(y - 1).members[m]; return p && q && q.pop > 0 && p.pop < 0.85 * q.pop; };
    let best = { len: 0 }, cur = [];
    const flush = () => { if (cur.length > best.len) { const hs = cur.map(y => years.get(y).members[m].H); best = { len: cur.length, from: cur[0], to: cur[cur.length - 1], h: mean(hs), hmin: Math.min(...hs), hmax: Math.max(...hs), tag: years.get(cur[0]).members[m].tag, pop: years.get(cur[cur.length - 1]).members[m].pop }; } cur = []; };
    for (const y of ys) { if (y < 1920) continue; const c = years.get(y).members[m]; if (c && c.pop >= BIG && c.U < 0.05 && !civil(y)) cur.push(y); else flush(); } flush();
    if (best.len >= 2) r.abundance.push({ m, ...best });
    if (best.len >= 5 && best.h >= 1.5) { r.hard.push(m + ' (' + best.tag + ', ' + f2(best.pop / 1e6, 0) + 'M) in CAPITAL ABUNDANCE: U* under 5% in ' + best.len + ' consecutive years ' + best.from + '–' + best.to + ' at a mean hoard of ' + f2(best.h) + ' of its GDP (' + f2(best.hmin) + '–' + f2(best.hmax) + ')'); r.side.push('runoff'); }
    else if ((best.len >= 3 && best.h >= 1.0) || best.len >= 5) r.soft.push(m + ' (' + best.tag + ') near capital abundance: U* under 5% in ' + best.len + ' years ' + best.from + '–' + best.to + ' at a mean hoard of ' + f2(best.h) + ' GDP');
    // a hoard alone: soft
    const endYs = ys.filter(y => y >= E0 && y <= E1 && years.get(y).members[m]); const hEnd = mean(endYs.map(y => years.get(y).members[m].H)); const popEnd = mean(endYs.map(y => years.get(y).members[m].pop));
    if (endYs.length && popEnd >= BIG && hEnd > 3) r.soft.push(m + ' hoard ' + f2(hEnd) + ' GDP at the end state (> 3)');
    const w2 = ys.filter(y => y >= 1931 && y <= 1936); const rows2 = w2.map(y => years.get(y).members[m]);
    if (w2.length >= 5 && rows2.every(Boolean) && rows2.every(x => x.pop >= BIG && x.H > 2)) { const decline = (rows2[0].pool - rows2[rows2.length - 1].pool) / (rows2[0].gdp || 1); if (!(decline >= 2.5)) r.soft.push(m + ' hoard above 2 GDP in every year ' + w2[0] + '–' + w2[w2.length - 1] + ' and not spent down (' + f2(decline, 1) + ' of the ' + w2[0] + ' GDP, needs 2.5)'); }
  }
  r.broken = null;
  if (r.hard.length) { const ro = r.side.filter(s => s === 'runoff').length, st = r.side.length - ro; r.broken = ro && st ? (r.gdpW >= 1 ? 'runoff' : 'stall') : (ro ? 'runoff' : 'stall'); }
  return r;
}
// ---- the loss: d = distance from the aim interval ÷ the natural spread (vanilla's seed σ of the same ratio; the mod runs' spread for T)
// THE SOFT LINE IS A KINK, NOT A STEP (user-ruled 2026-09-18: "being 1% over soft cap isn't instantly infinitely worse than being 1% under … will break
// minimisation"): beyond a soft boundary the EXCESS distance (in σ, capped at 5) counts SOFT_SLOPE more times on top of the aim distance, so the loss is
// continuous through the line and steeper past it; the 2026-09-17 flat 10 × w step survives only as --soft-pen (default 0). A breach still marks the
// consensus 'not final' in the report and the ranking (the soft column) — "hitting soft cap means we're not there yet".
const SOFT_PEN = +argOf('--soft-pen', '0'); const SOFT_SLOPE = +argOf('--soft-slope', '2');
const dist = (v, lo, hi, s, softLo = -Infinity, softHi = Infinity) => { if (!Number.isFinite(v) || !Number.isFinite(s) || !s) return NaN; const x = r2(v);
  const aim = Math.min(5, (x < lo ? (lo - x) : x > hi ? (x - hi) : 0) / s); const excess = x < softLo ? (softLo - x) : x > softHi ? (x - softHi) : 0;
  return aim + Math.min(5, excess / s) * SOFT_SLOPE + (excess > 0 ? SOFT_PEN : 0); };
function lossOf(o, sT) { // o: a run or a consensus object with the metrics; sT: {ratio0, r3} spreads
  const t = {};
  t.gdpW = dist(o.gdpW, 0.95, 1.05, sig['world.gdp'], 0.75, 1.33); t.gdpP = dist(o.gdpP, 1.05, 1.15, sig['pool.gdp'], 0.95, 1.5); t.poolW = dist(o.poolW, 0.6, 0.7, sig['pool.W'], -Infinity, 1.0); t.worldW = dist(o.worldW, 0.6, 0.95, sig['world.W'], -Infinity, 1.0);
  t.poolU = dist(o.poolU, 2.0, Infinity, sig['pool.U'], 1.0); t.worldU = dist(o.worldU, 1.0, Infinity, sig['world.U'], 1.0); t.poolH = dist(o.poolH, -Infinity, 1.0, sig['pool.H']); t.worldH = dist(o.worldH, -Infinity, 1.0, sig['world.H']);
  t.PI = dist(o.PI, -Infinity, 0.8, sig.PI, -Infinity, 1.0); t.PP = dist(o.PP, -Infinity, 0.8, sig.PP, -Infinity, 1.1);
  if (o.T) { // T0 ÷ (T1+T2+T3), the less the better — its distance from 0 in the mod runs' spread (fallback 0.02), plus the kink beyond the soft line (1935 > 1.3 × the 1900s)
    t.T0 = (Number.isFinite(o.T.r0) ? Math.min(5, o.T.r0 / (sT.r0 || 0.02)) : NaN) + Math.min(5, Math.max(0, o.T.ratio0 - 1.3) / (sT.ratio0 || 0.3)) * SOFT_SLOPE + (r2(o.T.ratio0) > 1.3 ? SOFT_PEN : 0);
    t.T3 = Number.isFinite(o.T.r3) && o.T.r3 > 0 ? -Math.log(o.T.r3) : NaN; }
  const softList = []; if (r2(o.gdpW) < 0.75 || r2(o.gdpW) > 1.33) softList.push('world GDP'); if (r2(o.gdpP) < 0.95 || r2(o.gdpP) > 1.5) softList.push('pool GDP'); if (r2(o.poolW) > 1.0) softList.push('pool W'); if (r2(o.worldW) > 1.0) softList.push('world W'); if (r2(o.poolU) < 1.0) softList.push('pool U*'); if (r2(o.worldU) < 1.0) softList.push('world U*'); if (r2(o.PI) > 1.0) softList.push('PI'); if (r2(o.PP) > 1.1) softList.push('PP'); if (o.T && r2(o.T.ratio0) > 1.3) softList.push('T0');
  let L = 0, n = 0; const parts = {}; for (const [k, w] of Object.entries(W)) { if (!(k in t) || !Number.isFinite(t[k])) continue; parts[k] = w * t[k]; L += parts[k]; n++; }
  return { L, parts, terms: t, n, soft: softList };
}
const consensusOf = runs => { // over intact runs
  const ok = runs.filter(r => !r.broken); let cons = ok, note;
  if (!ok.length) { note = 'no intact run — the config is out'; }
  else if (ok.length === 1) note = 'n=1 intact — read as is';
  else if (ok.length === 2) note = 'n=2 intact — the median (mean) of both';
  else if (ok.length === 3) { let best = null; for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) { const d = Math.abs(ok[i].gdpW - ok[j].gdpW); if (!best || d < best.d) best = { d, i, j }; } cons = [ok[best.i], ok[best.j]]; note = 'n=3 intact — the two closest on world GDP (' + cons.map(r => r.rel.split('/')[1]).join(' + ') + ')'; }
  else note = 'n=' + ok.length + ' intact — the median of all';
  const band = (v, e) => { const i = e.findIndex(x => v < x); return i === -1 ? e.length : i; };
  const diverges = (a, b) => (band(a.gdpW, [0.6, 0.9, 1.1, 1.5]) !== band(b.gdpW, [0.6, 0.9, 1.1, 1.5]) && Math.abs(a.gdpW - b.gdpW) >= 0.15) || (band(a.worldW, [0.4, 0.55, 0.72, 0.9]) !== band(b.worldW, [0.4, 0.55, 0.72, 0.9]) && Math.abs(a.worldW - b.worldW) >= 0.10);
  const divergent = cons.length === 2 && diverges(cons[0], cons[1]);
  if (divergent) note += ' — DIVERGENT under F114 (world GDP ' + cons.map(r => f2(r.gdpW)).join(' / ') + ', world W ' + cons.map(r => f2(r.worldW)).join(' / ') + '): no consensus, a third run is needed';
  const C = { note, runs: cons.map(r => r.rel), intact: ok.length, broken: runs.length - ok.length, divergent };
  const keys = ['gdpW', 'gdp35', 'gdpP', 'poolW', 'poolU', 'poolH', 'poolY', 'worldW', 'worldU', 'worldH', 'worldY', 'poolW_abs', 'worldW_abs', 'poolU_abs', 'worldU_abs', 'poolH_abs', 'worldH_abs', 'PI', 'PI_abs', 'PP', 'PM'];
  for (const k of keys) C[k] = med(cons.map(r => r[k]));
  C.PIfalling = cons.length ? cons.filter(r => r.PIfalling).length >= cons.length / 2 : false;
  if (cons.length && cons[0].T) { C.T = { ratio0: med(cons.map(r => r.T.ratio0)), r3: med(cons.map(r => r.T.r3)), r0: med(cons.map(r => r.T.r0)), share3: med(cons.map(r => r.T.share3)), t36: med(cons.map(r => r.T.t36)), dec0: [0, 1, 2, 3].map(i => med(cons.map(r => r.T.dec0[i]))), end: [0, 1, 2, 3].map(i => med(cons.map(r => r.T.end[i]))) }; C.T.declining = C.T.dec0.every((v, i, a) => i === 0 || !(Number.isFinite(v) && Number.isFinite(a[i - 1])) || v < a[i - 1]); }
  return C;
};

// ---- read every arm
const arms = ARMS.map(spec => { const rels = runsOf(spec); const cfg = rels.length ? configFor(join(SES, rels[0])) : null; const runs = rels.map(rel => scoreRun(rel, cfg && cfg.tier)); return { spec, cfg, runs, C: consensusOf(runs) }; });
const allRuns = arms.flatMap(a => a.runs); const sT = { ratio0: sd(allRuns.map(r => r.T && r.T.ratio0)), r3: sd(allRuns.map(r => r.T && r.T.r3)), r0: sd(allRuns.map(r => r.T && r.T.r0)) };
if (SIGMA === 'mod') { // the natural spread of the INTACT mod runs, per ratio
  const ok = allRuns.filter(r => !r.broken); const src = { 'world.gdp': 'gdpW', 'pool.gdp': 'gdpP', 'world.W': 'worldW', 'pool.W': 'poolW', 'world.U': 'worldU', 'pool.U': 'poolU', 'world.H': 'worldH', 'pool.H': 'poolH', PI: 'PI', PP: 'PP' };
  for (const [k, f] of Object.entries(src)) { const s = sd(ok.map(r => r[f])); if (Number.isFinite(s) && s > 0) sig[k] = s; }
}
for (const a of arms) { for (const r of a.runs) r.loss = r.broken ? null : lossOf(r, sT); a.C.loss = a.C.intact && !a.C.divergent ? lossOf(a.C, sT) : null; }

// ---- print
const verdict = (v, lo, hi, soft) => { const x = r2(v); if (soft && soft(x)) return 'BEYOND THE SOFT BOUNDARY'; if (x >= lo && x <= hi) return 'AT THE AIM'; return x < lo ? 'inside, below the aim' : 'inside, above the aim'; };
const line = (label, v, verd, extra = '') => console.log('  ' + label.padEnd(28) + (f2(v) + '×').padStart(7) + '  ' + verd.padEnd(26) + (extra ? ' ' + extra : ''));
if (!QUIET) {
  console.log('CRITERIA REGISTER (§10.83) — end state = the ' + E0 + '–' + E1 + ' mean · vanilla ' + VAN + ' (n=' + vanRuns.length + ') · σ = the spread of each ratio across ' + (SIGMA === 'mod' ? 'the INTACT mod runs read here (' + allRuns.filter(r => !r.broken).length + ')' : 'vanilla\'s seeds'));
  console.log('vanilla window medians: world GDP £' + f2(ref['world.gdp'] / 1e6, 0) + 'M (σ ' + f2(sig['world.gdp']) + ') · W ' + f2(ref['world.W'], 4) + ' (σ ' + f2(sig['world.W']) + ') · U* ' + pc(ref['world.U']) + ' (σ ' + f2(sig['world.U']) + ') · H ' + f2(ref['world.H']) + ' (σ ' + f2(sig['world.H']) + ') | pool GDP £' + f2(ref['pool.gdp'] / 1e6, 0) + 'M (σ ' + f2(sig['pool.gdp']) + ') · W ' + f2(ref['pool.W'], 4) + ' (σ ' + f2(sig['pool.W']) + ') · U* ' + pc(ref['pool.U']) + ' (σ ' + f2(sig['pool.U']) + ') · H ' + f2(ref['pool.H']) + ' (σ ' + f2(sig['pool.H']) + ') | PI ' + f2(ref.PI) + ' of base (σ ' + f2(sig.PI) + '; path ' + PYEARS.map(y => f2(ref['PI.' + y])).join(' → ') + ') · PP ' + f2(ref.PP, 1) + ' wage units (σ ' + f2(sig.PP) + ') · PM ' + f2(ref.PM) + ' of base');
  for (const a of arms) {
    console.log('\n' + '='.repeat(150) + '\n' + a.spec + ' · ' + a.runs.length + ' usable run(s) · ' + (a.cfg ? a.cfg.path : 'no config → T not read'));
    console.log('--- HARD, per run ---');
    for (const r of a.runs) { console.log('  ' + r.rel.split('/').slice(-2).join('/').padEnd(64) + (r.broken ? '⛔ BROKEN BY ' + r.broken.toUpperCase() : '✅ intact') + '  [anchor ' + r.anchor.viol + ' y out; pooled U* ' + pc(r.poolU_abs) + '; world GDP ' + f2(r.gdpW) + '×' + (r.loss ? '; loss ' + f2(r.loss.L, 1) : '') + ']'); for (const h of r.hard) console.log('        ⛔ ' + h); for (const s of r.soft) console.log('        ⚠ soft: ' + s); }
    const C = a.C; console.log('--- CONSENSUS: ' + C.note + ' ---'); if (!C.intact) continue;
    console.log('  SHORTLIST (GBR/USA/FRA/NET/BEL/PRU/NGF/GER pooled)');
    line('W', C.poolW, verdict(C.poolW, 0.6, 0.7, x => x > 1.0), 'abs ' + f2(C.poolW_abs, 4) + ' vs ' + f2(ref['pool.W'], 4) + '; aim 0.6–0.7, soft > 1.0');
    line('U*', C.poolU, verdict(C.poolU, 2.0, Infinity, x => x < 1.0), 'abs ' + pc(C.poolU_abs) + ' vs ' + pc(ref['pool.U']) + '; aim ≥ 2, soft < 1.0');
    line('H', C.poolH, verdict(C.poolH, -Infinity, 1.0), 'abs ' + f2(C.poolH_abs) + ' vs ' + f2(ref['pool.H']) + '; aim < 1');
    line('GDP (W × Y)', C.gdpP, verdict(C.gdpP, 1.05, 1.15, x => x < 0.95 || x > 1.5), '= ' + f2(C.poolW) + ' × ' + f2(C.poolY) + '; aim ≈ 1.1, soft < 0.95 or > 1.5');
    line('PI (input goods, £)', C.PI, verdict(C.PI, -Infinity, 0.8, x => x > 1.0), 'abs ' + f2(C.PI_abs) + ' of base vs ' + f2(ref.PI) + (C.PIfalling ? '; falling decade over decade' : '; NOT falling every decade') + '; aim ≤ 0.8, soft > 1.0');
    line('PP (pop goods, wage units)', C.PP, verdict(C.PP, -Infinity, 0.8, x => x > 1.1), 'aim ≤ 0.8, soft > 1.1  |  PM (war goods, read only) ' + f2(C.PM) + '×');
    if (C.T) { line('T0 ÷ (T1+T2+T3)', C.T.r0, 'the less the better', 'T0 = ' + f2(C.T.end && C.T.end[0] / 1e6, 2) + 'M of ' + f2(C.T.end && C.T.end.reduce((x, y) => x + y, 0) / 1e6, 2) + 'M tiered workers'); line('T0 (1935 ÷ the 1900s)', C.T.ratio0, r2(C.T.ratio0) > 1.3 ? 'BEYOND THE SOFT BOUNDARY' : (C.T.t36 === 0 || C.T.declining) ? 'AT THE AIM' : 'inside, not yet falling', 'decades ' + C.T.dec0.map(v => f2(v / 1e6, 2) + 'M').join(' / ') + '; soft > 1.3'); line('T3 ÷ (T0+T1+T2)', C.T.r3, 'the more the better', 'T3 = ' + pc(C.T.share3) + ' of the tiered workers; T0…T3 ' + C.T.end.map(v => f2(v / 1e6, 2) + 'M').join(' / ')); }
    console.log('  WORLD');
    line('GDP (priority 1)', C.gdpW, verdict(C.gdpW, 0.95, 1.05, x => x < 0.75 || x > 1.33), 'the 1935 point ' + f2(C.gdp35) + '×; aim 1.0, soft outside 0.75–1.33');
    line('W', C.worldW, verdict(C.worldW, 0.6, 0.95, x => x > 1.0), 'abs ' + f2(C.worldW_abs, 4) + ' vs ' + f2(ref['world.W'], 4) + '; aim 0.6–0.95, soft > 1.0');
    line('U*', C.worldU, r2(C.worldU) < 1.0 ? 'BEYOND THE SOFT BOUNDARY' : 'inside (no aim)', 'abs ' + pc(C.worldU_abs) + ' vs ' + pc(ref['world.U']) + '; soft < 1.0');
    line('H', C.worldH, verdict(C.worldH, -Infinity, 1.0), 'abs ' + f2(C.worldH_abs) + ' vs ' + f2(ref['world.H']) + '; aim < 1');
    if (C.loss) console.log('  LOSS ' + f2(C.loss.L, 2) + '  = ' + Object.entries(C.loss.parts).filter(([, v]) => Math.abs(v) > 0.005).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1])).map(([k, v]) => k + ' ' + f2(v, 2)).join(' + ') + (C.loss.soft.length ? '   ⚠ beyond the soft boundary on: ' + C.loss.soft.join(', ') : ''));
    else if (C.divergent) console.log('  LOSS — (divergent pair, no consensus)');
  }
  console.log('\n' + '='.repeat(150) + '\nRANKING by the consensus loss (lower is better; a config with no intact run is out) — weights ' + Object.entries(W).map(([k, v]) => k + ' ' + v).join(', '));
  console.log('  ' + 'arm'.padEnd(78) + 'intact/broken  loss   worldGDP poolGDP poolW worldW poolU* poolH  PI    PP  T0/rest T3/rest  beyond soft (not final)');
  for (const a of [...arms].sort((x, y) => (x.C.loss ? x.C.loss.L : 1e9) - (y.C.loss ? y.C.loss.L : 1e9))) { const C = a.C; console.log('  ' + a.spec.slice(0, 77).padEnd(78) + (C.intact + '/' + C.broken).padEnd(15) + (C.loss ? f2(C.loss.L, 2) : C.divergent ? 'DIVRG' : ' OUT ').padStart(5) + '  ' + [C.gdpW, C.gdpP, C.poolW, C.worldW, C.poolU, C.poolH, C.PI, C.PP].map(v => f2(v).padStart(6)).join(' ') + ' ' + [C.T && C.T.r0, C.T && C.T.r3].map(v => f2(v, 3).padStart(7)).join(' ') + '  ' + (C.loss && C.loss.soft.length ? C.loss.soft.join(', ') : (C.loss ? '—' : ''))); }
}
if (JSON_OUT) { writeFileSync(JSON_OUT, JSON.stringify({ van: VAN, end: [E0, E1], ref, sig, ci, weights: W, arms: arms.map(a => ({ spec: a.spec, config: a.cfg && a.cfg.path, runs: a.runs, consensus: a.C })) }, null, 1)); if (!QUIET) console.log('wrote ' + JSON_OUT); }
