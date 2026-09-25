// THE RUN CORPUS (FINDINGS F165, 2026-09-25): every usable century run (lib_runs' rule, until ≥ 1936, ≥ 80 yearly
// summaries) of a four-rung A/B book (a config with `_ab`) or a vanilla control → one JSON line per run with its lever
// vector (read from the run's OWN built_from_config) and a yearly series of world / pool / GBR GDP, W, U*, H and the
// pool's tiered workers by rung era. ~20 min for ~170 runs; split the session list over parallel processes and cat.
// The default output the two readers use is tools/testbed/ledger/corpus_runs.jsonl (gitignored, re-derivable).
// usage: node tools/testbed/ledger/corpus_extract.mjs <out.jsonl> <session> [<session> ...]
import { readFileSync, readdirSync, existsSync, appendFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = fileURLToPath(new URL('../../..', import.meta.url));
const SES = join(REPO, 'tools/testbed/sessions');
const { usableRuns } = await import('./lib_runs.mjs');
const { POOL } = await import('./lib_markets.mjs');
const [out, ...sessions] = process.argv.slice(2);
const cfgCache = new Map();
function loadCfg(p) {
  if (!p) return null; if (cfgCache.has(p)) return cfgCache.get(p);
  let abs = existsSync(p) ? p : join(REPO, p); if (!existsSync(abs)) { cfgCache.set(p, null); return null; }
  const c = JSON.parse(readFileSync(abs, 'utf8')); const tier = {};
  for (const ind of c.industries || []) { if (ind.disabled) continue; for (const t of ind.tiers || []) tier[t.key] = { era: t.era, emp: Object.values(t.employment || {}).reduce((a, b) => a + (+b || 0), 0) * (t.workforce_mult || 1) }; }
  const ab = c._ab || null; const d = c.ai_defines || {};
  const lev = ab ? {
    A: ab.A, B: ab.B, in_ladder: ab.in_ladder, cost_ratio: ab.cost_flat ? 1 : ab.cost_ratio ?? (ab.cost_ladder ? null : ab.A), cost_ladder: ab.cost_ladder,
    in0: ab.in0 ?? 1, in0_stage: !!ab.in0_stage, in0_level: !!ab.in0_level, ai_ladder: ab.ai_ladder, ai_ratio: ab.ai_steep ? ab.ai_steep.ratio : null,
    bar: ab.bar_months ?? (c.research_events || {}).industry_bar_months, anchor_n: ab.anchor_for ? Object.keys(ab.anchor_for).length : 0, anchor_cost: !!ab.anchor_cost,
    divisor: ab.cost_divisor_scaling, poolF: d.MONEY_SPENDING_CONSTRUCTION_TOO_LARGE_INVESTMENT_POOL_FACTOR, crit: d.MONEY_SPENDING_CONSTRUCTION_CRITICAL_THRESHOLD,
    exc: d.MONEY_SPENDING_CONSTRUCTION_EXCESSIVE_THRESHOLD, qcap: d.CONSTRUCTION_MAX_NUM_PRODUCTION_BUILDING_CONSTRUCTIONS_SCALED, rnd: d.PRODUCTION_BUILDING_RANDOM_FACTOR,
    trade: c.goods_traded_quantity ? ((c._trade || {}).scale || 1) : 0, finish: !!((c.research_events || {}).finish_boost || {}).enabled,
    elec: !!(c.pm_goods || {}).pm_electric_streetlights, tiers: c.industries.filter(i => !i.disabled).reduce((a, i) => a + i.tiers.length, 0),
  } : null;
  const r = { tier, lev, name: abs.split(/[\\/]/).pop() }; cfgCache.set(p, r); return r;
}
const agg = () => ({ gdp: 0, pop: 0, prod: 0, sal: 0, un: 0, pe: 0, pool: 0 });
const addC = (a, c) => { const p = c.pop_statistics || {}; const sal = +p.population_salaried_workforce || 0, un = +p.population_unemployed_workforce || 0, pe = (+p.population_subsisting_workforce || 0) * 1e5;
  a.gdp += +c.gdp || 0; a.pop += Object.values(c.strata || {}).reduce((x, y) => x + y, 0); a.prod += sal - (+p.population_government_workforce || 0) - (+p.population_military_workforce || 0); a.sal += sal; a.un += un; a.pe += pe; a.pool += +c.investment_pool || 0; };
const fin = a => ({ gdp: a.gdp, pop: a.pop, W: a.pop ? a.prod / a.pop : null, U: (a.sal + a.un + a.pe) ? (a.un + a.pe) / (a.sal + a.un + a.pe) : null, H: a.gdp ? a.pool / a.gdp : null });
for (const s of sessions) {
  const root = join(SES, s); if (!existsSync(root)) continue;
  const setups = [...new Set(readdirSync(root).filter(x => /^run\d+_/.test(x)).map(d => d.replace(/^run\d+_/, '')))];
  for (const setup of setups) {
    let runs; try { runs = usableRuns(SES, s, setup).runs; } catch (e) { continue; }
    for (const rel of runs) {
      const rd = join(SES, rel); let meta; try { meta = JSON.parse(readFileSync(join(rd, 'meta.json'), 'utf8')); } catch { continue; }
      if (+String(meta.until_date).split('.')[0] < 1936) continue;
      const sd = join(rd, 'save_summaries'); if (!existsSync(sd)) continue;
      const files = readdirSync(sd).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).sort(); if (files.length < 80) continue;
      let bs = {}; try { bs = JSON.parse(readFileSync(join(rd, 'build_state.json'), 'utf8')).deterministic || {}; } catch {}
      const arm = bs.arm || ''; const cfgP = (bs.mod_under_test || {}).built_from_config || bs.built_from_config || '';
      const cfg = arm.startsWith('control') ? null : loadCfg(cfgP);
      if (!arm.startsWith('control') && !(cfg && cfg.lev)) continue;   // only A/B four-rung books + vanilla
      const years = {};
      for (const fn of files) {
        let j; try { j = JSON.parse(gunzipSync(readFileSync(join(sd, fn))).toString('utf8')); } catch { continue; }
        const y = +String((j.provenance || {}).date || '').split('.')[0]; if (!y || years[y]) continue;
        const C = j.countries || {}; const w = agg(), p = agg(), g = agg(); const T = [0, 0, 0, 0];
        for (const [tag, c] of Object.entries(C)) { addC(w, c); if (POOL.includes(tag)) { addC(p, c);
          if (cfg) for (const [k, b] of Object.entries(c.buildings || {})) { const t = cfg.tier[k]; if (t && t.era != null) T[t.era] += (+b.staffing || 0) * t.emp; } }
          if (tag === 'GBR') addC(g, c); }
        w.gdp = +(j.world || {}).gdp || w.gdp;
        years[y] = { w: fin(w), p: fin(p), g: fin(g), T };
      }
      appendFileSync(out, JSON.stringify({ rel, session: s, setup, arm: arm.startsWith('control') ? 'vanilla' : 'mod', config: cfg ? cfg.name : 'vanilla', lev: cfg ? cfg.lev : null, resumes: meta.resumes, years }) + '\n');
      process.stderr.write('.');
    }
  }
}
