// save_summary.mjs — the READABLE SUMMARY of a gamestate's pop table, aimed at the questions the
// "keyhole" telemetry could not answer.
//
//   node tools/testbed/save_summary.mjs <pops.tsv> [--game <dir>] [--band 10-20]
//
// ⭐ WHY THIS EXISTS. Every stalled question stalled on per-pop detail. The largest was F37's LEVEL
// question: to predict a debut good's demand you must know how much money its NEED holds, and that
// depends on the wealth mix of the pops — which the logs never carried. So the leisure and communication
// budget ratios were SWEPT (0.40–0.80 and 0–0.80) and the answer came out as a range. The save carries
// every pop's wealth level exactly, and `common/buy_packages` states the money each level puts on each
// need. The ratio is therefore MEASURED here, not assumed.
//
// ⚠ RATIOS ARE SCALE-FREE, ABSOLUTES ARE NOT. The need SHARES below need no scaling constants at all and
// are the robust output. The absolute £ additionally assume POP_SIZE_PACKAGE = 10 000 and the
// dependent factor, and are reported with both the documented and the measured factor so the difference
// is visible rather than buried.
//
// ⚠ WORLD-WIDE, NOT PER MARKET — the pop record carries its STATE (0x2819) but the state→country map
// lives in a database this tool does not yet parse. Do not read a world share as Britain's.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const SRC = args.find(a => !a.startsWith('--'));
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const GAME = argOf('--game', 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game');
const BAND = argOf('--band', '10-20').split('-').map(Number);
if (!SRC || !existsSync(SRC)) { console.error('usage: save_summary.mjs <pops.tsv> [--game <dir>]'); process.exit(1); }

const strip = s => s.replace(/^\uFEFF/, '');
const rd = p => strip(readFileSync(p, 'utf8'));

// ---- game data -------------------------------------------------------------------------------
// buy_packages: wealth_N = { goods = { popneed_x = N … } }
const PKG = new Map();                                   // wealth level -> {need: money}
{
  const txt = rd(join(GAME, 'common/buy_packages/00_buy_packages.txt'));
  const re = /^wealth_(\d+)\s*=\s*\{([\s\S]*?)\n\}/gm;
  let m;
  while ((m = re.exec(txt))) {
    const lvl = +m[1], goods = {};
    const g = /goods\s*=\s*\{([\s\S]*?)\}/.exec(m[2]);
    if (g) for (const [, k, v] of g[1].matchAll(/(popneed_\w+)\s*=\s*([\d.]+)/g)) goods[k] = +v;
    PKG.set(lvl, goods);
  }
}
// cultures, in definition order — the pop's 0x27dd is an index into this
const CULT = [];
for (const f of readdirSync(join(GAME, 'common/cultures')).filter(f => f.endsWith('.txt')).sort())
  for (const [, k] of rd(join(GAME, 'common/cultures', f)).matchAll(/^([a-z][a-z_]*)\s*=\s*\{/gm)) CULT.push(k);

// ---- pops ------------------------------------------------------------------------------------
const lines = rd(SRC).split('\n');
const head = lines[0].split('\t');
const C = Object.fromEntries(head.map((h, i) => [h, i]));
const F_SIZE = C['0x573a'], F_WORK = C['0x2fd5'], F_WEALTH = C['0x5556'], F_CULT = C['0x27dd'];
const pops = [];
for (let i = 1; i < lines.length; i++) {
  const p = lines[i].split('\t'); if (p.length < head.length) continue;
  const size = +p[F_SIZE] || 0; if (!size) continue;
  pops.push({ type: p[0], rel: p[1], size, work: +p[F_WORK] || 0, w: +p[F_WEALTH] || 0, cult: +p[F_CULT] });
}
const PEOPLE = pops.reduce((a, p) => a + p.size, 0);
const WORK   = pops.reduce((a, p) => a + p.work, 0);
const RATIO  = WORK / PEOPLE;

const bar = (v, max, n = 42) => '#'.repeat(Math.max(0, Math.round(v / max * n)));
const pct = (a, b) => (b ? a / b * 100 : 0);
const num = n => Math.round(n).toLocaleString();
const H = s => '\n' + '='.repeat(94) + '\n  ' + s + '\n' + '='.repeat(94);

console.log(H('1. POPULATION'));
console.log(`  people                 ${num(PEOPLE).padStart(16)}`);
console.log(`  workforce              ${num(WORK).padStart(16)}   = ${pct(WORK, PEOPLE).toFixed(1)}% of people`);
console.log(`  pop records            ${num(pops.length).padStart(16)}`);
console.log(`\n  ⚠ WORKING_ADULT_RATIO_BASE is 0.25; the realised ratio here is ${RATIO.toFixed(3)}. F25 found the`);
console.log(`    ratio is a law-set TARGET pops drift toward, and this is the drifted value.`);

console.log(H('2. WEALTH DISTRIBUTION  (people-weighted, not record-weighted)'));
const wh = new Map();
for (const p of pops) wh.set(p.w, (wh.get(p.w) || 0) + p.size);
const wmax = Math.max(...wh.values());
const meanW = pops.reduce((a, p) => a + p.w * p.size, 0) / PEOPLE;
console.log(`  people-weighted mean wealth level: ${meanW.toFixed(2)}\n`);
console.log(`  lvl        people    share`);
for (const lvl of [...wh.keys()].sort((a, b) => a - b)) {
  const v = wh.get(lvl);
  if (pct(v, PEOPLE) < 0.05 && lvl > 40) continue;
  console.log(`  ${String(lvl).padStart(3)} ${num(v).padStart(13)} ${pct(v, PEOPLE).toFixed(2).padStart(7)}%  ${bar(v, wmax)}`);
}

console.log(H(`3. WEALTH BAND ${BAND[0]}–${BAND[1]}  (the band being read in game)`));
{
  const inb = pops.filter(p => p.w >= BAND[0] && p.w < BAND[1]);
  const ppl = inb.reduce((a, p) => a + p.size, 0);
  console.log(`  people in band ${num(ppl)}  = ${pct(ppl, PEOPLE).toFixed(1)}% of the world\n`);
  const byType = new Map();
  for (const p of inb) byType.set(p.type, (byType.get(p.type) || 0) + p.size);
  console.log(`  who they are:`);
  for (const [t, v] of [...byType.entries()].sort((a, b) => b[1] - a[1]))
    console.log(`    ${t.padEnd(13)} ${num(v).padStart(13)} ${pct(v, ppl).toFixed(1).padStart(6)}% of band`);
  console.log(`\n  what ONE pop of each level in the band buys, per need (buy_packages, £ per package):`);
  const needs = [...new Set([...Array(BAND[1] - BAND[0]).keys()].flatMap(i => Object.keys(PKG.get(BAND[0] + i) || {})))];
  console.log(`    lvl  ` + needs.map(n => n.replace('popneed_', '').slice(0, 9).padStart(10)).join('') + '      total');
  for (let l = BAND[0]; l < BAND[1]; l++) {
    const g = PKG.get(l); if (!g) continue;
    const tot = Object.values(g).reduce((a, b) => a + b, 0);
    console.log(`    ${String(l).padStart(3)}  ` + needs.map(n => String(g[n] ?? '·').padStart(10)).join('') + String(tot).padStart(11));
  }
}

console.log(H('4. NEED BUDGETS  — ⭐ THIS IS WHAT F37 HAD TO SWEEP'));
{
  const budget = new Map();
  let unpriced = 0;
  for (const p of pops) {
    const g = PKG.get(p.w); if (!g) { unpriced += p.size; continue; }
    const scale = p.size / 10000;
    for (const k in g) budget.set(k, (budget.get(k) || 0) + g[k] * scale);
  }
  const TOT = [...budget.values()].reduce((a, b) => a + b, 0);
  const bmax = Math.max(...budget.values());
  console.log(`  Money each pop need holds, summed over every pop at its OWN measured wealth level.`);
  console.log(`  Shares need no scaling constants and are exact; the £ column omits the dependent factor`);
  console.log(`  (applied below) and POP_SIZE_PACKAGE is 10 000.\n`);
  console.log(`  need                        £ (package units)     share`);
  for (const [k, v] of [...budget.entries()].sort((a, b) => b[1] - a[1]))
    console.log(`  ${k.replace('popneed_', '').padEnd(22)} ${num(v).padStart(18)} ${pct(v, TOT).toFixed(2).padStart(8)}%  ${bar(v, bmax, 30)}`);
  if (unpriced) console.log(`\n  ⚠ ${num(unpriced)} people (${pct(unpriced, PEOPLE).toFixed(2)}%) sit at a wealth level with no buy package.`);

  const DEP_DOC = 0.625, DEP_MEAS = 0.5 + 0.5 * RATIO;
  console.log(`\n  DEPENDENT FACTOR. Needs are per working adult; dependents consume half. The sheet uses the`);
  console.log(`  documented 0.25 + 0.75x0.5 = ${DEP_DOC}. At the MEASURED workforce ratio ${RATIO.toFixed(3)} it is`);
  console.log(`  ${RATIO.toFixed(3)} + ${(1 - RATIO).toFixed(3)}x0.5 = ${DEP_MEAS.toFixed(3)}, i.e. ${((DEP_MEAS / DEP_DOC - 1) * 100).toFixed(1)}% more money than the sheet assumes.`);
  console.log(`  ⚠ This scales every need equally, so it moves LEVELS, never SHARES.`);

  // ⭐ THE QUANTITY F37 SWEPT is C/F — communication money over free_movement money. It had to be swept
  // because buy_packages makes it wealth-dependent (0 below wealth 20, then 0.34–0.80) and the wealth
  // mix was unknown. It is a single number once the mix is measured.
  const Cm = budget.get('popneed_communication') || 0, Fm = budget.get('popneed_free_movement') || 0;
  console.log(`\n  ⭐ C/F — THE RATIO F37 SWEPT OVER 0.34–0.80, NOW MEASURED`);
  console.log(`    communication  ${num(Cm).padStart(12)}`);
  console.log(`    free_movement  ${num(Fm).padStart(12)}`);
  console.log(`    C/F            ${(Cm / Fm).toFixed(4).padStart(12)}`);
  console.log(`    F37's binding-cap prediction  ratio = 3 + 4x(C/F) = ${(3 + 4 * Cm / Fm).toFixed(2)}   (measured 1912.3: 3.05)`);
  console.log(`  ⚠ WORLD-WIDE. F37 measured the BRITISH market, whose wealth mix is richer, so this is the`);
  console.log(`    right quantity but not yet the right population. Per-market needs the state->country map.`);

  // ⭐ WHEN A NEED SWITCHES ON. Several needs are absent from the buy package below some wealth level,
  // so the population that can buy them at all is a fraction of the world — which bounds a debut good's
  // demand before any supply-share rule is consulted.
  console.log(`\n  ⭐ WEALTH THRESHOLD PER NEED — how much of the world can buy this AT ALL`);
  const lvls = [...PKG.keys()].sort((a, b) => a - b);
  const allNeeds = [...new Set(lvls.flatMap(l => Object.keys(PKG.get(l))))];
  const cumAtOrAbove = w => pops.reduce((a, p) => a + (p.w >= w ? p.size : 0), 0);
  const rows = allNeeds.map(n => {
    const first = lvls.find(l => (PKG.get(l)[n] ?? 0) > 0) ?? Infinity;
    return { n, first, ppl: first === Infinity ? 0 : cumAtOrAbove(first) };
  }).sort((a, b) => a.first - b.first || b.ppl - a.ppl);
  console.log(`  need                   first at wealth      people who reach it     share of world`);
  for (const r of rows)
    console.log(`  ${r.n.replace('popneed_', '').padEnd(22)} ${String(r.first).padStart(12)} ${num(r.ppl).padStart(24)} ${pct(r.ppl, PEOPLE).toFixed(1).padStart(14)}%`);
}

console.log(H('5. BY PROFESSION'));
{
  const t = new Map();
  for (const p of pops) {
    const e = t.get(p.type) || { n: 0, size: 0, w: 0, work: 0 };
    e.n++; e.size += p.size; e.w += p.w * p.size; e.work += p.work; t.set(p.type, e);
  }
  console.log(`  profession        records         people   share   mean wealth   workforce%`);
  for (const [k, e] of [...t.entries()].sort((a, b) => b[1].size - a[1].size))
    console.log(`  ${k.padEnd(14)} ${num(e.n).padStart(9)} ${num(e.size).padStart(14)} ${pct(e.size, PEOPLE).toFixed(1).padStart(6)}% ${(e.w / e.size).toFixed(2).padStart(13)} ${pct(e.work, e.size).toFixed(1).padStart(12)}%`);
}

console.log(H('6. TOP CULTURES  (0x27dd resolved against common/cultures definition order)'));
{
  const t = new Map();
  for (const p of pops) { const e = t.get(p.cult) || { size: 0, w: 0 }; e.size += p.size; e.w += p.w * p.size; t.set(p.cult, e); }
  console.log(`  culture                  people   share   mean wealth`);
  for (const [k, e] of [...t.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 12))
    console.log(`  ${(CULT[k] ?? ('idx ' + k)).padEnd(20)} ${num(e.size).padStart(14)} ${pct(e.size, PEOPLE).toFixed(1).padStart(6)}% ${(e.w / e.size).toFixed(2).padStart(13)}`);
  console.log(`\n  (${CULT.length} cultures defined; the field ranges 0–316, which is what identified it.)`);
}
console.log('');
