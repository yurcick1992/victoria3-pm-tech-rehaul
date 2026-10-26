// Promoted from a session scratchpad 2026-10-26 (FINDINGS F249 §4). ⚠ Its VANILLA column is confounded by vanilla's free method switch: a
// vanilla building moves to the newer method as soon as its owner holds the technology, so an old method empties without any building dying.
// For the competitive pressure itself read laggard_pressure.mjs, which keeps only industries that cannot move up in either arm.
// LAGGARD SUPPRESSION, vanilla against the canon, from the yearly save summaries.
// A "rung" is a tier of a tiered industry: in the canon its own building (or a merged host's main method), in vanilla the main
// production method the canon built that rung from (same tier). Workers = staffed levels x the rung's per-level employment
// (crafts x workforce_mult). Per market (countries sharing `market`) and industry, the FRONTIER is the highest tier holding >= 10%
// of the market's workers in that industry; the WORLD frontier the same over all countries.
//   IN-MARKET LAGGARD  = a rung >= 2 tiers below its own market's frontier (it competes with a much better rung at home)
//   TRADE-ONLY LAGGARD = >= 2 tiers below the WORLD frontier but not below its own market's (only foreign producers are ahead)
// SURVIVAL: a country's workers on a rung that is a laggard at year Y (>= 5,000 of them), divided by the same rung's workers in the same
// country at Y+10. Compared with rungs that are not behind at all (control).
//   node laggards.mjs <bookConfig> <label>=<sessions>:<setup> [...] [--years 1860,...]
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
const REPO = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const SES = join(REPO, 'tools', 'testbed', 'sessions');
const { usableRuns } = await import('./lib_runs.mjs');
const args = process.argv.slice(2);
const cfg = JSON.parse(readFileSync(join(REPO, args[0]), 'utf8'));
let YEARS = [1850, 1860, 1870, 1880, 1890, 1900, 1910, 1920, 1930, 1935];
const yi = args.indexOf('--years'); if (yi > 0) YEARS = args[yi + 1].split(',').map(Number);
const groups = args.slice(1).filter((a, i, A) => a.includes('=') && A[i] !== '--years').map(a => { const [label, rest] = a.split('='); const [s, setup] = rest.split(':'); return { label, s, setup, vanilla: /vanilla/.test(setup) }; });
// pm -> {ind, era, emp}
const MOD = {}, VAN = {}, INDNAME = {};
for (const [id, ind] of Object.entries(cfg.industries)) {
  if (ind.disabled) continue;
  for (const t of ind.tiers || []) {
    const name = (t.key || '').replace(/^building_/, '').split('_')[0];
    INDNAME[id] = INDNAME[id] || (ind.tiers[0].key || id).replace(/^building_/, '');
    const base = Object.values(t.employment || {}).reduce((a, b) => a + b, 0) || 5000;
    if (t.pm_key) MOD[t.pm_key] = { ind: id, era: t.era, emp: base * (t.workforce_mult || 1) };
    if (t.vanilla_pm) VAN[t.vanilla_pm] = { ind: id, era: t.era, emp: base };
  }
}
const CONSUMER = new Set(['food_industry', 'textile_mill', 'furniture_manufactory', 'glassworks', 'paper_mill', 'art_academy']);
const med = a => { a = a.filter(Number.isFinite).sort((x, y) => x - y); if (!a.length) return NaN; const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const q = (a, p) => { a = a.filter(Number.isFinite).sort((x, y) => x - y); if (!a.length) return NaN; const i = (a.length - 1) * p, lo = Math.floor(i); return a[lo] + (a[Math.min(lo + 1, a.length - 1)] - a[lo]) * (i - lo); };
function frontier(byEra) { const tot = Object.values(byEra).reduce((a, b) => a + b, 0); if (tot <= 0) return -1; let f = -1; for (const [e, w] of Object.entries(byEra)) if (w >= 0.1 * tot && +e > f) f = +e; return f; }
function readYear(runDir, map) {
  const sd = join(runDir, 'save_summaries'); if (!existsSync(sd)) return {};
  const files = readdirSync(sd).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort();
  const byYear = {};
  for (const f of files) {                       // the LAST summary of a year = the branch that continued (resume replays)
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(sd, f))).toString()); } catch { continue; }
    const date = j.provenance && j.provenance.date; if (!date) continue;
    const parts = String(date).split('.').map(Number); if (parts[1] !== 1 || parts[2] !== 1) continue;
    const y = parts[0]; if (!YEARS.includes(y)) continue;
    const W = {};                                // country -> ind -> era -> workers
    const mkt = {};
    for (const [ck, c] of Object.entries(j.countries || {})) {
      mkt[ck] = c.market;
      for (const b of Object.values(c.buildings || {})) {
        const pms = b.pms || {}; const lv = b.levels || 0; if (!lv) continue;
        const sf = Math.min(1, (b.staffing || 0) / lv);
        for (const [pm, l] of Object.entries(pms)) {
          const r = map[pm]; if (!r) continue;
          const w = l * sf * r.emp; if (!(w > 0)) continue;
          (((W[ck] ||= {})[r.ind] ||= {})[r.era] = (W[ck][r.ind][r.era] || 0) + w);
        }
      }
    }
    byYear[y] = { W, mkt };
  }
  return byYear;
}
const out = {};
for (const g of groups) {
  const runs = usableRuns(SES, g.s, g.setup).runs;
  const map = g.vanilla ? VAN : MOD;
  const perYear = {}; const surv = { inm: [], trade: [], ctrl: [] }; const survW = { inm: [0, 0], trade: [0, 0], ctrl: [0, 0] };
  const indLag = {};                              // year -> ind -> [inMarketLag, tradeLag, total] summed over runs
  const comp = {}, survG = {};
  for (const rel of runs) {
    const Y = readYear(join(SES, rel), map);
    const status = {};                            // year -> country -> ind -> era -> 'inm'|'trade'|'ctrl'
    for (const y of YEARS) {
      const d = Y[y]; if (!d) continue;
      const M = {}, G = {};
      for (const [ck, inds] of Object.entries(d.W)) { const m = d.mkt[ck];
        for (const [i, eras] of Object.entries(inds)) for (const [e, w] of Object.entries(eras)) {
          (((M[m] ||= {})[i] ||= {})[e] = (M[m][i][e] || 0) + w); ((G[i] ||= {})[e] = (G[i][e] || 0) + w); } }
      const F = {}; for (const [m, inds] of Object.entries(M)) { F[m] = {}; for (const [i, eras] of Object.entries(inds)) F[m][i] = frontier(eras); }
      const GF = {}; for (const [i, eras] of Object.entries(G)) GF[i] = frontier(eras);
      let tot = 0, inm = 0, trade = 0; status[y] = {};
      for (const [ck, inds] of Object.entries(d.W)) { const m = d.mkt[ck]; status[y][ck] = {};
        for (const [i, eras] of Object.entries(inds)) { status[y][ck][i] = {};
          for (const [e, w] of Object.entries(eras)) {
            tot += w; const fm = F[m][i], fg = GF[i]; let s = 'ctrl';
            if (fm >= +e + 2) { inm += w; s = 'inm'; } else if (fg >= +e + 2) { trade += w; s = 'trade'; } else if (fm > +e || fg > +e) s = 'behind1';
            status[y][ck][i][e] = s;
            const L = (((indLag[y] ||= {})[i]) ||= [0, 0, 0]); if (s === 'inm') L[0] += w; if (s === 'trade') L[1] += w; L[2] += w;
            if (s === 'inm') { const k = `t${e} under a t${fm} frontier`; ((comp[y] ||= {})[k] = (comp[y][k] || 0) + w); }
          } } }
      (perYear[y] ||= []).push({ inm: inm / tot, trade: trade / tot, tot });
    }
    // survival over 10 years (YEARS must contain y and y+10)
    for (const y of YEARS) { const y2 = y + 10; if (!Y[y] || !Y[y2]) continue;
      for (const [ck, inds] of Object.entries(Y[y].W)) for (const [i, eras] of Object.entries(inds)) for (const [e, w] of Object.entries(eras)) {
        if (w < 5000) continue; const s = status[y] && status[y][ck] && status[y][ck][i] && status[y][ck][i][e]; if (!s || s === 'behind1') continue;
        if (!(ck in Y[y2].mkt)) continue;                       // the country is gone (annexed) - no reading
        const w2 = ((Y[y2].W[ck] || {})[i] || {})[e] || 0;
        surv[s].push(w2 / w); survW[s][0] += w; survW[s][1] += w2;
        const grp = CONSUMER.has(INDNAME[i]) ? 'consumer' : 'heavy+war'; const k = grp + '|' + s;
        ((survG[k] ||= { a: [], w: [0, 0] }).a.push(w2 / w)); survG[k].w[0] += w; survG[k].w[1] += w2;
      } }
  }
  out[g.label] = { n: runs.length, perYear, surv, survW, indLag, comp, survG };
}
const pct = x => Number.isFinite(x) ? (100 * x).toFixed(1) + '%' : '—';
console.log('LAGGARD SHARE of tiered workers (median over runs [p25–p75]): in-market = >= 2 tiers below its own market\'s frontier; trade-only = >= 2 below the world\'s only');
console.log('year  ' + groups.map(g => (g.label + ` n=${out[g.label].n}`).padEnd(44)).join(''));
for (const y of YEARS) {
  let line = String(y).padEnd(6);
  for (const g of groups) { const r = out[g.label].perYear[y] || []; const a = r.map(x => x.inm), b = r.map(x => x.trade);
    line += `in ${pct(med(a))} [${pct(q(a, .25))}–${pct(q(a, .75))}] · tr ${pct(med(b))}`.padEnd(44); }
  console.log(line);
}
console.log('\nTEN-YEAR SURVIVAL of a country\'s workers on a rung (>= 5,000 workers at Y), by the rung\'s position at Y; cases pooled over runs and Y = 1850…1925');
for (const g of groups) { const o = out[g.label];
  for (const s of ['inm', 'trade', 'ctrl']) { const a = o.surv[s]; const gone = a.filter(x => x < 0.5).length / (a.length || 1);
    console.log(`  ${g.label.padEnd(8)} ${({ inm: 'in-market laggard', trade: 'trade-only laggard', ctrl: 'not behind (control)' })[s].padEnd(22)} cases ${String(a.length).padStart(5)}  median survival ${pct(med(a))}  workers kept ${pct(o.survW[s][1] / o.survW[s][0])}  share more than halved ${pct(gone)}`); } }
for (const y of [1900, 1935]) {
  console.log(`\nIN-MARKET LAGGARD SHARE BY INDUSTRY at ${y} (workers summed over runs): ` + groups.map(g => g.label).join(' | '));
  const inds = new Set(); for (const g of groups) Object.keys(out[g.label].indLag[y] || {}).forEach(i => inds.add(i));
  for (const i of [...inds].sort((a, b) => +a - +b)) console.log('  ' + INDNAME[i].padEnd(24) + groups.map(g => { const L = (out[g.label].indLag[y] || {})[i]; return L ? `in ${pct(L[0] / L[2])} tr ${pct(L[1] / L[2])}` : '—'; }).map(s => s.padEnd(26)).join(''));
}
for (const y of [1900, 1935]) {
  console.log(`\nIN-MARKET LAGGARDS BY TIER PAIR at ${y} (share of all tiered workers, summed over runs)`);
  for (const g of groups) { const o = out[g.label]; const tot = (o.perYear[y] || []).reduce((a, r) => a + r.tot, 0);
    const c = Object.entries(o.comp[y] || {}).sort((a, b) => b[1] - a[1]);
    console.log('  ' + g.label.padEnd(8) + c.map(([k, w]) => `${k} ${pct(w / tot)}`).join(' · ')); }
}
console.log('\nTEN-YEAR SURVIVAL BY CHAIN (consumer = food, textile, furniture, glass, paper, art; heavy+war = the rest): workers kept · median · cases');
for (const g of groups) { const o = out[g.label];
  for (const k of ['consumer|inm', 'heavy+war|inm', 'consumer|trade', 'heavy+war|trade', 'consumer|ctrl', 'heavy+war|ctrl']) { const v = o.survG[k]; if (!v) continue;
    console.log(`  ${g.label.padEnd(8)} ${k.padEnd(18)} kept ${pct(v.w[1] / v.w[0])}  median ${pct(med(v.a))}  cases ${v.a.length}`); } }
