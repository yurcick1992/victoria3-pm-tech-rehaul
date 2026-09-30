// WHO MAKES AN INTEREST GROUP'S CLOUT — POP BY POP, BY WORKPLACE (user-asked 2026-10-01: "Can you directly measure clout effects (pop-level
// contributions) in our current employees of the artisan industries, compared to canon and to vanilla?").
//
//   node tools/testbed/ledger/ig_pop_contrib.mjs <save.v3|melt.txt> [--keys k1,k2,…] [--ig ig_petty_bourgeoisie] [--top 12]
//        [--minwf 1000000] [--json out]
//
// ⭐ WHAT A SAVE STORES PER POP: `interest_group_support_data.interest_group_support_array = { 8 i=v … }` — a count (the 8 IG definitions,
// index = ALPHABETICAL file order of common/interest_groups: 0 armed_forces … 5 petty_bourgeoisie, 6 rural_folk, 7 trade_unions) and sparse
// index=value pairs. MEASURED 2026-10-01 (FINDINGS F192): the values are the pop's POLITICALLY ENGAGED MEMBERS of each IG, in millions —
// per head they rise with engagement (clergymen, bureaucrats, capitalists 2.1–2.4 × 10⁻⁶, laborers and peasants ~0.5), NOT with wealth, and
// summed per country they are far from the IG's clout (rural folk hold the most members and little strength). An IG's POLITICAL STRENGTH
// weights those members by wealth (and by law modifiers the save does not break out): exp(wealth/5) fits the IG records' strength best of
// the forms tried (ln-residual MAD 0.58 against 0.63 for wealth², 1.00 for wealth, 1.42 unweighted).
// ⇒ Two readings, both printed: MEMBERS (exact: the class's share of the IG's members) and ATTRIBUTED CLOUT (approximate: each country's IG
//   clout shared out over its pops ∝ members × exp(wealth/5), so the country totals are the recorded clout by construction and only the
//   split inside a country rests on the fitted weight). The world line is the MEAN over main countries — F190's metric, decomposed.
// A pop's country is its location's state owner; its workplace is the building record's FULL id (craft_fill.mjs's rule).
// --keys (default: the six craft keys = the six light industries' e0 in a four-rung book, the WHOLE industry in vanilla).
import { spawn } from 'node:child_process';
import { createReadStream, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const SRC = args.find((a, i) => !a.startsWith('--') && (i === 0 || !args[i - 1].startsWith('--')));
const KEYS = new Set(argOf('--keys', 'building_food_industry,building_textile_mill,building_furniture_manufactory,building_glassworks,building_tooling_workshop,building_paper_mill').split(','));
const IG = argOf('--ig', 'ig_petty_bourgeoisie');
const TOP = +argOf('--top', '12');
const MINWF = +argOf('--minwf', '1000000');
const OUT = argOf('--json', '');
const GAME = argOf('--game', 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game');
if (!SRC) { console.error('usage: ig_pop_contrib.mjs <save.v3|melt.txt> [--keys …] [--ig …] [--top N] [--minwf N] [--json out]'); process.exit(2); }
const IGS = readdirSync(join(GAME, 'common/interest_groups')).filter(f => /^00_[a-z_]+\.txt$/.test(f)).sort().map(f => 'ig_' + f.slice(3, -4));
const IGI = IGS.indexOf(IG);
if (IGS.length !== 8 || IGI < 0) throw new Error(`interest group files read as [${IGS}] — expected 8 including ${IG}; the index mapping is no longer safe`);
const WT = w => Math.exp(w / 5);

function lines(src) {
  if (!/\.v3$/i.test(src)) return createInterface({ input: createReadStream(src, { encoding: 'utf8' }), crlfDelay: Infinity });
  const rak = join(HERE, '..', '..', 'vendor', 'rakaly', 'rakaly.exe');
  if (!existsSync(rak)) throw new Error(`rakaly not found at ${rak}`);
  const p = spawn(rak, ['melt', '--format', 'vic3', '--unknown-key', 'stringify', '-c', src], { stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout.setEncoding('utf8');
  return createInterface({ input: p.stdout, crlfDelay: Infinity });
}

const pops = [];
const bKey = new Map(), stateCountry = new Map(), tagOf = new Map(), mainTag = new Set(), igClout = new Map();
let date = '', mode = 'top', pop = null, id = null, inSup = false, ig = null;
const flushIg = () => { if (ig && ig.def && ig.country != null) igClout.set(`${ig.country}|${ig.def}`, ig.clout); ig = null; };
for await (const line of lines(SRC)) {
  if (mode === 'top') {
    if (!date) { const d = /^date=(\d+\.\d+\.\d+)/.exec(line); if (d) { date = d[1]; continue; } }
    const s = /^([a-z_]+)=\{$/.exec(line); if (!s) continue;
    mode = ['pops', 'building_manager', 'states', 'country_manager', 'interest_groups'].includes(s[1]) ? s[1] : 'skip'; continue;
  }
  if (mode === 'skip') { if (line.charCodeAt(0) === 125) mode = 'top'; continue; }
  if (line.charCodeAt(0) === 125) { if (pop) pops.push(pop); pop = null; flushIg(); mode = 'top'; id = null; continue; }
  if (line.startsWith('\t\t') && !line.startsWith('\t\t\t')) {
    const m = /^\t\t(\d+)=\{$/.exec(line);
    if (mode === 'pops') { if (pop) pops.push(pop); pop = m ? { type: null, w: 0, wealth: 0, loc: -1, wp: null, sup: null } : null; inSup = false; }
    else if (mode === 'interest_groups') { flushIg(); ig = m ? { country: null, def: null, clout: 0 } : null; }
    else id = m ? +m[1] : null;
    continue;
  }
  if (mode === 'pops' && pop) {
    if (inSup && line.startsWith('\t\t\t\t\t')) {
      pop.sup = new Float64Array(8);
      for (const kv of line.trim().split(/\s+/).slice(1)) { const [i, v] = kv.split('='); pop.sup[+i] = +v; }
      inSup = false; continue;
    }
    if (line === '\t\t\t\tinterest_group_support_array={') { inSup = true; continue; }
    if (!line.startsWith('\t\t\t') || line.startsWith('\t\t\t\t')) continue;
    const t = line.slice(3);
    if (t.startsWith('type="')) pop.type = t.slice(6, -1);
    else if (t.startsWith('workforce=')) pop.w = +t.slice(10);
    else if (t.startsWith('wealth=')) pop.wealth = +t.slice(7);
    else if (t.startsWith('location=')) pop.loc = +t.slice(9);
    else if (t.startsWith('workplace=')) pop.wp = +t.slice(10);
    continue;
  }
  if (!line.startsWith('\t\t\t') || line.startsWith('\t\t\t\t')) continue;
  const t = line.slice(3);
  if (mode === 'building_manager' && id !== null) { if (t.startsWith('building="')) bKey.set(id, t.slice(10, -1)); }
  else if (mode === 'states' && id !== null) { if (t.startsWith('country=')) stateCountry.set(id, +t.slice(8)); }
  else if (mode === 'country_manager' && id !== null) { if (t.startsWith('definition="')) { if (!tagOf.has(id)) tagOf.set(id, t.slice(12, -1)); } else if (t === 'is_main_tag=yes') mainTag.add(id); }
  else if (mode === 'interest_groups' && ig) {
    let x; if ((x = /^country=(\d+)$/.exec(t))) ig.country = +x[1]; else if ((x = /^definition="([a-z_0-9]+)"$/.exec(t))) ig.def = x[1]; else if ((x = /^clout=([-\d.e]+)$/.exec(t))) ig.clout = +x[1];
  }
}
if (!pops.length || !igClout.size) throw new Error('no pops or no interest groups parsed — not a vic3 gamestate?');

// ---- per country: members and weighted members per IG, all and in the class, by profession
const C = new Map();
const z = () => new Float64Array(8);
const cOf = c => C.get(c) ?? C.set(c, { wf: 0, clsWf: 0, mem: z(), wm: z(), cMem: z(), cWm: z(), byType: {} }).get(c);
for (const p of pops) {
  const c = stateCountry.get(p.loc); if (c == null) continue;
  const x = cOf(c); x.wf += p.w;
  const inCls = p.wp != null && KEYS.has(bKey.get(p.wp));
  if (inCls) { x.clsWf += p.w; const b = x.byType[p.type] ??= { wf: 0, mem: z(), wm: z() }; b.wf += p.w; if (p.sup) for (let i = 0; i < 8; i++) { b.mem[i] += p.sup[i]; b.wm[i] += p.sup[i] * WT(p.wealth); } }
  if (!p.sup) continue;
  const wt = WT(p.wealth);
  for (let i = 0; i < 8; i++) { x.mem[i] += p.sup[i]; x.wm[i] += p.sup[i] * wt; if (inCls) { x.cMem[i] += p.sup[i]; x.cWm[i] += p.sup[i] * wt; } }
}
const main = [...C].filter(([c, x]) => mainTag.has(c) && tagOf.has(c) && x.wf > 0);
const clout = (c, i) => igClout.get(`${c}|${IGS[i]}`) ?? 0;
const attr = (c, x, i, wm = x.cWm[i]) => x.wm[i] > 0 ? clout(c, i) * wm / x.wm[i] : 0;     // the class's attributed clout
const mean = f => main.reduce((a, [c, x]) => a + f(c, x), 0) / main.length;
const sum = f => main.reduce((a, [c, x]) => a + f(c, x), 0);
const pct = (v, d = 2) => (100 * v).toFixed(d);

console.log(`${date} · ${pops.length.toLocaleString('en-US')} pops · ${main.length} main countries · class = workers of ${[...KEYS].map(k => k.replace('building_', '')).join(', ')}`);
console.log(`\nWORLD — ${IG}: mean clout ${pct(mean((c) => clout(c, IGI)))}% · of which attributed to the class ${pct(mean((c, x) => attr(c, x, IGI)), 3)} points · class share of workforce (mean) ${pct(mean((c, x) => x.clsWf / x.wf))}% (total ${pct(sum((c, x) => x.clsWf) / sum((c, x) => x.wf))}%)`);
console.log(`   members: the class holds ${pct(sum((c, x) => x.cMem[IGI]) / sum((c, x) => x.mem[IGI]))}% of the ${IG.replace('ig_', '')}'s members world-wide; ${pct(sum((c, x) => x.cMem[IGI]) / sum((c, x) => x.cMem.reduce((a, b) => a + b, 0)))}% of the class's own members sit in it`);
console.log('   the class\'s attributed clout in EVERY IG (mean points): ' + IGS.map((g, i) => `${g.slice(3)} ${pct(mean((c, x) => attr(c, x, i)), 3)}`).join(' · '));
const types = {};
for (const [c, x] of main) for (const [ty, b] of Object.entries(x.byType)) { const a = types[ty] ??= { wf: 0, mem: 0, att: 0 }; a.wf += b.wf; a.mem += b.mem[IGI]; a.att += attr(c, x, IGI, b.wm[IGI]) / main.length; }
console.log('   by profession in the class: ' + Object.entries(types).sort((a, b) => b[1].wf - a[1].wf).map(([ty, a]) => `${ty} ${(a.wf / 1e3).toFixed(0)}k workers, ${a.wf ? (a.mem * 1e6 / a.wf).toFixed(2) : '·'} ${IG.slice(3, 8)} members a worker, ${pct(a.att, 3)} points`).join(' · '));

// across countries (workforce ≥ --minwf): the IG's clout against the class's workforce share
const big = main.filter(([, x]) => x.wf >= MINWF);
const corr = (a, b) => { const n = a.length, ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n; let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return saa && sbb ? sab / Math.sqrt(saa * sbb) : NaN; };
const slope = (a, b) => { const n = a.length, ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n; let sab = 0, saa = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; } return saa ? sab / saa : NaN; };
const xs = big.map(([, x]) => x.clsWf / x.wf), ys = big.map(([c]) => clout(c, IGI)), as = big.map(([c, x]) => attr(c, x, IGI)), rest = big.map(([c, x]) => clout(c, IGI) - attr(c, x, IGI));
console.log(`\nACROSS COUNTRIES with workforce ≥ ${(MINWF / 1e6).toFixed(1)}M (n=${big.length}): r(class share, ${IG.slice(3)} clout) ${corr(xs, ys).toFixed(2)} · r(share, the class's attributed part) ${corr(xs, as).toFixed(2)} · r(share, the rest) ${corr(xs, rest).toFixed(2)} · slope of the attributed part ${slope(xs, as).toFixed(2)} clout per unit share`);
console.log(`\nTOP ${TOP} by the class's workforce: tag  workforce(k)  class share  ${IG.slice(3)} clout  attributed to the class  class share of its members`);
for (const [c, x] of [...main].sort((a, b) => b[1].clsWf - a[1].clsWf).slice(0, TOP))
  console.log(`   ${tagOf.get(c).padEnd(5)} ${(x.wf / 1e3).toFixed(0).padStart(8)} ${pct(x.clsWf / x.wf, 1).padStart(6)}% ${pct(clout(c, IGI), 1).padStart(8)}% ${pct(attr(c, x, IGI), 2).padStart(9)}  ${x.mem[IGI] > 0 ? pct(x.cMem[IGI] / x.mem[IGI], 0) + '%' : '·'}`);
if (OUT) writeFileSync(OUT, JSON.stringify({ date, src: SRC, keys: [...KEYS], ig: IG, countries: Object.fromEntries(main.map(([c, x]) => [tagOf.get(c), { wf: x.wf, clsWf: x.clsWf, clout: clout(c, IGI), attr: attr(c, x, IGI), mem: x.mem[IGI], cMem: x.cMem[IGI] }])) }));
