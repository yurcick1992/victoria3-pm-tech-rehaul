// ⭐ RUNG 0, SHORTLIST vs THE REST OF THE WORLD, PER INDUSTRY (FINDINGS F127, 2026-09-16): levels, staffed levels and workers of the
// era-0 rungs at one date — on a MOD run by the config's era-0 keys; on a VANILLA run (mode 'vanilla') as the levels on the rung-0
// vanilla_pm out of the summary's `pms` split × the type's staffing share × its employment (F97 §4's approximation). The reading that put
// the found book's rung 0 at a third of vanilla's headcount world-wide and a fifth in the majors.
//   node tools/testbed/ledger/rung0_split.mjs <config> <year> mod|vanilla <runDir> [<runDir>...]
// Moved from the 2026-09-16 session scratchpad on 2026-09-17 (a batch boundary; L27 walks this directory in every build).
// rung-0 people are the levels on the rung-0 vanilla_pm (the summary's `pms` split) × the type's staffing share × employment (F97 §4's approximation).
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const [cfgPath, year, mode, ...runDirs] = process.argv.slice(2);
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const SL = new Set(['GBR', 'USA', 'FRA', 'GER', 'NGF', 'PRU', 'NET', 'BEL']);
const e0 = {}; for (const ind of cfg.industries) { if (ind.disabled) continue; const t = [...ind.tiers].sort((a, b) => a.era - b.era)[0]; if (t.era !== 0) continue; e0[t.key] = { ind: ind.id, pm: t.vanilla_pm, emp: Object.values(t.employment || {}).reduce((a, b) => a + b, 0) || 5000 }; }
for (const runDir of runDirs) {
  const dir = runDir + '/save_summaries';
  const files = readdirSync(dir).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).map(x => { const o = JSON.parse(gunzipSync(readFileSync(dir + '/' + x)).toString()); return { d: o.provenance.date, o }; });
  const f = files.filter(o => o.d.startsWith(year + '.')).sort((a, b) => a.d.localeCompare(b.d))[0]; if (!f) continue;
  const acc = {}; const byC = {};
  for (const [tag, c] of Object.entries(f.o.countries)) for (const [k, b] of Object.entries(c.buildings || {})) { const m = e0[k]; if (!m) continue;
    let lv = b.levels || 0, st = b.staffing || 0;
    if (mode === 'vanilla') { const pmlv = (b.pms || {})[m.pm] || 0; const share = lv ? pmlv / lv : 0; lv = pmlv; st = st * share; }
    const key = m.ind + '|' + (SL.has(tag) ? 'SL' : 'rest'); const a = acc[key] ||= { lv: 0, st: 0, w: 0 }; a.lv += lv; a.st += st; a.w += st * m.emp;
    const cc = byC[tag] ||= { st: 0, w: 0, lv: 0 }; cc.st += st; cc.w += st * m.emp; cc.lv += lv; }
  console.log('\n' + runDir.split('/').slice(-2).join('/'), f.d, mode);
  let tSL = { lv: 0, st: 0, w: 0 }, tR = { lv: 0, st: 0, w: 0 };
  for (const ind of Object.keys(Object.fromEntries(Object.values(e0).map(x => [x.ind, 1]))).sort()) {
    const s = acc[ind + '|SL'] || { lv: 0, st: 0, w: 0 }, r = acc[ind + '|rest'] || { lv: 0, st: 0, w: 0 };
    for (const k of ['lv', 'st', 'w']) { tSL[k] += s[k]; tR[k] += r[k]; }
    console.log(`  ${ind.padEnd(11)} shortlist lv ${String(Math.round(s.lv)).padStart(5)} staffed ${s.st.toFixed(0).padStart(5)} (${(100 * s.st / Math.max(1, s.lv)).toFixed(0).padStart(3)}%) ${(s.w / 1e3).toFixed(0).padStart(5)}k  | rest lv ${String(Math.round(r.lv)).padStart(5)} staffed ${r.st.toFixed(0).padStart(5)} (${(100 * r.st / Math.max(1, r.lv)).toFixed(0).padStart(3)}%) ${(r.w / 1e3).toFixed(0).padStart(6)}k`);
  }
  console.log(`  TOTAL       shortlist lv ${String(Math.round(tSL.lv)).padStart(5)} staffed ${tSL.st.toFixed(0).padStart(5)} (${(100 * tSL.st / Math.max(1, tSL.lv)).toFixed(0)}%) ${(tSL.w / 1e6).toFixed(2)}M | rest lv ${String(Math.round(tR.lv)).padStart(5)} staffed ${tR.st.toFixed(0).padStart(5)} (${(100 * tR.st / Math.max(1, tR.lv)).toFixed(0)}%) ${(tR.w / 1e6).toFixed(2)}M`);
  console.log('  top countries by rung-0 workers:', Object.entries(byC).sort((a, b) => b[1].w - a[1].w).slice(0, 12).map(([t, x]) => `${t} ${(x.w / 1e3).toFixed(0)}k (${x.st.toFixed(0)}/${Math.round(x.lv)})`).join(', '));
}
