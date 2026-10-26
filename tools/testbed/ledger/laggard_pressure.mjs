// Promoted from a session scratchpad 2026-10-26 (FINDINGS F249 §4a; the user: the laggard comparison is flawed "when vanilla can switch" —
// "try seeing how do the economies where vanilla can't switch (as the tech is too low) feel under competitive pressure").
// BACKWARD ECONOMIES UNDER COMPETITIVE PRESSURE, vanilla against the canon — where vanilla CANNOT switch methods because the
// technology is missing, so the comparison is not confounded by vanilla's free upgrades (the user, 2026-10-26).
// A. STUCK LAGGARDS: a country's industry whose BEST rung sits >= 2 tiers under its own market's frontier, and which still lacks the
//    technology of the next rung TEN YEARS LATER (so neither arm can move it up in the interval). Ten-year workforce retention and
//    profit per worker, against the same country-industry cut that is NOT behind (control).
// B. BACKWARD MEMBERS of markets led by an advanced country (leader = the member holding the most technologies; a follower holds
//    >= GAP fewer and has >= MINPOP people): their tiered workers per head, GDP per head, SoL, U*, their share of the market's tiered
//    value added ÷ their share of its population — all also against their own leader.
// C. PORTUGAL (and any --tags): its market, tech gap to its leader, tiered workers per head, GDP per head, SoL, U*.
//   node backward.mjs <book> <label>=<sessions>:<setup> [...] [--gap 15] [--minpop 1e6] [--tags POR]
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
const REPO = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const SES = join(REPO, 'tools', 'testbed', 'sessions');
const { usableRuns } = await import('./lib_runs.mjs');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i > 0 ? args[i + 1] : d; };
const GAP = +opt('--gap', 15), MINPOP = +opt('--minpop', 1e6), TAGS = opt('--tags', 'POR').split(',');
const cfg = JSON.parse(readFileSync(join(REPO, args[0]), 'utf8'));
const groups = args.slice(1).filter(a => a.includes('=') && !a.startsWith('--')).map(a => { const [label, rest] = a.split('='); const [s, setup] = rest.split(':'); return { label, s, setup, vanilla: /vanilla/.test(setup) }; });
const YEARS = [1850, 1860, 1870, 1880, 1890, 1900, 1910, 1920, 1930, 1935];
const BIG = new Set(['GBR', 'FRA', 'USA', 'PRU', 'NGF', 'GER', 'NET', 'BEL', 'UNL']);
const MOD = {}, VAN = {}, NEXT = {}, TIERKEYS = new Set(), INDNAME = {};
for (const [id, ind] of Object.entries(cfg.industries)) {
  if (ind.disabled) continue; INDNAME[id] = (ind.tiers[0].key || id).replace(/^building_/, '');
  const byEra = {}; for (const t of ind.tiers) { byEra[t.era] = t; TIERKEYS.add(t.key); }
  for (const t of ind.tiers) {
    const base = Object.values(t.employment || {}).reduce((a, b) => a + b, 0) || 5000;
    if (t.pm_key) MOD[t.pm_key] = { ind: id, era: t.era, emp: base * (t.workforce_mult || 1) };
    if (t.vanilla_pm) VAN[t.vanilla_pm] = { ind: id, era: t.era, emp: base };
  }
  const eras = Object.keys(byEra).map(Number).sort((a, b) => a - b);
  NEXT[id] = {}; eras.forEach((e, i) => { const n = eras[i + 1]; NEXT[id][e] = n == null ? null : byEra[n].tech; });
}
const med = a => { a = a.filter(Number.isFinite).sort((x, y) => x - y); if (!a.length) return NaN; const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const sum = a => a.reduce((x, y) => x + y, 0);
function readRun(runDir, map) {
  const sd = join(runDir, 'save_summaries'); if (!existsSync(sd)) return {};
  const byYear = {};
  for (const f of readdirSync(sd).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(sd, f))).toString()); } catch { continue; }
    const p = String(j.provenance && j.provenance.date || '').split('.').map(Number); if (p[1] !== 1 || p[2] !== 1 || !YEARS.includes(p[0])) continue;
    const C = {};
    for (const [ck, c] of Object.entries(j.countries || {})) {
      const W = {}; let va = 0, prof = {}, pop = Object.values(c.strata || {}).reduce((a, b) => a + b, 0);
      for (const [bk, b] of Object.entries(c.buildings || {})) {
        const lv = b.levels || 0; if (!lv) continue; const sf = Math.min(1, (b.staffing || 0) / lv);
        let indOf = null;
        for (const [pm, l] of Object.entries(b.pms || {})) { const r = map[pm]; if (!r) continue; indOf = r.ind;
          const w = l * sf * r.emp; if (w > 0) ((W[r.ind] ||= {})[r.era] = (W[r.ind][r.era] || 0) + w); }
        if (TIERKEYS.has(bk) || indOf) { if (b.va_out != null) va += 52 * ((+b.va_out || 0) - (+b.va_in || 0));
          if (indOf) prof[indOf] = (prof[indOf] || 0) + (+b.profit || 0); }
      }
      const ps = c.pop_statistics || {}; const sal = +ps.population_salaried_workforce || 0, un = +ps.population_unemployed_workforce || 0, pe = (+ps.population_subsisting_workforce || 0) * 1e5;
      C[ck] = { tag: c.tag || ck.split('@')[0], m: c.market, gdp: +c.gdp || 0, pop, sol: +c.avg_sol, techs: new Set(c.technologies_held || []), ntech: (c.technologies_held || []).length,
        U: (sal + un + pe) > 0 ? (un + pe) / (sal + un + pe) : NaN, W, va, prof, overlord: c.overlord };
    }
    byYear[p[0]] = C;                      // the LAST summary of a year (a replayed branch overwrites the abandoned one)
  }
  return byYear;
}
function frontier(byEra) { const tot = sum(Object.values(byEra)); if (tot <= 0) return -1; let f = -1; for (const [e, w] of Object.entries(byEra)) if (w >= 0.1 * tot && +e > f) f = +e; return f; }
const res = {};
for (const g of groups) {
  const runs = usableRuns(SES, g.s, g.setup).runs; const map = g.vanilla ? VAN : MOD;
  const A = { stuck: [], ctrl: [], stuckW: [0, 0], ctrlW: [0, 0], stuckP: [], ctrlP: [] }; const AX = {};
  const B = {}; const Cc = {};                             // B[year] = [{...per market}], C[tag][year] = [...]
  for (const rel of runs) {
    const Y = readRun(join(SES, rel), map);
    for (const y of YEARS) { const d = Y[y]; if (!d) continue;
      // markets: members, leader (most technologies; ties by GDP)
      const mk = {}; for (const [ck, c] of Object.entries(d)) (mk[c.m] ||= []).push(ck);
      const leaderOf = {}; for (const [m, ks] of Object.entries(mk)) leaderOf[m] = ks.slice().sort((a, b) => (d[b].ntech - d[a].ntech) || (d[b].gdp - d[a].gdp))[0];
      // frontier per market and industry
      const GW = {}; for (const c of Object.values(d)) for (const [i, eras] of Object.entries(c.W)) for (const [e, w] of Object.entries(eras)) ((GW[i] ||= {})[e] = (GW[i][e] || 0) + w); const GF = {}; for (const [i, eras] of Object.entries(GW)) GF[i] = frontier(eras);
      const F = {}; for (const [m, ks] of Object.entries(mk)) { const M = {}; for (const k of ks) for (const [i, eras] of Object.entries(d[k].W)) for (const [e, w] of Object.entries(eras)) ((M[i] ||= {})[e] = (M[i][e] || 0) + w); F[m] = {}; for (const [i, eras] of Object.entries(M)) F[m][i] = frontier(eras); }
      // A: stuck laggards (y -> y+10)
      const d2 = Y[y + 10];
      if (d2) for (const [ck, c] of Object.entries(d)) { if (!d2[ck]) continue;
        for (const [i, eras] of Object.entries(c.W)) { const w = sum(Object.values(eras)); if (w < 5000) continue;
          const best = Math.max(...Object.entries(eras).filter(([, x]) => x > 0.05 * w).map(([e]) => +e)); const nx = NEXT[i][best];
          if (!nx || d2[ck].techs.has(nx)) continue;                 // can move up within the decade (or no rung above): not "stuck"
          const fm = F[c.m][i]; const w2 = sum(Object.values(d2[ck].W[i] || {}));
          const p = (c.prof[i] || 0) / w * 1000;                      // weekly profit per 1,000 workers
          { const st = fm >= best + 2 ? 'inm' : GF[i] >= best + 2 ? 'trade' : fm <= best ? 'ctrl' : null;
            if (st) { const ch = ['food_industry', 'textile_mill', 'furniture_manufactory', 'glassworks', 'paper_mill', 'art_academy'].includes(INDNAME[i]) ? 'consumer' : 'heavy+war';
              for (const k of [st, st + '|' + ch]) { const o = (AX[k] ||= { a: [], w: [0, 0], p: [] }); o.a.push(w2 / w); o.w[0] += w; o.w[1] += w2; o.p.push(p); } } }
          if (fm >= best + 2) { A.stuck.push(w2 / w); A.stuckW[0] += w; A.stuckW[1] += w2; A.stuckP.push(p); }
          else if (fm <= best) { A.ctrl.push(w2 / w); A.ctrlW[0] += w; A.ctrlW[1] += w2; A.ctrlP.push(p); } } }
      // B: backward members of markets led by an advanced (shortlist) country
      for (const [m, ks] of Object.entries(mk)) { const L = d[leaderOf[m]]; if (!BIG.has(L.tag)) continue;
        const fol = ks.filter(k => k !== leaderOf[m] && d[k].pop >= MINPOP && L.ntech - d[k].ntech >= GAP); if (!fol.length) continue;
        const tw = k => sum(Object.values(d[k].W).flatMap(e => Object.values(e)));
        const mVA = sum(ks.map(k => d[k].va)), mPop = sum(ks.map(k => d[k].pop));
        const fVA = sum(fol.map(k => d[k].va)), fPop = sum(fol.map(k => d[k].pop)), fTW = sum(fol.map(tw)), fGDP = sum(fol.map(k => d[k].gdp));
        const lTWpc = tw(leaderOf[m]) / L.pop, lGDPpc = L.gdp / L.pop;
        const rowB = { leader: L.tag, n: fol.length, gap: med(fol.map(k => L.ntech - d[k].ntech)), twpc: fTW / fPop, twRel: (fTW / fPop) / lTWpc, gdppc: fGDP / fPop, gdpRel: (fGDP / fPop) / lGDPpc, sol: med(fol.map(k => d[k].sol)), solGap: L.sol - med(fol.map(k => d[k].sol)), U: med(fol.map(k => d[k].U)), vaShare: mVA > 0 ? fVA / mVA : NaN, popShare: fPop / mPop, intensity: mVA > 0 ? (fVA / mVA) / (fPop / mPop) : NaN, tags: [] };
        if (L.tag === 'GBR') (B['GBR' + y] ||= []).push(rowB);
        (B[y] ||= []).push({ leader: L.tag, n: fol.length, gap: med(fol.map(k => L.ntech - d[k].ntech)),
          twpc: fTW / fPop, twRel: (fTW / fPop) / lTWpc, gdppc: fGDP / fPop, gdpRel: (fGDP / fPop) / lGDPpc,
          sol: med(fol.map(k => d[k].sol)), solGap: L.sol - med(fol.map(k => d[k].sol)), U: med(fol.map(k => d[k].U)),
          vaShare: mVA > 0 ? fVA / mVA : NaN, popShare: fPop / mPop, intensity: mVA > 0 ? (fVA / mVA) / (fPop / mPop) : NaN, tags: fol.map(k => d[k].tag) });
      }
      // C: named tags
      for (const t of TAGS) { const ck = Object.keys(d).find(k => d[k].tag === t && !k.includes('@')); if (!ck) continue; const c = d[ck]; const L = d[leaderOf[c.m]];
        const tw = sum(Object.values(c.W).flatMap(e => Object.values(e))); const ltw = sum(Object.values(L.W).flatMap(e => Object.values(e)));
        ((Cc[t] ||= {})[y] ||= []).push({ leader: L.tag, gap: L.ntech - c.ntech, ntech: c.ntech, twpc: tw / c.pop, twRel: (tw / c.pop) / (ltw / L.pop), gdppc: c.gdp / c.pop, gdpRel: (c.gdp / c.pop) / (L.gdp / L.pop), sol: c.sol, U: c.U, pop: c.pop }); }
    }
  }
  res[g.label] = { n: runs.length, A, AX, B, C: Cc };
}
const pc = x => Number.isFinite(x) ? (100 * x).toFixed(1) + '%' : '—', f2 = (x, d = 2) => Number.isFinite(x) ? x.toFixed(d) : '—';
console.log(`A. STUCK LAGGARDS — a country's industry whose best rung is >= 2 tiers under its own market's frontier and which still lacks the next rung's technology 10 years on (neither arm can move it up); >= 5,000 workers; y = 1850…1920 → y+10`);
for (const g of groups) { const a = res[g.label].A;
  console.log(`  ${g.label.padEnd(10)} n=${res[g.label].n}  stuck laggards: cases ${a.stuck.length}, workers kept ${pc(a.stuckW[1] / a.stuckW[0])}, median case ${pc(med(a.stuck))}, profit £${f2(med(a.stuckP), 0)}/wk per 1,000 workers  ·  stuck, not behind: cases ${a.ctrl.length}, kept ${pc(a.ctrlW[1] / a.ctrlW[0])}, median ${pc(med(a.ctrl))}, profit £${f2(med(a.ctrlP), 0)}  ·  relative retention ${f2((a.stuckW[1] / a.stuckW[0]) / (a.ctrlW[1] / a.ctrlW[0]))}`); }
console.log('  by status and chain (cases · workers kept · median case · profit £/wk per 1,000 workers):');
for (const k of ['inm', 'trade', 'ctrl', 'inm|consumer', 'inm|heavy+war', 'trade|consumer', 'trade|heavy+war', 'ctrl|consumer', 'ctrl|heavy+war']) console.log('  ' + k.padEnd(18) + groups.map(g => { const o = res[g.label].AX[k]; return o ? (g.label + ' ' + o.a.length + ' · ' + pc(o.w[1] / o.w[0]) + ' · ' + pc(med(o.a)) + ' · £' + f2(med(o.p), 0)).padEnd(50) : ''; }).join(''));
console.log(`\nB. BACKWARD MEMBERS of markets led by a shortlist country (leader = most technologies; follower >= ${GAP} technologies behind it, >= ${MINPOP / 1e6}M people) — median over market-years`);
console.log('  year arm        cases  gap  tiered workers/head  ÷leader  GDP/head £  ÷leader  SoL (gap to leader)  U*     share of the market\'s tiered VA ÷ share of its people');
for (const y of [1880, 1900, 1920, 1935, 'GBR1880', 'GBR1900', 'GBR1920', 'GBR1935']) for (const g of groups) { const r = res[g.label].B[y] || []; if (!r.length) continue;
  console.log(`  ${y} ${g.label.padEnd(10)} ${String(r.length).padStart(5)} ${f2(med(r.map(x => x.gap)), 0).padStart(4)}   ${f2(med(r.map(x => x.twpc)), 4).padStart(8)}         ${f2(med(r.map(x => x.twRel))).padStart(5)}   ${f2(med(r.map(x => x.gdppc)), 1).padStart(6)}    ${f2(med(r.map(x => x.gdpRel))).padStart(5)}   ${f2(med(r.map(x => x.sol)), 1)} (${f2(med(r.map(x => x.solGap)), 1)})        ${pc(med(r.map(x => x.U))).padStart(6)}  ${f2(med(r.map(x => x.intensity)))}`); }
console.log('\n  most frequent followers (tag × market-years):');
for (const g of groups) { const cnt = {}; for (const r of Object.values(res[g.label].B).flat()) for (const t of r.tags) cnt[t] = (cnt[t] || 0) + 1;
  console.log('  ' + g.label.padEnd(10) + Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([t, n]) => t + ' ' + n).join(' · ')); }
for (const t of TAGS) { console.log(`\nC. ${t}: per year, median over runs [the runs where it exists]`);
  console.log('  year arm        runs  leader(s)            tech gap  techs  tiered workers/head ÷leader  GDP/head ÷leader  SoL   U*');
  for (const y of [1860, 1880, 1900, 1920, 1935]) for (const g of groups) { const r = ((res[g.label].C[t] || {})[y]) || []; if (!r.length) continue;
    const L = {}; r.forEach(x => L[x.leader] = (L[x.leader] || 0) + 1);
    console.log(`  ${y} ${g.label.padEnd(10)} ${String(r.length).padStart(4)}  ${Object.entries(L).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(',').padEnd(20)} ${f2(med(r.map(x => x.gap)), 0).padStart(5)}  ${f2(med(r.map(x => x.ntech)), 0).padStart(5)}  ${f2(med(r.map(x => x.twpc)), 4).padStart(10)}  ${f2(med(r.map(x => x.twRel))).padStart(5)}   ${f2(med(r.map(x => x.gdppc)), 1).padStart(6)} ${f2(med(r.map(x => x.gdpRel))).padStart(5)}  ${f2(med(r.map(x => x.sol)), 1)}  ${pc(med(r.map(x => x.U)))}`); } }
