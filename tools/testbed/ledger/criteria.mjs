#!/usr/bin/env node
// ⭐⭐ THE CRITERIA REGISTER — THE LOSS OF THE MOD 1.2 CALIBRATION (BALANCE_FRAMEWORK §10.120 the form, §10.121 the old-plants term, §10.123 the
// weights, the second capital term, T0–T3's scope and the spreads; CLAUDE.md §3.2). Rewritten 2026-11-21 from the §10.83 register (aim / soft /
// hard lines, ratios to vanilla, the soft kink, the closed-major term), whose last form is in git history (commit 4e65135e and before).
// ONE rule set for the config iterator and the batch report.
//
// THE BARRIER (per run; about validity, not severity, §10.120 point 3): a shortlist member (lib_markets MEMBER rows: GBR, USA, FRA, GER = GER /
//   NGF / PRU, NET, BEL, UNL) holding at least 2% of world GDP in each of TEN consecutive yearly summaries whose investment pool ÷ GDP AVERAGES
//   at least 1 over them. A run past it reports that line and nothing else as a result: it has no loss and its aims are not read (`broken:
//   'barrier'`; the stop watcher ends the book on it in the 2+1 test). The line's value — the worst member's best ten-year mean — is printed for
//   EVERY run, so two books that both end past it still compare on it (§10.123).
// THE AIMS (all soft) AND THE LOSS: L = Σ w · d, d = the distance from the aim in units of the line's own spread between runs (SPREAD, fixed):
//   world GDP, displayed, at the end ÷ vanilla's per-run median (same game version)  band 0.90–1.00          w 2
//   U* of the USA / Britain / Germany / the world, 1913 and the end                  25·15 / 10·5 / 20·20 / 60·50 %   w 0.25 each (2 together)
//   industry-output prices: the run's own aggregate (lib_prices.mjs), 1935 ÷ 1900    0.75 or under (a fall of a quarter)   w 2
//     ⭐ Since 2026-11-22 (BALANCE_FRAMEWORK §10.128, the user: "Aggregate fall, ~25%"): it REPLACES the PI and PP terms, whose level part was
//       pegged to 0.8 × vanilla's 1935 index (wrong under §10.128: a price fall is an aim of the mod's own) and whose slope part scored any
//       fall at all as zero. The weight 2 is PI's and PP's together, so the prices keep their share of the loss (Claude's default, stated
//       with the ruling). PI and PP are still computed and printed as minor readings.
//   capital, the count: shortlist members of >= 2% of world GDP with a pool above 0.5 of their GDP, the mean of the 1935 and 1936 summaries   aim 0   w 1
//   capital, the hoard above half GDP: Σ max(0, pool − 0.5 GDP) over the shortlist's countries ÷ their GDP, at the end                       aim 0   w 0.5
//   T0: shortlist workers on tier-0 MANUFACTURING rungs, by decade                  0 at 1936, or falling      w 0.5
//   T3 ÷ (T0 + T1 + T2), shortlist, manufacturing, at the end                       the more the better        w 0.5
//   old plants pushed out: the in-market backward-industry test (lib_laggard.mjs)  under 100% and shrinking   w 0.5
//   The distances: a band or level — the distance outside it; a point aim — |value − aim|; "falling" / "shrinking" — the positive part of the
//   mean decade-to-decade change of the line's logarithm, added to the level part where the aim has one; T3 — max(0, −ln ratio). Each over its
//   SPREAD. A part that cannot be read (too few decades) counts 0 and is listed under `missing`.
// The END of the game is the mean of the yearly summaries 1932–1936 (`--end`); 1913 is the first summary of 1913. T0–T3 and the old plants read
//   MANUFACTURING only (lib_industries.mjs, §10.123 point 4): never the deposit rungs, no agriculture; every skipped industry is printed.
// THE CONSENSUS: the median of the runs not past the barrier (with three, the two closest on world GDP; a pair diverging under F114's bands has
//   none and owes a third run). `--consensus all` reads every usable run instead, past the barrier included — NOT the ruled form, labelled so.
// MINOR READINGS (no weight, §10.120 point 6): W of the world and the shortlist, the shortlist's GDP, H of the world and the shortlist, each ÷
//   vanilla's; the 1836–1845 start (years outside vanilla's 90% range ± 10%; flagged past two); the decade path of world GDP and its 1886 line
//   (0.79–1.01); war-goods prices (PM); GDP at base prices; the shortlist's pooled U*; PI and PP (÷ vanilla, and their slopes) since they left
//   the loss (§10.128). Play time is not read during the 1.2 iterations (§10.123).
//   node tools/testbed/ledger/criteria.mjs --arm <session[,session]>[:<setup>] [--arm …] [--config <path>] [--van <session>[:setup]]
//        [--end 1932-1936] [--weights k=v,…] [--consensus intact|all] [--json <out.json>] [--quiet] [--fit-spreads]
//   --fit-spreads: print the spreads of the runs read (every usable run of every arm, the barrier ignored) as the SPREAD literal, and exit.
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { usableRuns, reportDropped, VANILLA_REF } from './lib_runs.mjs';
import { POOL, MEMBER, MEMBER_FAMILY, MARKET_FAMILY, MARKET_NAMES, PRICE_TAGS, TAG_OF_MARKET, seriesOf, groupBySeries, marketCollisions } from './lib_markets.mjs';
import { manufacturing } from './lib_industries.mjs';
import { laggardMaps, laggardCountries, lagYearOf, inMarketByDecade } from './lib_laggard.mjs';
import { readMarketRun, industryFall, IND_FROM, IND_TO } from './lib_prices.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
const SES = join(HERE, '..', 'sessions');
const REPO = resolve(HERE, '..', '..', '..');
const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ARMS = []; for (let i = 0; i < argv.length; i++) if (argv[i] === '--arm') ARMS.push(argv[i + 1]);
const VAN = (() => { const v = argOf('--van', VANILLA_REF); return v.includes(':') ? v : v + ':vanilla'; })();   // a two-arm session: its vanilla arm
const CONFIG = argOf('--config', ''); const JSON_OUT = argOf('--json', ''); const QUIET = argv.includes('--quiet'); const FIT = argv.includes('--fit-spreads');
const [E0, E1] = argOf('--end', '1932-1936').split('-').map(Number);
const CONS_MODE = argOf('--consensus', 'intact'); if (!['intact', 'all'].includes(CONS_MODE)) { console.error('--consensus intact|all, got ' + CONS_MODE); process.exit(1); }
if (!ARMS.length) { console.error('usage: --arm <session[,session]>[:<setup>] [--arm …] [--config <path>] [--van <session>] [--end 1932-1936] [--weights k=v,…] [--consensus intact|all] [--json out] [--fit-spreads]'); process.exit(2); }

// ---- THE LOSS (§10.123): weights, aims, spreads
const W = { gdp: 2, uUSA13: 0.25, uUSAE: 0.25, uGBR13: 0.25, uGBRE: 0.25, uGER13: 0.25, uGERE: 0.25, uW13: 0.25, uWE: 0.25, ind: 2, cap: 1, hoard: 0.5, T0: 0.5, T3: 0.5, old: 0.5 };
const IND_AIM = 0.75;                                    // industry-output prices, 1935 ÷ 1900: 0.75 or under (§10.128, "Aggregate fall, ~25%")
for (const kv of (argOf('--weights', '') || '').split(',').filter(Boolean)) { const [k, v] = kv.split('='); if (k in W) W[k] = +v; else throw new Error('unknown weight ' + k + ' (known: ' + Object.keys(W).join(' ') + ')'); }
const GDPAIM = [0.90, 1.00];
const UAIM = { uUSA13: ['USA', 1913, 0.25], uUSAE: ['USA', 'end', 0.15], uGBR13: ['GBR', 1913, 0.10], uGBRE: ['GBR', 'end', 0.05],
  uGER13: ['GER', 1913, 0.20], uGERE: ['GER', 'end', 0.20], uW13: ['world', 1913, 0.60], uWE: ['world', 'end', 0.50] };
const ULABEL = { USA: 'the USA', GBR: 'Britain', GER: 'Germany', world: 'the world' };
const PRICE_LEVEL = 0.8;                                 // PI and PP: 0.8 of vanilla or under (provisional, §10.120 point 5)
const CAP_H = 0.5, CAP_SHARE = 0.02;                     // the count: a pool above 0.5 GDP, members of >= 2% of world GDP (§10.123)
const BAR_H = 1, BAR_SHARE = 0.02, BAR_YEARS = 10;       // the barrier (§10.120)
// ⭐⭐ THE SPREADS (§10.123 point 6): the standard deviation over mod 1.1.1's 15 runs on game 1.15.1 (F271's ten, session
//   20261112_113429_g1151-alt-vanilla10-canon10, and F272's five, 20261116_005659_g1151-alt-pmr15-vanilla5-canon5; setup canon), every run,
//   the barrier ignored; fitted 2026-11-21 with --fit-spreads. FIXED CONSTANTS, so a loss is comparable across books and invocations; re-fitted
//   only by a decision recorded in BALANCE_FRAMEWORK. Absolute quantities where the line is a ratio to vanilla (world GDP in £, PI and PP as
//   indices), divided by the reference in use at run time — so they are re-expressed when the reference changes (§10.123).
//   gdpAbs: world GDP at the end, £ (÷ vanilla 1.15.2's median £4.69bn = 0.139) · u: each U* aim, as a share · PIabs / PPabs: the 1935 index
//   (£ ÷ base; wage units) · PIslope / PPslope / T0slope / oldSlope: the mean per-decade change of the logarithm · cap: the count · excess: the
//   hoard above half GDP · lnr3: ln(T3 ÷ (T0 + T1 + T2)) · oldKept: the in-market test's workers kept (2–44 cases a run: the noisiest line).
const SPREAD = { gdpAbs: 652500000, u: { uUSA13: 0.1718, uUSAE: 0.08932, uGBR13: 0.07706, uGBRE: 0.007828, uGER13: 0.2098, uGERE: 0.1754, uW13: 0.03846, uWE: 0.04329 },
  PIabs: 0.03156, PIslope: 0.01525, PPabs: 0.007677, PPslope: 0.05533, cap: 0.8837, excess: 0.3686, T0slope: 0.2159, lnr3: 0.2247, oldKept: 0.5039, oldSlope: 0.6832,
  indRatio: 0.04227 };   // ⭐ indRatio (§10.128): the industry-output aggregate's 1935 ÷ 1900, fitted on the same 15 runs by --fit-spreads, 2026-11-22
const sd = a => { const s = a.filter(Number.isFinite); if (s.length < 3) return NaN; const m = mean(s); return Math.sqrt(s.reduce((x, y) => x + (y - m) ** 2, 0) / (s.length - 1)); };
const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = a => { const s = a.filter(Number.isFinite); return s.length ? s.reduce((x, y) => x + y, 0) / s.length : NaN; };
const pct = (a, p) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const f2 = (x, d = 2) => Number.isFinite(x) ? x.toFixed(d) : '—'; const r2 = x => Math.round(x * 100) / 100;
const pc = x => Number.isFinite(x) ? (100 * x).toFixed(1) + '%' : '—';
const pos = x => Number.isFinite(x) ? Math.max(0, x) : 0;
// the mean per-decade change of ln(value) over consecutive readable points [[year, value]]; a value <= 0 is read as `floor` (a fall to nothing
// is a fall), or dropped when no floor is given; NaN with fewer than two points
const slopeOf = (pts, floor = null) => { const p = pts.map(([y, v]) => [y, Number.isFinite(v) && v <= 0 && floor != null ? floor : v]).filter(([, v]) => Number.isFinite(v) && v > 0);
  if (p.length < 2) return NaN; const r = []; for (let i = 1; i < p.length; i++) r.push(Math.log(p[i][1] / p[i - 1][1]) / ((p[i][0] - p[i - 1][0]) / 10)); return mean(r); };
const BASE = Object.fromEntries(readFileSync(join(REPO, 'tools', 'goods_prices.tsv'), 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#')).map(l => l.split('\t')).map(([g, p]) => [g.trim(), +p]));
const GI = ['steel', 'tools', 'engines', 'fertilizer', 'explosives', 'dye', 'paper'], GP = ['groceries', 'clothes', 'furniture', 'glass', 'fine_art', 'automobiles', 'telephones', 'radios'], GM = ['small_arms', 'artillery', 'ammunition'];
const PYEARS = [1900, 1910, 1920, 1930, 1935];
const DEC_MID = [1904.5, 1914.5, 1924.5, 1933];          // the T0 decades 1900–09 · 1910–19 · 1920–29 · 1930–36, at their middle years

// ---- the config (T0…T3, the old plants): --config, else the run's own build_state.json; MANUFACTURING only (lib_industries.mjs)
function configFor(runDir) {
  let p = CONFIG;
  if (!p) { try { const bs = JSON.parse(readFileSync(join(runDir, 'build_state.json'), 'utf8')); const d = bs.deterministic || {}; p = (d.mod_under_test || {}).built_from_config || d.built_from_config || ''; } catch { p = ''; } }
  if (!p) return null; const abs = existsSync(p) ? p : join(REPO, p); if (!existsSync(abs)) return null;
  const cfg = JSON.parse(readFileSync(abs, 'utf8')); const tier = {}; const { kept, skipped } = manufacturing(cfg);
  for (const [, ind] of kept) for (const t of ind.tiers || []) tier[t.key] = { era: t.era, pm: t.pm_key, emp: Object.values(t.employment || {}).reduce((a, b) => a + b, 0) * (t.workforce_mult || 1) };
  // ⭐ A MERGED RUNG (`method_of`, §10.91.2) is a second main METHOD of its host building: the host's staffing is split by the levels running
  //   each main method (the summary's `pms`) and each share goes to its own rung's tier.
  for (const [, ind] of kept) for (const t of ind.tiers || []) if (t.method_of && tier[t.method_of]) (tier[t.method_of].methods ||= [{ pm: tier[t.method_of].pm, era: tier[t.method_of].era, emp: tier[t.method_of].emp }]).push({ pm: t.pm_key, era: t.era, emp: tier[t.key].emp });
  return { path: abs.replace(REPO, '').replace(/^[\\/]/, ''), tier, lag: laggardMaps(cfg), skipped };
}
// ---- one run's yearly summaries (the FIRST summary of each year), plus the 1 January summaries the backward-industry test reads (the LAST of a date)
const agg = () => ({ gdp: 0, pop: 0, prod: 0, sal: 0, un: 0, pe: 0, pool: 0, real: 0, vaSeen: 0 });
const addC = (a, c) => { const p = c.pop_statistics || {}; const sal = +p.population_salaried_workforce || 0, un = +p.population_unemployed_workforce || 0, pe = (+p.population_subsisting_workforce || 0) * 1e5;
  a.gdp += +c.gdp || 0; for (const b of Object.values(c.buildings || {})) if (b.va_out != null) { a.real += 52 * ((+b.va_out || 0) - (+b.va_in || 0)); a.vaSeen = 1; } a.pop += Object.values(c.strata || {}).reduce((x, y) => x + y, 0); a.prod += sal - (+p.population_government_workforce || 0) - (+p.population_military_workforce || 0); a.sal += sal; a.un += un; a.pe += pe; a.pool += +c.investment_pool || 0; };
const fin = a => ({ ...a, real: a.vaSeen ? a.real : NaN, W: a.pop > 0 ? a.prod / a.pop : NaN, U: (a.sal + a.un + a.pe) > 0 ? (a.un + a.pe) / (a.sal + a.un + a.pe) : NaN, H: a.gdp > 0 ? a.pool / a.gdp : NaN, Y: a.prod > 0 ? a.gdp / a.prod : NaN });
function readRun(rel, info) {
  const dir = join(SES, rel, 'save_summaries'); const years = new Map(); const wage = {}; const LY = {};
  if (!existsSync(dir)) return { years, wage, LY };
  for (const fn of readdirSync(dir).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, fn))).toString('utf8')); } catch { continue; }
    if (info) { const ly = lagYearOf(j); if (ly != null) LY[ly] = laggardCountries(j, info.lag.MOD, info.lag.TIERKEYS); }
    const y = +String((j.provenance && j.provenance.date) || '').split('.')[0]; if (!y || years.has(y)) continue;
    const C = j.countries || {}; const world = agg(), pool = agg(); const members = {}; const T = { w: [0, 0, 0, 0], s: [0, 0, 0, 0] };
    let exA = 0, exG = 0;   // the hoard above half GDP: Σ max(0, pool − 0.5 GDP) and Σ GDP over the shortlist's countries
    for (const [tag, c] of Object.entries(C)) { addC(world, c); const inPool = POOL.includes(tag);
      if (inPool) { addC(pool, c); const g = +c.gdp || 0; exG += g; exA += Math.max(0, (+c.investment_pool || 0) - 0.5 * g); }
      if (info) for (const [k, b] of Object.entries(c.buildings || {})) { const t = info.tier[k]; if (!t) continue;
        const lv = t.methods && b.pms ? t.methods.map(m => +b.pms[m.pm] || 0) : null; const tot = lv ? lv.reduce((x, z) => x + z, 0) : 0;
        const parts = tot > 0 ? t.methods.map((m, i) => ({ era: m.era, w: (+b.staffing || 0) * (lv[i] / tot) * m.emp })) : [{ era: t.era, w: (+b.staffing || 0) * t.emp }];
        for (const p of parts) { T.w[p.era] += p.w; if (inPool) T.s[p.era] += p.w; } } }
    world.gdp = +j.world.gdp || world.gdp;
    for (const m of MEMBER) { const tag = (MEMBER_FAMILY[m] || [m]).find(x => C[x]); const c = tag && C[tag]; if (!c) { members[m] = null; continue; } const a = agg(); addC(a, c); members[m] = { tag, ...fin(a), share: world.gdp > 0 ? a.gdp / world.gdp : NaN }; }
    wage[y] = {}; for (const tag of PRICE_TAGS) if (C[tag]) wage[y][tag] = +C[tag].base_wage || NaN;
    years.set(y, { world: fin(world), pool: fin(pool), members, T, excess: exG > 0 ? exA / exG : NaN });
  }
  return { years, wage, LY };
}
// ---- prices from markets.tsv: per dump year, per MARKET NAME (the name does not identify the leader: resolved per year), per good
const PRICE_MARKET_NAMES = new Set(PRICE_TAGS.flatMap(t => MARKET_NAMES[t] || []));
function readPrices(rel) {
  const f = join(SES, rel, 'markets.tsv'); const out = {}; if (!existsSync(f)) return out;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const c = line.split('\t'); if (c.length < 8) continue; const y = +String(c[1]).split('.')[0]; if (!PYEARS.includes(y)) continue;
    if (!PRICE_MARKET_NAMES.has(c[2])) continue; const g = c[4], p = +c[7]; if (!(p > 0) || !BASE[g]) continue;
    ((out[y] ||= {})[c[2]] ||= {})[g] = p;
  }
  return out;
}
const tagForMarket = (name, wageRow) => PRICE_TAGS.find(t => (MARKET_NAMES[t] || []).includes(name) && wageRow && Number.isFinite(wageRow[t])) || TAG_OF_MARKET[name];
const priceIdx = (P, wage, y, goods, unit, basis = null) => med(Object.entries(P[y] || {})
  .filter(([name]) => !basis || basis.has(name))
  .flatMap(([name, gs]) => { const tag = tagForMarket(name, wage[y]); const w = wage[y] && wage[y][tag];
    return goods.map(g => gs[g] ? (unit === 'wage' ? (w > 0 ? gs[g] / w : NaN) : gs[g] / BASE[g]) : NaN); }));
const marketsIn = (P, y) => new Set(Object.keys(P[y] || {}));
const endMean = (years, f) => mean([...years.entries()].filter(([y]) => y >= E0 && y <= E1).map(([, v]) => f(v)));
const at = (years, y, f) => years.has(y) ? f(years.get(y)) : NaN;
const runsOf = spec => { const [s, setup] = spec.split(':'); const { runs, dropped } = usableRuns(SES, s, setup || ''); if (!QUIET) reportDropped(dropped); return runs; };

// ---- the arms' runs, and the first arm's book: it also maps vanilla's methods (`vanilla_pm`) for the backward-industry test on the vanilla
//      runs, as laggard_pressure.mjs does, so vanilla's reading of the old-plants line sits beside the mod's like for like
const RELS = Object.fromEntries(ARMS.map(spec => [spec, runsOf(spec)]));
const firstInfo = (() => { for (const spec of ARMS) if (RELS[spec].length) return configFor(join(SES, RELS[spec][0])); return null; })();
const vanInfo = firstInfo ? { vanilla: true, tier: {}, lag: { ...firstInfo.lag, MOD: firstInfo.lag.VAN } } : null;
// ---- vanilla: the end-state medians the ratios are taken against, the 1836–1845 range, the decade path, the price basis
const vanRaw = runsOf(VAN).map(rel => ({ rel, ...readRun(rel, vanInfo), P: readPrices(rel) }));
if (!vanRaw.length && !FIT) { console.error('no usable vanilla run in ' + VAN); process.exit(1); }
const ref = {};
for (const sc of ['world', 'pool']) for (const q of ['gdp', 'W', 'U', 'H', 'Y', 'real']) ref[sc + '.' + q] = med(vanRaw.map(r => endMean(r.years, v => v[sc][q])));
const VANBASIS = {}; for (const y of PYEARS) VANBASIS[y] = new Set(vanRaw.flatMap(r => [...marketsIn(r.P, y)]).map(seriesOf));
ref.PI = med(vanRaw.map(r => priceIdx(r.P, r.wage, 1935, GI, 'base'))); ref.PP = med(vanRaw.map(r => priceIdx(r.P, r.wage, 1935, GP, 'wage'))); ref.PM = med(vanRaw.map(r => priceIdx(r.P, r.wage, 1935, GM, 'base')));
for (const y of PYEARS) { ref['PI.' + y] = med(vanRaw.map(r => priceIdx(r.P, r.wage, y, GI, 'base'))); ref['PP.' + y] = med(vanRaw.map(r => priceIdx(r.P, r.wage, y, GP, 'wage'))); }
const gdpVan = (() => { const v = vanRaw.map(r => endMean(r.years, x => x.world.gdp)).filter(Number.isFinite); const m = ref['world.gdp']; return v.length && m > 0 ? { lo: pct(v, 0.025) / m, hi: pct(v, 0.975) / m, n: v.length } : null; })();
const DECADES = [1846, 1856, 1866, 1876, 1886, 1896, 1906, 1916, 1926, 1936]; const LINE1886 = [0.79, 1.01];   // §10.96.1
const vanDec = {}; for (const y of DECADES) vanDec[y] = med(vanRaw.map(v => at(v.years, y, x => x.world.gdp)));
const ci = {}; for (let y = 1836; y <= 1845; y++) { const v = vanRaw.map(r => at(r.years, y, x => x.world.gdp)).filter(Number.isFinite); if (v.length >= 8) ci[y] = { lo: pct(v, 0.05), hi: pct(v, 0.95) }; }

// ---- one run
function scoreRun(rel, info, pre = null) {
  const { years, wage, LY } = pre || readRun(rel, info); const P = pre ? pre.P : readPrices(rel); const r = { rel, famWarn: [] };
  const ys = [...years.keys()].sort((a, b) => a - b);
  // world GDP, the decade path, the 1836–1845 start
  r.gdpW_abs = endMean(years, v => v.world.gdp); r.gdpW = r.gdpW_abs / ref['world.gdp'];
  r.gdp35 = at(years, 1935, v => v.world.gdp) / med(vanRaw.map(v => at(v.years, 1935, x => x.world.gdp)));
  r.path = {}; for (const y of DECADES) r.path[y] = at(years, y, v => v.world.gdp) / vanDec[y];
  { let viol = 0; const det = []; for (let y = 1836; y <= 1845; y++) { const c = ci[y], g = at(years, y, v => v.world.gdp); if (!c || !Number.isFinite(g)) continue;
      if (g < 0.9 * c.lo) { viol++; det.push(y + ' ' + f2(g / c.lo) + '× its low end'); } else if (g > 1.1 * c.hi) { viol++; det.push(y + ' ' + f2(g / c.hi) + '× its high end'); } }
    r.anchor = { viol, det, flagged: viol > 2 }; }
  // the minor readings against vanilla
  for (const s of ['world', 'pool']) for (const q of ['W', 'U', 'H', 'Y']) { r[s + q + '_abs'] = endMean(years, v => v[s][q]); r[s + q] = r[s + q + '_abs'] / ref[s + '.' + q]; }
  r.gdpP = endMean(years, v => v.pool.gdp) / ref['pool.gdp']; r.realW = endMean(years, v => v.world.real) / ref['world.real']; r.realP = endMean(years, v => v.pool.real) / ref['pool.real'];
  r.plW = r.gdpW / r.realW; r.plP = r.gdpP / r.realP; r.poolU13_abs = at(years, 1913, v => v.pool.U);
  // the eight depeasantation aims
  r.u = {}; for (const [k, [who, when]] of Object.entries(UAIM)) { const pick = v => who === 'world' ? v.world.U : (v.members[who] ? v.members[who].U : NaN); r.u[k] = when === 'end' ? endMean(years, pick) : at(years, when, pick); }
  // the prices: the basis = this run's markets ∩ vanilla's, one name per series, per year
  const bas = {};
  for (const y of PYEARS) { const g = groupBySeries(marketsIn(P, y)); const keep = new Set();
    for (const [ser, names] of Object.entries(g)) { if (!VANBASIS[y].has(ser)) continue; const fam = MARKET_FAMILY[ser];
      keep.add(fam ? (fam.flatMap(t => MARKET_NAMES[t] || []).find(n => names.includes(n)) || names[0]) : names[0]); }
    bas[y] = keep; for (const c of marketCollisions(marketsIn(P, y))) r.famWarn.push(y + ' ' + c.key + ': ' + c.live.join(' + ')); }
  r.basis = [...bas[1935]].map(seriesOf).sort(); r.basisDropped = [...new Set([...marketsIn(P, 1935)].map(seriesOf))].filter(s => !VANBASIS[1935].has(s)).sort();
  r.PI_abs = priceIdx(P, wage, 1935, GI, 'base', bas[1935]); r.PI = r.PI_abs / ref.PI; r.PP_abs = priceIdx(P, wage, 1935, GP, 'wage', bas[1935]); r.PP = r.PP_abs / ref.PP;
  r.PM = priceIdx(P, wage, 1935, GM, 'base', bas[1935]) / ref.PM;
  r.PIpath = PYEARS.map(y => priceIdx(P, wage, y, GI, 'base', bas[y])); r.PPpath = PYEARS.map(y => priceIdx(P, wage, y, GP, 'wage', bas[y]));
  r.PIslope = slopeOf(PYEARS.map((y, i) => [y, r.PIpath[i]])); r.PPslope = slopeOf(PYEARS.map((y, i) => [y, r.PPpath[i]]));
  const every = a => a.every((v, i) => i === 0 || !(Number.isFinite(v) && Number.isFinite(a[i - 1])) || v <= a[i - 1]);
  r.PIfallsEvery = every(r.PIpath); r.PPfallsEvery = every(r.PPpath);
  // the industry-price term (§10.128): the run's own aggregate of scalable industry output, 1935 ÷ 1900, on its own markets (lib_prices.mjs)
  { const M = readMarketRun(join(SES, rel)); const f = M ? industryFall(M.P) : { path: [], ratio: NaN }; r.indPath = f.path; r.indRatio = f.ratio; }
  // capital: the count (1935–36) and the hoard above half GDP (the end)
  { const who = [];
    for (const m of MEMBER) { const v = [1935, 1936].map(y => years.has(y) ? years.get(y).members[m] : null).filter(Boolean); if (!v.length) continue;
      const h = mean(v.map(x => x.H)), s = mean(v.map(x => x.share)); if (s >= CAP_SHARE && h > CAP_H) who.push({ m, tag: v[v.length - 1].tag, h, share: s }); }
    r.cap = { count: years.has(1935) || years.has(1936) ? who.length : NaN, who }; }
  r.excess = endMean(years, v => v.excess);
  // THE BARRIER: the worst member's best ten-year mean of pool ÷ GDP, over windows of ten consecutive years in each of which it holds >= 2% of world GDP
  { let b = { value: 0, m: null };
    for (const m of MEMBER) for (let i = 0; i + BAR_YEARS <= ys.length; i++) { const win = ys.slice(i, i + BAR_YEARS); if (win[BAR_YEARS - 1] - win[0] !== BAR_YEARS - 1) continue;
      let s = 0, ok = true; for (const y of win) { const c = years.get(y).members[m]; if (!c || !(c.share >= BAR_SHARE) || !Number.isFinite(c.H)) { ok = false; break; } s += c.H; }
      if (ok && s / BAR_YEARS > b.value) b = { value: s / BAR_YEARS, m, tag: years.get(win[BAR_YEARS - 1]).members[m].tag, from: win[0], to: win[BAR_YEARS - 1] }; }
    b.past = b.value >= BAR_H; r.barrier = b; }
  r.broken = r.barrier.past ? 'barrier' : null;
  r.hard = r.barrier.past ? ['past the barrier: ' + r.barrier.m + ' (' + r.barrier.tag + ') held a pool of ' + f2(r.barrier.value) + ' of its GDP on average over ' + r.barrier.from + '–' + r.barrier.to + ' (the line: 1 or more, a member of at least 2% of world GDP)'] : [];
  r.soft = [];   // no soft lines since §10.120 (kept empty for readers of the older JSON)
  // T0…T3 (the shortlist; manufacturing) — a mod run only
  if (info && !info.vanilla) {
    const tw = (y, i) => years.has(y) ? years.get(y).T.s[i] : NaN; const dec = (a, b, i) => mean(ys.filter(y => y >= a && y <= b).map(y => tw(y, i)));
    const end = [0, 1, 2, 3].map(i => mean(ys.filter(y => y >= E0 && y <= E1).map(y => tw(y, i))));
    r.T = { end, worldEnd: [0, 1, 2, 3].map(i => mean(ys.filter(y => y >= E0 && y <= E1).map(y => years.get(y).T.w[i]))), t36: tw(1936, 0), dec0: [dec(1900, 1909, 0), dec(1910, 1919, 0), dec(1920, 1929, 0), dec(1930, 1936, 0)] };
    r.T.slope0 = slopeOf(DEC_MID.map((y, i) => [y, r.T.dec0[i]]), 1); r.T.ratio0 = tw(1935, 0) / r.T.dec0[0];
    r.T.declining = r.T.dec0.every((v, i, a) => i === 0 || !(Number.isFinite(v) && Number.isFinite(a[i - 1])) || v < a[i - 1]);
    const lo = end[0] + end[1] + end[2], all = lo + end[3]; r.T.r3 = lo > 0 ? end[3] / lo : NaN; r.T.share3 = all > 0 ? end[3] / all : NaN;
  }
  // the old plants pushed out: the in-market backward-industry test, this run's cases by decade (a vanilla run through the book's vanilla_pm map)
  if (info) {
    const o = inMarketByDecade(LY, info.lag.NEXT, info.lag.INDNAME);
    const byDec = Object.fromEntries(Object.entries(o.byDec).map(([y, x]) => [y, { kept: x.w > 0 ? x.w2 / x.w : NaN, n: x.n, w: x.w, w2: x.w2 }]));
    r.old = { kept: o.w > 0 ? o.w2 / o.w : NaN, n: o.n, w: o.w, w2: o.w2, byDec, slope: slopeOf(Object.entries(byDec).map(([y, x]) => [+y, x.kept]), 0.01) };
  }
  return r;
}

// ---- the loss of one run or a consensus
function lossOf(o) {
  const t = {}, missing = [];
  const sG = SPREAD.gdpAbs / ref['world.gdp'], x = o.gdpW;
  t.gdp = (x < GDPAIM[0] ? GDPAIM[0] - x : x > GDPAIM[1] ? x - GDPAIM[1] : 0) / sG;
  for (const [k, [, , aim]] of Object.entries(UAIM)) t[k] = Math.abs(o.u[k] - aim) / SPREAD.u[k];
  t.ind = Number.isFinite(o.indRatio) ? pos(o.indRatio - IND_AIM) / SPREAD.indRatio : NaN;   // §10.128: how far above 0.75, in spreads
  t.cap = o.cap.count / SPREAD.cap; t.hoard = o.excess / SPREAD.excess;
  if (o.T) { if (o.T.t36 === 0) t.T0 = 0; else { if (!Number.isFinite(o.T.slope0)) missing.push('T0 slope'); t.T0 = pos(o.T.slope0) / SPREAD.T0slope; }
    t.T3 = Number.isFinite(o.T.r3) && o.T.r3 > 0 ? pos(-Math.log(o.T.r3)) / SPREAD.lnr3 : NaN; }
  if (o.old) { if (!Number.isFinite(o.old.slope)) missing.push('old-plants slope'); t.old = Number.isFinite(o.old.kept) ? pos(o.old.kept - 1) / SPREAD.oldKept + pos(o.old.slope) / SPREAD.oldSlope : NaN; }
  let L = 0; const parts = {}; for (const [k, w] of Object.entries(W)) { if (!(k in t) || !Number.isFinite(t[k])) { if (w) missing.push(k); continue; } parts[k] = w * t[k]; L += parts[k]; }
  return { L, parts, terms: t, missing };
}
// ---- the consensus: the median of the runs not past the barrier (with three, the two closest on world GDP)
const consensusOf = runs => {
  const ok = runs.filter(r => !r.broken), pool = CONS_MODE === 'all' ? runs : ok, kind = CONS_MODE === 'all' ? 'usable, past the barrier included' : 'not past the barrier';
  let cons = pool, note;
  if (!pool.length) note = CONS_MODE === 'all' ? 'no usable run' : 'every run is past the barrier — no aims are read';
  else if (pool.length === 1) note = 'n=1 ' + kind + ' — read as is';
  else if (pool.length === 2) note = 'n=2 ' + kind + ' — the median (mean) of both';
  else if (pool.length === 3) { let best = null; for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) { const d = Math.abs(pool[i].gdpW - pool[j].gdpW); if (!best || d < best.d) best = { d, i, j }; } cons = [pool[best.i], pool[best.j]]; note = 'n=3 ' + kind + ' — the two closest on world GDP (' + cons.map(r => r.rel.split('/').pop()).join(' + ') + ')'; }
  else note = 'n=' + pool.length + ' ' + kind + ' — the median of all';
  if (CONS_MODE === 'all') note += ' (--consensus all, NOT the ruled form, which reads the ' + ok.length + ' run(s) not past the barrier)';
  const band = (v, e) => { const i = e.findIndex(x => v < x); return i === -1 ? e.length : i; };
  const diverges = (a, b) => (band(a.gdpW, [0.6, 0.9, 1.1, 1.5]) !== band(b.gdpW, [0.6, 0.9, 1.1, 1.5]) && Math.abs(a.gdpW - b.gdpW) >= 0.15) || (band(a.worldW, [0.4, 0.55, 0.72, 0.9]) !== band(b.worldW, [0.4, 0.55, 0.72, 0.9]) && Math.abs(a.worldW - b.worldW) >= 0.10);
  const divergent = cons.length === 2 && diverges(cons[0], cons[1]);
  if (divergent) note += ' — DIVERGENT under F114 (world GDP ' + cons.map(r => f2(r.gdpW)).join(' / ') + ', world W ' + cons.map(r => f2(r.worldW)).join(' / ') + '): no consensus, a third run is needed';
  const C = { note, mode: CONS_MODE, runs: cons.map(r => r.rel), intact: ok.length, past: runs.length - ok.length, divergent };
  C.barrier = { past: runs.filter(r => r.barrier.past).length, of: runs.length, values: runs.map(r => r.barrier.value), worst: [...runs].sort((p, q) => q.barrier.value - p.barrier.value)[0]?.barrier || null };
  C.path = {}; for (const y of DECADES) { const v = runs.map(r => r.path && r.path[y]).filter(Number.isFinite); C.path[y] = { med: med(v), sd: sd(v), n: v.length }; }
  { const m = C.path[1886] && C.path[1886].med; C.line1886 = { lo: LINE1886[0], hi: LINE1886[1], med: m, beyond: Number.isFinite(m) && (r2(m) < LINE1886[0] || r2(m) > LINE1886[1]) }; }
  C.anchor = { flagged: runs.filter(r => r.anchor.flagged).length, viol: runs.map(r => r.anchor.viol) };
  if (!cons.length) return C;
  for (const k of ['gdpW', 'gdpW_abs', 'gdp35', 'gdpP', 'poolW', 'poolU', 'poolH', 'poolY', 'worldW', 'worldU', 'worldH', 'worldY', 'poolW_abs', 'worldW_abs', 'poolU_abs', 'worldU_abs', 'poolH_abs', 'worldH_abs', 'poolU13_abs',
    'PI', 'PI_abs', 'PIslope', 'PP', 'PP_abs', 'PPslope', 'PM', 'realW', 'realP', 'plW', 'plP', 'excess', 'indRatio']) C[k] = med(cons.map(r => r[k]));
  C.indPath = (cons[0].indPath || []).map((_, i) => med(cons.map(r => (r.indPath || [])[i])));
  C.u = Object.fromEntries(Object.keys(UAIM).map(k => [k, med(cons.map(r => r.u[k]))]));
  C.uRange = Object.fromEntries(Object.keys(UAIM).map(k => { const v = cons.map(r => r.u[k]).filter(Number.isFinite); return [k, v.length ? [Math.min(...v), Math.max(...v)] : null]; }));
  C.cap = { count: med(cons.map(r => r.cap.count)), who: cons.flatMap(r => r.cap.who.map(w => w.m)).reduce((o, m) => (o[m] = (o[m] || 0) + 1, o), {}) };
  C.PIpath = PYEARS.map((_, i) => med(cons.map(r => r.PIpath[i]))); C.PPpath = PYEARS.map((_, i) => med(cons.map(r => r.PPpath[i])));
  C.PIfallsEvery = cons.filter(r => r.PIfallsEvery).length >= cons.length / 2; C.PPfallsEvery = cons.filter(r => r.PPfallsEvery).length >= cons.length / 2;
  if (cons[0].T) { C.T = { slope0: med(cons.map(r => r.T.slope0)), ratio0: med(cons.map(r => r.T.ratio0)), r3: med(cons.map(r => r.T.r3)), share3: med(cons.map(r => r.T.share3)), t36: med(cons.map(r => r.T.t36)),
      dec0: [0, 1, 2, 3].map(i => med(cons.map(r => r.T.dec0[i]))), end: [0, 1, 2, 3].map(i => med(cons.map(r => r.T.end[i]))) };
    C.T.declining = C.T.dec0.every((v, i, a) => i === 0 || !(Number.isFinite(v) && Number.isFinite(a[i - 1])) || v < a[i - 1]); }
  if (cons[0].old) { const W2 = {}; for (const r of cons) for (const [y, x] of Object.entries(r.old.byDec)) { const o = (W2[y] ||= { w: 0, w2: 0, n: 0 }); o.w += x.w; o.w2 += x.w2; o.n += x.n; }
    C.old = { kept: med(cons.map(r => r.old.kept)), slope: med(cons.map(r => r.old.slope)), n: cons.reduce((a, r) => a + r.old.n, 0),
      pooled: Object.fromEntries(Object.entries(W2).map(([y, x]) => [y, { kept: x.w > 0 ? x.w2 / x.w : NaN, n: x.n }])) }; }
  return C;
};

// ---- read every arm
const arms = ARMS.map(spec => { const rels = RELS[spec]; const info = rels.length ? configFor(join(SES, rels[0])) : null; return { spec, info, runs: rels.map(rel => scoreRun(rel, info)) }; });
if (FIT) {   // ---- --fit-spreads: the SPREAD literal from every run read
  const all = arms.flatMap(a => a.runs), S = v => +sd(v).toPrecision(4);
  const fit = { gdpAbs: S(all.map(r => r.gdpW_abs)), u: Object.fromEntries(Object.keys(UAIM).map(k => [k, S(all.map(r => r.u[k]))])),
    PIabs: S(all.map(r => r.PI_abs)), PIslope: S(all.map(r => r.PIslope)), PPabs: S(all.map(r => r.PP_abs)), PPslope: S(all.map(r => r.PPslope)), indRatio: S(all.map(r => r.indRatio)),
    cap: S(all.map(r => r.cap.count)), excess: S(all.map(r => r.excess)), T0slope: S(all.map(r => r.T && r.T.slope0)), lnr3: S(all.map(r => r.T && r.T.r3 > 0 ? Math.log(r.T.r3) : NaN)),
    oldKept: S(all.map(r => r.old && r.old.kept)), oldSlope: S(all.map(r => r.old && r.old.slope)) };
  console.log('fitted on ' + all.length + ' run(s): ' + arms.map(a => a.spec + ' (' + a.runs.length + ')').join(', '));
  console.log('readable per quantity: old-plants kept ' + all.filter(r => r.old && Number.isFinite(r.old.kept)).length + ', its slope ' + all.filter(r => r.old && Number.isFinite(r.old.slope)).length + ', in-market cases per run ' + all.map(r => r.old ? r.old.n : '—').join(' ') + '; T0 slope ' + all.filter(r => r.T && Number.isFinite(r.T.slope0)).length);
  console.log('per run (rel · world GDP £M · PI slope · PP slope · T0 slope · ln T3 ratio · old kept · old slope · count · excess · barrier):');
  for (const r of all) console.log('  ' + r.rel.padEnd(70) + [f2(r.gdpW_abs / 1e6, 0), f2(r.PIslope, 3), f2(r.PPslope, 3), f2(r.T && r.T.slope0, 3), f2(r.T && Math.log(r.T.r3), 3), f2(r.old && r.old.kept, 3), f2(r.old && r.old.slope, 3), r.cap.count, f2(r.excess, 3), f2(r.barrier.value, 2)].join('  '));
  console.log('const SPREAD = ' + JSON.stringify(fit) + ';');
  process.exit(0);
}
if (!SPREAD) { console.error('criteria.mjs: no SPREAD constants — fit them with --fit-spreads (BALANCE_FRAMEWORK §10.123)'); process.exit(1); }
for (const a of arms) { a.C = consensusOf(a.runs); for (const r of a.runs) r.loss = r.broken && CONS_MODE !== 'all' ? null : lossOf(r); a.C.loss = a.C.runs.length && !a.C.divergent ? lossOf(a.C) : null; }
// vanilla's own readings of the same lines (a reference beside the mod's levels, never their yardstick: §10.120 point 4)
const vanRuns = vanRaw.map(v => scoreRun(v.rel, vanInfo, v));
const vanReading = { n: vanRuns.length, barrierPast: vanRuns.filter(r => r.barrier.past).length, u: Object.fromEntries(Object.keys(UAIM).map(k => [k, med(vanRuns.map(r => r.u[k]))])),
  cap: med(vanRuns.map(r => r.cap.count)), excess: med(vanRuns.map(r => r.excess)), PIslope: med(vanRuns.map(r => r.PIslope)), PPslope: med(vanRuns.map(r => r.PPslope)),
  indRatio: med(vanRuns.map(r => r.indRatio)),
  poolU13_abs: med(vanRuns.map(r => r.poolU13_abs)), poolU_abs: med(vanRuns.map(r => r.poolU_abs)),
  old: vanInfo ? { kept: med(vanRuns.map(r => r.old && r.old.kept)), slope: med(vanRuns.map(r => r.old && r.old.slope)), n: vanRuns.reduce((a, r) => a + (r.old ? r.old.n : 0), 0) } : null };

// ---- print
if (!QUIET) {
  const vOf = { gdp: C => f2(C.gdpW) + '×', ind: C => f2(C.indRatio) + ' (vanilla ' + f2(vanReading.indRatio) + ')', cap: C => String(C.cap.count), hoard: C => f2(C.excess, 3),
    T0: C => C.T ? 'slope ' + f2(C.T.slope0, 3) + (C.T.t36 === 0 ? ' (0 in 1936)' : '') : '—', T3: C => C.T ? f2(C.T.r3, 3) + ' (' + pc(C.T.share3) + ' of tiered)' : '—', old: C => C.old ? pc(C.old.kept) + ', slope ' + f2(C.old.slope, 3) : '—' };
  const aimOf = { gdp: '0.90–1.00', ind: '≤ ' + IND_AIM, cap: '0', hoard: '0', T0: '0 in 1936 or falling', T3: 'the more the better', old: '< 100%, shrinking' };
  for (const [k, [who, when, aim]] of Object.entries(UAIM)) { vOf[k] = C => pc(C.u[k]); aimOf[k] = pc(aim); }
  const LBL = { gdp: 'world GDP ÷ vanilla', ind: 'industry prices ' + IND_TO + ' ÷ ' + IND_FROM, cap: 'members above 0.5 GDP', hoard: 'hoard above half GDP', T0: 'T0 (manufacturing)', T3: 'T3 ÷ (T0+T1+T2)', old: 'old plants kept' };
  for (const [k, [who, when]] of Object.entries(UAIM)) LBL[k] = 'U* ' + ULABEL[who] + ', ' + (when === 'end' ? 'the end' : when);
  console.log('THE CRITERIA REGISTER — the loss of the mod 1.2 calibration (BALANCE_FRAMEWORK §10.120, §10.121, §10.123) · the end = the ' + E0 + '–' + E1 + ' mean · vanilla ' + VAN + ' (n=' + vanRaw.length + ')');
  console.log('vanilla end state: world GDP £' + f2(ref['world.gdp'] / 1e6, 0) + 'M (its runs ' + f2(gdpVan?.lo) + '–' + f2(gdpVan?.hi) + '× of the median) · PI ' + f2(ref.PI) + ' of base · PP ' + f2(ref.PP, 1) + ' wage units · its runs past the barrier ' + vanReading.barrierPast + ' of ' + vanReading.n);
  for (const a of arms) {
    console.log('\n' + '='.repeat(150) + '\n' + a.spec + ' · ' + a.runs.length + ' usable run(s) · ' + (a.info ? a.info.path + (a.info.skipped.length ? ' · not manufacturing, left out of T0–T3 and the old plants: ' + a.info.skipped.join(', ') : '') : 'no config → T0–T3 and the old plants not read'));
    console.log('--- THE BARRIER, per run (the worst shortlist member of >= 2% of world GDP: its best ten-year mean of pool ÷ GDP; past at 1) ---');
    for (const r of a.runs) { const b = r.barrier; console.log('  ' + r.rel.split('/').slice(-2).join('/').padEnd(64) + (b.past ? '⛔ PAST THE BARRIER' : '✅ not past').padEnd(22) + f2(b.value) + (b.m ? ' (' + b.m + ' ' + b.from + '–' + b.to + ')' : '') + '  [world GDP ' + f2(r.gdpW) + '×' + (r.loss ? '; loss ' + f2(r.loss.L, 2) : '') + (r.anchor.flagged ? '; ⚠ 1836–45 start outside vanilla’s range in ' + r.anchor.viol + ' years' : '') + ']'); }
    const C = a.C; console.log('--- CONSENSUS: ' + C.note + ' ---'); if (!C.runs.length) continue;
    const b0 = a.runs.find(r => r.basis && r.basis.length);
    if (b0 && b0.famWarn.length) console.log('  ⚠ SUCCESSION ANOMALY — two forms of one state alive at once: ' + [...new Set(b0.famWarn)].join(' | '));
    if (b0) console.log('  price basis (PI/PP, arm ∩ vanilla): ' + (b0.basis.join(', ') || 'NONE') + (b0.basisDropped.length ? '   (also carried, not in the index: ' + b0.basisDropped.join(', ') + ')' : ''));
    console.log('  ' + 'line'.padEnd(30) + 'reading'.padEnd(30) + 'aim'.padEnd(22) + 'd'.padStart(6) + '   w·d');
    for (const k of Object.keys(W)) { const d = C.loss ? C.loss.terms[k] : NaN; console.log('  ' + LBL[k].padEnd(30) + vOf[k](C).padEnd(30) + aimOf[k].padEnd(22) + f2(d).padStart(6) + '   ' + (C.loss && C.loss.parts[k] != null ? f2(C.loss.parts[k]) : '—')); }
    if (C.loss) console.log('  LOSS ' + f2(C.loss.L) + (C.loss.missing.length ? '   (not read, counted 0: ' + C.loss.missing.join(', ') + ')' : ''));
    else if (C.divergent) console.log('  LOSS — (divergent pair, no consensus)');
    console.log('  minor readings (no weight): W world ' + f2(C.worldW) + '× · shortlist ' + f2(C.poolW) + '× · shortlist GDP ' + f2(C.gdpP) + '× · H world ' + f2(C.worldH_abs) + ' (' + f2(C.worldH) + '×) · shortlist ' + f2(C.poolH_abs) + ' (' + f2(C.poolH) + '×) · the shortlist’s U* ' + pc(C.poolU13_abs) + ' in 1913, ' + pc(C.poolU_abs) + ' at the end · PM ' + f2(C.PM) + '× · GDP at base prices ' + f2(C.realW) + '×' + ' · PI ' + f2(C.PI) + '× (slope ' + f2(C.PIslope, 3) + ') · PP ' + f2(C.PP) + '× (slope ' + f2(C.PPslope, 3) + '), out of the loss since §10.128');
    console.log('  world GDP by decade ÷ vanilla: ' + DECADES.map(y => String(y).slice(2) + ' ' + f2(C.path[y].med)).join(' · ') + '   the 1886 line ' + f2(LINE1886[0]) + '–' + f2(LINE1886[1]) + ': ' + (C.line1886.beyond ? 'BEYOND' : 'inside') + ' · the 1836–45 start flagged in ' + C.anchor.flagged + ' run(s)');
  }
  console.log('\n' + '='.repeat(150) + '\nRANKING by the consensus loss (lower is better; directional at n=2–3, CLAUDE.md §2.9); a book with every run past the barrier ranks by the barrier line');
  for (const a of [...arms].sort((x, y) => (x.C.loss ? x.C.loss.L : 1e9 + med(x.runs.map(r => r.barrier.value))) - (y.C.loss ? y.C.loss.L : 1e9 + med(y.runs.map(r => r.barrier.value))))) {
    const C = a.C; console.log('  ' + a.spec.slice(0, 77).padEnd(78) + ('past ' + C.past + '/' + a.runs.length).padEnd(12) + (C.loss ? 'loss ' + f2(C.loss.L) : C.divergent ? 'DIVERGENT' : 'barrier line ' + f2(med(a.runs.map(r => r.barrier.value)))) + (C.runs.length ? '  world GDP ' + f2(C.gdpW) + '×' : '')); }
}
if (JSON_OUT) { writeFileSync(JSON_OUT, JSON.stringify({ register: '§10.123', amended: '§10.128', van: VAN, vanN: vanRaw.length, end: [E0, E1], ref, spread: SPREAD, weights: W, gdpAim: GDPAIM, uAim: UAIM, priceLevel: PRICE_LEVEL,
  indAim: IND_AIM, indWindow: [IND_FROM, IND_TO],
  barrierRule: { h: BAR_H, share: BAR_SHARE, years: BAR_YEARS }, capRule: { h: CAP_H, share: CAP_SHARE }, gdpVan, ci, vanDec, line1886: LINE1886, vanReading,
  arms: arms.map(a => ({ spec: a.spec, config: a.info && a.info.path, skipped: a.info ? a.info.skipped : null, runs: a.runs, consensus: a.C })) }, null, 1)); if (!QUIET) console.log('wrote ' + JSON_OUT); }
