// THE TWO HARD TECH RULES (user-ruled 2026-08-30), checked against the EMITTED MOD, never the config:
//
//   1. NO ORPHANED TECHNOLOGY, EVER. Every technology must gate something REACHABLE — a production
//      method carried by a building the mod actually ships, a building, or a modifier it grants.
//      ⚠ BEING A PREREQUISITE TO SOMETHING DOES NOT COUNT (explicit ruling).
//   2. NO TECHNOLOGY MAY GATE TWO RUNGS OF ONE INDUSTRY. Two rungs on one gate unlock together, so
//      the later rung is free and that step of the ladder has no research cost at all.
//
// Why an ARTIFACT check and not a generator check: the generator can only see what it intends. A PM
// can stop being reachable because a BUILDING changed, a PMG changed, or a whole industry was handed
// back to vanilla — none of which the tech tool sees. Same principle as verify_pms.mjs and preflight.
//
// Usage: node tools/lint_tech_content.mjs [modDir] [configPath]   — exits non-zero on any breach.
import {readFileSync, readdirSync, existsSync} from 'fs';
import {readVanilla, blocks} from './lib_vanilla_ladder.mjs';

const MOD  = process.argv[2] || 'mod';
const CFGP = process.argv[3] || 'config/mod_config.json';
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const rd = p => readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const files = d => existsSync(d) ? readdirSync(d).filter(f => f.endsWith('.txt')) : [];
const V = readVanilla(GAME);

// ---- PM -> gates, over vanilla AND our own emitted methods -----------------------------------
const PMTECH = {};
for (const dir of [`${GAME}/common/production_methods`, `${MOD}/common/production_methods`])
  for (const f of files(dir)) { const b = blocks(rd(`${dir}/${f}`));
    for (const [k, body] of Object.entries(b)) {
      const m = /unlocking_technologies\s*=\s*\{([\s\S]*?)\}/.exec(body);
      PMTECH[k] = m ? (m[1].match(/[a-z_0-9-]+/g) || []) : []; } }
// ---- PMG -> PMs, mod files shadowing vanilla by FILENAME --------------------------------------
const PMG = {};
for (const dir of [`${GAME}/common/production_method_groups`, `${MOD}/common/production_method_groups`])
  for (const f of files(dir)) { const b = blocks(rd(`${dir}/${f}`));
    for (const [k, body] of Object.entries(b)) {
      const m = /production_methods\s*=\s*\{([\s\S]*?)\}/.exec(body);
      PMG[k] = m ? (m[1].match(/[a-z_0-9-]+/g) || []) : []; } }
// ---- SHIPPED buildings: vanilla, with a mod file of the same name REPLACING that file's set ----
const BLD = {};
for (const f of files(`${GAME}/common/buildings`)) { const b = blocks(rd(`${GAME}/common/buildings/${f}`));
  for (const [k, body] of Object.entries(b)) BLD[k] = { body, from: 'vanilla:' + f }; }
for (const f of files(`${MOD}/common/buildings`)) {
  for (const [k, v] of Object.entries(BLD)) if (v.from === 'vanilla:' + f) delete BLD[k];
  const b = blocks(rd(`${MOD}/common/buildings/${f}`));
  for (const [k, body] of Object.entries(b)) BLD[k] = { body, from: 'mod:' + f }; }

const reachPMG = new Set(), reachPM = new Set(), reachBLD = new Set(Object.keys(BLD));
for (const v of Object.values(BLD)) { const m = /production_method_groups\s*=\s*\{([\s\S]*?)\}/.exec(v.body);
  if (m) for (const g of (m[1].match(/[a-z_0-9-]+/g) || [])) reachPMG.add(g); }
for (const g of reachPMG) for (const pm of (PMG[g] || [])) reachPM.add(pm);

// ---- every technology the mod SHIPS (vanilla tree + ours) -------------------------------------
const TECHS = {};
for (const dir of [`${GAME}/common/technology/technologies`, `${MOD}/common/technology/technologies`])
  for (const f of files(dir)) { const b = blocks(rd(`${dir}/${f}`));
    for (const [k, body] of Object.entries(b)) TECHS[k] = body; }

const cfg = JSON.parse(rd(CFGP));
const tierTech = {}, perIndustry = {};
for (const i of cfg.industries) { if (i.disabled) continue;
  for (const t of i.tiers || []) if (t.tech) {
    tierTech[t.tech] = true;
    (perIndustry[i.id] = perIndustry[i.id] || {})[t.tech] = ((perIndustry[i.id] || {})[t.tech] || []).concat(`e${t.era}`); } }

// every vanilla script line that names a technology, EXCLUDING the technology files themselves (so a
// prerequisite reference can never make a technology look useful) — built once, walked recursively.
const NAMED = (() => {
  const hay = [];
  const walk = d => { let ents = []; try { ents = readdirSync(d, {withFileTypes:true}); } catch { return; }
    for (const e of ents) { const p = `${d}/${e.name}`;
      if (e.isDirectory()) { if (!/technology/.test(p)) walk(p); }
      else if (e.name.endsWith('.txt')) { try { hay.push(rd(p)); } catch {} } } };
  walk(`${GAME}/common`); walk(`${GAME}/events`);
  return hay.join(String.fromCharCode(10));
})();
const namedElsewhere = t => new RegExp('(^|[^a-z_0-9])' + t + '([^a-z_0-9]|$)').test(NAMED);

// ---- RULE 1: orphans -------------------------------------------------------------------------
const orphans = [];
for (const [tech, body] of Object.entries(TECHS)) {
  if (tierTech[tech]) continue;                                   // gates one of our rungs
  if (/modifier\s*=\s*\{/.test(body)) continue;                   // carries a modifier
  const pms = Object.keys(PMTECH).filter(p => PMTECH[p].includes(tech));
  if (pms.some(p => reachPM.has(p))) continue;                    // gates a reachable method
  const gatesBuilding = Object.entries(BLD).some(([k, v]) =>
    new RegExp('unlocking_technologies\s*=\s*\{[^}]*\b' + tech + '\b').test(v.body));
  if (gatesBuilding) continue;
  // ANY other vanilla content counts: laws, institutions, decrees, companies, combat units, journal
  // entries, events, scripted effects. ⚠ EXCEPT a mention inside another TECHNOLOGY's own
  // unlocking_technologies — being a PREREQUISITE is explicitly NOT content (user ruling 2026-08-30).
  if (namedElsewhere(tech)) continue;
  orphans.push(tech);
}
// ---- RULE 2: one technology, one rung per industry --------------------------------------------
const dups = [];
for (const [ind, m] of Object.entries(perIndustry))
  for (const [tech, eras] of Object.entries(m)) if (eras.length > 1) dups.push(`${ind}: ${tech} gates ${eras.join(' + ')}`);

let bad = 0;
if (orphans.length) { bad++; console.log(`ORPHANED TECHNOLOGIES (${orphans.length}) — gate nothing reachable in the shipped mod:`);
  for (const o of orphans) console.log('   ' + o); }
if (dups.length) { bad++; console.log(`ONE TECHNOLOGY GATING TWO RUNGS OF ONE INDUSTRY (${dups.length}):`);
  for (const d of dups) console.log('   ' + d); }
if (bad) { console.log('\nTECH CONTENT CHECK FAILED — see CLAUDE.md "no orphaned tech ever" and the two hard rules.'); process.exit(1); }
console.log(`TECH CONTENT CHECK PASSED: ${Object.keys(TECHS).length} technologies, none orphaned, none gating two rungs of one industry.`);
