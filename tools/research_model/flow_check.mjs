// FLOW CHECK — do the research and spread formulas account for the progress a country actually gains between two saves? (BALANCE_FRAMEWORK §10.96)
// Needs v18 summaries (innovation, cap, spreading, progress_unheld). For each country and each pair of consecutive summaries A → B:
//   · the RESEARCHED tech at A, if still unheld at B and not also spreading at A: its progress gain ÷ weeks = the observed research rate,
//     against min(innovation, cap) at A;
//   · each SPREADING tech at A, still unheld at B, not the researched one: its gain ÷ weeks = the observed spread rate in its tree, against
//     (25 + 75 × literacy + 0.2 × max(0, innovation − cap)) × (1 + the law multipliers);
//   · and the techs that completed between A and B, counted separately (their gain is not observable — progress resets).
// Prints ratio distributions (observed ÷ formula) by country class, and the cases that break the formula.
// usage: node tools/research_model/flow_check.mjs <dir of summaries .json.gz> [--mod <emitted mod>] [--tags GBR,USA] [--detail]
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { loadTree } from './lib_tree.mjs';
const args = process.argv.slice(2); const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const DIR = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--mod' && args[args.indexOf(a) - 1] !== '--tags');
const tree = loadTree(opt('--mod', null));
const TAGS = opt('--tags', '').split(',').filter(Boolean);
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json.gz')).sort();
const day = d => { const [y, m, dd] = d.split('.').map(Number); return Date.UTC(y, m - 1, dd) / 864e5; };
// spread multipliers from laws (game files: 02_free_speech, 01_trade_policy, 01_economic_system); rank / IG / company / event terms are NOT here
const LAW_SPREAD = { law_outlawed_dissent: -0.15, law_censorship: -0.10, law_protected_speech: 0.25, law_isolationism: -0.15, law_canton_system: -0.10, law_sakoku: -0.20 };
const LAW_SPREAD_PROD = { law_industry_banned: -0.25 };
const LAW_RESEARCH_PROD = { law_industry_banned: -0.25 };
const sums = files.map(f => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, f)))));
for (const s of sums) s.date = s.provenance.date;
sums.sort((a, b) => day(a.date) - day(b.date));
const R = [], S = [];
for (let i = 1; i < sums.length; i++) {
  const A = sums[i - 1], B = sums[i]; const w = (day(B.date) - day(A.date)) / 7; if (w <= 0 || w > 60) continue;
  for (const [k, a] of Object.entries(A.countries)) {
    const b = B.countries[k]; if (!b || a.innovation == null || b.innovation == null) continue;
    if (TAGS.length && !TAGS.includes(a.tag ?? k.split('@')[0])) continue;
    const heldB = new Set(b.technologies_held), lit = a.literacy ?? 0;
    const excess = Math.max(0, a.innovation - a.max_innovation);
    const laws = a.laws || [];
    const mult = laws.reduce((s, l) => s + (LAW_SPREAD[l] || 0), 0);
    const cls = a.innovation <= 50.01 ? 'base50' : a.innovation < a.max_innovation - 0.5 ? 'under' : 'capped';
    // research
    const rt = a.researching;
    if (rt && !heldB.has(rt) && !(a.spreading || []).includes(rt) && b.researching === rt) {
      const g = ((b.progress_unheld || {})[rt] ?? 0) - ((a.progress_unheld || {})[rt] ?? 0);
      const cat = tree.techs[rt]?.category;
      const f = Math.min(a.innovation, a.max_innovation) * (1 + (cat === 'production' ? laws.reduce((s, l) => s + (LAW_RESEARCH_PROD[l] || 0), 0) : 0));
      R.push({ k, d: A.date, cls, obs: g / w, f, lit, inn: a.innovation, cap: a.max_innovation, t: rt });
    }
    for (const st of a.spreading || []) {
      if (st === rt || heldB.has(st) || !(b.spreading || []).includes(st) || st === b.researching) continue;
      const cat = tree.techs[st]?.category;
      const m = 1 + mult + (cat === 'production' ? laws.reduce((s, l) => s + (LAW_SPREAD_PROD[l] || 0), 0) : 0);
      const g = ((b.progress_unheld || {})[st] ?? 0) - ((a.progress_unheld || {})[st] ?? 0);
      S.push({ k, d: A.date, ct: a.country_type, cls, cat, obs: g / w, f: (25 + 75 * lit + 0.2 * excess) * m, lit, excess, m, t: st });
    }
  }
}
const q = (v, p) => { const s = [...v].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
const show = (lab, rows) => {
  const r = rows.map(x => x.obs / x.f).filter(Number.isFinite);
  console.log(`${lab.padEnd(34)} n ${String(r.length).padStart(5)}  obs÷formula p10 ${q(r, .1).toFixed(3)} p25 ${q(r, .25).toFixed(3)} median ${q(r, .5).toFixed(3)} p75 ${q(r, .75).toFixed(3)} p90 ${q(r, .9).toFixed(3)}`);
};
console.log(`${sums.length} summaries ${sums[0].date} → ${sums.at(-1).date}`);
console.log('\nRESEARCH (the researched tech, unchanged A → B):');
for (const c of ['base50', 'under', 'capped']) show('  ' + c, R.filter(x => x.cls === c));
console.log('\nSPREAD (a spreading tech, unchanged A → B), by tree and class:');
for (const cat of tree.cats) for (const c of ['base50', 'under', 'capped']) show(`  ${cat} ${c}`, S.filter(x => x.cat === cat && x.cls === c));
console.log('\nSPREAD by literacy band (all trees): obs ÷ formula');
for (const [lo, hi] of [[0, .1], [.1, .25], [.25, .5], [.5, .75], [.75, 1.01]]) show(`  literacy ${lo}-${hi}`, S.filter(x => x.lit >= lo && x.lit < hi));
console.log('\nSPREAD observed rate, regression obs = a + b·lit + c·excess (per week, m=1 rows only):');
{ const rows = S.filter(x => Math.abs(x.m - 1) < 1e-9); const X = rows.map(x => [1, x.lit, x.excess]), y = rows.map(x => x.obs);
  const XtX = [[0,0,0],[0,0,0],[0,0,0]], Xty = [0,0,0];
  for (let i = 0; i < X.length; i++) for (let a = 0; a < 3; a++) { Xty[a] += X[i][a] * y[i]; for (let b = 0; b < 3; b++) XtX[a][b] += X[i][a] * X[i][b]; }
  const inv = m => { const [[a,b,c],[d,e,f],[g,h,i]] = m; const A = e*i-f*h, B = -(d*i-f*g), C = d*h-e*g, det = a*A + b*B + c*C;
    return [[A, -(b*i-c*h), b*f-c*e],[B, a*i-c*g, -(a*f-c*d)],[C, -(a*h-b*g), a*e-b*d]].map(r => r.map(v => v / det)); };
  const I = inv(XtX); const beta = I.map(r => r.reduce((s, v, j) => s + v * Xty[j], 0));
  console.log(`  n ${rows.length}: a ${beta[0].toFixed(2)} (game 25)  b ${beta[1].toFixed(2)} (game 75)  c ${beta[2].toFixed(3)} (game 0.2)`); }
if (args.includes('--detail')) {
  console.log('\nlargest research misfits:'); for (const x of [...R].sort((a, b) => Math.abs(b.obs / b.f - 1) - Math.abs(a.obs / a.f - 1)).slice(0, 15)) console.log(' ', x.k, x.d, x.t, x.obs.toFixed(1), 'vs', x.f.toFixed(1), x.cls);
  console.log('largest spread misfits:'); for (const x of [...S].sort((a, b) => Math.abs(b.obs / b.f - 1) - Math.abs(a.obs / a.f - 1)).slice(0, 15)) console.log(' ', x.k, x.d, x.t, x.obs.toFixed(1), 'vs', x.f.toFixed(1), x.cls, 'lit', x.lit.toFixed(2));
}
{ // binned observed spread per week (law multiplier 1 only) against literacy, and a two-term least-squares fit
  const rows = S.filter(x => Math.abs(x.m - 1) < 1e-9 && Number.isFinite(x.obs) && x.excess < 0.01);
  let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0; for (const r of rows) { n++; sx += r.lit; sy += r.obs; sxx += r.lit * r.lit; sxy += r.lit * r.obs; }
  const b = (n * sxy - sx * sy) / (n * sxx - sx * sx), a = (sy - b * sx) / n;
  console.log(`\nSPREAD fit, no excess, law mult 1: obs = ${a.toFixed(2)} + ${b.toFixed(2)} × literacy  (n ${n}; the game's 25 + 75)`);
  for (let lo = 0; lo < 1; lo += 0.1) { const r = rows.filter(x => x.lit >= lo && x.lit < lo + 0.1); if (r.length < 20) continue;
    const mo = r.reduce((s, x) => s + x.obs, 0) / r.length, ml = r.reduce((s, x) => s + x.lit, 0) / r.length;
    console.log(`  lit ${lo.toFixed(1)}–${(lo + .1).toFixed(1)}  n ${String(r.length).padStart(5)}  mean lit ${ml.toFixed(3)}  obs ${mo.toFixed(1)}  formula ${(25 + 75 * ml).toFixed(1)}  ratio ${(mo / (25 + 75 * ml)).toFixed(3)}`); }
}
console.log('\nSPREAD by country type (law mult 1, no excess): obs ÷ (25 + 75·lit)');
for (const ct of ['recognized', 'unrecognized', 'colonial', 'decentralized']) show('  ' + ct, S.filter(x => x.ct === ct && Math.abs(x.m - 1) < 1e-9 && x.excess < 0.01));
