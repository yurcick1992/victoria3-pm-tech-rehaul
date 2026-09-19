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
//        [--in0 1.2] [--in0-only] [--cost-flat | --cost-ratio 1.6 | --cost-ladder 1.9,3.083,6.859] [--ai-ladder 1000,2000,3000,4000]
//        [--bar-months 24] [--variant "name|base|ruled_by|delta"]        (writes config/mod_config.<suffix>.json + tech_tree_options twin)
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
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
// ⭐⭐ --in0-level <margin> (user-ruled 2026-09-18: "I would still prefer flatter but uniform (between industries) ladder"):
//   a PER-INDUSTRY lift, chosen so every industry's NOTIONAL era-0 rung lands on the SAME margin at base prices, in place of
//   the one scalar --in0. The scalar is why the ladder's LEVEL is not uniform today: it multiplies vanilla's own recipes,
//   whose margins differ wildly (glass +25%, textile +5%, steel -19%, arms +41%, the art academy +108%), so ONE r means a
//   different thing in every industry and a uniform compression drives the thin chains negative while the fat ones stay fat
//   (ROADMAP step 8 P1 / step 9 §3). With the level made uniform, r alone sets the ladder everywhere.
//   lift_i = O0 x (1 - wage_pct) / (I0 x (1 + m0)) — the algebra of margin = O / (I x lift / (1 - wp)) - 1 = m0.
//   ⚠ It is the NOTIONAL era-0 that is levelled, not the industry's first RUNG: O0/I0 come from the first rung's vanilla
//   method and every rung is priced at A^era / B^era from there, so an industry that starts at e2 (automotive, electrics)
//   is levelled on the same basis as one that starts at e0. That is the era rule (F111) and this must not break it.
//   ⚠ EXCLUSIVE with --in0 and with --tiers-for, which set the same numbers by hand.
// ⭐⭐ --in0-stage <raw>,<s1>,<s2> (user-ruled 2026-09-19): the era-0 penalty GRADED BY HOW MANUFACTURED THE INDUSTRY'S OWN INPUTS ARE.
//   "Let's experiment on different in0 depending on how manufactured its inputs are. The 'higher manufactured' they are, the smaller the in0
//   penalty should be. An input which input is itself manufactured gives squared effects. For the purpose of this, dyes, silk and electricity
//   are raw."  THE MECHANISM it corrects: a uniform penalty COMPOUNDS down the chain — an industry eating a manufactured good pays its own
//   penalty AND the price rise its supplier's penalty caused, so a second-stage industry carries roughly the square of a first-stage one.
//   Motor is the measured proof (F143 §3a): its era-0 rung is already at a 0% base margin, engines are bid to 175% of base against vanilla's
//   148%, and it builds half vanilla's levels — a uniform rise would tax every chain that buys engines.
//   ⚠ THIS IS A RULE, NOT PER-INDUSTRY TUNING, which is what separates it from the CLOSED --in0-level axis: a good's STAGE is derived from the
//   recipe book (raw = 0; a good our own ladder makes = 1 + the value-weighted mean stage of ITS first rung's inputs), an industry's stage is
//   the value-weighted mean stage of its own first rung's inputs, and the lift is interpolated on that between the three given values.
//   RAW BY RULING: dye, silk, electricity — our ladder makes them but the goods also come from plantations and from vanilla's own power plants.
const IN0_STAGE = (() => { const v = arg('--in0-stage', ''); if (!v) return null;
  const a = v.split(',').map(Number); if (a.length !== 3 || a.some(x => !(x > 0))) throw new Error('--in0-stage <raw>,<stage1>,<stage2>, all > 0');
  return a; })();
// ⭐⭐ --in0-supplier <k> (user-ruled 2026-09-19, FINDINGS F146 §2): the SUPPLIER-SIDE half of the graded penalty.
//   "I also do like the idea that 'rawness score' (that leads to higher in0) is reduced a bit not only for the manufacturers with manufactured
//   inputs, but also for their suppliers."  --in0-stage relieves an industry for what it BUYS; this relieves it for what it SELLS, and it is the
//   only thing that reaches STEEL — steel eats iron and coal, so no input-keyed rule touches it, and F145 measured steel as the binding
//   constraint of the whole chain (demand 0.97 of vanilla, supply three quarters, 18% of its prices at the +75% ceiling IN THE SHIPPED CANON).
//   THE SCORE: w(g) = the share of good g's 1836 demand that OUR OWN LADDER buys back — the emitted 1836 history (Sigma levels x the rung's own
//   recipe) over the measured 1836 market demand of config/measured_1836.json. Then effective stage = input stage + k x w(the industry's own
//   output good), capped at 2, and the lift is interpolated on THAT. At 1836: steel 1.00, explosives 1.00, dye 0.77, tools 0.12, fertilizer 0.10,
//   paper 0.02, and 0.00 for every pop-fed and army-fed good — so the relief lands on the chain and nowhere else.
//   ⚠ DERIVED FROM 1836 BY RULING ("At this moment, derive from 1836, and we'll balance the late game later. Since A/B, we still should have
//   improvement at higher eras"). The weights are violently era-dependent — at 1910 the same measure reads steel 0.31, explosives 0.04, engines
//   0.04 — because vanilla's own railways, ports and construction grow into the same goods. The lift anchors every rung, so this is an anchor-time
//   number doing a century-long job, knowingly, until the late game is balanced separately.
//   ⚠ It needs the 1836 LEVELS, which exist only in the emitted history, so mod/common/history/buildings must have been built. It THROWS if not.
const IN0_SUPPLIER = (() => { const v = arg('--in0-supplier', ''); if (!v) return null; const k = +v;
  if (!(k >= 0)) throw new Error('--in0-supplier <k>, k >= 0'); return k; })();
// --in0-supplier-mode binary | share (default BINARY, user 2026-09-19: "I thought the 'being an input of a manufacturer' is a binary state").
//   BINARY: w = 1 if ANY tiered rung at ANY era consumes this industry's output good, else 0. A property of the recipe book alone — no levels, no
//     market data, no era choice, and therefore none of the 1836-vs-1910 instability the share version carries.
//   SHARE: w = the share of the good's 1836 demand our own ladder buys back (levels x recipe over the measured market demand). Proportionate, but
//     it answers "how much do MY OWN ladder's buildings take" when the question is "is my output an intermediate good", and a good sold to vanilla's
//     construction sectors and farms is just as intermediate. Kept for A/B.
const IN0_SUPPLIER_MODE = (() => { const v = arg('--in0-supplier-mode', 'map');
  if (!['map', 'any', 'share'].includes(v)) throw new Error('--in0-supplier-mode map|any|share'); return v; })();
const IN0_LEVEL = (() => { const v = arg('--in0-level', ''); if (v === '') return null; const m = +v;
  if (!Number.isFinite(m) || m <= -1) throw new Error('--in0-level <margin> must be a number > -1 (0.05 = +5%)');
  if (IN0 !== 1) throw new Error('--in0-level and --in0 both set the era-0 input level; give one');
  if (IN0_STAGE) throw new Error('--in0-level and --in0-stage both set the era-0 input level; give one');
  if (IN0_SUPPLIER != null) throw new Error('--in0-level and --in0-supplier are different rules; give one');
  return m; })();
// --cost-flat (user-ruled 2026-09-10, F108 §6: the stall rate follows the cost ladder's steepness): building_cost = the vanilla
//   anchor at EVERY rung — the §10.61 flat book — instead of anchor × A^k.
const COST_FLAT = process.argv.includes('--cost-flat');
// --cost-ratio C (user-directed 2026-09-14, the cost-slope tests — F113/F114 bracket the slope: flat cost at A ≥ 1.9 doubles the
//   world and kills rung 0, ×A^era at A 2.2 keeps the world at 0.65–0.92× with rung 0 alive): building_cost = anchor × C^era with C
//   between 1 (flat) and A (capacity-priced). The lint (tools/lint_tier_eras.mjs, L31) reads it from `_ab.cost_ratio`.
const COST_RATIO = (() => { const v = arg('--cost-ratio', ''); if (!v) return null; if (!(+v >= 1)) throw new Error('--cost-ratio <C> must be >= 1'); if (COST_FLAT) throw new Error('--cost-ratio and --cost-flat are exclusive'); return +v; })();
// --cost-ladder m1,m2,m3 (2026-09-16, the PER-ERA cost list): building_cost = anchor × m_era with m_0 = 1 and one explicit multiplier
//   per era above it (the found slope's own ladder is 1.9,3.61,6.859) — so ONE era's cost can move on its own (the 1900 dip is the e2
//   rung's price, F117: canon-c19-e2soft) or a changed A/B can be GAIN-MATCHED per era, the frontier's value added per construction
//   point held at the found book's (FINDINGS F127: canon-b18-gm). Exclusive with --cost-flat and --cost-ratio; recorded as
//   `_ab.cost_ladder`, which tools/lint_tier_eras.mjs (L31) reads when it recomputes cost.
const COST_LADDER = (() => { const v = arg('--cost-ladder', ''); if (!v) return null; if (COST_FLAT || COST_RATIO != null) throw new Error('--cost-ladder is exclusive with --cost-flat and --cost-ratio'); const a = v.split(',').map(Number); if (a.length < 3 || a.some(x => !(x > 0))) throw new Error('--cost-ladder m1,m2,m3 (one multiplier per era ABOVE era 0, era 1 first; era 0 is always 1)'); return [1, ...a]; })();
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
const LEVELLED = {};   // --in0-level / --in0-stage: the per-industry lift actually used, recorded in _ab
// ---- --in0-stage: the goods' manufacturing STAGE, derived from the recipe book itself
const RAW_BY_RULING = new Set(['dye', 'silk', 'electricity']);   // user-ruled 2026-09-19
const STAGE = {}, IND_STAGE = {};
if (IN0_STAGE) {
  const firstRec = {};   // output good -> the recipe of the industry's first rung
  for (const ind of cfg.industries) { if (ind.disabled) continue;
    const t = ind.tiers.slice().sort((a, b) => a.era - b.era)[0], r = rec(t.vanilla_pm);
    const og = t.output_good || ind.output_good;
    if (r && Object.keys(r.in).length && !RAW_BY_RULING.has(og)) firstRec[og] = r.in; }
  const meanStage = (inputs, depth) => { const tot = val(inputs); if (!(tot > 0)) return 0;
    let m = 0; for (const [g, q] of Object.entries(inputs)) m += q * (PRICE[g] || 0) / tot * stageOf(g, depth); return m; };
  const stageOf = (g, depth = 0) => { if (RAW_BY_RULING.has(g) || !firstRec[g]) return 0;
    if (depth > 8) throw new Error('--in0-stage: the recipe graph cycles at ' + g);
    if (STAGE[g] != null) return STAGE[g];
    const v = 1 + meanStage(firstRec[g], depth + 1); STAGE[g] = v; return v; };
  for (const g of Object.keys(firstRec)) stageOf(g);
  for (const ind of cfg.industries) { if (ind.disabled) continue;
    const t = ind.tiers.slice().sort((a, b) => a.era - b.era)[0], r = rec(t.vanilla_pm);
    IND_STAGE[ind.id] = r && Object.keys(r.in).length ? meanStage(r.in, 0) : 0; }
}
// ---- --in0-supplier: w(g), the share of g's 1836 demand our own ladder buys back
const DOWNSTREAM = {};
if (IN0_SUPPLIER != null) {
  if (!IN0_STAGE) throw new Error('--in0-supplier needs --in0-stage: it adds a term to the same stage scale');
  const H = join(REPO, 'mod/common/history/buildings');
  if (IN0_SUPPLIER_MODE === 'share' && !existsSync(H)) throw new Error('--in0-supplier-mode share needs the emitted 1836 history (mod/common/history/buildings) for the LEVELS; build once first, or use the default binary mode which needs neither');
  const LEV = {};
  for (const f of (IN0_SUPPLIER_MODE === 'share' && existsSync(H) ? readdirSync(H) : [])) { const t = readFileSync(join(H, f), 'utf8').replace(/^\uFEFF/, ''); let i = 0;
    while ((i = t.indexOf('create_building', i)) >= 0) { const j = t.indexOf('{', i); let d = 0, k = j;
      for (; k < t.length; k++) { if (t[k] === '{') d++; else if (t[k] === '}') { d--; if (!d) { k++; break; } } }
      const b = t.slice(j, k); const key = (b.match(/building\s*=\s*"([a-z_0-9]+)"/) || [])[1];
      if (key) { let lv = 0; for (const o of b.matchAll(/levels\s*=\s*(\d+)/g)) lv += +o[1]; LEV[key] = (LEV[key] || 0) + (lv || 1); }
      i = k; } }
  if (IN0_SUPPLIER_MODE === 'share' && !Object.keys(LEV).length) throw new Error('--in0-supplier-mode share: the emitted 1836 history yielded no buildings');
  // our ladder's own 1836 demand, from the BASE book's recipes (this generator is about to rewrite them, so the weight must not depend on its own output)
  const D = {};
  for (const ind of cfg.industries) { if (ind.disabled) continue;
    for (const t of ind.tiers) { const lv = LEV[t.key] || 0; if (!lv) continue;
      for (const [g, q] of Object.entries(t.inputs || {})) D[g] = (D[g] || 0) + lv * q; } }
  // the whole market's 1836 demand, measured
  const M = IN0_SUPPLIER_MODE === 'share' ? (JSON.parse(readFileSync(join(REPO, 'config/measured_1836.json'), 'utf8')).markets || {}) : {};
  const T = {};
  for (const mk of Object.values(M)) for (const [g, v] of Object.entries(mk.buy || {})) T[g] = (T[g] || 0) + (+v || 0);
  // ⭐ WHO CONSUMES EACH GOOD — 'map' counts only rungs STANDING ON THE 1836 MAP (user-ruled: "w(g) = 1 if any tiered rung present in 1836
  //   consumes its output good"), read from the committed config/start_baseline.json, which is a config artifact and not a build one.
  //   'any' counts a rung at any era. Either way the RAW_BY_RULING goods score 0 on this side too — the ruling is applied symmetrically,
  //   so a producer of dye, silk or electricity earns no supplier point for selling a good the ruling calls raw.
  const PRESENT = {};
  if (IN0_SUPPLIER_MODE === 'map') { const sum = JSON.parse(readFileSync(join(REPO, 'config/start_baseline.json'), 'utf8')).summary || {};
    if (!Object.keys(sum).length) throw new Error('--in0-supplier-mode map: config/start_baseline.json has no summary');
    for (const [id, v] of Object.entries(sum)) for (const [e, n] of Object.entries(v.tiers || {})) if (n > 0) (PRESENT[id] ||= new Set()).add(+String(e).replace('e', '')); }
  const CONSUMED = {};
  for (const ind of cfg.industries) { if (ind.disabled) continue;
    for (const t of ind.tiers) { if (IN0_SUPPLIER_MODE === 'map' && !(PRESENT[ind.id] || new Set()).has(t.era)) continue;
      for (const g of Object.keys(t.inputs || {})) (CONSUMED[g] ||= new Set()).add(ind.id); } }
  for (const ind of cfg.industries) { if (ind.disabled) continue;
    const og = ind.tiers.slice().sort((a, b) => a.era - b.era)[0].output_good || ind.output_good;
    const others = [...(CONSUMED[og] || [])].filter(x => x !== ind.id);
    DOWNSTREAM[ind.id] = RAW_BY_RULING.has(og) ? 0
      : IN0_SUPPLIER_MODE === 'share' ? (T[og] > 0 ? Math.max(0, Math.min(1, (D[og] || 0) / T[og])) : 0)
      : (others.length ? 1 : 0); }
}
// the lift an industry gets: linear interpolation on its EFFECTIVE stage between the three given values
const effStage = id => Math.max(0, Math.min(2, (IND_STAGE[id] || 0) + (IN0_SUPPLIER != null ? IN0_SUPPLIER * (DOWNSTREAM[id] || 0) : 0)));
const stageLift = id => { const m = effStage(id), i = Math.floor(m), f = m - i;
  return i >= 2 ? IN0_STAGE[2] : IN0_STAGE[i] + f * (IN0_STAGE[i + 1] - IN0_STAGE[i]); };
for (const ind of cfg.industries) {
  if (ind.disabled) continue;
  ind.tiers.sort((a, b) => a.era - b.era);
  const first = ind.tiers[0], r0 = rec(first.vanilla_pm);
  if (!r0 || !Object.keys(r0.in).length) throw new Error(`${ind.id}: first rung ${first.key} has no vanilla recipe (${first.vanilla_pm})`);
  const outGood = first.output_good || ind.output_good;
  const out0 = r0.out[outGood]; if (!(out0 > 0)) throw new Error(`${ind.id}: vanilla ${first.vanilla_pm} makes no ${outGood}`);
  const I0 = val(r0.in), O0 = out0 * PRICE[outGood];
  const anchor = ANCH[(ind.building || {}).required_construction || ind.required_construction]; if (!anchor) throw new Error(`${ind.id}: no required_construction class`);
  const wp0 = ind.tiers[0].wage_pct != null ? +ind.tiers[0].wage_pct : 0.25;
  const LEVEL_LIFT = IN0_LEVEL != null ? O0 * (1 - wp0) / (I0 * (1 + IN0_LEVEL)) : IN0_STAGE ? stageLift(ind.id) : 1;
  if (IN0_LEVEL != null || IN0_STAGE) LEVELLED[ind.id] = Math.round(LEVEL_LIFT * 1000) / 1000;
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
    // --in0-level: this industry's own lift, so its notional era-0 margin equals the ruled target; else the scalar --in0.
    const lift = (IN0_LEVEL != null || IN0_STAGE) ? LEVEL_LIFT : (IN0_ONLY ? (e === 0 ? IN0 : 1) : IN0);
    const Ve = I0 * lift * (TF ? TF.in[e] : Math.pow(B, e));
    const inputs = {};
    for (const [g, q] of Object.entries(mixRec.in)) { const share = q * (PRICE[g] || 0) / mixVal; const qty = r1(share * Ve / PRICE[g]); if (qty > 0) inputs[g] = qty; }
    const Ai = A_FOR[ind.id] || A;   // this industry's own output ratio (--A-for), else the book's A
    t.output_qty = r1(out0 * (TF ? TF.out[e] : Math.pow(Ai, e)));
    t.inputs = inputs;
    delete t.input_ratio;
    if (COST_LADDER && e >= COST_LADDER.length) throw new Error(`--cost-ladder: ${ind.id} reaches e${e}, the ladder has ${COST_LADDER.length - 1} multipliers above era 0`);
    t.building_cost = Math.round(anchor * (COST_FLAT ? 1 : (TF ? TF.cost[e] : COST_LADDER ? COST_LADDER[e] : Math.pow(COST_RATIO ?? Ai, e))));   // --cost-flat: §10.61's flat book; --cost-ratio: anchor × C^era; --cost-ladder: anchor × m_era
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
cfg._ab.in0 = IN0; cfg._ab.in0_level = IN0_LEVEL; cfg._ab.in0_stage = IN0_STAGE; cfg._ab.in0_supplier = IN0_SUPPLIER; cfg._ab.in0_supplier_mode = IN0_SUPPLIER != null ? IN0_SUPPLIER_MODE : null; cfg._ab.downstream_weight = IN0_SUPPLIER != null ? DOWNSTREAM : null; cfg._ab.good_stage = IN0_STAGE ? STAGE : null; cfg._ab.industry_stage = IN0_STAGE ? IND_STAGE : null; cfg._ab.in0_per_industry = (IN0_LEVEL != null || IN0_STAGE) ? LEVELLED : null; cfg._ab.in0_only = IN0_ONLY; cfg._ab.cost_flat = COST_FLAT; cfg._ab.cost_ratio = COST_RATIO; cfg._ab.cost_ladder = COST_LADDER; cfg._ab.ai_ladder = AI_LADDER; cfg._ab.bar_months = BAR_MONTHS;
// ⭐ the book records that it is era-keyed, and the command that made it — the era pass (2026-09-13) is what a
//   reader of an older book has to check for: a book without `keyed_by: 'era'` was keyed on the rung index
cfg._ab.keyed_by = 'era'; cfg._ab.era_rule = '2026-09-13';
cfg._ab.command = 'node tools/make_ab_config.mjs ' + process.argv.slice(2).map(a => /[\s|"]/.test(a) ? JSON.stringify(a) : a).join(' ');
if (VARIANT) cfg._variant = { ...VARIANT, declared: new Date().toISOString().slice(0, 10), regenerate: cfg._ab.command };
else delete cfg._variant;
cfg._comment = `A/B LADDER (${SFX}) derived by tools/make_ab_config.mjs from ${BASE}, KEYED ON THE RUNG'S ERA (the era rule, 2026-09-13): a rung of era e has output = vanilla lowest-tier × ${A}^e, input value × ${IN0 !== 1 ? IN0 + (IN0_ONLY ? ' (era 0 only)' : '') + ' × ' : ''}${B}^e over the rung's own vanilla mix, building_cost = ${COST_FLAT ? 'the vanilla anchor, flat' : COST_LADDER ? `vanilla anchor × ${COST_LADDER.join('/')} by era` : `vanilla anchor × ${COST_RATIO ?? A}^e`}, ai_value =${AI_LADDER ? AI_LADDER.join('/') + ' by era' : `${AI_BASE} × ${A}^e`}, cost-divisor scaling ${s}${STEEP ? `, ai_value ${AI_BASE} × ${STEEP.ratio}^e for ${[...STEEP.inds].join('/')}` : ''}${BAR_MONTHS != null ? `, research_events.industry_bar_months ${BAR_MONTHS}` : ''}. target_be restated as the drift guard.`;
writeFileSync(join(REPO, `config/mod_config.${SFX}.json`), JSON.stringify(cfg));
writeFileSync(join(REPO, `config/tech_tree_options.${SFX}.json`), readFileSync(join(REPO, 'config/tech_tree_options.tier4.json'), 'utf8'));

console.log(`A/B LADDER ${SFX} — KEYED ON ERA: A=${A} B=${B} · era-0 inputs ×${IN0}${IN0_ONLY ? ' (era 0 only)' : ' (ladder anchored on it)'} · cost ${COST_FLAT ? 'FLAT (vanilla anchor every rung)' : COST_LADDER ? `anchor × ${COST_LADDER.join('/')} by era (--cost-ladder)` : COST_RATIO ? `anchor × ${COST_RATIO}^era (--cost-ratio)` : 'anchor × A^era'} · ai_value${AI_LADDER ? AI_LADDER.join('/') + ' by era' : AI_BASE + '×' + A + '^era'} · cost divisor scaling ${s} (top rung ${cmax} pts ÷${(1 + s * cmax).toFixed(2)}, 600-pt rung ÷${(1 + 600 * s).toFixed(2)}; vanilla 0.001 would give ÷${(1 + 0.001 * cmax).toFixed(1)})${BAR_MONTHS != null ? ` · industry bar ${BAR_MONTHS} months` : ''}`);
if (IN0_STAGE) { console.log('--in0-stage ' + IN0_STAGE.join(' / ') + ' (raw / stage 1 / stage 2), dye+silk+electricity RAW by ruling');
  console.log('  good stages: ' + Object.entries(STAGE).sort((a, b) => b[1] - a[1]).map(([g, v]) => g + ' ' + v.toFixed(2)).join(' · '));
  if (IN0_SUPPLIER != null) console.log('  --in0-supplier ' + IN0_SUPPLIER + ' (' + IN0_SUPPLIER_MODE + '): w(own output) -> ' + Object.entries(DOWNSTREAM).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([i, v]) => i + ' ' + v.toFixed(2)).join(' · '));
  console.log('  industry input stage -> lift: ' + Object.entries(IND_STAGE).sort((a, b) => effStage(b[0]) - effStage(a[0])).map(([i, v]) => i + ' ' + v.toFixed(2) + (IN0_SUPPLIER != null ? '+' + (IN0_SUPPLIER * (DOWNSTREAM[i] || 0)).toFixed(2) : '') + '->x' + LEVELLED[i]).join(' · ')); }
console.log('industry     era  output      inputs                                                            cost    ai_value  BE%   VA/wk   VA/worker  in-share');
for (const r of rows) console.log(`${r.ind.padEnd(12)} e${r.era}  ${String(r.out).padStart(7)}  ${Object.entries(r.inputs).map(([g, q]) => g + ' ' + q).join(', ').padEnd(62)} ${String(r.cost).padStart(6)}  ${String(r.aiv).padStart(7)}  ${String(r.be).padStart(3)}  ${r.va.toFixed(0).padStart(6)}  ${(r.va / r.emp).toFixed(3).padStart(8)}  ${r.share.toFixed(2)}`);
console.log(`wrote config/mod_config.${SFX}.json + config/tech_tree_options.${SFX}.json`);
