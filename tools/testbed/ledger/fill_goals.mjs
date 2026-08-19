// EVERY ROW READS POSITIONALLY: metric A · metric B  ->  value A · value B  ->  target A · target B.
// A term with no target carries an explicit em-dash rather than being dropped, because dropping it
// silently re-pairs the remaining values against the wrong targets - which is what made G3 read as
// "0.90x ... 8-15y".
import { readFileSync, writeFileSync } from 'node:fs';
const P = JSON.parse(readFileSync(process.argv[3], 'utf8'));
const y = 1935, p = P[y];
const row = (id, goal, metric, val, target, pill, cls) =>
  `<tr><td>${id}</td><td class="goalcell">${goal}</td><td>${metric}</td><td class="num">${val}</td><td class="num dim">${target}</td><td><span class="pill ${cls}">${pill}</span></td></tr>`;
const rows = [
  row('G1', 'A tech edge wins markets',
      'Frontier producers’ share of world output <span class="dim">· leader−p25 stock-era gap</span>',
      '59% <span class="dim">· ' + p.gap.toFixed(2) + ' era</span>', 'band TBD <span class="dim">· —</span>', 'first read', 'warn'),
  row('G2', 'Inefficient producers die',
      'Oldest rung: payback <span class="dim">· staffing · workers</span>',
      '<b>' + p.stale.toFixed(1) + ' y</b> <span class="dim">· 0.77 · grows 3.3→13.6M</span>',
      'lengthening <span class="dim">· falling · shrinking</span>', 'not met', 'bad'),
  row('G3', 'Modernising costs capital',
      'Construction ÷ vanilla <span class="dim">· frontier-rung payback</span>',
      '0.90× <span class="dim">· <b>' + p.frontier.toFixed(1) + ' y</b></span>', '≥1× <span class="dim">· 8–15 y</span>',
      'too cheap, pays back too fast', 'bad'),
  row('G4', 'GDP stays on vanilla’s path',
      '1935 world GDP ÷ vanilla <span class="dim">(median of 6)</span>',
      '<b>0.86×</b> <span class="dim">· runs 0.59–1.02×</span>', '0.8–1.25× <span class="dim">· —</span>', 'met at the median', 'ok'),
  row('G5', 'Fewer workers, more product per worker',
      'Productive workers ÷ van <span class="dim">· GDP per worker ÷ van</span>',
      '<b>0.86×</b> <span class="dim">· <b>1.00×</b></span>', '≤0.9× <span class="dim">· ≥1.11×</span>',
      'workers down, productivity flat', 'bad'),
  row('G6', 'Early game still grows', '1837–1860 GDP ÷ vanilla', '0.97×', '0.9–1.1×', 'met', 'ok'),
  row('G7', 'Eras arrive on the anchors', 'Largest employment era at 1900 <span class="dim">· 1920 · 1935</span>',
      'e0 <span class="dim">· e0 · <b>e3</b></span>', 'e3 <span class="dim">· e4 · e5</span>', 'two eras late', 'bad'),
];
writeFileSync(process.argv[2], rows.join('\n    '));
console.log('goal rows rebuilt with parallel terms; frontier payback ' + p.frontier + 'y, stale ' + p.stale + 'y, era gap ' + p.gap);
