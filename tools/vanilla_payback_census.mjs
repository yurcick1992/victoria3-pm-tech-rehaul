// VANILLA'S OWN PAYBACK PERIOD — the reference the mod's build-cost ladder should be anchored to.
// Read-only: it writes nothing.
//
//   node tools/vanilla_payback_census.mjs                 # vanilla recipes + vanilla costs, 8 markets
//   node tools/vanilla_payback_census.mjs --book mod      # ...the shipped mod book, same scenarios
//   node tools/vanilla_payback_census.mjs --detail        # ...plus the per-building-type table
//
// WHY. `solve_building_cost.ps1` picks a payback target out of the air (10 years) and the shipped economy
// delivers ~2. Neither number is a reference. The base game IS one: vanilla's 1836 start is a hand-tuned
// economy whose building costs and recipes were designed together, and the eight preset markets are that
// start measured. So this asks the only question that can settle P0 — what payback does the game we are
// modding actually run at?
//
// ⭐⭐ THE CONSTRUCTION POINT IS NOT £720 IN 1836. £720 is the IRON-FRAME method's goods bill per point,
// and iron frame needs `urban_planning` — nobody has it at the start. The 1836 world builds with
// `pm_wooden_buildings`: 25 fabric + 75 wood for 2 points = £1000/point at base prices. Every payback
// figure scales directly with this, so the whole census would read 28% low against £720. The rate is
// derived from the game files here, per method, and the 1836 default is the one used.
//
// WHAT IS MEASURED, per building present in a market:
//   payback = required_construction × £/point ÷ (52 × weekly profit at that market's realised prices)
// Profit is per LEVEL and wage-inclusive — the same `weeklyProfit` the balance sheet's Payback column
// uses, so this and the UI cannot disagree. `required_construction` is vanilla's own, read from
// common/buildings/*.txt through common/script_values/building_values.txt.
//
// ⚠ A BUILDING AT A LOSS HAS NO PAYBACK, and in vanilla 1836 a fair few are. They are reported as a
// count, never folded into a median as a large number — an infinity averaged in is a fabricated finding.
// ⚠ The CAPITAL-WEIGHTED aggregate is the robust reading: Σ(cost × levels) ÷ Σ(52 × profit × levels),
// i.e. how many years of the market's whole industrial profit would rebuild its whole capital stock. It
// needs no per-type distribution and it is what the ladder is really trying to set.
import { loadEcon } from './econ_host.mjs';
import { GAME, requiredConstruction, constructionMethods } from './vanilla_construction.mjs';

const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const BOOK = argOf('--book', 'vanilla');            // vanilla | mod
const DETAIL = argv.includes('--detail');
const { E, S, presets, config } = loadEcon({ quiet: true });
const P = S.PRICES;
const price = (g, real) => (P[g] || 0) * (real ? (S.thresholds[g] ?? 100) / 100 : 1);

// ---------------------------------------------------------------- vanilla construction data
// One implementation, shared with payback_census.mjs \u2014 see tools/vanilla_construction.mjs.
const RC = requiredConstruction(GAME);
const CPM = constructionMethods(GAME);
const pmPointCost = (pm, real) => {
  const c = CPM.find(x => x.pm === pm); if (!c || !c.pts) return NaN;
  return Object.entries(c.in).reduce((s, [g, q]) => s + q * price(g, real), 0) / c.pts;
};
const CONSTR_PM = argOf('--constr-pm', 'pm_wooden_buildings');   // the 1836 default; nothing else is unlocked

// ---------------------------------------------------------------- the recipe book
// Replicates ui/builder.html's vanillaBook(): each tier's own `vanilla_pm` recipe, with a tier we invented
// interpolated along the ×1.5 ladder from the nearest anchored one. Same rule build_era_ladder.mjs seeds
// an invented tier with, so the two agree by construction.
const LADDER_R = 1.5;
let interp = 0;
if (BOOK === 'vanilla') {
  for (const i of S.IND) {
    const anch = i.tiers.map((t, ix) => ({ t, ix, rec: t.vanilla_pm ? S.VAN.pms[t.vanilla_pm] : null })).filter(x => x.rec);
    if (!anch.length) continue;
    i.tiers.forEach((t, ix) => {
      const exact = anch.find(x => x.ix === ix);
      const src = exact || anch.reduce((b, x) => (Math.abs(x.ix - ix) < Math.abs(b.ix - ix) ? x : b), anch[0]);
      const gap = exact ? 0 : ix - src.ix; if (!exact) interp++;
      const f = Math.pow(LADDER_R, gap), rec = src.rec;
      const og = E.tierOut(i, src.t);
      t.output_qty = Math.round(((rec.out && rec.out[og] != null ? +rec.out[og] : +t.output_qty) * f) * 10) / 10;
      t.inputs = Object.fromEntries(Object.entries(rec.in || {}).map(([g, q]) => [g, Math.round(+q * f * 10) / 10]));
    });
  }
  Object.keys(S.REFEDIT).forEach(k => delete S.REFEDIT[k]);   // no pm_goods override IS vanilla
}

// tier key -> the vanilla base building it was split out of (tier 0's key IS that building)
const BASEOF = {}, INDOF = {};
for (const i of S.IND) for (const t of i.tiers) { BASEOF[t.key] = i.tiers[0].key; INDOF[t.key] = i.id; }
const costPoints = key => {
  if (BOOK === 'mod' && S.OURS.has(key)) {
    for (const i of S.IND) for (const t of i.tiers) if (t.key === key) return E.storedBuildCost(i, t);
  }
  return RC[S.OURS.has(key) ? BASEOF[key] : key];
};

// ---------------------------------------------------------------- classification
const CAT = b => {
  const g = (S.VAN.buildings[BASEOF[b] || b] || {}).group || '';
  if (/subsistence/.test(g)) return null;
  if (/^bg_(government|army|navy|police|construction|monuments|canals|urban_facilities|skyscraper)/.test(g)) return null;
  if (/^bg_(manor_houses|financial_districts|company_headquarters)/.test(g)) return null;
  if (/^bg_(light_industry|heavy_industry|military_industries|shipyards|munition_plants|arts)/.test(g)) return 'manufacturing';
  if (/^bg_(staple_crops|plantations|agriculture|ranching|fishing|whaling)/.test(g)) return 'agriculture';
  if (/^bg_(mining|gold_mining|coal_mining|logging|oil_extraction|rubber|sulfur_mining|lead_mining|iron_mining)/.test(g)) return 'extraction';
  if (/^bg_(private_infrastructure|power|trade)/.test(g)) return 'infrastructure';
  return 'other:' + g;
};

// ---------------------------------------------------------------- the census
const MK = ['gbr_1836', 'fra_1836', 'usa_1836', 'rus_1836', 'aus_1836', 'bel_1836', 'jap_1836', 'chi_1836'];
const q = (a, p) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const f1 = x => (Number.isFinite(x) ? x.toFixed(1) : '—');
const pad = (s, n) => String(s).padStart(n);
const M = x => (Math.abs(x) >= 1e6 ? (x / 1e6).toFixed(1) + 'M' : Math.round(x / 1e3) + 'k');

console.log(`RECIPE BOOK: ${BOOK}${BOOK === 'vanilla' ? ` (${interp} invented tiers interpolated)` : ''}`
  + `  ·  BUILD COST: ${BOOK === 'mod' ? 'the config, ours' : "vanilla's own required_construction"}`);
console.log('\n=== £ PER CONSTRUCTION POINT, at BASE prices — the method decides, and 1836 has one method ===');
for (const c of CPM) {
  if (!c.pts) continue;
  const bill = Object.entries(c.in).map(([g, v]) => `${v} ${g}`).join(' + ');
  console.log(`  ${c.pm.padEnd(26)} ${pad(c.pts, 2)} pts  £${pad(Math.round(pmPointCost(c.pm, false)), 5)}/pt   ${bill}`);
}
console.log(`  ⇒ using ${CONSTR_PM} (the 1836 default; every other method is tech-gated).`
  + `  The mod's model constant is £720 = iron frame.`);

console.log('\n=== VANILLA 1836 PAYBACK, per market, at that market\'s own realised prices ===');
console.log('market   £/pt   buildings  loss-making      payback p25 / MEDIAN / p75      CAPITAL-WEIGHTED');
const all = {}, perType = {};
for (const id of MK) {
  const p = presets.find(x => x.id === id); if (!p) { console.log(`${id}: absent`); continue; }
  E.applyPreset(p); E.syncPricesFromOrders();
  const ppp = pmPointCost(CONSTR_PM, true);
  const rows = [];
  for (const i of S.IND) for (const t of i.tiers) {
    const n = S.BLDNUM[t.key] || 0; if (!n) continue;
    const cat = CAT(t.key); if (!cat || cat.startsWith('other')) continue;
    rows.push({ key: t.key, label: `${i.id} ${t.key}`, cat, n, prof: E.weeklyProfit(i, t), pts: costPoints(t.key) });
  }
  for (const b of E.refBuildings()) {
    const n = S.BLDNUM[b] || 0; if (!n) continue;
    const cat = CAT(b); if (!cat || cat.startsWith('other')) continue;
    const r = E.refEcon(b); if (r.p == null) continue;
    rows.push({ key: b, label: b, cat, n, prof: r.p, pts: costPoints(b) });
  }
  const use = rows.filter(r => Number.isFinite(r.pts) && r.pts > 0);
  for (const r of use) { r.cap = r.pts * ppp; r.pb = r.prof > 0 ? r.cap / (52 * r.prof) : Infinity; }
  const ok = use.filter(r => Number.isFinite(r.pb));
  const K = use.reduce((s, r) => s + r.cap * r.n, 0);
  const PR = use.reduce((s, r) => s + r.prof * r.n, 0);
  console.log(`${id.slice(0, 3).toUpperCase()}      ${pad(Math.round(ppp), 5)}  ${pad(use.length, 8)}  ${pad(`${use.length - ok.length}/${use.length}`, 10)}     `
    + `${pad(`${f1(q(ok.map(r => r.pb), .25))} / ${f1(q(ok.map(r => r.pb), .5))} / ${f1(q(ok.map(r => r.pb), .75))}`, 24)}   `
    + `${pad(f1(PR > 0 ? K / (52 * PR) : Infinity) + ' y', 10)}   (K £${M(K)}, profit £${M(PR)}/wk)`);
  all[id] = { rows: use, ppp, K, PR };
  for (const r of use) (perType[r.key] ??= { cat: r.cat, label: r.label, pb: [], mg: [] }).pb.push(r.pb);
}

console.log('\n=== BY SECTOR — median payback over (building type × market), losses counted separately ===');
console.log('sector            types   loss-making      p25 / MEDIAN / p75      capital-weighted (all 8 markets)');
for (const c of ['manufacturing', 'agriculture', 'extraction', 'infrastructure']) {
  const pbs = [], seen = new Set(); let K = 0, PR = 0, bad = 0, tot = 0;
  for (const id of MK) for (const r of (all[id]?.rows || [])) {
    if (r.cat !== c) continue; seen.add(r.key); tot++;
    if (Number.isFinite(r.pb)) pbs.push(r.pb); else bad++;
    K += r.cap * r.n; PR += r.prof * r.n;
  }
  if (!tot) continue;
  console.log(`${c.padEnd(17)} ${pad(seen.size, 5)}   ${pad(`${bad}/${tot}`, 10)}     `
    + `${pad(`${f1(q(pbs, .25))} / ${f1(q(pbs, .5))} / ${f1(q(pbs, .75))}`, 22)}   ${pad(f1(PR > 0 ? K / (52 * PR) : Infinity) + ' y', 18)}`);
}
{
  let K = 0, PR = 0, pbs = [];
  for (const id of MK) for (const r of (all[id]?.rows || [])) { K += r.cap * r.n; PR += r.prof * r.n; if (Number.isFinite(r.pb)) pbs.push(r.pb); }
  console.log(`${'ALL'.padEnd(17)} ${pad('', 5)}   ${pad('', 10)}     ${pad(`${f1(q(pbs, .25))} / ${f1(q(pbs, .5))} / ${f1(q(pbs, .75))}`, 22)}   ${pad(f1(K / (52 * PR)) + ' y', 18)}`);
}

if (!DETAIL) { console.log('\n(pass --detail for the per-building-type table)'); process.exit(0); }
console.log('\n=== PER BUILDING TYPE — median payback across the markets that contain it ===');
console.log('sector           building                                    mkts   min /  MEDIAN /  max');
for (const c of ['manufacturing', 'agriculture', 'extraction', 'infrastructure']) {
  const ent = Object.entries(perType).filter(([, v]) => v.cat === c)
    .map(([k, v]) => ({ k, v, med: q(v.pb.filter(Number.isFinite), .5), inf: v.pb.filter(x => !Number.isFinite(x)).length }))
    .sort((a, b) => (a.med || 1e9) - (b.med || 1e9));
  for (const e of ent) {
    const fin = e.v.pb.filter(Number.isFinite);
    console.log(`${c.padEnd(16)} ${e.k.replace(/^building_/, '').padEnd(42)} ${pad(e.v.pb.length, 4)}  `
      + `${pad(f1(Math.min(...fin)), 5)} / ${pad(f1(e.med), 7)} / ${pad(f1(Math.max(...fin)), 5)}`
      + (e.inf ? `   (${e.inf} at a loss)` : ''));
  }
}
