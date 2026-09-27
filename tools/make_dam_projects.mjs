// config/dam_projects.json — THE DAM PROJECT TABLE (ROADMAP step 6, BALANCE_FRAMEWORK §10.89).
//
//   node tools/make_dam_projects.mjs <sites.json>        # writes config/dam_projects.json
//
// <sites.json> is the placement research's output (one object per Victoria 3 state: the research rows merged
// or split onto it, a depersonalised name, the anchor province; 2026-09-26, user-reviewed case by case).
// This script copies the fields the emitter needs and attaches the NON-POWER EFFECTS below — the irrigation
// research of 2026-09-26, kept conservative by ruling ("bonuses should be justified by more than building
// desirability"; "no bonus is about as effective per unit of input and labour as elsewhere in the world").
// An effect names its TARGET state explicitly, because three dams irrigate a different state from the one
// they stand in (Aswan → Middle Egypt, Hoover → California, Mingachevir → Azerbaijan). `stage` is the stage
// whose completion fires it (default 1; 'last' = the project's final stage).
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
// the placement research's own output is COMMITTED as config/dam_sites_research.json (it used to live only in a session scratchpad)
const src = process.argv[2] || join(REPO, 'config/dam_sites_research.json');
const sites = JSON.parse(readFileSync(src, 'utf8'));

// THE RULED CUTS (user-ruled 2026-09-27, FINDINGS F172, BALANCE_FRAMEWORK §10.89.10): hydro stood at 43-52% of world electricity at
// 1935 and remote dams pulled electricity-using industry into empty places, so the sites with a very low 1836 population and no
// migration pull were removed or trimmed - Russian and American sites protected. Each entry names the reason.
const CUTS = {
  remove: {
    labrador_plateau: 'Churchill Falls, 1967-74, built for export to Quebec; subarctic, nearly empty',
    thjorsa_falls: 'Burfell 1969 for an aluminium smelter; Iceland subarctic, 1836 pop ~60k',
    iguacu_falls: 'never developed (status F); national parks 1934/39; jungle frontier',
    misiones_iguazu: 'the same falls, never developed; duplicate project',
    kafue_victoria_falls: 'Victoria Falls only ~8 MW (1938), Kafue Gorge 1971-72; tropical interior, low population',
    victoria_falls: 'the same falls, never built at this scale; duplicate project',
    kemi_oulu: 'status L (from 1949); Lapland subarctic and sparse',
    grijalva_canyon: 'Malpaso 1969 / Angostura 1976 / Chicoasen 1980; remote tropical south',
    caroni_falls: 'Macagua 1961 / Guri 1968-86 for Guayana heavy industry; jungle and savannah frontier',
    naryn_gorge: 'Toktogul 1975+, built to export power; remote Tien Shan, nomadic population',
    vakhsh_gorges: 'Nurek 1972-79 for an aluminium smelter; the 1930s Vakhsh irrigation was a canal, not a dam',
    upper_irtysh: 'Ust-Kamenogorsk 1952 / Bukhtarma 1960s; Kazakh steppe; placement in Semireche doubtful',
  },
  dropRows: {   // project id -> research rows (by project name) removed, the rest kept
    nelson_winnipeg: { 'Nelson River, lower': '1961+, for nickel mining, long lines south; the Winnipeg River plants (1911-31) stay' },
    waitaki_southern_lakes: { 'Manapouri': '1971, for an aluminium smelter, in empty Fiordland; Waitaki and Clutha stay' },
    norrland_rivers: { 'Norrland rivers (other)': 'mostly 1950s-60s transmission south; Lule alv (Porjus 1915) stays' },
    sevan_zanga_vorotan: { 'Vorotan': '1970-89 in remote Syunik; the Sevan-Hrazdan cascade (1936-62) stays' },
  },
  parts: {      // project id -> { research row: parts kept }
    rion_ingur: { 'Georgia (Rioni, lower Inguri)': [2, 'trimmed to the Rioni scale; Inguri (1,300 MW) is 1978-87'] },
    // the Gatineau plants (70% rule, checked 2026-09-27): Paugan's whole output went to Ontario Hydro (stays Ontario); Chelsea and
    // Farmer's sold half to Ontario Hydro and half to CIP's Templeton mill (under 70%) -> physical: Quebec (~1 part of 250 MW)
    niagara_ottawa: { 'Ottawa + Gatineau': [4, 'Des Joachims, Chats, Chenaux, Paugan (Paugan 100% Ontario Hydro)'] },
    laurentian_rivers: { 'Ottawa + Gatineau': [2, 'Carillon + Chelsea and Farmer\'s (half to Ontario, half to the Templeton mill: physical)'] },
  },
  // THE HOST STATE SWAPPED (70% rule): each project keeps its physical objects and takes the other's state and anchor.
  swapHosts: [
    ['conowingo_falls', 'lower_susquehanna', 'Conowingo (MD) was Philadelphia Electric\'s own plant, lines to Philadelphia -> Pennsylvania; from 1931 Baltimore\'s Consolidated was entitled to ALL of Penn Water\'s energy from Holtwood and Safe Harbor (and bought 2/3 of Safe Harbor directly; 194 F.2d 89) -> Maryland'],
  ],
  // RELOCATED to the physical state (70% rule): no consumer state reached 70%
  relocate: {
    tabqa_narrows: { state: 'STATE_DEIR_EZ_ZOR', state_name: 'Deir-Ez-Zor', anchor_province: 'x1ECFDA', owner_1836: 'TUR',
      why: 'Tabqa (1968-78, 880 MW) fed the Syrian national grid and irrigation, Aleppo nowhere near 70%; it stands 40 km upstream of Raqqa, in Deir-Ez-Zor' },
  },
  // ONE OBJECT, ONE IN-GAME PROJECT (user-ruled 2026-09-27): a physical object serving two states goes to its biggest IRL consumer
  // state if that state took >= 70% of the output (the Hoover ruling), otherwise strictly to where it physically stands.
  // source project -> [target project, reason]; the source's rows are added to the target's (same research row: parts summed).
  merge: {
    sao_francisco_rapids: ['paulo_afonso_falls', 'one site (the Paulo Afonso falls, powerhouses on the Bahia bank); CHESF sold across the whole Northeast, no state near 70% -> geographic: Bahia'],
    upper_murray: ['snowy_tumut', 'the Snowy works (Tumut, Murray 1-2) stand in NSW; output ~2/3 NSW, ~1/3 Victoria, no 70% consumer -> geographic: NSW'],
    iron_gates_djerdap: ['iron_gates_arges', 'one dam straddling the Danube, output 50/50 Romania/Yugoslavia: a tie, user-ruled to Romania (Wallachia)'],
  },
};
const byId0 = new Map(sites.map(s => [s.id, s]));
for (const id of [...Object.keys(CUTS.remove), ...Object.keys(CUTS.dropRows), ...Object.keys(CUTS.parts),
  ...Object.keys(CUTS.merge), ...Object.values(CUTS.merge).map(m => m[0])])
  if (!byId0.has(id)) throw new Error(`make_dam_projects: a cut names ${id}, which is not in the sites`);
for (const [id, rows] of Object.entries({ ...CUTS.dropRows, ...CUTS.parts })) for (const name of Object.keys(rows))
  if (!byId0.get(id).rows.some(r => r.project === name)) throw new Error(`make_dam_projects: ${id} has no row '${name}'`);
const cutSites0 = sites.filter(s => !(s.id in CUTS.remove)).map(s => ({ ...s, rows: s.rows
  .filter(r => !(CUTS.dropRows[s.id] && r.project in CUTS.dropRows[s.id]))
  .map(r => (CUTS.parts[s.id]?.[r.project] ? { ...r, parts_taken: CUTS.parts[s.id][r.project][0] } : r)) }));
const byIdCut = new Map(cutSites0.map(s => [s.id, s]));
for (const [from, [to]] of Object.entries(CUTS.merge)) {
  const t = byIdCut.get(to);
  for (const r of byIdCut.get(from).rows) {
    const same = t.rows.find(x => x.research_id === r.research_id);
    if (same) same.parts_taken += r.parts_taken; else t.rows.push({ ...r });
  }
}
const HOST = ['state', 'state_name', 'anchor_province', 'owner_1836'];
for (const [a, b] of CUTS.swapHosts) {
  const A = byIdCut.get(a), B = byIdCut.get(b);
  if (!A || !B) throw new Error(`make_dam_projects: swapHosts names a missing project (${a}, ${b})`);
  for (const k of HOST) [A[k], B[k]] = [B[k], A[k]];
}
for (const [id, h] of Object.entries(CUTS.relocate)) {
  const s = byIdCut.get(id); if (!s) throw new Error(`make_dam_projects: relocate names ${id}, which is not in the sites`);
  for (const k of HOST) s[k] = h[k];
}
const cutSites = cutSites0.filter(s => !(s.id in CUTS.merge));
{ const seen = new Set(); for (const s of cutSites) { if (seen.has(s.state)) throw new Error(`make_dam_projects: two projects in ${s.state} after the cuts`); seen.add(s.state); } }

// host state -> effects (the dam_agri_effects research; the optional low-confidence ones are left out)
const EFFECTS = {
  // Aswan Low (1902): 320,000 feddans between Cairo and Assiut from basin to perennial by 1907 (~+16% cropping)
  STATE_EGYPTIAN_DESERT: [{ state: 'STATE_MIDDLE_EGYPT', remove_trait: 'state_trait_pmr_basin_irrigation', arable: 8 }],
  // Sennar (1925): the Gezira scheme on rain-fed plain, 240,000 feddans at opening, ~1M feddans on Sennar
  STATE_BLUE_NILE: [{ state: 'STATE_BLUE_NILE', remove_trait: 'state_trait_pmr_rainfed_plain', arable: 12 }],
  // Grand Coulee: the Columbia Basin Project on shrub-steppe (272,000 ha, ~+9% of cropland)
  STATE_WASHINGTON: [{ state: 'STATE_WASHINGTON', arable: 15 }],
  // Sevan–Hrazdan: 80,000 ha of new irrigation on the Ararat plain (~+16%)
  STATE_ARMENIA: [{ state: 'STATE_ARMENIA', arable: 8 }],
  // Mingachevir: the Upper Karabakh and Upper Shirvan canals on semi-desert steppe
  STATE_ELIZAVETPOL: [{ state: 'STATE_ELIZAVETPOL', arable: 5 }, { state: 'STATE_AZERBAIJAN', arable: 4 }],
  // Kakhovka (the last Dnieper stage): irrigation of already-ploughed dry steppe — land a little, drought resilience
  STATE_TAURIDA: [{ state: 'STATE_TAURIDA', add_trait: 'state_trait_pmr_steppe_irrigation', arable: 5, stage: 'last' }],
  // TVA / Cumberland: flood control was the first statutory purpose; the reservoirs drowned bottomland
  STATE_TENNESSEE: [{ state: 'STATE_TENNESSEE', add_trait: 'state_trait_pmr_flood_control' }],
  STATE_ALABAMA: [{ state: 'STATE_ALABAMA', add_trait: 'state_trait_pmr_flood_control_minor' }],
  STATE_KENTUCKY: [{ state: 'STATE_KENTUCKY', add_trait: 'state_trait_pmr_flood_control_minor' }],
  // Hoover (All-American / Coachella canals) + Shasta: Coachella's 78,530 new acres; Imperial was already irrigated
  STATE_CALIFORNIA: [{ state: 'STATE_CALIFORNIA', arable: 5 }],
  // marginal: Warsak (>=119,000 acres), the Vakhsh headworks, the Snowy's Coleambally area
  STATE_PASHTUNISTAN: [{ state: 'STATE_PASHTUNISTAN', arable: 3 }],
  // (the Vakhsh headworks' STATE_TAJIKISTAN +3 left with the project, CUTS below)
  STATE_NEW_SOUTH_WALES: [{ state: 'STATE_NEW_SOUTH_WALES', arable: 1 }],
};

const byState = new Map(cutSites.map(s => [s.state, s]));
for (const host of Object.keys(EFFECTS)) if (!byState.has(host)) throw new Error(`make_dam_projects: effects keyed on ${host}, which has no project`);
const out = cutSites.map(s => ({
  id: s.id, state: s.state, state_name: s.state_name, name: s.name, anchor_province: s.anchor_province,
  owner_1836: s.owner_1836,
  rows: s.rows.map(r => ({ research_id: r.research_id, project: r.project, parts_taken: r.parts_taken, mw_per_part: r.mw_per_part,
    cost_multiplier: r.cost_multiplier, resource_type: r.resource_type, status: r.status })),
  ...(EFFECTS[s.state] ? { effects: EFFECTS[s.state] } : {}),
}));
const dst = join(REPO, 'config/dam_projects.json');
writeFileSync(dst, JSON.stringify({ _comment: 'GENERATED by tools/make_dam_projects.mjs from the 2026-09-26 placement research (config/dam_sites_research.json) minus the ruled cuts of 2026-09-27 - the hydro-dam projects, one per state (ROADMAP step 6, BALANCE_FRAMEWORK §10.89). Numbers derived from these rows live in tools/lib_dams.mjs.', projects: out }, null, 1) + '\n');
console.log(`dam_projects: ${out.length} projects, ${out.filter(p => p.effects).length} with non-power effects -> config/dam_projects.json`);
