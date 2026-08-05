// score_pop_split.mjs — score the pop-consumption model against DIRECTLY MEASURED consumption.
//
// F24 established the scoring method but did it ad hoc; nothing was committed, so the one measurement
// that can settle a question about the within-need split had to be rebuilt from scratch to ask a second
// question of it. This is that tool. It exists to answer BALANCE_FRAMEWORK §10.34 — whether
// `max_supply_share` bounds the RAW supply share (what we ship) or each good's FINAL share of the need —
// but it is not specific to that: it scores whatever `needSplit()` currently does, so any later change to
// the pop model can be re-scored the same way.
//
//   node tools/testbed/score_pop_split.mjs --session tools/testbed/sessions/<stamp>_<label>
//        [--tsv out.tsv] [--modes raw,final] [--per-good]
//
// ERROR IS MONETARY (F24): Σ|predicted − measured| × base price ÷ Σ measured × base price, over goods
// that appear in some pop need. It aggregates rather than averaging per-good percentages — which would
// let a 2-unit good outweigh a 10 000-unit one — and weights by money, because a unit of grain and a unit
// of luxury clothes are not comparable quantities. It reads as *the share of the market's pop spending we
// get wrong*.
//
// FOUR THINGS IN THE EXTRACTION ARE LOAD-BEARING, all of them lessons paid for in F24/F27:
//
//  1. EVERY LINE IS FILTERED BY THE RUN'S OWN TOKEN. The game's log is a 5×512 KB ring shared by every
//     run on the machine, so one run's mirror routinely holds the tail of the previous run — a different
//     market entirely, and silent plausible corruption if attributed here.
//  2. A BLOCK IS BELIEVED ONLY IF IT CLOSED AND ITS OWN TOTAL CHECKS OUT. The entry lines do not name
//     their good — only the surrounding BEGIN/C2end fence does — and at large-market volume the mirror
//     puts entries in the wrong block. Each block opens with its buy-orders total, and the same run's
//     `G|` telemetry carries `GetMarketBuyOrders` independently; disagreement means the block is not the
//     good its fence claims, so it is DISCARDED rather than guessed at.
//  3. VALUES ARE ABBREVIATED ABOVE 1000 — `17.1K`, `1.29M`. A bare numeric parse reads 17.1 for 17100.
//     Small markets never trigger it, which is exactly why it survived into a published number once.
//  4. MATCH ON THE TAIL, NEVER ACROSS THE LINE. The readable text follows a multi-KB base64 blob, so a
//     `.*` pattern happily pairs a "Pop" in one place with a "Consumption" in another. `v; ` cannot occur
//     inside base64 (`;` and space are outside its alphabet), so its last occurrence locates the tail.
//
// ⚠ A VERIFIED BLOCK WITH NO POP ENTRY MEANS ZERO, NOT MISSING. Dropping those would score only the goods
// pops actually buy and never charge the model for demand it invents.
import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { loadEcon, REPO } from '../econ_host.mjs';

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const SESSION = argOf('--session', '');
const TSV     = argOf('--tsv', '');
const MODES   = argOf('--modes', 'raw,final').split(',').map(s => s.trim()).filter(Boolean);
const PERGOOD = args.includes('--per-good');
if (!SESSION) { console.error('usage: score_pop_split.mjs --session <dir> [--tsv f] [--modes raw,final] [--per-good]'); process.exit(1); }
const SDIR = join(REPO, SESSION.replace(/^[.\\/]+/, ''));
if (!existsSync(SDIR)) { console.error(`session not found: ${SDIR}`); process.exit(1); }

// ---------------------------------------------------------------- measured
const MUL = { '': 1, K: 1e3, M: 1e6, B: 1e9 };
const strip = s => s.replace(/[\x00-\x1f\x7f]/g, '');

// The value sits after the LAST `v; ` on the line, which is past the base64 payload. Returns null when
// the tail is not a signed value line at all.
function tailValue(line, signed) {
  const i = line.lastIndexOf('v; ');
  if (i < 0) return null;
  const tail = strip(line.slice(i));
  const m = tail.match(signed ? /^v; \+([0-9.]+)([KMB]?)/ : /^v; ([0-9.]+)([KMB]?)/);
  return m ? { v: parseFloat(m[1]) * MUL[m[2]], tail } : null;
}

const runs = readdirSync(SDIR, { withFileTypes: true })
  .filter(d => d.isDirectory() && /^run\d+_/.test(d.name)).map(d => d.name).sort();
if (!runs.length) { console.error(`no run folders under ${SDIR}`); process.exit(1); }

const schedule = existsSync(join(SDIR, 'schedule.json'))
  ? JSON.parse(readFileSync(join(SDIR, 'schedule.json'), 'utf8')) : { runs: [] };

const plan = [];
for (const r of runs) {
  const metaP = join(SDIR, r, 'meta.json'), logP = join(SDIR, r, 'logs_live', 'debug.log');
  if (!existsSync(metaP) || !existsSync(logP)) { console.error(`  WARN ${r}: no meta.json / logs_live\\debug.log — skipped`); continue; }
  const token = JSON.parse(readFileSync(metaP, 'utf8')).token;
  if (!token) { console.error(`  WARN ${r}: meta.json carries no token — skipped`); continue; }
  const idx = parseInt(r.match(/^run0*(\d+)/)[1], 10) - 1;
  const tag = ((schedule.runs || [])[idx] || {}).tags?.[0] || null;
  plan.push({ run: r, token, log: logP, tag });
}

// PASS 1, SESSION-WIDE: the independent buy-orders table every block is checked against. Built across all
// runs deliberately — the breakdown's own volume can push a run's `G|` lines out of the ring entirely, and
// such a run would then verify to nothing. Runs in one session are the same arm at the same date.
const buyOf = new Map();
for (const p of plan) {
  for (const ln of readFileSync(p.log, 'utf8').split('\n')) {
    if (ln.length >= 400) continue;
    const m = ln.match(new RegExp(`\\|${p.token}\\|G\\|[^|]+\\|([^|]+)\\|([^|]+)\\|([0-9.]+)\\|`));
    if (m) buyOf.set(`${m[1]}\t${m[2]}`, parseFloat(m[3]));
  }
}
console.error(`reference buy-orders table: ${buyOf.size} market×good entries`);

// market -> good -> [values], one entry per run that verified that good
const measured = new Map();
const coverage = [];
for (const p of plan) {
  const reBeg = new RegExp(`\\|${p.token}\\|CP\\|C2\\|[^|]+\\|([^|]+)\\|([^|]+)\\|BEGIN`);
  const reEnd = new RegExp(`\\|${p.token}\\|CP\\|C2end\\|`);
  const reAny = /\|CP\|C2(end|done)?\|/;
  let mkt = null, good = null, total = null, pend = null, nCand = 0;
  let ok = 0, dropped = 0, badTotal = 0, ambiguous = 0, zero = 0;
  const seen = new Set();
  const reset = () => { good = null; total = null; pend = null; nCand = 0; };
  for (const ln of readFileSync(p.log, 'utf8').split('\n')) {
    const short = ln.length < 400;
    let m;
    if (short && (m = ln.match(reBeg))) {
      if (good) dropped++;
      mkt = m[1]; good = m[2]; total = null; pend = null; nCand = 0;
    } else if (short && reEnd.test(ln)) {
      if (good) {
        if (nCand > 1) ambiguous++;
        else {
          // VERIFY. 3 significant figures is all the tooltip prints, so allow 2% — misattribution looks
          // like orders of magnitude, never like a rounding difference.
          const ref = buyOf.get(`${mkt}\t${good}`);
          const good2 = ref != null && total != null && Math.abs(total - ref) <= Math.max(0.02 * Math.max(ref, 1), 1);
          if (!good2) badTotal++;
          else if (seen.has(good)) { /* already captured this run — never reopen */ }
          else {
            seen.add(good);
            if (!measured.has(mkt)) measured.set(mkt, new Map());
            const gm = measured.get(mkt);
            if (!gm.has(good)) gm.set(good, []);
            gm.get(good).push(pend || 0);            // no pop entry in a verified block IS a zero
            ok++; if (!pend) zero++;
          }
        }
      }
      reset();
    } else if (short && reAny.test(ln)) {            // another run's fence — the ring moved on
      if (good) dropped++;
      reset();
    } else if (good && total == null) {
      const t = tailValue(ln, false);
      if (t && /^v; [0-9.]+[KMB]?!?$/.test(strip(t.tail))) total = t.v;
    } else if (good) {
      const t = tailValue(ln, true);
      if (t && /Pop.{0,4}Consumption\s*$/.test(t.tail)) { nCand++; if (nCand === 1) pend = t.v; }
    }
  }
  if (good) dropped++;
  coverage.push({ run: p.run, tag: p.tag, market: mkt, verified: ok, ofWhichZero: zero, ambiguous, failedTotal: badTotal, unclosed: dropped });
}

console.error('\n=== extraction coverage per run (the breakdown truncates; each run loses a different tail) ===');
console.table(coverage);
if (!measured.size) { console.error('NO verified blocks — nothing to score.'); process.exit(1); }

// ---------------------------------------------------------------- predicted
const { E, S, presets } = loadEcon({ quiet: true });
const NEEDS = S.POPM.needs || {};
const needsOf = new Map();                            // good -> [need,…]
for (const nd in NEEDS) for (const e of (NEEDS[nd].entries || [])) {
  if (!needsOf.has(e.g)) needsOf.set(e.g, []);
  needsOf.get(e.g).push(nd);
}
const price = g => S.PRICES[g] || 0;

// A run names its market by the game's own market name; the preset is keyed by country tag. The
// schedule's tag is the authority, and among the markets a run captured the primary one is the one with
// the most verified goods (a run's other markets are its subjects', tiny by comparison).
function primaryMarket(tag) {
  let best = null, n = -1;
  for (const [m, gm] of measured) if (gm.size > n) { n = gm.size; best = m; }
  return best;
}
const byTag = new Map();
for (const c of coverage) if (c.tag && c.market) {
  if (!byTag.has(c.tag)) byTag.set(c.tag, { markets: new Map(), runs: [] });
  const e = byTag.get(c.tag);
  e.runs.push(c.run);
  e.markets.set(c.market, (e.markets.get(c.market) || 0) + c.verified);
}

function predict(mode, presetId) {
  const p = presets.find(x => x.id === presetId);
  if (!p) return null;
  S.SPLIT_MODE = mode;
  E.applyPreset(p);
  return E.scenarioAggregates().pop || {};
}

// ---------------------------------------------------------------- score
// Only goods that (a) appear in some pop need and (b) this run actually measured. A good the ring cut
// off is unmeasured, not zero — the one case where absence really is absence.
function score(meas, pred) {
  let num = 0, den = 0;
  const rows = [];
  for (const [g, mv] of meas) {
    if (!needsOf.has(g)) continue;
    const pv = pred[g] || 0, pr = price(g);
    num += Math.abs(pv - mv) * pr; den += mv * pr;
    rows.push({ good: g, measured: mv, predicted: pv, price: pr, errGBP: (pv - mv) * pr });
  }
  return { err: den > 0 ? num / den : NaN, num, den, rows };
}

// Within-need misallocation: normalise predicted and measured money to sum 1 across the need's measured
// goods and take the total-variation distance. It answers "of the money this need spends, what share
// landed on the wrong good" independently of whether the need's budget is right.
// ⚠ 17 of 35 goods sit in TWO needs, so a shared good is counted under both and the decomposition is not
// identifiable from the order book (F24). Read these as indicative, and only relative to each other.
function needError(meas, pred) {
  const out = [];
  for (const nd in NEEDS) {
    const gs = (NEEDS[nd].entries || []).map(e => e.g).filter(g => meas.has(g));
    if (gs.length < 2) continue;                      // one good ⇒ nothing to misallocate
    let mt = 0, pt = 0;
    for (const g of gs) { mt += meas.get(g) * price(g); pt += (pred[g] || 0) * price(g); }
    if (!(mt > 0) || !(pt > 0)) continue;
    let tv = 0;
    for (const g of gs) tv += Math.abs((pred[g] || 0) * price(g) / pt - meas.get(g) * price(g) / mt);
    out.push({ need: nd, goods: gs.length, misplacedPct: 100 * tv / 2, needGBP: mt });
  }
  return out.sort((a, b) => b.needGBP - a.needGBP);
}

const results = [];
const tsv = [['mode', 'tag', 'market', 'run', 'good', 'measured', 'predicted', 'base_price', 'err_gbp'].join('\t')];
for (const mode of MODES) {
  console.log(`\n${'='.repeat(78)}\n  SPLIT_MODE = ${mode}\n${'='.repeat(78)}`);
  const perMarket = [];
  for (const [tag, info] of byTag) {
    const market = [...info.markets].sort((a, b) => b[1] - a[1])[0][0];
    const presetId = `${tag.toLowerCase()}_1836`;
    const pred = predict(mode, presetId);
    if (!pred) { console.log(`  ${tag}: no preset ${presetId} — skipped`); continue; }
    const gm = measured.get(market);
    if (!gm) continue;
    // Each run of a market is scored separately, then averaged: the runs differ in which goods the ring
    // preserved, and F24 measured the target itself moving 2.5–4.7% between runs of the same market.
    const nRuns = Math.max(...[...gm.values()].map(v => v.length));
    const runScores = [];
    for (let r = 0; r < nRuns; r++) {
      const meas = new Map();
      for (const [g, vs] of gm) if (vs[r] != null) meas.set(g, vs[r]);
      if (!meas.size) continue;
      const s = score(meas, pred);
      if (!isFinite(s.err)) continue;
      runScores.push({ err: s.err, n: meas.size, s, meas });
      if (TSV) for (const row of s.rows)
        tsv.push([mode, tag, market, r + 1, row.good, row.measured.toFixed(2), row.predicted.toFixed(2), row.price, row.errGBP.toFixed(1)].join('\t'));
    }
    if (!runScores.length) continue;
    const mean = runScores.reduce((a, b) => a + b.err, 0) / runScores.length;
    perMarket.push({ tag, market, runs: runScores.length, goods: runScores.map(r => r.n).join('/'), errPct: +(100 * mean).toFixed(1), perRun: runScores.map(r => (100 * r.err).toFixed(1)).join(' / ') });
    const best = runScores.reduce((a, b) => a.err <= b.err ? a : b);
    results.push({ mode, tag, market, mean, best });
  }
  console.table(perMarket);
  const m = perMarket.reduce((a, b) => a + b.errPct, 0) / Math.max(1, perMarket.length);
  console.log(`  MEAN ABSOLUTE ERROR across ${perMarket.length} markets: ${m.toFixed(1)}%`);
}

// ---- the discriminating view: the needs whose caps actually bind
console.log(`\n${'='.repeat(78)}\n  WITHIN-NEED MISALLOCATION (% of the need's money on the wrong good)\n${'='.repeat(78)}`);
const needTab = new Map();
for (const r of results) {
  const pred = predict(r.mode, `${r.tag.toLowerCase()}_1836`);
  for (const n of needError(r.best.meas, pred)) {
    const k = n.need;
    if (!needTab.has(k)) needTab.set(k, {});
    const row = needTab.get(k);
    row.need = k;
    (row[`_${r.mode}`] = row[`_${r.mode}`] || []).push({ e: n.misplacedPct, w: n.needGBP });
  }
}
const needRows = [];
for (const [need, row] of needTab) {
  const o = { need };
  for (const mode of MODES) {
    const xs = row[`_${mode}`] || [];
    const w = xs.reduce((a, b) => a + b.w, 0);
    o[mode] = w > 0 ? +(xs.reduce((a, b) => a + b.e * b.w, 0) / w).toFixed(1) : null;
  }
  if (MODES.length === 2) o.delta = (o[MODES[1]] != null && o[MODES[0]] != null) ? +(o[MODES[1]] - o[MODES[0]]).toFixed(1) : null;
  o.capped = ((NEEDS[need].entries || []).some(e => (e.max != null && e.max < 1) || (e.min || 0) > 0)) ? 'yes' : '';
  needRows.push(o);
}
console.table(needRows.sort((a, b) => (b[MODES[0]] || 0) - (a[MODES[0]] || 0)));

// ---- DOES THE MEASUREMENT EVER BREAK A CAP? This is the one test here that does not depend on the rest
// of the model being right, and it can falsify the final-share reading outright rather than merely
// out-score it.
//
// For a good in EXACTLY ONE need, every pound the game spent on it belongs to that need, so its measured
// money is the numerator exactly. The need's own budget is unobservable — 17 of 35 goods serve two needs
// (F24) — but it cannot exceed the total measured money on all of the need's goods. Upper-bounding the
// denominator therefore LOWER-bounds the share:  share ≥ m_g / Σ_{h∈need} m_h.
// If that floor sits above the good's `max_supply_share`, no reading in which that field caps the final
// share can be true, whatever the rest of the model does. (Shared goods are skipped — their numerator is
// an upper bound, which bounds the share the wrong way.)
{
  const soleNeed = new Map();
  for (const [g, nds] of needsOf) if (nds.length === 1) soleNeed.set(g, nds[0]);
  const viol = [];
  for (const r of results.filter(x => x.mode === MODES[0])) {
    const meas = r.best.meas;
    for (const nd in NEEDS) {
      const gs = (NEEDS[nd].entries || []).map(e => e.g);
      // ⚠ EVERY good of the need must have been captured, not just some. A good the ring cut off is
      // unmeasured, not zero, so a partial denominator UNDER-states the budget and inflates the share
      // into a violation that is an artifact of truncation — which is exactly what it did first time,
      // reporting four goods at "100% of their need" because they were the only ones that survived.
      // (A verified block with no pop entry is a real zero and counts as captured.)
      if (!gs.every(g => meas.has(g))) continue;
      const tot = gs.reduce((a, g) => a + meas.get(g) * price(g), 0);
      if (!(tot > 0)) continue;
      for (const e of (NEEDS[nd].entries || [])) {
        if (soleNeed.get(e.g) !== nd || !meas.has(e.g)) continue;
        const cap = e.max != null ? e.max : 1;
        const floor = meas.get(e.g) * price(e.g) / tot;
        if (floor > cap + 1e-9)
          viol.push({ market: r.tag, need: nd.replace('popneed_', ''), good: e.g, cap, shareAtLeast: +(100 * floor).toFixed(1), exceedsBy: +(100 * (floor - cap)).toFixed(1) });
      }
    }
  }
  console.log(`\n${'='.repeat(78)}\n  MEASURED SHARES ABOVE THEIR OWN max_supply_share (unshared goods only)\n${'='.repeat(78)}`);
  if (viol.length) { console.table(viol.sort((a, b) => b.exceedsBy - a.exceedsBy)); console.log('  ⇒ the cap CANNOT be a bound on the final share of the need.'); }
  else console.log('  none — no unshared good is measured above its cap, so this test does not discriminate.');
}

// ---- one need, share by share. The per-need table above says WHICH need a mode gets wrong; this says
// what it does to it, which is the only way to tell a wrong rule from a wrong implementation of one.
const NEED1 = argOf('--need', '');
if (NEED1) {
  const def = NEEDS[NEED1];
  if (!def) { console.log(`\nno such need: ${NEED1}`); }
  else {
    console.log(`\n${'='.repeat(78)}\n  ${NEED1} — share of the need's money, measured vs predicted\n${'='.repeat(78)}`);
    console.log('  entries: ' + (def.entries || []).map(e => `${e.g} w=${e.w} max=${e.max}${e.min ? ' min=' + e.min : ''}`).join(' · '));
    for (const tag of [...byTag.keys()]) {
      const rs = results.filter(r => r.tag === tag);
      if (!rs.length) continue;
      const meas = rs[0].best.meas;
      const gs = (def.entries || []).map(e => e.g).filter(g => meas.has(g));
      if (gs.length < 2) continue;
      const mt = gs.reduce((a, g) => a + meas.get(g) * price(g), 0);
      if (!(mt > 0)) continue;
      const row = { market: tag };
      for (const g of gs) row[`${g} meas`] = +(100 * meas.get(g) * price(g) / mt).toFixed(1);
      for (const r of rs) {
        const pred = predict(r.mode, `${tag.toLowerCase()}_1836`);
        const pt = gs.reduce((a, g) => a + (pred[g] || 0) * price(g), 0);
        for (const g of gs) row[`${g} ${r.mode}`] = pt > 0 ? +(100 * (pred[g] || 0) * price(g) / pt).toFixed(1) : null;
      }
      console.table([row]);
    }
  }
}

if (PERGOOD) {
  console.log(`\n${'='.repeat(78)}\n  PER-GOOD, biggest absolute money error (best run per market)\n${'='.repeat(78)}`);
  for (const r of results) {
    const rows = [...r.best.s.rows].sort((a, b) => Math.abs(b.errGBP) - Math.abs(a.errGBP)).slice(0, 10);
    console.log(`\n  ${r.mode} · ${r.tag} (${r.market})`);
    console.table(rows.map(x => ({ good: x.good, measured: +x.measured.toFixed(1), predicted: +x.predicted.toFixed(1), errGBP: +x.errGBP.toFixed(0) })));
  }
}

if (TSV) { const p = isAbsolute(TSV) ? TSV : join(REPO, TSV); writeFileSync(p, tsv.join('\n'), 'utf8'); console.log(`\nwrote ${p}`); }
