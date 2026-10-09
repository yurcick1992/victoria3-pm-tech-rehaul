// THE TICK-COST VECTORS AS A FACTORIAL (2026-10-09, session 20261009_082702_vectors-n3-10y): per run, wall seconds per in-game
// year (arm_tick_cost.mjs's reading: the engine's 1-s tick stamps, the 1 Jan autosave day out) and the game-logic seconds
// (custom_automated_stats.log), regressed on the vectors coded in the setup name `v<digits>` (v0 = none; 1 = V1, 2 = V2, …);
// a setup without a v-code (vanilla) is reported as a reference, not fitted. Ordinary least squares with standard errors.
//   node tools/testbed/ledger/vector_effects.mjs <session> [--from 1836] [--to 1846] [--interactions 12,24]
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTicks } from './tick_profile.mjs';
const SES = join(dirname(fileURLToPath(import.meta.url)), '..', 'sessions');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const session = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
if (!session) { console.error('usage: vector_effects.mjs <session> [--from Y] [--to Y] [--interactions 12,24]'); process.exit(2); }
const FROM = +opt('--from', 1836), TO = +opt('--to', 1846);
const INTER = (opt('--interactions', '') || '').split(',').filter(Boolean);
const runs = [];
for (const r of readdirSync(join(SES, session)).filter(d => /^run\d+_/.test(d)).sort()) {
  const dir = join(SES, session, r), setup = r.replace(/^run\d+_/, '');
  const T = parseTicks(dir); if (!T) continue;
  let w = 0, n = 0; for (const t of T) { if (t.y < FROM || t.y >= TO || (t.m === 1 && t.d === 1)) continue; w += t.t; n++; }
  const years = TO - FROM; if (n < years * 1440) { console.log(`skip ${r}: ${n} ticks`); continue; }
  let logic = null;
  for (const f of ['logs_live/custom_automated_stats.log', 'logs/custom_automated_stats.log']) {
    const p = join(dir, f); if (!existsSync(p)) continue;
    const by = {}; for (const l of readFileSync(p, 'latin1').split(/\r?\n/)) { const m = /\[Year - Average sum time\]\[Year\]\[Milliseconds\]:\[(\d+)\]\[(\d+)\]/.exec(l); if (m) by[+m[2] - 1] = +m[1]; }
    const v = []; for (let y = FROM; y < TO; y++) if (by[y] != null) v.push(by[y]);
    if (v.length === years) logic = v.reduce((s, x) => s + x, 0) / v.length / 1000;
    break;
  }
  runs.push({ r, setup, wall: w / years * 365 / 364, logic });
}
const coded = runs.filter(x => /^v\d+$/.test(x.setup)), refs = runs.filter(x => !/^v\d+$/.test(x.setup));
const VECS = [...new Set(coded.flatMap(x => x.setup.slice(1).split('').filter(d => d !== '0')))].sort();
const cols = ['const', ...VECS.map(v => 'V' + v), ...INTER.map(s => 'V' + s.split('').join('xV'))];
const X = coded.map(x => { const d = new Set(x.setup.slice(1).split('')); return [1, ...VECS.map(v => d.has(v) ? 1 : 0), ...INTER.map(s => s.split('').every(c => d.has(c)) ? 1 : 0)]; });
function ols(y) {
  const k = X[0].length, n = X.length;
  const XtX = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => X.reduce((s, r) => s + r[i] * r[j], 0)));
  const Xty = Array.from({ length: k }, (_, i) => X.reduce((s, r, q) => s + r[i] * y[q], 0));
  const inv = (() => { const A = XtX.map((r, i) => [...r, ...Array.from({ length: k }, (_, j) => +(i === j))]); for (let c = 0; c < k; c++) { let p = c; for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]]; const d = A[c][c]; for (let j = 0; j < 2 * k; j++) A[c][j] /= d; for (let r = 0; r < k; r++) if (r !== c) { const f = A[r][c]; for (let j = 0; j < 2 * k; j++) A[r][j] -= f * A[c][j]; } } return A.map(r => r.slice(k)); })();
  const b = inv.map(r => r.reduce((s, v, j) => s + v * Xty[j], 0));
  const res = y.map((v, q) => v - X[q].reduce((s, x, j) => s + x * b[j], 0)); const s2 = res.reduce((s, e) => s + e * e, 0) / (n - k);
  return { b, se: inv.map((r, i) => Math.sqrt(s2 * r[i])), sd: Math.sqrt(s2), n, k };
}
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
console.log(`session ${session}, ${FROM}–${TO - 1}: ${coded.length} vector runs, ${refs.length} reference runs`);
for (const [lab, key] of [['WALL s per in-game year', 'wall'], ['GAME LOGIC s per in-game year', 'logic']]) {
  const ok = coded.every(x => x[key] != null); if (!ok) { console.log(`${lab}: missing in some runs`); continue; }
  const f = ols(coded.map(x => x[key]));
  console.log(`\n${lab} (n=${f.n}, residual sd ${f.sd.toFixed(2)}):`);
  cols.forEach((c, i) => console.log(`  ${c.padEnd(10)} ${(f.b[i] >= 0 ? '+' : '') + f.b[i].toFixed(2)} ± ${f.se[i].toFixed(2)}`));
  for (const s of [...new Set(refs.map(x => x.setup))]) console.log(`  reference ${s}: ${mean(refs.filter(x => x.setup === s).map(x => x[key])).toFixed(2)} (n=${refs.filter(x => x.setup === s).length}); the fitted base (no vector): ${f.b[0].toFixed(2)}`);
}
