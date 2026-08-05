// lib_breakdown.mjs вЂ” THE reader for `GetMarketBuyOrdersBreakdown` blocks, shared by every analyser.
//
// There is exactly ONE implementation of this parse because every safeguard in it was paid for with a
// wrong published number, and a second copy would drift away from them one at a time. See TESTBED_METRICS
// В§3.3 / В§3.3.1 and FINDINGS F24/F27 for the incidents behind each rule.
//
//  1. FILTER BY THE RUN'S OWN TOKEN. The game's log is a 5Г—512 KB ring shared by every run on the machine,
//     so one run's mirror routinely holds the tail of another вЂ” a different market, a different year.
//     Attributing those here is silent, plausible corruption. (It has bitten three times in one session.)
//  2. VERIFY EACH BLOCK AGAINST AN INDEPENDENT NUMBER. Entry lines do NOT name their good вЂ” only the
//     surrounding fence does вЂ” and at volume the mirror puts entries in the wrong block. Each block opens
//     with its own buy-orders total; the run's `G|`/`GW|` lines carry the same quantity independently.
//     Disagreement means the block is not the good its fence claims, so it is DISCARDED, not guessed at.
//  3. VALUES ARE ABBREVIATED ABOVE 1000 вЂ” `17.1K`, `1.29M`. A bare parse reads 17.1 for 17100. Small
//     markets never trigger it, which is exactly how it survived into a published figure once.
//  4. MATCH ON THE TAIL, NEVER ACROSS THE LINE. The readable text follows a multi-KB base64 blob, so a
//     `.*` pattern happily pairs a "Pop" in one place with a "Consumption" in another. `v; ` cannot occur
//     inside base64 (`;` and space are outside its alphabet), so its last occurrence locates the tail.
//  5. A VERIFIED BLOCK WITH NO POP ENTRY MEANS ZERO, NOT MISSING. Dropping those would score only the
//     goods pops actually buy and never charge the model for demand it invents.
//  6. вљ  EVERY DUMP IS PARTIALLY TRUNCATED, AT A DIFFERENT GOOD. One good's breakdown can reach 76 KB and a
//     market-tick can exceed the whole ring, so no single dump is complete. Callers must UNION across
//     dumps and runs; treat an absent good as unmeasured, never as zero. (Measured 2026-08-05: 24вЂ“33 of
//     ~44 goods captured per market-dump.)
// ⚠ STREAMED, NOT read whole. A campaign mirror is 500 MB+ and two of them at once exhausted a 4 GB heap
// (`readFileSync().split()` materialises millions of line strings). Every reader here is async and walks
// the file line by line; do not "simplify" it back to a slurp.
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

async function eachLine(path, fn) {
  const rl = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) fn(line);
}

const MUL = { '': 1, K: 1e3, M: 1e6, B: 1e9 };
export const strip = s => s.replace(/[\x00-\x1f\x7f]/g, '');

// The value sits after the LAST `v; ` on the line, past the base64 payload.
export function tailValue(line, signed) {
  const i = line.lastIndexOf('v; ');
  if (i < 0) return null;
  const tail = strip(line.slice(i));
  const m = tail.match(signed ? /^v; \+([0-9.]+)([KMB]?)/ : /^v; ([0-9.]+)([KMB]?)/);
  return m ? { v: parseFloat(m[1]) * MUL[m[2]], tail } : null;
}

// Build the independent reference table: market\tgood -> buy orders, from `G|` and `GW|` lines.
// вљ  Built across ALL runs of a session on purpose: a breakdown burst can push a run's own order-book lines
// out of the ring entirely, and such a run would then verify to nothing. Runs in one session are the same
// arm, so another run's figure for the same market/good/era is the same quantity.
// ⚠ KEYED BY DATE, and that is not a detail. A good's buy orders move constantly, so checking an 1850
// breakdown against "whatever figure for this market and good was read last" compares two different years:
// it rejects sound blocks wholesale (measured: 2049 mismatches against 200 accepted) and, worse, would
// ACCEPT a mis-attributed block whenever two unrelated values happen to coincide. The breakdown's dump date
// is deliberately one of the monthly order-book dates, so an exact same-date comparison is available.
//
// ⚠⚠ AND STRICTLY PER RUN. An earlier version pooled every run in the session, on the reasoning that runs
// are the same arm and one whose `G|` lines were evicted could borrow another's. That reasoning dies the
// moment the key includes a DATE: different seeds hold different values on the same date, so pooling makes
// run 2 overwrite run 1 and the verification rejects almost everything (measured: 2704 verified blocks
// collapsed to 786, with 3168 total-mismatches, purely from adding a second run).
export async function buyOrderTable(logPath, token) {
  const t = new Map();
  const reG = new RegExp(`\\|${token}\\|G\\|([^|]+)\\|([^|]+)\\|([^|]+)\\|([0-9.]+)\\|`);
  const reW = new RegExp(`\\|${token}\\|GW\\|([^|]+)\\|([^|]+)\\|([^|]+)\\|([0-9.]+)\\|`);
  await eachLine(logPath, ln => {
    if (ln.length >= 400) return;
    const m = ln.match(reG) || ln.match(reW);
    if (m) t.set(`${m[1]}\t${m[2]}\t${m[3]}`, parseFloat(m[4]));
  });
  return t;
}

// Walk one run's log and return verified blocks:
//   [{ date, market, good, total, pop, buildings: [{name, v}], slaves }]
// `pop` is the "Pop Consumption" channel; `buildings` each named building-type entry; `slaves` the
// "purchased for slaves" line (a BUILDING purchase the game reports as its own channel вЂ” FINDINGS F27).
export async function readBreakdown(logPath, token, buyOf, { tolerance = 0.02 } = {}) {
  const reBeg = new RegExp(`\\|${token}\\|CP\\|C2\\|([^|]+)\\|([^|]+)\\|([^|]+)\\|BEGIN`);
  const reEnd = new RegExp(`\\|${token}\\|CP\\|C2end\\|`);
  const reAny = /\|CP\|C2(end|done|start)?\|/;
  const out = [];
  const stats = { ok: 0, dropped: 0, badTotal: 0, noRef: 0 };
  let date = null, mkt = null, good = null, total = null, pop = null, popN = 0, slaves = null, blds = [];
  const reset = () => { good = null; total = null; pop = null; popN = 0; slaves = null; blds = []; };
  // вљ  IDENTITY COMES FROM THE TOTAL, NOT FROM THE CLOSING FENCE. Requiring `C2end` throws away almost
  // everything: truncation eats closing fences constantly (measured вЂ” 2145 unterminated against 4 closed
  // on one live run), and the fence was never the trustworthy part anyway. The block's own opening total
  // matched against an INDEPENDENT `G|`/`GW|` figure is the strong test, and it is the one that catches
  // mis-attribution. So a block is committed when the next fence arrives, closed or not, provided its
  // total checks out. An ambiguous block (two pop entries) is still discarded rather than guessed at.
  const commit = () => {
    if (!good) return;
    const ref = buyOf.get(`${date}\t${mkt}\t${good}`);
    if (ref == null) { stats.noRef++; return; }
    if (!(total != null && Math.abs(total - ref) <= Math.max(tolerance * Math.max(ref, 1), 1))) { stats.badTotal++; return; }
    if (popN > 1) { stats.dropped++; return; }
    out.push({ date, market: mkt, good, total, pop: pop || 0, slaves: slaves || 0, buildings: blds });
    stats.ok++;
  };
  await eachLine(logPath, ln => {
    const short = ln.length < 400;
    let m;
    if (short && (m = ln.match(reBeg))) {
      commit();
      date = m[1]; mkt = m[2]; good = m[3]; total = null; pop = null; popN = 0; slaves = null; blds = [];
    } else if (short && reEnd.test(ln)) {
      commit(); reset();
    } else if (short && reAny.test(ln)) {                    // another run's fence вЂ” the ring moved on
      commit(); reset();
    } else if (good) {
      if (total == null) {
        const t0 = tailValue(ln, false);
        if (t0 && /^v; [0-9.]+[KMB]?!?$/.test(strip(t0.tail))) { total = t0.v; return; }
      }
      const t = tailValue(ln, true);
      if (!t) return;
      if (/Pop.{0,4}Consumption\s*$/.test(t.tail)) { popN++; if (popN === 1) pop = t.v; }
      else if (/purchased for/.test(t.tail)) slaves = t.v;
      else { const b = t.tail.match(/BuildingTypeTooltip\s+(.+?)\s*$/); if (b) blds.push({ name: b[1], v: t.v }); }
    }
  });
  commit();
  return { blocks: out, stats };
}

