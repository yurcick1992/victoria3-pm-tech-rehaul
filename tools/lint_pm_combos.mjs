#!/usr/bin/env node
// ⭐⭐ THE PRODUCTION-METHOD COMBINATION LINTER — the HARD rule (user-ruled 2026-10-02, BALANCE_FRAMEWORK §10.93), run by
// build.ps1 on every build and THROWING there. It reads the EMITTED mod layered over the game, never the generators' view of it
// (the verify_pms.mjs principle: an emitter bug cannot hide behind the generator's own idea of what it meant to write).
//
//   node tools/lint_pm_combos.mjs [modDir] [config]        (defaults: mod, config/mod_config.json)
//
// FIVE CHECKS — the first three over EVERY building the game will load (vanilla's included, because a `pm_goods` override can
// reach a vanilla building through a production-method file we own), the last two over our tier buildings:
//   1. NO NUMBER GOES NEGATIVE. For every LEGAL combination of one method per group (a method gated by
//      `unlocking_production_methods` is legal only beside one of the methods it names), the building's total of every input
//      good, every output good AND every profession's employment must be ≥ −0.011 (one hundredth, the emitted resolution, plus a
//      hair: vanilla's own car plant nets automobiles to exactly zero with both conversions, and the rescaled copies to ±1e-15).
//      The user, 2026-10-02: "no secondary can exist that in combination with an allowed compatible primary takes any number into
//      the negative (one of the input goods or employment)". tools/lint_negative_goods.awk checks goods only and PRINTS; this one
//      adds employment and FAILS the build.
//   2. NO DEAD METHOD. A method gated on main methods the building does not carry can never run there, yet the game still SHOWS it
//      in the dropdown at its own numbers — which is how vanilla's elastics (−70 clothes), precision tools (−55 furniture) and bone
//      china (−20 glass) appeared on the 500-worker craft rungs that make 2–3 a level (the user's playtest, 2026-10-02). "If those
//      PMs are actually disallowed by something, we need to not show them (or not have)." emit_secondaries now leaves them out.
//   3. EVERY 1836 HISTORY BLOCK NAMES ONLY METHODS ITS BUILDING HAS. The engine rejects a whole create_building over one invalid
//      method (130 starting factories vanished that way on 2026-09-01 with every linter green), so a group copy that drops a
//      member must never drop one the start names.
//   4. NARRATIVE COMPATIBILITY, PAIR BY PAIR (tier buildings): no secondary or automation method beside a main method the
//      one-by-one review in tools/lib_secondary_compat.mjs marked it incompatible with — Assembly Lines beside Muskets, Rifles,
//      Cannons, Smoothbores, Percussion Caps or Wrought Iron Tools; powered automation beside the handcraft methods; … (user-ruled
//      2026-10-02: "No, no universal rule. Go through all vanilla combinations one by one"). A rung is judged by its VANILLA main
//      method, a minted addition by the vanilla method below it. A carried pair the review never looked at is a WARNING, not a
//      failure — a patch that adds a method, or a book that adds an industry, owes the table a row.
//   5. A CRAFT RUNG (workforce_mult < 1) CARRIES NO LABOUR-SAVING METHOD (BALANCE_FRAMEWORK §10.91.1): nothing in its groups may
//      reduce employment.
//   6. EVERY GROUP HAS SOMETHING TO RUN BESIDE EVERY MAIN METHOD of a tier building (PM gates; technology aside) — a merged building's
//      mandated group holds only copies each gated to one main method, so a gap would leave the engine nothing valid to select.
//   7. A MANDATED AUTOMATION (lib_secondary_compat MANDATED, user-ruled 2026-10-02: Mechanized Looms with Sewing Machines, Automatic
//      Power Looms with Electric Sewing Machines, Assembly Lines with Mass Production) is offered by exactly one group beside its main
//      method, is the ONLY method of that group legal there, and carries no technology gate its main method does not imply (the building's
//      technology and the method's, with every prerequisite, in the tree the mod loads) — so it always comes with the main method.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { notBeside, reviewed, validateCompat, mandatedFor, readTechPrereqs, techClosure } from './lib_secondary_compat.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const argMod = process.argv[2] || 'mod';
const argCfg = process.argv[3] || process.env.MOD_CONFIG || 'config/mod_config.json';
const MOD = isAbsolute(argMod) ? argMod : join(REPO, argMod);
const CFGP = isAbsolute(argCfg) ? argCfg : join(REPO, argCfg);
const TOL = 0.011;
const COMBO_CAP = 2_000_000;
if (!existsSync(MOD)) { console.error('lint_pm_combos: no emitted mod at ' + MOD); process.exit(2); }

const rd = p => readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const noComments = s => s.split(/\r?\n/).map(l => { const i = l.indexOf('#'); return i < 0 ? l : l.slice(0, i); }).join('\n');
function blocks(s) {
  const out = {}; const L = s.split(/\r?\n/); let cur = null, depth = 0, buf = [];
  for (const l of L) { const c = l.split('#')[0];
    if (depth === 0) { const m = /^([a-zA-Z_][a-zA-Z_0-9-]*)\s*=\s*\{/.exec(c);
      if (m) { cur = m[1]; buf = [l]; depth = (c.match(/\{/g) || []).length - (c.match(/\}/g) || []).length;
        if (depth === 0) { out[cur] = buf.join('\n'); cur = null; } continue; } }
    else { buf.push(l); depth += (c.match(/\{/g) || []).length - (c.match(/\}/g) || []).length;
      if (depth <= 0) { out[cur] = buf.join('\n'); cur = null; } } }
  return out;
}
// what the engine loads: the game's files, a mod file with the same NAME replacing the game's, every other mod file added
function layered(d) {
  const files = {};
  if (existsSync(join(GAME, d))) for (const f of readdirSync(join(GAME, d))) if (f.endsWith('.txt')) files[f] = join(GAME, d, f);
  if (existsSync(join(MOD, d))) for (const f of readdirSync(join(MOD, d))) if (f.endsWith('.txt')) files[f] = join(MOD, d, f);
  const o = {};
  for (const f of Object.keys(files).sort()) Object.assign(o, blocks(rd(files[f])));
  return o;
}
const listOf = (b, k) => { const m = new RegExp('\\b' + k + '\\s*=\\s*\\{([\\s\\S]*?)\\}').exec(b || ''); return m ? (m[1].match(/[A-Za-z_0-9-]+/g) || []) : []; };
const sub = (txt, key) => { const m = new RegExp('\\b' + key + '\\s*=\\s*\\{').exec(txt); if (!m) return '';
  let i = m.index + m[0].length, d = 1; const st = i;
  while (i < txt.length && d > 0) { if (txt[i] === '{') d++; else if (txt[i] === '}') d--; i++; }
  return txt.slice(st, i - 1); };

const BLD = layered('common/buildings'), PMG = layered('common/production_method_groups'), PMB = layered('common/production_methods');
// the GAME's own groups, to trace a minted copy (`pm_x_<rung>` in `pmg_y_<rung>`) back to the vanilla method it copies
const VPMG = {};
for (const f of readdirSync(join(GAME, 'common/production_method_groups'))) if (f.endsWith('.txt')) Object.assign(VPMG, blocks(rd(join(GAME, 'common/production_method_groups', f))));
validateCompat(GAME);
const PREREQ = readTechPrereqs(GAME, MOD);   // the technology tree this mod loads (check 7)

const PMINFO = {};
function pm(k) {
  if (PMINFO[k]) return PMINFO[k];
  const raw = PMB[k];
  const b = noComments(raw || '');
  const bm = sub(b, 'building_modifiers');   // goods and jobs live here; state/country modifiers carry their own *_scaled blocks
  const tot = { in: {}, out: {}, emp: {} };
  for (const m of bm.matchAll(/goods_(input|output)_([a-z_]+)_add\s*=\s*(-?[\d.]+)/g)) { const d = m[1] === 'input' ? 'in' : 'out'; tot[d][m[2]] = (tot[d][m[2]] || 0) + +m[3]; }
  for (const m of bm.matchAll(/building_employment_([a-z_]+)_add\s*=\s*(-?[\d.]+)/g)) tot.emp[m[1]] = (tot.emp[m[1]] || 0) + +m[2];
  return (PMINFO[k] = { key: k, exists: raw != null, tech: listOf(b, 'unlocking_technologies'), gate: listOf(b, 'unlocking_production_methods'), ...tot });
}

let cfg = null;
try { cfg = JSON.parse(rd(CFGP)); } catch (e) { console.error('lint_pm_combos: cannot read the config ' + CFGP + ': ' + e.message); process.exit(2); }
const TIER_BY_PM = {}, TIER_BY_KEY = {};
for (const ind of cfg.industries || []) { if (ind.disabled) continue;
  for (const t of ind.tiers || []) { if (t.pm_key) TIER_BY_PM[t.pm_key] = { ind, t }; if (t.key) TIER_BY_KEY[t.key] = { ind, t }; } }

const fails = { neg: [], dead: [], hist: [], compat: [], mandate: [], craft: [], missing: [], cap: [] };
const unreviewed = new Set();
// a rung's VANILLA main method: its own, or (a minted addition) the vanilla method of the nearest rung below it
const vanillaMain = pmKey => { const r = TIER_BY_PM[pmKey]; if (!r) return null; const { ind, t } = r;
  return t.vanilla_pm || ((ind.tiers || []).filter(x => (x.era ?? 0) <= (t.era ?? 0) && x.vanilla_pm).slice(-1)[0] || {}).vanilla_pm || null; };
let nBld = 0, nCombos = 0, nTier = 0;
const mainOf = new Set(Object.keys(TIER_BY_PM));

for (const [bk, body] of Object.entries(BLD)) {
  const groups = listOf(noComments(body), 'production_method_groups');
  if (!groups.length) continue;
  nBld++;
  const G = [];
  for (const g of groups) {
    if (!PMG[g]) { fails.missing.push(`${bk}: production method group ${g} is not defined`); continue; }
    const ms = listOf(noComments(PMG[g]), 'production_methods');
    for (const p of ms) if (!PMB[p]) fails.missing.push(`${bk}: ${g} lists ${p}, which is not defined`);
    G.push({ g, pms: ms.filter(p => PMB[p]).map(pm) });
  }
  const present = new Set(G.flatMap(x => x.pms.map(p => p.key)));

  // 2. dead methods
  for (const { g, pms } of G) for (const p of pms)
    if (p.gate.length && !p.gate.some(x => present.has(x))) fails.dead.push(`${bk}: ${g} shows ${p.key}, gated on ${p.gate.join(' / ')} — none of which this building has`);

  // 1. every legal combination
  let combos = 1; for (const x of G) combos *= Math.max(1, x.pms.length);
  if (combos > COMBO_CAP) { fails.cap.push(`${bk}: ${combos} combinations — over the cap of ${COMBO_CAP}`); continue; }
  const risky = { in: new Set(), out: new Set(), emp: new Set() };
  for (const { pms } of G) for (const p of pms) for (const d of ['in', 'out', 'emp']) for (const [k, q] of Object.entries(p[d])) if (q < 0) risky[d].add(k);
  if (risky.in.size || risky.out.size || risky.emp.size) {
    const idx = G.map(() => 0); const worst = {};
    for (;;) {
      const chosen = G.map((x, i) => x.pms[idx[i]]).filter(Boolean);
      const keys = new Set(chosen.map(p => p.key));
      if (chosen.every(p => !p.gate.length || p.gate.some(x => keys.has(x)))) {
        nCombos++;
        for (const d of ['in', 'out', 'emp']) for (const k of risky[d]) {
          let s = 0; for (const p of chosen) s += p[d][k] || 0;
          if (s < -TOL) { const kk = d + ':' + k; if (!worst[kk] || s < worst[kk].s) worst[kk] = { s, combo: chosen.map(p => p.key) }; }
        }
      }
      let i = G.length - 1; while (i >= 0) { idx[i]++; if (idx[i] < G[i].pms.length) break; idx[i] = 0; i--; } if (i < 0) break;
    }
    for (const [kk, w] of Object.entries(worst)) {
      const [d, k] = kk.split(':'); const what = d === 'emp' ? `${k} employment` : `${k} ${d === 'in' ? 'input' : 'output'}`;
      fails.neg.push(`${bk}: ${what} reaches ${(+w.s.toFixed(2))} with ${w.combo.join(' + ')}`);
    }
  }

  // 4 + 5. tier buildings only
  const rec = TIER_BY_KEY[bk];
  if (!rec || rec.t.method_of) continue;
  nTier++;
  const mains = G.flatMap(x => x.pms).filter(p => mainOf.has(p.key));
  if (!mains.length) { fails.missing.push(`${bk}: no main method of the book in its groups`); continue; }
  const wm = rec.t.workforce_mult != null ? +rec.t.workforce_mult : 1;
  for (const { g, pms } of G) for (const p of pms) {
    if (mainOf.has(p.key)) continue;
    if (wm < 1 && Object.values(p.emp).some(q => q < 0)) fails.craft.push(`${bk} (craft, workforce_mult ${wm}): ${g} carries ${p.key}, which removes workers`);
    // the vanilla method this member is (or copies): the group's vanilla source, then the longest member name it equals or extends
    const sfx = '_' + bk.replace(/^building_/, '');
    const vg = VPMG[g] ? g : (g.endsWith(sfx) && VPMG[g.slice(0, -sfx.length)] ? g.slice(0, -sfx.length) : null);
    const src = vg ? listOf(noComments(VPMG[vg]), 'production_methods').filter(s => p.key === s || p.key.startsWith(s + '_')).sort((a, b) => b.length - a.length)[0] : null;
    const sec = src || p.key;
    const offMethod = !p.tech.length && !p.gate.length && !Object.keys(p.in).length && !Object.keys(p.out).length && !Object.keys(p.emp).length;
    const beside = p.gate.length ? mains.filter(m => p.gate.includes(m.key)) : mains;
    for (const m of beside) {
      const vm = vanillaMain(m.key);
      const why = notBeside(vm, sec);
      if (why) fails.compat.push(`${bk}: ${p.key} can run beside ${m.key} — ${vm} x ${sec} was reviewed incompatible: ${why}`);
      else if (!offMethod && !reviewed(vm, sec)) unreviewed.add(`${vm} x ${sec} (${bk})`);
    }
  }
  // 6. EVERY GROUP HAS SOMETHING TO RUN BESIDE EVERY MAIN METHOD (2026-10-02, with the mandates: a merged building's mandated group holds only
  //    copies each gated to one main method, so a gap would leave the engine nothing valid to select) — technology aside
  for (const { g, pms } of G) {
    if (pms.some(p => mainOf.has(p.key))) continue;
    for (const m of mains) if (!pms.some(p => !p.gate.length || p.gate.includes(m.key))) fails.mandate.push(`${bk}: ${g} has no method that can run beside ${m.key}`);
  }
  // 7. A MANDATED AUTOMATION (lib_secondary_compat MANDATED) IS THE ONLY CHOICE BESIDE ITS MAIN METHOD, AND COMES WITH IT
  for (const m of mains) {
    const a = mandatedFor(vanillaMain(m.key)); if (!a) continue;
    const hits = G.filter(({ pms }) => pms.some(p => (p.key === a || p.key.startsWith(a + '_')) && (!p.gate.length || p.gate.includes(m.key))));
    if (hits.length !== 1) { fails.mandate.push(`${bk}: ${a} is mandated beside ${m.key} but ${hits.length} group(s) offer it there`); continue; }
    const legal = hits[0].pms.filter(p => !p.gate.length || p.gate.includes(m.key));
    const other = legal.filter(p => !(p.key === a || p.key.startsWith(a + '_')));
    if (other.length) fails.mandate.push(`${bk}: beside ${m.key} the group ${hits[0].g} also offers ${other.map(p => p.key).join(', ')} — ${a} is mandated there`);
    // its technology gate, if any, must be IMPLIED by the main method's: the building's technology and the method's own, with every prerequisite, in
    // the tree this mod loads (2026-10-03: Assembly Lines keep conveyors once conveyors is a prerequisite of compression_ignition, §10.93)
    const seeds = [...listOf(noComments(BLD[bk] || ''), 'unlocking_technologies'), ...m.tech];
    const implied = techClosure(PREREQ, seeds);
    for (const p of legal.filter(p => !other.includes(p))) { const loose = p.tech.filter(x => !implied.has(x));
      if (loose.length) fails.mandate.push(`${bk}: the mandated ${p.key} needs ${loose.join(' ')}, which ${m.key} does not imply (${seeds.join(' + ') || 'no technology'}) — a country could hold the main method and have nothing to run in ${hits[0].g}`); }
  }
}

// 3. the 1836 history names only methods its building has
{
  const dir = join(MOD, 'common/history/buildings');
  const reB = /building\s*=\s*"([A-Za-z_0-9-]+)"((?:(?!create_building)[\s\S]){0,40000}?)activate_production_methods\s*=\s*\{([^}]*)\}/g;
  let nBlocks = 0;
  const methodsOfBld = {};
  const methodsOf = bk => methodsOfBld[bk] ||= new Set(listOf(noComments(BLD[bk] || ''), 'production_method_groups').flatMap(g => listOf(noComments(PMG[g] || ''), 'production_methods')));
  for (const f of (existsSync(dir) ? readdirSync(dir).filter(x => x.endsWith('.txt')) : [])) {
    const t = noComments(rd(join(dir, f))); let m;
    while ((m = reB.exec(t))) {
      nBlocks++;
      const bk = m[1]; if (!BLD[bk]) { fails.hist.push(`${f}: a block builds ${bk}, which is not defined`); continue; }
      const have = methodsOf(bk);
      for (const p of (m[3].match(/[A-Za-z_0-9-]+/g) || [])) if (!have.has(p)) fails.hist.push(`${f}: ${bk} is started with ${p}, which none of its groups lists`);
    }
  }
  fails.histBlocks = nBlocks;
}

const labels = { neg: 'A NUMBER GOES NEGATIVE', dead: 'A DEAD METHOD IS SHOWN', hist: 'A 1836 BLOCK NAMES A METHOD ITS BUILDING LACKS',
  compat: 'A METHOD BESIDE A MAIN METHOD THE REVIEW MARKED IT INCOMPATIBLE WITH', mandate: 'A MANDATED AUTOMATION NOT ALWAYS ON, OR A GROUP WITH NOTHING TO RUN', craft: 'A LABOUR-SAVING METHOD ON A CRAFT RUNG', missing: 'AN UNDEFINED GROUP OR METHOD', cap: 'TOO MANY COMBINATIONS TO CHECK' };
let n = 0;
for (const [k, lbl] of Object.entries(labels)) {
  const list = fails[k]; if (!list.length) continue;
  n += list.length;
  console.log(`FAIL  ${lbl} (${list.length}):`);
  for (const x of list.slice(0, 40)) console.log('   ' + x);
  if (list.length > 40) console.log(`   … and ${list.length - 40} more`);
}
if (unreviewed.size) {
  console.log(`WARN  ${unreviewed.size} carried pair(s) the compatibility review never looked at — add them to REVIEWED (and NOT_BESIDE if incompatible) in tools/lib_secondary_compat.mjs:`);
  for (const x of [...unreviewed].slice(0, 30)) console.log('   ' + x);
}
const tail = `${nBld} buildings, ${nCombos} legal combinations checked for goods and employment, ${nTier} tier buildings checked against the compatibility table and the craft rule, ${fails.histBlocks} history blocks`;
if (n) { console.log(`PM-COMBINATION CHECK FAILED: ${n} case(s). ${tail}.`); process.exit(1); }
console.log(`PM-COMBINATION CHECK PASSED: no legal method combination takes an input, an output or a job below zero; no dead method; no history block names a method its building lacks; no secondary beside a main method the review marked it incompatible with; every mandated automation the only choice beside its main method; no group with nothing to run; no labour-saving method on a craft rung. ${tail}.`);
