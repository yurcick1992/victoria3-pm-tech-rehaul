#!/usr/bin/env node
// COMPANY CHAIN EXTENSION (ROADMAP step 5, user-ruled 2026-08-23: "add all industry tiers to all
// companies that have the industry").
//
// Vanilla company types reference a tiered industry only through its first rung (FINDINGS F77: 21 of
// 48 referenced building keys are ours, every one the chain's first rung, across building_types,
// extension_building_types, every prosperity throughput bonus, every is_building_type formation test
// and every ai_construction_targets entry). The tier split therefore locked companies out of 65.7% of
// the tiered sector and pointed all three of their economic pulls (prosperity throughput, the code-side
// +10%/+30% owned-share bonus, the x2-x3 investment-AI construction multipliers) at exactly the rung
// the mod wants retired (F77.1: 86% of the 38.5%-vs-9.0% company-share gap is this lock-out).
//
// THE TRANSFORM: read the vanilla company_types files LIVE (a patch flows through on rebuild), and for
// every reference to a tiered chain expand it to the WHOLE chain:
//   - building_types / extension_building_types token lists: insert every tier key at the anchor's spot
//   - is_building_type = <anchor> / has_building = <anchor>: wrap in OR = { ... } over the chain
//     (vanilla's own multi-type idiom; nested OR is legal trigger script)
//   - prosperity_modifier building_<anchor>_<suffix> = X: one line per tier, same value - the bonus
//     follows the industry, not the rung, which is exactly what it meant in vanilla where one building
//     WAS the industry
//   - ai_construction_targets <anchor> = { ... }: duplicate the entry per tier (an entry for a
//     still-locked building is inert - the construction system gates on the state owner's tech)
// Only files that actually change are emitted (whole-file replacement by path shadowing, same as the
// production-method files). Tech safety needs nothing here: tier buildings carry unlocking_technologies
// and the engine's own formation gate ("must have the technology to construct at least one of the
// buildings this company specializes in") requires only ONE listed type - so listing the chain keeps
// every company formable from its lowest existing rung while ownership follows the country up the
// ladder. The investor-tech foreign-investment edge is ACCEPTED by the same ruling.
//
// SHIPYARD IS ONE INDUSTRY IN VANILLA AND TWO IN THE CONFIG (clippers + steamers, split by output
// good): a vanilla company naming building_shipyard means "shipbuilding", so it gets BOTH chains -
// otherwise every shipbuilding company dies with the clipper ladder (extinct by design, s10.30).
//
// MODIFIER TYPES ARE HAND-ENUMERATED IN VANILLA, NOT AUTO-GENERATED (proven: United Fruit uses the
// plantation GROUP modifier because building_banana_plantation_throughput_add does not exist). So every
// building_<tierkey>_<suffix> this emitter writes into a prosperity_modifier gets a declared modifier
// type (body copied verbatim from the anchor's vanilla definition) plus loc in all 11 languages
// (the anchor's own vanilla line per language, with the $building_<anchor>$ reference re-pointed at the
// tier key where the language uses one; reused verbatim where it hardcodes the industry name - still
// industry-correct).
//
// Every transform asserts its match count and the emitter THROWS on a no-op or on a mapped key left
// behind in an unhandled context - a silent pass-through here is a company quietly locked to one rung.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const MOD = process.argv[2];
if (!MOD) { console.error('usage: node emit_companies.mjs <modDir> [configPath]'); process.exit(1); }
const CFGPATH = process.argv[3] || join(REPO, 'config', 'mod_config.json');
const CFG = JSON.parse(readFileSync(CFGPATH, 'utf8'));

const BOM = '\uFEFF';
const stripBom = s => s.replace(/^\uFEFF/, '');
const W = (rel, text) => { const p = join(MOD, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, BOM + text, 'utf8'); };

// ---------------------------------------------------------------- chains from the config
const chains = new Map();            // industry id -> ordered tier keys
for (const ind of CFG.industries) {
  if (ind.disabled) continue;
  chains.set(ind.id, ind.tiers.map(t => t.key));
}
// shipyard = clippers + steamers, one vanilla industry
const combinedShipyard = [...(chains.get('shipyard') || []), ...(chains.get('shipyard_steam') || [])];

// expand: any tier key -> the full chain a vanilla reference to it should become
const expand = new Map();
for (const [id, keys] of chains) {
  const target = (id === 'shipyard' || id === 'shipyard_steam') ? combinedShipyard : keys;
  for (const k of keys) expand.set(k, target);
}
// ⭐⭐ A COMPANY TARGETS ITS BEST UNLOCKED RUNG, NOT EVERY RUNG (2026-09-02). Duplicating an
// `ai_construction_targets` entry per tier gave every flavoured company a STANDING target of
// `level = 5` of its rung-0 building beside its targets for the newer rungs — so the AI kept
// rebuilding the obsolete rung in the company's home state for the whole century. Measured on the
// flat-cost four-rung arm at 1936: 38% of the shortlist's rung-0 levels were company-held (textile
// 55%, steel 73%, motor 71%), a third to a half of the standing rung-0 buildings had been
// ESTABLISHED after 1920, and the rung-0 headcount never fell. Each duplicated entry below the top
// rung therefore carries `owner = { NOT = { has_technology_researched = <next rung's tech> } }`
// inside its state_trigger: the target is live only until the country can build the next rung.
// ⚠⚠ OPT-IN ONLY (`company_target_gate: true` in the config), DEFAULT OFF since the first run that
// carried it (ab1, session 20260902_095339, n=1): the shortlist ended with 17 companies against 26 in
// both the vanilla baseline and the equally small 1.92-ladder arm, NET/BEL/PRU with no company at all
// where both references had them, regional HQs 20 against 74 — while the rung-0 headcount it was meant
// to cut ROSE 0.73M→1.17M. The user's own pre-declared criterion ("if companies won't form or expand,
// the cure is worse than the disease") applies; the mechanism is unproven either way at n=1, so the
// gate stays available for a controlled test and ships in nothing by default.
const GATE = CFG.company_target_gate === true;
const nextTech = new Map();          // tier key -> the technology of the rung above it
if (GATE) for (const ind of CFG.industries) {
  if (ind.disabled) continue;
  const tiers = [...ind.tiers].sort((a, b) => (a.era ?? 0) - (b.era ?? 0));
  for (let i = 0; i + 1 < tiers.length; i++) if (tiers[i + 1].tech) nextTech.set(tiers[i].key, tiers[i + 1].tech);
}

// vanilla plural aliases (building_textile_mills etc.) -> real key, defensive: the census found none
// used in company files, but a patch could start using one
const aliasToReal = new Map();
{
  const bdir = join(GAME, 'common/buildings');
  for (const f of readdirSync(bdir)) {
    if (!f.endsWith('.txt')) continue;
    const txt = stripBom(readFileSync(join(bdir, f), 'utf8'));
    const re = /^(building_[a-z_0-9]+)\s*=\s*\{/gm;
    const pos = []; let m;
    while ((m = re.exec(txt))) pos.push([m[1], m.index]);
    for (let i = 0; i < pos.length; i++) {
      const seg = txt.slice(pos[i][1], i + 1 < pos.length ? pos[i + 1][1] : txt.length);
      const am = /aliases\s*=\s*\{([^}]*)\}/.exec(seg);
      if (am) for (const a of am[1].trim().split(/\s+/)) if (a) aliasToReal.set(a, pos[i][0]);
    }
  }
}
const resolveKey = tok => expand.has(tok) ? tok : (aliasToReal.has(tok) && expand.has(aliasToReal.get(tok)) ? aliasToReal.get(tok) : null);

// prosperity lines: building_<base>_<suffix> where <base> is a mapped key. Longest-match so that
// building_power_plant_throughput_add resolves base=building_power_plant, suffix=throughput_add.
const mappedKeysByLen = [...expand.keys()].sort((a, b) => b.length - a.length);
function splitModifierToken(tok) {
  for (const k of mappedKeysByLen)
    if (tok.startsWith(k + '_')) return { base: k, suffix: tok.slice(k.length + 1) };
  return null;
}

// ---------------------------------------------------------------- vanilla modifier type definitions
// name -> full block text, for existence checks and body copying
const vanillaModDefs = new Map();
{
  const mdir = join(GAME, 'common/modifier_type_definitions');
  for (const f of readdirSync(mdir)) {
    if (!f.endsWith('.txt')) continue;
    const txt = stripBom(readFileSync(join(mdir, f), 'utf8'));
    const re = /^([a-z_0-9]+)\s*=\s*\{/gm; let m;
    while ((m = re.exec(txt))) {
      let d = 0, i = txt.indexOf('{', m.index);
      let j = i;
      for (; j < txt.length; j++) { if (txt[j] === '{') d++; else if (txt[j] === '}') { d--; if (d === 0) break; } }
      vanillaModDefs.set(m[1], txt.slice(m.index, j + 1));
    }
  }
}

// ---------------------------------------------------------------- transform the company files
const CDIR = join(GAME, 'common/company_types');
const counts = { listTokens: 0, orWraps: 0, prosperity: 0, aiTargets: 0, files: 0, companies: new Set() };
const neededModTypes = new Map();     // new modifier name -> { base, suffix, tierKey }
const LIST_BLOCKS = new Set(['building_types', 'extension_building_types']);

for (const f of readdirSync(CDIR).sort()) {
  if (!f.endsWith('.txt')) continue;
  const raw = stripBom(readFileSync(join(CDIR, f), 'utf8'));
  const lines = raw.split(/\r?\n/);
  const out = [];
  let changed = false;
  const stack = [];                   // open block names, innermost last
  let curCompany = null;

  const pushPops = code => {          // update stack from one line's braces
    // walk the comment-stripped code, tracking `name = {` openers
    let mm; const openerRe = /([A-Za-z_0-9.:]+)\s*=\s*\{|\{|\}/g;
    while ((mm = openerRe.exec(code))) {
      if (mm[0] === '}') stack.pop();
      else if (mm[0] === '{') stack.push('(anon)');
      else { stack.push(mm[1]); if (stack.length === 1) curCompany = mm[1]; }
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const code = line.split('#')[0];
    const indent = (line.match(/^\s*/) || [''])[0];
    const ctx = stack[stack.length - 1];

    // -- token-list blocks: capture whole block, expand tokens ------------------------------------
    const lb = /^\s*(building_types|extension_building_types)\s*=\s*\{\s*$/.exec(code);
    if (lb) {
      const blockLines = [line];
      let d = 1, j = i;
      while (d > 0) { j++; const c = lines[j].split('#')[0]; d += (c.match(/\{/g) || []).length - (c.match(/\}/g) || []).length; blockLines.push(lines[j]); }
      // STRIP # COMMENTS BEFORE TOKENISING. Vanilla annotates entries in place --
      //   `building_automotive_industry # Produced the Char 2C` -- and joining the raw lines turned
      //   every comment word into a list entry, with the `#` left alone on its own line where it
      //   comments out nothing. The engine then read Produced/the/Char/2C as company types and
      //   logged `Invalid base building type` for each (8 per build; BUGS_AND_FIXES 2026-08-30).
      //   The brace walk above already strips comments; this line did not.
      const tokens = blockLines.slice(1, -1).map(l => l.split('#')[0]).join(' ').split(/\s+/).filter(Boolean);
      for (const t of tokens) if (!/^building_[a-z0-9_]+$/.test(t))
        throw new Error(`emit_companies: token "${t}" in a ${lb[1]} list of ${curCompany} (${f}) is not a building key - a comment or stray token leaked into the list.`);
      const seen = new Set(tokens.map(t => resolveKey(t) || t));
      const outTokens = [];
      let expanded = false;
      for (const t of tokens) {
        const k = resolveKey(t);
        outTokens.push(t);
        if (k) for (const c of expand.get(k)) if (!seen.has(c)) { seen.add(c); outTokens.push(c); expanded = true; counts.listTokens++; }
      }
      out.push(blockLines[0]);
      for (const t of outTokens) out.push(indent + '\t' + t);
      out.push(blockLines[blockLines.length - 1]);
      if (expanded) { changed = true; counts.companies.add(f + ':' + curCompany); }
      i = j;
      continue;
    }

    // -- is_building_type / has_building: OR-wrap over the chain ----------------------------------
    const bt = /^\s*(is_building_type|has_building)\s*=\s*([a-z_0-9]+)\s*$/.exec(code);
    if (bt) {
      const k = resolveKey(bt[2]);
      if (k && expand.get(k).length > 1) {
        out.push(indent + 'OR = {');
        for (const c of expand.get(k)) out.push(indent + '\t' + bt[1] + ' = ' + c);
        out.push(indent + '}');
        changed = true; counts.orWraps++; counts.companies.add(f + ':' + curCompany);
        continue;
      }
    }

    // -- prosperity_modifier: expand building_<base>_<suffix> lines -------------------------------
    if (ctx === 'prosperity_modifier') {
      const pm = /^\s*(building_[a-z_0-9]+)\s*=\s*(-?[0-9.]+)\s*$/.exec(code);
      if (pm) {
        const split = splitModifierToken(pm[1]);
        if (split) {
          for (const c of expand.get(split.base)) {
            out.push(indent + 'building_' + c.replace(/^building_/, '') + '_' + split.suffix + ' = ' + pm[2]);
            const name = c + '_' + split.suffix;
            if (!vanillaModDefs.has(name)) neededModTypes.set(name, { base: split.base, suffix: split.suffix, tierKey: c });
          }
          changed = true; counts.prosperity++; counts.companies.add(f + ':' + curCompany);
          continue;
        }
      }
    }

    // -- ai_construction_targets: duplicate mapped entries per tier -------------------------------
    if (ctx === 'ai_construction_targets') {
      const tg = /^\s*(building_[a-z_0-9]+)\s*=\s*\{\s*$/.exec(code);
      if (tg) {
        const k = resolveKey(tg[1]);
        if (k) {
          const blockLines = [line];
          let d = 1, j = i;
          while (d > 0) { j++; const c = lines[j].split('#')[0]; d += (c.match(/\{/g) || []).length - (c.match(/\}/g) || []).length; blockLines.push(lines[j]); }
          for (const c of expand.get(k)) {
            const body = blockLines.slice(1);
            const nt = nextTech.get(c);
            if (nt) {                                       // below the top rung: live only until the next rung unlocks
              const clause = `owner = { NOT = { has_technology_researched = ${nt} } }`;
              const st = body.findIndex(l => /^\s*state_trigger\s*=\s*\{/.test(l.split('#')[0]));
              if (st >= 0) body.splice(st + 1, 0, body[st].replace(/state_trigger.*$/, '\t' + clause));
              else body.splice(body.length - 1, 0, body[body.length - 1].replace(/\}.*$/, '\tstate_trigger = { ' + clause + ' }'));
              counts.gatedTargets = (counts.gatedTargets || 0) + 1;
            }
            out.push(blockLines[0].replace(tg[1], c));
            for (const l of body) out.push(l);
          }
          changed = true; counts.aiTargets += expand.get(k).length - 1; counts.companies.add(f + ':' + curCompany);
          i = j;
          continue;
        }
      }
    }

    out.push(line);
    pushPops(code);
  }

  // catch-all: no mapped bare key may survive in a context the rules above did not handle
  const emitted = out.join('\n');
  for (let i2 = 0, ls = emitted.split('\n'); i2 < ls.length; i2++) {
    const c = ls[i2].split('#')[0];
    for (const m2 of c.matchAll(/building_[a-z_0-9]+/g)) {
      const tok = m2[0];
      if (!resolveKey(tok)) continue;
      const ok = /^\s*(is_building_type|has_building)\s*=/.test(c) ||          // wrapped or single-tier chains
        /^\s*building_[a-z_0-9]+\s*=\s*\{/.test(c) ||                          // ai_construction_targets entry
        /^\s*building_[a-z_0-9]+\s*$/.test(c);                                 // token list member
      if (!ok) throw new Error(`emit_companies: unhandled reference to ${tok} at ${f}:${i2 + 1}: "${ls[i2].trim()}"`);
    }
  }
  { // brace balance
    const c = emitted.split('\n').map(l => l.split('#')[0]).join('\n');
    const bal = (c.match(/\{/g) || []).length - (c.match(/\}/g) || []).length;
    if (bal !== 0) throw new Error(`emit_companies: brace imbalance (${bal}) in generated ${f}`);
  }
  if (changed) { W(`common/company_types/${f}`, emitted); counts.files++; }
}

if (!counts.files) throw new Error('emit_companies: transformed ZERO company files - the vanilla layout must have changed; fix the transform rather than shipping the lock-out.');
if (!counts.listTokens || !counts.orWraps || !counts.prosperity) throw new Error(`emit_companies: a transform matched nothing (listTokens=${counts.listTokens} orWraps=${counts.orWraps} prosperity=${counts.prosperity}) - fix it rather than shipping a silent no-op.`);

// ---------------------------------------------------------------- modifier type definitions
if (neededModTypes.size) {
  const blocks = [
    '# GENERATED by tools/emit_companies.mjs - modifier types for the tier buildings the company',
    '# prosperity bonuses now name. Vanilla hand-enumerates building_<key>_<suffix> modifier types',
    '# (they are NOT auto-generated per building), so every invented tier key needs its own; the body',
    '# is copied verbatim from the anchor rung\'s vanilla definition.',
    ''
  ];
  for (const [name, info] of [...neededModTypes].sort((a, b) => a[0] < b[0] ? -1 : 1)) {
    const anchorDef = vanillaModDefs.get(info.base + '_' + info.suffix);
    if (!anchorDef) throw new Error(`emit_companies: vanilla has no modifier type ${info.base}_${info.suffix} to copy for ${name}`);
    blocks.push(anchorDef.replace(info.base + '_' + info.suffix, name), '');
  }
  W('common/modifier_type_definitions/zzz_pm_rehaul_company_modifiers.txt', blocks.join('\n'));
}

// ---------------------------------------------------------------- localization
// Per language: the anchor modifier's own vanilla line, key renamed, $building_<anchor>$ re-pointed at
// the tier key where the language uses the reference (Russian et al. hardcode the industry name - the
// anchor line is reused verbatim there, which is still industry-correct wording).
const LANGS = CFG.languages || ['english'];
let locKeys = 0;
for (const lang of LANGS) {
  let van;
  try { van = stripBom(readFileSync(join(GAME, `localization/${lang}/modifiers_l_${lang}.yml`), 'utf8')); }
  catch { van = ''; }
  const lines = [`l_${lang}:`];
  for (const [name, info] of [...neededModTypes].sort((a, b) => a[0] < b[0] ? -1 : 1)) {
    for (const suff of ['', '_desc']) {
      const src = new RegExp(`^\\s*(${info.base}_${info.suffix}${suff}):(\\S*)\\s*(".*")\\s*$`, 'm').exec(van);
      if (!src) continue;
      const text = src[3].replaceAll(`$${info.base}$`, () => `$${info.tierKey}$`);
      lines.push(` ${name}${suff}:${src[2]} ${text}`);
      if (lang === 'english') locKeys++;
    }
  }
  W(`localization/${lang}/replace/zzz_pm_rehaul_companies_l_${lang}.yml`, lines.join('\n') + '\n');
}

console.log(`emit_companies: ${counts.files} company files rewritten, ${counts.companies.size} companies touched; ` +
  `+${counts.listTokens} list tokens, ${counts.orWraps} OR-wrapped triggers, ${counts.prosperity} prosperity lines expanded, ` +
  `+${counts.aiTargets} ai_construction_targets entries (${counts.gatedTargets || 0} gated to the best unlocked rung); ${neededModTypes.size} new modifier types, ${locKeys} en loc keys x ${LANGS.length} languages.`);
