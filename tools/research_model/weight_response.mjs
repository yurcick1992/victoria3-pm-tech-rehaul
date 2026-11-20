// HOW DOES A CHANGE OF ai_weight MOVE THE AI'S PICKS? (BALANCE_FRAMEWORK §10.119 item 3; the pre-1.2 probe 4, 2026-11-20)
// Reads the runs of the tech_ai_weights overlay (tools/testbed/overlays/probe4_ai_weights_<v>.json): each run's quarterly v18+ summaries,
// every NEW research pick as research_pick.mjs finds it (the tech researched at B differs from A's, and A's is held at B), the choice set
// being F223's: the researchable technologies of each tree's OLDEST researchable era, the three trees together. Each technology carries
// the multiplier its run's overlay gave it (1 outside the design).
//
// The model: P(pick t) ∝ exp(θ_t) × f(class of t in this run), one θ per technology (it absorbs the base weight, the conditional adds and
// whatever else makes a technology attractive) and one factor per multiplier class, f(×1) = 1. The two overlay variants give every
// designed technology two classes, so f is identified within technologies. Fitted by the fixed point of a conditional logit with
// categorical terms (observed count = expected count for every technology and every class). The bootstrap resamples picks.
// The ai_weight^4 reading of F223 predicts f(m) = m^4: 1.25 → 2.44, 0.8 → 0.41, 0.5 → 0.063, 0.1 → 0.0001.
//
// usage: node tools/research_model/weight_response.mjs --run <runDir>=<overlay config> [--run …] [--boot 200] [--until-year 1846]
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib'; import { execFileSync } from 'node:child_process';
import { loadTree, canResearch } from './lib_tree.mjs';
const args = process.argv.slice(2);
const runs = []; let BOOT = 200, UNTIL = 9999;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--run') { const [d, c] = args[++i].split('='); runs.push({ dir: d, cfg: c }); }
  else if (args[i] === '--boot') BOOT = +args[++i];
  else if (args[i] === '--until-year') UNTIL = +args[++i];
}
if (!runs.length) { console.error('usage: --run <runDir>=<overlay config> [...]'); process.exit(2); }
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..');
const tree = loadTree(null);                            // vanilla's tree: the overlay changes weights only
const day = d => { const [y, m, dd] = d.split('.').map(Number); return Date.UTC(y, m - 1, dd) / 864e5; };
const picks = [];
for (const r of runs) {
  const des = JSON.parse(execFileSync('node', [path.join(REPO, 'tools/testbed/probe_overlay.mjs'), '--config', r.cfg, '--mod', '-', '--game', 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game', '--print-design'], { encoding: 'utf8' }));
  const mult = Object.fromEntries(des.table.map(x => [x.tech, x.mult]));
  const sd = path.join(r.dir, 'save_summaries');
  const sums = fs.readdirSync(sd).filter(f => f.endsWith('.json.gz')).map(f => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(sd, f))))).filter(s => +s.provenance.date.split('.')[0] <= UNTIL);
  for (const s of sums) s.date = s.provenance.date;
  sums.sort((a, b) => day(a.date) - day(b.date));
  let n = 0;
  for (let i = 1; i < sums.length; i++) {
    const A = sums[i - 1], B = sums[i];
    for (const [k, b] of Object.entries(B.countries)) {
      const a = A.countries[k]; if (!a || !b.researching || b.researching === a.researching) continue;
      const held = new Set(b.technologies_held); if (a.researching && !held.has(a.researching)) continue;   // a switch, not a completion
      const all = Object.values(tree.techs).filter(t => canResearch(tree, t.id, held) || t.id === b.researching);
      const low = {}; for (const t of all) low[t.category] = Math.min(low[t.category] ?? 9, t.era);
      const E = all.filter(t => t.era === low[t.category]).map(t => t.id);
      if (!E.includes(b.researching) || E.length < 2) continue;
      picks.push({ run: r.dir, d: B.date, k, E, pick: b.researching, m: E.map(t => mult[t] ?? 1) });
      n++;
    }
  }
  console.log(`${path.basename(path.dirname(r.dir))}/${path.basename(r.dir)} (${path.basename(r.cfg)}): ${sums.length} summaries ${sums[0]?.date} → ${sums.at(-1)?.date}, ${n} picks in the oldest-era set`);
}
const CLASSES = [...new Set(picks.flatMap(p => p.m))].sort((a, b) => a - b);
function fit(P) {
  const techs = [...new Set(P.flatMap(p => p.E))];
  const th = Object.fromEntries(techs.map(t => [t, 1])); const f = Object.fromEntries(CLASSES.map(c => [c, 1]));
  for (let it = 0; it < 400; it++) {
    const obsT = {}, expT = {}, obsC = {}, expC = {};
    for (const p of P) {
      const w = p.E.map((t, j) => th[t] * f[p.m[j]]); const W = w.reduce((s, x) => s + x, 0);
      p.E.forEach((t, j) => { const e = w[j] / W; expT[t] = (expT[t] || 0) + e; expC[p.m[j]] = (expC[p.m[j]] || 0) + e; });
      const j = p.E.indexOf(p.pick); obsT[p.pick] = (obsT[p.pick] || 0) + 1; obsC[p.m[j]] = (obsC[p.m[j]] || 0) + 1;
    }
    for (const t of techs) th[t] = Math.max(1e-6, th[t] * ((obsT[t] || 0) + 1e-3) / ((expT[t] || 0) + 1e-3));
    for (const c of CLASSES) if (c !== 1) f[c] = Math.max(1e-6, f[c] * ((obsC[c] || 0) + 1e-3) / ((expC[c] || 0) + 1e-3));
    const g = f[1]; for (const c of CLASSES) f[c] /= g; for (const t of techs) th[t] *= g;
  }
  return f;
}
const f = fit(picks);
const boots = CLASSES.map(() => []);
for (let b = 0; b < BOOT; b++) { const P = picks.map(() => picks[Math.floor(Math.random() * picks.length)]); const fb = fit(P); CLASSES.forEach((c, i) => boots[i].push(fb[c])); }
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };
console.log(`\n${picks.length} picks; the odds factor of each multiplier class against x1, with a technology term (bootstrap ${BOOT}, 5-95%):`);
console.log('  multiplier   picks in class   factor   5%–95%            ai_weight^4 predicts');
CLASSES.forEach((c, i) => {
  const nIn = picks.filter(p => p.m[p.E.indexOf(p.pick)] === c).length;
  console.log(`  x${String(c).padEnd(10)} ${String(nIn).padStart(8)}         ${f[c].toFixed(3).padStart(6)}   ${q(boots[i], 0.05).toFixed(3)}–${q(boots[i], 0.95).toFixed(3)}       ${(c ** 4).toFixed(4)}`);
});
// the exponent that best fits the factors: f(m) = m^g on the non-unit classes, least squares on logs
const pts = CLASSES.filter(c => c !== 1 && f[c] > 1e-5);
const g = pts.reduce((s, c) => s + Math.log(f[c]) * Math.log(c), 0) / pts.reduce((s, c) => s + Math.log(c) ** 2, 0);
console.log(`\nbest single exponent g in f = m^g over the classes: ${g.toFixed(2)} (F223's fit: 4)`);
