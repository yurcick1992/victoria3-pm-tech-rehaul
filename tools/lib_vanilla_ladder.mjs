// VANILLA, READ LIVE FROM THE GAME — buildings, production-method groups and methods, with the per-method gates and goods.
//
// ⭐⭐ THE RULE (user-ruled 2026-08-30, restated 2026-09-04 for the third time): a tier IS a vanilla production method, and
// the four-rung line consults NO six-rung data. This library reads the game only; make_tier4_config.mjs builds the four-rung
// structure from it and tools/lib_tier4_spec.mjs, the linters read it to check an emitted mod against vanilla.
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
// the vanilla main ladder of a config industry, found through the vanilla_pm its rungs carry
export function mainLadder(V, industry) {
  const mine = [];
  for (const t of industry.tiers || [])
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
