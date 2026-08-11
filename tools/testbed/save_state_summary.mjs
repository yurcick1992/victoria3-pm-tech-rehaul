// save_state_summary.mjs — ONE MELTED GAMESTATE -> ONE SUMMARY JSON.  The state-of-process instrument.
//
//   node tools/testbed/save_state_summary.mjs <melt.txt|-> --out summary.json [--provenance p.json]
//   tools\vendor\rakaly\rakaly.exe melt --format vic3 --unknown-key stringify -c save.v3 | node ... - --out s.json
//
// ⭐⭐ WHY THIS EXISTS, AND THE PRINCIPLE IT INVERTS (ROADMAP step 3.5).
// For anything that is a *level* rather than an *event*, a melted savegame beats a log flood: it is
// complete, internally consistent, unaffected by the log ring, and carries things telemetry cannot reach
// at all (per-building SUBSIDY spend, technologies held, ownership, cash reserves).
// ⚠ But the repo's usual rule — "the summary is a CACHE, the raw log is the record" — is INVERTED here:
// the saves are reaped, so THIS FILE BECOMES THE RECORD.  Anything not captured at melt time is gone and
// the only remedy is re-running a campaign, which is a different world.  Hence:
//   · the schema is GENEROUS BY DEFAULT — everything cheap goes in, not just what today's question needs;
//   · anything deliberately NOT captured is named in NOT_CAPTURED below, as a decision rather than a gap;
//   · the last save of each run is kept permanently as the escape hatch.
//
// ⚠ SAVE_SUMMARY_VERSION is BUMP-NEVER-RENUMBER, like TELEMETRY_VERSION.  A summary that does not carry
// one is not comparable to anything.
//
// ⚠ THE MELT IS ~7x THE SAVE (57 MB -> 391 MB) AND EVERYTHING HERE STREAMS.  Measured 2026-08-11 on a
// 1935 gamestate: rakaly melt 2 s, this reader ~4 s, so the consumer is several times FASTER than a
// quarterly autosave producer (one save every 15-35 s of wall clock).  The queue drains; the handover's
// feared 90 s melt was wrong by a factor of 45.
//
// ⚠ THE POP TABLE IS DELIBERATELY NOT SCANNED (it is 8 M of the melt's 16 M lines).  Each country record
// already carries `pop_statistics.population_by_profession`, indexed by pop type.  That index is
// ALPHABETICAL over `common/pop_types/*.txt` — VERIFIED, not assumed: summed world-wide the two sources
// agree to 0.03 % on all 15 professions (see FINDINGS / the --verify-pops mode, which re-does the full
// labelled scan and prints the comparison).  The reader THROWS if the game ships a different number of
// pop types than the save's own count prefix, so a patch that adds one cannot silently shift every index.
import { createReadStream, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, basename, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const SAVE_SUMMARY_VERSION = 1;

// What we knowingly leave out, and why.  Read this before concluding the summary "lost" something.
const NOT_CAPTURED = {
  market_order_book: 'NOT PERSISTED IN A SAVE AT ALL — the market database holds only `owner`. Buy/sell orders stay on log telemetry, permanently.',
  per_state_goods_flows: 'aggregated to COUNTRY and to BUILDING TYPE here. The per-STATE table is ~23k rows per save and is only needed by the pop-need work, which runs off `melted_building_goods.mjs` against a kept save.',
  pop_need_purchase_weights: 'per (state, culture, need, good) — tens of thousands of rows. `melted_pop_need_weights.mjs` reads it from a kept save.',
  cultures_and_obsessions: '`melted_cultures.mjs` reads it from a kept save; runtime state, but not per-quarter interesting.',
  technology_acquisition_DATES: 'a save shows what is HELD, never when it arrived. Stays on telemetry (`tech_log`) — the two are complementary, not redundant.',
};

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const SRC = args.filter(a => !a.startsWith('--'))[0];
const OUT = argOf('--out', '');
const GAME = argOf('--game', 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game');
const PROV = argOf('--provenance', '');          // extra JSON merged into .provenance
const VERIFY_POPS = args.includes('--verify-pops');
const TOPN = +argOf('--top', '15');
if (!SRC) { console.error('usage: save_state_summary.mjs <melt.txt|-> --out summary.json'); process.exit(1); }

const strip = s => s.replace(/^\uFEFF/, '');
// ---- reference tables read LIVE from the game, so a patch cannot leave this quietly wrong.
const GOODS = [];
for (const f of readdirSync(join(GAME, 'common/goods')).filter(x => x.endsWith('.txt')).sort())
  for (const m of strip(readFileSync(join(GAME, 'common/goods', f), 'utf8')).matchAll(/^([a-z][a-z_]*)\s*=\s*\{/gm)) GOODS.push(m[1]);
const POP_TYPES = readdirSync(join(GAME, 'common/pop_types')).filter(x => x.endsWith('.txt')).sort()
  .map(x => x.replace(/\.txt$/, ''));
if (!GOODS.length || !POP_TYPES.length) throw new Error(`game reference tables empty — is --game right? (${GAME})`);

const SUBJECT = new Set(['puppet', 'protectorate', 'colony', 'vassal', 'dominion', 'tributary', 'personal_union']);
const TREND_KEYS = new Map([['gdp', 'gdp'], ['prestige', 'prestige'], ['literacy', 'literacy'], ['avgsoltrend', 'avg_sol']]);
// Sections we actually walk.  Everything else is skipped in O(1) per line: a top-level section always
// closes with a `}` in COLUMN 0, so skipping never needs brace arithmetic.
const WANT = new Set(['country_manager', 'states', 'technology', 'pacts', 'building_manager', 'building_ownership_manager']);

// ---------------------------------------------------------------- collectors
let saveDate = '';
const stateCountry = new Map(), stateRegion = new Map();
const C = new Map();                       // country id -> record
const techByCountry = new Map();           // country id -> {acquired:[], researching, progressed:n}
const overlord = new Map(), ownMarket = new Set();
const bldByCountry = new Map();            // "cid|building" -> {n,levels,subsidised,subsidised_levels,profit,cash,staffing}
const goodsOut = new Map(), goodsIn = new Map();   // "cid|good" -> qty
const bldState = new Map();                // building id -> state id      (for the ownership pass)
const ownedAbroad = new Map(), foreignOwned = new Map();  // cid -> levels
let popTypeCountSeen = 0;

const add = (m, k, v) => m.set(k, (m.get(k) || 0) + v);

// ⭐ A `.v3` IS ACCEPTED DIRECTLY AND MELTED IN-PROCESS, STREAMING.  This is the roadmap's "stream the
// melt" win, and it is what makes a worker pool trivial: one `node save_state_summary.mjs <save.v3>` per
// save, no shell pipe to arrange, and the 391 MB plaintext intermediate never touches disk (a quarterly
// century would otherwise write ~150 GB through it for nothing).
let rakalyDone = Promise.resolve();
function meltStream(savePath) {
  const here = dirname(fileURLToPath(import.meta.url));
  const rak = argOf('--rakaly', join(here, '..', 'vendor', 'rakaly', 'rakaly.exe'));
  if (!existsSync(rak)) throw new Error(`rakaly not found at ${rak} — see TESTBED_METRICS §7`);
  const p = spawn(rak, ['melt', '--format', 'vic3', '--unknown-key', 'stringify', '-c', savePath],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  let err = '';
  p.stderr.on('data', d => { err += d; });
  // ⚠ A TRUNCATED SAVE MUST NOT PRODUCE A SUMMARY.  A CTD mid-autosave leaves a .v3 that exists, is
  // newest and has a plausible size; rakaly then fails part-way and the parse would still have "read"
  // a prefix.  So the melt's exit status is AWAITED before anything is written, and a non-zero exit
  // throws — the harvester must never reap a save whose summary is a partial read of it.
  rakalyDone = new Promise((res, rej) => {
    p.on('error', rej);
    p.on('close', code => code === 0 ? res() : rej(new Error(`rakaly exited ${code} on ${basename(savePath)}: ${err.trim().slice(0, 400)}`)));
  });
  p.stdout.setEncoding('utf8');
  return p.stdout;
}
const IS_SAVE = /\.v3$/i.test(SRC);
const rl = createInterface({
  input: SRC === '-' ? process.stdin : IS_SAVE ? meltStream(SRC) : createReadStream(SRC, { encoding: 'utf8' }),
  crlfDelay: Infinity,
});

let mode = 'top', depth = 0;
// country_manager state
let cid = null, cur = null, path = [];       // path = block names by depth inside a country record
let budgetCat = null, budgetSide = null, trendKey = null, trendVals = null, inValues = false;
// states
let sid = null;
// technology
let tid = null, tcur = null, inAcq = false, inProg = false;
// pacts
let pFirst = null, pSecond = null, pAct = null, pT = false;
// buildings
let b = null, side = '', inGoods = false, curGood = null, inPrestige = false;
// ownership
let o = null, inIdent = false;

const numsOf = t => { const out = []; for (const m of t.matchAll(/-?\d+(?:\.\d+)?/g)) out.push(+m[0]); return out; };

for await (const line of rl) {
  if (mode === 'top') {
    if (line.charCodeAt(0) === 125) continue;                       // stray '}' — cannot happen at top
    if (!saveDate) { const d = /^date=(\d+\.\d+\.\d+)/.exec(line); if (d) { saveDate = d[1]; continue; } }
    const s = /^([a-z_]+)=\{$/.exec(line);
    if (!s) continue;
    if (WANT.has(s[1])) { mode = s[1]; depth = 1; }
    else mode = 'skip';
    continue;
  }
  if (mode === 'skip') { if (line.charCodeAt(0) === 125) mode = 'top'; continue; }

  const t = line.trim();
  let opens = 0, closes = 0;
  for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); if (c === 123) opens++; else if (c === 125) closes++; }

  if (mode === 'country_manager') {
    const m = /^(\d+)=\{$/.exec(t);
    if (m && depth === 2) {
      cid = +m[1];
      cur = { id: cid, tag: null, market: null, government: null, country_type: null, capital: null,
              is_main_tag: false, last_bankruptcy_date: null,
              gdp: null, prestige: null, literacy: null, avg_sol: null,
              money: null, credit: null, investment_pool: null, base_wage: null, average_productivity: null,
              weekly_expenses: null, weekly_income: null,
              building_budget: { expense: null, income: null, expenses: {}, incomes: {} },
              subsidies: {}, subventions: {},
              strata: {}, professions: {}, workforce_by_profession: {},
              pop_stats: {} };
      C.set(cid, cur); path = []; budgetCat = budgetSide = trendKey = null; inValues = false;
    } else if (cur) {
      const blk = /^([a-z_]+)=\{$/.exec(t);
      if (blk) path[depth - 3] = blk[1];
      // --- depth-3 scalars: a country's OWN fields.  The depth guard is load-bearing (a nested `market=`
      //     anywhere inside the record would otherwise win — that bug once merged three markets into one).
      if (depth === 3) {
        let x;
        if ((x = /^definition="([A-Z_0-9]+)"$/.exec(t))) cur.tag ??= x[1];
        else if ((x = /^market=(\d+)$/.exec(t))) cur.market ??= +x[1];
        else if ((x = /^government="([a-z_]+)"$/.exec(t))) cur.government ??= x[1];
        else if ((x = /^country_type="?([a-z_]+)"?$/.exec(t))) cur.country_type ??= x[1];
        else if ((x = /^capital=(\d+)$/.exec(t))) cur.capital ??= +x[1];
        else if (t === 'is_main_tag=yes') cur.is_main_tag = true;
        else if ((x = /^last_bankruptcy_date=([\d.]+)$/.exec(t))) cur.last_bankruptcy_date = x[1];
      }
      const p0 = path[0];
      // --- trends: {sample_rate, count, channels={ 0={date,index,values={ ... }}}}.  The CURRENT value is
      //     the LAST number of the values array; there is one channel on all four of these.
      // ⚠ The commit must be tested against the depth AFTER this line's braces, not before it: the block's
      //   own closing brace is read at depth 4 and only then drops to 3, so a pre-update test never fires
      //   and every trend came back null.  `trendVals` is also reset on ENTRY, or prestige would inherit
      //   gdp's last number whenever a country happened to carry no prestige samples.
      if (TREND_KEYS.has(p0)) {
        if (depth === 3 && blk) { trendKey = p0; trendVals = null; inValues = false; }
        if (t === 'values={') inValues = true;
        else if (inValues) {
          if (t.startsWith('}')) inValues = false;
          else { const v = numsOf(t); if (v.length) trendVals = v[v.length - 1]; }
        }
        if (trendKey && depth + opens - closes <= 3) {
          if (trendVals != null) cur[TREND_KEYS.get(trendKey)] = trendVals;
          trendKey = null; trendVals = null; inValues = false;
        }
      }
      if (p0 === 'budget') {
        let x;
        if (depth === 4) {
          if ((x = /^money=([\-\d.]+)$/.exec(t))) cur.money = +x[1];
          else if ((x = /^credit=([\-\d.]+)$/.exec(t))) cur.credit = +x[1];
          else if ((x = /^investment_pool=([\-\d.]+)$/.exec(t))) cur.investment_pool = +x[1];
          else if ((x = /^base_wage=([\-\d.]+)$/.exec(t))) cur.base_wage = +x[1];
          else if ((x = /^average_productivity=([\-\d.]+)$/.exec(t))) cur.average_productivity = +x[1];
        }
        if (path[1] === 'weekly_expenses' && /^[\d.\- ]+$/.test(t) && t) cur.weekly_expenses = numsOf(t);
        if (path[1] === 'weekly_income' && /^[\d.\- ]+$/.test(t) && t) cur.weekly_income = numsOf(t);
        if (path[1] === 'country_building_budget') {
          if (depth === 5) {
            if ((x = /^expense=([\-\d.]+)$/.exec(t))) cur.building_budget.expense = +x[1];
            else if ((x = /^income=([\-\d.]+)$/.exec(t))) cur.building_budget.income = +x[1];
          }
          if (path[2] === 'expenses' || path[2] === 'incomes') {
            budgetSide = path[2];
            if (depth === 6 && blk) budgetCat = blk[1];
            // ⭐ THE SUBSIDY LINE, ITEMISED BY BUILDING.  The handover expected this to need deriving from
            // a subsidised flag and a shortfall; the save books it directly, per building type, per country.
            const kv = /^(building_[a-z_0-9]+)=([\-\d.]+)$/.exec(t);
            if (kv && budgetCat) {
              const bag = cur.building_budget[budgetSide];
              (bag[budgetCat] ??= {})[kv[1]] = (bag[budgetCat][kv[1]] || 0) + +kv[2];
            }
          }
        }
      }
      if (p0 === 'pop_statistics') {
        let x;
        if ((x = /^(population_[a-z_]+|total_wealth|military_political_strength)=([\-\d.]+)$/.exec(t)) && depth === 4)
          cur.pop_stats[x[1]] = +x[2];
        if (path[1] === 'population_by_strata' && /\d+=/.test(t)) {
          const n = numsOf(t); // leading count then k=v pairs
          for (const mm of t.matchAll(/(\d+)=([\d.]+)/g)) cur.strata[['lower', 'middle', 'upper'][+mm[1]] ?? mm[1]] = +mm[2];
          void n;
        }
        if ((path[1] === 'population_by_profession' || path[1] === 'population_workforce_by_profession') && /\d+=/.test(t)) {
          const cnt = +(/^(\d+)\s/.exec(t)?.[1] ?? 0);
          if (cnt) popTypeCountSeen = Math.max(popTypeCountSeen, cnt);
          const dst = path[1] === 'population_by_profession' ? cur.professions : cur.workforce_by_profession;
          for (const mm of t.matchAll(/(\d+)=([\d.]+)/g)) {
            const name = POP_TYPES[+mm[1]] ?? ('idx' + mm[1]);
            dst[name] = (dst[name] || 0) + +mm[2];
          }
        }
      }
    }
    depth += opens - closes;
    if (depth <= 1 && closes) { /* left a country record */ }
    if (depth <= 0) { mode = 'top'; cid = null; cur = null; }
    continue;
  }

  if (mode === 'states') {
    const m = /^(\d+)=\{$/.exec(t);
    if (m && depth === 2) sid = +m[1];
    else if (sid !== null && depth === 3) {
      let x;
      if ((x = /^country=(\d+)$/.exec(t))) stateCountry.set(sid, +x[1]);
      else if ((x = /^region="([A-Z_0-9]+)"$/.exec(t))) stateRegion.set(sid, x[1]);
    }
    depth += opens - closes; if (depth <= 0) { mode = 'top'; sid = null; }
    continue;
  }

  if (mode === 'technology') {
    const m = /^(\d+)=\{$/.exec(t);
    if (m && depth === 2) { tid = +m[1]; tcur = { country: null, acquired: [], researching: null, in_progress: 0 }; inAcq = inProg = false; }
    else if (tcur) {
      let x;
      if ((x = /^country=(\d+)$/.exec(t))) tcur.country = +x[1];
      else if ((x = /^research_technology="([a-z_0-9\-]+)"$/.exec(t))) tcur.researching = x[1];
      else if (t === 'acquired_technologies={') inAcq = true;
      else if (t === 'progressed_technologies={') inProg = true;
      else if (inAcq) {
        if (t.startsWith('}')) inAcq = false;
        else for (const q of t.matchAll(/"([a-z_0-9\-]+)"/g)) tcur.acquired.push(q[1]);
      } else if (inProg) {
        if (t === '}' && depth === 3) inProg = false;
        else if (/^technology="/.test(t)) tcur.in_progress++;
      }
    }
    depth += opens - closes;
    if (tcur && depth <= 2) { if (tcur.country != null) techByCountry.set(tcur.country, tcur); tcur = null; tid = null; }
    if (depth <= 0) { mode = 'top'; }
    continue;
  }

  if (mode === 'pacts') {
    if (t === 'targets={') pT = true;
    else if (pT) {
      let x;
      if ((x = /^first=(\d+)$/.exec(t))) pFirst = +x[1];
      if ((x = /^second=(\d+)$/.exec(t))) pSecond = +x[1];
      if (t === '}') pT = false;
    }
    const a = /^action="([a-z_]+)"$/.exec(t); if (a) pAct = a[1];
    if (t === '}' && depth === 3) {
      if (SUBJECT.has(pAct) && pFirst !== null && pSecond !== null) overlord.set(pSecond, pFirst);
      if (pAct === 'grant_own_market' && pSecond !== null) ownMarket.add(pSecond);
      pFirst = pSecond = pAct = null;
    }
    depth += opens - closes; if (depth <= 0) mode = 'top';
    continue;
  }

  if (mode === 'building_manager') {
    const m = /^(\d+)=\{$/.exec(t);
    if (m && depth === 2) { b = { id: +m[1], type: null, state: null, levels: 0, subsidized: false, cash: 0, profit: 0, staffing: 0, out: [], in: [] }; side = ''; inGoods = false; }
    else if (b) {
      let x;
      if ((x = /^building="([a-z_0-9]+)"$/.exec(t))) b.type = x[1];
      else if ((x = /^state=(\d+)$/.exec(t))) b.state = +x[1];
      else if ((x = /^levels=(\d+)$/.exec(t))) b.levels = +x[1];
      else if (t === 'subsidized=yes') b.subsidized = true;
      else if ((x = /^cash_reserves=([\-\d.]+)$/.exec(t))) b.cash = +x[1];
      else if ((x = /^profit_after_reserves=([\-\d.]+)$/.exec(t))) b.profit = +x[1];
      else if ((x = /^staffing=([\-\d.]+)$/.exec(t))) b.staffing = +x[1];
      else if (t === 'input_goods={') side = 'in';
      else if (t === 'output_goods={') side = 'out';
      else if (t === 'goods={' && side) inGoods = true;
      else if (inGoods) {
        const gm = /^(\d+)=\{$/.exec(t);
        if (gm) { curGood = GOODS[+gm[1]] ?? ('idx' + gm[1]); inPrestige = false; }
        else if (t === 'prestige_goods={') inPrestige = true;
        else if (inPrestige) { if (t === '}') inPrestige = false; }
        else { const vm = /^value=([\-\d.]+)$/.exec(t); if (vm && curGood) b[side].push([curGood, +vm[1]]); }
      }
    }
    const nd = depth + opens - closes;
    if (side && nd <= 3) { side = ''; inGoods = false; curGood = null; inPrestige = false; }
    if (b && nd <= 2) {                                   // record closed — attribute it
      if (b.type && b.state !== null) {
        bldState.set(b.id, b.state);
        const ci = stateCountry.get(b.state);
        if (ci != null) {
          const k = ci + '|' + b.type;
          let r = bldByCountry.get(k);
          if (!r) bldByCountry.set(k, r = { n: 0, levels: 0, subsidised: 0, subsidised_levels: 0, profit: 0, cash: 0, staffing: 0 });
          r.n++; r.levels += b.levels; r.profit += b.profit; r.cash += b.cash; r.staffing += b.staffing;
          if (b.subsidized) { r.subsidised++; r.subsidised_levels += b.levels; }
          for (const [g, v] of b.out) add(goodsOut, ci + '|' + g, v);
          for (const [g, v] of b.in) add(goodsIn, ci + '|' + g, v);
        }
      }
      b = null;
    }
    depth = nd; if (depth <= 0) mode = 'top';
    continue;
  }

  if (mode === 'building_ownership_manager') {
    const m = /^(\d+)=\{$/.exec(t);
    if (m && depth === 2) { o = { levels: 0, ownerCountry: null, building: null }; inIdent = false; }
    else if (o) {
      let x;
      if (t === 'identity={') inIdent = true;
      else if (inIdent) {
        if ((x = /^country=(\d+)$/.exec(t))) o.ownerCountry = +x[1];
        if (t === '}') inIdent = false;
      }
      else if ((x = /^levels=(\d+)$/.exec(t))) o.levels = +x[1];
      else if ((x = /^building=(\d+)$/.exec(t))) o.building = +x[1];
    }
    const nd = depth + opens - closes;
    if (o && nd <= 2) {
      if (o.ownerCountry != null && o.building != null) {
        const host = stateCountry.get(bldState.get(o.building));
        if (host != null && host !== o.ownerCountry) {
          add(ownedAbroad, o.ownerCountry, o.levels);
          add(foreignOwned, host, o.levels);
        }
      }
      o = null;
    }
    depth = nd; if (depth <= 0) mode = 'top';
    continue;
  }
}

// ---------------------------------------------------------------- integrity gates (fail loud)
await rakalyDone;                       // a melt that failed must not yield a summary — see meltStream
if (!saveDate) throw new Error('no top-level `date=` found — is this a melted vic3 gamestate?');
if (!C.size) throw new Error('no countries parsed — the save layout has moved');
// ⚠ A patch that adds or removes a pop type shifts EVERY profession index.  The save states its own
// count; if the game disagrees with it, stop rather than mislabel.
if (popTypeCountSeen && popTypeCountSeen !== POP_TYPES.length)
  throw new Error(`pop type count mismatch: save says ${popTypeCountSeen}, game/common/pop_types has ${POP_TYPES.length} (${POP_TYPES.join(',')}) — the profession index mapping is no longer safe`);

// ---------------------------------------------------------------- assemble
const tagOf = id => C.get(id)?.tag ?? null;
// ⚠ MARKET MEMBERSHIP: a save gives every country its own `market` object and records no membership list,
// so grouping by the raw id splits a market that contains subjects.  We report BOTH the raw market id and
// the subject/overlord relation, and leave the merge to the reader — `melted_building_goods.mjs` measured
// the naive merge to be WORSE against telemetry, so this file must not bake one in.
const countries = {};
for (const [id, c] of C) {
  if (!c.tag) continue;
  const tech = techByCountry.get(id);
  const sums = side => Object.fromEntries(Object.entries(c.building_budget[side]).map(([k, v]) => [k, +Object.values(v).reduce((a, x) => a + x, 0).toFixed(2)]));
  const blds = {}; for (const [k, r] of bldByCountry) { const [ci, ty] = k.split('|'); if (+ci === id) blds[ty] = r; }
  const gout = {}, gin = {};
  for (const [k, v] of goodsOut) { const i = k.indexOf('|'); if (+k.slice(0, i) === id && v) gout[k.slice(i + 1)] = +v.toFixed(2); }
  for (const [k, v] of goodsIn) { const i = k.indexOf('|'); if (+k.slice(0, i) === id && v) gin[k.slice(i + 1)] = +v.toFixed(2); }
  countries[c.tag] = {
    id, market: c.market, government: c.government, country_type: c.country_type, is_main_tag: c.is_main_tag,
    overlord: overlord.has(id) ? tagOf(overlord.get(id)) : null,
    own_market_pact: ownMarket.has(id) || null,
    gdp: c.gdp, prestige: c.prestige, literacy: c.literacy, avg_sol: c.avg_sol,
    money: c.money, credit: c.credit, investment_pool: c.investment_pool,
    base_wage: c.base_wage, average_productivity: c.average_productivity,
    last_bankruptcy_date: c.last_bankruptcy_date,
    weekly_expenses: c.weekly_expenses, weekly_income: c.weekly_income,
    building_budget: {
      expense: c.building_budget.expense, income: c.building_budget.income,
      expense_by_category: sums('expenses'), income_by_category: sums('incomes'),
      // the two lines this instrument was built for — per BUILDING TYPE, per country, per quarter
      subsidies: c.building_budget.expenses.subsidies ?? {},
      subventions: c.building_budget.expenses.subventions ?? {},
    },
    strata: c.strata, professions: c.professions, workforce_by_profession: c.workforce_by_profession,
    pop_statistics: c.pop_stats,
    technologies: tech ? tech.acquired.length : 0,
    researching: tech?.researching ?? null,
    technologies_held: tech ? tech.acquired : [],
    foreign_owned_levels: foreignOwned.get(id) ?? 0,
    owned_abroad_levels: ownedAbroad.get(id) ?? 0,
    buildings: blds, goods_out: gout, goods_in: gin,
  };
}

// ⭐ TOP PRODUCERS BY GOOD — the mod's central claim ("efficient producers drive inefficient ones out")
// as one readable table.  Quantities kept, not just the ordering: a near-monopoly and a three-way tie are
// the same ranking and completely different economies.
const byGood = new Map();
for (const [k, v] of goodsOut) {
  const i = k.indexOf('|'); const tag = tagOf(+k.slice(0, i)); if (!tag || !v) continue;
  const g = k.slice(i + 1); (byGood.get(g) ?? byGood.set(g, []).get(g)).push([tag, +v.toFixed(1)]);
}
const top_producers = {};
for (const [g, rows] of [...byGood].sort()) {
  rows.sort((a, x) => x[1] - a[1]);
  top_producers[g] = { world: +rows.reduce((a, r) => a + r[1], 0).toFixed(1), top: rows.slice(0, TOPN) };
}

const world = { buildings: {}, gdp: 0, population: 0 };
for (const [, r] of bldByCountry) { void r; }
for (const [k, r] of bldByCountry) {
  const ty = k.slice(k.indexOf('|') + 1);
  const w = world.buildings[ty] ??= { n: 0, levels: 0, subsidised_levels: 0 };
  w.n += r.n; w.levels += r.levels; w.subsidised_levels += r.subsidised_levels;
}
for (const c of Object.values(countries)) { world.gdp += c.gdp || 0; world.population += Object.values(c.professions).reduce((a, x) => a + x, 0); }
world.gdp = Math.round(world.gdp); world.population = Math.round(world.population);

const out = {
  save_summary_version: SAVE_SUMMARY_VERSION,
  provenance: {
    source: basename(SRC === '-' ? (argOf('--source-name', 'stdin')) : SRC),
    date: saveDate,
    generated_utc: new Date().toISOString(),
    reader: 'tools/testbed/save_state_summary.mjs',
    // ⚠ `strip` is not decoration. PowerShell 5.1's `Out-File -Encoding utf8` writes a BOM, so a
    // provenance file authored by hand rather than by the scheduler's BOM-less WriteAllText makes
    // JSON.parse throw — and it throws AFTER the whole melt has been parsed, so the save is never
    // summarised and (correctly) never reaped. Caught on a dry run; it would have cost a batch.
    ...(PROV && existsSync(PROV) ? JSON.parse(strip(readFileSync(PROV, 'utf8'))) : {}),
  },
  not_captured: NOT_CAPTURED,
  world,
  countries,
  top_producers,
};

// ⚠ GZIP WHEN THE NAME SAYS SO.  A quarterly century is ~400 summaries per run and this schema is
// deliberately generous (2.2 MB raw), so a 6-run batch would stand at ~5 GB of JSON.  gzip takes it to
// ~10 % at no loss; `harvest_saves.ps1` therefore writes `.json.gz`.  Plain `.json` still works and is
// what you want when poking at a single save by hand.
const json = JSON.stringify(out);
if (OUT) {
  let bytes = Buffer.from(json, 'utf8');
  if (/\.gz$/i.test(OUT)) bytes = (await import('node:zlib')).gzipSync(bytes, { level: 6 });
  writeFileSync(OUT, bytes);
  console.error(`${saveDate} · ${Object.keys(countries).length} countries · ${Object.keys(top_producers).length} goods · ${(json.length / 1024).toFixed(0)} KB raw / ${(bytes.length / 1024).toFixed(0)} KB written -> ${OUT}`);
} else process.stdout.write(json);

// ---------------------------------------------------------------- optional corroboration
// ⚠ The profession index mapping is a MEASURED result, not a convention.  This mode re-derives the same
// numbers the expensive way (the labelled pop table) so the cheap path can be re-checked after a patch.
if (VERIFY_POPS && SRC !== '-' && !IS_SAVE) {
  const byType = new Map();
  let sec = false, d2 = 0, p = null;
  const flush = () => { if (p && p.type) { const s = (p.w || 0) + (p.d || 0); if (s > 0) add(byType, p.type, s); } p = null; };
  const rl2 = createInterface({ input: createReadStream(SRC, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl2) {
    const t = line.trim();
    if (!sec) { if (t === 'pops={') { sec = true; d2 = 1; } continue; }
    let o2 = 0, c2 = 0; for (let i = 0; i < t.length; i++) { const ch = t.charCodeAt(i); if (ch === 123) o2++; else if (ch === 125) c2++; }
    const m = /^(\d+)=\{$/.exec(t);
    if (m && d2 === 2) { flush(); p = { type: null, w: 0, d: 0 }; }
    else if (p) {
      let x;
      if ((x = /^type="([a-z_]+)"$/.exec(t))) p.type = x[1];
      else if ((x = /^workforce=(\d+)$/.exec(t))) p.w = +x[1];
      else if ((x = /^dependents=(\d+)$/.exec(t))) p.d = +x[1];
    }
    d2 += o2 - c2; if (d2 <= 0) { flush(); break; }
  }
  const fromCountries = new Map();
  for (const c of Object.values(countries)) for (const [k, v] of Object.entries(c.professions)) add(fromCountries, k, v);
  console.error('\nVERIFY-POPS — labelled pop table vs the country records\' population_by_profession');
  let worst = 0;
  for (const ty of POP_TYPES) {
    const a = byType.get(ty) || 0, bq = fromCountries.get(ty) || 0;
    const err = a ? Math.abs(bq - a) / a * 100 : (bq ? 100 : 0); worst = Math.max(worst, err);
    console.error(`  ${ty.padEnd(12)} ${Math.round(a).toLocaleString('en-US').padStart(14)} ${Math.round(bq).toLocaleString('en-US').padStart(14)}  ${err.toFixed(3)}%`);
  }
  console.error(`  worst divergence ${worst.toFixed(3)}%  ${worst < 1 ? '— mapping CONFIRMED' : '— ⚠ MAPPING SUSPECT, do not trust the profession columns'}`);
}
