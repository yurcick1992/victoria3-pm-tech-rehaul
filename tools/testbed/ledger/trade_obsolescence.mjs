// OBSOLESCENCE, IN-MARKET vs TRADE — the reader (FINDINGS F161 §4; the metric set is lib_obsolescence.mjs's header).
// usage: node tools/testbed/ledger/trade_obsolescence.mjs --arm <session>:<setup>:<config> [--arm …] [--label-<setup> <name>]
//          [--years 1850,…,1935] [--pool 1920,1930,1935] [--thr 0.10] [--override-dir <dir of v10+/v11 re-summaries>]
//          [--industries a,b] [--json out.json]
// Prints, per industry and arm, pooled over --pool: the IN-MARKET and TRADE-ONLY rows (levels · loss-making share of levels ·
// median true margin · staffed ÷ levels · world price ÷ break-even and the share below 1), the price gap to the world; then the
// TRADE-ONLY rungs split by their market's position in the good (imp / notimp / notrade; nodata before v10), by their country's
// import TARIFF level on the good (v11+; `unset` = no level set), and by its TRADE-POLICY law (v11+). Signed premium = the
// median ln(local price ÷ world price), + = local above the world.
import fs from 'node:fs'; import { measure, summarise } from './lib_obsolescence.mjs';
const argv = process.argv.slice(2); const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const allOf = k => argv.flatMap((a, i) => a === k ? [argv[i + 1]] : []);
const years = argOf('--years', '1850,1860,1870,1880,1890,1900,1910,1920,1930,1935').split(',').map(Number);
const pool = argOf('--pool', '1920,1930,1935').split(',').map(Number);
const thr = +argOf('--thr', '0.10'), overrideDir = argOf('--override-dir', null), industries = argOf('--industries', null)?.split(',');
const arms = allOf('--arm').map(s => { const [session, setup, config] = s.split(':'); return { session, setup, config, label: argOf('--label-' + setup, setup) }; });
if (!arms.length) { console.error('usage: --arm <session>:<setup>:<config> [--arm …]'); process.exit(1); }
const S = {}; for (const A of arms) S[A.label] = summarise(measure({ ...A, years, thr, overrideDir, industries }), pool);
const pc = x => Number.isFinite(x) ? (100 * x).toFixed(0).padStart(4) + '%' : '    —', f2 = x => Number.isFinite(x) ? x.toFixed(2) : '  — ';
const sg = x => Number.isFinite(x) ? (x >= 0 ? '+' : '') + x.toFixed(2) : '  — ';
console.log(`pooled ${pool.join('+')} · supply frontier ≥ ${thr * 100}% of output by era · margins TRUE (wages in) · ` + Object.entries(S).map(([l, s]) => `${l}: ${s.runs} run(s)`).join(' · '));
const row = r => r ? `${String(r.lv).padStart(5)} loss${pc(r.loss)} m${pc(r.marg)} st${pc(r.staffed)} w/BE ${f2(r.wbe)} (<1${pc(r.wbeBelow)})` : '    —'.padEnd(54);
const inds = [...new Set(Object.values(S).flatMap(s => Object.keys(s.industries)))];
for (const ind of inds) for (const [lab, s] of Object.entries(S)) { const o = s.industries[ind]; if (!o) continue; if (!o['IN-MARKET'] && !o['TRADE-ONLY']) continue;
  console.log(`  ${ind.padEnd(11)} ${lab.padEnd(8)} IN ${row(o['IN-MARKET'])} || TRADE ${row(o['TRADE-ONLY'])} || gap ${f2(o.gap)}`); }
for (const [title, f] of [['market position in the good', 'split'], ['own import tariff on the good (v11+)', 'tariff'], ['trade-policy law (v11+)', 'policy']]) {
  console.log(`\nTRADE-ONLY by ${title}: levels · loss share · median margin · signed premium over the world price`);
  for (const ind of inds) for (const [lab, s] of Object.entries(S)) { const o = s.industries[ind]?.[f]; if (!o || !Object.keys(o).length) continue;
    const parts = Object.entries(o).filter(([, v]) => v).sort((a, b) => b[1].lv - a[1].lv).map(([k, v]) => `${k} ${v.lv} loss${pc(v.loss)} m${pc(v.marg)} ${sg(v.prem)}`);
    if (parts.length && !(parts.length === 1 && /^nodata/.test(parts[0]))) console.log(`  ${ind.padEnd(11)} ${lab.padEnd(8)} ${parts.join('  |  ')}`); } }
if (argOf('--json', null)) fs.writeFileSync(argOf('--json'), JSON.stringify(S));
