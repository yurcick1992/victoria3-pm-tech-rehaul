// THE RUN-LEVEL STOP WATCHER (user-ruled 2026-09-14): polls a running 2+1 session; when a run COMPLETES with a 1936 GDP above
// the threshold × vanilla's 1936 median, drops tools/testbed/STOP so the scheduler's next run is abandoned at 1836 (the
// phase-2 run-11 precedent; L17 excludes the stub) and the config stops there. Never acts mid-run. Removes the STOP file once
// the scheduler has exited. SCOPE: 2+1 batches only (never arm it on a long sequence). usage: node stop_watch.mjs <session-name> [--threshold 1.3] [--poll 60]
import { readFileSync, readdirSync, existsSync, writeFileSync, unlinkSync, appendFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = fileURLToPath(new URL('../../', import.meta.url));   // this file sits in tools/testbed/, so the repo root is two levels up
const A = process.argv.slice(2); const arg = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d; };
const SESSION = A[0]; const THRESHOLD = +arg('--threshold', '1.3'); const POLL = +arg('--poll', '60') * 1000;
const SES = join(REPO, 'tools/testbed/sessions'), STOP = join(REPO, 'tools/testbed/STOP'), ROOT = join(SES, SESSION);
const log = m => { const line = `[${new Date().toISOString().slice(11, 19)}] stop_watch: ${m}`; console.log(line); try { appendFileSync(join(ROOT, 'stop_watch.log'), line + '\n'); } catch { } };
function gdpAt(run, yr) { const dir = join(run, 'save_summaries'); if (!existsSync(dir)) return null; for (const f of readdirSync(dir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort()) { let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, f)))); } catch { continue; } if (((j.provenance && j.provenance.date) || '').startsWith(yr + '.')) return j.world.gdp; } return null; }
const med = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const van = [];
for (const s of ['20260821_131149_vanilla-baseline-n16', '20260823_113218_vanilla-baseline-extra-n2']) for (const d of readdirSync(join(SES, s)).filter(d => /^run\d+_vanilla$/.test(d))) { const g = gdpAt(join(SES, s, d), '1936'); if (g) van.push(g); }
const VM = med(van);
log(`armed on ${SESSION}: threshold ${THRESHOLD}× vanilla's 1936 median £${Math.round(VM / 1e6).toLocaleString('en-US')}M (n=${van.length}); poll ${POLL / 1000}s`);
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
    if (ratio > THRESHOLD) {
      const reason = `STOP RULE (user-ruled 2026-09-14): ${d} ended at ${ratio.toFixed(3)}× vanilla's 1936 GDP (> ${THRESHOLD}×) — the config's last run; the schedule's next run, if any, is abandoned at 1836 by the STOP file and excluded (L17).`;
      writeFileSync(join(ROOT, d, 'STOP_RULE.txt'), reason + '\n'); writeFileSync(STOP, reason + '\n'); log(reason);
      const wait = () => { const s = existsSync(join(ROOT, 'session.log')) ? readFileSync(join(ROOT, 'session.log'), 'utf8').slice(-4000) : ''; if (/SCHEDULE DONE|ABORTED - see the ALERT|stopped by user - not continuing/.test(s)) { try { unlinkSync(STOP); } catch { } log('scheduler has exited; STOP file removed; done'); process.exit(0); } setTimeout(wait, 10000); };
      return wait();
    }
  }
  if (done) { log('schedule finished without a stop; done'); process.exit(0); }
  setTimeout(tick, POLL);
};
tick();
