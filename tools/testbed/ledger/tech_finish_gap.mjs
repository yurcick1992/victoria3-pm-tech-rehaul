// DOES THE SECOND STAGE COMPLETE THE TECHNOLOGY WHEN THE PENALTY IS ZERO, AND DOES THE PENALTY CLEARING COMPLETE IT LATER?
// (user-asked 2026-09-24). Everything is ordered by position in the run's own debug log (wall time), not by mapped dates:
//  - a `PMR_JE|development|X|C` line is the moment the second grant lands;
//  - the penalty is F160's Σ over C's unresearched same-category technologies of earlier eras (sericulture skipped), judged
//    from C's own `TECH` lines — Σ = 0 at the JE iff every such technology's TECH line precedes the JE line;
//  - (a) Σ = 0 at the JE → is X's TECH line within ±3 s of wall time of the JE line (the same tick)?
//  - (b) Σ > 0 at the JE, then clears (the LAST of those earlier technologies arrives) before X → is X acquired the SAME
//    in-game day as that last one? (both from TECH lines: exact to the day)
// A crash-resume replays a stretch: when a TECH line's in-game date jumps BACK, every event dated after it is discarded.
//   node tools/testbed/ledger/tech_finish_gap.mjs --arm <session>:<setup>[:<label>] [--arm …] [--list]
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
const REPO = 'C:/claude-code/victoria 3 PM and tech rehaul'; const SES = REPO + '/tools/testbed/sessions';
const { usableRuns } = await import(pathToFileURL(REPO + '/tools/testbed/ledger/lib_runs.mjs').href);
const argv = process.argv.slice(2); const LIST = argv.includes('--list');
const ARMS = argv.flatMap((a, i) => a === '--arm' ? [argv[i + 1]] : []).map(s => { const [session, setup, label] = s.split(':'); return { session, setup, label: label || setup }; });
const MON = { January: 0, February: 1, March: 2, April: 3, May: 4, June: 5, July: 6, August: 7, September: 8, October: 9, November: 10, December: 11 };
const toD = s => { const m = /^([A-Za-z]+) (\d+), (\d+)$/.exec(s.trim()); return m ? (+m[3] * 12 + MON[m[1]]) * 31 + (+m[2] - 1) : NaN; };  // day index
const END = 1936 * 12 * 31;
function treeOf(runDir) { const bs = JSON.parse(fs.readFileSync(path.join(runDir, 'build_state.json'), 'utf8')); const cp = bs.deterministic.mod_under_test.built_from_config;
  const tp = path.join(path.dirname(cp), path.basename(cp).replace(/^mod_config\./, 'tech_tree_options.')); return Object.values(JSON.parse(fs.readFileSync(fs.existsSync(tp) ? tp : path.join(REPO, tp), 'utf8')).options)[0].techs; }
function readRun(runDir) {
  const tok = JSON.parse(fs.readFileSync(path.join(runDir, 'meta.json'), 'utf8')).token;
  const f = [path.join(runDir, 'logs_live', 'debug.log'), path.join(runDir, 'logs', 'debug.log')].find(fs.existsSync);
  const techs = treeOf(runDir); const byName = {}; for (const t of techs) { byName[t.name] = t; if (t.vanillaName) byName[t.vanillaName] ??= t; }
  const reT = new RegExp(`V3TB\\|${tok}\\|TECH\\|([^|]+)\\|([^|]+)\\|(.+?)\\s*$`), reJ = /PMR_JE\|development\|([a-z_0-9]+)\|(.+?)\s*$/;
  let ev = [], off = 0, prev = null, lastD = -Infinity, rollbacks = 0, inRun = false;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const w = /^\[(\d\d):(\d\d):(\d\d)\]/.exec(line); if (!w) continue; let s = +w[1] * 3600 + +w[2] * 60 + +w[3];
    if (prev !== null && s + off < prev - 43200) off += 86400; s += off; prev = s; let m;
    if ((m = reT.exec(line))) { inRun = true; const t = byName[m[3]]; const d = toD(m[2]); if (!t) continue;
      if (d < lastD - 31) { ev = ev.filter(e => e.d <= d); rollbacks++; lastD = d; }   // a resume: drop the replayed stretch
      else lastD = Math.max(lastD, d);
      ev.push({ k: 'T', w: s, d, c: m[1], id: t.id }); }
    else if (inRun && (m = reJ.exec(line))) ev.push({ k: 'J', w: s, d: lastD, c: m[2], id: m[1] });
  }
  // per country: acquisition (first surviving TECH) with its wall time and day
  const acq = {}; for (const e of ev) if (e.k === 'T') { const A = (acq[e.c] ??= {}); if (!A[e.id]) A[e.id] = e; }
  const res = { a: { n: 0, same: 0, list: [] }, b: { n: 0, sameDay: 0, week: 0, waits: [], list: [] }, penalisedAcq: 0, never: 0, rollbacks };
  const seen = new Set();
  for (const j of ev) { if (j.k !== 'J') continue; const key = j.c + '|' + j.id; if (seen.has(key)) continue; seen.add(key);
    const A = acq[j.c] || {}; const t = techs.find(x => x.id === j.id); if (!t) continue;
    const earlier = techs.filter(y => y.category === t.category && y.era < t.era && y.id !== 'sericulture');
    const pend = earlier.filter(y => !(A[y.id] && A[y.id].w <= j.w));        // still unresearched at the JE line
    const X = A[j.id]; const xAfter = X && X.w >= j.w - 3 ? X : null;
    if (!pend.length) { res.a.n++; if (xAfter && Math.abs(xAfter.w - j.w) <= 3) res.a.same++; else res.a.list.push(`${j.c}/${j.id} ${xAfter ? ((xAfter.d - j.d) / 30.4).toFixed(1) + 'mo later' : 'never'}`); continue; }
    if (pend.some(y => !A[y.id])) { res.never++; continue; }                 // the penalty never clears
    const clear = pend.map(y => A[y.id]).reduce((a, b) => (b.w > a.w ? b : a));
    if (xAfter && xAfter.w < clear.w - 3) { res.penalisedAcq++; continue; }  // acquired while still penalised
    res.b.n++; const x2 = xAfter ? xAfter.d : END; const wait = x2 - clear.d;
    if (xAfter && wait <= 0) res.b.sameDay++; if (wait <= 7) res.b.week++; res.b.waits.push(wait / 30.4);
    res.b.list.push(`${j.c}/${j.id} clears on ${(clear.id)} → ${xAfter ? (wait / 30.4).toFixed(1) + 'mo' : 'never'}`); }
  return res;
}
const med = a => { const s = [...a].sort((x, y) => x - y); if (!s.length) return NaN; const m = (s.length - 1) / 2; return (s[Math.floor(m)] + s[Math.ceil(m)]) / 2; };
for (const A of ARMS) { const tot = { a: 0, as: 0, b: 0, bs: 0, bw: 0, waits: [], pen: 0, nev: 0, rb: 0 }; const la = [], lb = [];
  for (const rel of usableRuns(SES, A.session, A.setup).runs) { const r = readRun(path.join(SES, rel));
    tot.a += r.a.n; tot.as += r.a.same; tot.b += r.b.n; tot.bs += r.b.sameDay; tot.bw += r.b.week; tot.waits.push(...r.b.waits); tot.pen += r.penalisedAcq; tot.nev += r.never; tot.rb += r.rollbacks; la.push(...r.a.list); lb.push(...r.b.list); }
  console.log(`${A.label.padEnd(15)} (a) penalty 0 at the 2nd stage: ${tot.a} · acquired in the SAME tick ${tot.as} (${(100 * tot.as / tot.a).toFixed(1)}%)`);
  console.log(`${''.padEnd(15)} (b) penalty clears later: ${tot.b} · acquired the SAME DAY it clears ${tot.bs} (${(100 * tot.bs / tot.b).toFixed(0)}%) · within 7 days ${tot.bw} · median wait ${med(tot.waits).toFixed(1)} mo`);
  console.log(`${''.padEnd(15)} excluded: penalty never clears ${tot.nev} · acquired while penalised ${tot.pen} · resume rollbacks ${tot.rb}`);
  if (LIST) { console.log('   (a) exceptions: ' + la.join(' · ')); console.log('   (b): ' + lb.join(' · ')); } console.log(); }
