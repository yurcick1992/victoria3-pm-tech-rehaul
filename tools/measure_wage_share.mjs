#!/usr/bin/env node
// ⭐⭐ WHAT DOES THE SAVE'S `profit` CONTAIN, AND WHAT IS THE WAGE SHARE OF AN ECONOMY IN A DECADE?
//
// Read-only. This is the instrument behind FINDINGS **F152** and the calibration `tools/lib_wage_model.mjs`
// ships: it repairs F92's margin identity (F150) and measures the two numbers a PREDICTION needs — the
// country's normal wage rate, and the premium buildings actually pay over it.
//
// THE ARITHMETIC, per (country × year), over PRODUCTION buildings only:
//   R = va_out × priceMultiplier(the building's own output mix)     value added, re-priced to MARKET
//   I = va_in  × priceMultiplier(its input mix)
//   implied wage bill  = R − I − profit                             ⇐ what the ENGINE actually paid
//   modelled wage bill = (base_wage ÷ POP_SIZE_PACKAGE) × Σ(emp × wage_weight) × staffed levels
//   premium            = implied ÷ modelled   ⚠⚠ RETIRED as a constant by F152 §10 — it measured the PRICE APPROXIMATION,
//                                                  not a wage premium. From save-summary v9 read goods_sales/goods_cost instead.
// The goods mix comes from the ACTIVE production methods the summary records per building type (`pms`),
// read live from the game for vanilla keys and from the run's own config for a tiered key.
//
// ⚠ EXCLUDED, each for a stated reason, not to flatter the fit:
//   · shipyards — their income from naval ship construction is not in the goods flows at all (the same
//     reason the era solver carries a −30pp shipyard handicap), so R understates revenue and the implied
//     wage bill comes out NEGATIVE. The one production type that does.
//   · subsistence — its own wage rules (STARTING_WAGE_RATE_SUBSISTENCE_MULTIPLIER 0.5, and
//     SUBSISTENCE_OUTPUT_AVERAGE_WAGE_RATE_FACTOR counts output as wage), so the normal rate does not price it.
//   · subsidised levels — a subsidy is government money inside `profit`.
//   · any building more than 2% of whose base-priced flows are goods the market has no price for.
// ⚠ Buildings with NO goods flows (financial districts, manor houses, company HQs) cannot be scored at all
//   and are counted separately — that is F150's finding, not a gap in this tool.
//
// usage:
//   node tools/measure_wage_share.mjs --run <session/run> [--run …] [--years 1840,1860,…] [--detail]
//   node tools/measure_wage_share.mjs --write-wages [--van <vanilla session>]
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { readVanilla } from './lib_vanilla_ladder.mjs';
import { WAGE_WEIGHT, POP_SIZE_PACKAGE, wageUnits, priceMultiplier } from './lib_wage_model.mjs';
import { usableRuns, reportDropped } from './testbed/ledger/lib_runs.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const SES = join(REPO, 'tools/testbed/sessions');
const argOf = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const argAll = k => process.argv.reduce((a, v, i) => (v === k && process.argv[i + 1] ? [...a, process.argv[i + 1]] : a), []);
const has = k => process.argv.includes(k);

// the instrumented markets, by the tag that leads them. A market is named for its leader's ADJECTIVE, so the
// German one is "Prussian" then "North German" then "German" and the Dutch one stays "Dutch" through UNL.
const MARKET_NAMES = {
  GBR: ['British Market'], USA: ['American Market'], FRA: ['French Market'],
  NET: ['Dutch Market'], UNL: ['Dutch Market'], BEL: ['Belgian Market'],
  PRU: ['Prussian Market'], NGF: ['North German Market'], GER: ['German Market'],
  RUS: ['Russian Market'], JAP: ['Japanese Market'],
};
const WAGE_TAGS = ['GBR', 'USA', 'FRA', 'NET', 'BEL', 'UNL', 'PRU', 'NGF', 'GER', 'RUS', 'JAP', 'AUS', 'ITA', 'SAR', 'SPA', 'SWE', 'CHI'];
const SKIP = /^building_(subsistence_|shipyard)/;

const BASE = Object.fromEntries(readFileSync(join(REPO, 'tools/goods_prices.tsv'), 'utf8').split(/\r?\n/)
  .filter(l => l && !l.startsWith('#')).map(l => l.split('\t')).map(([g, p]) => [g.trim(), +p]));
const med = a => { const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : NaN; };
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); if (!s.length) return NaN; const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const f = (x, d = 0) => Number.isFinite(x) ? x.toLocaleString('en', { maximumFractionDigits: d }) : '—';

// ---------------------------------------------------------------- --write-wages
if (has('--write-wages')) {
  const VAN = argOf('--van', '20260821_131149_vanilla-baseline-n16');
  const { runs, dropped } = usableRuns(SES, VAN, '');
  reportDropped(dropped);
  console.log('vanilla runs: ' + runs.length);
  const cell = new Map();
  for (const rel of runs) {
    const d = join(SES, rel, 'save_summaries'); if (!existsSync(d)) continue;
    for (const fn of readdirSync(d).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).sort()) {
      let j; try { j = JSON.parse(gunzipSync(readFileSync(join(d, fn))).toString('utf8')); } catch { continue; }
      const y = +String(j.provenance && j.provenance.date || '').split('.')[0]; if (!y) continue;
      for (const t of WAGE_TAGS) {
        const c = j.countries && j.countries[t]; if (!c) continue;
        const bw = +c.base_wage; if (!(bw > 0)) continue;
        const k = t + '|' + y; if (!cell.has(k)) cell.set(k, []); cell.get(k).push(bw / POP_SIZE_PACKAGE);
      }
      j = null; // 16 runs of summaries held at once is an OOM — keep only the metric
    }
    process.stdout.write('.');
  }
  console.log('');
  const out = { _comment: 'GENERATED by tools/measure_wage_share.mjs --write-wages and COMMITTED. The country NORMAL WAGE RATE in GBP per employee per week (the save\'s base_wage / POP_SIZE_PACKAGE), median over the vanilla baseline\'s seeds. It is NOT what buildings pay — apply lib_wage_model.WAGE_PREMIUM.', _source: VAN, _runs: runs.length, _generated: new Date().toISOString().slice(0, 16) + 'Z', tags: {} };
  for (const [k, v] of cell) {
    const [t, y] = k.split('|');
    (out.tags[t] ||= {})[y] = { wage: +med(v).toFixed(6), n: v.length, lo: +Math.min(...v).toFixed(6), hi: +Math.max(...v).toFixed(6) };
  }
  writeFileSync(join(REPO, 'config/measured_base_wages.json'), JSON.stringify(out, null, 1) + '\n');
  for (const t of Object.keys(out.tags)) {
    const row = out.tags[t];
    console.log(t.padEnd(4) + ' ' + [1840, 1860, 1880, 1900, 1920, 1935].map(y => y + ':' + (row[y] ? row[y].wage.toFixed(4) + '(' + row[y].n + ')' : '—')).join(' '));
  }
  console.log('wrote config/measured_base_wages.json');
  process.exit(0);
}

// ---------------------------------------------------------------- the identity + premium measurement
const RUNS = argAll('--run');
if (!RUNS.length) { console.error('usage: --run <session/run> [--run …] [--years …] [--detail]   |   --write-wages [--van <session>]'); process.exit(2); }
const YEARS = argOf('--years', '1840,1860,1880,1900,1920,1935').split(',').map(Number);
const DETAIL = has('--detail');

const V = readVanilla(GAME);
const empCache = new Map();
const vanEmp = p => { if (!empCache.has(p)) empCache.set(p, Object.fromEntries([...(V.PMBODY[p] || '').matchAll(/building_employment_([a-z_]+)_add\s*=\s*(-?[0-9.]+)/g)].map(m => [m[1], +m[2]]))); return empCache.get(p); };

// a run's own config, for tiered keys the game files do not have
function cfgOf(rel) {
  let p = argOf('--config', '');
  if (!p) { try { const bs = JSON.parse(readFileSync(join(SES, rel, 'build_state.json'), 'utf8')); const d = bs.deterministic || {}; p = (d.mod_under_test || {}).built_from_config || d.built_from_config || ''; } catch { p = ''; } }
  if (!p) return {};
  const abs = existsSync(p) ? p : join(REPO, p); if (!existsSync(abs)) return {};
  const cfg = JSON.parse(readFileSync(abs, 'utf8')); const byKey = {};
  for (const ind of cfg.industries || []) { if (ind.disabled) continue;
    for (const t of ind.tiers || []) byKey[t.key] = { out: { [t.output_good || ind.output_good]: t.output_qty }, in: t.inputs || {}, emp: t.employment || {}, mult: t.workforce_mult || 1 }; }
  return byKey;
}

const rows = [];
for (const rel of RUNS) {
  const mfile = join(SES, rel, 'markets.tsv'), sdir = join(SES, rel, 'save_summaries');
  if (!existsSync(mfile) || !existsSync(sdir)) { console.error('skip (no markets.tsv / save_summaries): ' + rel); continue; }
  const TIER = cfgOf(rel);
  const P = {};
  for (const line of readFileSync(mfile, 'utf8').split(/\r?\n/)) {
    const c = line.split('\t'); if (c.length < 8) continue; const p = +c[7]; if (!(p > 0)) continue;
    ((P[c[1]] ||= {})[c[2]] ||= {})[c[4]] = p;
  }
  for (const fn of readdirSync(sdir).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(sdir, fn))).toString('utf8')); } catch { continue; }
    const dt = String(j.provenance && j.provenance.date || ''), year = +dt.split('.')[0];
    if (!YEARS.includes(year) || !dt.endsWith('.1.1')) { j = null; continue; }
    for (const [tag, names] of Object.entries(MARKET_NAMES)) {
      const C = j.countries && j.countries[tag]; if (!C) continue;
      const price = names.map(n => (P[dt] || {})[n]).find(Boolean); if (!price) continue;
      const bw = +C.base_wage / POP_SIZE_PACKAGE; if (!(bw > 0)) continue;
      let R = 0, I = 0, prof = 0, W = 0, n = 0; const det = [];
      let noFlowProfit = 0, noFlowN = 0;
      for (const [key, b] of Object.entries(C.buildings || {})) {
        const lv = +b.levels || 0, st = +b.staffing || 0, vo = +b.va_out || 0, vi = +b.va_in || 0;
        if (!(lv > 0)) continue;
        if (vo === 0 && vi === 0) { noFlowProfit += +b.profit || 0; noFlowN++; continue; }
        if (SKIP.test(key) || !(vo > 0) || (+b.subsidised_levels || 0) > 0) continue;
        const mix = { out: {}, in: {} }, emp = {};
        const t = TIER[key];
        if (t && !Object.keys(b.pms || {}).length) {
          Object.assign(mix.out, t.out); Object.assign(mix.in, t.in); Object.assign(emp, t.emp);
        } else {
          for (const [pk, plv] of Object.entries(b.pms || {})) {
            const w = +plv / lv;
            const g = V.PMBODY[pk] ? V.goodsOf(pk) : null, e = V.PMBODY[pk] ? vanEmp(pk) : null;
            if (g) { for (const [k, v] of Object.entries(g.out)) mix.out[k] = (mix.out[k] || 0) + v * w;
                     for (const [k, v] of Object.entries(g.in)) mix.in[k] = (mix.in[k] || 0) + v * w;
                     for (const [k, v] of Object.entries(e)) emp[k] = (emp[k] || 0) + v * w; }
            else if (t) { for (const [k, v] of Object.entries(t.out)) mix.out[k] = (mix.out[k] || 0) + v * w;
                          for (const [k, v] of Object.entries(t.in)) mix.in[k] = (mix.in[k] || 0) + v * w;
                          for (const [k, v] of Object.entries(t.emp)) emp[k] = (emp[k] || 0) + v * w; }
          }
        }
        const mo = priceMultiplier(mix.out, price, BASE), mi = priceMultiplier(mix.in, price, BASE);
        if (!(mo.missing <= 0.02) || !(mi.missing <= 0.02) || !Number.isFinite(mo.mult)) continue;
        const Ri = vo * mo.mult, Ii = vi * (Number.isFinite(mi.mult) ? mi.mult : (vi === 0 ? 1 : NaN));
        if (!Number.isFinite(Ii)) continue;
        const Wi = bw * wageUnits(emp) * st;
        R += Ri; I += Ii; prof += +b.profit || 0; W += Wi; n++;
        if (DETAIL) det.push({ key, R: Ri, I: Ii, p: +b.profit || 0, W: Wi });
      }
      if (n < 6) continue;
      const imp = R - I - prof;
      rows.push({ rel, tag, year, R, I, prof, imp, W, prem: imp / W, wc: imp / (I + imp), wr: imp / R, n, noFlowProfit, noFlowN });
      if (DETAIL) {
        console.log('\n--- ' + rel + '  ' + tag + ' ' + year + '  normal rate ' + bw.toFixed(5) + ' GBP/employee/wk');
        det.sort((a, b) => b.R - a.R);
        console.log('  building                        R_mkt      I_mkt     profit |  impliedW   modelW  prem');
        for (const r of det.slice(0, 22)) console.log('  ' + r.key.replace('building_', '').padEnd(30) + f(r.R).padStart(9) + ' ' + f(r.I).padStart(10) + ' ' + f(r.p).padStart(10)
          + ' | ' + f(r.R - r.I - r.p).padStart(9) + ' ' + f(r.W).padStart(8) + ' ' + ((r.R - r.I - r.p) / r.W).toFixed(2).padStart(5));
      }
    }
    j = null;
  }
}
if (!rows.length) { console.error('no scorable cells'); process.exit(1); }

console.log('\nrun                       tag  year |      R_mkt      I_mkt     profit |  impliedW    modelW  prem | wage/cost | n');
for (const r of rows) console.log(r.rel.split('/')[0].slice(9, 33).padEnd(24) + ' ' + r.tag.padEnd(4) + r.year + ' | ' + f(r.R).padStart(10) + ' ' + f(r.I).padStart(10) + ' ' + f(r.prof).padStart(10)
  + ' | ' + f(r.imp).padStart(9) + ' ' + f(r.W).padStart(9) + ' ' + r.prem.toFixed(2).padStart(5) + ' | ' + (100 * r.wc).toFixed(0).padStart(7) + '%  | ' + r.n);

const byArm = {};
for (const r of rows) (byArm[r.rel.split('/')[0]] ||= []).push(r);
for (const [arm, s] of Object.entries(byArm)) {
  const ok = s.filter(a => Number.isFinite(a.prem) && a.prem > 0);
  console.log('\n=== ' + arm + '   cells ' + ok.length);
  console.log('  WAGE PREMIUM over the country normal rate: median ' + med(ok.map(a => a.prem)).toFixed(2) + '  p10 ' + q(ok.map(a => a.prem), 0.1).toFixed(2) + '  p90 ' + q(ok.map(a => a.prem), 0.9).toFixed(2));
  console.log('  WAGE SHARE of total cost (inputs+wages): median ' + (100 * med(ok.map(a => a.wc))).toFixed(1) + '%  p10 ' + (100 * q(ok.map(a => a.wc), 0.1)).toFixed(1) + '%  p90 ' + (100 * q(ok.map(a => a.wc), 0.9)).toFixed(1) + '%   [the flat wage_pct is 25%]');
  for (const y of YEARS) { const t = ok.filter(a => a.year === y); if (t.length) console.log('    ' + y + '  premium ' + med(t.map(a => a.prem)).toFixed(2) + '   wage share of cost ' + (100 * med(t.map(a => a.wc))).toFixed(1) + '%   (n=' + t.length + ')'); }
  const nf = s.reduce((a, r) => a + r.noFlowProfit, 0);
  console.log('  buildings with NO goods flows at all (F150): ' + f(nf) + ' GBP of profit, unscoreable by any margin');
}
