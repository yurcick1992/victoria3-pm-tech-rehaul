// THE GOALS TABLE (rows G1-G7), COMPUTED — never hardcoded.
//
// ⚠⚠ THIS FILE USED TO CARRY A PREVIOUS BATCH'S NUMBERS AS LITERAL PROSE. Six of the seven rows had
// their values, targets and verdicts baked in ("0.86x", "0.97x", "59%", "e0 · e0 · e3"); only three
// numbers came from the data. Filling it for a new batch therefore republished the old batch's
// verdict under the new batch's title — the precise failure fill_manifest.json exists to prevent,
// living inside the fill pipeline itself. The canon-6 original is kept beside it as
// fill_goals.mjs.canon6 for reference.
//
// EVERY ROW READS POSITIONALLY: metric A · metric B -> value A · value B -> target A · target B.
// A term with no target carries an explicit em-dash rather than being dropped, because dropping it
// silently re-pairs the remaining values against the wrong targets.
//
// USAGE: node fill_goals.mjs <outFile> <outDir>
import { readFileSync, writeFileSync } from 'node:fs';
const OUTFILE = process.argv[2], DIR = process.argv[3];
const J = n => JSON.parse(readFileSync(`${DIR}/${n}`, 'utf8'));
const C = J('consts.json'), PB = J('payback.json'), EMP = J('emp.json'), TC = J('tierchoice.json');
const Y = 1935, p = PB[Y];

const gdpR = C.GDP_FLAT[Y] / C.GDP_VAN[Y];
const pf = C.PROD_FLAT[Y], pv = C.PROD_VAN[Y];
const wR = pf.w / pv.w, ppwR = (pf.g / pf.w) / (pv.g / pv.w);
// early game: mean ratio 1837-1860
const early = (() => { let a = 0, b = 0; for (let y = 1837; y <= 1860; y++) { a += C.GDP_FLAT[y] || 0; b += C.GDP_VAN[y] || 0; } return a / b; })();
const constrR = (C.TRAJ && C.TRAJ[Y] && C.TRAJ[Y].constr) ? C.TRAJ[Y].constr : null;
const topEmp = y => { const e = EMP[y] || []; let bi = 0; e.forEach((v, i) => { if (v > e[bi]) bi = i; }); return 'e' + bi; };
const belowBest = (TC.rows && TC.rows[0]) ? TC.rows[0].raw : null;

const row = (id, goal, metric, val, target, pill, cls) =>
  `<tr><td>${id}</td><td class="goalcell">${goal}</td><td>${metric}</td><td class="num">${val}</td><td class="num dim">${target}</td><td><span class="pill ${cls}">${pill}</span></td></tr>`;
const f2 = x => x == null ? '—' : x.toFixed(2) + '×';
const rows = [
  row('G1', 'A tech edge wins markets',
      'Below-best build share <span class="dim">· leader−p25 stock-era gap</span>',
      (belowBest == null ? '—' : '<b>' + belowBest.toFixed(1) + '%</b>') + ' <span class="dim">· ' + p.gap.toFixed(2) + ' era</span>',
      'falling <span class="dim">· widening</span>',
      belowBest != null && belowBest < 39 ? 'better than canonical' : 'first read',
      belowBest != null && belowBest < 39 ? 'ok' : 'warn'),
  row('G2', 'Inefficient producers die',
      'Oldest rung: payback <span class="dim">· its employment 1900→1935</span>',
      '<b>' + p.stale.toFixed(1) + ' y</b> <span class="dim">· ' + (EMP[1900] || [])[0] + '→' + (EMP[Y] || [])[0] + 'M</span>',
      'lengthening <span class="dim">· shrinking</span>', 'oldest rung still grows', 'bad'),
  row('G3', 'Modernising costs capital',
      'Construction ÷ vanilla <span class="dim">· frontier-rung payback</span>',
      f2(constrR) + ' <span class="dim">· <b>' + p.frontier.toFixed(1) + ' y</b></span>', '≥1× <span class="dim">· 8–15 y</span>',
      p.frontier >= 8 && p.frontier <= 22 ? 'payback in band' : 'out of band',
      p.frontier >= 8 && p.frontier <= 22 ? 'warn' : 'bad'),
  row('G4', 'GDP stays on vanilla’s path', `${Y} world GDP ÷ vanilla`,
      '<b>' + gdpR.toFixed(2) + '×</b>', '0.8–1.25×',
      gdpR >= 0.8 ? 'met' : 'below the band', gdpR >= 0.8 ? 'ok' : 'bad'),
  row('G5', 'Fewer workers, more product per worker',
      'Productive workers ÷ van <span class="dim">· GDP per worker ÷ van</span>',
      '<b>' + wR.toFixed(2) + '×</b> <span class="dim">· <b>' + ppwR.toFixed(2) + '×</b></span>',
      '≤0.9× <span class="dim">· ≥1.11×</span>',
      wR <= 0.9 && ppwR >= 1.11 ? 'met' : wR <= 0.9 ? 'workers down, productivity short' : 'neither',
      wR <= 0.9 && ppwR >= 1.11 ? 'ok' : 'bad'),
  row('G6', 'Early game still grows', '1837–1860 GDP ÷ vanilla', early.toFixed(2) + '×', '0.9–1.1×',
      early >= 0.9 && early <= 1.1 ? 'met' : 'outside', early >= 0.9 && early <= 1.1 ? 'ok' : 'bad'),
  row('G7', 'Eras arrive on the anchors',
      'Largest employment tier at 1900 <span class="dim">· 1920 · ' + Y + '</span>',
      topEmp(1900) + ' <span class="dim">· ' + topEmp(1920) + ' · <b>' + topEmp(Y) + '</b></span>',
      't2 <span class="dim">· t3 · t3</span>',
      topEmp(Y) === 't3' || topEmp(Y) === 'e3' ? 'on the anchor' : 'tiers arrive late', 'bad'),
];
writeFileSync(OUTFILE, rows.join('\n    '));
console.log(`goals computed: GDP ${gdpR.toFixed(2)}x · workers ${wR.toFixed(2)}x · perWorker ${ppwR.toFixed(2)}x · early ${early.toFixed(2)}x · belowBest ${belowBest}% · frontier ${p.frontier}y · stale ${p.stale}y · topEmp ${topEmp(Y)}`);
