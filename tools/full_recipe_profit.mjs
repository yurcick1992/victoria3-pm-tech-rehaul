#!/usr/bin/env node
// ⭐⭐ THE FULL RECIPE'S PROFIT, AT A NAMED SITUATION — the prediction half of the 2026-09-20 ruling
// (*"try to predict full recipe's profits at different situations"*), and the piece `ladder_options.mjs`
// could not do: it scores a CANDIDATE ladder from the book's arithmetic, main method only, one level, no
// throughput. This scores a BUILT book's actual shipped recipe.
//
// WHAT "FULL RECIPE" MEANS HERE, and each part is read from the emitted mod, not modelled:
//   · the MAIN method's goods and employment;
//   · every SECONDARY production-method group's ACTIVE method — its goods (including the negative
//     reductions: a luxury line subtracts from the base good) and its employment, which is how the balance
//     sheet has always totalled a building. `--secondaries base` (default) takes each group's first
//     non-gated method, the state a building is in unless someone switches it; `--secondaries none`
//     reproduces `ladder_options`' main-method-only reading for comparison.
//   · ECONOMY OF SCALE: `throughput = 1 + 0.01 × min(levels, 20)` for a building in a group flagged
//     `economy_of_scale`, read live from `common/building_groups`. It scales GOODS on both sides and NOT
//     wages, which is exactly why it lifts the margin. The user's own 15-level furniture manufactory read
//     +15% and the save agrees, so the rule is per level FROM level 1, not from level 2.
//
// AND THE SITUATION (`--economy TAG@YEAR`, `--levels N`): wages are the economy's and the decade's —
// `wage(tag, year) × Σ(employees × profession wage_weight) × levels` — through tools/lib_wage_model.mjs.
// Prices are BASE unless `--prices <session>[@year]` names a measured run, in which case each good is taken
// at that run's median realised price across the instrumented markets.
//
// ⚠⚠ IT READS AN EMITTED MOD, so it can only score a book that has been BUILT. For a candidate, build it
// first with `build.ps1 -SaveTo <name> -Config <book>` and pass `--mod mod_<name>`. That is deliberate: the
// secondaries are rescaled at BUILD time by emit_secondaries.mjs against whatever main recipe the config
// carries, so reading the config alone would be re-implementing that rule and inviting it to drift.
// ⚠ Base prices are a design coordinate, never a prediction (§10.86.2). `--prices` is the honest mode.
//
// usage: node tools/full_recipe_profit.mjs [--mod mod] [--config config/mod_config.json]
//        [--economy GBR@1920] [--levels 10] [--secondaries base|none] [--industry textile]
//        [--prices <session>[@1935]] [--compare-main]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blocks } from './lib_vanilla_ladder.mjs';
import { wageUnits, economyWage, WAGE_PREMIUM } from './lib_wage_model.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const MOD = arg('--mod', 'mod');
const CFG = arg('--config', 'config/mod_config.json');
const [ETAG, EYEAR] = (arg('--economy', 'GBR@1920') + '@1920').split('@');
const LEVELS = +arg('--levels', 10);
const SEC = arg('--secondaries', 'base');
const ONE = arg('--industry', '');
const PRICES_FROM = arg('--prices', '');
const COMPARE = process.argv.includes('--compare-main');

const modDir = join(REPO, MOD);
if (!existsSync(modDir)) throw new Error('no emitted mod at ' + modDir + ' — build the book first (build.ps1 -SaveTo <name> -Config <book>)');

// ---- base prices, and optionally the MEASURED ones
const BASE = {};
for (const l of readFileSync(join(REPO, 'tools/goods_prices.tsv'), 'utf8').split(/\r?\n/)) { const m = l.trim().split(/\t|\s+/); if (m.length >= 2 && +m[1] > 0) BASE[m[0]] = +m[1]; }
let PRICE = { ...BASE }, priceNote = 'BASE prices (a design coordinate, not a prediction — §10.86.2)';
if (PRICES_FROM) {
  const [sess, yr] = (PRICES_FROM + '@1935').split('@');
  const root = join(REPO, 'tools/testbed/sessions', sess);
  const acc = {};
  for (const run of readdirSync(root).filter(d => d.startsWith('run'))) {
    const f = join(root, run, 'markets.tsv'); if (!existsSync(f)) continue;
    for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
      const c = line.split('\t'); if (c.length < 8) continue;
      if (String(c[1]).split('.')[0] !== String(yr)) continue;
      const p = +c[7]; if (p > 0) (acc[c[4]] ||= []).push(p);
    }
  }
  let n = 0;
  for (const [g, v] of Object.entries(acc)) { v.sort((a, b) => a - b); PRICE[g] = v[v.length >> 1]; n++; }
  if (!n) throw new Error('no prices found in ' + sess + ' at ' + yr);
  priceNote = 'MEASURED prices: the median over ' + sess + ' at ' + yr + ' (' + n + ' goods; anything it lacks stays at base)';
}

// ---- the emitted mod: buildings, PMGs, PMs
const readDir = d => { const o = {}; const p = join(modDir, d); if (!existsSync(p)) return o;
  for (const f of readdirSync(p)) if (f.endsWith('.txt')) Object.assign(o, blocks(readFileSync(join(p, f), 'utf8').replace(/^\uFEFF/, '')));
  return o; };
const BLD = readDir('common/buildings'), PMG = readDir('common/production_method_groups'), PM = readDir('common/production_methods');
// vanilla fills whatever the mod does not own
const vanDir = d => { const o = {}; for (const f of readdirSync(join(GAME, d))) if (f.endsWith('.txt')) Object.assign(o, blocks(readFileSync(join(GAME, d, f), 'utf8').replace(/^\uFEFF/, ''))); return o; };
const VBLD = vanDir('common/buildings'), VPMG = vanDir('common/production_method_groups'), VPM = vanDir('common/production_methods');
const bld = k => BLD[k] || VBLD[k], pmg = k => PMG[k] || VPMG[k], pm = k => PM[k] || VPM[k];

// ---- economy of scale: which building groups have it, live
const EOS = new Set();
{
  const G = vanDir('common/building_groups');
  const parentOf = {}, own = {};
  for (const [k, body] of Object.entries(G)) {
    const p = /parent_group\s*=\s*([a-z_0-9]+)/.exec(body); if (p) parentOf[k] = p[1];
    if (/economy_of_scale\s*=\s*yes/.test(body)) own[k] = true;
  }
  for (const k of Object.keys(G)) { let c = k; while (c) { if (own[c]) { EOS.add(k); break; } c = parentOf[c]; } }
}
const groupOfBuilding = k => (/building_group\s*=\s*([a-z_0-9]+)/.exec(bld(k) || '') || [])[1];

// ---- one method's goods and employment (the mod's own copy first)
const goodsOf = k => { const b = pm(k) || ''; const io = { in: {}, out: {} };
  for (const m of b.matchAll(/goods_(input|output)_([a-z_]+)_add\s*=\s*(-?[\d.]+)/g)) { const s = m[1] === 'input' ? 'in' : 'out'; io[s][m[2]] = (io[s][m[2]] || 0) + +m[3]; }
  return io; };
const empOf = k => Object.fromEntries([...(pm(k) || '').matchAll(/building_employment_([a-z_]+)_add\s*=\s*(-?[\d.]+)/g)].map(m => [m[1], +m[2]]));
const gated = k => /unlocking_principles/.test(pm(k) || '');
const methodsOf = g => { const m = /production_methods\s*=\s*\{([\s\S]*?)\}/.exec(pmg(g) || ''); return m ? (m[1].match(/[a-z_0-9]+/g) || []) : []; };
const pmgsOf = k => { const m = /production_method_groups\s*=\s*\{([\s\S]*?)\}/.exec(bld(k) || ''); return m ? (m[1].match(/[a-z_0-9]+/g) || []) : []; };

const ECON = economyWage(ETAG, +EYEAR, { premium: WAGE_PREMIUM });
const cfg = JSON.parse(readFileSync(join(REPO, CFG), 'utf8'));
const val = (o, P) => Object.entries(o).reduce((a, [g, q]) => a + q * (P[g] || 0), 0);
const gbp = x => Number.isFinite(x) ? (x < 0 ? '-£' : '£') + Math.abs(Math.round(x)).toLocaleString('en-US') : '—';
const pct = x => Number.isFinite(x) ? (100 * x).toFixed(0) + '%' : '—';

console.log('FULL-RECIPE PROFIT — the emitted book at ' + MOD + ', ' + LEVELS + ' level(s), secondaries: ' + SEC);
console.log('  ' + priceNote);
console.log('  WAGES: ' + ECON.tag + ' @ ' + ECON.year + ' — £' + ECON.wage.toFixed(5) + '/employee/wk × Σ(employees × wage_weight) × levels (no premium, F152 §10)');
console.log('  THROUGHPUT: economy of scale, 1 + 0.01 × min(levels,20) where the building\'s group has it — goods only, never wages\n');
console.log('industry      era | thr  | revenue £/wk  inputs £/wk   wages £/wk |    PROFIT £/wk   profit% | £/level | secondaries counted');

const rows = [];
for (const ind of cfg.industries || []) {
  if (ind.disabled) continue;
  if (ONE && ind.id !== ONE) continue;
  for (const t of (ind.tiers || []).slice().sort((a, b) => a.era - b.era)) {
    const groups = pmgsOf(t.key); if (!groups.length) { console.log('  ' + ind.id.padEnd(12) + ' e' + t.era + '  — not in the emitted mod'); continue; }
    const mix = { in: {}, out: {} }, emp = {}; const used = [];
    for (const g of groups) {
      const ms = methodsOf(g); if (!ms.length) continue;
      const isMain = ms.includes(t.pm_key);
      let pick = null;
      if (isMain) pick = t.pm_key;
      else if (SEC === 'base') pick = ms.find(x => !gated(x)) || ms[0];
      if (!pick) continue;
      if (!isMain) used.push(pick.replace(/^pm_/, ''));
      const io = goodsOf(pick), e = empOf(pick);
      for (const [k, v] of Object.entries(io.out)) mix.out[k] = (mix.out[k] || 0) + v;
      for (const [k, v] of Object.entries(io.in)) mix.in[k] = (mix.in[k] || 0) + v;
      for (const [k, v] of Object.entries(e)) emp[k] = (emp[k] || 0) + v;
    }
    const grp = groupOfBuilding(t.key);
    const thr = EOS.has(grp) ? 1 + 0.01 * Math.min(LEVELS, 20) : 1;
    const R = val(mix.out, PRICE) * LEVELS * thr, I = val(mix.in, PRICE) * LEVELS * thr;
    const W = ECON.wage * wageUnits(emp) * LEVELS;
    const P = R - I - W, m = (I + W) > 0 ? P / (I + W) : NaN;
    rows.push({ ind: ind.id, era: t.era, P, m });
    console.log('  ' + ind.id.padEnd(12) + ' e' + t.era + ' | ' + thr.toFixed(2) + ' | ' + gbp(R).padStart(12) + ' ' + gbp(I).padStart(12) + ' ' + gbp(W).padStart(12)
      + ' | ' + gbp(P).padStart(14) + ' ' + pct(m).padStart(8) + ' | ' + gbp(P / LEVELS).padStart(8) + ' | ' + (used.join(', ') || '—'));
  }
}
const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[(s.length >> 1) - 1] + s[s.length >> 1]) / 2) : NaN; };
console.log('\nMEDIAN profit% by era: ' + [0, 1, 2, 3].map(e => 'e' + e + ' ' + pct(med(rows.filter(r => r.era === e).map(r => r.m)))).join(' · '));
if (COMPARE) console.log('(--compare-main: re-run with --secondaries none --levels 1 for the ladder_options basis)');
