// THE ERA-RULE LINTER — landmine L31. Every four-rung config, on every build, against THE ERA RULE
// (user-ruled 2026-09-13; BALANCE_FRAMEWORK §10.78; the header of tools/lib_tier4_spec.mjs):
//
//   node tools/lint_tier_eras.mjs [--config <path>] [--tree <path>] [--census]
//
//   1. PLACEMENT — every rung's narrative era (t.era) sits within ERA_TOLERANCE of the narrative era its gate
//      technology's GAME era implies through the book's own `era_game_era` (1 → e0, 2 → e1, 3 → e1, 4 → e2,
//      5 → e3), eras strictly increase within an industry (one rung per era), and no rung sits outside 0..N-1.
//      The technology's era is read from the config's PAIRED TREE (the L20 twin), i.e. the era the mod SHIPS —
//      an ERA_MOVES move counts, a vanilla era the tree overrode does not.
//   2. THE ERA-KEYED BOOK (A/B books only, `_ab` present) — the ladder is a function of the rung's ERA and of
//      nothing else: output_qty = vanilla first-method output × A^era, input value = vanilla first-method input
//      value × lift × B^era (over the rung's own mix; value checked, not quantities), building_cost = anchor
//      (flat), anchor × C^era (`_ab.cost_ratio`) or anchor × m_era from the per-era list (`_ab.cost_ladder`),
//      ai_value = the era list or AI_BASE × ratio^era. `--A-for` / `--tiers-for`
//      industries are checked only for monotonicity (their multipliers are ruled per industry).
//   3. UNIFORM EFFECTIVENESS — within every industry, output per level and value added per level at base prices
//      strictly INCREASE with era. "Late tiers are uniformly more effective than earlier ones" is the design's
//      claim about what an era number MEANS; a book where it fails has mislabelled a rung.
//
// WHY A LINT AND NOT ONLY THE GENERATOR: the generator can only guard the books it writes. A hand-edited config,
// a book from an older generator (every book before 2026-09-13 keyed the ladder on the rung index — automotive's
// e2 rung carried an 1836 rung's recipe, FINDINGS F111), or a spec edit that quietly re-orders a placement are
// all invisible to it. This reads the ARTIFACT, like verify_pms.mjs and lint_solvency.mjs, and build.ps1 THROWS
// on a non-zero exit. A six-rung book (no `era_game_era`) is not in scope: it says so and exits 0.
//
// ⚠ It needs the game files for check 2 (the vanilla first-method recipe is the ladder's anchor); with VIC3_GAME
//   unset it uses the default Steam path. Check 1 and 3 need only the config and its tree.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const CFG_PATH = arg('--config', process.env.MOD_CONFIG || 'config/mod_config.json');
const abs = p => (p.match(/^([A-Za-z]:[\\/]|\/)/) ? p : join(REPO, p));
const cfg = JSON.parse(readFileSync(abs(CFG_PATH), 'utf8'));
const sfx = (() => { const m = CFG_PATH.replace(/\\/g, '/').match(/mod_config\.(.+)\.json$/); return m ? '.' + m[1] : ''; })();
const TREE_PATH = arg('--tree', `config/tech_tree_options${sfx}.json`);
const CENSUS = process.argv.includes('--census');
const TOL = 1;   // ERA_TOLERANCE — the spec's constant, restated here because this reads the artifact, not the spec

if (!Array.isArray(cfg.era_game_era)) {
  console.log(`lint_tier_eras: ${CFG_PATH} carries no era_game_era (not a four-rung book) — the era rule is not in scope for it. OK.`);
  process.exit(0);
}
if (!existsSync(abs(TREE_PATH))) { console.error(`lint_tier_eras: no paired tree ${TREE_PATH} (landmine L20) — the era rule cannot be checked without the shipping technology eras`); process.exit(1); }
const tree = JSON.parse(readFileSync(abs(TREE_PATH), 'utf8'));
const opt = tree.options.find(o => o.ships) || tree.options[0];
const TECH_ERA = Object.fromEntries(opt.techs.map(t => [t.id, t.era]));
const N = cfg.era_game_era.length;
const GE = cfg.era_game_era;                     // narrative era -> game era
const eraOfGameEra = ge => { if (ge <= 1) return 0; const i = GE.findIndex(g => g >= ge); return i < 0 ? N - 1 : i; };   // the gap (era 2) rounds UP
// prices, the vanilla recipe anchor, the construction anchors — as make_ab_config reads them
const PRICE = {}; for (const l of readFileSync(join(REPO, 'tools/goods_prices.tsv'), 'utf8').split(/\r?\n/)) { const m = l.trim().split(/\t|\s+/); if (m.length >= 2 && +m[1] > 0) PRICE[m[0]] = +m[1]; }
const val = o => Object.entries(o || {}).reduce((s, [g, q]) => s + q * (PRICE[g] || 0), 0);
const ANCH = { construction_cost_low: 200, construction_cost_medium: 400, construction_cost_high: 600, construction_cost_very_high: 800 };
let PM = null;
const vanillaRec = pm => {
  if (!PM) { PM = {}; const strip = s => s.replace(/^\uFEFF/, '').replace(/#.*$/mg, ''); const dir = join(GAME, 'common/production_methods'); if (!existsSync(dir)) return null;
    for (const f of readdirSync(dir)) { let depth = 0, name = null, buf = ''; for (const l of strip(readFileSync(join(dir, f), 'utf8')).split(/\r?\n/)) { if (depth === 0) { const m = l.match(/^\s*([A-Za-z0-9_\-]+)\s*=\s*\{/); if (m) { name = m[1]; buf = ''; } } if (name) buf += l + '\n'; for (const ch of l) { if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth === 0 && name) { PM[name] = buf; name = null; } } } } } }
  const b = pm && PM[pm]; if (!b) return null; const io = { in: {}, out: {} };
  for (const m of b.matchAll(/goods_(input|output)_([a-z_]+)_add\s*=\s*(-?[\d.]+)/g)) io[m[1] === 'input' ? 'in' : 'out'][m[2]] = +m[3];
  return io;
};

const faults = [], notes = [], rows = [];
const AB = cfg._ab || null;
for (const ind of cfg.industries || []) {
  if (ind.disabled) continue;
  const tiers = [...(ind.tiers || [])].filter(t => !t.model_only).sort((a, b) => (a.era ?? 0) - (b.era ?? 0));
  if (!tiers.length) continue;
  // ---- 1. placement ---------------------------------------------------------------------------------------------
  tiers.forEach((t, k) => {
    const e = t.era;
    if (!Number.isInteger(e) || e < 0 || e > N - 1) { faults.push(`${ind.id} ${t.key}: era ${e} outside 0..${N - 1}`); return; }
    if (k && !(e > tiers[k - 1].era)) faults.push(`${ind.id} ${t.key}: era ${e} not above the rung below (e${tiers[k - 1].era}) — one rung per era`);
    const ge = t.tech ? TECH_ERA[t.tech] : 1;
    if (ge == null) { faults.push(`${ind.id} ${t.key}: technology ${t.tech} is not in the paired tree`); return; }
    const imp = eraOfGameEra(ge); const d = e - imp;
    rows.push({ ind: ind.id, era: e, tech: t.tech || '(none)', ge, imp, d, out: t.output_qty, cost: t.building_cost, aiv: t.ai_value });
    if (Math.abs(d) > TOL) faults.push(`${ind.id} ${t.key}: sits at e${e} but its technology ${t.tech} is game era ${ge} → e${imp}, ${Math.abs(d)} eras off (tolerance ±${TOL})`);
  });
  // ---- 3. uniform effectiveness --------------------------------------------------------------------------------
  for (let k = 1; k < tiers.length; k++) {
    const a = tiers[k - 1], b = tiers[k];
    const vaA = (a.output_qty || 0) * (PRICE[a.output_good || ind.output_good] || 0) - val(a.inputs), vaB = (b.output_qty || 0) * (PRICE[b.output_good || ind.output_good] || 0) - val(b.inputs);
    if (!(b.output_qty > a.output_qty)) faults.push(`${ind.id}: e${b.era} makes ${b.output_qty} against e${a.era}'s ${a.output_qty} — a later era must out-produce the one below`);
    if (!(vaB > vaA)) faults.push(`${ind.id}: e${b.era} adds £${vaB.toFixed(0)} a level against e${a.era}'s £${vaA.toFixed(0)} — a later era must add more value per level at base prices`);
  }
  // ---- 2. the era-keyed book ----------------------------------------------------------------------------------
  if (!AB) continue;
  const A = +AB.A, B = +AB.B, lift = +(AB.in0 ?? 1), in0only = !!AB.in0_only;
  // ⭐ --in0-level (2026-09-18): the era-0 input LEVEL is per industry, not one scalar, so the rule this linter
  //   recomputes is `vanilla × lift_i × B^era` with lift_i from _ab.in0_per_industry. Without this the lint FAILS on
  //   every rung of a levelled book, which is the guardrail working - it must be taught the field, never bypassed.
  const perInd = AB.in0_per_industry || null;
  const special = (AB.A_for && AB.A_for[ind.id]) || (AB.tiers_for && AB.tiers_for[ind.id]);
  if (special) { notes.push(`${ind.id}: per-industry multipliers (--A-for / --tiers-for) — ladder checked for monotonicity only`); continue; }
  // ⭐⭐ --anchor-for (2026-09-19, FINDINGS F148 §9): the ladder's ×1 is a NAMED rung, not necessarily the first, so the
  //   exponent counts from that rung's era — output and input value alone; cost and ai_value stay on the absolute era.
  //   Without this the lint FAILS on every rung of an anchor-shifted industry, which is the guardrail working: teach it the
  //   field, never bypass it.
  const aEra = (AB.anchor_for && AB.anchor_for[ind.id] != null) ? +AB.anchor_for[ind.id] : null;
  if (aEra != null && !tiers.some(t => t.era === aEra)) { faults.push(`${ind.id}: _ab.anchor_for says e${aEra}, which it has no rung for`); continue; }
  const first = aEra != null ? tiers.find(t => t.era === aEra) : tiers[0]; const r0 = vanillaRec(first.vanilla_pm);
  if (!r0) { notes.push(`${ind.id}: vanilla recipe for ${first.vanilla_pm} unreadable (game files absent?) — book multipliers not checked`); continue; }
  // ⚠⚠ 0 unless --anchor-for names it — NOT `first.era`: the four industries with no e0 rung are keyed on the absolute era
  //   (the era rule, §10.78 rule 3; keying them on their own first rung is the F111 bug).
  const ORIGIN = aEra != null ? first.era : 0;
  if (aEra != null) notes.push(`${ind.id}: ladder anchored on e${ORIGIN} (--anchor-for) — output/input checked as A^(era−${ORIGIN}), cost and ai_value on the absolute era`);
  const good = first.output_good || ind.output_good; const out0 = r0.out[good]; const I0 = val(r0.in);
  const anchor = ANCH[(ind.building || {}).required_construction || ind.required_construction];
  for (const t of tiers) {
    const e = t.era, k = e - ORIGIN;
    const wantOut = Math.round(out0 * Math.pow(A, k) * 10) / 10;
    if (Math.abs(t.output_qty - wantOut) > 0.051 + 0.002 * wantOut) faults.push(`${ind.id} e${e}: output ${t.output_qty}, the era rule says ${wantOut} (vanilla ${out0} × ${A}^${k}) — keyed on something other than the era`);
    const liftI = perInd && perInd[ind.id] != null ? +perInd[ind.id] : lift;
    const wantIn = I0 * (in0only ? (k === 0 ? liftI : 1) : liftI) * Math.pow(B, k); const gotIn = val(t.inputs);
    if (Math.abs(gotIn - wantIn) > 0.03 * wantIn + 1) faults.push(`${ind.id} e${e}: input value £${gotIn.toFixed(0)}, the era rule says £${wantIn.toFixed(0)} (vanilla £${I0.toFixed(0)} × ${lift} × ${B}^${k})`);
    // cost: flat (§10.61), or anchor × C^era where C is the book's own cost ratio (`_ab.cost_ratio`, the cost-slope books of
    // 2026-09-14) and A by default (capacity-priced, the canon)
    // ... or anchor × m_era from an explicit per-era list (`_ab.cost_ladder`, 2026-09-16 — one era's cost moved on its own, or a changed A/B gain-matched per era)
    if (anchor) { const C = AB.cost_ratio ?? A; const L = Array.isArray(AB.cost_ladder) ? AB.cost_ladder : null; const wantCost = AB.cost_flat ? anchor : L ? Math.round(anchor * L[Math.min(e, L.length - 1)]) : Math.round(anchor * Math.pow(C, e)); if (t.building_cost !== wantCost) faults.push(`${ind.id} e${e}: building_cost ${t.building_cost}, the era rule says ${wantCost} (anchor ${anchor} × ${L ? L[e] + ' by era' : C + '^' + e})`); }
    const steep = AB.ai_steep && AB.ai_steep.industries.includes(ind.id) ? AB.ai_steep.ratio : null;
    const wantAiv = (AB.ai_ladder && !steep) ? Math.round(AB.ai_ladder[Math.min(e, AB.ai_ladder.length - 1)]) : Math.round((AB.ai_base ?? 1000) * Math.pow(steep || A, e));
    if (t.ai_value !== wantAiv) faults.push(`${ind.id} e${e}: ai_value ${t.ai_value}, the era rule says ${wantAiv}`);
  }
}
if (AB && AB.keyed_by !== 'era') notes.push(`_ab.keyed_by is '${AB.keyed_by || 'unset'}' — a book from before the era pass (2026-09-13); its ladder was keyed on the rung index unless the checks above pass`);

if (CENSUS) {
  console.log(`ERA CENSUS of ${CFG_PATH} (tree ${TREE_PATH}) — era_game_era ${GE.join('/')}, tolerance ±${TOL}`);
  console.log('  industry     era  technology                 game era  → era   off   output    cost  ai_value');
  for (const r of rows) console.log('  ' + r.ind.padEnd(12) + ' e' + r.era + '   ' + r.tech.padEnd(26) + String(r.ge).padStart(6) + '      e' + r.imp + '   ' + (r.d ? (r.d > 0 ? '+' : '') + r.d : ' 0').padStart(3) + String(r.out).padStart(9) + String(r.cost).padStart(8) + String(r.aiv).padStart(9));
}
for (const n of notes) console.log('  note: ' + n);
if (faults.length) {
  console.error(`ERA-RULE LINT FAILED (L31) — ${faults.length} fault(s) in ${CFG_PATH}:\n  ` + faults.join('\n  '));
  console.error('  The rule: BALANCE_FRAMEWORK §10.78 / tools/lib_tier4_spec.mjs. Regenerate the book (make_tier4_config → make_tier4_techs → make_ab_config) rather than hand-editing.');
  process.exit(1);
}
console.log(`ERA-RULE LINT PASSED (L31): ${rows.length} rungs of ${CFG_PATH} — every rung within ±${TOL} of its technology's era, one rung per era, output and value added rising with era${AB ? ', the A/B book keyed on era' : ''}.`);
