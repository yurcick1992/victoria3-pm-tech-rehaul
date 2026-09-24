// WHAT DOES THE MARKET LINE'S import / export COLUMN ACTUALLY REPORT? (TESTBED_METRICS §2.5, FINDINGS F161 §5)
// Checks, per instrumented market and good at one dump date, the telemetry `G|` line against the members' trade capacity
// from the save summary of the same date (v10+: countries.<tag>.trade.goods {imp, exp}) × the arm's traded quantity.
// The rule it was written to test, and what it found on 20260923_215141 (1840 pair by pair, 1850 on the worked cases):
//   - a good the market trades in ONE direction reads capacity × traded_quantity × (1 + the centres' quantity mult);
//   - a good traded BOTH ways reads the DOMINANT direction at its full gross effective volume and 0 for the other,
//     never the net — "dominant" decided on the effective volume, not on capacity.
// The quantity multiplier is not in the summary, so it is ESTIMATED per market as the median line ÷ (capacity × tq) over the
// one-direction goods and printed; where members run different centre methods a good's line is their sum and can miss.
//   node tools/testbed/ledger/market_line_check.mjs <runDir> <date> [--config <book>] [--show 12]
// The book defaults to the run's own build_state (deterministic.mod_under_test.built_from_config); the token is meta.json's.
import fs from 'node:fs'; import zlib from 'node:zlib'; import path from 'node:path';
import { goodsTable, tradedQuantity } from './lib_goods.mjs';
import { MARKET_NAMES } from './lib_markets.mjs';

const argv = process.argv.slice(2);
const opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const [runDir, date] = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
if (!runDir || !date) { console.error('usage: market_line_check.mjs <runDir> <date> [--config <book>] [--show N]'); process.exit(2); }
const show = +(opt('--show') ?? 12);

const meta = JSON.parse(fs.readFileSync(path.join(runDir, 'meta.json'), 'utf8'));
const token = meta.token; if (!token) throw new Error('meta.json carries no telemetry token: ' + runDir);
let cfgPath = opt('--config');
if (!cfgPath) {
  const bs = JSON.parse(fs.readFileSync(path.join(runDir, 'build_state.json'), 'utf8'));
  cfgPath = bs.deterministic?.mod_under_test?.built_from_config;
}
const cfg = cfgPath ? JSON.parse(fs.readFileSync(cfgPath, 'utf8')) : null;   // a control arm has no book: vanilla quantities
const tq = tradedQuantity(cfg, goodsTable());

const sd = path.join(runDir, 'save_summaries');
const f = fs.readdirSync(sd).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.'))
  .find(x => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(sd, x)))).provenance?.date === date);
if (!f) throw new Error(`no save summary dated ${date} in ${sd}`);
const j = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(sd, f))));
if ((j.save_summary_version || 0) < 10) throw new Error(`summary v${j.save_summary_version}: per-good trade capacity needs v10+`);

// The run's OWN G| lines (the mirror carries foreign sessions' lines too): V3TB|<token>|G|<date>|<market>|<good>|…|imp|exp
const G = {};
for (const dir of ['logs_live', 'logs']) {
  const p = path.join(runDir, dir, 'debug.log'); if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split('\n')) {
    const k = l.indexOf('V3TB|' + token + '|G|' + date + '|'); if (k < 0) continue;
    const q = l.slice(k).trim().split('|'); (G[q[4]] ??= {})[q[5]] = { imp: +q[9], exp: +q[10] };
  }
  if (Object.keys(G).length) break;
}
if (!Object.keys(G).length) throw new Error(`no G| lines for token ${token} at ${date}`);

// A market NAME does not identify its leader (Dutch = NET or UNL; the German market reads PRU → NGF → GER): take the first
// tag carrying that name that exists in this save.
const leaderOf = name => Object.entries(MARKET_NAMES).filter(([, ns]) => ns.includes(name)).map(([t]) => t).find(t => j.countries[t]);

const tally = { one_way_match: 0, one_way_miss: 0, two_way_dominant_gross_minor_zero: 0, two_way_net: 0, two_way_both_gross: 0, two_way_other: 0, no_capacity_but_flow: 0 };
const odd = [], mult = {};
for (const [m, goods] of Object.entries(G)) {
  const tag = leaderOf(m); if (!tag) continue; const mk = j.countries[tag].market;
  const cap = {};
  for (const c of Object.values(j.countries)) if (c.market === mk)
    for (const [g, v] of Object.entries(c.trade?.goods || {})) { const x = (cap[g] ??= { imp: 0, exp: 0 }); x.imp += v.imp; x.exp += v.exp; }
  const rat = [];
  for (const [g, v] of Object.entries(goods)) { const c = cap[g] || { imp: 0, exp: 0 }; if (!tq[g]) continue;
    if ((c.imp > 0) !== (c.exp > 0)) rat.push((v.imp + v.exp) / ((c.imp + c.exp) * tq[g])); }
  rat.sort((a, b) => a - b); const M = rat.length ? rat[Math.floor(rat.length / 2)] : 1; mult[m] = M;
  const near = (a, b) => Math.abs(a - b) <= 0.02 * Math.max(1, b);
  for (const [g, v] of Object.entries(goods)) {
    const c = cap[g] || { imp: 0, exp: 0 }; const q = tq[g]; if (!q) continue;
    const I = c.imp * q * M, E = c.exp * q * M;
    if (c.imp > 0 && c.exp > 0) {
      const dom = I >= E ? 'imp' : 'exp';
      if (dom === 'imp' ? near(v.imp, I) && v.exp === 0 : near(v.exp, E) && v.imp === 0) tally.two_way_dominant_gross_minor_zero++;
      else if (dom === 'imp' ? near(v.imp, I - E) : near(v.exp, E - I)) tally.two_way_net++;
      else if (near(v.imp, I) && near(v.exp, E)) tally.two_way_both_gross++;
      else { tally.two_way_other++; odd.push([m, g, c, v, q]); }
    } else if (c.imp > 0 || c.exp > 0) {
      if (near(v.imp, I) && near(v.exp, E)) tally.one_way_match++; else { tally.one_way_miss++; odd.push([m, g, c, v, q]); }
    } else if (v.imp > 0 || v.exp > 0) { tally.no_capacity_but_flow++; odd.push([m, g, c, v, q]); }
  }
}
console.log(`${path.basename(runDir)} @ ${date}  (book ${cfgPath ? path.basename(cfgPath) : 'vanilla'}, token ${token})`);
for (const [k, v] of Object.entries(tally)) console.log(`  ${k.padEnd(36)} ${v}`);
console.log('  estimated quantity multiplier per market: ' + Object.entries(mult).map(([m, x]) => m.replace(' Market', '') + ' ' + x.toFixed(3)).join(', '));
if (odd.length) console.log(`  the ${Math.min(show, odd.length)} of ${odd.length} that do not fit (a two-way good whose members run different centre methods is the usual case):`);
for (const o of odd.slice(0, show)) console.log('   ', o[0], o[1], 'capacity', JSON.stringify(o[2]), 'line', JSON.stringify(o[3]), 'tq', o[4]);
