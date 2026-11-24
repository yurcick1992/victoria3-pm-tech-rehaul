// ⭐ DOES EVERY RUNG'S METHOD DO WHAT ITS VANILLA METHOD DOES BESIDE GOODS AND JOBS? (landmine L57, 2026-11-24, FINDINGS F296: the tiered gold
//   mines minted nothing, because a rung's main method is rebuilt from recipe fields and gold's country_minting_add was in none of them.)
//
//   node tools/lint_rung_effects.mjs <modRoot> [configPath] [--strict]
//
// Reads the BUILD over vanilla (a mod file replaces the vanilla file of the same name). For every rung with a `vanilla_pm`:
//   - every modifier of the vanilla method that is not a goods or employment line (country_*, state_*, building_* other than employment)
//     must be on the built method; pollution must equal vanilla's per level (the rule the books follow), any other value must be non-zero;
//   - every gate other than the technology (required_input_goods, disallowing_laws, unlocking_laws, unlocking_principles …) must be there.
// For every vanilla method the book rescales (`pm_goods`): a country_* effect must be scaled with its output (same ratio, ±2%).
// It FAILS for a book that carries `_deposits.country_effects` (make_deposit_config --country-effects); a book without it predates the check
// (records that must still build) and its defects are printed as KNOWN. --strict fails regardless.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const args = process.argv.slice(2), strict = args.includes('--strict'); const [MOD, CFG = 'config/mod_config.json'] = args.filter(a => !a.startsWith('--'));
if (!MOD) { console.error('usage: node tools/lint_rung_effects.mjs <modRoot> [configPath] [--strict]'); process.exit(2); }
const rd = p => readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
function parseText(t, into) {
  const tok = t.replace(/#.*$/gm, '').match(/"[^"]*"|[{}]|[<>=!?]+|[^\s{}=<>"!?]+/g) || []; let i = 0;
  const block = () => { const r = []; while (i < tok.length && tok[i] !== '}') { const k = tok[i++]; if (/^[<>=?!]+$/.test(tok[i] || '')) { i++; if (tok[i] === '{') { i++; const b = block(); i++; r.push([k, b]); } else r.push([k, tok[i++]]); } else r.push([k, null]); } return r; };
  while (i < tok.length) { const k = tok[i++]; if (tok[i] === '=') { i++; if (tok[i] === '{') { i++; const b = block(); i++; into[k.replace(/^[A-Z_]+:/, '')] = b; } else i++; } }
}
const dir = 'common/production_methods'; const V = {}, M = {}; const modFiles = existsSync(join(MOD, dir)) ? readdirSync(join(MOD, dir)).filter(f => f.endsWith('.txt')) : [];
for (const f of readdirSync(join(GAME, dir)).filter(f => f.endsWith('.txt')).sort()) { const t = rd(join(GAME, dir, f)); parseText(t, V); if (!modFiles.includes(f)) parseText(t, M); }
for (const f of modFiles.sort()) parseText(rd(join(MOD, dir, f)), M);
const mods = b => { const o = {}; for (const [k, v] of b) if (Array.isArray(v) && /_modifiers$/.test(k)) for (const [k2, v2] of v) for (const [k3, v3] of (Array.isArray(v2) ? v2 : [])) if (!/^goods_(input|output)_|^building_employment_/.test(k3)) o[`${k}/${k2}/${k3}`] = +v3; return o; };
const SHAPE = new Set(['texture', 'is_default', 'is_hidden_when_unavailable', 'ai_value', 'ai_weight', 'unlocking_technologies', 'unlocking_production_methods', 'low_pop_method', 'pollution_generation', 'timed_modifiers']);
const gates = b => b.filter(([k]) => !/_modifiers$/.test(k) && !SHAPE.has(k)).map(([k, v]) => [k, Array.isArray(v) ? JSON.stringify(v) : v]);
const outOf = b => { const o = {}; for (const [k, v] of b) if (k === 'building_modifiers') for (const [, v2] of v) for (const [k3, v3] of (Array.isArray(v2) ? v2 : [])) { const m = /^goods_output_([a-z_]+)_add$/.exec(k3); if (m) o[m[1]] = (o[m[1]] || 0) + +v3; } return o; };
const cfg = JSON.parse(rd(CFG)); const err = []; let rungs = 0, effects = 0, noSource = 0, lines = 0;
for (const ind of cfg.industries.filter(i => !i.disabled)) for (const t of ind.tiers) {
  if (!t.vanilla_pm) { noSource++; continue; }
  const v = V[t.vanilla_pm], m = M[t.pm_key]; if (!v) { err.push(`${t.key}: vanilla method ${t.vanilla_pm} not found`); continue; } if (!m) { err.push(`${t.key}: built method ${t.pm_key} not found`); continue; }
  rungs++; const mv = mods(v), mm = mods(m);
  for (const [k, q] of Object.entries(mv)) { effects++; if (!(k in mm) || (q !== 0 && mm[k] === 0)) err.push(`${t.pm_key}: ${k} = ${q} in vanilla's ${t.vanilla_pm}, absent on the rung`); else if (/state_pollution_generation_add$/.test(k) && mm[k] !== q) err.push(`${t.pm_key}: pollution ${mm[k]} a level, vanilla's ${q}`); }
  const gm = Object.fromEntries(gates(m)); for (const [k, x] of gates(v)) if (!(k in gm) || gm[k] !== x) err.push(`${t.pm_key}: gate ${k} = ${x} in vanilla's ${t.vanilla_pm}, ${k in gm ? 'is ' + gm[k] : 'absent'} on the rung`);
}
for (const pm of Object.keys(cfg.pm_goods || {})) {
  if (!V[pm] || !M[pm]) continue; const mv = mods(V[pm]), mm = mods(M[pm]); const ov = outOf(V[pm]), om = outOf(M[pm]); const g = Object.keys(ov).find(x => ov[x] > 0); if (!g) continue; const ratio = (om[g] || 0) / ov[g];
  for (const [k, q] of Object.entries(mv)) if (/\/country_/.test(k)) { lines++; if (Math.abs((mm[k] || 0) / q - ratio) > 0.02) err.push(`${pm}: ${k} ${mm[k] ?? 'absent'} for vanilla's ${q} (×${((mm[k] || 0) / q).toFixed(2)}) while its ${g} is ×${ratio.toFixed(2)}`); }
}
const gated = strict || !!(cfg._deposits && cfg._deposits.country_effects);
for (const e of err) console.log((gated ? 'ERROR ' : 'KNOWN ') + e);
const sum = `${rungs} rungs against their vanilla methods, ${effects} non-goods effects, ${lines} scaled line effect(s); ${noSource} minted rung(s) have no vanilla method`;
if (err.length && gated) { console.log(`RUNG EFFECTS FAILED (L57): ${err.length} defect(s); ${sum}`); process.exit(1); }
console.log(err.length ? `RUNG EFFECTS: ${err.length} known defect(s) of a book that predates the check (L57); ${sum}` : `RUNG EFFECTS OK (L57): ${sum}`);
