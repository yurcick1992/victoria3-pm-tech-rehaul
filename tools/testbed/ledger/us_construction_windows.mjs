// WHERE ONE COUNTRY'S PRIVATE CONSTRUCTION GOES, IN WINDOWS (promoted from the session scratchpad 2026-10-02 as win_share2.mjs; FINDINGS
// F204 / F209 quote it): per run, the share of the private queue's points left — summed over the first summary of each year in the window —
// that is textile + furniture (the e2 merge hosts' industries, F204's capture) and that is the raw sector + infrastructure (mines, logging,
// farms, plantations, ranches, railways, ports, power, dams, trade centres).
//   node tools/testbed/ledger/us_construction_windows.mjs --arm label:session[:setup] [--arm …] [--country USA] [--windows 1846-1860,1860-1880]
//   prints per run:  <window>  textile+furniture % / raw+infrastructure %
import path from 'node:path';
import { indexRun, readSum, runsOf, firstOf } from './lib_sumidx.mjs';
const args = process.argv.slice(2);
const all = n => args.flatMap((a, i) => a === n ? [args[i + 1]] : []);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const TAG = argOf('--country', 'USA');
const WINS = argOf('--windows', process.env.WINS || '1846-1856,1856-1866').split(',').map(w => w.split('-').map(Number));
const TF = /^building_(textile_mill|furniture_manufactory)/;
const RAWINF = /^building_(.*_mine|logging_camp|oil_rig|rubber_plantation|fishing_wharf|whaling_station|gold_field|.*_farm|.*_plantation|.*_ranch|.*_orchards?|vineyard|railway|port|power_plant|dam_|trade_center)/;
if (!all('--arm').length) { console.error('usage: us_construction_windows.mjs --arm label:session[:setup] [--arm …] [--country USA] [--windows a-b,c-d]'); process.exit(1); }
console.log(`${TAG}: private construction (points left, first summary of each year) — textile+furniture % / raw+infrastructure % per window`);
for (const a of all('--arm')) {
  const [l, s, st] = a.split(':');
  for (const r of runsOf(s, st || null)) {
    const idx = indexRun(r); const per = {};
    for (let y = 1836; y < 1936; y++) { const d = firstOf(idx, y); if (!d) continue; const c = readSum(idx[d]).countries?.[TAG]; if (!c) continue;
      let tf = 0, ri = 0, tot = 0; for (const [k, v] of Object.entries(c.queues?.private?.by_type || {})) { tot += v.left || 0; if (TF.test(k)) tf += v.left || 0; if (RAWINF.test(k)) ri += v.left || 0; } per[y] = [tf, tot, ri]; }
    console.log(`${l.padEnd(7)} ${path.basename(r).slice(0, 6)}  ` + WINS.map(([a0, b0]) => { let tf = 0, tot = 0, ri = 0; for (let y = a0; y < b0; y++) if (per[y]) { tf += per[y][0]; tot += per[y][1]; ri += per[y][2]; } return `${a0}-${String(b0).slice(2)} ${tot ? (100 * tf / tot).toFixed(0).padStart(2) + '%/' + (100 * ri / tot).toFixed(0).padStart(2) + '%' : ' -'}`; }).join('   '));
  }
}
