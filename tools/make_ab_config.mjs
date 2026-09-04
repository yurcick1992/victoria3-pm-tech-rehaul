// ⭐⭐ THE A/B LADDER — user-ruled 2026-09-02 (BALANCE_FRAMEWORK §10.68). Derives a four-rung book from
// the tier4 STRUCTURE (rungs, eras, techs, employment, keys) and VANILLA'S OWN lowest-tier recipe:
//
//   k = rung's era − the industry's FIRST rung's era        (automotive: e2 → k=0, e3 → k=1)
//   output_qty(k)   = vanilla lowest-tier output × A^k
//   input VALUE(k)  = vanilla lowest-tier input value × B^k, spread over the rung's OWN vanilla
//                     method's input mix (walking down to the nearest lower vanilla rung for an
//                     invented rung) — so the value ladder is B^k while electricity/oil/tools/dye
//                     still enter where vanilla's own method brings them in
//   building_cost   = vanilla construction anchor × A^k     ("capacity-priced": a construction
//                     point buys the same OUTPUT at every rung; under the engine's 15–25%-of-revenue
//                     margin band profit ∝ revenue, so payback is flat across rungs)
//   ai_value        = AI_BASE × A^era                       (era-keyed, the 2026-08-29 rule)
//   target_be       restated from the recipe (the lint_profitability drift guard, same rule as
//                     make_tier4_config --apply-solve)
//   ai_defines      PRODUCTION_BUILDING_AUTONOMOUS_INVESTMENT_CONSTRUCTION_COST_DIVISOR_SCALING set
//                     so the dearest rung carries the divisor vanilla gives its dearest production
//                     building (÷1.8 at 800 points): s = 0.001 × 800 / max cost. The vanilla 0.001
//                     would divide a 12,500-point rung by 13.5 and hand the private pool back to the
//                     cheap old rungs (the 1.92-ladder arm's failure mode).
//
// Rung 0 is vanilla's recipe, vanilla's cost and vanilla's employment: 1836 is vanilla by construction.
// Secondary methods are NOT written here — tools/emit_secondaries.mjs rescales them at build time
// against whatever main recipe the config carries, reductions by their own good's ratio.
//
// usage: node tools/make_ab_config.mjs --A 2.5 --B 2.5 --suffix ab1 [--base config/mod_config.tier4.json]
//        [--ai-base 1000] [--divisor <s>] [--ai-steep glass,tooling:3]   (writes config/mod_config.<suffix>.json + tech_tree_options twin)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const A = +arg('--A'), B = +arg('--B'), SFX = arg('--suffix'), BASE = arg('--base', 'config/mod_config.tier4.json');
const AI_BASE = +arg('--ai-base', 1000);
// --ai-steep <ind,ind,...>:<ratio>  — user-ruled 2026-09-02 (ab3): the named industries take ai_value = AI_BASE × ratio^era
// instead of AI_BASE × A^era, so their 1830s desire is unchanged and their later rungs out-bid the generic ladder.
// Built for glass and tooling, whose e2 rungs the AI under-built in both ab2 seeds while their goods sat at 150–175%
// and 120–170% of base (FINDINGS F98 §4).
const STEEP = (() => { const v = arg('--ai-steep', ''); if (!v) return null; const [list, r] = v.split(':'); if (!(+r > 1)) throw new Error('--ai-steep <ind,ind>:<ratio>'); return { inds: new Set(list.split(',')), ratio: +r }; })();
// --A-for <ind>:<ratio>[,<ind>:<ratio>]  — user-directed 2026-09-04 (the art-academy stress test): the named industries take
// their OWN output ratio per rung — output × Ai^k, building_cost × Ai^k (still capacity-priced), ai_value AI_BASE × Ai^era
// unless --ai-steep names them — while every other industry keeps A. Built for `art_academy:3` (rung 3 = 27× rung 0:
// replicated, IP-style entertainment scales like nothing labour-bound does); B is NOT per-industry.
// ⚠ Pin --divisor when using it: the auto divisor is 0.001 × 800 / max cost, and a 3^k academy raises the max cost for
//   EVERY building's private-pool scoring — the canon's 0.000125 (max cost 6,400) is what "everything else the same" means.
const A_FOR = (() => { const v = arg('--A-for', ''); const o = {}; if (!v) return o; for (const part of v.split(',')) { const [id, r] = part.split(':'); if (!id || !(+r > 1)) throw new Error('--A-for <ind>:<ratio>[,<ind>:<ratio>]'); o[id.trim()] = +r; } return o; })();
if (!(A > 1) || !(B > 0) || !SFX) throw new Error('usage: --A <n> --B <n> --suffix <name>');

const PRICE = {};
for (const l of readFileSync(join(REPO, 'tools/goods_prices.tsv'), 'utf8').split(/\r?\n/)) {
  const m = l.trim().split(/\t|\s+/); if (m.length >= 2 && !isNaN(+m[1]) && +m[1] > 0) PRICE[m[0]] = +m[1];
}
const strip = s => s.replace(/^\uFEFF/, '').replace(/#.*$/mg, '');
const blocks = txt => { const out = {}; let depth = 0, name = null, buf = '';
  for (const l of strip(txt).split(/\r?\n/)) { if (depth === 0) { const m = l.match(/^\s*([A-Za-z0-9_\-]+)\s*=\s*\{/); if (m) { name = m[1]; buf = ''; } }
    if (name) buf += l + '\n';
    for (const ch of l) { if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth === 0 && name) { out[name] = buf; name = null; } } } }
  return out; };
const PM = {};
for (const f of readdirSync(join(GAME, 'common/production_methods'))) Object.assign(PM, blocks(readFileSync(join(GAME, 'common/production_methods', f), 'utf8')));
const rec = pm => { const b = pm && PM[pm]; if (!b) return null; const io = { in: {}, out: {} };
  for (const m of b.matchAll(/goods_(input|output)_([a-z_]+)_add\s*=\s*(-?[\d.]+)/g)) io[m[1] === 'input' ? 'in' : 'out'][m[2]] = +m[3];
  return io; };
const val = o => Object.entries(o).reduce((s, [g, q]) => s + q * (PRICE[g] || 0), 0);
const ANCH = { construction_cost_low: 200, construction_cost_medium: 400, construction_cost_high: 600, construction_cost_very_high: 800 };
const r1 = x => Math.round(x * 10) / 10;

const cfg = JSON.parse(readFileSync(join(REPO, BASE), 'utf8'));
const rows = []; let cmax = 0;
for (const ind of cfg.industries) {
  if (ind.disabled) continue;
  ind.tiers.sort((a, b) => a.era - b.era);
  const first = ind.tiers[0], r0 = rec(first.vanilla_pm);
  if (!r0 || !Object.keys(r0.in).length) throw new Error(`${ind.id}: first rung ${first.key} has no vanilla recipe (${first.vanilla_pm})`);
  const outGood = first.output_good || ind.output_good;
  const out0 = r0.out[outGood]; if (!(out0 > 0)) throw new Error(`${ind.id}: vanilla ${first.vanilla_pm} makes no ${outGood}`);
  const I0 = val(r0.in), O0 = out0 * PRICE[outGood];
  const anchor = ANCH[(ind.building || {}).required_construction || ind.required_construction]; if (!anchor) throw new Error(`${ind.id}: no required_construction class`);
  ind.tiers.forEach((t, k) => {
    // mix: the rung's own vanilla method, else the nearest lower vanilla rung's, else the first rung's
    let mixRec = null;
    for (let j = k; j >= 0; j--) { const q = rec(ind.tiers[j].vanilla_pm); if (q && Object.keys(q.in).length) { mixRec = q; break; } }
    const mixVal = val(mixRec.in);
    const Vk = I0 * Math.pow(B, k);
    const inputs = {};
    for (const [g, q] of Object.entries(mixRec.in)) { const share = q * (PRICE[g] || 0) / mixVal; const qty = r1(share * Vk / PRICE[g]); if (qty > 0) inputs[g] = qty; }
    const Ai = A_FOR[ind.id] || A;   // this industry's own output ratio (--A-for), else the book's A
    t.output_qty = r1(out0 * Math.pow(Ai, k));
    t.inputs = inputs;
    delete t.input_ratio;
    t.building_cost = Math.round(anchor * Math.pow(Ai, k));
    t.ai_value = Math.round(AI_BASE * Math.pow(STEEP && STEEP.inds.has(ind.id) ? STEEP.ratio : Ai, t.era));
    const Obase = t.output_qty * PRICE[outGood]; const Ibase = val(inputs); const wp = t.wage_pct != null ? +t.wage_pct : 0.25;
    t.target_be = Math.round(Ibase / ((1 - wp) * Obase) * 100);
    cmax = Math.max(cmax, t.building_cost);
    rows.push({ ind: ind.id, era: t.era, k, key: t.key, out: t.output_qty, inputs, cost: t.building_cost, aiv: t.ai_value, be: t.target_be, va: Obase - Ibase, share: Ibase / Obase, emp: Object.values(t.employment || {}).reduce((s, x) => s + x, 0) || 5000 });
  });
}
if (STEEP) for (const id of STEEP.inds) if (!cfg.industries.some(i => i.id === id)) throw new Error(`--ai-steep: unknown industry ${id}`);
for (const id of Object.keys(A_FOR)) if (!cfg.industries.some(i => i.id === id && !i.disabled)) throw new Error(`--A-for: unknown or disabled industry ${id}`);
const s = +arg('--divisor', (0.001 * 800 / cmax).toPrecision(3));
cfg.ai_defines = { ...(cfg.ai_defines || {}), PRODUCTION_BUILDING_AUTONOMOUS_INVESTMENT_CONSTRUCTION_COST_DIVISOR_SCALING: s };
cfg.company_target_gate = process.argv.includes('--company-gate');   // emit_companies opt-in; OFF by default (see its header)
cfg._ab = { A, B, A_for: Object.keys(A_FOR).length ? A_FOR : null, ai_base: AI_BASE, ai_steep: STEEP ? { industries: [...STEEP.inds], ratio: STEEP.ratio } : null, cost_divisor_scaling: s, company_target_gate: cfg.company_target_gate, base: BASE, generated: new Date().toISOString() };
cfg._comment = `A/B LADDER (${SFX}) derived by tools/make_ab_config.mjs from ${BASE}: rung k output = vanilla lowest-tier × ${A}^k, input value × ${B}^k over the rung's own vanilla mix, building_cost = vanilla anchor × ${A}^k, ai_value = ${AI_BASE} × ${A}^era, cost-divisor scaling ${s}${STEEP ? `, ai_value ${AI_BASE} × ${STEEP.ratio}^era for ${[...STEEP.inds].join('/')}` : ''}. target_be restated as the drift guard.`;
writeFileSync(join(REPO, `config/mod_config.${SFX}.json`), JSON.stringify(cfg));
writeFileSync(join(REPO, `config/tech_tree_options.${SFX}.json`), readFileSync(join(REPO, 'config/tech_tree_options.tier4.json'), 'utf8'));

console.log(`A/B LADDER ${SFX}: A=${A} B=${B} · ai_value ${AI_BASE}×${A}^era · cost divisor scaling ${s} (top rung ${cmax} pts ÷${(1 + s * cmax).toFixed(2)}, 600-pt rung ÷${(1 + 600 * s).toFixed(2)}; vanilla 0.001 would give ÷${(1 + 0.001 * cmax).toFixed(1)})`);
console.log('industry     era k  output      inputs                                                            cost    ai_value  BE%   VA/wk   VA/worker  in-share');
for (const r of rows) console.log(`${r.ind.padEnd(12)} e${r.era}  ${r.k}  ${String(r.out).padStart(7)}  ${Object.entries(r.inputs).map(([g, q]) => g + ' ' + q).join(', ').padEnd(62)} ${String(r.cost).padStart(6)}  ${String(r.aiv).padStart(7)}  ${String(r.be).padStart(3)}  ${r.va.toFixed(0).padStart(6)}  ${(r.va / r.emp).toFixed(3).padStart(8)}  ${r.share.toFixed(2)}`);
console.log(`wrote config/mod_config.${SFX}.json + config/tech_tree_options.${SFX}.json`);
