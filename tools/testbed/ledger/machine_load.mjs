// ⭐ WHY WAS A RUN SLOW? THE MACHINE-LOAD READER (2026-10-06) — reads <session>/machine_load.tsv, written beside a batch by
// tools/testbed/machine_monitor.ps1, and splits each run's wall clock into in-game periods with what the machine was doing.
// Per run and period (default five in-game years):
//   wall s/yr     seconds of wall clock per in-game year (pairs of rows 20 s apart; a gap, a new game process or a backward
//                 date jump — a crash-resume — breaks the pair, so reloads and replays are not counted)
//   cpu s/yr      the GAME's CPU seconds per in-game year — THE DISCRIMINATOR: up with wall = the game did more work;
//                 wall up at flat cpu = the game was waiting (starved, throttled, blocked on disk or memory)
//   ×run          wall and cpu against the median of the OTHER runs over the same period (world size moves both over a
//                 century, so a run is judged against its siblings at the same dates, never against its own 1840s)
//   cores         the game's mean cores; harness = the batch's own helpers (archiver, harvester melts, watchers); other =
//                 everything else, the agent's analysis scripts included
//   perf%         CPU clock as % of rated (under ~85% of the session's median = throttling)
//   P/E busy      on a hybrid CPU, busy cores on the performance and the efficiency cores, with each class's mean clock — a game
//                 moved onto the E-cores by Windows (a background process) shows as P busy falling and E busy rising at a
//                 flat total; it is DISPLAYED, not scored, until a case has been seen
//   canary×       the fixed compute job's time ÷ the session's median (≥ 1.15 = the MACHINE was slower, whatever the game did)
//   memory        the game's resident (working set) and held (private) GB, the system's peak commit as % of its commit limit,
//                 transition (soft) page faults per second system-wide and the game's own, and the minimum free MB. Added after
//                 run 6 of 20261005_154629 slowed from 1890 the moment Windows cut the game's working set 10.5 → 6.6 GB at a
//                 commit of 37 of 38.9 GB (columns from that run on; earlier rows show —)
//   driver        a heuristic, stated so it can be argued with: MACHINE (canary ≥ 1.15 or clock < 0.85 of median) · LOAD
//                 (other or harness ≥ 2 cores) · MEMORY (< 1,000 MB free — NOT high commit or a trimmed game: run 6 slowed at
//                 the minute its working set was cut, then recovered with it still cut and commit at 96–98%, so those are displayed only) · GAME WORK (cpu ×run ≥ 1.3) · WAITING (wall ×run ≥ 1.3 at cpu ×run < 1.15 with
//                 none of the above)
//   node tools/testbed/ledger/machine_load.mjs <session> [--years 5] [--run run005_jex]
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const pos = []; for (let i = 0; i < args.length; i++) { if (args[i].startsWith('--')) i++; else pos.push(args[i]); }
const sesArg = pos[0];
if (!sesArg) { console.error('usage: machine_load.mjs <session> [--years 5] [--run runNNN_setup]'); process.exit(2); }
const SES = join(REPO, 'tools/testbed/sessions', basename(sesArg.replace(/[\\/]+$/, '')));
const file = join(SES, 'machine_load.tsv');
if (!existsSync(file)) { console.error(`no machine_load.tsv in ${SES} — was machine_monitor.ps1 running beside this batch?`); process.exit(2); }
const W = +opt('--years', 5); const ONLY = opt('--run', null);

const lines = readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
const num = v => (v === '' || v == null) ? null : +v;
const yearOf = s => { const m = /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/.exec(s || ''); return m ? +m[1] + (m[2] - 1) / 12 + (m[3] - 1) / 365 : null; };
// the monitor re-writes its header when its columns change, so follow the LAST header seen above each row
let head = null; const rows = [];
for (const l of lines) {
  if (l.startsWith('ts\t')) { head = l.split('\t'); continue; }
  if (!head) continue;
  const c = l.split('\t'); const r = Object.fromEntries(head.map((h, i) => [h, c[i]]));
  rows.push({ ...r, t: Date.parse(r.ts.replace(' ', 'T')) / 1000, y: yearOf(r.ingame), pid: r.game_pid,
    gc: num(r.game_cores), cpu: num(r.game_cpu_s), hc: num(r.harness_cores), oc: num(r.other_cores), perf: num(r.cpu_perf_pct),
    avail: num(r.avail_mb), pin: num(r.pages_in_s), disk: num(r.disk_busy_pct), can: num(r.canary_ms_1e7),
    pb: num(r.p_busy_cores), eb: num(r.e_busy_cores), pp: num(r.p_perf_pct), ep: num(r.e_perf_pct),
    ws: num(r.game_ws_mb), pv: num(r.game_priv_mb), cm: num(r.commit_gb), cl: num(r.commit_limit_gb), tf: num(r.trans_faults_s), gf: num(r.game_faults_s) });
}
const med = a => { const s = a.filter(x => x != null && Number.isFinite(x)).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const mean = a => { const s = a.filter(x => x != null && Number.isFinite(x)); return s.length ? s.reduce((x, y) => x + y, 0) / s.length : null; };
const dts = []; for (let i = 1; i < rows.length; i++) dts.push(rows[i].t - rows[i - 1].t);
const gap = 3 * (med(dts) || 20);
const canMed = med(rows.map(r => r.can)); const perfMed = med(rows.map(r => r.perf));

// per run, per period: accumulate the pairs
const per = {};   // run -> period -> acc
for (let i = 1; i < rows.length; i++) {
  const a = rows[i - 1], b = rows[i];
  if (a.run !== b.run || !a.run || a.pid !== b.pid || !a.pid || a.y == null || b.y == null) continue;
  const dt = b.t - a.t, dy = b.y - a.y;
  if (dt <= 0 || dt > gap || dy < 0) continue;
  const p = 1836 + Math.floor((a.y - 1836) / W) * W;
  const acc = ((per[b.run] ||= {})[p] ||= { dt: 0, dy: 0, dcpu: 0, gc: [], hc: [], oc: [], perf: [], avail: [], pin: [], disk: [], can: [], pb: [], eb: [], pp: [], ep: [], ws: [], pv: [], cmr: [], tf: [], gf: [] });
  acc.dt += dt; acc.dy += dy; if (a.cpu != null && b.cpu != null) acc.dcpu += Math.max(0, b.cpu - a.cpu);
  for (const k of ['gc', 'hc', 'oc', 'perf', 'avail', 'pin', 'disk', 'can', 'pb', 'eb', 'pp', 'ep', 'ws', 'pv', 'tf', 'gf']) if (b[k] != null) acc[k].push(b[k]);
  if (b.cm != null && b.cl) acc.cmr.push(b.cm / b.cl);
}
const runs = Object.keys(per).sort();
if (!runs.length) { console.error('no usable row pairs yet (the monitor needs two rows in one game process)'); process.exit(1); }
const rate = (acc, k) => acc.dy > 0.05 ? acc[k] / acc.dy : null;
const f = (x, d = 0) => x == null ? '—' : x.toFixed(d);
console.log(`machine load — ${basename(SES)} · ${rows.length} rows ${rows[0].ts} → ${rows[rows.length - 1].ts} · canary median ${f(canMed, 1)} ms per 1e7 · clock median ${f(perfMed)}% of rated · periods of ${W} in-game years`);
for (const run of runs) {
  if (ONLY && run !== ONLY) continue;
  console.log(`\n== ${run}`);
  console.log('   period      wall s/yr ×run  cpu s/yr ×run  cores game/harn/other(max)  perf%  P/E busy (clock%)  canary×  game RAM/held GB · commit · faults/s sys/game · min free MB  disk%  driver');
  for (const p of Object.keys(per[run]).map(Number).sort((x, y) => x - y)) {
    const acc = per[run][p]; const wall = rate(acc, 'dt'), cpu = rate(acc, 'dcpu');
    const sib = runs.filter(r => r !== run && per[r][p] && per[r][p].dy > 0.05);
    const wSib = med(sib.map(r => rate(per[r][p], 'dt'))), cSib = med(sib.map(r => rate(per[r][p], 'dcpu')));
    const wx = wall != null && wSib ? wall / wSib : null, cx = cpu != null && cSib ? cpu / cSib : null;
    const canX = med(acc.can) != null && canMed ? med(acc.can) / canMed : null, perfX = mean(acc.perf) != null && perfMed ? mean(acc.perf) / perfMed : null;
    const oMax = acc.oc.length ? Math.max(...acc.oc) : null, aMin = acc.avail.length ? Math.min(...acc.avail) : null, pMax = acc.pin.length ? Math.max(...acc.pin) : null;
    const drv = [];
    if ((canX != null && canX >= 1.15) || (perfX != null && perfX < 0.85)) drv.push('MACHINE');
    if ((mean(acc.oc) ?? 0) >= 2 || (mean(acc.hc) ?? 0) >= 2) drv.push('LOAD');
    const wsr = mean(acc.ws) != null && mean(acc.pv) ? mean(acc.ws) / mean(acc.pv) : null, cmr = acc.cmr.length ? Math.max(...acc.cmr) : null;
    if (aMin != null && aMin < 1000) drv.push('MEMORY');   // only real starvation: run 6 recovered at a trimmed working set and 96–98% commit
    if (cx != null && cx >= 1.3) drv.push(`GAME WORK ×${cx.toFixed(2)}`);
    if (!drv.length && wx != null && wx >= 1.3 && (cx == null || cx < 1.15)) drv.push('WAITING');
    console.log(`   ${p}–${p + W}  ${f(wall).padStart(9)} ${(wx == null ? '—' : wx.toFixed(2)).padStart(5)}  ${f(cpu).padStart(8)} ${(cx == null ? '—' : cx.toFixed(2)).padStart(5)}  ${`${f(mean(acc.gc), 1)}/${f(mean(acc.hc), 1)}/${f(mean(acc.oc), 1)} (${f(oMax, 1)})`.padStart(25)}  ${f(mean(acc.perf)).padStart(5)}  ${(acc.pb.length ? `${f(mean(acc.pb), 1)}/${f(mean(acc.eb), 1)} (${f(mean(acc.pp))}/${f(mean(acc.ep))})` : '—').padStart(17)}  ${(canX == null ? '—' : canX.toFixed(2)).padStart(7)}  ${`${f(mean(acc.ws) == null ? null : mean(acc.ws) / 1024, 1)}/${f(mean(acc.pv) == null ? null : mean(acc.pv) / 1024, 1)} · ${cmr == null ? '—' : f(100 * cmr) + '%'} · ${f(mean(acc.tf))}/${f(mean(acc.gf))} · ${f(aMin)}`.padStart(44)}  ${f(mean(acc.disk)).padStart(5)}  ${drv.join(' · ')}`);
  }
}
console.log('\n×run = against the median of the OTHER runs in this file over the same period (— where no sibling covers it).');
