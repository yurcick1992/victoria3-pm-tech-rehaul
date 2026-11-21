// THE TIERED DEPOSITS — the mod 1.2 book's extraction overhaul (BALANCE_FRAMEWORK §10.115, ruled 2026-11-16; §10.116 ruling 5 and §10.124,
// ruled 2026-11-17 and 2026-11-21; the cost step and the names, references and research of the deposit rungs ruled 2026-11-21, §10.125).
//
//   node tools/make_deposit_config.mjs --base config/mod_config.<book>.json --suffix <name> --cost-step 1.3 [--start-1836 map|pair]
//
// Each main method of a resource-capped building (lib_tier4_spec DEPOSITS: the five mines, gold, fishing, whaling, oil; logging left the
// list on 2026-11-21, §10.126) becomes a
// building of its own — a RUNG — added to the book as an industry with `deposit: true`, so the emitters that already carry the factory rungs
// carry these too: the building (cloned from vanilla's block: terrain, potential and vanilla's AI desire kept), its main method, the 1836
// conversion (convert_history.ps1, by the active method), companies, vanilla's references (every rung, ruled), research entries (the standard
// rung entries, ruled). The rules, all §10.115's unless named:
//   - SLOTS (emitted by tools/emit_deposit_slots.mjs from the map at build time): two methods → vanilla's slots × 1.5, three or four → × 2,
//     split equally, an uneven total rounded UP to a multiple of the rung count, at least one slot a rung; gold's rung never under its 1836
//     levels. Only the rule is recorded here (`_deposits`), never a per-region number.
//   - OUTPUT is flat: the rungs on the 1836 map (`map_rungs`, the first two methods; oil its first) keep vanilla's output, every later rung
//     takes the output of the highest 1836-map rung (all of its outputs: whaling makes oil and meat).
//   - INPUTS give equal value added at base prices: a later rung's input value is the highest 1836-map rung's, spread over the rung's OWN
//     vanilla mix; then (§10.116 ruling 5) on a mine's condensing and diesel pump rungs the tools above 5 become engines, value for value.
//   - STAFFING: 5,000 workers a level, the rung's own vanilla professions (§10.124 item 6).
//   - COST: the 1836-map rungs at vanilla's cost, each rung above × the cost step (`--cost-step`, ruled 1.3 for the 1.2 book, §10.125);
//     a DEPOSITS entry's `cost` list overrides (oil 200 / 200, §10.124 item 7).
//   - AI DESIRE: vanilla's own building block, the same on every rung (gold keeps vanilla's 5000; §10.124 item 9). Nothing is set here: the
//     clone carries vanilla's block.
//   - TIER: derived from the method's technology by the era rule (lib_tier4_spec derivePlacement), as for a factory rung; the in-game name
//     says "Tier N." (ruled 2026-11-21, §10.125). A deposit rung is NOT on the A/B ladder (make_ab_config.mjs skips it; lint_tier_eras.mjs
//     checks it against this record, flat output and equal value added).
//   - SECONDARY LINES: a line that adds or converts output is × vanilla's slots ÷ the tiered slots (½ for three or four rungs, ⅔ for two),
//     the same recipe on every rung (vanilla's own method overridden through `pm_goods` / `pm_employment`, because every rung lists vanilla's
//     group); a line that only saves labour is unchanged.
//   - REFERENCES: research_events.necessity_anchors naming a deposit's vanilla key reaches every rung of it (ruled 2026-11-21, §10.125).
//   - THE 1836 START (`--start-1836`, recorded as `_deposits.start_1836`; emitted by tools/emit_deposit_start.mjs on the converted history):
//     'map' (the default, m12-first) leaves vanilla's map as converted, each building on the rung its method belongs to; 'pair' (ruled for
//     the 1.2 book 2026-11-21, §10.126) puts a first-rung twin beside every second-rung building, both at k = N × V1 ÷ (V0 + V1) levels,
//     so the country's 1836 supply stays vanilla's with no recipe moved.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blocks } from './lib_vanilla_ladder.mjs';
import { DEPOSITS, ERA_YEARS, bldName, eraOfGameEra, derivePlacement, placementFaults } from './lib_tier4_spec.mjs';
import { wageUnits, eraReferenceWage } from './lib_wage_model.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const BASE = arg('--base'), SFX = arg('--suffix'), STEP = +arg('--cost-step', 'NaN'), START = arg('--start-1836', 'map');
if (!BASE || !SFX || !(STEP >= 1)) throw new Error('usage: node tools/make_deposit_config.mjs --base config/mod_config.<book>.json --suffix <name> --cost-step <s ≥ 1> [--start-1836 map|pair]');
if (!['map', 'pair'].includes(START)) throw new Error(`--start-1836 ${START}: map or pair`);
const rd = p => readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const WORKERS = 5000;
const ENGINE_TOOLS_KEEP = 5;   // §10.116 ruling 5: the tools above the picks rung's 5 become engines

// ---- the game ---------------------------------------------------------------------------------------------------
// comments stripped first: vanilla annotates inside blocks (copper mine's group list carries one), and a `#` read as a token breaks the lists
const load = d => { const o = {}, f = {}; for (const n of readdirSync(join(GAME, d))) if (n.endsWith('.txt')) for (const [k, b] of Object.entries(blocks(rd(join(GAME, d, n)).replace(/#.*$/mg, '')))) { o[k] = b; f[k] = n; } return [o, f]; };
const [BLD, BLDFILE] = load('common/buildings'), [PMG] = load('common/production_method_groups'), [PM] = load('common/production_methods'), [TECH] = load('common/technology/technologies');
const list = (b, k) => { const m = (b || '').match(new RegExp('(^|\\s)' + k + '\\s*=\\s*\\{([^}]*)\\}')); return m ? m[2].trim().split(/\s+/).filter(Boolean) : []; };
const scalar = (b, k) => { const m = (b || '').match(new RegExp('^\\s*' + k + '\\s*=\\s*"?([^"\\r\\n#]+?)"?\\s*(#.*)?$', 'm')); return m ? m[1].trim() : null; };
const goodsOf = b => ({ in: Object.fromEntries([...b.matchAll(/goods_input_([a-z_]+)_add\s*=\s*(-?[0-9.]+)/g)].map(m => [m[1], +m[2]])),
                        out: Object.fromEntries([...b.matchAll(/goods_output_([a-z_]+)_add\s*=\s*(-?[0-9.]+)/g)].map(m => [m[1], +m[2]])) });
const employmentOf = b => Object.fromEntries([...b.matchAll(/building_employment_([a-z_]+)_add\s*=\s*(-?[0-9]+)/g)].map(m => [m[1], +m[2]]));
const pollutionOf = b => { const m = b.match(/state_pollution_generation_add\s*=\s*([0-9.]+)/); return m ? +m[1] : 0; };
const techEra = t => { const m = (TECH[t] || '').match(/era\s*=\s*era_(\d)/); if (!m) throw new Error(`technology ${t}: no era`); return +m[1]; };
const ENLOC = (() => { const loc = {}; const walk = d => { for (const f of readdirSync(d, { withFileTypes: true })) { const p = join(d, f.name); if (f.isDirectory()) walk(p); else if (f.name.endsWith('_l_english.yml')) for (const line of rd(p).split(/\r?\n/)) { const m = line.match(/^\s*([A-Za-z_0-9\-.]+):\d*\s*"(.*?)"\s*(?:#.*)?$/); if (m && !(m[1] in loc)) loc[m[1]] = m[2]; } } }; walk(join(GAME, 'localization/english')); return loc; })();
const name = k => { const s = ENLOC[k]; if (!s) throw new Error(`no English name for ${k}`); return s; };
const PRICE = {}; for (const l of rd(join(REPO, 'tools/goods_prices.tsv')).split(/\r?\n/)) { const m = l.trim().split(/\t|\s+/); if (m.length >= 2 && +m[1] > 0) PRICE[m[0]] = +m[1]; }
const val = o => Object.entries(o || {}).reduce((s, [g, q]) => s + q * (PRICE[g] ?? NaN), 0);
const ANCH = { construction_cost_low: 200, construction_cost_medium: 400, construction_cost_high: 600, construction_cost_very_high: 800 };
const r1 = x => Math.round(x * 10) / 10;

// every vanilla building that can run a method (through any of its groups)
const PM_USERS = {};
for (const [bk, b] of Object.entries(BLD)) for (const g of list(b, 'production_method_groups')) for (const pm of list(PMG[g] || '', 'production_methods')) (PM_USERS[pm] ||= []).includes(bk) || PM_USERS[pm].push(bk);
const cfg = JSON.parse(rd(join(REPO, BASE)));
if (cfg.industries.some(i => i.deposit)) throw new Error(`${BASE} already carries deposit industries — run on a book without them`);
const eraWage = eraReferenceWage(cfg.era_anchor_years);
const report = [], record = { rule: 'BALANCE_FRAMEWORK §10.115 (slots, flat output, equal value added, cost), §10.116 ruling 5 (engines on the pump rungs), §10.124 (5,000 workers, oil 200/200, vanilla AI desire), §10.125 (cost step, names, references, research), §10.126 (logging not a deposit; the 1836 pair under start_1836 = pair)',
  cost_step: STEP, workers_per_level: WORKERS, start_1836: START, slot_rule: { two: 1.5, three_or_four: 2, round: 'up to a multiple of the rung count, at least one a rung', floor_1836: 'gold' },
  secondary_rule: 'output-adding lines × vanilla slots ÷ tiered slots on every rung; labour-saving lines unchanged', industries: {} };
const pmGoods = cfg.pm_goods || {}, pmEmp = cfg.pm_employment || {};
const lineNotes = [];

for (const D of DEPOSITS) {
  const bb = BLD[D.building]; if (!bb) throw new Error(`${D.id}: vanilla building ${D.building} not found`);
  const pmgs = list(bb, 'production_method_groups'); const [base, ...secondaries] = pmgs;
  const methods = list(PMG[base], 'production_methods'); if (!methods.length) throw new Error(`${D.id}: ${base} has no methods`);
  const n = methods.length;
  if (n < 2 || n > 4) throw new Error(`${D.id}: ${n} main methods — the slot rule covers two to four`);
  const slotMult = n === 2 ? 1.5 : 2;
  const bldGate = list(bb, 'unlocking_technologies')[0] || null;
  const gateOf = pm => list(PM[pm] || '', 'unlocking_technologies')[0] || bldGate;
  const gameEras = methods.map(pm => { const g = gateOf(pm); return g ? techEra(g) : 1; });
  const { eras, overflow } = derivePlacement(gameEras);
  if (overflow) throw new Error(`${D.id}: the era rule cannot place ${methods.join(', ')} (game eras ${gameEras.join('/')})`);
  const faults = placementFaults(D.id, eras, gameEras); if (faults.length) throw new Error(faults.join('\n'));
  const vb = name(D.building);
  const anchorCost = ANCH[scalar(bb, 'required_construction')]; if (!anchorCost) throw new Error(`${D.id}: no construction class`);
  const recs = methods.map(pm => { const b = PM[pm]; if (!b) throw new Error(`${D.id}: method ${pm} not found`); return { pm, ...goodsOf(b), emp: employmentOf(b), pol: pollutionOf(b), tex: scalar(b, 'texture') }; });
  // the deposit's goods: everything rung 0 makes; the main good is the one it makes most of (whaling: oil 10 beside meat 5)
  const outGoods = Object.keys(recs[0].out); const mainGood = Object.entries(recs[0].out).sort((a, b) => b[1] - a[1])[0][0];
  const top = recs[D.map_rungs - 1];   // the highest rung on the 1836 map
  const topIn = val(top.in);
  const slug = pm => pm.replace(/^pm_/, '').replace(new RegExp('_' + D.building + '$'), '');
  const isMine = /^building_[a-z]+_mine$/.test(D.building);
  const tiers = recs.map((r, k) => {
    let out, inputs;
    if (k < D.map_rungs) { out = { ...r.out }; inputs = { ...r.in }; }
    else {
      out = { ...top.out };
      // equal value added: the top map rung's input value over this rung's own vanilla mix
      const mv = val(r.in); inputs = {};
      if (topIn > 0 && !(mv > 0)) throw new Error(`${D.id}: ${r.pm} has no input mix to spread £${topIn} over`);
      for (const [g, q] of Object.entries(r.in)) { const x = r1(q * PRICE[g] / mv * topIn / PRICE[g]); if (x > 0) inputs[g] = x; }
      // §10.116 ruling 5: on a mine's pump rungs above the 1836 map (condensing, diesel) the tools above 5 become engines, value for value
      if (isMine && inputs.tools > ENGINE_TOOLS_KEEP) { const extra = inputs.tools - ENGINE_TOOLS_KEEP; inputs.tools = ENGINE_TOOLS_KEEP; inputs.engines = r1((inputs.engines || 0) + extra * PRICE.tools / PRICE.engines); }
    }
    for (const g of Object.keys(out)) if (!outGoods.includes(g)) throw new Error(`${D.id}: ${r.pm} makes ${g}, which rung 0 does not`);
    const emp = Object.values(r.emp).reduce((s, x) => s + x, 0);
    if (emp !== WORKERS) throw new Error(`${D.id}: ${r.pm} employs ${emp}, not ${WORKERS} — the staffing rule needs a ruling here`);
    const cost = D.cost ? D.cost[k] : k < D.map_rungs ? anchorCost : Math.round(anchorCost * Math.pow(STEP, k - D.map_rungs + 1));
    if (!(cost > 0)) throw new Error(`${D.id}: no cost for rung ${k}`);
    const s = slug(r.pm);
    const t = { key: k === 0 ? D.building : `${D.building}_${s}`, name: bldName(vb, name(r.pm)),
      pm_key: `pm_main_${D.id}_${s}`, pmg_key: `pmg_main_${D.id}_${s}`, pm_name: name(r.pm), vanilla_pm: r.pm, tech: gateOf(r.pm),
      output_qty: out[mainGood], inputs, output_good: mainGood, employment: { ...r.emp }, pollution: r.pol, texture: r.tex,
      era: eras[k], tech_year: null, natural_year: ERA_YEARS[eras[k]], building_cost: cost };
    const extra = Object.fromEntries(Object.entries(out).filter(([g]) => g !== mainGood));
    if (Object.keys(extra).length) t.extra_outputs = extra;
    // the config-side BE convention (lint_solvency L18, the building name's Recipe BE): the rung's era wage over its own staffing, as make_ab_config
    const O = val(out), I = val(inputs), W = eraWage(eras[k]) * wageUnits(t.employment);
    t.wage_pct = Math.round(W / (I + W) * 10000) / 10000; t.target_be = Math.round((I + W) / O * 100);
    return t;
  });
  // ---- secondary lines: output-adding / converting ones × vanilla slots ÷ tiered slots (½ or ⅔), on vanilla's own method -----------------
  const lineMult = 1 / slotMult;
  for (const g of secondaries) for (const pm of list(PMG[g], 'production_methods')) {
    const b = PM[pm] || ''; const gd = goodsOf(b);
    // a line that ADDS or CONVERTS output has a positive output term (explosives +iron, hardwood +hardwood for −wood); a line with none only
    // saves labour (steam donkey — the coal mine's takes 3 coal off the output —, rail, refrigeration, chainsaws): unchanged, as ruled
    if (!Object.values(gd.out).some(q => q > 0)) continue;
    // a line shared with a building outside this deposit would change that building too — refuse rather than reach it
    const outside = (PM_USERS[pm] || []).filter(u => u !== D.building);
    if (outside.length) throw new Error(`${D.id}: line ${pm} is also on ${outside.join(', ')} — scaling it would reach a building this book does not tier`);
    if (pmGoods[pm] || pmEmp[pm]) throw new Error(`${D.id}: ${pm} already carries an override in the base book`);
    const sc = o => Object.fromEntries(Object.entries(o).map(([k, q]) => [k, r1(q * lineMult)]));
    pmGoods[pm] = { in: sc(gd.in), out: sc(gd.out) };
    const e = employmentOf(b); if (Object.keys(e).length) pmEmp[pm] = Object.fromEntries(Object.entries(e).map(([k, q]) => [k, Math.round(q * lineMult)]));
    lineNotes.push(`${pm}: ${JSON.stringify(gd.in)} → ${JSON.stringify(gd.out)} × ${lineMult.toFixed(3)}`);
  }
  const ind = { id: D.id, output_good: mainGood, deposit: true, no_mass_be: true, clone_from_vanilla: true,
    source_file: `common/buildings/${BLDFILE[D.building]}`,
    building: { building_group: scalar(bb, 'building_group'), icon: scalar(bb, 'icon'), city_type: scalar(bb, 'city_type'), required_construction: scalar(bb, 'required_construction'), ownership_type: scalar(bb, 'ownership_type'), background: scalar(bb, 'background') },
    secondary_pmgs: secondaries, tiers };
  cfg.industries.push(ind);
  record.industries[D.id] = { building: D.building, map_rungs: D.map_rungs, slot_mult: slotMult, line_mult: +lineMult.toFixed(4), discover: D.discover || null, floor_1836: !!D.floor_1836,
    rungs: tiers.map(t => ({ key: t.key, era: t.era, output_qty: t.output_qty, inputs: t.inputs, building_cost: t.building_cost })) };
  report.push(...tiers.map((t, k) => `${D.id.padEnd(16)} t${t.era}${k < D.map_rungs ? '*' : ' '} ${t.pm_name.padEnd(28)} ${String(t.output_qty).padStart(5)} ${t.output_good}${t.extra_outputs ? ' + ' + JSON.stringify(t.extra_outputs) : ''}  from ${Object.entries(t.inputs).map(([g, q]) => q + ' ' + g).join(' + ') || '(nothing)'}  cost ${t.building_cost}  [${t.tech || 'no gate'}]`));
}
cfg.pm_goods = pmGoods; cfg.pm_employment = pmEmp;
// ⭐ REFERENCES REACH EVERY RUNG (ruled 2026-11-21, §10.125): a research anchor naming a deposit's vanilla key names all its rungs
const RUNGS_OF = Object.fromEntries(cfg.industries.filter(i => i.deposit).map(i => [i.tiers[0].key, i.tiers.map(t => t.key)]));
const NA = (cfg.research_events || {}).necessity_anchors || {};
// an entry is a building key, a bg_ group, a good:, or a LIST (one summed source); a deposit key becomes the list of its rungs (one source,
// as a single building was), and a list naming deposit keys takes their rungs in their place
for (const [k, v] of Object.entries(NA)) NA[k] = v.map(x => Array.isArray(x) ? [...new Set(x.flatMap(y => RUNGS_OF[y] || [y]))] : (RUNGS_OF[x] || x));
cfg._deposits = { ...record, command: 'node tools/make_deposit_config.mjs ' + process.argv.slice(2).join(' '), base: BASE, generated: new Date().toISOString() };
writeFileSync(join(REPO, `config/mod_config.${SFX}.json`), JSON.stringify(cfg));
const twinSrc = join(REPO, BASE.replace('mod_config.', 'tech_tree_options.'));
if (!existsSync(twinSrc)) throw new Error(`no tree twin ${twinSrc}`);
writeFileSync(join(REPO, `config/tech_tree_options.${SFX}.json`), rd(twinSrc));
console.log(`TIERED DEPOSITS (${SFX}) from ${BASE} — cost step ${STEP} above the 1836-map rungs, ${WORKERS} workers a level (* = on the 1836 map)`);
for (const l of report) console.log('  ' + l);
console.log('  secondary lines scaled (vanilla methods overridden):');
for (const l of lineNotes) console.log('    ' + l);
console.log(`  research anchors: ${JSON.stringify(NA)}`);
console.log(`wrote config/mod_config.${SFX}.json + its tree twin`);
