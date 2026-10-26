// THE REPORT'S SCORECARD = THE CRITERIA REGISTER (BALANCE_FRAMEWORK §10.104, user-ruled 2026-10-24: "the register metrics come later and are better
// defined and calibrated, so we should mostly be based on them"). Reads criteria.mjs --json (fill_ledger.sh writes <outDir>/criteria.json) and
// writes <outDir>/register.html: the rows of the verdict table — per register line the consensus ÷ vanilla, the absolute figure beside vanilla's,
// the aim / soft / hard band and the verdict, then the decade path (§10.96, the 1886 line graded), the closed-major term, the loss and the
// per-run hard outcome. The bands are criteria.mjs's own (it writes the world-GDP aim and the derived hard band into the JSON); the ones this file
// restates (W, U*, H, the pool's GDP, PI, PP, T0) are §10.83's ruled numbers and must move with criteria.mjs if they are ever re-ruled.
// ⚠ This file grades nothing of its own: a register line's verdict is criteria.mjs's (at the aim / inside off the aim / beyond the soft boundary /
//   broken). The readings the register does not carry stay in fill_goals.mjs.
//   node tools/testbed/ledger/fill_register.mjs <outDir> [--json <criteria.json>]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const argv = process.argv.slice(2); const DIR = argv[0];
if (!DIR) { console.error('usage: fill_register.mjs <outDir> [--json <criteria.json>]'); process.exit(2); }
const ji = argv.indexOf('--json'); const SRC = ji > 0 ? argv[ji + 1] : join(DIR, 'criteria.json');
if (!existsSync(SRC)) { console.error('no ' + SRC + ' — run criteria.mjs --json first (fill_ledger.sh does)'); process.exit(1); }
const J = JSON.parse(readFileSync(SRC, 'utf8'));
if (!J.arms || J.arms.length !== 1) { console.error('fill_register: expected ONE arm in ' + SRC + ', found ' + (J.arms || []).length); process.exit(1); }
const A = J.arms[0], C = A.consensus, R = J.ref, runs = A.runs;
const r2 = x => Math.round(x * 100) / 100;
const f2 = (x, d = 2) => Number.isFinite(x) ? x.toFixed(d) : '—';
const x2 = x => Number.isFinite(x) ? x.toFixed(2) + '×' : '—';
const pc = x => Number.isFinite(x) ? (100 * x).toFixed(1) + '%' : '—';
const pill = (cls, t) => `<span class="pill ${cls}">${t}</span>`;
// criteria.mjs's own verdict words, mapped to the page's three classes
const verdict = (v, lo, hi, soft) => { const x = r2(v); if (!Number.isFinite(x)) return pill('dim', 'no reading');
  if (soft && soft(x)) return pill('bad', 'beyond the soft line'); if (x >= lo && x <= hi) return pill('ok', 'at the aim');
  return pill('warn', x < lo ? 'inside, below the aim' : 'inside, above the aim'); };
const row = (scope, line, val, abs, band, v) => `<tr><td class="dim">${scope}</td><td class="goalcell">${line}</td><td class="num"><b>${val}</b></td><td class="num dim">${abs}</td><td class="num dim">${band}</td><td>${v}</td></tr>`;
const aim = J.gdpAim || [0.9, 1.0], hard = J.gdpHard;
const out = [];
const broken = runs.filter(r => r.broken), nB = broken.length;
out.push(`<tr><td class="dim">runs</td><td class="goalcell"><b>Hard lines, per run</b> <span class="dim">(the 1836–1845 anchor, the end-state world-GDP band, the pooled U* floor, capital abundance)</span></td>`
  + `<td class="num"><b>${runs.length - nB} intact / ${nB} broken</b></td><td class="num dim">${broken.map(r => r.rel.split('/').pop() + ' by ' + r.broken).join(', ') || '—'}</td>`
  + `<td class="num dim">one broken run ends a config</td><td>${nB ? pill('bad', nB + ' broken') : pill('ok', 'all intact')}</td></tr>`);
out.push(`<tr><td class="dim">consensus</td><td class="goalcell" colspan="5">${C.note} <span class="dim">· every line below is that consensus ÷ the vanilla reference (n=${J.vanN ?? '?'}), the end state the ${J.end[0]}–${J.end[1]} mean</span></td></tr>`);
// ---- WORLD
out.push(row('world', '<b>GDP</b> <span class="dim">(priority 1; the 1935 point ' + x2(C.gdp35) + ')</span>', x2(C.gdpW), '£' + f2(C.gdpW * R['world.gdp'] / 1e6, 0) + 'M vs £' + f2(R['world.gdp'] / 1e6, 0) + 'M',
  f2(aim[0]) + '–' + f2(aim[1]) + ' · soft 0.75–1.33' + (hard ? ' · hard ' + f2(hard.lo) + '–' + f2(hard.hi) : ''), verdict(C.gdpW, aim[0], aim[1], x => x < 0.75 || x > 1.33)));
if (C.path) { const ys = Object.keys(C.path).map(Number).sort((a, b) => a - b); const L = C.line1886 || {};
  out.push(row('world', '<b>GDP decade path</b> <span class="dim">(§10.96; the median of all runs ÷ vanilla’s per decade; graded at 1886 only)</span>',
    x2(L.med) + ' <span class="dim">at 1886</span>', ys.map(y => '’' + String(y).slice(2) + ' ' + f2(C.path[y].med)).join(' · '),
    '1886 line ' + f2(L.lo) + '–' + f2(L.hi), Number.isFinite(L.med) ? (L.beyond ? pill('bad', 'beyond the 1886 line') : pill('ok', 'inside the 1886 line')) : pill('dim', 'no reading'))); }
out.push(row('world', 'W <span class="dim">productive workers per head</span>', x2(C.worldW), f2(C.worldW_abs, 4) + ' vs ' + f2(R['world.W'], 4), '0.6–0.95 · soft &gt; 1.0', verdict(C.worldW, 0.6, 0.95, x => x > 1.0)));
out.push(row('world', 'U* <span class="dim">unemployed + peasants, of the workforce</span>', x2(C.worldU), pc(C.worldU_abs) + ' vs ' + pc(R['world.U']), 'no aim · soft &lt; 1.0',
  r2(C.worldU) < 1.0 ? pill('bad', 'beyond the soft line') : pill('dim', 'inside (no aim)')));
out.push(row('world', 'H <span class="dim">investment pool ÷ GDP</span>', x2(C.worldH), f2(C.worldH_abs) + ' vs ' + f2(R['world.H']), '&lt; 1', verdict(C.worldH, -Infinity, 1.0)));
// ---- THE SHORTLIST POOL
out.push(row('shortlist', '<b>GDP</b> <span class="dim">(total; per head ' + x2(C.poolW * C.poolY) + ' = W × Y)</span>', x2(C.gdpP), '—', '1.1–1.9 · soft 0.95–2.0', verdict(C.gdpP, 1.10, 1.90, x => x < 0.95 || x > 2.0)));
out.push(row('shortlist', 'W', x2(C.poolW), f2(C.poolW_abs, 4) + ' vs ' + f2(R['pool.W'], 4), '0.6–0.95 · soft &gt; 1.0', verdict(C.poolW, 0.6, 0.95, x => x > 1.0)));
out.push(row('shortlist', 'U*', x2(C.poolU), pc(C.poolU_abs) + ' vs ' + pc(R['pool.U']), '≥ 2 · soft &lt; 1.0 · hard &lt; 10% abs', verdict(C.poolU, 2.0, Infinity, x => x < 1.0)));
out.push(row('shortlist', 'H', x2(C.poolH), f2(C.poolH_abs) + ' vs ' + f2(R['pool.H']), '&lt; 1', verdict(C.poolH, -Infinity, 1.0)));
// ---- PRICES
out.push(row('prices', 'PI <span class="dim">building inputs in £, ' + (C.PIfalling ? 'falling decade over decade' : 'NOT falling every decade') + '</span>', x2(C.PI), f2(C.PI_abs) + ' of base vs ' + f2(R.PI), '≤ 0.8 · soft &gt; 1.0',
  verdict(C.PI, -Infinity, 0.8, x => x > 1.0)));
out.push(row('prices', 'PP <span class="dim">pop goods in wage units (PM, the war goods, read only: ' + x2(C.PM) + ')</span>', x2(C.PP), '—', '≤ 0.8 · soft &gt; 1.1', verdict(C.PP, -Infinity, 0.8, x => x > 1.1)));
// ---- TIERS
if (C.T) { const T = C.T; const tot = (T.end || []).reduce((a, b) => a + b, 0);
  out.push(row('tiers', 'T0 <span class="dim">t0 workers on the shortlist, 1935 ÷ the 1900s; decades ' + (T.dec0 || []).map(v => f2(v / 1e6)).join(' / ') + 'M</span>', x2(T.ratio0),
    f2((T.end || [])[0] / 1e6) + 'M of ' + f2(tot / 1e6) + 'M tiered (' + f2(T.r0, 3) + ' of the rest)', 'zero or falling · soft &gt; 1.3',
    r2(T.ratio0) > 1.3 ? pill('bad', 'beyond the soft line') : (T.t36 === 0 || T.declining) ? pill('ok', 'at the aim') : pill('warn', 'not yet falling')));
  out.push(row('tiers', 'T3 <span class="dim">t3 workers ÷ the other tiers (the more the better, no band)</span>', f2(T.r3, 2), pc(T.share3) + ' of tiered workers', 'the more the better', pill('dim', 'a reading'))); }
// ---- CLOSED MAJOR
if (C.gerCM) out.push(row('Germany', 'G <span class="dim">closed-major term, the lucky seed (p75 of ' + C.gerCM.of + ' runs): full employment + 4 × hoarding, 1927–36 (§10.100)</span>', f2(C.gerCM.G),
  'full empl. ' + f2(C.gerCM.fe) + ' · hoarding ' + f2(C.gerCM.ab), 'aim 0', C.gerCM.G < 0.005 ? pill('ok', 'at the aim') : C.gerCM.ab > 0.005 ? pill('bad', 'capital piling up') : pill('warn', 'full employment')));
// ---- THE LOSS
if (C.loss) { const parts = Object.entries(C.loss.parts).filter(([, v]) => Math.abs(v) > 0.005).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const perRun = runs.filter(r => r.loss).map(r => r.loss.L).sort((a, b) => a - b);
  out.push(`<tr><td class="dim">loss</td><td class="goalcell"><b>The register's loss</b> <span class="dim">(Σ weight × distance from the aim in σ, steeper past a soft line; lower is better)</span></td><td class="num"><b>${f2(C.loss.L)}</b></td>`
    + `<td class="num dim">${parts.map(([k, v]) => k + ' ' + f2(v)).join(' + ')}</td><td class="num dim">per run ${f2(perRun[0], 1)}–${f2(perRun[perRun.length - 1], 1)}</td>`
    + `<td>${C.loss.soft.length ? pill('warn', 'not final: beyond soft on ' + C.loss.soft.join(', ')) : pill('dim', 'directional (§10.83.7)')}</td></tr>`); }
else out.push(`<tr><td class="dim">loss</td><td class="goalcell" colspan="5">${C.divergent ? 'no consensus loss: the pair diverges' : 'no consensus loss: no intact run'}</td></tr>`);
writeFileSync(join(DIR, 'register.html'), out.join('\n    '));
console.log(`register: ${runs.length - nB}/${nB} intact/broken · world GDP ${x2(C.gdpW)} · 1886 ${x2(C.line1886 && C.line1886.med)} · loss ${C.loss ? f2(C.loss.L) : '—'} → ${join(DIR, 'register.html')}`);
