// per run: world GDP and GBR GDP at the dump (own token's GDP lines), error.log lines inside the run's own window, top classes
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const S = process.argv[2];
const hms = s => { const [h, m, x] = s.split(':').map(Number); return h * 3600 + m * 60 + x; };
const rows = [];
for (const r of readdirSync(S).filter(d => /^run\d+_/.test(d) && existsSync(join(S, d, 'meta.json'))).sort()) {
  const meta = JSON.parse(readFileSync(join(S, r, 'meta.json'), 'utf8').replace(/^\uFEFF/, ''));
  const tok = (readFileSync(join(S, r, 'telemetry.json'), 'utf8').match(/"token"\s*:\s*"([^"]+)"/) || [])[1] || meta.token || meta.telemetry_token;
  const dbg = readFileSync(join(S, r, 'logs_live', 'debug.log'), 'latin1').split('\n');
  const gdp = new Map();
  for (const l of dbg) { const i = l.indexOf('V3TB|'); if (i < 0) continue; const f = l.slice(i).split('|'); if (f[2] !== 'GDP') continue; if (tok && f[1] !== tok) continue; gdp.set(f[4], +f[5]); }
  const world = [...gdp.values()].reduce((s, x) => s + x, 0), gbr = gdp.get('Great Britain') || gdp.get('United Kingdom') || 0;
  // run window: from run.log's first line to its last
  const rl = readFileSync(join(S, r, 'run.log'), 'utf8').split('\n').filter(l => /^\[\d\d:\d\d:\d\d\]/.test(l));
  const t0 = hms(rl[0].slice(1, 9)), t1 = hms(rl[rl.length - 1].slice(1, 9));
  const inWin = t => (t1 >= t0 ? t >= t0 && t <= t1 : t >= t0 || t <= t1);
  const el = existsSync(join(S, r, 'logs_live', 'error.log')) ? readFileSync(join(S, r, 'logs_live', 'error.log'), 'latin1').split(/\r?\n/) : [];
  let n = 0; const cls = new Map();
  for (const l of el) { const m = /^\[(\d\d:\d\d:\d\d)\]\[([^\]]+)\]: ?(.*)$/.exec(l); if (!m || !inWin(hms(m[1]))) continue; n++; const k = (m[2] + ' ' + m[3].replace(/[0-9]+/g, '#')).slice(0, 110); cls.set(k, (cls.get(k) || 0) + 1); }
  const top = [...cls.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${v}× ${k}`).join(' | ');
  rows.push({ r, reached: meta.reached_ingame_date, world, gbr, n, top });
}
const van = rows.filter(x => /vanilla/.test(x.r)); const vw = van.length ? van.reduce((s, x) => s + x.world, 0) / van.length : 0;
for (const x of rows) console.log(`${x.r.padEnd(16)} reached ${x.reached}  worldGDP ${(x.world / 1e6).toFixed(0)}M${vw ? ` (${(x.world / vw).toFixed(2)}× vanilla)` : ''}  GBR ${(x.gbr / 1e6).toFixed(1)}M  errors-in-window ${x.n}  ${x.top.slice(0, 200)}`);
