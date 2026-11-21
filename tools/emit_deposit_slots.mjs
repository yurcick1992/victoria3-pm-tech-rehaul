// THE DEPOSIT SLOTS AND HOOKS — the mod 1.2 book's tiered deposits on the map (BALANCE_FRAMEWORK §10.115, §10.124 items 2 and 7).
//
//   node tools/emit_deposit_slots.mjs <mod dir> <config>        (build.ps1 runs it after convert_history.ps1)
//
// Reads the book's `_deposits` record (make_deposit_config.mjs) and VANILLA's map, and writes:
//   1. map_data/state_regions/*.txt — every file that holds a deposit's slots, copied verbatim but for the deposit entries: a capped entry
//      `building_X = N` becomes one entry per rung, each ceil(N × slot_mult ÷ rungs) (two methods × 1.5, three or four × 2, an uneven total
//      rounded UP to a multiple of the rung count, at least one a rung); gold's rung never under its 1836 levels in the region (every other
//      deposit's 1836 levels must fit one rung's share, §10.115's reading of the map — checked, the build stops if not).
//      A DISCOVERABLE deposit (oil, `discover: linked_second_rung`): the first rung's block keeps vanilla's shape at its rung share; the second
//      rung has NO block — its slots come from the hook below when the first is found (§10.124 item 2: no second forced discovery, which
//      would fire the hook again and vanilla's oil-rush events with it, F277).
//   2. common/on_actions/zzz_pm_rehaul_deposits.txt — the two resource hooks, applied once per state REGION through a region variable (the
//      hooks fire once per STATE of the region, F277), with each region's numbers written in (from the map):
//      - on_resource_depleted: a region's gold fields deplete into vanilla's building_gold_mine (the first rung, its whole potential, F277);
//        the hook moves it to the tiered share — the first rung ceil(G × 2 ÷ 4) − G, every other rung + ceil(G × 2 ÷ 4).
//      - on_resource_discovered: in a region with an oil block, the second oil rung gets the first rung's share. ⚠ The hook does not say WHICH
//        resource was found (the game's script docs list root = state and nothing else); the guard is vanilla's own oil-rush trigger (an oil
//        potential, `remaining_undepleted` of oil above 0). A gold or rubber find in a region that also holds undiscovered oil may therefore
//        open the second oil rung's slots before the oil itself is found (combustion engine is still needed to build it).
// Prints every region it changed and every floor that bound.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const MOD = process.argv[2] || 'mod';
const CFGP = process.argv[3] || 'config/mod_config.json';
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const rd = p => readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const BOM = '\uFEFF';
const cfg = JSON.parse(rd(CFGP));
const D = cfg._deposits;
if (!D) { console.log('emit_deposit_slots: the book carries no _deposits record — nothing to emit'); process.exit(0); }
const IND = cfg.industries.filter(i => i.deposit && !i.disabled);
const byKey = {};   // vanilla key -> { ind, rungs: [keys], mult }
for (const ind of IND) { const R = D.industries[ind.id]; if (!R) throw new Error(`emit_deposit_slots: ${ind.id} has no _deposits record`);
  byKey[ind.tiers[0].key] = { ind, rungs: ind.tiers.slice().sort((a, b) => a.era - b.era).map(t => t.key), mult: +R.slot_mult, floor: !!R.floor_1836, discover: R.discover }; }
const share = (N, x) => Math.max(1, Math.ceil(N * x.mult / x.rungs.length - 1e-9));

// ---- 1836 levels by region and rung, from the CONVERTED history this build wrote (convert_history.ps1 runs first) -------------------------
const HIST = join(MOD, 'common/history/buildings');
if (!existsSync(HIST)) throw new Error(`emit_deposit_slots: no converted history in ${HIST} — run after convert_history.ps1`);
const RUNG_OF = {}; for (const x of Object.values(byKey)) for (const k of x.rungs) RUNG_OF[k] = x;
const LV = {};   // region -> rung key -> levels
for (const f of readdirSync(HIST)) {
  const t = rd(join(HIST, f));
  for (const sm of t.matchAll(/s:(STATE_[A-Z0-9_]+)\s*=\s*\{/g)) {
    // the state's block: from its opening brace to the matching close
    let i = sm.index + sm[0].length, d = 1; const st = i; while (i < t.length && d > 0) { if (t[i] === '{') d++; else if (t[i] === '}') d--; i++; }
    const body = t.slice(st, i - 1);
    for (const cb of body.matchAll(/create_building\s*=\s*\{/g)) {
      let j = cb.index + cb[0].length, e = 1; const s2 = j; while (j < body.length && e > 0) { if (body[j] === '{') e++; else if (body[j] === '}') e--; j++; }
      const b = body.slice(s2, j - 1); const key = (b.match(/building\s*=\s*"([a-z_0-9]+)"/) || [])[1];
      if (!key || !RUNG_OF[key]) continue;
      let lv = 0; for (const m of b.matchAll(/levels\s*=\s*(\d+)/g)) lv += +m[1];
      ((LV[sm[1]] ||= {})[key] = (LV[sm[1]][key] || 0) + (lv || 1));
    }
  }
}

// ---- the map ----------------------------------------------------------------------------------------------------------------------------
const OUT = join(MOD, 'map_data/state_regions'); mkdirSync(OUT, { recursive: true });
const SR = join(GAME, 'map_data/state_regions');
const goldRegions = [], oilRegions = [], floors = [], over = [];
let filesWritten = 0, entries = 0;
for (const f of readdirSync(SR).filter(f => f.endsWith('.txt'))) {
  const orig = rd(join(SR, f));
  let changed = false;
  const txt = orig.replace(/^(STATE_[A-Z0-9_]+)\s*=\s*\{[\s\S]*?\n\}/gm, block => {
    const region = block.match(/^(STATE_[A-Z0-9_]+)/)[1];
    let nb = block;
    // capped entries
    nb = nb.replace(/(capped_resources\s*=\s*\{)([\s\S]*?)(\n[ \t]*\})/, (m0, open, inner, close) => {
      const lines = inner.split('\n'); const outL = [];
      for (const line of lines) {
        const m = line.match(/^(\s*)(building_[a-z_]+)\s*=\s*(\d+)\s*$/);
        if (!m || !byKey[m[2]]) { outL.push(line); continue; }
        const x = byKey[m[2]], N = +m[3], per = share(N, x);
        x.rungs.forEach(k => {
          let s = per; const had = (LV[region] || {})[k] || 0;
          if (had > s) { if (x.floor) { floors.push(`${region} ${k}: ${s} → ${had} (its 1836 levels)`); s = had; } else over.push(`${region} ${k}: 1836 levels ${had} over the rung's share ${s} (vanilla ${N})`); }
          outL.push(`${m[1]}${k} = ${s}`); entries++;
        });
        changed = true;
      }
      return open + outL.join('\n') + close;
    });
    // discoverable deposits (oil): the first rung's block at its rung share; the second rung's slots come from the discovery hook
    nb = nb.replace(/resource\s*=\s*\{([^{}]*)\}/g, (m0, inner) => {
      const ty = (inner.match(/type\s*=\s*"([a-z_]+)"/) || [])[1]; const x = ty && byKey[ty];
      if (ty === 'building_gold_field') { const und = +((inner.match(/undiscovered_amount\s*=\s*(\d+)/) || [])[1] || 0), dis = +((inner.match(/(?:^|\s)discovered_amount\s*=\s*(\d+)/) || [])[1] || 0);
        if (/depleted_type\s*=\s*"building_gold_mine"/.test(inner) && byKey.building_gold_mine) goldRegions.push({ region, G: und + dis }); return m0; }
      if (!x) return m0;
      if (x.discover !== 'linked_second_rung') throw new Error(`emit_deposit_slots: ${region} has a discoverable ${ty} block, and ${x.ind.id} is not ruled as discoverable`);
      const und = +((inner.match(/undiscovered_amount\s*=\s*(\d+)/) || [])[1] || 0), dis = +((inner.match(/(?:^|\s)discovered_amount\s*=\s*(\d+)/) || [])[1] || 0);
      if (dis) throw new Error(`emit_deposit_slots: ${region}'s ${ty} block is partly discovered at start — not designed`);
      const per = share(und, x); oilRegions.push({ region, per, second: x.rungs.slice(1) }); changed = true; entries++;
      return m0.replace(/undiscovered_amount\s*=\s*\d+/, `undiscovered_amount = ${per}`);
    });
    return nb;
  });
  if (!changed) continue;
  writeFileSync(join(OUT, f), BOM + txt.replace(/\r?\n/g, '\r\n'));
  filesWritten++;
}
if (over.length) throw new Error(`emit_deposit_slots: the 1836 map does not fit the rung shares (§10.115 read it as fitting; a floor is ruled for gold only):\n  ${over.join('\n  ')}`);

// ---- the hooks ----------------------------------------------------------------------------------------------------------------------------
const gold = byKey.building_gold_mine;
const H = ['# AUTO-GENERATED by tools/emit_deposit_slots.mjs from the book\'s _deposits record (BALANCE_FRAMEWORK §10.115, §10.124 item 2) - do not edit.',
  'on_resource_depleted = { on_actions = { pmr_deposits_on_depleted } }', 'on_resource_discovered = { on_actions = { pmr_deposits_on_discovered } }', '',
  '# gold fields deplete into building_gold_mine (the first rung, the whole potential); spread it over the rungs, once per region',
  'pmr_deposits_on_depleted = {', '\teffect = {'];
if (gold) for (const { region, G } of goldRegions) {
  const per = share(G, gold);
  H.push(`\t\tif = { limit = { state_region = s:${region} }`, '\t\t\tstate_region = {', '\t\t\t\tif = { limit = { NOT = { has_variable = pmr_gold_spread } }', '\t\t\t\t\tset_variable = pmr_gold_spread');
  if (per - G) H.push(`\t\t\t\t\tchange_resource_potential = { type = ${gold.rungs[0]} amount = ${per - G} }`);
  for (const k of gold.rungs.slice(1)) H.push(`\t\t\t\t\tchange_resource_potential = { type = ${k} amount = ${per} }`);
  H.push('\t\t\t\t}', '\t\t\t}', '\t\t}');
}
H.push('\t}', '}', '', '# a discovery in a region with an oil block opens the second oil rung\'s share, once per region (no second forced discovery: F277)',
  'pmr_deposits_on_discovered = {', '\teffect = {');
for (const { region, per, second } of oilRegions) {
  H.push(`\t\tif = { limit = { state_region = s:${region} has_potential_resource = building_oil_rig }`, '\t\t\tstate_region = {',
    '\t\t\t\tif = { limit = { NOT = { has_variable = pmr_oil_linked } remaining_undepleted = { type = building_oil_rig amount > 0 } }', '\t\t\t\t\tset_variable = pmr_oil_linked');
  for (const k of second) H.push(`\t\t\t\t\tchange_resource_potential = { type = ${k} amount = ${per} }`);
  H.push('\t\t\t\t}', '\t\t\t}', '\t\t}');
}
H.push('\t}', '}', '');
mkdirSync(join(MOD, 'common/on_actions'), { recursive: true });
writeFileSync(join(MOD, 'common/on_actions/zzz_pm_rehaul_deposits.txt'), BOM + H.join('\r\n'));

// ---- 3. no dead method: a rung's secondary group that lists a method gated on main methods the rung does not run (the logging camp's
//   Increased Hardwood, gated on the saw-mill methods, on the Simple Forestry rung) gets a copy of the group without it (lint_pm_combos
//   fails a building that SHOWS such a method — the game shows it greyed, at its own numbers). Read from this build's owned files.
const ownedOr = (dir, f) => existsSync(join(MOD, 'common', dir, f)) ? join(MOD, 'common', dir, f) : join(GAME, 'common', dir, f);
const defs = dir => { const o = {}; const files = new Set([...readdirSync(join(GAME, 'common', dir)), ...(existsSync(join(MOD, 'common', dir)) ? readdirSync(join(MOD, 'common', dir)) : [])].filter(f => f.endsWith('.txt')));
  for (const f of files) { const t = rd(ownedOr(dir, f)).replace(/#.*$/mg, ''); for (const m of t.matchAll(/^([A-Za-z_][A-Za-z0-9_-]*)\s*=\s*\{/gm)) { let i = m.index + m[0].length, d = 1; while (i < t.length && d > 0) { if (t[i] === '{') d++; else if (t[i] === '}') d--; i++; } o[m[1]] = t.slice(m.index, i); } }
  return o; };
const PMD = defs('production_methods'), PMGD = defs('production_method_groups');
const listIn = (b, k) => { const m = new RegExp(k + '\\s*=\\s*\\{([^}]*)\\}').exec(b || ''); return m ? m[1].trim().split(/\s+/).filter(Boolean) : []; };
const copies = [], copyLoc = [], dropped = [];
const bfiles = [...new Set(IND.map(i => i.source_file))];
for (const rel of bfiles) {
  const p = join(MOD, rel); if (!existsSync(p)) throw new Error(`emit_deposit_slots: ${rel} was not emitted`);
  let text = rd(p), changed = false;
  for (const ind of IND.filter(i => i.source_file === rel)) for (const t of ind.tiers) {
    const m = new RegExp('^' + t.key + '\\s*=\\s*\\{', 'm').exec(text); if (!m) throw new Error(`emit_deposit_slots: ${t.key} not in ${rel}`);
    let i = m.index + m[0].length, d = 1; while (i < text.length && d > 0) { if (text[i] === '{') d++; else if (text[i] === '}') d--; i++; }
    const blk = text.slice(m.index, i);
    const groups = listIn(blk, 'production_method_groups'); let nb = blk;
    for (const g of groups) {
      if (/^pmg_main_/.test(g)) continue;
      const members = listIn(PMGD[g], 'production_methods');
      const keep = members.filter(pm => { const gate = listIn(PMD[pm], 'unlocking_production_methods'); return !gate.length || gate.includes(t.pm_key); });
      if (keep.length === members.length) continue;
      const ng = `${g}_${t.key.replace(/^building_/, '')}`;
      const tex = /texture\s*=\s*"[^"]*"/.exec(PMGD[g]);
      copies.push(`${ng} = {\n\t${tex ? tex[0] : ''}\n\tproduction_methods = {\n${keep.map(x => '\t\t' + x).join('\n')}\n\t}\n}`);
      copyLoc.push([ng, g]); dropped.push(`${t.key}: ${members.filter(x => !keep.includes(x)).join(', ')} (from ${g})`);
      nb = nb.replace(new RegExp('(production_method_groups\\s*=\\s*\\{[^}]*?)\\b' + g + '\\b'), `$1${ng}`);
    }
    if (nb !== blk) { text = text.slice(0, m.index) + nb + text.slice(i); changed = true; }
  }
  if (changed) writeFileSync(p, BOM + text);
}
if (copies.length) {
  writeFileSync(join(MOD, 'common/production_method_groups/zzz_pm_rehaul_deposit_groups.txt'), BOM + '# AUTO-GENERATED by tools/emit_deposit_slots.mjs - a deposit rung\'s copy of a group without the methods gated on main methods it does not run.\r\n' + copies.join('\r\n') + '\r\n');
  for (const lang of cfg.languages || ['english']) { const dir = join(MOD, 'localization', lang, 'replace'); mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `zzz_pm_rehaul_deposit_groups_l_${lang}.yml`), BOM + `l_${lang}:\n` + copyLoc.map(([k, v]) => ` ${k}:0 "$${v}$"`).join('\n') + '\n'); }
}
for (const l of dropped) console.log('  dead method left off: ' + l);
console.log(`emit_deposit_slots: ${entries} deposit entries rewritten in ${filesWritten} state-region file(s); hooks for ${goldRegions.length} gold-field region(s) and ${oilRegions.length} oil region(s)`);
for (const l of floors) console.log('  gold floor: ' + l);
