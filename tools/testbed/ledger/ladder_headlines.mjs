// THE FIRST-RUN HEADLINES of the trade x1.5 B ladder (user-asked 2026-09-24): per usable run of each --arm setup,
//  1) world GDP ÷ vanilla (1932–36 mean of the per-year ratio to vanilla n=16's median — the register's end state)
//  2) Britain's U* (1932–36 mean)
//  3) the shortlist pool (lib_markets POOL, summed): productive workers ÷ workforce, U*, government+military ÷ workforce,
//     W (productive ÷ population), Y (GDP ÷ productive) — each ÷ vanilla's median of the same per-run end-state value
//  4) trade at 1936.1.1: base-£ moved a week (capacity × the run's OWN traded quantity × base price, one way; the trade
//     centres' quantity multiplier NOT included, same basis as F161) and ÷ world GDP, total and per class A–E, against
//     vanilla seeds within ±0.08 of the run's GDP, against the previous batch (trade arm) and the canon (no trade weights).
// Definitions mirror criteria.mjs (peasants = population_subsisting_workforce × 1e5; productive = salaried − gov − mil).
//   node tools/testbed/ledger/ladder_headlines.mjs --arm <session>:<setup> [--arm …] --prev <session>:<setup> --canon <session>:<setup> --ccache <dir>
//        --van <session> --vcache <dir> [--match 0.08]
import fs from 'node:fs'; import zlib from 'node:zlib'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
const REPO = 'C:/claude-code/victoria 3 PM and tech rehaul'; const SES = REPO + '/tools/testbed/sessions';
const imp = p => import(pathToFileURL(REPO + '/tools/testbed/ledger/' + p).href);
const { POOL } = await imp('lib_markets.mjs'); const { goodsTable, tradedQuantity, tradeClasses } = await imp('lib_goods.mjs');
const { usableRuns } = await imp('lib_runs.mjs');
const argv = process.argv.slice(2); const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const allOf = k => argv.flatMap((a, i) => a === k ? [argv[i + 1]] : []);
const sp = s => { const [session, setup] = s.split(':'); return { session, setup }; };
const ARMS = allOf('--arm').map(sp), PREV = argOf('--prev') ? sp(argOf('--prev')) : null, CANON = argOf('--canon') ? sp(argOf('--canon')) : null;
const VAN = argOf('--van', '20260821_131149_vanilla-baseline-n16'), VCACHE = argOf('--vcache'), CCACHE = argOf('--ccache'), MATCH = +argOf('--match', '0.08');
const G = goodsTable(), { classOf } = tradeClasses(null), K = ['A', 'B', 'C', 'D', 'E'];
const load = f => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const m = (s.length - 1) / 2; return (s[Math.floor(m)] + s[Math.ceil(m)]) / 2; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const END = [1932, 1933, 1934, 1935, 1936];
function cfgOf(runDir) { try { const bs = JSON.parse(fs.readFileSync(path.join(runDir, 'build_state.json'), 'utf8')); const p = bs.deterministic?.mod_under_test?.built_from_config; if (!p) return null; return JSON.parse(fs.readFileSync(path.isAbsolute(p) ? p : path.join(REPO, p), 'utf8')); } catch { return null; } }
function readEnd(runDir) {   // the 1932–1936 .1.1 summaries
  const sd = path.join(runDir, 'save_summaries'); const out = {};
  for (const f of fs.readdirSync(sd).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).sort().slice(-12)) {
    let j; try { j = load(path.join(sd, f)); } catch { continue; } const d = j.provenance?.date || ''; const y = +d.slice(0, 4);
    if (END.includes(y) && /\.1\.1$/.test(d)) out[y] = j; }
  return out;
}
const agg = () => ({ gdp: 0, pop: 0, prod: 0, sal: 0, un: 0, pe: 0, gm: 0 });
const addC = (a, c) => { const p = c.pop_statistics || {}; const sal = +p.population_salaried_workforce || 0, un = +p.population_unemployed_workforce || 0, pe = (+p.population_subsisting_workforce || 0) * 1e5;
  const gm = (+p.population_government_workforce || 0) + (+p.population_military_workforce || 0);
  a.gdp += +c.gdp || 0; a.pop += Object.values(c.strata || {}).reduce((x, y) => x + y, 0); a.prod += sal - gm; a.gm += gm; a.sal += sal; a.un += un; a.pe += pe; };
function endState(runDir) {
  const S = readEnd(runDir); if (END.some(y => !S[y])) return null; const per = [];
  for (const y of END) { const C = S[y].countries; const pool = agg(); for (const t of POOL) if (C[t]) addC(pool, C[t]);
    const wf = pool.sal + pool.un + pool.pe; const g = agg(); if (C.GBR) addC(g, C.GBR); const gwf = g.sal + g.un + g.pe;
    per.push({ y, gdp: +S[y].world.gdp, gbrU: gwf ? (g.un + g.pe) / gwf : NaN, share: pool.prod / wf, U: (pool.un + pool.pe) / wf, gm: pool.gm / wf, W: pool.prod / pool.pop, Y: pool.gdp / pool.prod }); }
  return { per, j36: S[1936] };
}
// vanilla
const V = usableRuns(SES, VAN).runs.map(rel => ({ rel, e: endState(path.join(SES, rel)) })).filter(x => x.e);
const vmed = Object.fromEntries(END.map(y => [y, med(V.map(v => v.e.per.find(p => p.y === y).gdp))]));
const summ = e => { const f = k => mean(e.per.map(p => p[k])); return { gdp: mean(e.per.map(p => p.gdp / vmed[p.y])), gbrU: f('gbrU'), share: f('share'), U: f('U'), gm: f('gm'), W: f('W'), Y: f('Y') }; };
const tradeOf = (j, TQ) => { if (!j?.world?.trade_goods) return null; let V_ = 0; const vc = {}; for (const [g, x] of Object.entries(j.world.trade_goods)) { if (!G[g]?.cost || !classOf[g]) continue; const v = (x.imp + x.exp) * (TQ[g] || 0) * G[g].cost / 2; V_ += v; vc[classOf[g]] = (vc[classOf[g]] || 0) + v; }
  return { wk: V_, int: 52 * V_ / j.world.gdp, cls: Object.fromEntries(K.map(k => [k, 52 * (vc[k] || 0) / j.world.gdp])) }; };
const cacheOf = (dir, rel) => { const f = path.join(dir, rel.replace('/', '__') + '.json.gz'); return fs.existsSync(f) ? load(f) : null; };
const VS = V.map(v => ({ ...summ(v.e), rel: v.rel, t: VCACHE ? tradeOf(cacheOf(VCACHE, v.rel), tradedQuantity(null, G)) : null }));
const ref = (spec, cache) => spec ? usableRuns(SES, spec.session, spec.setup).runs.map(rel => { const dir = path.join(SES, rel); const e = endState(dir); if (!e) return null; const cfg = cfgOf(dir);
  const j = e.j36?.world?.trade_goods ? e.j36 : (cache ? cacheOf(cache, rel) : null); return { ...summ(e), rel, t: tradeOf(j, tradedQuantity(cfg, G)) }; }).filter(Boolean) : [];
const PR = ref(PREV, CCACHE), CA = ref(CANON, CCACHE);
const pc = x => Number.isFinite(x) ? (100 * x).toFixed(1) + '%' : '—', f2 = x => Number.isFinite(x) ? x.toFixed(2) : '—', fm = x => Number.isFinite(x) ? '£' + (x / 1e6).toFixed(1) + 'M' : '—';
const vm = k => med(VS.map(v => v[k]));
console.log(`vanilla n=${VS.length} (${VAN}) · end state = the 1932–36 mean · trade at 1936.1.1 (capacity × own traded qty × base price, one way)`);
console.log(`vanilla medians: GBR U* ${pc(vm('gbrU'))} · shortlist productive ÷ workforce ${pc(vm('share'))}, U* ${pc(vm('U'))}, gov+mil ${pc(vm('gm'))}, W ${(vm('W')).toFixed(3)}, Y ${vm('Y').toFixed(1)} (GDP £ per productive worker) · trade ÷ GDP ${pc(med(VS.map(v => v.t?.int)))}`);
const line = (lab, xs, f) => `${lab} ${xs.map(f).join(' / ')}`;
for (const A of ARMS) for (const rel of usableRuns(SES, A.session, A.setup).runs) {
  const dir = path.join(SES, rel); const e = endState(dir); if (!e) { console.log(`\n${rel}: incomplete`); continue; }
  const s = summ(e), t = tradeOf(e.j36, tradedQuantity(cfgOf(dir), G));
  const vmatch = VS.filter(v => Math.abs(v.gdp - s.gdp) <= MATCH && v.t);
  console.log(`\n=== ${rel}  (${cfgOf(dir)?._ab?.B != null ? 'B ' + cfgOf(dir)._ab.B : ''})`);
  console.log(`1) world GDP ÷ vanilla ${f2(s.gdp)}   [vanilla seeds ${f2(Math.min(...VS.map(v => v.gdp)))}–${f2(Math.max(...VS.map(v => v.gdp)))} · prev ${PR.map(r => f2(r.gdp)).join(' / ')} · canon ${CA.map(r => f2(r.gdp)).join(' / ')}]`);
  console.log(`2) GBR U* ${pc(s.gbrU)}   [vanilla median ${pc(vm('gbrU'))} · prev ${PR.map(r => pc(r.gbrU)).join(' / ')} · canon ${CA.map(r => pc(r.gbrU)).join(' / ')} · band 10–50%]`);
  console.log(`3) shortlist: productive ÷ workforce ${pc(s.share)} (÷ van ${f2(s.share / vm('share'))}) · U* ${pc(s.U)} · gov+mil ${pc(s.gm)} · W ÷ van ${f2(s.W / vm('W'))} · Y ÷ van ${f2(s.Y / vm('Y'))}`);
  console.log(`   prev: productive ÷ wf ${PR.map(r => pc(r.share)).join(' / ')} · W ÷ van ${PR.map(r => f2(r.W / vm('W'))).join(' / ')} · Y ÷ van ${PR.map(r => f2(r.Y / vm('Y'))).join(' / ')}`);
  console.log(`   canon: productive ÷ wf ${CA.map(r => pc(r.share)).join(' / ')} · W ÷ van ${CA.map(r => f2(r.W / vm('W'))).join(' / ')} · Y ÷ van ${CA.map(r => f2(r.Y / vm('Y'))).join(' / ')}`);
  console.log(`4) trade ${fm(t?.wk)}/wk, ${pc(t?.int)} of GDP · vanilla within ±${MATCH} GDP (n=${vmatch.length}) ${pc(med(vmatch.map(v => v.t.int)))} [${fm(med(vmatch.map(v => v.t.wk)))}/wk] → ×${f2(t?.int / med(vmatch.map(v => v.t.int)))}`);
  console.log(`   prev batch median ${pc(med(PR.map(r => r.t?.int)))} [${fm(med(PR.map(r => r.t?.wk)))}/wk] → ×${f2(t?.int / med(PR.map(r => r.t?.int)))} · canon median ${pc(med(CA.map(r => r.t?.int)))} → ×${f2(t?.int / med(CA.map(r => r.t?.int)))}`);
  console.log(`   by class, % of GDP (this / vanilla-matched / prev / canon):  ` + K.map(k => `${k} ${pc(t?.cls[k])} / ${pc(med(vmatch.map(v => v.t.cls[k])))} / ${pc(med(PR.map(r => r.t?.cls[k])))} / ${pc(med(CA.map(r => r.t?.cls[k])))}`).join(' · '));
}
