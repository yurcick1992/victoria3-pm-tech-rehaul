// WHERE DID THE CONSTRUCTION ACTUALLY GO? — the OVERSHOOT check for the ai_value ladder.
//
// analyse_ai_tier_choice.mjs asks a WITHIN-industry question: of the levels a country built in
// industry X, what share went below the best rung it held? A ladder that raises the desire of high
// tiers can improve that number and still be a failure, in two ways it cannot see:
//
//   (a) BETWEEN INDUSTRIES. Tier-4 automotive at ai_value 2500 outbids tier-2 textile at 1500, so
//       the construction budget drains out of whole chains rather than climbing each chain's rungs.
//   (b) OUT OF THE UNTIERED SECTOR ENTIRELY. Extraction, agriculture, ranching and fishing carry NO
//       ai_value change at all (user ruling: untiered buildings are not touched), so every one of
//       them now competes against manufacturing rungs worth up to 3000 where before the field was
//       flat at 1000. Starving the raw sector would show up in the tier-choice metric as a WIN.
//
// So this reads the same yearly save summaries and asks: of every building LEVEL added anywhere in
// the world, what share went to each sector, each industry, and each era — and how did that split
// move between two arms?
//
// UNITS: levels ADDED between consecutive yearly summaries, never standing levels. A construction
// decision is a level decision, and a standing count confounds building with inheriting.
// ⚠ ANNEXATION: country-years whose total levels move more than +25% in one year are excluded, the
// same rule and the same reason as the tier-choice analysis — a transferred factory is not a
// decision. Excluded counts are reported.
// ⚠ Levels REMOVED are ignored, not netted. Demolition is a different decision from construction and
// netting them makes a shrinking industry indistinguishable from an unbuilt one.
// ⚠ PORTS ARE GRADED (workforce_mult 0.1/0.2), so a port "level" is a tenth or a fifth of a building.
// Every table is reported BOTH raw and unit-weighted, and the two are labelled — a ladder that looks
// like it moved infrastructure may only have moved the unit.
//
// BOTH ABSOLUTE AND NORMALIZED, always, per the repo convention: a share that rises because its own
// numerator grew and a share that rises because everything else collapsed are different results, and
// only the absolute column tells them apart.
//
// USAGE
//   node tools/testbed/ledger/analyse_build_allocation.mjs --session <stamp> [--config <path>]
//   node tools/testbed/ledger/analyse_build_allocation.mjs --a <stampA> --b <stampB> \
//        [--config-a <path>] [--config-b <path>]        # A is the BASELINE, B the arm under test
//   optional: --json <out>   --runs <n>   --game <dir>

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { usableRuns, reportDropped } from './lib_runs.mjs';

const ARGV = process.argv.slice(2);
const argOf = (n, d) => { const i = ARGV.indexOf(n); return i >= 0 && ARGV[i + 1] ? ARGV[i + 1] : d; };
const SES = 'tools/testbed/sessions';
const GAME = argOf('--game', process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game');
const ANNEX_JUMP = 1.25;
const RUNCAP = +argOf('--runs', '99');

// ---------------------------------------------------------------- vanilla building groups ----
// ⚠ THE BOM. Every vanilla script file starts with a UTF-8 BOM, so a naive /^building_x = {/m misses
// the FIRST block of every file — the same trap verify_pms.mjs documents for production methods, and
// it silently loses building_coal_mine and building_logging_camp, two of the raw industries this
// analysis is entirely about. Strip it.
function readGroups(dir) {
  const out = {};
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter(x => /\.txt$/i.test(x))) {
    const txt = readFileSync(join(dir, f), 'utf8').replace(/^\uFEFF/, '');
    const re = /^(building_[a-z0-9_]+)\s*=\s*\{/gm; let m; const st = [];
    while ((m = re.exec(txt))) st.push([m[1], m.index]);
    for (let i = 0; i < st.length; i++) {
      const body = txt.slice(st[i][1], i + 1 < st.length ? st[i + 1][1] : txt.length);
      const g = body.match(/building_group\s*=\s*(\S+)/);
      if (g) out[st[i][0]] = g[1];
    }
  }
  return out;
}
// Vanilla first, then OUR emitted buildings layered over it. The second layer is what sectors the
// all-new chains that have no vanilla anchor at all — shipyard_steam's base is building_shipyard_metal,
// which vanilla has never heard of, so without this its whole 992 levels land in "other" and the
// manufacturing sector is understated by exactly one industry. `building_group` is STRUCTURAL, so the
// canonical mod/ answers for any arm; the ai_value ladder cannot change it.
const VGROUP = { ...readGroups(join(GAME, 'common/buildings')), ...readGroups('mod/common/buildings') };

// group -> sector. Every group seen in a summary is mapped explicitly; an unmapped one is REPORTED
// by name rather than swept into "other", because a silently mis-sectored group is exactly how this
// analysis would lie about the thing it exists to measure.
const SECTOR = {
  bg_mining: 'extraction', bg_gold_fields: 'extraction', bg_oil_extraction: 'extraction',
  bg_logging: 'extraction', bg_rubber: 'extraction',
  bg_agriculture: 'agriculture', bg_staple_crops: 'agriculture', bg_plantations: 'agriculture',
  bg_ranching: 'agriculture', bg_fishing: 'agriculture', bg_whaling: 'agriculture',
  bg_light_industry: 'manufacturing', bg_heavy_industry: 'manufacturing',
  bg_military_industry: 'manufacturing', bg_ship_construction: 'manufacturing',
  bg_private_infrastructure: 'infrastructure', bg_power: 'infrastructure',
  bg_arts: 'arts',
  bg_subsistence_agriculture: 'subsistence', bg_subsistence_ranching: 'subsistence',
  bg_subsistence_mining: 'subsistence', bg_subsistence_fishing: 'subsistence',
  bg_army: 'military', bg_conscription: 'military', bg_army_logistics_center: 'military',
  bg_naval_administration: 'military', bg_naval_fortification: 'military',
  bg_naval_logistics_center: 'military',
  bg_bureaucracy: 'state', bg_technology: 'state', bg_construction: 'state',
  bg_service: 'urban', bg_trade: 'urban', bg_skyscraper: 'urban',
  bg_manor_houses: 'ownership', bg_financial_districts: 'ownership',
  bg_monuments: 'monument', bg_monuments_hidden: 'monument', bg_canals: 'monument',
};
const SECTOR_ORDER = ['extraction', 'agriculture', 'manufacturing', 'infrastructure', 'arts',
  'urban', 'state', 'military', 'ownership', 'subsistence', 'monument', 'company', 'other'];

// ---------------------------------------------------------------- the ladder, per arm ----
function ladderOf(cfgPath) {
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
  const key2 = {};          // building key -> {ind, idx, era, wm, base}
  const chain = {};         // industry -> ordered tiers
  for (const ind of cfg.industries || []) {
    const ts = (ind.tiers || []).map((t, i) => ({
      key: t.key, idx: i, era: t.era ?? 0, wm: +(t.workforce_mult ?? 1),
    })).filter(t => t.key);
    if (!ts.length) continue;
    chain[ind.id] = ts;
    // tier 1's key IS the vanilla base building, which is what carries the vanilla group
    for (const t of ts) key2[t.key] = { ind: ind.id, idx: t.idx, era: t.era, wm: t.wm, base: ts[0].key };
  }
  return { key2, chain };
}

function classify(key, lad) {
  const t = lad.key2[key];
  if (t) {
    const g = VGROUP[key] || VGROUP[t.base];
    return { sector: SECTOR[g] || 'other', ind: t.ind, era: t.era, wm: t.wm, group: g || `(no group for ${t.ind})` };
  }
  if (/^building_(regional_)?company_/.test(key)) return { sector: 'company', ind: null, era: null, wm: 1, group: 'company' };
  const g = VGROUP[key];
  return { sector: g ? (SECTOR[g] || 'other') : 'other', ind: null, era: null, wm: 1, group: g || '(unknown)' };
}

// ---------------------------------------------------------------- sweep one arm ----
function sweep(spec, cfgPath) {
  const i = spec.indexOf(':');
  const session = i < 0 ? spec : spec.slice(0, i), setup = i < 0 ? '' : spec.slice(i + 1);
  const { runs: usable, dropped } = usableRuns(SES, session, setup);
  const runs = usable.slice(0, RUNCAP);
  if (!runs.length) throw new Error(`no usable runs under ${join(SES, spec)}`);
  const lad = ladderOf(cfgPath);
  const A = {
    session: spec, cfgPath, runs: runs.length, dropped,
    sector: {}, sectorU: {}, ind: {}, indU: {}, era: {}, eraU: {},
    indEra: {},                      // industry -> era -> levels
    total: 0, totalU: 0, annexSkipped: 0, years: 0,
    unmappedGroups: {},              // group -> levels, so nothing is silently swept into "other"
    ladderEras: Object.fromEntries(Object.entries(lad.chain).map(([id, ts]) => [id, [...new Set(ts.map(t => t.era))].sort((a, b) => a - b)])),
  };
  const bump = (o, k, v) => { o[k] = (o[k] || 0) + v; };
  for (const run of runs) {
    const dir = join(SES, run, 'save_summaries');
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort();
    let prev = null;
    for (const f of files) {
      let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, f)))); } catch { continue; }
      const cur = {};
      for (const [tag, c] of Object.entries(j.countries)) {
        const lv = {}; let total = 0;
        for (const [k, b] of Object.entries(c.buildings || {})) { lv[k] = b.levels || 0; total += b.levels || 0; }
        cur[tag] = { lv, total };
      }
      if (prev) {
        A.years++;
        for (const [tag, now] of Object.entries(cur)) {
          const was = prev[tag]; if (!was) continue;
          if (was.total > 0 && now.total / was.total > ANNEX_JUMP) { A.annexSkipped++; continue; }
          for (const [k, n] of Object.entries(now.lv)) {
            const add = n - (was.lv[k] || 0);
            if (add <= 0) continue;                     // construction only; demolition is not netted
            const c = classify(k, lad);
            const u = add * c.wm;
            A.total += add; A.totalU += u;
            bump(A.sector, c.sector, add); bump(A.sectorU, c.sector, u);
            if (c.sector === 'other') bump(A.unmappedGroups, `${c.group} (${k})`, add);
            if (c.ind) {
              bump(A.ind, c.ind, add); bump(A.indU, c.ind, u);
              bump(A.era, c.era, add); bump(A.eraU, c.era, u);
              bump(A.indEra[c.ind] ||= {}, c.era, add);
            }
          }
        }
      }
      prev = cur;
    }
  }
  return A;
}

// ---------------------------------------------------------------- report ----
const pct = (a, b) => b ? (100 * a / b).toFixed(2) + '%' : '—';
const num = n => Math.round(n).toLocaleString();
const dpp = (x, y) => { const d = y - x; return (d >= 0 ? '+' : '') + d.toFixed(2) + 'pp'; };
const dx = (x, y) => !x ? '—' : (y / x).toFixed(2) + '×';
// ⚠⚠ EVERY ABSOLUTE IS PER RUN, not pooled. The two arms rarely have the same n — a 1-run arm
// against a 6-run baseline made every B/A ratio read 0.16x, i.e. 1/6, and lit up the
// "risk of disappearing" list with all 22 industries. Shares are n-invariant and need no such
// correction, which is exactly why the share column looked sane while the absolute one did not.
const perRun = (v, A) => v / (A.runs || 1);

function header(A) {
  console.log(`  session ${A.session}`);
  console.log(`  ladder  ${A.cfgPath}`);
  console.log(`  runs ${A.runs} · year-transitions ${A.years.toLocaleString()} · levels built ${num(A.total)} (unit-weighted ${num(A.totalU)}) · ${A.annexSkipped.toLocaleString()} annexation-scale country-years excluded`);
  const um = Object.entries(A.unmappedGroups).sort((a, b) => b[1] - a[1]);
  if (um.length) {
    console.log(`  ⚠ ${um.length} UNMAPPED building group(s) counted as "other" — map them in SECTOR before trusting the sector table:`);
    for (const [g, v] of um.slice(0, 10)) console.log(`      ${g}  ${num(v)} levels`);
  }
}

function single(A) {
  console.log('\n=== WHERE CONSTRUCTION WENT ===');
  header(A);
  console.log('\n--- by sector (raw levels | unit-weighted) ---');
  console.log('  sector             levels     share      unit-wt    share');
  for (const s of SECTOR_ORDER) {
    if (!A.sector[s] && !A.sectorU[s]) continue;
    console.log(`  ${s.padEnd(15)} ${num(A.sector[s] || 0).padStart(9)}  ${pct(A.sector[s] || 0, A.total).padStart(7)}   ${num(A.sectorU[s] || 0).padStart(9)}  ${pct(A.sectorU[s] || 0, A.totalU).padStart(7)}`);
  }
  const tierTot = Object.values(A.ind).reduce((a, b) => a + b, 0);
  console.log(`\n--- by OUR industry (${num(tierTot)} levels, shares within the tiered sector) ---`);
  for (const [k, v] of Object.entries(A.ind).sort((a, b) => b[1] - a[1]))
    console.log(`  ${k.padEnd(16)} ${num(v).padStart(9)}  ${pct(v, tierTot).padStart(7)}`);
  console.log('\n--- by ERA of the rung built (within the tiered sector) ---');
  for (const e of Object.keys(A.era).sort())
    console.log(`  e${e}  ${num(A.era[e]).padStart(9)}  ${pct(A.era[e], tierTot).padStart(7)}`);
}

function compare(A, B) {
  console.log('\n================ ALLOCATION: A (baseline) vs B (arm under test) ================');
  console.log('A:'); header(A);
  console.log('B:'); header(B);

  console.log('\n--- SECTOR SHARE OF ALL LEVELS BUILT ---');
  console.log('  ⭐ THE OVERSHOOT TEST. Extraction and agriculture carry NO ai_value change, so a fall in');
  console.log('     their SHARE that is also a fall in their ABSOLUTE level count is the raw sector being');
  console.log('     starved. A fall in share with flat absolute is just manufacturing growing.');
  console.log('  sector            A lv/run  A share    B lv/run  B share     Δshare    B/A abs');
  for (const s of SECTOR_ORDER) {
    const a = perRun(A.sector[s] || 0, A), b = perRun(B.sector[s] || 0, B);
    if (!a && !b) continue;
    const as = A.total ? 100 * (A.sector[s] || 0) / A.total : 0, bs = B.total ? 100 * (B.sector[s] || 0) / B.total : 0;
    console.log(`  ${s.padEnd(14)} ${num(a).padStart(10)}  ${as.toFixed(2).padStart(6)}%  ${num(b).padStart(10)}  ${bs.toFixed(2).padStart(6)}%   ${dpp(as, bs).padStart(9)}   ${dx(a, b).padStart(7)}`);
  }

  const aT = Object.values(A.ind).reduce((x, y) => x + y, 0);
  const bT = Object.values(B.ind).reduce((x, y) => x + y, 0);
  console.log('\n--- ERA MIX OF TIERED CONSTRUCTION (the ladder\'s own target) ---');
  console.log('  era      A lv/run  A share    B lv/run  B share     Δshare    B/A abs');
  for (const e of [...new Set([...Object.keys(A.era), ...Object.keys(B.era)])].sort()) {
    const a = perRun(A.era[e] || 0, A), b = perRun(B.era[e] || 0, B);
    const as = aT ? 100 * (A.era[e] || 0) / aT : 0, bs = bT ? 100 * (B.era[e] || 0) / bT : 0;
    console.log(`  e${e}    ${num(a).padStart(10)}  ${as.toFixed(2).padStart(6)}%  ${num(b).padStart(10)}  ${bs.toFixed(2).padStart(6)}%   ${dpp(as, bs).padStart(9)}   ${dx(a, b).padStart(7)}`);
  }

  console.log('\n--- PER-INDUSTRY REALLOCATION (share of the tiered sector), biggest movers first ---');
  console.log('  ⚠ A big NEGATIVE Δshare with B/A abs well under 1.00 is an industry being outbid, which');
  console.log('     is the (a) half of the overshoot: the ladder moved the budget between chains, not up them.');
  console.log('  industry         A lv/run  A share    B lv/run  B share     Δshare    B/A abs');
  const inds = [...new Set([...Object.keys(A.ind), ...Object.keys(B.ind)])];
  const rows = inds.map(k => {
    const a = perRun(A.ind[k] || 0, A), b = perRun(B.ind[k] || 0, B);
    return { k, a, b, as: aT ? 100 * (A.ind[k] || 0) / aT : 0, bs: bT ? 100 * (B.ind[k] || 0) / bT : 0 };
  }).sort((x, y) => Math.abs(y.bs - y.as) - Math.abs(x.bs - x.as));
  for (const r of rows)
    console.log(`  ${r.k.padEnd(15)} ${num(r.a).padStart(9)}  ${r.as.toFixed(2).padStart(6)}%  ${num(r.b).padStart(9)}  ${r.bs.toFixed(2).padStart(6)}%   ${dpp(r.as, r.bs).padStart(9)}   ${dx(r.a, r.b).padStart(7)}`);

  console.log('\n--- INDUSTRIES AT RISK OF DISAPPEARING (B/A absolute under 0.60) ---');
  const dying = rows.filter(r => r.a >= 200 && r.a && r.b / r.a < 0.60);
  if (!dying.length) console.log('  none — every industry the baseline built is still being built at >=60% of its rate');
  console.log('');
  console.log('--- PER-INDUSTRY ERA MIX: did each chain climb its OWN ladder? ---');
  // ⚠⚠ THE WINDOW COMES FROM THE LADDER, NOT FROM THE DATA. An earlier version took the top two
  // eras PRESENT IN EACH ARM, which silently shifts the window down whenever an arm built none of
  // the top rung — and then reports the shift as a gain. It produced power 30.7% -> 100.0%
  // (+69pp) on an industry that carries NO ai_value change at all: the baseline had {e3,e4,e5} and
  // the arm {e3,e4}, so 'top two' meant e5+e4 on one side and e4+e3 on the other. fertilizer
  // (+33pp) and electrics (+20pp) were the same artifact. The window is now the industry's own top
  // two ERA VALUES from the config, identical for both arms, so an absent top rung reads as 0 —
  // which is the true statement.
  console.log('  (share of that industry\'s construction going to the top two eras OF ITS LADDER)');
  console.log('  industry            eras       A top2    B top2     Δ');
  for (const k of inds.sort()) {
    const eras = A.ladderEras[k] || B.ladderEras[k] || [];
    if (eras.length < 2) continue;
    const win = eras.slice(-2);
    const sh = (m) => {
      const e = m[k] || {};
      const tot = Object.values(e).reduce((x, y) => x + y, 0);
      if (!tot) return null;
      return 100 * win.reduce((s2, x) => s2 + (e[x] || 0), 0) / tot;
    };
    const a = sh(A.indEra), b = sh(B.indEra);
    if (a == null || b == null) continue;
    console.log(`  ${k.padEnd(18)} e${win.join('+e').padEnd(8)} ${a.toFixed(1).padStart(6)}%   ${b.toFixed(1).padStart(6)}%   ${dpp(a, b).padStart(9)}`);
  }
}

// ---------------------------------------------------------------- main ----
const a = argOf('--a', ''), b = argOf('--b', '');
if (a && b) {
  const A = sweep(a, argOf('--config-a', a === '20260818_221216_canon-n7' ? 'config/mod_config.canon_n7.json' : 'config/mod_config.json'));
  const B = sweep(b, argOf('--config-b', 'config/mod_config.json'));
  reportDropped(A.dropped); reportDropped(B.dropped);
  compare(A, B);
  if (argOf('--json', '')) writeFileSync(argOf('--json', ''), JSON.stringify({ A, B }, null, 2));
} else {
  const s = argOf('--session', '20260818_221216_canon-n7');
  const A = sweep(s, argOf('--config', s === '20260818_221216_canon-n7' ? 'config/mod_config.canon_n7.json' : 'config/mod_config.json'));
  reportDropped(A.dropped);
  single(A);
  if (argOf('--json', '')) writeFileSync(argOf('--json', ''), JSON.stringify(A, null, 2));
}
