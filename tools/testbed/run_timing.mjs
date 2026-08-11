// HOW LONG A RUN ACTUALLY TAKES — in-game years per real minute, BY DECADE.
//
//   node tools/testbed/run_timing.mjs <sessionDir|runDir> [...]
//
// ⚠⚠ THE REASON THIS EXISTS: **NEVER EXTRAPOLATE A RUN'S LENGTH FROM ITS FIRST DECADE.** The 1830s
// run at ~1.0 in-game years per minute and the 1930s at ~0.44 — the game gets steadily slower as the
// economy it is simulating grows, so a rate sampled early under-states a century by about a THIRD.
// Measured 2026-08-11: a first-decade reading suggested ~100 min for 1836-1936; the run took 153.
// The coarse curves, and the cumulative budget table, are in MODDING_NOTES -> Automated headless runs.
//
// The observer logs a tick line ("... <wall>s  in-game <date>") every ~20s, which is the series needed.
// ⚠ A RESUMED run restarts its wall clock, so attempts are split — folding them together makes the
// curve double back on itself and produces nonsense rates.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dirs = process.argv.slice(2);
const asYear = d => { const [y, m = 1, dd = 1] = d.split('.').map(Number); return y + (m - 1) / 12 + (dd - 1) / 365; };

for (const dir of dirs) {
  const runs = existsSync(join(dir, 'run.log')) ? [dir]
    : readdirSync(dir).map(e => join(dir, e)).filter(p => statSync(p).isDirectory() && existsSync(join(p, 'run.log')));
  for (const rp of runs) {
    const txt = readFileSync(join(rp, 'run.log'), 'utf8');
    // ⚠ A resumed run RESTARTS its wall clock, so attempts must be handled separately or the curve
    // folds back on itself. Split on the resume marker.
    const attempts = txt.split(/resume attempt \d+/);
    const label = rp.split(/[\\/]/).slice(-2).join('/');
    attempts.forEach((chunk, ai) => {
      const pts = [...chunk.matchAll(/\.\.\.\s*([\d\s]+)s\s+in-game (\d{4}\.\d+\.\d+)/g)]
        .map(m => ({ w: +m[1].replace(/\s/g, ''), y: asYear(m[2]) }))
        .filter(p => Number.isFinite(p.y));
      if (pts.length < 5) return;
      // per-decade rate: fit each decade's own segment
      const buckets = {};
      for (let i = 1; i < pts.length; i++) {
        const dy = pts[i].y - pts[i - 1].y, dw = pts[i].w - pts[i - 1].w;
        if (dy <= 0 || dw <= 0) continue;                 // a resume or a stall
        const dec = Math.floor(pts[i].y / 10) * 10;
        (buckets[dec] ??= { y: 0, w: 0 }).y += dy;
        buckets[dec].w += dw;
      }
      const decs = Object.keys(buckets).map(Number).sort((a, b) => a - b);
      console.log(`\n${label}${attempts.length > 1 ? ` (attempt ${ai + 1})` : ''}  ` +
        `${pts[0].y.toFixed(0)}->${pts.at(-1).y.toFixed(0)}, ${(pts.at(-1).w / 60).toFixed(0)} min`);
      console.log('  decade   in-game yr/min   min per decade');
      for (const d of decs) {
        const b = buckets[d], rate = b.y / (b.w / 60);
        console.log(`  ${d}s        ${rate.toFixed(2).padStart(6)}        ${(10 / rate).toFixed(1).padStart(6)}`);
      }
    });
  }
}
