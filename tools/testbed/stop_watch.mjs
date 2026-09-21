// THE RUN-LEVEL STOP WATCHER — since 2026-09-17 THE CRITERIA REGISTER'S HARD BREAK (BALANCE_FRAMEWORK §10.83, user-ruled: "one run can be
// sufficient if a hard boundary is broken"; a SOFT breach never stops a batch): polls a running 2+1 session; when a run COMPLETES, runs
// tools/testbed/ledger/criteria.mjs on the session and, if that run is BROKEN (by stall or by runoff), drops tools/testbed/STOP. The
// 2026-09-14 rule (a 1936 GDP above --threshold × vanilla's median) is only the FALLBACK when criteria.mjs cannot be run.
// (Superseded wording:) polls a running 2+1 session; when a run COMPLETES with a 1936 GDP above
// the threshold × vanilla's 1936 median, drops tools/testbed/STOP so the scheduler's next run is abandoned at 1836 (the
// phase-2 run-11 precedent; L17 excludes the stub) and the config stops there. Never acts mid-run. Removes the STOP file once
// the scheduler has exited. SCOPE: 2+1 batches only (never arm it on a long sequence). usage: node stop_watch.mjs <session-name> [--threshold 1.3] [--poll 60]
import { readFileSync, readdirSync, existsSync, writeFileSync, unlinkSync, appendFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const REPO = fileURLToPath(new URL('../../', import.meta.url));   // this file sits in tools/testbed/, so the repo root is two levels up
const A = process.argv.slice(2); const arg = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d; };
const SESSION = A[0]; const THRESHOLD = +arg('--threshold', '1.3'); const POLL = +arg('--poll', '60') * 1000;
const SES = join(REPO, 'tools/testbed/sessions'), STOP = join(REPO, 'tools/testbed/STOP');
// ⚠⚠ THE ARGUMENT IS A SESSION *NAME*, AND A PATH USED TO KILL THE WATCHER SILENTLY (2026-09-21). Passing
// `tools\testbed\sessions\<stamp>` made ROOT a DOUBLED path: the arming line still printed, then `readdirSync(ROOT)`
// threw on the first tick — and because the watcher is launched `-Hidden`, nothing anywhere recorded it (its own
// stop_watch.log goes inside that same bogus ROOT, so the write failed into the log()'s catch). launch_detached had
// already reported success, so the batch ran believing it was guarded. F151 cost 2.5h to a watcher that was never
// armed; this is worse, because it looks armed. ⇒ accept either form, and REFUSE LOUDLY rather than die quietly.
const NAME = String(SESSION || '').replace(/[\\/]+$/, '').replace(/^.*[\\/]sessions[\\/]/, '');
const ROOT = join(SES, NAME);
if (!NAME || !existsSync(ROOT)) {
  console.error(`stop_watch: no such session ${JSON.stringify(SESSION || '')} — looked in ${ROOT}.\n` +
    `Pass the session NAME, not a path, e.g.  node tools/testbed/stop_watch.mjs 20260921_094143_accel-slide-n2`);
  process.exit(2);
}
const log = m => { const line = `[${new Date().toISOString().slice(11, 19)}] stop_watch: ${m}`; console.log(line); try { appendFileSync(join(ROOT, 'stop_watch.log'), line + '\n'); } catch { } };
function gdpAt(run, yr) { const dir = join(run, 'save_summaries'); if (!existsSync(dir)) return null; for (const f of readdirSync(dir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort()) { let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, f)))); } catch { continue; } if (((j.provenance && j.provenance.date) || '').startsWith(yr + '.')) return j.world.gdp; } return null; }
const med = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const van = [];
for (const s of ['20260821_131149_vanilla-baseline-n16', '20260823_113218_vanilla-baseline-extra-n2']) for (const d of readdirSync(join(SES, s)).filter(d => /^run\d+_vanilla$/.test(d))) { const g = gdpAt(join(SES, s, d), '1936'); if (g) van.push(g); }
const VM = med(van);
log(`armed on ${NAME}: threshold ${THRESHOLD}× vanilla's 1936 median £${Math.round(VM / 1e6).toLocaleString('en-US')}M (n=${van.length}); poll ${POLL / 1000}s`);
const seen = new Set();
const tick = () => {
  const done = existsSync(join(ROOT, 'session.log')) && /SCHEDULE DONE|ABORTED - see the ALERT|stopped by user - not continuing/.test(readFileSync(join(ROOT, 'session.log'), 'utf8').slice(-4000));
  for (const d of readdirSync(ROOT).filter(d => /^run\d+_/.test(d))) {
    if (seen.has(d)) continue; const meta = join(ROOT, d, 'meta.json'); if (!existsSync(meta)) continue;
    let m; try { m = JSON.parse(readFileSync(meta, 'utf8')); } catch { continue; }
    if (!String(m.reached_ingame_date).startsWith('1936')) { seen.add(d); log(`${d}: reached ${m.reached_ingame_date} — not a complete run, ignored`); continue; }
    const g = gdpAt(join(ROOT, d), '1936'); if (g == null) continue;   // the endpoint summary may still be harvesting
    seen.add(d); const ratio = g / VM;
    log(`${d}: 1936 world GDP £${Math.round(g / 1e6).toLocaleString('en-US')}M = ${ratio.toFixed(3)}× vanilla`);
    // THE REGISTER: is this run broken? (criteria.mjs reads the session; its JSON names each run's `broken` side)
    let broken = null, viaRegister = false;
    try {
      const out = join(ROOT, d, 'criteria.json');
      const r = spawnSync(process.execPath, [join(REPO, 'tools/testbed/ledger/criteria.mjs'), '--arm', NAME, '--quiet', '--json', out], { cwd: REPO, encoding: 'utf8', timeout: 600000 });
      if (r.status === 0 && existsSync(out)) { const j = JSON.parse(readFileSync(out, 'utf8')); const run = ((j.arms[0] && j.arms[0].runs) || []).find(x => x.rel.endsWith('/' + d)); if (run) { viaRegister = true; broken = run.broken; if (broken) log(`${d}: THE REGISTER — BROKEN BY ${String(broken).toUpperCase()}: ${run.hard.join(' | ')}`); else log(`${d}: the register — intact (${run.hard.length} hard, ${run.soft.length} soft line(s))`); } }
      else log(`${d}: criteria.mjs failed (status ${r.status}): ${(r.stderr || '').slice(-300)} — falling back to the 1936 GDP rule`);
    } catch (e) { log(`${d}: criteria.mjs threw ${e.message} — falling back to the 1936 GDP rule`); }
    if (viaRegister ? broken : ratio > THRESHOLD) {
      const reason = viaRegister ? `STOP RULE (THE CRITERIA REGISTER, §10.83, user-ruled 2026-09-17): ${d} is BROKEN BY ${String(broken).toUpperCase()} — one broken run ends the config; the schedule's next run, if any, is abandoned at 1836 and L17-excluded` : `STOP RULE (user-ruled 2026-09-14, the fallback): ${d} ended at ${ratio.toFixed(3)}× vanilla's 1936 GDP (> ${THRESHOLD}×) — the config's last run; the schedule's next run, if any, is abandoned at 1836 by the STOP file and excluded (L17).`;
      writeFileSync(join(ROOT, d, 'STOP_RULE.txt'), reason + '\n'); writeFileSync(STOP, reason + '\n'); log(reason);
      const wait = () => { const s = existsSync(join(ROOT, 'session.log')) ? readFileSync(join(ROOT, 'session.log'), 'utf8').slice(-4000) : ''; if (/SCHEDULE DONE|ABORTED - see the ALERT|stopped by user - not continuing/.test(s)) { try { unlinkSync(STOP); } catch { } log('scheduler has exited; STOP file removed; done'); process.exit(0); } setTimeout(wait, 10000); };
      return wait();
    }
  }
  if (done) { log('schedule finished without a stop; done'); process.exit(0); }
  setTimeout(tick, POLL);
};
tick();
