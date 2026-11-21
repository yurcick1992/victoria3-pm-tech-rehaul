// THE REPORT'S SCORECARD — ONE TABLE (user, 2026-10-29: "incorporate all readings up until the dedicated performance block into what is now the
// register table … Leave only the following columns: Line (should describe the scope in prose); this batch / vanilla, one metric (may be absolute,
// may be ratio, what fits the line best); aim; verdict"). It replaces fill_register.mjs (the criteria register, §10.104) and fill_goals.mjs (the
// readings G1–G7) and takes in what the lede used to carry in prose: play time, the input-price red flags, the laggard test, misplaced capital and
// the technology census. Rows are grouped under the question they answer, in the order of the mod's goals (CLAUDE.md §1.1). The register's loss
// leaves the table for the footer (user, 2026-10-29: the one cut of the proposal that was accepted).
// ⭐ ON THE REGISTER OF §10.120 / §10.123 SINCE 2026-11-21 (THE loss of the mod 1.2 calibration): the barrier heads the table; the aims are levels
//   of the mod's own (the eight depeasantation aims, the two capital terms, T0, T3, the old plants pushed out, PI and PP falling) and world GDP
//   the one aim against vanilla; the ratios to vanilla that were aims (W, H, the shortlist's U* and GDP) are minor readings, graded no more.
//   Vanilla's figure stands beside a level of the mod's own as a reference, never as its yardstick (§10.120 point 4).
//   A register line's verdict is its DISTANCE in the line's own spreads, as the loss reads it (criteria.json `terms`): 0 at the aim · up to 1
//   within a spread · up to 2 off the aim · beyond, far from it. The readings keep the bands fill_goals.mjs carried (§10.104).
// Reads <outDir>: criteria.json, consts.json, payback.json, emp.json, emp_cols.json, tierchoice.json, report_data.json, perf_panel.json,
//   redflags_metrics.json, laggards.json, tech.json, misplaced.json, downsize.json. A missing optional source prints its line as "not read".
// Writes <outDir>/scorecard.html (the table's rows), scorecard_loss.html (the footer's loss line) and intro.json (the two charts above the pages:
//   building-input prices decade by decade, world GDP run by run).
//   node tools/testbed/ledger/fill_scorecard.mjs <outDir> [--config <book>]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const argv = process.argv.slice(2), DIR = argv[0];
if (!DIR) { console.error('usage: fill_scorecard.mjs <outDir> [--config <book>]'); process.exit(2); }
const CFGP = (() => { const i = argv.indexOf('--config'); return i > 0 ? argv[i + 1] : null; })();
const CFG = CFGP && existsSync(CFGP) ? JSON.parse(readFileSync(CFGP, 'utf8').replace(/^﻿/, '')) : null;
const has = n => existsSync(join(DIR, n));
const J = n => JSON.parse(readFileSync(join(DIR, n), 'utf8'));
const JO = n => has(n) ? J(n) : null;
for (const n of ['criteria.json', 'consts.json', 'payback.json', 'emp.json', 'tierchoice.json', 'report_data.json'])
  if (!has(n)) { console.error('fill_scorecard: no ' + n + ' in ' + DIR + ' — run fill_ledger.sh'); process.exit(1); }
const CR = J('criteria.json');
if (CR.register !== '§10.123') { console.error('fill_scorecard: criteria.json is not the §10.123 register (rerun criteria.mjs)'); process.exit(1); }
if (!CR.arms || CR.arms.length !== 1) { console.error('fill_scorecard: expected ONE arm in criteria.json, found ' + (CR.arms || []).length); process.exit(1); }
const A = CR.arms[0], C = A.consensus, R = CR.ref, RUNS = A.runs, VR = CR.vanReading || {}, TERMS = (C.loss && C.loss.terms) || {};
const CON = J('consts.json'), PB = J('payback.json'), EMP = J('emp.json'), TC = J('tierchoice.json'), RD = J('report_data.json');
const PERF = JO('perf_panel.json'), RF = JO('redflags_metrics.json'), LAG = JO('laggards.json'), TECH = JO('tech.json'), MIS = JO('misplaced.json'), DZ = JO('downsize.json');

// ---- formatting
const r2 = x => Math.round(x * 100) / 100;
const fin = Number.isFinite;
const x2 = x => fin(x) ? x.toFixed(2) + '×' : '—';
const f1 = x => fin(x) ? x.toFixed(1) : '—';
const f2 = x => fin(x) ? x.toFixed(2) : '—';
const pc = (x, d = 1) => fin(x) ? (100 * x).toFixed(d) + '%' : '—';
const sgn = x => fin(x) ? (x > 0 ? '+' : x < 0 ? '−' : '±') + Math.abs(Math.round(x)) + '%' : '—';
const med = a => { const s = a.filter(fin).sort((x, y) => x - y); if (!s.length) return NaN; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pill = (cls, t) => `<span class="pill ${cls}">${t}</span>`;
const note = t => t ? ` <span class="v">${t}</span>` : '';
const dim = t => `<br><span class="dim">${t}</span>`;
const rows = [];
const grp = (q, sub) => rows.push(`<tr class="grp"><td colspan="4">${q}${sub ? `<span>${sub}</span>` : ''}</td></tr>`);
const row = (line, val, aim, verdict) => rows.push(`<tr><td>${line}</td><td class="num">${val}</td><td>${aim}</td><td>${verdict}</td></tr>`);
const notRead = (line, aim, why) => row(line, '<span class="dim">not read</span>', aim, `<span class="v">${why}</span>`);
const NOAIMS = !C.runs || !C.runs.length;   // every run past the barrier: the aims are not read (§10.120 point 3)
// a register line's verdict from its distance in spreads (criteria.json terms); `dir` names the side of a point aim
const distV = (d, dir = '') => !fin(d) ? pill('dim', NOAIMS ? 'not read' : 'no reading') : d === 0 ? pill('ok', 'at the aim')
  : d <= 1 ? pill('ok', 'within a spread' + (dir ? ', ' + dir : '')) : d <= 2 ? pill('warn', 'off the aim' + (dir ? ', ' + dir : '')) : pill('bad', 'far ' + (dir || 'from the aim'));
const side = (v, aim) => !fin(v) ? '' : v < aim ? 'below' : v > aim ? 'above' : '';
const reading = () => pill('dim', 'a reading');
const band3 = (x, okLo, okHi, wLo, wHi) => !fin(x) ? 'warn' : (x >= okLo && x <= okHi) ? 'ok' : (x >= wLo && x <= wHi) ? 'warn' : 'bad';

// ---- shared derivations (from fill_goals.mjs, unchanged in substance)
const Y = 1935, p = PB[Y] || {};
const END = [1932, 1933, 1934, 1935, 1936];
const meanOf = (ser, f) => { const v = END.map(y => ser[y] != null ? f(ser[y]) : null).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const ppwR = (meanOf(CON.PROD_FLAT, r => r.g) / meanOf(CON.PROD_FLAT, r => r.w)) / (meanOf(CON.PROD_VAN, r => r.g) / meanOf(CON.PROD_VAN, r => r.w));
const COLS = has('emp_cols.json') ? J('emp_cols.json') : ['e0', 'e1', 'e2', 'e3'];
const eraOfCol = l => +(/^[et](\d+)/.exec(l)?.[1] ?? NaN);
const NERA = Math.max(...COLS.map(eraOfCol).filter(fin)) + 1;
const byEra = y => { const o = Array(NERA).fill(0); COLS.forEach((l, i) => { const e = eraOfCol(l); if (fin(e)) o[e] += +(EMP[y] || [])[i] || 0; }); return o; };

// ================================================================ ARE THE RUNS SOUND?
grp('Are the runs sound?', 'Past the barrier the investment loop has broken, and a run reports that line alone (BALANCE_FRAMEWORK §10.120).');
{ const past = RUNS.filter(r => r.barrier && r.barrier.past), b = C.barrier || {}, worst = b.worst;
  row('Runs past the barrier: a shortlist country holding at least 2% of world GDP whose unspent investment pool averages its whole GDP or more over ten years',
    `<b>${past.length} of ${RUNS.length}</b>` + dim(`vanilla ${VR.barrierPast ?? '?'} of ${VR.n ?? '?'}`), 'none',
    (past.length ? pill('bad', past.length + ' past') : pill('ok', 'none past'))
    + note('the highest ten-year mean ' + f2(worst?.value) + (worst?.m ? ' (' + worst.m + ', ' + worst.from + '–' + String(worst.to).slice(2) + ')' : '')
      + (past.length ? '; past: ' + past.map(r => r.rel.split('/').pop() + ' ' + r.barrier.m + ' ' + f2(r.barrier.value)).join(', ') : ''))); }
if (PERF && PERF.runs?.length) {
  const ok = r => r.cluster !== 3, mv = med(PERF.runs.filter(r => r.van && ok(r)).map(r => r.min)), mm = med(PERF.runs.filter(r => !r.van && ok(r)).map(r => r.min));
  const rr = mm / mv, pct = (rr - 1) * 100, GY = PERF.grade?.green ?? 5, RY = PERF.grade?.yellow ?? 10;
  const cls = pct <= GY ? 'ok' : pct <= RY ? 'warn' : 'bad', lab = pct <= GY ? 'inside the budget' : pct <= RY ? 'needs improvement' : 'too slow';
  const bs = PERF.bySession || [];
  row('Time to play the century, against the vanilla runs played beside it', `<b>×${rr.toFixed(2)}</b>`, `at most ×${(1 + RY / 100).toFixed(2)}`,
    pill(cls, lab) + note(bs.length > 1 ? 'by session ' + bs.map(s => '×' + s.ratio.toFixed(2)).join(', ') : ''));
} else notRead('Time to play the century, against vanilla', 'at most ×1.10', 'no perf_panel.json');
if (RF?.arms) {
  const arm = RF.arms.find(a => !a.ref), ref = RF.arms.find(a => a.ref);
  const m = arm?.bases?.market, v = ref?.bases?.market;
  if (m && v) { const a = m.problem_market_years.median, b = v.problem_market_years.median, q = a / b;
    const per = (m.by_period || []).map((x, i) => [x, (v.by_period || [])[i]]).filter(([x, y]) => x && y).sort((s, t) => (t[0].median - t[1].median) - (s[0].median - s[1].median))[0];
    // what "of 800" is, in the line itself (user, 2026-10-29): the major markets × the years, the markets named
    const mk = Object.keys(m.by_market || {}).map(k => k.replace(/ Market$/, '')), yrs = RF.span ? RF.span[1] - RF.span[0] + 1 : 100;
    row(`Market-years short of an industrial input (price 1.7× base or more, on real demand), of ${yrs * mk.length} = ${mk.length} major markets × ${yrs} years; against this batch’s own vanilla`
      + `<br><span class="v">The markets: ${mk.join(', ')}.</span>`,
      `<b>${a} vs ${b}</b>`, 'no more than vanilla’s',
      (q <= 1.1 ? pill('ok', 'about vanilla’s') : pill('warn', '×' + q.toFixed(2) + ' of vanilla’s')) + note(per && q > 1.1 ? 'most of the excess ' + per[0].period.join('–') : ''));
  } else notRead('Years a major market spends short of an industrial input', 'no more than vanilla’s', 'no order-book reading on both arms');
} else notRead('Years a major market spends short of an industrial input', 'no more than vanilla’s', 'no redflags_metrics.json');

// ================================================================ THE WORLD ECONOMY'S SIZE
grp('Does the world economy stay near vanilla’s size?', 'Government income and prestige scale with world GDP, so it must stay close; a dip in mid-century is expected.');
{ const aim = CR.gdpAim || [0.9, 1.0], g = RUNS.map(r => r.gdpW).filter(fin);
  row('World GDP as the game shows it', `<b>${x2(C.gdpW)}</b>`, `${aim[0].toFixed(2)}–${aim[1].toFixed(2)}×`,
    distV(TERMS.gdp, side(C.gdpW, (aim[0] + aim[1]) / 2)) + note(g.length > 1 ? 'runs ' + Math.min(...g).toFixed(2) + '–' + Math.max(...g).toFixed(2) : ''));
  const L = C.line1886 || {};
  row('World GDP in 1886, the depth of the expected mid-century dip', `<b>${x2(L.med)}</b>`, fin(L.lo) ? `${L.lo.toFixed(2)}–${L.hi.toFixed(2)}×` : '—',
    fin(L.med) ? (L.beyond ? pill('bad', 'outside the line') : pill('ok', 'inside')) : pill('dim', 'no reading'));
  const an = C.anchor || {};
  row('The 1836–1845 start: runs whose world GDP leaves vanilla’s range (its 90%, ±10%) in more than two of the ten years', `<b>${an.flagged ?? '—'} of ${RUNS.length}</b>`, 'none',
    an.flagged ? pill('warn', 'flagged') : pill('ok', 'none')); }

// ================================================================ GOALS 1 AND 2
grp('Does a technological edge win markets, and do efficient producers push out the rest?');
{ const O = C.old, VO = VR.old;   // the register's old-plants term (criteria.json, §10.121.1): the median run's workers kept and its slope
  const line = 'Backward industries with a far better producer in the same market: change in their workers over ten years'
    + '<br><span class="v">Backward: a country’s industry two tiers behind the best producer in its market, without the technology to upgrade yet; manufacturing only.</span>';
  if (O && fin(O.kept)) row(line, `<b>${sgn(100 * (O.kept - 1))}</b>` + (VO && fin(VO.kept) ? dim('vanilla ' + sgn(100 * (VO.kept - 1))) : ''), 'a loss, larger each decade',
    distV(TERMS.old, O.kept > 1 ? 'above 100% kept' : O.slope > 0 ? 'not shrinking' : '') + note((fin(O.slope) ? 'the share kept ' + (O.slope <= 0 ? 'shrinking' : 'not shrinking') + ' decade over decade (' + f2(O.slope) + ' a decade, log)' : 'too few decades for a slope') + '; ' + O.n + ' cases'));
  else notRead(line, 'a loss, larger each decade', NOAIMS ? 'every run past the barrier' : 'no backward industry in its own market');
  const m = LAG?.[Object.keys(LAG).find(k => k !== 'stuck' && !/vanilla/.test(k))]?.trade, v = LAG?.vanilla?.trade;   // a reading (laggard_pressure --json, every run)
  if (m && v && fin(m.kept) && fin(v.kept)) row('Backward industries whose better producers are all abroad: change in their workers over ten years', `<b>${sgn(100 * (m.kept - 1))} vs ${sgn(100 * (v.kept - 1))}</b>`, 'smaller than vanilla’s',
    (m.kept - v.kept < -0.05 ? pill('ok', 'pushed out harder') : m.kept - v.kept <= 0.05 ? pill('warn', 'about vanilla’s') : pill('bad', 'held up better')) + note(m.cases + ' cases vs ' + v.cases + ', every run'));
  else notRead('Backward industries whose better producers are all abroad', 'smaller than vanilla’s', 'no laggards.json'); }
if (C.T) { const T = C.T;
  row('Workers on the oldest plants (tier 0), shortlist, manufacturing, 1935 ÷ the 1900s', `<b>${f2(T.ratio0)}</b>`, 'none by 1936, or falling every decade',
    distV(TERMS.T0) + note(T.t36 === 0 ? 'none left in 1936' : fin(T.slope0) ? (T.slope0 <= 0 ? 'falling' : 'rising') + ' (' + f2(T.slope0) + ' a decade, log)' : ''));
  row('Workers on the newest plants (tier 3), share of the shortlist’s tiered workers', `<b>${pc(T.share3)}</b>`, 'the more the better',
    distV(TERMS.T3, 'below') + note('tier 3 ÷ the other tiers ' + f2(T.r3) + '; the distance is zero when tier 3 holds as many workers as the others together')); }
else if (NOAIMS) notRead('Workers on the oldest and the newest plants', 'tier 0 falling; tier 3 the more the better', 'every run past the barrier');
{ const DEC = [1900, 1910, 1920, 1930, 1935].filter(y => EMP[y]);
  const t1 = DEC.map(y => byEra(y)[1] || 0), from = DEC.filter(y => y >= 1920).map(y => byEra(y)[1] || 0);
  const falls = from.length > 1 && from.every((x, i) => i === 0 || x < from[i - 1]);
  row('Workers on tier-1 plants, world, ' + DEC.join(' → ') + ' (millions)', `<b>${t1.map(v => v.toFixed(1)).join(' → ')}</b>`, 'falling from 1920',
    falls ? pill('ok', 'falling') : pill('warn', 'not falling')); }
{ const parts = 'staleArt' in p ? [['craft workshops', p.staleArt], ['factories', p.staleOther]] : [['tier-0 plants', p.stale]];
  const pays = parts.filter(([, v]) => v != null && v < 30);
  row('Years for a tier-0 plant to repay its construction at realised prices: ' + parts.map(([n]) => n).join(' · '),
    `<b>${parts.map(([, v]) => v == null ? 'loss' : v.toFixed(0) + ' y').join(' · ')}</b>`, '30 y or more',
    pays.length ? pill('warn', pays.map(([n]) => n).join(' and ') + ' still pay') : pill('ok', 'none pays')); }
{ const TCR = (TC.rows && TC.rows.length) ? TC.rows[TC.rows.length - 1] : {}; const u = TCR.unit ?? TCR.raw;
  const cls = !fin(u) ? 'warn' : band3(u, 0, 35, 0, 45);
  row('New plants built below the best tier their owner already runs (a craft counts a tenth)', `<b>${fin(u) ? u.toFixed(1) + '%' : '—'}</b>`, 'under 35%',
    pill(cls, !fin(u) ? 'no reading' : u < 35 ? 'mostly the best tier' : u <= 45 ? 'many below the best' : 'old designs still built')); }
// PI and PP (§10.120 point 5): falling decade over decade is required, the 0.8 level provisional; the verdict is the loss's distance
for (const [q, line, goods] of [['PI', 'Prices of building inputs in £, shortlist, 1935', 'steel, tools, engines, fertilizer, explosives, dye, paper'],
  ['PP', 'Prices of consumer goods in wages, shortlist, 1935', 'groceries, clothes, furniture, glass, art, cars, telephones, radios']]) {
  const sl = C[q + 'slope'], every = C[q + 'fallsEvery'];
  row(line + `<br><span class="v">${goods[0].toUpperCase() + goods.slice(1)}.</span>`, `<b>${x2(C[q])}</b>`, 'falling every decade; 0.8× or less',
    distV(TERMS[q], sl > 0 ? 'rising' : C[q] > (CR.priceLevel ?? 0.8) ? 'above' : '') + note(fin(sl) ? (sl <= 0 ? 'falling' : 'rising') + ' on average (' + f2(sl) + ' a decade, log)' + (every ? ', every decade' : ', not every decade') + (VR[q + 'slope'] != null ? '; vanilla ' + f2(VR[q + 'slope']) : '') : ''));
}

// ================================================================ GOAL 3
grp('Does modernising cost capital, and is the capital spent?');
{ const CW = [1880, 1935]; let cr = null;
  if (RD.flats?.[0]?.ptsByYear && RD.vanPtsByYear) { const sum = ser => Object.entries(ser).filter(([y]) => +y >= CW[0] && +y <= CW[1]).reduce((a, [, v]) => a + v, 0);
    const vs = sum(RD.vanPtsByYear); cr = vs > 0 ? med(RD.flats.map(f => sum(f.ptsByYear))) / vs : null; }
  row('Construction delivered, 1880–1935', `<b>${x2(cr)}</b>`, 'at least vanilla’s',
    !fin(cr) ? pill('dim', 'no reading') : cr >= 1 ? pill('ok', 'at least vanilla’s') : cr >= 0.9 ? pill('warn', 'just under') : pill('bad', 'less than vanilla'));
  const fr = p.frontier, b = fr == null ? 'warn' : band3(fr, 8, 15, 6, 20);
  row(`Years for a newest-tier plant (tier ${p.topEra ?? '?'}) to repay its construction at realised prices`, `<b>${fr == null ? 'loss' : fr.toFixed(1) + ' y'}</b>`, '8–15 y',
    pill(b, fr == null ? 'at a loss' : b === 'ok' ? 'at the aim' : fr < 8 ? 'pays back fast' : 'slow to pay back')); }
// ⭐ CAPITAL (§10.123): the count and the hoard above half GDP are aims of the mod's own; pool ÷ GDP against vanilla is a minor reading
{ const who = Object.entries(C.cap?.who || {}).sort((a, b) => b[1] - a[1]).map(([m, n]) => m + (C.runs.length > 1 ? ' ' + n + '/' + C.runs.length : '')).join(', ');
  row('Shortlist countries of at least 2% of world GDP holding an unspent investment pool above half their GDP, 1935–36', `<b>${C.cap ? f1(C.cap.count) : '—'}</b>` + dim('vanilla ' + f1(VR.cap)), 'as few as possible',
    distV(TERMS.cap) + note(who)); }
row('Unspent investment pool above half of GDP, summed over the shortlist’s countries, ÷ the shortlist’s GDP', `<b>${f2(C.excess)}</b>` + dim('vanilla ' + f2(VR.excess)), '0', distV(TERMS.hoard));
row('Unspent investment pool ÷ GDP, world', `<b>${f2(C.worldH_abs)} vs ${f2(R['world.H'])}</b>`, '—', reading());
row('Unspent investment pool ÷ GDP, shortlist', `<b>${f2(C.poolH_abs)} vs ${f2(R['pool.H'])}</b>`, '—', reading());
if (MIS) { const arm = MIS[Object.keys(MIS)[0]], decs = Object.entries(arm.decades || {}).filter(([, v]) => v.n >= arm.runs / 2);
  const last = decs[decs.length - 1], g = decs.map(([, v]) => v.gross);
  // ⚠ MOD ONLY (user, 2026-10-29: "Remove vanilla reference, the metrics are uncomparable"); no ruled band (§10.92: "as low as possible")
  row(`New capital placed far from its best use (payback over 3× the best open option, or a loss), ${last ? last[0] + '–' + String(+last[0] + 10).slice(2) : ''}`,
    `<b>${last ? pc(last[1].gross, 0) : '—'}</b>`, 'as low as possible', pill('dim', 'a reading') + note(g.length > 1 ? (100 * Math.min(...g)).toFixed(0) + '–' + pc(Math.max(...g), 0) + ' by decade' : ''));
} else notRead('New capital placed far from its best use', 'as low as possible', 'no misplaced.json');

// ⭐ AUTO-DOWNSIZING (BALANCE_FRAMEWORK §10.107.6, user-ruled 2026-11-07: two scorecard lines in a group of their own, and one section by
//   tier in each view, fill_downsizing.mjs). No aim is ruled. Vanilla = its runs that carried the downsizing poll (telemetry v15 on).
grp('How much capital does auto-downsizing destroy?', 'An under-staffed building that cannot hire loses a level a week. Levels by tier are in the World and Shortlist views.');
{ const arms = DZ ? Object.values(DZ).filter(a => a.n > 0) : [], m = arms.find(a => a.kind === 'config'), v = arms.find(a => a.kind === 'control');
  const W = (a, i) => a.totals.world.all.mean[i];
  const lines = [['Capital destroyed by auto-downsizing over the century, world, a run (construction points)', 2, x => Math.round(x / 1e3).toLocaleString('en-GB') + 'k'],
    ['Jobs lost to auto-downsizing over the century, world, a run (the jobs those levels offered)', 1, x => (x / 1e6).toFixed(1) + 'M']];
  for (const [line, i, f] of lines)
    if (m && v) row(line, `<b>${f(W(m, i))} vs ${f(W(v, i))}</b>`, 'no aim ruled',
      pill('dim', 'a reading') + note(`×${(W(m, i) / W(v, i)).toFixed(2)} of vanilla; ${m.n} runs against ${v.n}`));
    else notRead(line, 'no aim ruled', !DZ ? 'no downsize.json' : 'an arm carried no downsizing poll'); }

// ================================================================ GOAL 4
grp('Do fewer people find productive work, each producing more?', 'Unemployed and peasants as a share of the workforce, aimed at levels of the mod’s own near history’s, in 1913 and at the end (BALANCE_FRAMEWORK §10.120).');
for (const [who, a, b] of [['the USA', 'uUSA13', 'uUSAE'], ['Britain', 'uGBR13', 'uGBRE'], ['Germany (or Prussia before it)', 'uGER13', 'uGERE'], ['the world', 'uW13', 'uWE']]) {
  const U = C.u || {}, VU = VR.u || {}, aim = CR.uAim || {};
  row(`Unemployed and peasants, share of the workforce, ${who}: 1913 · the end`, `<b>${pc(U[a])} · ${pc(U[b])}</b>` + dim('vanilla ' + pc(VU[a]) + ' · ' + pc(VU[b])),
    `${pc(aim[a]?.[2], 0)} · ${pc(aim[b]?.[2], 0)}`,
    '1913 ' + distV(TERMS[a], side(U[a], aim[a]?.[2])) + '<br>the end ' + distV(TERMS[b], side(U[b], aim[b]?.[2]))); }
row('Unemployed and peasants, share of the workforce, the shortlist together: 1913 · the end', `<b>${pc(C.poolU13_abs)} · ${pc(C.poolU_abs)}</b>` + dim('vanilla ' + pc(VR.poolU13_abs) + ' · ' + pc(VR.poolU_abs)), '—', reading());
row('Productive workers per head, world', `<b>${x2(C.worldW)}</b>`, '—', reading());
row('Productive workers per head, shortlist', `<b>${x2(C.poolW)}</b>`, '—', reading());
row('GDP per productive worker, world', `<b>${x2(ppwR)}</b>`, 'above 1×', fin(ppwR) && ppwR > 1 ? pill('ok', 'more per worker') : pill('warn', 'not above vanilla'));
row('GDP of the shortlist', `<b>${x2(C.gdpP)}</b>`, '—', reading());

// ================================================================ THE ANCHORS
grp('Do the tiers arrive on time?', 'A tier is defined by its anchor year: the technology leader should then hold about half of its technologies.');
{ const arm = TECH && TECH[Object.keys(TECH).find(k => !/vanilla/.test(k))], van = TECH?.vanilla;
  if (arm?.anchors && van?.anchors) {
    const tierOf = era => ({ 3: 1, 4: 2, 5: 3 })[era] ?? era;
    const lab = arm.anchors.map(a => `tier ${tierOf(a.era)} in ${a.year === 'end' ? (a.endYear ?? 'the end') : a.year}`).join(' · ');
    const off = arm.anchors.filter(a => a.leader < 0.35 || a.leader > 0.65);
    row(`Share of a tier’s technologies held by the technology leader at its anchor (${lab})`,
      `<b>${arm.anchors.map(a => Math.round(100 * a.leader)).join(' · ')}%</b><br><span class="dim">vs ${van.anchors.map(a => Math.round(100 * a.leader)).join(' · ')}%</span>`, 'about half',
      off.length ? pill('warn', off.map(a => 'tier ' + tierOf(a.era) + (a.leader < 0.35 ? ' late' : ' early')).join(', ')) : pill('ok', 'on the anchors'));
    const g = arm.majors?.GBR, gv = van.majors?.GBR;
    if (g && gv) { const q = g.held / gv.held;
      row('Technologies held by Britain at the end', `<b>${g.held.toFixed(0)} vs ${gv.held.toFixed(0)}</b>`, 'near vanilla’s',
        (Math.abs(q - 1) <= 0.1 ? pill('ok', 'near') : pill('warn', q < 1 ? 'behind' : 'ahead')) + note('military ' + g.military.toFixed(0) + ' vs ' + gv.military.toFixed(0))); }
  } else notRead('Share of a tier’s technologies held by the technology leader at its anchor', 'about half', 'no tech.json'); }
{ const ANCH = (CFG?.era_anchor_years && CFG.era_anchor_years.length >= NERA) ? CFG.era_anchor_years : [1836, 1875, 1905, 1940].slice(0, NERA);
  const allowed = y => { let cur = 0; ANCH.forEach((a, e) => { if (a <= y) cur = e; }); const s = [cur]; if (cur + 1 < ANCH.length && ANCH[cur + 1] <= y + 5) s.push(cur + 1); return s; };
  const majority = y => { const e = byEra(y), t = e.reduce((a, b) => a + b, 0); const ord = e.map((v, i) => [i, v]).sort((a, b) => b[1] - a[1]); const out = []; let acc = 0;
    for (const [i, v] of ord) { out.push(i); acc += v; if (acc > 0.5 * t) break; } return out; };
  const YS = [1900, 1920, Y].filter(y => EMP[y]);
  const g7 = YS.map(y => { const f = majority(y), a = allowed(y), bad = f.filter(e => !a.includes(e)); return { f, a, ok: !bad.length, late: bad.length && bad.every(e => e < Math.min(...a)) }; });
  const miss = g7.filter(r => !r.ok), cls = !miss.length ? 'ok' : miss.length === 1 ? 'warn' : 'bad';
  const tl = l => [...l].sort((a, b) => a - b).map(e => 't' + e).join('–');
  row('Tiers holding half the tiered workers, ' + YS.join(' · '), `<b>${g7.map(r => tl(r.f)).join(' · ')}</b>`, g7.map(r => tl(r.a)).join(' · '),
    pill(cls, !miss.length ? 'on the anchors' : miss.every(r => r.late) ? 'old tiers linger' : miss.every(r => !r.late) ? 'tiers arrive early' : 'off the anchors')); }

// the card's body: how to read it, then the table (the template wraps both in a scrolling card)
const consWords = C.mode === 'all'
  ? `the median of all ${C.runs.length} runs, those past the barrier included; the register’s own reading takes only the runs not past it, and ${C.intact ? C.intact + (C.intact === 1 ? ' is' : ' are') : 'none is'} not past it here`
  : NOAIMS ? 'every run is past the barrier, so the aims below are not read' : C.note;
writeFileSync(join(DIR, 'scorecard.html'), `<p class="small">Each figure reads this batch’s runs (${consWords}) over ${CR.end[0]}–${String(CR.end[1]).slice(2)} unless the line names a year, `
  + `with the median of ${CR.vanN} vanilla runs beside it; × means this batch ÷ vanilla. Most aims are levels of the mod’s own, so vanilla’s figure is a reference, not the target. `
  + `A verdict is the line’s distance from its aim, measured in the spread the line shows between runs: within one spread, off the aim up to two, far beyond that. `
  + `The shortlist is Britain, the USA, France, the Low Countries and Prussia/Germany.</p>\n`
  + `<table class="score"><thead><tr><th>Line</th><th class="num">This batch / vanilla</th><th>Aim</th><th>Verdict</th></tr></thead><tbody>\n        `
  + rows.join('\n        ') + '\n</tbody></table>');

// ---- the footer's loss line (the config search's objective; out of the table by ruling, 2026-10-29)
{ const NAME = { gdp: 'world GDP', uUSA13: 'U* USA 1913', uUSAE: 'U* USA end', uGBR13: 'U* Britain 1913', uGBRE: 'U* Britain end', uGER13: 'U* Germany 1913', uGERE: 'U* Germany end',
    uW13: 'U* world 1913', uWE: 'U* world end', PI: 'PI', PP: 'PP', cap: 'countries above half GDP', hoard: 'hoard above half GDP', T0: 'T0', T3: 'T3', old: 'old plants' };
  let s;
  if (C.loss) { const parts = Object.entries(C.loss.parts).filter(([, v]) => Math.abs(v) > 0.005).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    const per = RUNS.filter(r => r.loss).map(r => r.loss.L).sort((a, b) => a - b);
    s = `<p class="dim"><b>The criteria register’s loss</b>${C.mode === 'all' ? ' over all ' + C.runs.length + ' runs, those past the barrier included (not the ruled form)' : ''} (the config search’s objective: the weighted distance from every aim in the line’s own spreads; lower is better; directional only, BALANCE_FRAMEWORK §10.83.7; the weights and spreads of §10.123): <b>${f2(C.loss.L)}</b> = ${parts.map(([k, v]) => (NAME[k] || k) + ' ' + f2(v)).join(' + ')}${per.length > 1 ? '; per run ' + f1(per[0]) + '–' + f1(per[per.length - 1]) : ''}.`
      + (C.loss.missing.length ? ` Not read, counted 0: ${C.loss.missing.join(', ')}.` : '') + ` Vanilla reference n=${CR.vanN ?? '?'}, the end the ${CR.end[0]}–${CR.end[1]} mean.</p>`;
  } else s = `<p class="dim">No consensus loss: ${C.divergent ? 'the pair diverges' : 'every run is past the barrier (its highest ten-year mean ' + f2(C.barrier?.worst?.value) + ')'}.</p>`;
  writeFileSync(join(DIR, 'scorecard_loss.html'), s); }

// ---- the two charts above the pages (user, 2026-10-29: "both building-input prices and world GDP run by run go up, before the view selector, and
//      after the wall clock speed")
{ const PY = [1900, 1910, 1920, 1930, 1935];
  const piRuns = RUNS.map(r => r.PIpath).filter(a => Array.isArray(a) && a.length === PY.length);
  const intro = {
    pi: { years: PY, mod: PY.map((_, i) => med(piRuns.map(a => a[i]))), lo: PY.map((_, i) => Math.min(...piRuns.map(a => a[i]).filter(fin))),
      hi: PY.map((_, i) => Math.max(...piRuns.map(a => a[i]).filter(fin))), van: PY.map(y => R['PI.' + y] ?? null), n: piRuns.length, vanN: CR.vanN },
    runs: { gdp: RUNS.map(r => ({ v: r.gdpW, broken: r.broken || null })).filter(o => fin(o.v)), consensus: C.gdpW, aim: CR.gdpAim || [0.9, 1.0],
      van95: CR.gdpVan ? [CR.gdpVan.lo, CR.gdpVan.hi] : null, vanN: CR.vanN, end: CR.end } };
  writeFileSync(join(DIR, 'intro.json'), JSON.stringify(intro)); }
console.log(`scorecard: ${rows.filter(r => !r.includes('class="grp"')).length} lines in ${rows.filter(r => r.includes('class="grp"')).length} groups · past the barrier ${RUNS.filter(r => r.broken).length}/${RUNS.length} · world GDP ${x2(C.gdpW)} · 1886 ${x2(C.line1886?.med)} (${C.line1886?.lo}–${C.line1886?.hi}) · loss ${C.loss ? f2(C.loss.L) : '—'} → ${join(DIR, 'scorecard.html')}, scorecard_loss.html, intro.json`);
