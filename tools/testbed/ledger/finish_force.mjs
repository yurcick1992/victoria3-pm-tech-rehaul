// READS THE FINISH BOOST'S FORCE TEST (research_events.finish_boost.force_test, emitted by tools/emit_tech_finish.mjs).
//
//   node tools/testbed/ledger/finish_force.mjs --session <stamp>
//
// Per run (one arm each): every PMR_FORCE line (a country, the technology pushed into [threshold, 1) of its cost, the
// engine's own progress and cost), the country's research choices after it (PMR_TPICK), and the acquisition of the
// forced technology (the tech_log telemetry's V3TB …|TECH|country|date|name lines). Reports, per arm:
//   · the landing: progress ÷ cost of every forced technology — must sit in [threshold, 1), never complete;
//   · THE POINT: the share of forced countries whose NEXT research choice is the forced technology;
//   · the wait from forcing to acquisition.
// ⚠ The window is this run's own lines: from its PM_TECH_REHAUL init marker (the last one before its telemetry token).
// ⚠ Countries are joined by DISPLAY NAME within one run (there is no tag data function); a rename splits one in two.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { usableRuns, reportDropped } from './lib_runs.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const ROOT = join(REPO, 'tools', 'testbed', 'sessions');
const args = process.argv.slice(2);
const session = args[args.indexOf('--session') + 1];
if (!session || args.indexOf('--session') < 0) { console.error('usage: finish_force.mjs --session <stamp>'); process.exit(2); }

const MONTHS = { January: 0, February: 1, March: 2, April: 3, May: 4, June: 5, July: 6, August: 7, September: 8, October: 9, November: 10, December: 11 };
const day = s => { const m = String(s).match(/([A-Za-z]+) (\d+), (\d+)/); return m ? (+m[3]) * 365.25 + MONTHS[m[1]] * 30.44 + (+m[2]) : NaN; };
const pct = (a, b) => b ? `${(100 * a / b).toFixed(1)}%` : '—';
const q = (a, p) => { if (!a.length) return '—'; const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]); };

const TREE = JSON.parse(readFileSync(join(REPO, 'config', 'tech_tree_options.json'), 'utf8')).options.find(o => o.ships).techs;
const NAME = Object.fromEntries(TREE.map(t => [t.id, t.name]));

// all setups in the session, one arm each
const setups = [...new Set((await import('node:fs')).readdirSync(join(ROOT, session)).filter(d => /^run\d+_/.test(d)).map(d => d.replace(/^run\d+_/, '')))];
for (const setup of setups) {
  const { runs, dropped } = usableRuns(ROOT, session, setup);
  reportDropped(dropped);
  for (const rel of runs) {
    const logf = join(ROOT, rel, 'logs_live', 'debug.log');
    if (!existsSync(logf)) { console.log(`${rel}: no debug.log`); continue; }
    const lines = readFileSync(logf, 'utf8').split('\n');
    const run = rel.split('/').pop();
    const tokAt = lines.findIndex(l => l.includes(`|${session.slice(0, 15)}s${run.slice(3, 6)}|`));
    let start = 0;
    for (let i = (tokAt >= 0 ? tokAt : lines.length) - 1; i >= 0; i--) if (/PM_TECH_REHAUL.*init/.test(lines[i])) { start = i; break; }
    const ev = [];                                         // in log order
    for (const l of lines.slice(start)) {
      let i = l.indexOf('PMR_'); const j = l.indexOf('|TECH|');
      if (i >= 0) { const p = l.slice(i).replace(/".*$/, '').trim().split('|'); ev.push(p); }
      else if (j >= 0 && l.includes('V3TB|')) { const p = l.slice(j + 6).trim().split('|'); ev.push(['TECH', p[0], p[1], p[2]]); }
    }
    const forced = {};                                     // country -> { tech, prog, cost, d, idx }
    ev.forEach((p, idx) => {
      if (p[0] !== 'PMR_FORCE') return;
      const kv = Object.fromEntries(p.slice(3).map(s => [s.split('=')[0], s.slice(s.indexOf('=') + 1)]));
      forced[p[1]] = { tech: p[2], prog: +kv.prog, cost: +kv.cost, d: day(kv.d), idx };
    });
    const none = ev.filter(p => p[0] === 'PMR_FORCE_NONE').length;
    const F = Object.entries(forced);
    const land = F.map(([, f]) => f.prog / f.cost).filter(Number.isFinite);
    const badLand = land.filter(r => r < 0.99 - 1e-9 || r >= 1).length;
    // ⚠ A choice only COUNTS while the forced technology is still unacquired: tech spread completes the ~1% that
    //   remains within weeks when the forced technology happens to be the country's spreading one, and a country
    //   whose forced technology is already researched has nothing to pick. (The first cut counted those as misses —
    //   four African states whose cotton_gin spread-completed in Feb–Mar 1836 and who next chose in late 1837.)
    let next = 0, nextAny = 0, acq = 0, spreadFirst = 0; const waits = []; const nextOther = {};
    for (const [c, f] of F) {
      const after = ev.slice(f.idx + 1).map((p, k) => ({ p, k })).filter(x => x.p[1] === c);
      const pick = after.find(x => x.p[0] === 'PMR_TPICK');
      const got = after.find(x => x.p[0] === 'TECH' && x.p[3] === NAME[f.tech]);
      if (got) { acq++; waits.push(day(got.p[2]) - f.d); }
      if (!pick) continue;
      if (got && got.k < pick.k) { spreadFirst++; continue; }                        // acquired before it chose again
      nextAny++;
      if (pick.p[2] === NAME[f.tech]) next++; else nextOther[pick.p[2]] = (nextOther[pick.p[2]] || 0) + 1;
    }
    const byTech = {}; for (const [, f] of F) byTech[f.tech] = (byTech[f.tech] || 0) + 1;
    console.log(`\n== ${rel}  [${setup}]`);
    console.log(`  forced ${F.length} countries (${none} had no candidate); by technology: ${Object.entries(byTech).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(', ')}`);
    console.log(`  landing progress ÷ cost: min ${Math.min(...land).toFixed(4)} · max ${Math.max(...land).toFixed(4)} · outside [0.99, 1): ${badLand}`);
    console.log(`  ⭐ NEXT research choice = the forced technology: ${next} of ${nextAny} that chose again while it was still unacquired (${pct(next, nextAny)}); ` +
      `${spreadFirst} had it completed (spread) before their next choice; ${F.length - nextAny - spreadFirst} made no further choice`);
    const others = Object.entries(nextOther).sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (others.length) console.log(`    when not: ${others.map(([t, n]) => `${t} ${n}`).join(', ')}`);
    console.log(`  forced technology acquired by the end: ${acq} of ${F.length} (${pct(acq, F.length)}); days from forcing: median ${q(waits, 0.5)} · p75 ${q(waits, 0.75)} · p90 ${q(waits, 0.9)} · max ${waits.length ? Math.round(Math.max(...waits)) : '—'}`);
    const picks = ev.filter(p => p[0] === 'PMR_TPICK').length;
    console.log(`  research choices logged in the run: ${picks}`);
  }
}
