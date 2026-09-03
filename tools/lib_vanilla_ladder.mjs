// THE VANILLA MAIN LADDER, read live from the game — the source the four-rung tiers are built FROM.
//
// ⭐⭐ THE RULE (user-ruled 2026-08-30): a tier IS a vanilla production method. Rungs come from the
// anchor building's `pmg_base_*` group, in VANILLA ORDER, keeping the method's key as `vanilla_pm`
// and its unlocking technology as the gate. We invent a rung ONLY where vanilla has fewer methods
// than the industry needs, and then peg to an existing technology before minting one.
//
// ⚠ Going vanilla → 6 rungs → 4 rungs was the mistake this replaces: the six-rung book invented 1–3
// rungs per industry, and the four-rung cut then ran a DP over THOSE, landing on a set that matched
// neither vanilla's methods nor its gates — which is how four vanilla technologies ended up gating
// nothing (BUGS_AND_FIXES 2026-08-30).
// ⚠ A rung's ERA is the vanilla ERA of its gate, never the technology's onset YEAR: vanilla dates at
// INVENTION (crystal_glass 1674, chemical_bleaching 1799), so banding by year puts 13 of 18 ladders
// in conflict where banding by era leaves 5.
// ⚠ Token class must admit a HYPHEN — `pm_ammonia-soda_process`, `pm_coal-fired_plant`. An
// [a-z_0-9]+ class silently splits them (CLAUDE.md flags the same trap in emit_techs).
import {readFileSync, readdirSync} from 'fs';

const rd = p => readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
export function blocks(s) {
  const out = {}; const L = s.split(/\r?\n/); let cur = null, depth = 0, buf = [];
  for (const l of L) { const c = l.split('#')[0];
    if (depth === 0) { const m = /^([a-zA-Z_][a-zA-Z_0-9-]*)\s*=\s*\{/.exec(c);
      if (m) { cur = m[1]; buf = [l]; depth = (c.match(/\{/g)||[]).length - (c.match(/\}/g)||[]).length;
        if (depth === 0) { out[cur] = buf.join('\n'); cur = null; } continue; } }
    else { buf.push(l); depth += (c.match(/\{/g)||[]).length - (c.match(/\}/g)||[]).length;
      if (depth <= 0) { out[cur] = buf.join('\n'); cur = null; } } }
  return out;
}
export function readVanilla(G) {
  const PMG = {}, PMBODY = {}, BLD = {};
  for (const f of readdirSync(`${G}/common/production_method_groups`)) {
    const b = blocks(rd(`${G}/common/production_method_groups/${f}`));
    for (const [k, body] of Object.entries(b)) {
      const m = /production_methods\s*=\s*\{([\s\S]*?)\}/.exec(body);
      PMG[k] = m ? (m[1].match(/[a-z_0-9-]+/g) || []) : []; } }
  for (const f of readdirSync(`${G}/common/production_methods`)) {
    const b = blocks(rd(`${G}/common/production_methods/${f}`));
    for (const [k, body] of Object.entries(b)) PMBODY[k] = body; }
  for (const f of readdirSync(`${G}/common/buildings`)) {
    const b = blocks(rd(`${G}/common/buildings/${f}`));
    for (const [k, body] of Object.entries(b)) BLD[k] = body; }
  const groupOf = {}; for (const [g, pms] of Object.entries(PMG)) for (const p of pms) if (!groupOf[p]) groupOf[p] = g;
  const gatesOf = p => { const m = /unlocking_technologies\s*=\s*\{([\s\S]*?)\}/.exec(PMBODY[p] || '');
    return m ? (m[1].match(/[a-z_0-9-]+/g) || []) : []; };
  const goodsOf = p => { const b = PMBODY[p] || '';
    return { in: Object.fromEntries([...b.matchAll(/goods_input_([a-z_]+)_add\s*=\s*(-?[0-9.]+)/g)].map(m => [m[1], +m[2]])),
             out: Object.fromEntries([...b.matchAll(/goods_output_([a-z_]+)_add\s*=\s*(-?[0-9.]+)/g)].map(m => [m[1], +m[2]])) }; };
  return { PMG, PMBODY, BLD, groupOf, gatesOf, goodsOf };
}
// the main ladder for an industry, found through any vanilla_pm it holds in EITHER book
export function mainLadder(V, industry, canonIndustry) {
  const mine = [];
  for (const src of [industry, canonIndustry]) if (src) for (const t of src.tiers || [])
    for (const p of [t.vanilla_pm, ...(t.vanilla_pm_aliases || [])]) if (p && !mine.includes(p)) mine.push(p);
  const g = mine.map(p => V.groupOf[p]).find(Boolean);
  return { group: g || null, methods: g ? V.PMG[g] : [] };
}

// The vanilla BUILDING's own unlocking technology — the fallback gate for a rung whose vanilla
// production method is UNGATED (pm_leblanc_process, pm_bakery, pm_muskets …). Those methods are
// available whenever the building is, so the building's gate is the honest answer; without it the
// rung keeps the canonical tier's technology, which may be a SIX-RUNG INVENTION that no longer
// exists in this tree (leblanc_process was exactly that).
export function buildingGate(V, key) {
  const body = V.BLD[key] || '';
  const m = /unlocking_technologies\s*=\s*\{([\s\S]*?)\}/.exec(body);
  return m ? (m[1].match(/[a-z_0-9-]+/g) || [])[0] || null : null;
}
