// ⭐⭐ THE A/B LADDER — user-ruled 2026-09-02 (BALANCE_FRAMEWORK §10.68). Derives a four-rung book from
// the tier4 STRUCTURE (rungs, eras, techs, employment, keys) and VANILLA'S OWN lowest-tier recipe.
//
// ⭐⭐⭐ KEYED ON THE RUNG'S ERA, NEVER ON ITS INDEX — THE ERA RULE (user-ruled 2026-09-13, BALANCE_FRAMEWORK
//   §10.78; the header of tools/lib_tier4_spec.mjs). "Late tiers are uniformly more effective than earlier
//   ones" is a statement about ERAS: every e2 rung in the book — steel's open hearth, textile's mechanized
//   workshops AND automotive's first rung — carries the same multipliers over its industry's vanilla base.
//   Until 2026-09-13 this tool keyed on k = era − the industry's FIRST rung's era, so a late industry's first
//   rung (automotive e2, electrics, synthetics, munition) was priced as an 1836 rung: vanilla's recipe at
//   vanilla's margin, the ×lift on its inputs, the anchor cost — a quarter of its era peers' value added per
//   level in every measured batch (FINDINGS F111). tools/lint_tier_eras.mjs re-checks every emitted book.
//
//   e = the rung's era (t.era, 0..3)                      (automotive: e2 and e3, exactly as labelled)
//   output_qty(e)   = vanilla lowest-tier output × A^e
//   input VALUE(e)  = vanilla lowest-tier input value × lift × B^e, spread over the rung's OWN vanilla
//                     method's input mix (walking down to the nearest lower vanilla rung for an
//                     invented rung) — so the value ladder is B^e while electricity/oil/tools/dye
//                     still enter where vanilla's own method brings them in; `lift` (--in0) is the
//                     ladder's anchor and reaches every rung, or era 0 alone under --in0-only
//   building_cost   = vanilla construction anchor × A^e     ("capacity-priced": a construction
//                     point buys the same OUTPUT at every rung; under the engine's 15–25%-of-revenue
//                     margin band profit ∝ revenue, so payback is flat across rungs); or the anchor
//                     flat at every rung under --cost-flat (§10.61)
//   ai_value        = AI_BASE × A^e, or the explicit --ai-ladder list by era
//   target_be       restated from the recipe (the lint_profitability drift guard, same rule as
//                     make_tier4_config --apply-solve)
//   ai_defines      PRODUCTION_BUILDING_AUTONOMOUS_INVESTMENT_CONSTRUCTION_COST_DIVISOR_SCALING set
//                     so the dearest rung carries the divisor vanilla gives its dearest production
//                     building (÷1.8 at 800 points): s = 0.001 × 800 / max cost. The vanilla 0.001
//                     would divide a 12,500-point rung by 13.5 and hand the private pool back to the
//                     cheap old rungs (the 1.92-ladder arm's failure mode).
//
// An ERA-0 rung is vanilla's recipe (× the lift), vanilla's cost and vanilla's employment; an industry with no era-0
// rung has no vanilla-priced rung at all — its first rung is priced at ITS era.
// Secondary methods are NOT written here — tools/emit_secondaries.mjs rescales them at build time
// against whatever main recipe the config carries, reductions by their own good's ratio.
//
// usage: node tools/make_ab_config.mjs --A 2.5 --B 2.5 --suffix ab1 [--base config/mod_config.tier4.json]
//        [--ai-base 1000] [--divisor <s>] [--ai-steep glass,tooling:3] [--ai-defines K=V,K=V]
//        [--in0 1.2] [--in0-only] [--cost-flat] [--ai-ladder 1000,2000,3000,4000]
//        [--bar-months 24] [--variant "name|base|ruled_by|delta"]        (writes config/mod_config.<suffix>.json + tech_tree_options twin)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const A = +arg('--A'), B = +arg('--B'), SFX = arg('--suffix'), BASE = arg('--base', 'config/mod_config.tier4.json');
const AI_BASE = +arg('--ai-base', 1000);
// --in0 <mult> (user-ruled 2026-09-10, FINDINGS F108): rung 0's INPUT VALUE × mult — the 1836 tier deliberately LESS profitable
//   than vanilla so it dies when the ladder arrives; the ladder stays anchored on the lifted rung 0 (rung k inputs = I0 × mult × B^k)
//   unless --in0-only is given (then only rung 0 is lifted and rungs 1+ keep the vanilla-anchored ladder). 1 = the old rule.
const IN0 = +arg('--in0', 1); if (!(IN0 > 0)) throw new Error('--in0 <mult> must be > 0');
const IN0_ONLY = process.argv.includes('--in0-only');
// --cost-flat (user-ruled 2026-09-10, F108 §6: the stall rate follows the cost ladder's steepness): building_cost = the vanilla
//   anchor at EVERY rung — the §10.61 flat book — instead of anchor × A^k.
const COST_FLAT = process.argv.includes('--cost-flat');
// --ai-ladder v0,v1,v2,v3 (user-ruled 2026-09-10): ai_value BY ERA INDEX (t.era, 0-based), an explicit list — "upward but not
//   exponential", e.g. 1000,2000,3000,4000 — instead of AI_BASE × A^era. --ai-steep still overrides for the industries it names.
const AI_LADDER = (() => { const v = arg('--ai-ladder', ''); if (!v) return null; const a = v.split(',').map(Number); if (a.length < 4 || a.some(x => !(x > 0))) throw new Error('--ai-ladder v0,v1,v2,v3 (one value per era, era 0 first)'); return a; })();
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
// --tiers-for <ind>:out=1,2,7,16;in=1,1.5,3,4.5;cost=1,2,6,9  — user-directed 2026-09-04 (the art-academy ladder, take 2): ONE
// industry's rungs get EXPLICIT multipliers over its rung 0 — output × out[k], input VALUE × in[k] (over the rung's own
// vanilla mix, as B does), building_cost × cost[k] — instead of A^k / B^k / A^k. Every array has one entry per rung, rung 0
// first (its entries are 1). ai_value keeps the era rule. Overrides --A-for for that industry.
const TIERS_FOR = (() => { const v = arg('--tiers-for', ''); const o = {}; if (!v) return o; for (const part of v.split(/\s*\|\s*/)) { const [id, spec] = part.split(':'); if (!id || !spec) throw new Error('--tiers-for <ind>:out=..;in=..;cost=..'); const m = {}; for (const kv of spec.split(';')) { const [k, list] = kv.split('='); m[k.trim()] = list.split(',').map(Number); } for (const k of ['out', 'in', 'cost']) if (!m[k] || m[k].some(x => !(x > 0))) throw new Error(`--tiers-for ${id}: ${k}=<positive per-rung multipliers> required`); o[id.trim()] = m; } return o; })();
// --bar-months N (2026-09-13): research_events.industry_bar_months — the 24-month bar of canon-je24 and every book since
//   (§10.76) used to be a hand edit after generation; a book is regenerable by ONE command or it is not regenerable.
const BAR_MONTHS = (() => { const v = arg('--bar-months', ''); if (!v) return null; if (!(+v > 0)) throw new Error('--bar-months <months>'); return +v; })();
// --variant "name|base|ruled_by|delta" (2026-09-13): the `_variant` record the measured books carried by hand — what this
//   book is a variant OF and in what; the exact regenerating command is recorded beside it automatically.
const VARIANT = (() => { const v = arg('--variant', ''); if (!v) return null; const [name, base, ruled_by, delta] = v.split('|').map(s => s.trim()); if (!name) throw new Error('--variant "name|base|ruled_by|delta"'); return { name, base: base || null, ruled_by: ruled_by || null, delta: delta || null }; })();
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
  ind.tiers.forEach((t, pos) => {
    // ⭐ THE KEY IS THE ERA. `pos` (the rung's index in the industry) is used for exactly one thing below: walking DOWN
    //   the industry's own rungs to find the nearest vanilla method whose input MIX this rung borrows. Every multiplier
    //   — output, input value, the lift, cost, ai_value — is a function of `e`.
    const e = t.era;
    if (!Number.isInteger(e) || e < 0) throw new Error(`${ind.id}: rung ${t.key} has no era`);
    // mix: the rung's own vanilla method, else the nearest lower vanilla rung's, else the first rung's
    let mixRec = null;
    for (let j = pos; j >= 0; j--) { const q = rec(ind.tiers[j].vanilla_pm); if (q && Object.keys(q.in).length) { mixRec = q; break; } }
    const mixVal = val(mixRec.in);
    const TF = TIERS_FOR[ind.id];   // explicit per-ERA multipliers (--tiers-for), else the A/B rule
    if (TF && (TF.out.length <= e || TF.in.length <= e || TF.cost.length <= e)) throw new Error(`--tiers-for ${ind.id}: its rungs reach e${e}, so out/in/cost need ${e + 1} multipliers each (indexed by ERA, era 0 first)`);
    const lift = IN0_ONLY ? (e === 0 ? IN0 : 1) : IN0;   // --in0: the lifted era-0 rung, and the ladder anchored on it unless --in0-only
    const Ve = I0 * lift * (TF ? TF.in[e] : Math.pow(B, e));
    const inputs = {};
    for (const [g, q] of Object.entries(mixRec.in)) { const share = q * (PRICE[g] || 0) / mixVal; const qty = r1(share * Ve / PRICE[g]); if (qty > 0) inputs[g] = qty; }
    const Ai = A_FOR[ind.id] || A;   // this industry's own output ratio (--A-for), else the book's A
    t.output_qty = r1(out0 * (TF ? TF.out[e] : Math.pow(Ai, e)));
    t.inputs = inputs;
    delete t.input_ratio;
    t.building_cost = Math.round(anchor * (COST_FLAT ? 1 : (TF ? TF.cost[e] : Math.pow(Ai, e))));   // --cost-flat: §10.61's flat book
    t.ai_value = (AI_LADDER && !(STEEP && STEEP.inds.has(ind.id))) ? Math.round(AI_LADDER[Math.min(e, AI_LADDER.length - 1)]) : Math.round(AI_BASE * Math.pow(STEEP && STEEP.inds.has(ind.id) ? STEEP.ratio : Ai, e));
    const Obase = t.output_qty * PRICE[outGood]; const Ibase = val(inputs); const wp = t.wage_pct != null ? +t.wage_pct : 0.25;
    t.target_be = Math.round(Ibase / ((1 - wp) * Obase) * 100);
    cmax = Math.max(cmax, t.building_cost);
    rows.push({ ind: ind.id, era: e, key: t.key, out: t.output_qty, inputs, cost: t.building_cost, aiv: t.ai_value, be: t.target_be, va: Obase - Ibase, share: Ibase / Obase, emp: Object.values(t.employment || {}).reduce((s, x) => s + x, 0) || 5000 });
  });
}
if (BAR_MONTHS != null) { if (!cfg.research_events) throw new Error('--bar-months: the base carries no research_events block'); cfg.research_events.industry_bar_months = BAR_MONTHS; }
if (STEEP) for (const id of STEEP.inds) if (!cfg.industries.some(i => i.id === id)) throw new Error(`--ai-steep: unknown industry ${id}`);
for (const id of Object.keys(A_FOR)) if (!cfg.industries.some(i => i.id === id && !i.disabled)) throw new Error(`--A-for: unknown or disabled industry ${id}`);
const s = +arg('--divisor', (0.001 * 800 / cmax).toPrecision(3));
cfg.ai_defines = { ...(cfg.ai_defines || {}), PRODUCTION_BUILDING_AUTONOMOUS_INVESTMENT_CONSTRUCTION_COST_DIVISOR_SCALING: s };
// --ai-defines K=V[,K=V...] (2026-09-05): further NAI defines merged into ai_defines — the investment-pool set of
//   canon4v-hai3 (BALANCE_FRAMEWORK §10.75) — so a book carrying them is regenerable by one command, not a hand edit.
const EXTRA_DEFINES = (() => { const v = arg('--ai-defines', ''); if (!v) return {}; const o = {}; for (const kv of v.split(',')) { const [k, x] = kv.split('='); if (!k || !Number.isFinite(+x)) throw new Error('--ai-defines K=V[,K=V]: bad entry ' + kv); o[k.trim()] = +x; } return o; })();
Object.assign(cfg.ai_defines, EXTRA_DEFINES);
cfg.company_target_gate = process.argv.includes('--company-gate');   // emit_companies opt-in; OFF by default (see its header)
cfg._ab = { A, B, A_for: Object.keys(A_FOR).length ? A_FOR : null, tiers_for: Object.keys(TIERS_FOR).length ? TIERS_FOR : null, ai_base: AI_BASE, ai_steep: STEEP ? { industries: [...STEEP.inds], ratio: STEEP.ratio } : null, cost_divisor_scaling: s, company_target_gate: cfg.company_target_gate, base: BASE, generated: new Date().toISOString() };
cfg._ab.ai_defines_extra = Object.keys(EXTRA_DEFINES).length ? EXTRA_DEFINES : null;
cfg._ab.in0 = IN0; cfg._ab.in0_only = IN0_ONLY; cfg._ab.cost_flat = COST_FLAT; cfg._ab.ai_ladder = AI_LADDER; cfg._ab.bar_months = BAR_MONTHS;
// ⭐ the book records that it is era-keyed, and the command that made it — the era pass (2026-09-13) is what a
//   reader of an older book has to check for: a book without `keyed_by: 'era'` was keyed on the rung index
cfg._ab.keyed_by = 'era'; cfg._ab.era_rule = '2026-09-13';
cfg._ab.command = 'node tools/make_ab_config.mjs ' + process.argv.slice(2).map(a => /[\s|"]/.test(a) ? JSON.stringify(a) : a).join(' ');
if (VARIANT) cfg._variant = { ...VARIANT, declared: new Date().toISOString().slice(0, 10), regenerate: cfg._ab.command };
else delete cfg._variant;
cfg._comment = `A/B LADDER (${SFX}) derived by tools/make_ab_config.mjs from ${BASE}, KEYED ON THE RUNG'S ERA (the era rule, 2026-09-13): a rung of era e has output = vanilla lowest-tier × ${A}^e, input value × ${IN0 !== 1 ? IN0 + (IN0_ONLY ? ' (era 0 only)' : '') + ' × ' : ''}${B}^e over the rung's own vanilla mix, building_cost = ${COST_FLAT ? 'the vanilla anchor, flat' : `vanilla anchor × ${A}^e`}, ai_value = ${AI_LADDER ? AI_LADDER.join('/') + ' by era' : `${AI_BASE} × ${A}^e`}, cost-divisor scaling ${s}${STEEP ? `, ai_value ${AI_BASE} × ${STEEP.ratio}^e for ${[...STEEP.inds].join('/')}` : ''}${BAR_MONTHS != null ? `, research_events.industry_bar_months ${BAR_MONTHS}` : ''}. target_be restated as the drift guard.`;
writeFileSync(join(REPO, `config/mod_config.${SFX}.json`), JSON.stringify(cfg));
writeFileSync(join(REPO, `config/tech_tree_options.${SFX}.json`), readFileSync(join(REPO, 'config/tech_tree_options.tier4.json'), 'utf8'));

console.log(`A/B LADDER ${SFX} — KEYED ON ERA: A=${A} B=${B} · era-0 inputs ×${IN0}${IN0_ONLY ? ' (era 0 only)' : ' (ladder anchored on it)'} · cost ${COST_FLAT ? 'FLAT (vanilla anchor every rung)' : 'anchor × A^era'} · ai_value ${AI_LADDER ? AI_LADDER.join('/') + ' by era' : AI_BASE + '×' + A + '^era'} · cost divisor scaling ${s} (top rung ${cmax} pts ÷${(1 + s * cmax).toFixed(2)}, 600-pt rung ÷${(1 + 600 * s).toFixed(2)}; vanilla 0.001 would give ÷${(1 + 0.001 * cmax).toFixed(1)})${BAR_MONTHS != null ? ` · industry bar ${BAR_MONTHS} months` : ''}`);
console.log('industry     era  output      inputs                                                            cost    ai_value  BE%   VA/wk   VA/worker  in-share');
for (const r of rows) console.log(`${r.ind.padEnd(12)} e${r.era}  ${String(r.out).padStart(7)}  ${Object.entries(r.inputs).map(([g, q]) => g + ' ' + q).join(', ').padEnd(62)} ${String(r.cost).padStart(6)}  ${String(r.aiv).padStart(7)}  ${String(r.be).padStart(3)}  ${r.va.toFixed(0).padStart(6)}  ${(r.va / r.emp).toFixed(3).padStart(8)}  ${r.share.toFixed(2)}`);
console.log(`wrote config/mod_config.${SFX}.json + config/tech_tree_options.${SFX}.json`);
