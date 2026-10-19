// treaty_port_trade.mjs — WHAT A TREATY PORT TRADES, AGAINST ITS HOST MARKET (FINDINGS F245, 2026-10-19).
// Melts one kept save for its per-state trade (the signed trade capacity per good each state spends; summaries keep only the
// per-country sum, and a port's trade sits under its TAKER's country while the port stands in the HOST's market), then per
// treaty port of the matching summary prints the port's capacity, its largest flows, and each good it imports as a share of the
// host market's supply (the market members' own production + their other imports, in units at the book's traded quantities).
// `--need TAG [--share 0.4]` instead prints the capacity a port would need to add that share of TAG's market supply of ten
// consumer goods (the hegemon case: F245's table).
// usage: node treaty_port_trade.mjs <save.v3> <summary.json.gz> <book.json>
//        node treaty_port_trade.mjs --need CHI <summary.json.gz> <book.json> [--share 0.4]
// ⚠ A save keeps no local prices (TESTBED_METRICS §7½): this reads volumes, not the price the imports make.
import { spawn } from 'child_process';
import { createInterface } from 'readline';
import fs from 'fs';
import zlib from 'zlib';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { goodsTable, tradedQuantity } from './lib_goods.mjs';

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const needTag = opt('--need'); const share = +(opt('--share') ?? 0.4);
const G = goodsTable();
const IDX = []; for (const [g, v] of Object.entries(G)) IDX[v.idx] = g;
const gz = f => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
const CONSUMER = ['clothes', 'fabric', 'furniture', 'groceries', 'glass', 'paper', 'tools', 'liquor', 'luxury_clothes', 'luxury_furniture'];

if (needTag) {
  const [sumFile, bookFile] = args; if (!sumFile || !bookFile) { console.error('usage: --need TAG <summary.json.gz> <book.json>'); process.exit(1); }
  const j = gz(sumFile); const TQ = tradedQuantity(JSON.parse(fs.readFileSync(bookFile)), G);
  const host = j.countries[needTag]; if (!host) { console.log(`${needTag} absent at ${j.provenance.date}`); process.exit(0); }
  const prod = {}, imp = {}, exp = {}; let gdp = 0;
  for (const c of Object.values(j.countries)) if (c.market === host.market) {
    gdp += c.gdp || 0;
    for (const [g, q] of Object.entries(c.goods_out || {})) prod[g] = (prod[g] || 0) + q;
    for (const [g, v] of Object.entries(c.trade?.goods || {})) { imp[g] = (imp[g] || 0) + v.imp * (TQ[g] || 0); exp[g] = (exp[g] || 0) + v.exp * (TQ[g] || 0); }
  }
  console.log(`${j.provenance.date} ${needTag}'s market: GDP £${(gdp / 1e6).toFixed(0)}M/yr; capacity to add ${100 * share}% of supply by port imports:`);
  let tot = 0;
  for (const g of CONSUMER) {
    const s = (prod[g] || 0) + (imp[g] || 0) - (exp[g] || 0); const cap = share * s / (TQ[g] || 1); tot += cap;
    console.log(`  ${g.padEnd(17)} supply ${s.toFixed(0).padStart(8)} u/wk · ${TQ[g]} u per capacity → ${cap.toFixed(0).padStart(6)}`);
  }
  console.log(`  TOTAL ${tot.toFixed(0)} capacity = ${(tot / 10).toFixed(0)} trade-centre levels ≈ ${(tot / 10).toFixed(0)}k clerks + shopkeepers (normal quantity method)`);
  process.exit(0);
}

const [save, sumFile, bookFile] = args;
if (!save || !sumFile || !bookFile) { console.error('usage: node treaty_port_trade.mjs <save.v3> <summary.json.gz> <book.json>'); process.exit(1); }
const rak = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'vendor', 'rakaly', 'rakaly.exe');
const p = spawn(rak, ['melt', '--format', 'vic3', '--unknown-key', 'stringify', '-c', save], { stdio: ['ignore', 'pipe', 'inherit'] });
p.stdout.setEncoding('utf8');
const rl = createInterface({ input: p.stdout, crlfDelay: Infinity });
// the states database comes early in a save: read it and stop (the same parse as save_state_summary.mjs's v10 trade)
let mode = 'top', depth = 0, sid = null, inTrade = false, good = null;
const st = {};
for await (const line of rl) {
  if (mode === 'top') { const s = /^([a-z_]+)=\{$/.exec(line); if (!s) continue; if (s[1] === 'states') { mode = 'states'; depth = 1; } else mode = 'skip'; continue; }
  if (mode === 'skip') { if (line.charCodeAt(0) === 125) mode = 'top'; continue; }
  const t = line.trim(); let x;
  const opens = (t.match(/\{/g) || []).length, closes = (t.match(/\}/g) || []).length;
  if (depth === 2 && (x = /^(\d+)=\{$/.exec(t))) { sid = +x[1]; st[sid] = { goods: {} }; inTrade = false; }
  else if (sid !== null && depth === 3) {
    if ((x = /^country=(\d+)$/.exec(t))) st[sid].country = +x[1];
    else if ((x = /^region="([A-Z_0-9]+)"$/.exec(t))) st[sid].region = x[1];
    else if ((x = /^trade_capacity=([\-\d.]+)$/.exec(t))) st[sid].cap = +x[1];
    else if ((x = /^trade_capacity_usage=([\-\d.]+)$/.exec(t))) st[sid].use = +x[1];
    else if (t === 'trade={') { inTrade = true; good = null; }
  } else if (inTrade && sid !== null) {
    if (depth === 5 && (x = /^(\d+)=\{$/.exec(t))) good = IDX[+x[1]] ?? ('idx' + x[1]);
    else if (depth === 6 && good && (x = /^value=(-?[\d.]+)$/.exec(t))) st[sid].goods[good] = (st[sid].goods[good] || 0) + +x[1];
  }
  depth += opens - closes;
  if (inTrade && depth <= 3) inTrade = false;
  if (depth <= 0) break;
}
p.kill();

const j = gz(sumFile); const TQ = tradedQuantity(JSON.parse(fs.readFileSync(bookFile)), G);
const byId = {}; for (const [k, c] of Object.entries(j.countries)) byId[c.id] = { key: k, ...c };
const val = (g, cap) => cap * (TQ[g] || 0) * (G[g]?.cost || 0);
console.log(`${j.provenance.date}: ${(j.world.treaty_ports || []).length} treaty ports`);
for (const tp of j.world.treaty_ports || []) {
  // the list names the HOST's state in the region; the port is the taker's own state there
  const hostState = j.states[tp.state]; const taker = j.countries[tp.taker]; const host = j.countries[tp.giver];
  if (!hostState || !taker || !host) continue;
  const portId = Object.keys(st).find(id => st[id].region === hostState.region && st[id].country === taker.id);
  const port = portId ? st[portId] : null;
  console.log(`\n${tp.giver} > ${tp.taker}  ${hostState.region}: port state ${portId ?? '-'}, capacity ${port?.cap ?? 0}, used ${port?.use ?? 0}`);
  if (!port || !Object.keys(port.goods).length) continue;
  const flows = Object.entries(port.goods).sort((a, b) => Math.abs(val(b[0], b[1])) - Math.abs(val(a[0], a[1]))).slice(0, 10)
    .map(([g, v]) => `${g} ${v < 0 ? 'import' : 'export'} ${Math.abs(v).toFixed(0)} cap (£${(val(g, Math.abs(v)) / 1e3).toFixed(1)}k/wk base)`);
  console.log('  largest flows:', flows.join(' · '));
  const agg = {}, prod = {};
  for (const s of Object.values(st)) { const c = byId[s.country]; if (!c || c.market !== host.market) continue; for (const [g, v] of Object.entries(s.goods)) agg[g] = (agg[g] || 0) + v; }
  for (const c of Object.values(j.countries)) if (c.market === host.market) for (const [g, q] of Object.entries(c.goods_out || {})) prod[g] = (prod[g] || 0) + q;
  console.log('  imports as a share of the host market\'s supply (units/wk: port · market production · other imports → share):');
  for (const [g, v] of Object.entries(port.goods).filter(([, v]) => v < 0).sort((a, b) => val(b[0], -b[1]) - val(a[0], -a[1])).slice(0, 8)) {
    const pu = -v * (TQ[g] || 0), mi = Math.max(0, -(agg[g] || 0)) * (TQ[g] || 0), pr = prod[g] || 0;
    console.log(`     ${g.padEnd(16)} ${pu.toFixed(0).padStart(6)} · ${pr.toFixed(0).padStart(7)} · ${mi.toFixed(0).padStart(6)} → ${(100 * pu / (pu + mi + pr)).toFixed(1)}%`);
  }
}
