// CAPITAL ABUNDANCE IN THE CLOSED MAJORS ACROSS THE RUN CORPUS (FINDINGS F231, 2026-10-13). Joins corpus_runs.jsonl (arm, config, world GDP)
// with corpus_countries.jsonl (corpus_country_extract.mjs: GER = GER > NGF > PRU, USA, FRA, BEL, NET, UNL, RUS) and reports, per label:
// the end state (1932–36 mean) U* and hoard against vanilla's, the first year U* (unemployed + peasants ÷ workforce) falls under 10% and 5%,
// and three abundance readings — HARD = the register's capital-abundance shape WITHOUT its 50M population gate (U* < 5% in ≥ 5 consecutive
// years ending by 1936 at a mean hoard ≥ 1.5 GDP; the gate would exclude France, ~40M), SOFT3 = 3 such years at ≥ 1.0 GDP, LOW5 = 5 years
// under 5% at any hoard — and how those rates move with the run's world GDP.
// usage: node tools/testbed/ledger/closed_major_abundance.mjs [--runs corpus_runs.jsonl] [--countries corpus_countries.jsonl]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const DIR = fileURLToPath(new URL('.', import.meta.url));
const argv = process.argv.slice(2); const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const load = f => readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const runs = new Map(); for (const r of load(argOf('--runs', join(DIR, 'corpus_runs.jsonl')))) if (!runs.has(r.rel)) runs.set(r.rel, r);
const ctry = new Map(); for (const r of load(argOf('--countries', join(DIR, 'corpus_countries.jsonl')))) ctry.set(r.rel, r.years);
const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const pct = (a, q) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; };
const f2 = (v, d = 2) => Number.isFinite(v) ? v.toFixed(d) : '—'; const pc = v => Number.isFinite(v) ? (100 * v).toFixed(0) + '%' : '—';
const LABS = ['GER', 'FRA', 'USA', 'BEL', 'NET', 'RUS'];
const van = [...runs.values()].filter(r => r.arm === 'vanilla' && ctry.has(r.rel)), mod = [...runs.values()].filter(r => r.arm === 'mod' && ctry.has(r.rel));
const vmedW = {}; for (let y = 1932; y <= 1936; y++) vmedW[y] = med(van.map(r => r.years[y]?.w?.gdp));
const worldEnd = r => mean([1932, 1933, 1934, 1935, 1936].filter(y => r.years[y]).map(y => r.years[y].w.gdp / vmedW[y]));
function read(rel, lab) {
  const Y = ctry.get(rel); const ys = Object.keys(Y).map(Number).sort((a, b) => a - b).filter(y => y <= 1936);
  const row = y => Y[y] && Y[y][lab]; const end = ys.filter(y => y >= 1932 && row(y));
  const o = { U: end.length >= 3 ? mean(end.map(y => row(y).U)) : NaN, H: end.length >= 3 ? mean(end.map(y => row(y).H)) : NaN,
    gdp: end.length >= 3 ? mean(end.map(y => row(y).gdp)) : NaN, pop: end.length >= 3 ? mean(end.map(y => row(y).pop)) : NaN, tag: end.length ? row(end[end.length - 1]).tag : null };
  o.cross10 = ys.find(y => row(y) && row(y).U < 0.10) ?? null; o.cross5 = ys.find(y => row(y) && row(y).U < 0.05) ?? null;
  // streaks under 5% U*
  let streak = [], best = { hard: false, soft3: false, low5: false, hardYear: null };
  for (const y of ys) { const r = row(y); if (r && r.U < 0.05) { streak.push(r); } else streak = [];
    if (streak.length >= 5 && !best.low5) best.low5 = true;
    if (streak.length >= 5 && mean(streak.slice(-5).map(s => s.H)) >= 1.5 && !best.hard) { best.hard = true; best.hardYear = y; }
    if (streak.length >= 3 && streak.slice(-3).every(s => s.H >= 1.0) && !best.soft3) best.soft3 = true; }
  return Object.assign(o, best);
}
const V = {}, M = {}; for (const lab of LABS) { V[lab] = van.map(r => read(r.rel, lab)); M[lab] = mod.map(r => Object.assign(read(r.rel, lab), { w: worldEnd(r), cfg: r.config, rel: r.rel })); }
console.log(`runs: ${mod.length} four-rung (A/B books), ${van.length} vanilla`);
console.log('\n== END STATE (1932–36 mean) AND ABUNDANCE, per label: four-rung vs vanilla ==');
console.log('label  side     n   U* med (p10–p90)       hoard med (p90)   first U*<10% med [never]   first U*<5% [never]   HARD   SOFT3  LOW5');
for (const lab of LABS) for (const [side, A] of [['mod', M[lab]], ['vanilla', V[lab]]]) {
  const a = A.filter(x => Number.isFinite(x.U)); const n = a.length; if (!n) continue;
  const c10 = a.map(x => x.cross10).filter(Boolean), c5 = a.map(x => x.cross5).filter(Boolean);
  console.log(`${lab.padEnd(6)} ${side.padEnd(7)} ${String(n).padStart(3)}   ${pc(med(a.map(x => x.U))).padStart(4)} (${pc(pct(a.map(x => x.U), 0.1))}–${pc(pct(a.map(x => x.U), 0.9))})`.padEnd(46)
    + `${f2(med(a.map(x => x.H)))} (${f2(pct(a.map(x => x.H), 0.9))})`.padEnd(18)
    + `${c10.length ? med(c10) : '—'} [${n - c10.length}]`.padEnd(27) + `${c5.length ? med(c5) : '—'} [${n - c5.length}]`.padEnd(22)
    + `${pc(a.filter(x => x.hard).length / n)}`.padEnd(7) + `${pc(a.filter(x => x.soft3).length / n)}`.padEnd(7) + pc(a.filter(x => x.low5).length / n));
}
console.log('\n== HOW THE CLOSED MAJORS MOVE WITH WORLD GDP (four-rung runs; world GDP = 1932–36 mean ÷ vanilla median) ==');
const BANDS = [[0, 0.8], [0.8, 0.9], [0.9, 1.0], [1.0, 1.1], [1.1, 1.25], [1.25, 9]];
for (const lab of ['GER', 'FRA', 'USA', 'BEL']) {
  console.log(`${lab}:  world band      n   U* end med   hoard med   first U*<10% med [never]   HARD   SOFT3  LOW5`);
  for (const [lo, hi] of BANDS) { const a = M[lab].filter(x => Number.isFinite(x.U) && x.w >= lo && x.w < hi); if (!a.length) continue; const c10 = a.map(x => x.cross10).filter(Boolean);
    console.log(`      ${(lo.toFixed(2) + '–' + (hi > 5 ? '' : hi.toFixed(2))).padEnd(12)} ${String(a.length).padStart(3)}   ${pc(med(a.map(x => x.U))).padStart(6)}       ${f2(med(a.map(x => x.H))).padStart(5)}      ${(c10.length ? String(med(c10)) : '—').padStart(5)} [${a.length - c10.length}]`.padEnd(70)
      + `${pc(a.filter(x => x.hard).length / a.length)}`.padEnd(7) + `${pc(a.filter(x => x.soft3).length / a.length)}`.padEnd(7) + pc(a.filter(x => x.low5).length / a.length)); }
  const a = M[lab].filter(x => Number.isFinite(x.U)); const lw = a.map(x => Math.log(x.w)), lu = a.map(x => Math.log(Math.max(0.005, x.U)));
  const mx = mean(lw), my = mean(lu); const sxy = lw.reduce((s, v, i) => s + (v - mx) * (lu[i] - my), 0), sxx = lw.reduce((s, v) => s + (v - mx) ** 2, 0), syy = lu.reduce((s, v) => s + (v - my) ** 2, 0);
  console.log(`      ln U*(end) on ln world GDP: slope ${f2(sxy / sxx)} (an elasticity), r ${f2(sxy / Math.sqrt(sxx * syy))}, n ${a.length}`);
}
console.log('\n== THE LUCKY-SEED PROXY: per config with ≥ 3 runs, the BEST (lowest end U*) seed for GER and FRA ==');
const byCfg = {}; for (const lab of ['GER', 'FRA']) for (const x of M[lab]) if (Number.isFinite(x.U)) ((byCfg[x.cfg] ??= {})[lab] ??= []).push(x);
console.log('config'.padEnd(50) + '  n   world GDP med   GER U* best / med   GER hard   FRA U* best / med   FRA hard');
for (const [c, o] of Object.entries(byCfg).filter(([, o]) => (o.GER || []).length >= 3).sort((a, b) => med(a[1].GER.map(x => x.w)) - med(b[1].GER.map(x => x.w)))) {
  const g = o.GER, f = o.FRA || []; console.log(c.replace('mod_config.', '').replace('.json', '').slice(0, 49).padEnd(50) + String(g.length).padStart(3) + '   ' + f2(med(g.map(x => x.w))).padStart(6)
    + `          ${pc(Math.min(...g.map(x => x.U)))} / ${pc(med(g.map(x => x.U)))}`.padEnd(22) + `   ${g.filter(x => x.hard).length}/${g.length}`.padEnd(11)
    + (f.length ? `${pc(Math.min(...f.map(x => x.U)))} / ${pc(med(f.map(x => x.U)))}`.padEnd(19) + `   ${f.filter(x => x.hard).length}/${f.length}` : '')); }
if (argv.includes('--list')) { console.log('\nruns with a HARD abundance in GER or FRA:'); for (const lab of ['GER', 'FRA', 'USA', 'BEL']) for (const x of M[lab].filter(x => x.hard)) console.log(`  ${lab} (${x.tag}) from ${x.hardYear}  end U* ${pc(x.U)} hoard ${f2(x.H)}  world ${f2(x.w)}  ${x.rel}`); }
