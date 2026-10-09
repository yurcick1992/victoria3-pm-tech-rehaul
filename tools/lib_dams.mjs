// THE HYDRO-DAM MEGAPROJECTS — ONE derivation, shared by the emitter and every report (ROADMAP step 6,
// BALANCE_FRAMEWORK §10.89, user-ruled 2026-09-26).
//
// A PROJECT is one state's dams (config/dam_projects.json: research rows merged per state, a depersonalised
// name, the anchor province). This module turns a project + the config's `dams` block into what ships:
// its LEVELS (one expandable building per project since §10.89.9 — "stage" below means one level), each level's construction points,
// electricity, staff and upkeep, the unlocking technology, and the survey's length and bureaucracy cost.
//
// ⭐ THE COST MODEL (the user's go-ahead, 2026-09-26):
//   points per MW = CAP_UNITS_PER_MW × (power-plant points ÷ 50) × CAPEX_RATIO × m × (MW per part ÷ 560)^SCALE_EXP
//   electricity per MW = UNITS_PER_MW
// • CAP_UNITS_PER_MW 0.4 — one vanilla coal level (50 electricity) ≈ 125 MW, the world-average calibration of
//   vanilla's 1936 electricity against real mid-1930s capacity (per country 65–350 MW a level).
// • power-plant points — the coal plant's OWN construction cost, read from the config's
//   `building_required_construction.building_power_plant` (4 × vanilla's 400 = 1,600 since the same ruling),
//   so a dam is priced against the plant it competes with and re-prices itself if that cost moves.
// • CAPEX_RATIO 1.2 — hydro's capital cost per kW over a thermal plant's at a Dneproges-class site
//   (1930s: Hoover ~$90/kW, Grand Coulee ~$80, Bonneville ~$170, Conowingo ~$200 against thermal ~$100–125;
//   from memory, the big dams cheapest).
// • m — the research session's terrain multiplier (Dneproges 1.0, Niagara 0.5, Fort Peck 2.5).
// • the scale term — a part twice Dneproges' size costs ~13% less per MW: the "recoup at scale".
// • UNITS_PER_MW 0.52 = 0.4 × 1.3 — hydro ran as baseload at ~50–60% of nameplate against ~35–45% for 1930s
//   steam, and a building's output is energy, not nameplate capacity.
// A project is cut into STAGES of equal size, each at most STAGE_CAP points (~4.6 years at the ~42/week
// per-project construction cap the user allowed for, +20% over the 35 of the technologies alone).

import { readFileSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

export const DAM_DEFAULTS = {
  projects_file: 'config/dam_projects.json',
  cap_units_per_mw: 0.4,
  units_per_mw: 0.52,
  capex_ratio: 1.2,
  scale_exp: -0.2,
  scale_ref_mw: 560,
  stage_cap_points: 10000,
  staff_per_50: { laborers: 50, machinists: 100, engineers: 50 },   // a fifth of a coal plant's 1,000
  inputs_per_50: { tools: 1, engines: 1 },                          // ~7% of revenue at base prices
  // the resource type of a research row → a technology class (the MW-dominant row decides a merged project)
  class_of_resource: {
    falls_diversion: 'A', high_head_diversion: 'A', high_head_alpine: 'A', escarpment_high_head: 'A',
    plateau_diversion: 'A', lake_outlet: 'A', lake_outlet_cascade: 'A', lake_high_head: 'A', canal_cascade: 'A',
    river_cascade: 'B', gorge_mid_head: 'B', river_mid_head: 'B', storage_mid_dam: 'B', river_low_head: 'B',
    run_of_river_rapids: 'B', mixed: 'B',
    large_river_low_head: 'C', large_river_mid_head: 'C', large_river_high_dam: 'C', storage_high_dam: 'C',
    lowland_earthfill: 'C', lowland_storage: 'C',
  },
  // A: electrical_generation (game era 3, the power plant's own technology — Niagara 1895, Necaxa 1905);
  // B: steam_turbine (game era 4, the turbine-generator that also unlocks the coal plant's turbine method);
  // C: arc_welding (game era 5 — welded penstocks, the 1930s high dams)
  tech_by_class: { A: 'electrical_generation', B: 'steam_turbine', C: 'arc_welding' },
  survey: {
    months_by_class: { A: 12, B: 18, C: 24 },
    plus_months: [[1500, 6], [4000, 6]],         // +6 above 1.5 GW, +6 more above 4 GW
    max_months: 36,
    bureaucracy_ref: 1000, bureaucracy_ref_points: 20000, bureaucracy_exp: 0.3,
    bureaucracy_min: 500, bureaucracy_max: 1500, bureaucracy_round: 50,
  },
  ai: {
    // low per-evaluation odds, like vanilla's canal (10): the AI evaluates every visible decision in one pass, so
    // high odds let one country take several surveys the same day (probe p2: Britain four on 1836.1.13)
    survey_owner: 3, survey_overlord: 5,          // (unused since probe p3: the AI surveys through the driver)
    stage_ai_value: 30000,
    // ⚠ NOTHING HERE BUILDS A DAM (user-ruled 2026-09-27, FINDINGS F173/F174): the engine's own AI builds every level, at home
    // and in its subjects. The overlord financing (finance_*), the owner capacity gate (owner_gdp_per_point / owner_max_backlog_weeks),
    // the driver's build switches and its build slots are GONE; the driver only surveys (BALANCE_FRAMEWORK §10.89.11).
    // the AI driver's survey concurrency: one survey, plus one per GDP tier passed (game £ a year)
    survey_slot_gdp: [100e6, 300e6],                     // 1-3 surveys at once
  },
};

export function damParams(cfg) {
  const d = cfg.dams || {};
  const P = { ...DAM_DEFAULTS, ...d };
  for (const k of ['staff_per_50', 'inputs_per_50', 'class_of_resource', 'tech_by_class', 'survey', 'ai'])
    P[k] = { ...DAM_DEFAULTS[k], ...(d[k] || {}) };
  const pp = cfg.building_required_construction?.building_power_plant ?? 400;
  P.coal_points_per_unit = pp / 50;
  P.power_plant_points = pp;
  return P;
}

export function loadProjects(cfg, P = damParams(cfg)) {
  const f = isAbsolute(P.projects_file) ? P.projects_file : join(REPO, P.projects_file);
  const j = JSON.parse(readFileSync(f, 'utf8'));
  return Array.isArray(j) ? j : j.projects;
}

const round = (v, s) => Math.round(v / s) * s;

export function deriveProject(p, P) {
  if (!p.id || !/^[a-z0-9_]+$/.test(p.id)) throw new Error(`dams: bad project id '${p.id}'`);
  if (!/^STATE_[A-Z0-9_]+$/.test(p.state)) throw new Error(`dams: ${p.id} bad state '${p.state}'`);
  if (!/^x[0-9A-F]{6}$/.test(p.anchor_province)) throw new Error(`dams: ${p.id} bad anchor province '${p.anchor_province}'`);
  let pts = 0, mw = 0;
  const ptsByClass = {};
  for (const r of p.rows) {
    const rmw = r.parts_taken * r.mw_per_part;
    const cls = P.class_of_resource[r.resource_type];
    if (!cls) throw new Error(`dams: ${p.id} row ${r.research_id} unknown resource type '${r.resource_type}'`);
    mw += rmw;
    const rp = rmw * P.cap_units_per_mw * P.coal_points_per_unit * P.capex_ratio * r.cost_multiplier
      * Math.pow(r.mw_per_part / P.scale_ref_mw, P.scale_exp);
    ptsByClass[cls] = (ptsByClass[cls] || 0) + rp;
    pts += rp;
  }
  if (!(mw > 0)) throw new Error(`dams: ${p.id} has no MW`);
  const probe = P.probe || {};
  const costMult = probe.cost_mult ?? 1;
  const units = mw * P.units_per_mw;
  const n = Math.max(1, Math.ceil(pts / P.stage_cap_points));
  // each STAGE carries the technology class of the rows it stands for: the n stages are shared out over the
  // classes present in proportion to their points (largest remainder, every present class at least one stage
  // when n allows), earliest class first — so Niagara's falls open with electrical_generation even though
  // Long Sault, a 1950s large-river dam, supplies most of the New York project's MW.
  const classes = Object.keys(ptsByClass).sort();
  const quota = classes.map(c => ({ c, q: n * ptsByClass[c] / pts }));
  quota.forEach(x => { x.k = Math.floor(x.q); });
  let left = n - quota.reduce((s, x) => s + x.k, 0);
  for (const x of [...quota].sort((a, b) => (b.q - b.k) - (a.q - a.k))) if (left > 0) { x.k++; left--; }
  for (const x of quota) if (x.k === 0) { const donor = quota.filter(y => y.k > 1).sort((a, b) => b.k - a.k)[0]; if (donor) { donor.k--; x.k = 1; } }
  const stage_classes = quota.flatMap(x => Array(x.k).fill(x.c));
  const cls = stage_classes[0];
  const stagePts = Math.max(10, Math.round(pts * costMult / n));
  const stageUnits = Math.max(1, Math.round(units / n));
  const k = stageUnits / 50;
  const staff = {};
  for (const [prof, q] of Object.entries(P.staff_per_50)) staff[prof] = Math.max(10, round(q * k, 10));
  const inputs = {};
  for (const [g, q] of Object.entries(P.inputs_per_50)) inputs[g] = Math.max(0.1, Math.round(q * k * 10) / 10);
  const S = P.survey;
  let months = S.months_by_class[cls];
  for (const [thr, add] of S.plus_months) if (mw > thr) months += add;
  months = Math.min(S.max_months, months);
  if (probe.survey_months) months = probe.survey_months;
  let bur = S.bureaucracy_ref * Math.pow(pts / S.bureaucracy_ref_points, S.bureaucracy_exp);
  bur = Math.min(S.bureaucracy_max, Math.max(S.bureaucracy_min, round(bur, S.bureaucracy_round)));
  const stage_techs = stage_classes.map(c => P.tech_by_class[c]);
  return {
    // `tech` = the FIRST LEVEL's technology: the one the survey needs AND the one building level 1 needs (user, 2026-09-27: the
    // build lock must equal the survey lock) — deliberately not the MW-dominant class's, which could differ on a merged project
    ...p, mw, total_points: Math.round(pts), total_units: Math.round(units), cls, tech: stage_techs[0],
    stage_classes, stage_techs,
    stages: n, stage_points: stagePts, stage_units: stageUnits, staff, inputs, survey_months: months,
    survey_bureaucracy: bur,
  };
}

// ⭐ THE RESOURCE-SLOT LAYOUT (`dams.layout = 'resource4'`): FOUR dam building types in place of one per project, each state
// region carrying `building_dam_<class> = <slots>` in its capped_resources (the logging-camp mechanism). ONE derivation, shared by
// tools/emit_dams.mjs (what ships) and tools/testbed/ledger/dam_slots.mjs (the slot check).
//  • `dams.resource4` present = THE RULED TABLE (user, 2026-10-09: "go with the revised classes"): size by the PROJECT's scale
//    (≥ large_mw → large), price by its head type (high-head resource types holding ≥ half its MW → cheap), each class a fixed
//    level (units of electricity, construction points, technology class); slots = round(project electricity ÷ the class level);
//    a project under min_units electricity is DROPPED unless it is named in `keep` (its non-power effects are large), which takes
//    one level of `keep_class`. The survey's length and bureaucracy are re-derived from the shipped levels.
//  • `dams.resource4` absent = the F221 PROBE rule (median splits of MW per part and points per MW) — kept so the v-* probe configs
//    of 20261009_082702 regenerate as measured.
// Staff and upkeep follow the electricity (staff_per_50 / inputs_per_50); the ruled table is ASSERTED profitable once built at any
// price: electricity at the 25% band floor, its inputs at the 175% ceiling and a wage of £0.15 an employee a week (twice Britain's
// 1935 rate) must still leave a profit.
const BASE_PRICE = { electricity: 30, tools: 40, engines: 60 };
export function resourceLayout(P, projects) {
  const med = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
  const costMult = P.probe?.cost_mult ?? 1;
  const NAMES = ['small_cheap', 'small_dear', 'large_cheap', 'large_dear'];
  const upkeep = units => {
    const k = units / 50, staff = {}, inputs = {};
    for (const [prof, q] of Object.entries(P.staff_per_50)) staff[prof] = Math.max(10, Math.round(q * k / 10) * 10);
    for (const [g, q] of Object.entries(P.inputs_per_50)) inputs[g] = Math.max(0.1, Math.round(q * k * 10) / 10);
    return { staff, inputs };
  };
  const classes = {}, kept = [], dropped = [];
  const R = P.resource4;
  if (R) {
    const cheap = new Set(R.cheap_resources || []);
    if (!cheap.size) throw new Error('dams.resource4: cheap_resources empty');
    for (const r of cheap) if (!P.class_of_resource[r]) throw new Error(`dams.resource4: cheap resource type '${r}' unknown`);
    for (const c of NAMES) {
      const d = R.classes?.[c]; if (!d) throw new Error(`dams.resource4: class ${c} missing`);
      if (!P.tech_by_class[d.tech]) throw new Error(`dams.resource4: ${c} technology class '${d.tech}'`);
      const { staff, inputs } = upkeep(d.units);
      // the profitability floor (see the header)
      const W = 0.15, wu = (staff.laborers || 0) * 1 + (staff.machinists || 0) * 1.5 + (staff.engineers || 0) * 3;
      const worst = 0.25 * BASE_PRICE.electricity * d.units - 1.75 * Object.entries(inputs).reduce((s, [g, q]) => s + q * BASE_PRICE[g], 0) - W * wu;
      if (!(worst > 0)) throw new Error(`dams.resource4: ${c} is not profitable at the worst prices (${worst.toFixed(0)} a week)`);
      classes[c] = { units: d.units, points: Math.max(10, Math.round(d.points * costMult)), tcls: d.tech, name: d.name || c, staff, inputs,
        worst_profit: Math.round(worst), n: 0, slots: 0 };
    }
    const keep = new Set(R.keep || []);
    for (const id of keep) if (!projects.some(p => p.id === id)) throw new Error(`dams.resource4: keep names no project '${id}'`);
    for (const p of projects) {
      let m = 0; for (const r of p.rows) if (cheap.has(r.resource_type)) m += r.parts_taken * r.mw_per_part;
      let c = `${p.mw >= R.large_mw ? 'large' : 'small'}_${m >= p.mw / 2 ? 'cheap' : 'dear'}`;
      const units0 = p.mw * P.units_per_mw;
      let slots = Math.round(units0 / classes[c].units);
      if (keep.has(p.id)) { c = R.keep_class || 'small_dear'; slots = Math.max(1, Math.round(units0 / classes[c].units)); }
      if (units0 < (R.min_units ?? 0) && !keep.has(p.id)) { dropped.push({ id: p.id, state: p.state, units: Math.round(units0), why: `under ${R.min_units} electricity` }); continue; }
      if (slots < 1) { dropped.push({ id: p.id, state: p.state, units: Math.round(units0), why: 'rounds to no level' }); continue; }
      p.dcls = c; kept.push(p);
    }
  } else {
    for (const p of projects) { p._part = p.mw / p.rows.reduce((s, r) => s + r.parts_taken, 0); p._ppm = p.total_points / p.mw; }
    const mPart = med(projects.map(p => p._part)), mPpm = med(projects.map(p => p._ppm));
    for (const p of projects) { p.dcls = `${p._part > mPart ? 'large' : 'small'}_${p._ppm > mPpm ? 'dear' : 'cheap'}`; kept.push(p); }
    for (const c of NAMES) {
      const ps = projects.filter(p => p.dcls === c); if (!ps.length) throw new Error(`dams: class ${c} is empty`);
      const ppm = med(ps.map(p => p._ppm)), mwl = Math.min(med(ps.map(p => p._part)), P.stage_cap_points / ppm);
      const units = Math.max(1, Math.round(mwl * P.units_per_mw));
      classes[c] = { units, points: Math.max(10, Math.round(ppm * mwl * costMult)), tcls: c.startsWith('large') ? 'B' : 'A',
        name: { small_cheap: 'Small Hydro Dam', small_dear: 'Small Hydro Dam (difficult site)', large_cheap: 'Large Hydro Dam', large_dear: 'Large Hydro Dam (difficult site)' }[c],
        ...upkeep(units), n: 0, slots: 0, mwl };
    }
  }
  const S = P.survey;
  for (const p of kept) {
    const C = classes[p.dcls];
    const slots = R ? Math.max(1, Math.round(p.mw * P.units_per_mw / C.units)) : Math.max(1, Math.round(p.mw / C.mwl));
    C.n++; C.slots += slots;
    const tech = P.tech_by_class[C.tcls];
    Object.assign(p, { stages: slots, stage_classes: Array(slots).fill(C.tcls), stage_techs: Array(slots).fill(tech), cls: C.tcls,
      tech, stage_points: C.points, stage_units: C.units, staff: C.staff, inputs: C.inputs });
    if (R) {   // the survey follows the shipped levels: months by the class's technology, bureaucracy by the shipped points
      const pts = slots * C.points / costMult, units = slots * C.units;
      let months = S.months_by_class[C.tcls];
      for (const [thr, add] of S.plus_months) if (units / P.units_per_mw > thr) months += add;
      months = Math.min(S.max_months, months);
      if (P.probe?.survey_months) months = P.probe.survey_months;
      let bur = S.bureaucracy_ref * Math.pow(pts / S.bureaucracy_ref_points, S.bureaucracy_exp);
      bur = Math.min(S.bureaucracy_max, Math.max(S.bureaucracy_min, round(bur, S.bureaucracy_round)));
      Object.assign(p, { survey_months: months, survey_bureaucracy: bur });
    }
  }
  return { classes, projects: kept, dropped, ruled: !!R };
}

export function deriveAll(cfg) {
  const P = damParams(cfg);
  const ids = new Set(), states = new Set();
  const out = loadProjects(cfg, P).map(p => {
    if (ids.has(p.id)) throw new Error(`dams: duplicate id ${p.id}`);
    if (states.has(p.state)) throw new Error(`dams: two projects in ${p.state} (the ruling is one per state)`);
    ids.add(p.id); states.add(p.state);
    return deriveProject(p, P);
  });
  return { P, projects: out };
}
