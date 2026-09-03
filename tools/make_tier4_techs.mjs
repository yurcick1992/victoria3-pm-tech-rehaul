// ============================================================================================
// THE FOUR-RUNG TECH TREE — pegged to vanilla wherever a vanilla technology is within 15 years
// and in a tree that plausibly gates that industry (user-ruled 2026-08-29).
//
// The six-era tree added 42 technologies. This one adds NINE, five of which serve more than one
// industry, because the ruling is: only create a technology where no vanilla one can be pegged.
// "Pegged" is two tests, not one — |tier year − tech year| ≤ 15 AND a tree that could plausibly
// gate that industry. Every tier has SOME vanilla tech within 15 years; most of those candidates
// are society or military techs that would put a furniture plant behind `antibiotics`.
//
//   node tools/make_tier4_techs.mjs
//
// Writes config/tech_tree_options.tier4.json and rewrites each tier's `tech` in
// config/mod_config.tier4.json. Deterministic. Nothing canonical is touched.
// ⚠ Run AFTER make_tier4_config.mjs (which sets the structure) and after --apply-solve; run the
// solve again afterwards only if you changed a tier's ERA, which this tool does not.
// ============================================================================================
import { readFileSync, writeFileSync } from 'node:fs';
import {ERA_MOVES} from './lib_tier4_spec.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const SUFFIX = process.env.TIER4_SUFFIX || 'tier4';
const rd = p => JSON.parse(readFileSync(join(REPO, p), 'utf8'));
const CFG_PATH = `config/mod_config.${SUFFIX}.json`;
const cfg = rd(CFG_PATH);
const canonTree = rd('config/tech_tree_options.json');
const CANON_OPT = canonTree.options.find(o => o.ships);

// vanilla's own mechanical era windows — the same mapping `gameEra` uses. A NEW technology is placed
// by its own onset year, which is also what the ladder-era alignment rule asks for: a tech gating an
// e2 tier lands in mechanical 4, an e3 tier in mechanical 5.
// ⚠ It must never land in era 1: `add_era_researched = era_1` hands every era-1 technology to the
// tier-1/2 countries at the 1836 start, and vanilla gives them none of these.
const gameEra = y => y < 1836 ? 1 : y <= 1861 ? 2 : y <= 1886 ? 3 : y <= 1911 ? 4 : 5;

// ---------------------------------------------------------------------------------------------
// THE PEG TABLE. `null` = leave the tier's current technology alone (it is already a vanilla tech
// within 15 years). A string = re-peg to that vanilla technology. A `NEW.` id = one of the nine.
// `redate` moves the TIER's own date where vanilla's is the correct one and ours was the error.
// ---------------------------------------------------------------------------------------------
const NEW = {
  // ⭐⭐ ONLY THREE technologies are minted now (was nine). The vanilla-ladder rebuild (2026-08-30)
  // takes each rung's gate from its own vanilla production method, so every rung that corresponds to
  // a vanilla method needs no new technology at all — and seven of the ten invented rungs peg to a
  // FREE vanilla technology. What remains is the three cases where nothing vanilla fits.
  continuous_web_processing: {
    year: 1930, category: 'production', industry: 'paper',
    name: 'Continuous Web Processing',
    desc: 'A paper machine that forms, presses and dries an unbroken web at speed, so the mill’s output '
        + 'stops being a count of sheets and becomes a rate.',
    prereqs: ['chemical_bleaching', 'shift_work'],
  },
  catalytic_synthesis: {
    year: 1937, category: 'production', industry: 'fertilizer',
    name: 'Catalytic Synthesis',
    desc: 'Promoted iron catalysts and continuous high-pressure reformers turn fixed nitrogen from a '
        + 'laboratory triumph into a commodity produced by the shipload.',
    prereqs: ['nitrogen_fixation', 'plastics'],
  },
  // ---- THE TWELVE MODERN GATES (user-ruled 2026-08-30, option 1: "mint them") ----------------
  // Twelve industries stopped 25+ years short of 1940 - furniture at 1871, arms 1886, munition 1884 -
  // which is why t3 sat on era 4 rather than 5. Only three FREE vanilla era-5 technologies are
  // production ones, so filling 1915-1940 honestly means minting. Stated cost of the ruling.
  spray_finishing: { year: 1923, category: 'production', industry: 'furniture', name: 'Spray Finishing',
    desc: 'Compressed-air spray guns and nitrocellulose lacquer finish a carcase in minutes where French polish took days.',
    prereqs: ['pneumatic_tools'] },
  long_draft_spinning: { year: 1925, category: 'production', industry: 'textile', name: 'Long-Draft Spinning',
    desc: 'Drafting the roving over a longer span lets one frame do the work of several, and one spinner tend far more spindles.',
    prereqs: ['electrical_capacitors'] },
  glass_fibre: { year: 1938, category: 'production', industry: 'glass', name: 'Glass Fibre',
    desc: 'Molten glass drawn through platinum bushings becomes a textile - insulation, filtration and reinforcement from the same furnace.',
    prereqs: ['plastics'] },
  cemented_carbide: { year: 1927, category: 'production', industry: 'tooling', name: 'Cemented Carbide',
    desc: 'Tungsten carbide sintered in a cobalt matrix holds an edge at cutting speeds that would draw the temper from any steel tool.',
    prereqs: ['vulcanization'] },
  continuous_strip_mill: { year: 1932, category: 'production', industry: 'steel', name: 'Continuous Strip Mill',
    desc: 'A single line of stands rolls a slab into coil without reheating, and sheet steel stops being sold by the plate.',
    prereqs: ['electric_arc_process'] },
  high_speed_diesel: { year: 1935, category: 'production', industry: 'motor', name: 'High-Speed Diesel',
    desc: 'Precision injection and welded frames take the compression-ignition engine from ships and pit-head to lorries and rail.',
    prereqs: ['compression_ignition'] },
  stamped_receivers: { year: 1938, category: 'military', industry: 'arms', name: 'Stamped Receivers',
    desc: 'Pressed and welded sheet-metal receivers replace milled forgings, cutting the machine hours in a rifle by an order of magnitude.',
    prereqs: ['bolt_action_rifles'] },
  automatic_aa_guns: { year: 1936, category: 'military', industry: 'artillery', name: 'Automatic Anti-Aircraft Guns',
    desc: 'Autoloading mounts with mechanical predictors put a continuous shell stream where an aircraft is going to be.',
    prereqs: ['automatic_machine_guns'] },
  automatic_shell_filling: { year: 1940, category: 'production', industry: 'munition', name: 'Automatic Shell Filling',
    desc: 'Remote filling lines meter and seat explosive charges without a hand near the shell, so output stops being bounded by nerve.',
    prereqs: ['dynamite'] },   // was smokeless_powder, dropped with munition's 1884 rung
  polyamide_synthesis: { year: 1939, category: 'production', industry: 'synthetics', name: 'Polyamide Synthesis',
    desc: 'Condensing diamines with diacids yields a fibre spun from coal, air and water - stronger wet than dry, and wholly synthetic.',
    prereqs: ['art_silk'] },
  transfer_machining: { year: 1936, category: 'production', industry: 'automotive', name: 'Transfer Machining',
    desc: 'A block moves itself between fixed stations, each cutting one feature, so an engine is machined without ever being handled.',
    prereqs: ['compression_ignition'] },
  sound_film: { year: 1932, category: 'society', industry: 'art_academy', name: 'Sound Film',
    desc: 'Optical sound printed beside the frame marries image to voice, and the picture house stops needing an orchestra.',
    prereqs: ['film'] },
};

// tier key -> { tech, redate? }.   Only tiers that CHANGE are listed.
// ⭐⭐ THE PEG TABLE IS GONE (2026-08-30). Gates are no longer chosen here at all: every rung takes
// the technology VANILLA gates its own production method with, applied in make_tier4_config.mjs where
// the ladder is derived, and an invented rung takes the peg named in lib_tier4_spec.mjs. Choosing
// gates by date proximity — which is what this table did — is precisely what orphaned four vanilla
// technologies and let one technology gate two rungs of one industry.
const PEGS = {};
// ⚠ THREE DOCUMENTED EXCEPTIONS to the 15-year rule, deliberately left alone: paper e1 →
// chemical_bleaching (Δ75), art_academy e1 → camera (Δ46), art_academy e2 → film (Δ17). In each the
// vanilla technology is LITERALLY the right one and vanilla dates it at invention rather than at
// deployment. Minting a technology to paper over vanilla's own dating would be worse than the gap.
const EXCEPTIONS = { paper_1: 'chemical_bleaching', art_academy_1: 'camera', art_academy_2: 'film' };

// ---------------------------------------------------------------------------------------------
// 1. apply the pegs to the config
// ---------------------------------------------------------------------------------------------
const applied = [], redated = [];
for (const ind of cfg.industries) {
  if (ind.disabled) continue;
  for (const t of ind.tiers) {
    const id = `${ind.id}_${t.era}`;
    const p = PEGS[id];
    if (!p) continue;
    t.tech = p.tech;
    applied.push(`${ind.id} e${t.era} → ${p.tech}`);
    if (p.redate) { t.tech_year = p.redate; t.natural_year = t.natural_year; redated.push(`${ind.id} e${t.era} → ${p.redate}`); }
  }
}

// ---------------------------------------------------------------------------------------------
// 2. build the tree: every VANILLA technology from the canonical tree, unchanged, plus the nine.
//    `unlocks` is rebuilt from scratch off the tier4 config, so it can never describe another book.
// ---------------------------------------------------------------------------------------------
const techs = CANON_OPT.techs.filter(t => t.origin === 'vanilla').map(t => ({ ...t, unlocks: [] }));
// ⭐ RAISE the ruled gates (lib_tier4_spec ERA_MOVES). Applied here, before validation, so the
// prerequisite-inversion check below judges the FINAL eras and not the ones we started from.
for (const t of techs) if (ERA_MOVES[t.id] != null && ERA_MOVES[t.id] > t.era) t.era = ERA_MOVES[t.id];
for (const [id, n] of Object.entries(NEW)) {
  techs.push({
    id, name: n.name, vanillaName: null, renamed: null, desc: n.desc,
    category: n.category, era: gameEra(n.year), year: n.year, onset: n.year,
    idea: false, mod: null, origin: 'new', filler: false, platform: null,
    industry: n.industry, prereqs: n.prereqs, unlocks: [], vanillaUnlocks: [],
    pmUnlocks: [], otherGates: [], modLines: [], blocks: [],
  });
}
const byId = Object.fromEntries(techs.map(t => [t.id, t]));

const missing = [];
for (const ind of cfg.industries) {
  if (ind.disabled) continue;
  for (const t of ind.tiers) {
    const T = byId[t.tech];
    if (!T) { missing.push(`${ind.id} e${t.era} → ${t.tech}`); continue; }
    T.unlocks.push({ key: t.key, name: t.name, era: t.era, year: t.tech_year ?? null, ind: ind.id });
  }
}
if (missing.length) { console.error('⚠⚠ tiers whose technology is in NEITHER vanilla nor the new set:\n  ' + missing.join('\n  ')); process.exit(1); }

// ---- the guardrails tech_tree_spec.mjs enforces, re-checked here because this tool bypasses it ----
const errs = [];
for (const t of techs) {
  if (t.origin !== 'new') continue;
  if (t.era <= 1) errs.push(`${t.id} is in era ${t.era} — a NEW technology may never land in era 1 (add_era_researched hands every era-1 tech to the 1836 start)`);
  if (!t.unlocks.length && !t.modLines.length) errs.push(`${t.id} unlocks nothing and carries no modifier — there are no contentless technologies`);
  for (const p of t.prereqs) {
    if (!byId[p]) errs.push(`${t.id} has an unknown prerequisite ${p}`);
    else if (byId[p].category !== t.category) errs.push(`${t.id} (${t.category}) depends on ${p} (${byId[p].category}) — the engine REFUSES a cross-category prerequisite and logs "is in a different category"`);
    else if (byId[p].era > t.era) errs.push(`${t.id} (era ${t.era}) depends on ${p} (era ${byId[p].era}) — a prerequisite may not sit in a LATER era`);
  }
}
// every tier's gate must be reachable, and the 15-year rule must hold except where ruled otherwise
for (const ind of cfg.industries) {
  if (ind.disabled) continue;
  for (const t of ind.tiers) {
    if ((t.era ?? 0) === 0) continue;               // era-0 rungs ride add_era_researched
    const T = byId[t.tech], gap = Math.abs((T.onset ?? T.year ?? 0) - (+t.tech_year || 0));
    if (gap > 15 && EXCEPTIONS[`${ind.id}_${t.era}`] !== t.tech && !ownsGate(ind, t))
      errs.push(`${ind.id} e${t.era} (${t.tech_year}) is pegged to ${t.tech} (${T.onset}) — Δ${gap}y, over the ruled 15 and not a listed exception`);

// ⭐ THE 15-YEAR RULE ONLY JUDGES A PEG WE CHOSE. A rung that takes the technology VANILLA gates its
// own production method with cannot be "mispegged" — that IS the right technology, and vanilla dates
// many of them at invention rather than deployment (camera 1839 for an 1885 rung, open_hearth 1865
// for 1885). Applying the rule there would demand we peg AWAY from vanilla, which is the mistake the
// 2026-08-30 rebuild exists to undo.
function ownsGate(ind, t) {
  if (!t.vanilla_pm) return false;            // an INVENTED rung: its peg is ours, so the rule applies
  return true;
}
  }
}
if (errs.length) { console.error('⚠⚠ TREE VALIDATION FAILED:\n  ' + errs.join('\n  ')); process.exit(1); }

const out = { ...canonTree, generated: new Date().toISOString().slice(0, 19),
  options: [{ ...CANON_OPT, id: 'tier4', label: 'Four-rung, vanilla-pegged', ships: true,
    tagline: 'Nine added technologies, five of them shared between industries; everything else is vanilla.',
    techs }] };
writeFileSync(join(REPO, `config/tech_tree_options.${SUFFIX}.json`), JSON.stringify(out));
writeFileSync(join(REPO, CFG_PATH), JSON.stringify(cfg));

const newT = techs.filter(t => t.origin === 'new');
console.log(`THE FOUR-RUNG TECH TREE — ${techs.length} technologies, ${newT.length} of them NEW`);
console.log(`  (the six-era tree adds ${CANON_OPT.techs.filter(t => t.origin === 'new').length})\n`);
console.log('  new technology                    year  era  serves');
for (const t of newT)
  console.log('  ' + t.id.padEnd(33) + t.year + '   ' + t.era + '   '
    + t.unlocks.map(u => u.ind + ' e' + u.era).join(' + ') + (t.unlocks.length > 1 ? '   ⭐ shared' : ''));
console.log(`\n  re-pegged to a vanilla technology: ${applied.filter(a => !Object.keys(NEW).some(n => a.endsWith(n))).length}`);
console.log(`  re-dated tiers: ${redated.join(', ') || 'none'}`);
console.log(`  documented Δ>15 exceptions: ${Object.entries(EXCEPTIONS).map(([k, v]) => k + '→' + v).join(', ')}`);
const gated = techs.filter(t => t.unlocks.length).length;
console.log(`  technologies that gate at least one of our tiers: ${gated}`);
console.log(`\n  wrote config/tech_tree_options.${SUFFIX}.json and re-pegged ${CFG_PATH}`);
