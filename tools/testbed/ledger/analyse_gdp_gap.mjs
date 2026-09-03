// Decompose the mod-vs-vanilla GDP gap from the 20260813_083557 session's save summaries.
// Per run x year: world GDP, levels by class (mod: by era), Dlevels, construction points
// delivered (Dlevels+ x cost), construction sector capacity, investment pool, gov construction
// spend, workforce split, and per-era profit/staffing (mod).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { requiredConstruction } from 'file:///C:/claude-code/victoria%203%20PM%20and%20tech%20rehaul/tools/vanilla_construction.mjs';

// --session <dir-or-name>: the session whose run*/save_summaries to decompose (default: the
// original vanilla-vs-mod batch). A bare name is resolved under tools/testbed/sessions.
const argsG = process.argv.slice(2);
const sessArg = (() => { const i = argsG.indexOf('--session'); return i >= 0 && argsG[i + 1] ? argsG[i + 1] : '20260813_083557_vanilla-vs-mod-n4'; })();
const SESSION = sessArg.includes('/') || sessArg.includes('\\')
  ? sessArg
  : 'C:/claude-code/victoria 3 PM and tech rehaul/tools/testbed/sessions/' + sessArg;
const OUT = (() => { const a = process.argv.slice(2), i = a.indexOf('--out'); return i >= 0 && a[i + 1] ? a[i + 1] : '.'; })();  // default: cwd

// --- building key -> era + cost (mod tiers), and vanilla costs ---
// --config <path>: the ARM's config (its building_cost is the arm's own cost book)
const cfgPathG = (() => { const i = argsG.indexOf('--config'); return i >= 0 && argsG[i + 1] ? argsG[i + 1] : 'C:/claude-code/victoria 3 PM and tech rehaul/config/mod_config.json'; })();
const cfg = JSON.parse(readFileSync(cfgPathG, 'utf8'));
const tierEra = {}, tierCost = {}, tierInd = {};
for (const ind of cfg.industries) if (!ind.disabled) for (const t of ind.tiers || []) {
  tierEra[t.key] = t.era; tierCost[t.key] = t.building_cost; tierInd[t.key] = ind.id;
}
const vanCost = requiredConstruction();

const classOf = k => {
  if (k === 'building_construction_sector') return 'constr';
  if (k === 'building_manor_house' || k === 'building_financial_district' || k === 'building_company_headquarter') return 'owner';
  if (k.startsWith('building_subsistence')) return 'subsist';
  if (k === 'building_urban_center') return 'urban';
  if (k === 'building_government_administration' || k === 'building_university' || k === 'building_arts_academy') return 'gov';
  if (/barracks|conscription|naval_base|port_military/.test(k)) return 'mil';
  if (k === 'building_trade_center') return 'trade';
  return 'econ';
};
const costOf = (k, isMod) => {
  if (isMod && tierCost[k] != null) return tierCost[k];
  if (vanCost[k] != null) return vanCost[k];
  return 400; // fallback for unknown keys
};

const runs = readdirSync(SESSION).filter(d => /^run\d+_/.test(d));
const rows = [];
for (const run of runs) {
  // a run is the MOD arm unless its setup name says vanilla/control (run001_vancost_nosub is mod)
  const isMod = !/_(vanilla|control)$/.test(run);
  const dir = join(SESSION, run, 'save_summaries');
  let files;
  try { files = readdirSync(dir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort(); } catch { continue; }
  let prevLv = null;
  for (const f of files) {
    let j;
    try { j = JSON.parse(gunzipSync(readFileSync(join(dir, f)))); } catch { continue; }
    const date = j.provenance?.date || '?';
    const year = +date.split('.')[0];
    // world sums over countries
    let gdp = 0, pool = 0, cgoods = 0, sal = 0, unemp = 0, peasW = 0, exp = 0;
    for (const [tag, c] of Object.entries(j.countries || {})) {
      gdp += c.gdp || 0; pool += c.investment_pool || 0;
      cgoods += c.building_budget?.expense_by_category?.construction_goods || 0;
      exp += c.building_budget?.expense || 0;
      const ps = c.pop_statistics || {};
      sal += ps.population_salaried_workforce || 0;
      unemp += ps.population_unemployed_workforce || 0;
      peasW += c.workforce_by_profession?.peasants || 0;
    }
    // world building levels by class and (mod) era
    const wb = j.world?.buildings || {};
    const lv = {}; const cls = { constr: 0, owner: 0, subsist: 0, urban: 0, gov: 0, mil: 0, trade: 0, econ: 0 };
    const era = [0, 0, 0, 0, 0, 0]; let econUntier = 0;
    for (const [k, b] of Object.entries(wb)) {
      lv[k] = b.levels || 0;
      cls[classOf(k)] += b.levels || 0;
      if (isMod && tierEra[k] != null) era[tierEra[k]] += b.levels || 0;
      else if (classOf(k) === 'econ') econUntier += b.levels || 0;
    }
    // deltas vs previous summary of the same run
    let dLvAdd = 0, dLvRem = 0, ptsAdd = 0, econAdd = 0, econPts = 0;
    const eraAdd = [0, 0, 0, 0, 0, 0];
    if (prevLv) {
      const keys = new Set([...Object.keys(lv), ...Object.keys(prevLv)]);
      for (const k of keys) {
        const d = (lv[k] || 0) - (prevLv[k] || 0);
        if (d > 0) {
          dLvAdd += d; ptsAdd += d * costOf(k, isMod);
          if (classOf(k) === 'econ') { econAdd += d; econPts += d * costOf(k, isMod); }
          if (isMod && tierEra[k] != null) eraAdd[tierEra[k]] += d;
        } else if (d < 0) dLvRem -= d;
      }
    }
    // per-era profit & staffing (mod only): sum over countries
    const eraProfit = [0, 0, 0, 0, 0, 0], eraLv = [0, 0, 0, 0, 0, 0], eraStaff = [0, 0, 0, 0, 0, 0];
    if (isMod) {
      for (const c of Object.values(j.countries || {})) {
        for (const [k, b] of Object.entries(c.buildings || {})) {
          const e = tierEra[k]; if (e == null) continue;
          eraProfit[e] += b.profit || 0; eraLv[e] += b.levels || 0; eraStaff[e] += b.staffing || 0;
        }
      }
    }
    rows.push({
      run, arm: isMod ? 'mod' : 'vanilla', year, gdp, pool, cgoods, exp, sal, unemp, peasW,
      lvTotal: Object.values(lv).reduce((a, b) => a + b, 0), ...cls, econUntier,
      e0: era[0], e1: era[1], e2: era[2], e3: era[3], e4: era[4], e5: era[5],
      dLvAdd, dLvRem, ptsAdd, econAdd, econPts,
      eAdd0: eraAdd[0], eAdd1: eraAdd[1], eAdd2: eraAdd[2], eAdd3: eraAdd[3], eAdd4: eraAdd[4], eAdd5: eraAdd[5],
      profE: eraProfit.map((p, i) => eraLv[i] ? +(p / eraLv[i]).toFixed(0) : '').join('/'),
      staffE: eraStaff.map((s, i) => eraLv[i] ? +(s / eraLv[i]).toFixed(2) : '').join('/'),
    });
    prevLv = lv;
  }
  console.error(`${run}: ${files.length} summaries read`);
}
const cols = Object.keys(rows[0]);
writeFileSync(join(OUT, 'gdp_gap_series.tsv'), cols.join('\t') + '\n' + rows.map(r => cols.map(c => r[c]).join('\t')).join('\n'));
console.log('rows', rows.length, '->', join(OUT, 'gdp_gap_series.tsv'));
