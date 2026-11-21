// THE 1836–1855 READINGS (BALANCE_FRAMEWORK §10.115's two pass terms for a 1.2 book's first twenty years; the user, 2026-11-21: "Let's have
// the 1855 measurements now. But the design of actual rotation comes later." — so this prints the readings and vanilla's own spread beside
// them, and judges nothing: the thresholds are not ruled).
//
//   (a) THE START IS VANILLA'S — world GDP at 1837 / 1840 / 1845 (the register's 1836–1845 minor reading); the deposits' levels and the raw
//       materials' world output at 1837.1.1; the raw materials' world-market prices (the 52-week mean to 1837.1.1); each against vanilla's min–max over its runs.
//   (b) 1855 IS NOT DEAD IN HALF THE WORLD — at 1855.1.1, per country, GDP ÷ vanilla's median GDP for the same tag; a country is "dead" at k
//       when it is under k × that median (k 0.75 / 0.66 / 0.5); the share of the world it holds is weighed by vanilla's median GDP for its tag
//       (so a collapsed country keeps its weight); tags in fewer than half of vanilla's runs are left out. Vanilla's own runs are read
//       leave-one-out (each against the median of the others). Printed per run, as min / median / max, and DEAD IN BOTH runs of every pair
//       (the 2+1 screen's form). World GDP at 1855 ÷ vanilla's median beside it.
//
// ⚠ Deposit families are matched by building-key PREFIX (building_iron_mine*), so tiered rungs count with their family as long as the 1.2
//   generator keeps vanilla's key as their prefix; a rung named otherwise is missed, and the levels line then says less than it should.
// usage: node tools/testbed/ledger/screen_1855.mjs [--van <group>] --arm <label>=<group> [--arm …] [--year 1855]
//   <group> = a session, a comma list of sessions or <session>/runNNN_<setup> folders, optionally :<setup> (as the other readers)
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib'; import { fileURLToPath } from 'node:url';
import { usableRuns, reportDropped, VANILLA_REF } from './lib_runs.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SES = path.join(HERE, '..', 'sessions');
const args = process.argv.slice(2); const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const YEAR = +opt('--year', 1855); const KS = [0.75, 0.66, 0.5];
const START_YEARS = [1837, 1840, 1845];
const FAMILIES = ['coal_mine', 'iron_mine', 'lead_mine', 'sulfur_mine', 'copper_mine', 'gold_mine', 'gold_field', 'logging_camp', 'fishing_wharf', 'whaling_station', 'oil_rig'];
const RAW = ['coal', 'iron', 'lead', 'sulfur', 'copper', 'gold', 'wood', 'fish', 'oil'];
const group = g => { const i = g.lastIndexOf(':'); return i > 0 && !g.slice(i).includes('/') ? [g.slice(0, i), g.slice(i + 1)] : [g, '']; };
function load(g) {
  const [s, setup] = group(g); const r = usableRuns(SES, s, setup); reportDropped(r.dropped);
  return r.runs.map(rel => {
    const dir = path.join(SES, rel, 'save_summaries'); const at = {};
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.'))) {
      const j = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f))));
      const d = String(j.provenance?.date || ''); const y = +d.split('.')[0];
      if (!d.endsWith('.1.1') || !(START_YEARS.includes(y) || y === YEAR)) continue;
      const c = {}; const lv = Object.fromEntries(FAMILIES.map(k => [k, 0]));
      for (const [k, x] of Object.entries(j.countries)) {
        if (+x.gdp > 0) c[x.tag || k] = (c[x.tag || k] || 0) + +x.gdp;
        for (const [bt, b] of Object.entries(x.buildings || {})) for (const fam of FAMILIES) if (bt.startsWith('building_' + fam)) lv[fam] += b.levels || 0;
      }
      at[y] = { world: +j.world.gdp, c, lv, out: Object.fromEntries(RAW.map(g => [g, j.top_producers?.[g]?.world ?? 0])),
        price: Object.fromEntries(RAW.map(g => [g, +(j.world.world_market_price?.[g]?.mean52 ?? NaN)])) };   // the 52-week mean of the world-market price
    }
    return { name: rel, at };
  });
}
const med = a => { const s = a.filter(x => Number.isFinite(x)).sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const pct = x => Number.isFinite(x) ? (100 * x).toFixed(1) + '%' : '-';
const f2 = x => Number.isFinite(x) ? x.toFixed(2) : '-';
const V = load(opt('--van', VANILLA_REF));
const ARMS = []; args.forEach((a, i) => { if (a === '--arm') { const [l, g] = args[i + 1].split('='); ARMS.push({ label: l, runs: load(g) }); } });
console.log(`vanilla reference: ${V.length} run(s) (${[...new Set(V.map(r => r.name.split('/')[0]))].join(', ')})`);
for (const A of ARMS) console.log(`arm ${A.label}: ${A.runs.length} run(s) (${[...new Set(A.runs.map(r => r.name.split('/')[0]))].join(', ')})`);
const missing = [...V, ...ARMS.flatMap(A => A.runs)].filter(r => !r.at[YEAR] || !r.at[1837]);
if (missing.length) console.log(`⚠ without a ${YEAR}.1.1 or 1837.1.1 summary (left out of those lines): ${missing.map(r => r.name).join(', ')}`);

// (a) the start
const span = (get) => { const v = V.map(get).filter(Number.isFinite); return [Math.min(...v), med(v), Math.max(...v)]; };
const line = (label, get, fmt) => {
  const [lo, m, hi] = span(get);
  const arms = ARMS.map(A => { const v = A.runs.map(get).filter(Number.isFinite); const out = v.filter(x => x < lo || x > hi).length;
    return `${A.label} ${v.map(fmt).join(' / ')}${out ? `  (${out} outside)` : ''}`; }).join('   ');
  console.log(`  ${label.padEnd(22)} vanilla ${fmt(m)} [${fmt(lo)}–${fmt(hi)}]   ${arms}`);
};
console.log(`\n(a) THE START — each arm's runs against vanilla's median [min–max]`);
for (const y of START_YEARS) line(`world GDP ${y} (£M)`, r => r.at[y]?.world / 1e6, x => x.toFixed(0));
console.log('  — deposit levels at 1837.1.1 (all rungs of a family)');
for (const fam of FAMILIES) line(fam, r => r.at[1837]?.lv[fam], x => x.toFixed(0));
console.log('  — raw materials: world output at 1837.1.1 (units a week)');
for (const g of RAW) line(g, r => r.at[1837]?.out[g], x => x.toFixed(0));
console.log('  — raw materials: world-market price, the 52-week mean to 1837.1.1');
for (const g of RAW) line(g, r => r.at[1837]?.price[g], x => Number.isFinite(x) ? x.toFixed(1) : '-');

// (b) 1855
function ref(excl) { const by = {}; for (const r of V) { if (r === excl || !r.at[YEAR]) continue; for (const [t, g] of Object.entries(r.at[YEAR].c)) (by[t] ||= []).push(g); }
  const n = V.filter(r => r !== excl && r.at[YEAR]).length; const out = {}; for (const [t, a] of Object.entries(by)) if (a.length >= Math.ceil(n / 2)) out[t] = med(a); return out; }
function judge(run, R) { const W = Object.values(R).reduce((a, b) => a + b, 0); const dead = Object.fromEntries(KS.map(k => [k, new Set()])); let present = 0;
  for (const [t, m] of Object.entries(R)) { const g = run.at[YEAR].c[t]; if (g == null) continue; present += m; for (const k of KS) if (g < k * m) dead[k].add(t); }
  return { W, present, dead }; }
const wOf = (set, R) => [...set].reduce((a, t) => a + (R[t] || 0), 0);
const vMedWorld = med(V.map(r => r.at[YEAR]?.world));
function block(label, runs, loo) {
  const ok = runs.filter(r => r.at[YEAR]);
  console.log(`\n(b) ${YEAR}.1.1 — ${label}: the world's share (by vanilla's median GDP) in countries under k × vanilla's median`);
  console.log('  run'.padEnd(46) + 'present ' + KS.map(k => ('k ' + k).padStart(8)).join('') + '  world÷van   largest dead at 0.66');
  const per = ok.map(r => { const R = ref(loo ? r : null); const j = judge(r, R); return { r, R, j }; });
  for (const { r, R, j } of per) {
    const big = [...j.dead[0.66]].map(t => [t, R[t] / j.W, r.at[YEAR].c[t] / R[t]]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, w, x]) => `${t} ${pct(w)}@${f2(x)}`).join(', ');
    console.log('  ' + r.name.padEnd(44) + pct(j.present / j.W).padStart(7) + ' ' + KS.map(k => pct(wOf(j.dead[k], R) / j.W).padStart(8)).join('') + '  ' + f2(r.at[YEAR].world / vMedWorld).padStart(8) + '   ' + big);
  }
  for (const k of KS) { const a = per.map(p => wOf(p.j.dead[k], p.R) / p.j.W);
    const both = []; const Rall = ref(null), Wall = Object.values(Rall).reduce((x, y) => x + y, 0);
    for (let i = 0; i < per.length; i++) for (let j = i + 1; j < per.length; j++) both.push(wOf(new Set([...per[i].j.dead[k]].filter(t => per[j].j.dead[k].has(t))), Rall) / Wall);
    console.log(`  k ${k}: per run median ${pct(med(a))} [${pct(Math.min(...a))}–${pct(Math.max(...a))}]; dead in BOTH runs of a pair: median ${pct(med(both))}, max ${pct(Math.max(...both))} over ${both.length} pair(s)`);
  }
  const w = ok.map(r => r.at[YEAR].world / vMedWorld); console.log(`  world GDP ${YEAR} ÷ vanilla's median: ${w.map(f2).join(' / ')}`);
}
block('VANILLA, each run against the median of the others', V, true);
for (const A of ARMS) block(`${A.label}, against vanilla's median`, A.runs, false);
