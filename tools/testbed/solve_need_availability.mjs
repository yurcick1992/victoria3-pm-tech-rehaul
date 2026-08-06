// solve_need_availability.mjs — recover the game's OWN per-good availability vector from the
// purchase weights a savegame stores, and ask what that vector equals.
//
//   node tools/testbed/solve_need_availability.mjs <needs.tsv> --region STATE_MIDLANDS
//
// ⭐ THE IDEA. A save stores, per state, `purchase weight = base weight × share`. Divide out the base
// weight from common/pop_needs and you have the game's own `share` for every (need, good). If the
// rule has the form
//
//        share(need, good) = availability(good) / D(need)
//
// then a good that sits in TWO needs pins the ratio D(n1)/D(n2) all by itself — and any second good
// shared by the same pair must give the SAME ratio. That is a test the data can fail, and it needs no
// order book, no price and no assumption about what `availability` means.
//
// So: least squares on logs for log a(good) and log D(need), one gauge fixed, using only observations
// that are NOT sitting on a min/max clamp (a clamped share carries no information about a). Then the
// residual per observation says where the form breaks, and D(need) / Σ availability over the need's
// own goods says whether the denominator is the need's own total - the reading everything so far has
// assumed.
import { readFileSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
const SRC = args.find(a => !a.startsWith('--'));
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const REGION = argOf('--region', 'STATE_MIDLANDS');
const KEY = argOf('--key', '');
if (!SRC || !existsSync(SRC)) { console.error('usage: solve_need_availability.mjs <needs.tsv> [--region R] [--key K]'); process.exit(1); }

const lines = readFileSync(SRC, 'utf8').split('\n').filter(Boolean);
const head = lines[0].split('\t');
const ix = Object.fromEntries(head.map((h, i) => [h, i]));
const rows = [];
for (let i = 1; i < lines.length; i++) {
  const c = lines[i].split('\t');
  if (c[ix.region] !== REGION) continue;
  if (KEY && c[ix.key] !== KEY) continue;
  rows.push({
    need: c[ix.need], good: c[ix.good], w: +c[ix.weight], base: +c[ix.base],
    share: +c[ix.share], maxs: +c[ix.maxs], mins: +c[ix.mins], clamp: c[ix.clamp] || ''
  });
}
if (!rows.length) { console.error(`no rows for region ${REGION}`); process.exit(1); }

const needs = [...new Set(rows.map(r => r.need))];
const goods = [...new Set(rows.map(r => r.good))];
console.log(`${REGION}: ${rows.length} observations · ${needs.length} needs · ${goods.length} goods`);

// which observations are usable: share > 0 and not sitting on a clamp
const usable = rows.filter(r => r.share > 1e-9 && !r.clamp);
console.log(`usable (non-zero, unclamped): ${usable.length}   clamped: ${rows.filter(r => r.clamp).length}   zero: ${rows.filter(r => r.share <= 1e-9).length}`);

// ---- 1. the direct test: every good in two needs pins D(n1)/D(n2) ----
const byGood = new Map();
for (const r of usable) { if (!byGood.has(r.good)) byGood.set(r.good, []); byGood.get(r.good).push(r); }
const pairRatios = new Map();     // "n1|n2" -> [{good, ratio}]
for (const [good, rs] of byGood) {
  if (rs.length < 2) continue;
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const [a, b] = [rs[i], rs[j]];
    const k = a.need + '|' + b.need;              // ratio = D(b)/D(a) = share(a)/share(b)
    if (!pairRatios.has(k)) pairRatios.set(k, []);
    pairRatios.get(k).push({ good, ratio: a.share / b.share });
  }
}
console.log('\n=== TEST 1 — does one good\'s D-ratio agree with another good\'s, for the same pair of needs? ===');
console.log('(the model share = a(good)/D(need) predicts every good of a pair gives the SAME ratio)');
let agree = 0, disagree = 0;
for (const [k, list] of [...pairRatios].sort((x, y) => y[1].length - x[1].length)) {
  if (list.length < 2) continue;
  const rs = list.map(x => x.ratio);
  const spread = Math.max(...rs) / Math.min(...rs) - 1;
  const verdict = spread < 0.002 ? 'AGREE' : (spread < 0.05 ? 'close' : 'DISAGREE');
  if (verdict === 'AGREE') agree++; else disagree++;
  console.log(`  ${k.replace('|', ' / ').padEnd(38)} ${verdict.padEnd(9)} spread ${(spread * 100).toFixed(3)}%   ` +
    list.map(x => `${x.good}=${x.ratio.toFixed(5)}`).join('  '));
}
console.log(`  -> ${agree} pairs agree, ${disagree} do not`);

// ---- 2. least squares for log a(good), log D(need) ----
// share = a/D  =>  log share = log a - log D. Gauge: sum(log a) = 0.
const gi = Object.fromEntries(goods.map((g, i) => [g, i]));
const ni = Object.fromEntries(needs.map((n, i) => [n, i]));
const nG = goods.length, nN = needs.length;
let la = new Float64Array(nG), lD = new Float64Array(nN);
for (let it = 0; it < 20000; it++) {
  // alternate: a from needs, needs from a  (coordinate descent on a quadratic - converges fast)
  const sa = new Float64Array(nG), ca = new Float64Array(nG);
  for (const r of usable) { const k = gi[r.good]; sa[k] += Math.log(r.share) + lD[ni[r.need]]; ca[k]++; }
  for (let k = 0; k < nG; k++) if (ca[k]) la[k] = sa[k] / ca[k];
  const sd = new Float64Array(nN), cd = new Float64Array(nN);
  for (const r of usable) { const k = ni[r.need]; sd[k] += la[gi[r.good]] - Math.log(r.share); cd[k]++; }
  for (let k = 0; k < nN; k++) if (cd[k]) lD[k] = sd[k] / cd[k];
}
const A = Object.fromEntries(goods.map(g => [g, Math.exp(la[gi[g]])]));
const D = Object.fromEntries(needs.map(n => [n, Math.exp(lD[ni[n]])]));

let sse = 0, worst = [];
for (const r of usable) {
  const pred = A[r.good] / D[r.need];
  const err = pred / r.share - 1;
  sse += err * err; worst.push({ ...r, pred, err });
}
worst.sort((x, y) => Math.abs(y.err) - Math.abs(x.err));
console.log(`\n=== TEST 2 — least-squares fit of share = a(good)/D(need) ===`);
console.log(`rms relative error over ${usable.length} unclamped observations: ${(Math.sqrt(sse / usable.length) * 100).toFixed(3)} %`);
console.log('worst 12:');
for (const w of worst.slice(0, 12))
  console.log(`  ${w.need.padEnd(18)} ${w.good.padEnd(16)} observed ${w.share.toFixed(6)}  predicted ${w.pred.toFixed(6)}  ${(w.err * 100).toFixed(2)} %`);

// ---- 3. is D(need) the need's own total availability? ----
console.log('\n=== TEST 3 — D(need) against the sum of availability over that need\'s OWN goods ===');
console.log('need                 D(need)      sum a over need   ratio D/sum   n goods  sum of shares');
const bySum = [];
for (const n of needs) {
  const gs = rows.filter(r => r.need === n);
  const sum = gs.reduce((s, r) => s + (A[r.good] ?? 0), 0);
  const shareSum = gs.reduce((s, r) => s + r.share, 0);
  bySum.push({ n, D: D[n], sum, ratio: D[n] / sum, k: gs.length, shareSum });
}
for (const b of bySum.sort((x, y) => x.ratio - y.ratio))
  console.log(`${b.n.padEnd(20)} ${b.D.toFixed(5).padStart(10)} ${b.sum.toFixed(5).padStart(16)} ${b.ratio.toFixed(5).padStart(13)} ${String(b.k).padStart(8)} ${b.shareSum.toFixed(5).padStart(14)}`);

// ---- 4. the recovered availability vector, for comparison against an order book ----
console.log('\n=== the recovered availability vector (arbitrary scale) ===');
for (const [g, v] of Object.entries(A).sort((a, b) => b[1] - a[1]))
  console.log(`  ${g.padEnd(18)} ${v.toFixed(6)}`);
