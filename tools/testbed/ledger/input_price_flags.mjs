// INPUT-PRICE RED FLAGS — is any industrially consumed good priced where it throttles its consumers, in a major market?
// User-ruled 2026-10-03 (BALANCE_FRAMEWORK §10.94, FINDINGS F212): "Prolonged (2–3 years plus) price of +70% and higher for any industrially
// consumed good, or wide oscillations on tiny volumes all count as red flags", and the swing re-ruled the same day: ">= 0.5 base price swings
// within 3 years on under 10 units of supply a week is a flag" — "shortages in disguise", where the volume is too low to hold a stable high price
// but the market conditions are the same: producers cannot produce even at a significant shortage. LOCAL goods (electricity, transportation,
// services) are gathered but EXCLUDED from the flags (the same ruling). Not a loss term; the standardized report carries the flags as prose,
// highlighted inline in its verdict (`--html`), and every probe readout prints them (`--md`).
// The engine's own line: GOODS_SHORTAGE_PENALTY_THRESHOLD 0.5 (common/defines) — at sell/buy < 0.5 the price is pinned at 175% of base and every
// consumer takes an output penalty; +70% is sell/buy ≈ 0.52.
//
//   HIGH   the price ≥ --high (1.70) × base at EVERY reading of a stretch spanning ≥ --years (2) years, readings ≤ --gap (1.1) years apart
//   SWING  inside --window (3) years the price ranges ≥ --swing (0.5) × base while SUPPLY is under --supply (10) units a week (the window's median)
// Per major market (the eleven telemetry tags' markets: British, American, French, Dutch, Belgian, German, Russian, Japanese) and good. Two sources:
//   market   the telemetry's order books — G lines (markets.tsv, the schedule's dump dates) and GW lines (metric `market_goods_wide`, read from
//            logs_live/debug.log[.gz] by the run's token). SUPPLY = sell orders. Every schedule logs GW yearly since 2026-10-03 (run_schedule.ps1
//            injects it); earlier batches have only the decadal dump dates, which resolve nothing — the reader says so.
//   summary  save summaries (yearly or quarterly): the countries sharing the tagged member's `market` id, summed — SUPPLY = their production
//            (goods_out), DEMAND = their buildings' consumption (goods_in), the PRICE = the market's single-output producers' goods_sales ÷ va_out
//            (v9+). ⚠ No price where the market makes none of the good (imports, or a good missing entirely): the market source sees those.
//   Per run the PRIMARY source is `market` when the run carries yearly GW lines, else `summary`; `--source` forces one, `both` prints both.
//   node tools/testbed/ledger/input_price_flags.mjs <label>=<session>[,<session>][:<setup>] [...] [--source auto|market|summary|both]
//        [--high 1.70] [--years 2] [--gap 1.1] [--swing 0.5] [--window 3] [--supply 10] [--yearly] [--from Y] [--until Y] [--list 40]
//        [--json <file>] [--html <file>] [--md] [--ref <label>=<session>[,<session>][:<setup>]]…
//   ⭐ The report shows NOT this listing but redflag_metrics.mjs's headline (problem market-years, chronic markets) and a 3–15-sentence summary
//   (user-ruled 2026-10-08: the listing "is at least 100 times too large to be readable"); fill_ledger.sh writes `--html` to redflags_full.html,
//   which is kept beside the report, and `--json` to redflags.json, which redflag_metrics.mjs reads.
//   --ref names a REFERENCE arm (the eleven-tag vanilla set, say): read the same way, reported in the prose as one line of counts per run and the
//   goods it flags, so a book's flags can be told from the game's own.
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { usableRuns, reportDropped } from './lib_runs.mjs';
import { SESSIONS, indexRun, readSum } from './lib_sumidx.mjs';
import { seriesOf } from './lib_markets.mjs';
import { goodsTable, tradedQuantity } from './lib_goods.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : d; };
const flag = k => { const i = argv.indexOf(k); if (i >= 0) { argv.splice(i, 1); return true; } return false; };
const SOURCE = opt('--source', 'auto'), HIGH = +opt('--high', 1.70), YEARS = +opt('--years', 2), GAP = +opt('--gap', 1.1);
const SWING = +opt('--swing', 0.5), WINDOW = +opt('--window', 3), SUPPLY = +opt('--supply', 10), LIST = +opt('--list', 40);
const UNTIL = +opt('--until', 9999), FROM = +opt('--from', 0);
const REFS = []; for (let i; (i = argv.indexOf('--ref')) >= 0;) REFS.push(argv.splice(i, 2)[1]);
const JSON_OUT = opt('--json', ''), HTML_OUT = opt('--html', ''); const MD = flag('--md'), YEARLY = flag('--yearly');
if (!argv.length) { console.error('usage: input_price_flags.mjs <label>=<session>[,<session>][:<setup>] [...] [--source auto|market|summary|both] …'); process.exit(1); }
if (!['auto', 'market', 'summary', 'producer', 'both'].includes(SOURCE)) { console.error('--source auto|market|summary|both'); process.exit(1); }
const G = goodsTable();
const LOCAL = new Set(Object.entries(G).filter(([, v]) => v.local).map(([g]) => g));          // electricity, transportation, services
const RAW_IN = ['coal', 'iron', 'lead', 'sulfur', 'oil', 'rubber', 'dye', 'silk', 'fabric', 'wood', 'hardwood', 'fish', 'grain'];
const TIER_GOODS = ['steel', 'tools', 'engines', 'paper', 'fertilizer', 'explosives', 'glass'];
const MAJOR = ['British Market', 'American Market', 'French Market', 'Dutch Market', 'Belgian Market', 'German Market', 'Russian Market', 'Japanese Market'];
// the tagged member whose `market` id names a major market in the summaries; a state with several tags lists its live main tag first
const TAG_SERIES = [['GBR', 'British Market'], ['USA', 'American Market'], ['FRA', 'French Market'], ['UNL', 'Dutch Market'], ['NET', 'Dutch Market'],
  ['BEL', 'Belgian Market'], ['GER', 'German Market'], ['NGF', 'German Market'], ['PRU', 'German Market'], ['RUS', 'Russian Market'], ['JAP', 'Japanese Market']];
// ---- the game's own production data, read live and parsed by BRACE DEPTH: vanilla closes some blocks on an indented brace (building_iron_mine
// and building_lead_mine in 03_mines.txt end on " }"), so a column-0 parser merges a block into its neighbour — the first cut of the producer
// map below lost the lead and sulfur mines that way
const GAME_COMMON = 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game/common';
function topBlocks(file) {                                      // [[key, body]] of every top-level `key = { … }`; comments and strings respected
  const t = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').replace(/"[^"\n]*"|#[^\n]*/g, s => s[0] === '"' ? s : '');
  const out = [], re = /([A-Za-z_0-9\-.:@]+)\s*=\s*\{|\{|\}/g; let m, depth = 0, key = null, start = 0;
  while ((m = re.exec(t))) {
    if (m[0] === '}') { if (--depth === 0 && key) { out.push([key, t.slice(start, m.index)]); key = null; } }
    else { if (depth === 0 && m[1]) { key = m[1]; start = re.lastIndex; } depth++; }
  }
  return out;
}
const gameFiles = dir => fs.readdirSync(`${GAME_COMMON}/${dir}`).filter(f => f.endsWith('.txt')).map(f => [f, `${GAME_COMMON}/${dir}/${f}`]);
const goodsIn = (body, io) => [...body.matchAll(new RegExp(`goods_${io}_([a-z_]+)_add\\s*=\\s*([\\d.]+)`, 'g'))].filter(x => +x[2] > 0).map(x => x[1]);
const PM_IN = new Map(), PM_OUT = new Map(), PM_FILE = new Map();          // pm → [goods it consumes], [goods it makes], its file
for (const [f, p] of gameFiles('production_methods')) for (const [pm, body] of topBlocks(p)) {
  PM_FILE.set(pm, f); PM_IN.set(pm, goodsIn(body, 'input')); PM_OUT.set(pm, goodsIn(body, 'output')); }
const PMG = new Map();                                                       // pmg → [pm]
for (const [, p] of gameFiles('production_method_groups')) for (const [g, body] of topBlocks(p)) {
  const pl = /production_methods\s*=\s*\{([^}]*)\}/.exec(body); if (pl) PMG.set(g, pl[1].trim().split(/\s+/).filter(Boolean)); }
// THE PRODUCERS WHOSE REALISED PRICE IS READ (the summary source): every game building whose FIRST production-method group outputs exactly one
// good, plus every rung of the run's own book. ⚠ Until 2026-10-03 this was a hand list of raw producers and the tiered goods came from the book
// ALONE, so a CONTROL run (no book) priced no steel, tools, engines, paper, fertilizer, explosives or glass and could raise no flag on them —
// vanilla's "zero explosives flags" was that gap, not vanilla (its lone American explosives factory swings the same way).
// A building's secondaries can add other outputs (glassworks' porcelain): its goods_sales ÷ va_out is then a value-weighted blend of the two prices.
const VANILLA_PRODUCER = {};
for (const [, p] of gameFiles('buildings')) for (const [b, body] of topBlocks(p)) {
  if (!b.startsWith('building_')) continue;
  const gl = /production_method_groups\s*=\s*\{\s*([a-z_0-9\-]+)/.exec(body); if (!gl) continue;
  const goods = new Set((PMG.get(gl[1]) || []).flatMap(pm => PM_OUT.get(pm) || []));
  if (goods.size === 1) VANILLA_PRODUCER[b] = [...goods][0];
}
for (const [ty, g] of [['building_coal_mine', 'coal'], ['building_iron_mine', 'iron'], ['building_lead_mine', 'lead'], ['building_sulfur_mine', 'sulfur'],
  ['building_steel_mill', 'steel'], ['building_explosives_factory', 'explosives'], ['building_tooling_workshop', 'tools']])
  if (VANILLA_PRODUCER[ty] !== g) throw new Error(`the game's producer of ${g} is not ${ty} — the buildings / production-method layout moved (ON_GAME_UPDATE)`);
const yr = d => { const [y, m = 1, dd = 1] = String(d).split('.').map(Number); return y + (m - 1) / 12 + (dd - 1) / 365; };
const fmtY = t => { const y = Math.floor(t + 1e-6), m = Math.round((t - y) * 12) + 1; return m > 1 ? `${y}.${m}` : `${y}`; };
const med = v => { const s = v.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };
const r1 = x => Number.isFinite(x) ? Math.round(x * 10) / 10 : null, r2 = x => Number.isFinite(x) ? Math.round(x * 100) / 100 : null;

function bookOf(runDir) {
  const bs = JSON.parse(fs.readFileSync(path.join(runDir, 'build_state.json'), 'utf8').replace(/^﻿/, ''));
  const p = bs.deterministic?.mod_under_test?.built_from_config;
  return p && fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, '')) : null;
}
// ⭐ "ANY GOOD THAT IS CONSUMED BY ANY INDUSTRY" (the user, 2026-10-03): every good some production method of an industry consumes — read LIVE from
// the game's production_methods files (every file but the military, government, monument, canal, subsistence and company-HQ ones) — plus every input
// of the run's own book's rungs, LOCAL goods excluded by the same ruling.
const NOT_INDUSTRY = /^(00_dummy|05_military|07_government|08_monuments|10_canals|12_subsistence|14_companies)\.txt$/;
const PM_INPUTS = new Map(), INDUSTRY_GOODS = new Set();       // vanilla pm → [goods it consumes]; the goods any industry pm consumes
for (const [pm, gs] of PM_IN) if (gs.length) { PM_INPUTS.set(pm, gs); if (!NOT_INDUSTRY.test(PM_FILE.get(pm))) gs.forEach(g => INDUSTRY_GOODS.add(g)); }
if (INDUSTRY_GOODS.size < 15) throw new Error('read fewer than 15 industrially consumed goods from the game — the production_methods layout moved');
function industrialGoods(cfg) {
  const s = new Set([...INDUSTRY_GOODS, ...RAW_IN, ...TIER_GOODS]);
  for (const ind of cfg?.industries || []) { if (ind.disabled) continue;
    for (const t of ind.tiers || []) for (const g of Object.keys(t.inputs || {})) s.add(g); }
  for (const g of LOCAL) s.delete(g);
  return s;
}
// which methods consume a good, and under what NAME: vanilla's (the game's English name), the book's rung main methods (pm_key → inputs),
// and the build's minted secondary copies (pm_<vanilla>_<rung key>), matched to the vanilla method they copy by the longest vanilla prefix.
// ⭐ A consumer is reported as BUILDING · METHOD (2026-10-03, the user: "tooling workshop hardly eats oil (maybe as automation?)") — a
// building listed alone read as if its main recipe ate the good, where the German oil was eaten by the tooling workshop's Assembly Lines
const GAME_LOC = 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game/localization/english';
const PM_NAME = new Map();
for (const f of fs.readdirSync(GAME_LOC).filter(f => /^production_methods.*_l_english\.yml$/.test(f)))
  for (const l of fs.readFileSync(path.join(GAME_LOC, f), 'utf8').split(/\r?\n/)) { const m = /^\s*([a-z_0-9\-]+):\d*\s+"(.*)"\s*$/.exec(l); if (m) PM_NAME.set(m[1], m[2]); }
function consumerMap(cfg) {
  const m = new Map([...PM_INPUTS].map(([pm, gs]) => [pm, { goods: gs, name: PM_NAME.get(pm) || pm.replace(/^pm_/, '').replace(/_/g, ' ') }]));
  for (const ind of cfg?.industries || []) { if (ind.disabled) continue;
    for (const t of ind.tiers || []) if (t.pm_key) m.set(t.pm_key, { goods: Object.keys(t.inputs || {}), name: `main method (${ind.id} e${t.era})` }); }
  const vanillaKeys = [...PM_INPUTS.keys()].sort((a, b) => b.length - a.length), memo = new Map(), none = { goods: [], name: '' };
  return pm => { if (m.has(pm)) return m.get(pm); if (memo.has(pm)) return memo.get(pm);
    const v = vanillaKeys.find(k => pm.startsWith(k + '_')); const r = v ? m.get(v) : none; memo.set(pm, r); return r; };
}
// the rungs of the book that consume a good, by era — "which industry could not begin growing"
function potentialConsumers(cfg, g) {
  const out = [];
  for (const ind of cfg?.industries || []) { if (ind.disabled) continue;
    for (const t of ind.tiers || []) if (t.inputs?.[g]) out.push(`${ind.id} e${t.era}`); }
  return out;
}
function producers(cfg) {                                     // building type → [good, industry name]
  const m = {}; for (const [ty, g] of Object.entries(VANILLA_PRODUCER)) m[ty] = [g, ty.replace(/^building_/, '').replace(/_/g, ' ')];
  for (const ind of cfg?.industries || []) { if (ind.disabled || !ind.output_good) continue;
    for (const t of ind.tiers || []) if (!t.method_of) m[t.key] = [ind.output_good, ind.id + ' industry']; }
  return m;
}
const thin = a => { if (!YEARLY) return a; const seen = new Set(); return a.filter(p => { const y = Math.floor(p.t + 1e-6); if (seen.has(y)) return false; seen.add(y); return true; }); };

// ---- the readings: key "market|good" → [{t, r (price ÷ base), sup, dem, lv}]
function marketSeries(runDir, goods) {
  const out = new Map(), add = (k, t, o) => { if (t > UNTIL + 1e-6 || t < FROM) return; (out.get(k) || out.set(k, []).get(k)).push({ t, ...o }); };
  const mt = path.join(runDir, 'markets.tsv');
  if (fs.existsSync(mt)) for (const line of fs.readFileSync(mt, 'utf8').split(/\r?\n/).slice(1)) {
    const c = line.split('\t'); if (c.length < 11) continue;
    const ser = seriesOf(c[2]), good = c[4]; if (!MAJOR.includes(ser) || !goods.has(good) || !G[good]?.cost) continue;
    const b = +c[5], s = +c[6], p = +c[7]; if (!(p > 0) || !(b > 0 || s > 0)) continue;
    add(ser + '|' + good, yr(c[1]), { r: p / G[good].cost, sup: s, dem: b });
  }
  let gw = 0;
  const meta = path.join(runDir, 'meta.json'), base = path.join(runDir, 'logs_live', 'debug.log');
  const dbg = fs.existsSync(base) ? base : fs.existsSync(base + '.gz') ? base + '.gz' : null;
  if (fs.existsSync(meta) && dbg) {
    const tok = JSON.parse(fs.readFileSync(meta, 'utf8').replace(/^﻿/, '')).token;
    if (tok) {
      const text = dbg.endsWith('.gz') ? zlib.gunzipSync(fs.readFileSync(dbg)).toString('utf8') : fs.readFileSync(dbg, 'utf8');
      const re = new RegExp(`V3TB\\|${tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\|GW\\|([\\d.]+)\\|([^|]+)\\|([a-z_]+)\\|([\\d.\\-]+)\\|([\\d.\\-]+)\\|([\\d.\\-]+)`);
      const seen = new Set();                                   // the mirror can re-copy a chunk (L28): one reading per date, market, good
      for (const line of text.split(/\r?\n/)) {
        const m = re.exec(line); if (!m) continue;
        const ser = seriesOf(m[2]), good = m[3]; if (!MAJOR.includes(ser) || !goods.has(good) || !G[good]?.cost) continue;
        const k = m[1] + '|' + ser + '|' + good; if (seen.has(k)) continue; seen.add(k);
        const b = +m[4], s = +m[5], p = +m[6]; if (!(p > 0) || !(b > 0 || s > 0)) continue;
        add(ser + '|' + good, yr(m[1]), { r: p / G[good].cost, sup: s, dem: b }); gw++;
      }
    }
  }
  for (const a of out.values()) a.sort((x, y) => x.t - y.t);
  return { series: out, gw };
}
// ⭐ SUPPLY HERE IS PRODUCTION + IMPORTS, the market's sell orders as the ruling means them (2026-10-03). Until that afternoon it was the
// members' PRODUCTION alone, so a market fed by imports read as "thin" — the German oil flags of the arm (0.4 units a week made at home)
// were partly that. Imports come from a v10+ summary's per-country `trade.goods.<g>.imp` (trade capacity) × the run's own traded quantity
// — a LOWER BOUND: the trade centres' quantity multiplier is not in the summary (TESTBED_METRICS §2.5), so a flag that survives it is
// thin on any reading. A summary before v10 has no trade, and its supply is production alone (the reader says so).
function summarySeries(runDir, goods, prodOf, consOf, tq) {
  const out = new Map(), idx = indexRun(runDir); let n = 0, priced = 0, withTrade = 0;
  for (const d of Object.keys(idx).sort((a, b) => yr(a) - yr(b))) {
    const t = yr(d); if (t > UNTIL + 1e-6 || t < FROM) continue;
    const s = readSum(idx[d]); n++;
    const label = new Map();
    for (const [tag, ser] of TAG_SERIES) { const c = s.countries?.[tag]; if (c && c.market != null && !label.has(c.market) && ![...label.values()].includes(ser)) label.set(c.market, ser); }
    const agg = new Map(); let trade = false;
    for (const c of Object.values(s.countries || {})) {
      if (!label.has(c.market)) continue;
      const a = agg.get(c.market) || agg.set(c.market, { prod: {}, imp: {}, dem: {}, gs: {}, vo: {}, lv: {}, ind: {}, cons: {} }).get(c.market);
      for (const [g, v] of Object.entries(c.goods_out || {})) a.prod[g] = (a.prod[g] || 0) + v;
      if (c.trade?.goods) { trade = true; for (const [g, v] of Object.entries(c.trade.goods)) if (v?.imp > 0) a.imp[g] = (a.imp[g] || 0) + v.imp * (tq[g] || 0); }
      for (const [g, v] of Object.entries(c.goods_in || {})) a.dem[g] = (a.dem[g] || 0) + v;
      for (const [ty, b] of Object.entries(c.buildings || {})) {
        const p = prodOf[ty];
        if (p) { const [g, nm] = p; a.lv[g] = (a.lv[g] || 0) + (b.staffing || 0); (a.ind[g] ||= new Set()).add(nm);
          if (b.va_out > 0 && Number.isFinite(b.goods_sales)) { a.gs[g] = (a.gs[g] || 0) + b.goods_sales; a.vo[g] = (a.vo[g] || 0) + b.va_out; } }
        // the consumers present: levels of this building type running a METHOD that eats g, summed over the market's members
        for (const [pm, lv] of Object.entries(b.pms || {})) { const c2 = consOf(pm); for (const g of c2.goods) {
          const cm = a.cons[g] ||= {}; const k = `${ty.replace(/^building_/, '').replace(/_/g, ' ')} · ${c2.name}`; cm[k] = (cm[k] || 0) + lv; } }
      }
    }
    if (trade) withTrade++;
    for (const [mid, a] of agg) for (const g of goods) {
      const prod = a.prod[g] || 0, imp = a.imp[g] || 0;
      if (!(prod + imp > 0) && !(a.dem[g] > 0)) continue;
      const r = a.vo[g] > 0 ? a.gs[g] / a.vo[g] : NaN; if (Number.isFinite(r)) priced++;
      const k = label.get(mid) + '|' + g;
      (out.get(k) || out.set(k, []).get(k)).push({ t, r, sup: prod + imp, prod, imp, dem: a.dem[g] || 0, lv: a.lv[g] || 0, ind: a.ind[g] ? [...a.ind[g]] : [], cons: a.cons[g] || {} });
    }
  }
  return { series: out, n, priced, withTrade };
}

// ---- the flags (on priced readings only)
function highFlags(a) {
  const eps = []; let cur = [];
  const flush = () => { if (cur.length && cur[cur.length - 1].t - cur[0].t >= YEARS - 1e-6) eps.push({ type: 'HIGH', from: cur[0].t, to: cur[cur.length - 1].t,
    lo: Math.min(...cur.map(p => p.r)), hi: Math.max(...cur.map(p => p.r)), mean: cur.reduce((x, p) => x + p.r, 0) / cur.length,
    sup: med(cur.map(p => p.sup)), dem: med(cur.map(p => p.dem)), lv: med(cur.map(p => p.lv)) }); cur = []; };
  for (const p of a) { if (p.r >= HIGH && (!cur.length || p.t - cur[cur.length - 1].t <= GAP)) cur.push(p); else { flush(); if (p.r >= HIGH) cur.push(p); } }
  flush(); return eps;
}
function swingFlags(a) {
  const eps = [];
  for (let i = 0; i < a.length; i++) {
    const w = a.filter(p => p.t >= a[i].t && p.t <= a[i].t + WINDOW + 1e-6); if (w.length < 2) continue;
    if (w.some((p, j) => j && p.t - w[j - 1].t > GAP)) continue;
    const lo = Math.min(...w.map(p => p.r)), hi = Math.max(...w.map(p => p.r)), sup = med(w.map(p => p.sup));
    if (hi - lo >= SWING - 1e-9 && sup < SUPPLY) { const last = eps[eps.length - 1];
      if (last && w[0].t <= last.to + 1e-6) { last.to = Math.max(last.to, w[w.length - 1].t); last.lo = Math.min(last.lo, lo); last.hi = Math.max(last.hi, hi); last.supAll.push(...w.map(p => p.sup)); last.demAll.push(...w.map(p => p.dem)); last.lvAll.push(...w.map(p => p.lv)); }
      else eps.push({ type: 'SWING', from: w[0].t, to: w[w.length - 1].t, lo, hi, supAll: w.map(p => p.sup), demAll: w.map(p => p.dem), lvAll: w.map(p => p.lv) }); }
  }
  for (const e of eps) { e.sup = med(e.supAll); e.dem = med(e.demAll); e.lv = med(e.lvAll); delete e.supAll; delete e.demAll; delete e.lvAll; }
  return eps;
}
const resolves = a => a.length >= 2 && a.some((p, i) => i && p.t - a[i - 1].t <= GAP);

// ---- per arm
const dropped = [], report = { ruled: 'BALANCE_FRAMEWORK §10.94 (user, 2026-10-03)', thresholds: { HIGH, YEARS, GAP, SWING, WINDOW, SUPPLY, local_excluded: [...LOCAL] }, arms: [] };
for (const [spec, ref] of [...argv.map(s => [s, false]), ...REFS.map(s => [s, true])]) {
  const eq = spec.lastIndexOf('=');                             // the LAST '=': a label may carry one ("vanilla, n=4"), a session never does
  const label = spec.slice(0, eq), [sessions, setup] = spec.slice(eq + 1).split(':');
  const u = usableRuns(SESSIONS, sessions, setup || ''); dropped.push(...u.dropped);
  const arm = { label, sessions, setup: setup || null, ref, runs: [] }; report.arms.push(arm);
  for (const rel of u.runs) {
    const dir = path.join(SESSIONS, rel), cfg = bookOf(dir), goods = industrialGoods(cfg), prodOf = producers(cfg), consOf = consumerMap(cfg), tq = tradedQuantity(cfg);
    const run = rel.replace(/^(\d{8}_\d{6})[^/]*\//, '$1/');
    const M = (SOURCE === 'summary' || SOURCE === 'producer') ? null : marketSeries(dir, goods);
    const mResolved = M && [...M.series.values()].some(resolves);
    const srcs = SOURCE === 'both' ? ['market', 'summary'] : SOURCE === 'market' ? ['market'] : (SOURCE === 'summary' || SOURCE === 'producer') ? ['summary'] : [mResolved ? 'market' : 'summary'];
    // the save summaries are read for EVERY run, whatever the source: they are where a flag's context lives — the consumers present in the
    // market (which industry the price was starving) and the producers' staffing (who failed to make it) — and the order books carry neither
    const SS = summarySeries(dir, goods, prodOf, consOf, tq);
    // the counts on the basis a PRE-v10 summary reference is read on — save summaries, supply = production ALONE — so an arm read from the
    // order books or from v10+ summaries (imports in its supply) can be put beside such a reference like for like (the eleven-tag vanilla set
    // is v9: no trade). HIGH does not read supply, so only its SOURCE differs; SWING differs in both
    // ⭐ the flags themselves are kept too (2026-10-08, `prodFlags` in the JSON): redflag_metrics.mjs scores problem market-years on them, which
    //   is the only basis the pinned vanilla references can be put beside
    const prodBasis = { high: 0, swing: 0 }, prodFlags = [];
    for (const [k, a0] of SS.series) { const a = thin(a0.filter(p => Number.isFinite(p.r))).map(p => ({ ...p, sup: p.prod })); if (!resolves(a)) continue;
      const [market, good] = k.split('|'), hs = highFlags(a), ss = swingFlags(a);
      prodBasis.high += hs.length; prodBasis.swing += ss.length;
      for (const e of [...hs, ...ss]) prodFlags.push({ market, good, type: e.type, from: e.from, to: e.to, lo: r2(e.lo), hi: r2(e.hi), sup: r1(e.sup), dem: r1(e.dem) }); }
    for (const src of srcs) {
      const S = src === 'market' ? M : SS;
      const flags = []; let resolvedSeries = 0;
      for (const [k, a0] of S.series) {
        const a = thin(a0.filter(p => Number.isFinite(p.r))); if (!resolves(a)) continue; resolvedSeries++;
        const [market, good] = k.split('|'); const ctx = SS.series.get(k) || [];
        const ind = [...new Set(ctx.flatMap(p => p.ind || []))];
        for (const e of [...highFlags(a), ...swingFlags(a)]) {
          // each consumer: building · method, its most levels at any reading in the window, and in HOW MANY readings it was there at
          // all — a method a building tried for one quarter and dropped is not the industry the price was starving
          const win = ctx.filter(p => p.t >= e.from - 1e-6 && p.t <= e.to + 1e-6), cm = {}, seen = {};
          for (const p of win) for (const [k2, lv] of Object.entries(p.cons || {})) if (lv > 0) { cm[k2] = Math.max(cm[k2] || 0, lv); seen[k2] = (seen[k2] || 0) + 1; }
          const consumers = Object.keys(cm).sort((x, y) => seen[y] - seen[x] || cm[y] - cm[x]).slice(0, 4).map(k2 => ({ k: k2, max: r1(cm[k2]), seen: seen[k2], of: win.length }));
          flags.push({ market, good, industry: ind.join(' / ') || null, ...e, prod: r1(med(win.map(p => p.prod))), imp: r1(med(win.map(p => p.imp))),
            consumers, producers_staffed: r1(med(win.map(p => p.lv))), potential: potentialConsumers(cfg, good) });
        }
      }
      flags.sort((x, y) => MAJOR.indexOf(x.market) - MAJOR.indexOf(y.market) || x.good.localeCompare(y.good) || x.from - y.from);
      arm.runs.push({ run, source: src, cadence: src === 'market' ? `${S.gw} yearly GW readings` : `${S.n} summaries`, resolvedSeries,
        withTrade: src === 'summary' && SS.withTrade > 0, summariesWithTrade: SS.withTrade > 0, prodBasis, prodFlags, flags });
    }
  }
}

// ---- console
const supplyText = f => f.imp > 0 ? `${r1(f.sup)} units/wk of supply (made ${r1(f.prod)} + imported ≥ ${r1(f.imp)})` : `${r1(f.sup)} units/wk of supply`;
const consText = c => `${c.k} ≤ ${c.max} levels${c.seen < c.of ? ` in ${c.seen} of ${c.of} readings` : ' throughout'}`;
// a run read on the basis a pre-v10 summary forces — the summary source with no trade, so supply = production alone
const onPre10Basis = r => r.source === 'summary' && !r.withTrade;
const sideNote = r => r.source === 'market' ? 'supply = sell orders'
  : r.withTrade ? 'supply = the market members\' production + their imports at a lower bound (trade capacity × traded quantity)'
  : 'supply = the market members\' production ONLY — these summaries carry no trade (before v10)';
console.log(`INPUT-PRICE RED FLAGS (${report.ruled}) — HIGH: ≥ ${HIGH.toFixed(2)}× base at every reading for ≥ ${YEARS} y · SWING: a ${WINDOW}-year range ≥ ${SWING}× base on < ${SUPPLY} units a week of supply`
  + ` · local goods excluded (${[...LOCAL].join(', ')})` + (YEARLY ? ' · YEARLY readings only' : '') + (UNTIL < 9999 ? ` · to ${UNTIL}` : ''));
for (const a of report.arms) {
  console.log(`\n=== ${a.ref ? '[reference] ' : ''}${a.label} (${a.sessions}${a.setup ? ':' + a.setup : ''}) · ${a.runs.length} run reading(s)`);
  for (const r of a.runs) {
    const h = r.flags.filter(f => f.type === 'HIGH'), s = r.flags.filter(f => f.type === 'SWING');
    const onPre10 = !onPre10Basis(r) ? ` (on a pre-v10 reference's basis — summaries, production alone: HIGH ${r.prodBasis.high} · SWING ${r.prodBasis.swing})` : '';
    console.log(`  ${r.run} · ${r.source} source (${r.cadence}; ${sideNote(r)}) · ${r.resolvedSeries} series resolved · HIGH ${h.length} · SWING ${s.length}${onPre10}`);
    for (const f of r.flags.slice(0, LIST)) console.log(`    ${f.type.padEnd(5)} ${f.market.padEnd(16)} ${f.good.padEnd(11)} ${(fmtY(f.from) + '–' + fmtY(f.to)).padEnd(16)} ${(f.to - f.from).toFixed(1).padStart(4)} y  price ${f.lo.toFixed(2)}–${f.hi.toFixed(2)}`
      + `  ${supplyText(f)}  building demand ${r1(f.dem)}/wk  producers ${f.producers_staffed ?? '?'} staffed levels${f.industry ? ' (' + f.industry + ')' : ''}`
      + `\n          consumers present (building · method, most levels at a reading): ${f.consumers.map(consText).join(', ') || 'NONE'} · rungs that eat it: ${f.potential.join(', ') || '—'}`);
    if (r.flags.length > LIST) console.log(`    … ${r.flags.length - LIST} more (--list)`);
  }
}
reportDropped(dropped);

// ---- prose for the report (HTML, highlighted inline) and for probe readouts (Markdown)
// The arm(s) named before `--ref` are reported flag by flag; a reference arm (`--ref label=session…`, e.g. the eleven-tag vanilla set) is one line
// of counts per run and the goods it flags, so the reader can tell the book's flags from the game's own.
function prose(fmt) {
  const out = [];
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const html = fmt === 'html';
  const tally = fs => { const t = {}; for (const f of fs) { const k = `${f.good} (${f.market.replace(' Market', '')})`; t[k] = (t[k] || 0) + 1; }
    return Object.entries(t).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join(', '); };
  for (const a of report.arms) {
    const all = a.runs.flatMap(r => r.flags.map(f => ({ ...f, run: r.run, source: r.source })));
    const runs = a.runs.length, srcs = [...new Set(a.runs.map(r => r.source))].join(' + ');
    const nH = all.filter(f => f.type === 'HIGH').length, nS = all.filter(f => f.type === 'SWING').length;
    if (a.ref) {
      // a reference read on a pre-v10 basis (no trade in its summaries: supply = production alone, the order books unread) is put beside the
      // book's counts on THAT basis, or the comparison mixes two definitions of supply — imports thicken a market, so the book would read fewer
      // swings for a reason that is not the economy
      const books = report.arms.filter(b => !b.ref), bookRuns = books.flatMap(b => [...new Map(b.runs.map(r => [r.run, r])).values()]);
      const like = a.runs.length && a.runs.every(onPre10Basis) && bookRuns.some(r => !onPre10Basis(r)) && bookRuns.length
        ? ` — its summaries carry no trade, so its supply is production alone; on that basis the book reads ${(bookRuns.reduce((x, r) => x + r.prodBasis.high, 0) / bookRuns.length).toFixed(1)} HIGH and ${(bookRuns.reduce((x, r) => x + r.prodBasis.swing, 0) / bookRuns.length).toFixed(1)} SWING per run` : '';
      const line = `Reference — ${a.label}: ${(nH / runs).toFixed(1)} HIGH and ${(nS / runs).toFixed(1)} SWING flag(s) per run over ${runs} run(s)${like}`
        + (nH ? `; HIGH: ${tally(all.filter(f => f.type === 'HIGH'))}` : '') + (nS ? `; SWING: ${tally(all.filter(f => f.type === 'SWING'))}` : '');
      out.push(html ? `<p class="dim">${esc(line)}.</p>` : `- ${line}.`); continue;
    }
    const perRun = a.runs.map(r => `${r.flags.filter(f => f.type === 'HIGH').length}/${r.flags.filter(f => f.type === 'SWING').length}`).join(' · ');
    const head = `${a.label}: ${nH} HIGH and ${nS} SWING flag(s) over ${runs} run(s)${runs > 1 ? ` (HIGH/SWING per run: ${perRun})` : ''} — source: ${srcs}`;
    if (!all.length) { out.push(html ? `<p><span class="pill ok">no flag</span> ${esc(head)} — no major market held an industrially consumed good at +70% for two years or swung it on a thin supply.</p>` : `- **${head}** — no flag.`); continue; }
    // each flag names its OWN consumers (max levels in its window): which industry the price was starving — or none at all, where an industry
    // that would eat the good may be the one that never began (the user, 2026-10-03: never dismiss a swing for want of demand)
    // 'buyers present', not 'eaten by': a building that ran an oil-eating method at ONE reading of four is not the industry the price starved
    const eatOf = cs => cs.length ? `buyers present (building · method, most levels at a reading): ${cs.map(consText).join(', ')}` : 'no buyer in the market';
    const multiSess = new Set(a.runs.map(r => r.run.split('/')[0])).size > 1;
    const runTag = f => runs > 1 ? '; run ' + (multiSess ? f.run.split('/')[0] + '/' : '') + f.run.split('/')[1].slice(3, 6) : '';
    const full = f => `${fmtY(f.from)}–${fmtY(f.to)} (${f.lo.toFixed(2)}–${f.hi.toFixed(2)}× base on ${supplyText(f)} against ${r1(f.dem)} of building demand, producers ${f.producers_staffed ?? '?'} staffed levels; ${eatOf(f.consumers || [])}${runTag(f)})`;
    const byMG = fs => { const m = {}; for (const f of fs) ((m[f.market] ||= {})[f.good] ||= []).push(f);
      return Object.entries(m).sort((x, y) => MAJOR.indexOf(x[0]) - MAJOR.indexOf(y[0])); };
    const madeBy = gs => [...new Set(gs.map(f => f.industry).filter(Boolean))].join(' / ') || '?';
    const potOf = gs => gs.some(f => !(f.consumers || []).length) && gs[0].potential.length ? ` — rungs that would eat it: ${gs[0].potential.join(', ')}` : '';
    // 1. HIGH — every one in full: rare, and each is a years-long statement about one market
    const highs = byMG(all.filter(f => f.type === 'HIGH')).map(([m, goods]) => Object.entries(goods).map(([g, gs]) =>
      html ? `<li><span class="pill bad">HIGH</span> <b>${esc(m)}</b> — <b>${esc(g)}</b> <span class="dim">(made by ${esc(madeBy(gs))}${esc(potOf(gs))})</span>: ${esc(gs.map(full).join('; '))}</li>`
           : `  - ⚑ HIGH · **${m}** — **${g}** (made by ${madeBy(gs)}${potOf(gs)}): ${gs.map(full).join('; ')}`).join('')).join(html ? '' : '\n');
    // 2. SWING — one line per market and good: in how many runs, the years it covers, the price range, the supply, who eats it
    const swingLine = (g, gs) => { const cm = {}; for (const f of gs) for (const c of f.consumers || []) { const o = cm[c.k] ||= { k: c.k, max: 0, seen: 0, of: 0 }; o.max = Math.max(o.max, c.max); o.seen += c.seen; o.of += c.of; }
      const cs = Object.values(cm).sort((x, y) => y.seen - x.seen || y.max - x.max).slice(0, 4);
      const nr = new Set(gs.map(f => f.run)).size, yrs = `${fmtY(Math.min(...gs.map(f => f.from)))}–${fmtY(Math.max(...gs.map(f => f.to)))}`;
      return `${g} (made by ${madeBy(gs)}${potOf(gs)}): ${gs.length} span(s)${runs > 1 ? ` in ${nr} of ${runs} runs` : ''}, ${yrs}, ${Math.min(...gs.map(f => f.lo)).toFixed(2)}–${Math.max(...gs.map(f => f.hi)).toFixed(2)}× base on a median ${r1(med(gs.map(f => f.sup)))} units/wk of supply against ${r1(med(gs.map(f => f.dem)))} of building demand, producers ${r1(med(gs.map(f => f.producers_staffed ?? 0)))} staffed levels; ${eatOf(cs)}`; };
    const swings = byMG(all.filter(f => f.type === 'SWING'));
    const swingItems = swings.map(([m, goods]) => html ? `<li><b>${esc(m)}</b> — ${Object.entries(goods).map(([g, gs]) => esc(swingLine(g, gs))).join('<br>')}</li>`
      : `  - ⚑ SWING · **${m}** — ${Object.entries(goods).map(([g, gs]) => swingLine(g, gs)).join(' · ')}`);
    // 3. every SWING flag in full — collapsed in the report; printed in a single-run readout (a probe), the JSON otherwise
    const everyItems = swings.map(([m, goods]) => Object.entries(goods).map(([g, gs]) => html ? `<li><b>${esc(m)}</b> — <b>${esc(g)}</b>: ${esc(gs.map(full).join('; '))}</li>`
      : `    - ${m} — **${g}**: ${gs.map(full).join('; ')}`).join(html ? '' : '\n'));
    if (html) out.push(`<p><b>${esc(head)}.</b></p>` + (highs ? `<ul>${highs}</ul>` : `<p>No HIGH flag.</p>`)
      + (swingItems.length ? `<p><span class="pill warn">SWING</span> by market and good:</p><ul>${swingItems.join('')}</ul>`
        + `<details><summary class="dim">every SWING flag (${nS})</summary><ul>${everyItems.join('')}</ul></details>` : ''));
    else out.push(`- **${head}:**` + (highs ? '\n' + highs : '\n  - no HIGH flag') + (swingItems.length ? '\n' + swingItems.join('\n') : '')
      + (swingItems.length ? (runs === 1 ? '\n  - every SWING flag:\n' + everyItems.join('\n') : '\n  - (every flag: --json)') : ''));
  }
  const rule = `HIGH = an industrially consumed good at ≥ ${HIGH.toFixed(2)}× base for ≥ ${YEARS} years; SWING = a ≥ ${SWING}× base price swing within ${WINDOW} years on under ${SUPPLY} units a week of supply; local goods (${[...LOCAL].join(', ')}) excluded — ${report.ruled}. Not a loss term.`;
  const main = report.arms.filter(a => !a.ref).flatMap(a => a.runs.flatMap(r => r.flags));
  const tone = main.some(f => f.type === 'HIGH') ? 'bad' : main.length ? 'warn' : 'ok';
  return html
    ? `<div class="card" style="border-left:4px solid var(--${tone});background:var(--${tone}bg)"><h3 style="margin-top:0">⚑ Input-price red flags — which major market, which good, which industry, when</h3>${out.join('\n')}<p class="dim">${esc(rule)}</p></div>\n`
    : `**Input-price red flags** (${rule})\n${out.join('\n')}\n`;
}
if (HTML_OUT) { fs.writeFileSync(HTML_OUT, prose('html')); console.log(`\nwrote ${HTML_OUT}`); }
if (MD) console.log('\n' + prose('md'));
if (JSON_OUT) { fs.writeFileSync(JSON_OUT, JSON.stringify(report, null, 1)); console.log(`wrote ${JSON_OUT}`); }
