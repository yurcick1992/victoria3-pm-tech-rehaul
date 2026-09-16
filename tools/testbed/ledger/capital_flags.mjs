// THE HOARD SPLIT AND THE CAPITAL-ABUNDANCE FLAG (user-ruled 2026-09-15). Read on the year's save summary of every USABLE
// run of an arm (lib_runs, landmine L17): the investment-pool HOARD ÷ GDP for the WORLD and for the SHORTLIST (GBR, USA, FRA,
// GER — PRU stands in where Germany never formed), and TOTAL UNEMPLOYMENT INCLUDING PEASANTS — (unemployed + peasants) ÷
// (salaried + unemployed + peasants) — beside the strict figure (unemployed ÷ (salaried + unemployed)), world and shortlist,
// with each shortlist member's own reading. THE FLAG: "complete capital abundance (total unemployment under 3%, hoard over
// 2 GDP), if not confined to minors, invalidates the config more or less … other metrics' readings from this config become
// heavily unreliable" — a member trips ⚑, the pooled shortlist tripping is a VOID (exit 4). Vanilla's Britain trips ⚑ in 2
// of 16 seeds, so a Britain-only trip at vanilla's extreme is a flag, a shortlist-wide one a void.
// ⭐⭐ PERSISTENCE, user-ruled 2026-09-16 — the level alone is not the verdict, the PATH is. "Hoarding is a bigger problem
// [than a long backlog], especially persistent hoarding (over 2 yearly GDP for the last 5 years, and doesn't decrease by at
// least 0.5 yearly GDP YoY 1931 onwards; or over 5 yearly GDP overall). However, hoarding AND inability to invest (mostly
// because of the full employment) is a strong negative verdict, and not only on the config itself, but also on most other
// deductions (as this distorts the economy)." So three tests, reported separately and escalating:
//   PERSISTENT-A  pool > 2 GDP in every one of the last five years AND not falling by >= 0.5 GDP year on year from 1931
//   PERSISTENT-B  pool > 5 GDP at any sampled year
//   ABUNDANCE     hoard > 2 AND total unemployment incl. peasants < 3% — hoarding it CANNOT invest. This is the strong
//                 negative verdict: it voids the configuration AND most deductions drawn from it, because the economy is
//                 distorted. Shortlist-wide => exit 4.
// ⚠ A pool of 0.4-0.7 GDP is NOT persistent hoarding under any of these; the standing configuration sits there. Say so
// rather than reporting it as a fault (the 'aim below vanilla's 0.29' of 2026-09-15 is a preference, these are the verdicts).
//   node tools/testbed/ledger/capital_flags.mjs --arm <session[,session]>[:<setup>] [--van <session>] [--year 1935] [--shortlist GBR,USA,FRA,GER] [--persist-from 1931] [--persist-years 5]
import { readFileSync, readdirSync, existsSync } from 'node:fs'; import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
import { usableRuns, reportDropped } from './lib_runs.mjs';
const HERE = dirname(fileURLToPath(import.meta.url)); const SES = join(HERE, '..', 'sessions');
const ARGV = process.argv.slice(2); const argOf = (n, d) => { const i = ARGV.indexOf(n); return i >= 0 && ARGV[i + 1] ? ARGV[i + 1] : d; };
const YEAR = argOf('--year', '1935'); const armArg = argOf('--arm', null); const VAN = argOf('--van', '20260821_131149_vanilla-baseline-n16');
const SHORT = argOf('--shortlist', 'GBR,USA,FRA,GER').split(',');
const PFROM = +argOf('--persist-from', '1931'); const PYEARS = +argOf('--persist-years', '5');
if (!armArg) { console.error('usage: --arm <session[,session]>[:<setup>] [--van <session>] [--year YYYY] [--shortlist A,B,C]'); process.exit(2); }
const [armSessions, armSetup = ''] = armArg.split(':');
function summaryAt(runRel, yr) {
  const dir = join(SES, runRel, 'save_summaries'); if (!existsSync(dir)) return null;
  for (const f of readdirSync(dir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, f)))); } catch { continue; }
    if (((j.provenance && j.provenance.date) || '').startsWith(yr + '.')) return j;
  }
  return null;
}
// Every yearly summary of a run, as { year -> {world, short} hoard }. One pass over the run's own directory.
function hoardSeries(runRel) {
  const dir = join(SES, runRel, 'save_summaries'); if (!existsSync(dir)) return null;
  const out = new Map();
  for (const fn of readdirSync(dir).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.'))) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, fn)))); } catch { continue; }
    const date = (j.provenance && j.provenance.date) || ''; const yr = +String(date).split('.')[0];
    if (!yr || out.has(yr)) continue;
    const C = j.countries || {}; const members = SHORT.map(t => (t === 'GER' && !C.GER && C.PRU) ? 'PRU' : t);
    let wp = 0, wg = 0, sp = 0, sg = 0;
    for (const [tag, c] of Object.entries(C)) {
      const pool = +c.investment_pool || 0, gdp = +c.gdp || 0;
      wp += pool; wg += gdp; if (members.includes(tag)) { sp += pool; sg += gdp; }
    }
    out.set(yr, { world: wp / (wg || 1), short: sp / (sg || 1) });
  }
  return out;
}
// The two PERSISTENT tests on one scope's series. Returns the evidence, not just a boolean.
function persistence(series, scope) {
  const years = [...series.keys()].sort((a, b) => a - b);
  if (!years.length) return null;
  const v = y => { const e = series.get(y); return e ? e[scope] : undefined; };
  const peakYear = years.reduce((b, y) => (v(y) > v(b) ? y : b), years[0]);
  const last = years.slice(-PYEARS);
  const allOver2 = last.length === PYEARS && last.every(y => v(y) > 2);
  // "decreases by at least 0.5 yearly GDP YoY from <PFROM> onwards" — the escape clause for A
  const tail = years.filter(y => y >= PFROM);
  let falling = tail.length >= 2;
  for (let i = 1; i < tail.length; i++) if (!(v(tail[i - 1]) - v(tail[i]) >= 0.5)) { falling = false; break; }
  return { peak: v(peakYear), peakYear, last5: last.map(v), allOver2, falling, A: allOver2 && !falling, B: v(peakYear) > 5 };
}
const readC = c => { const p = c.pop_statistics || {}; return { sal: p.population_salaried_workforce || 0, un: p.population_unemployed_workforce || 0, pe: (p.population_subsisting_workforce || 0) * 100000, pool: +c.investment_pool || 0, gdp: +c.gdp || 0 }; };
const add = (a, b) => { for (const k of Object.keys(b)) a[k] = (a[k] || 0) + b[k]; return a; };
const rates = o => ({ strict: o.un / (o.sal + o.un), incl: (o.un + o.pe) / (o.sal + o.un + o.pe), hoard: o.pool / (o.gdp || 1) });
const trips = r => r.incl < 0.03 && r.hoard > 2;
function readRun(runRel) {
  const j = summaryAt(runRel, YEAR); if (!j) return null; const C = j.countries || {};
  const members = SHORT.map(t => (t === 'GER' && !C.GER && C.PRU) ? 'PRU' : t).filter(t => C[t]);
  const W = {}, S = {}; const per = [];
  for (const [tag, c] of Object.entries(C)) { const r = readC(c); add(W, r); if (members.includes(tag)) { add(S, r); const x = rates(r); per.push({ tag, ...x, flag: trips(x) }); } }
  return { run: runRel, world: rates(W), short: rates(S), per, members };
}
const med = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : NaN; };
const pct = x => (x * 100).toFixed(1) + '%'; const f2 = x => x.toFixed(2);
const arm = usableRuns(SES, armSessions, armSetup); reportDropped(arm.dropped);
const rows = arm.runs.map(readRun).filter(Boolean); if (!rows.length) { console.error(`arm ${armArg}: no readable run at ${YEAR}`); process.exit(1); }
console.log(`CAPITAL FLAGS — ${armArg} · ${rows.length} usable run(s) at ${YEAR} · shortlist ${SHORT.join('+')} (PRU for an unformed GER)`);
console.log('run                                                    hoard world · shortlist   unemployment incl. peasants world · shortlist (strict)   members');
let voids = 0;
for (const r of rows) {
  const v = trips(r.short); if (v) voids++;
  const mem = r.per.map(p => `${p.tag} ${pct(p.incl)} h${f2(p.hoard)}${p.flag ? '⚑' : ''}`).join('  ');
  console.log(`${r.run.padEnd(54)} ${f2(r.world.hoard)} · ${f2(r.short.hoard)}${' '.repeat(12)}${pct(r.world.incl)} · ${pct(r.short.incl)} (${pct(r.world.strict)} · ${pct(r.short.strict)})   ${mem}${v ? '   ⚑⚑ SHORTLIST-WIDE: VOID' : ''}`);
}
if (rows.length > 1) console.log(`MEDIANS ${' '.repeat(46)} ${f2(med(rows.map(r => r.world.hoard)))} · ${f2(med(rows.map(r => r.short.hoard)))}${' '.repeat(12)}${pct(med(rows.map(r => r.world.incl)))} · ${pct(med(rows.map(r => r.short.incl)))} (${pct(med(rows.map(r => r.world.strict)))} · ${pct(med(rows.map(r => r.short.strict)))})`);
// ---- PERSISTENT HOARDING (the 2026-09-16 ruling): the path, not the level at one date.
console.log('');
console.log(`PERSISTENT HOARDING — pool ÷ GDP over each run's whole yearly series (A: > 2 in the last ${PYEARS} years and not falling >= 0.5/yr from ${PFROM}; B: > 5 at any year)`);
let persistHits = 0;
for (const r of rows) {
  const ser = hoardSeries(r.run);
  if (!ser || !ser.size) { console.log(`  ${r.run}: no series`); continue; }
  const bits = [];
  for (const scope of ['world', 'short']) {
    const p = persistence(ser, scope); if (!p) continue;
    const hit = p.A || p.B; if (hit && scope === 'world') persistHits++;
    bits.push(`${scope === 'world' ? 'world' : 'shortlist'} peak ${f2(p.peak)}@${p.peakYear} last${PYEARS} [${p.last5.map(f2).join(' ')}]${p.A ? ' ⚑A' : ''}${p.B ? ' ⚑B' : ''}${p.allOver2 && p.falling ? ' (over 2 but draining)' : ''}`);
  }
  console.log(`  ${r.run.split('/').pop()}: ${bits.join(' · ')}`);
}
console.log(persistHits
  ? `  ⚑ ${persistHits} run(s) show PERSISTENT hoarding world-wide — a bigger problem than any backlog; read it beside the abundance verdict below`
  : '  none — no run hoards persistently by either test (a pool of 0.4-0.7 GDP is well inside both)');
console.log('');
try { const van = usableRuns(SES, VAN).runs.map(readRun).filter(Boolean); if (van.length) console.log(`vanilla ${VAN} n=${van.length} medians: hoard ${f2(med(van.map(r => r.world.hoard)))} · ${f2(med(van.map(r => r.short.hoard)))}; unemployment incl. peasants ${pct(med(van.map(r => r.world.incl)))} · ${pct(med(van.map(r => r.short.incl)))} (strict ${pct(med(van.map(r => r.world.strict)))} · ${pct(med(van.map(r => r.short.strict)))}); Britain trips ⚑ in ${van.filter(r => r.per.some(p => p.tag === 'GBR' && p.flag)).length} of ${van.length}`); } catch (e) { console.log('vanilla reference unavailable:', e.message); }
const flagged = rows.filter(r => r.per.some(p => p.flag)).length;
console.log(`VERDICT: ${voids ? `VOID — ${voids} run(s) capital-abundant across the whole shortlist` : flagged ? `FLAG — ${flagged} run(s) with a capital-abundant shortlist member (vanilla's own Britain does this in 2 of 16 seeds)` : 'CLEAN — no shortlist member under 3% total unemployment with a hoard over 2'}`);
process.exit(voids ? 4 : 0);
