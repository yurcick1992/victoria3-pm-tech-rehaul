// THE REPORT'S SCORECARD — ONE TABLE (user, 2026-10-29: "incorporate all readings up until the dedicated performance block into what is now the
// register table … Leave only the following columns: Line (should describe the scope in prose); this batch / vanilla, one metric (may be absolute,
// may be ratio, what fits the line best); aim; verdict"). It replaces fill_register.mjs (the criteria register, §10.104) and fill_goals.mjs (the
// readings G1–G7) and takes in what the lede used to carry in prose: play time, the input-price red flags, the laggard test, misplaced capital and
// the technology census. Rows are grouped under the question they answer, in the order of the mod's goals (CLAUDE.md §1.1). The register's loss
// leaves the table for the footer (user, 2026-10-29: the one cut of the proposal that was accepted).
// ⚠ It grades nothing the register grades: every register line's verdict is criteria.mjs's own bands (§10.83, restated here and moving with it;
//   the 1886 line's and the world-GDP aim's come from criteria.json). The readings keep the bands fill_goals.mjs carried (§10.104: "a reading
//   keeps its current band"); the four lines added on 2026-10-29 carry no ruled band and say so (laggards, misplaced capital, red flags, technology).
// Reads <outDir>: criteria.json, consts.json, payback.json, emp.json, emp_cols.json, tierchoice.json, report_data.json, perf_panel.json,
//   redflags_metrics.json, laggards.json, tech.json, misplaced.json. A missing optional source prints its line as "not read".
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
if (!CR.arms || CR.arms.length !== 1) { console.error('fill_scorecard: expected ONE arm in criteria.json, found ' + (CR.arms || []).length); process.exit(1); }
const A = CR.arms[0], C = A.consensus, R = CR.ref, RUNS = A.runs;
const CON = J('consts.json'), PB = J('payback.json'), EMP = J('emp.json'), TC = J('tierchoice.json'), RD = J('report_data.json');
const PERF = JO('perf_panel.json'), RF = JO('redflags_metrics.json'), LAG = JO('laggards.json'), TECH = JO('tech.json'), MIS = JO('misplaced.json');

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
const rows = [];
const grp = (q, sub) => rows.push(`<tr class="grp"><td colspan="4">${q}${sub ? `<span>${sub}</span>` : ''}</td></tr>`);
const row = (line, val, aim, verdict) => rows.push(`<tr><td>${line}</td><td class="num">${val}</td><td>${aim}</td><td>${verdict}</td></tr>`);
const notRead = (line, aim, why) => row(line, '<span class="dim">not read</span>', aim, `<span class="v">${why}</span>`);
// the register's verdict words (criteria.mjs): at the aim · inside, off the aim · beyond the soft line
const regV = (v, lo, hi, soft) => { const x = r2(v); if (!fin(x)) return pill('dim', 'no reading');
  if (soft && soft(x)) return pill('bad', 'beyond the soft line'); if (x >= lo && x <= hi) return pill('ok', 'at the aim');
  return pill('warn', x < lo ? 'below the aim' : 'above the aim'); };
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
grp('Are the runs sound?');
{ const nB = RUNS.filter(r => r.broken).length;
  row('Runs whose economy broke (stalled or ran away)', `<b>${nB} of ${RUNS.length}</b>`, 'none',
    nB ? pill('bad', nB + ' broken') + note(RUNS.filter(r => r.broken).map(r => r.rel.split('/').pop() + ' by ' + r.broken).join(', ')) : pill('ok', 'all intact')); }
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
    regV(C.gdpW, aim[0], aim[1], x => x < 0.75 || x > 1.33) + note(g.length > 1 ? 'runs ' + Math.min(...g).toFixed(2) + '–' + Math.max(...g).toFixed(2) : ''));
  const L = C.line1886 || {};
  row('World GDP in 1886, the depth of the expected mid-century dip', `<b>${x2(L.med)}</b>`, fin(L.lo) ? `${L.lo.toFixed(2)}–${L.hi.toFixed(2)}×` : '—',
    fin(L.med) ? (L.beyond ? pill('bad', 'outside the line') : pill('ok', 'inside')) : pill('dim', 'no reading')); }

// ================================================================ GOALS 1 AND 2
grp('Does a technological edge win markets, and do efficient producers push out the rest?');
{ const lagRow = (cls, line) => {
    const m = LAG?.[Object.keys(LAG).find(k => k !== 'stuck' && !/vanilla/.test(k))]?.[cls], v = LAG?.vanilla?.[cls];
    if (!m || !v || !fin(m.kept) || !fin(v.kept)) return notRead(line, 'a fall, below vanilla’s', 'no laggards.json');
    const d = m.kept - v.kept;   // the canon's ten-year change against vanilla's, in points
    row(line, `<b>${sgn(100 * (m.kept - 1))} vs ${sgn(100 * (v.kept - 1))}</b>`, 'smaller than vanilla’s',
      (d < -0.05 ? pill('ok', 'pushed out harder') : d <= 0.05 ? pill('warn', 'about vanilla’s') : pill('bad', 'held up better')) + note(m.cases + ' cases vs ' + v.cases));
  };
  // (reworded twice on 2026-10-29: the user found "ten-year change in the workers of an industry two tiers behind …" unreadable)
  lagRow('inm', 'Backward industries with a far better producer in the same market: change in their workers over ten years'
    + '<br><span class="v">Backward: a country’s industry two tiers behind the best producer, without the technology to upgrade yet.</span>');
  lagRow('trade', 'Backward industries whose better producers are all abroad: change in their workers over ten years'); }
if (C.T) { const T = C.T;
  row('Workers on the oldest plants (tier 0), shortlist, 1935 ÷ the 1900s', `<b>${f2(T.ratio0)}</b>`, 'falling every decade',
    r2(T.ratio0) > 1.3 ? pill('bad', 'beyond the soft line') : (T.t36 === 0 || T.declining) ? pill('ok', 'falling') : pill('warn', 'not yet falling'));
  row('Workers on the newest plants (tier 3), share of the shortlist’s tiered workers', `<b>${pc(T.share3)}</b>`, 'the more the better', pill('dim', 'a reading')); }
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
row('Prices of building inputs (steel, tools, engines, fertilizer, explosives, dye, paper) in £, shortlist', `<b>${x2(C.PI)}</b>`, '0.8× or less, falling every decade',
  regV(C.PI, -Infinity, 0.8, x => x > 1.0) + note(C.PIfalling ? 'falling every decade' : 'not falling every decade'));
row('Prices of consumer goods (groceries, clothes, furniture, glass, art, cars, telephones, radios) in wages, shortlist', `<b>${x2(C.PP)}</b>`, '0.8× or less',
  regV(C.PP, -Infinity, 0.8, x => x > 1.1));

// ================================================================ GOAL 3
grp('Does modernising cost capital?');
{ const CW = [1880, 1935]; let cr = null;
  if (RD.flats?.[0]?.ptsByYear && RD.vanPtsByYear) { const sum = ser => Object.entries(ser).filter(([y]) => +y >= CW[0] && +y <= CW[1]).reduce((a, [, v]) => a + v, 0);
    const vs = sum(RD.vanPtsByYear); cr = vs > 0 ? med(RD.flats.map(f => sum(f.ptsByYear))) / vs : null; }
  row('Construction delivered, 1880–1935', `<b>${x2(cr)}</b>`, 'at least vanilla’s',
    !fin(cr) ? pill('dim', 'no reading') : cr >= 1 ? pill('ok', 'at least vanilla’s') : cr >= 0.9 ? pill('warn', 'just under') : pill('bad', 'less than vanilla'));
  const fr = p.frontier, b = fr == null ? 'warn' : band3(fr, 8, 15, 6, 20);
  row(`Years for a newest-tier plant (tier ${p.topEra ?? '?'}) to repay its construction at realised prices`, `<b>${fr == null ? 'loss' : fr.toFixed(1) + ' y'}</b>`, '8–15 y',
    pill(b, fr == null ? 'at a loss' : b === 'ok' ? 'at the aim' : fr < 8 ? 'pays back fast' : 'slow to pay back')); }
// ⭐ CAPITAL ABUNDANCE, world → shortlist → Germany (user, 2026-10-29: "write 'Capital abundance. Unspent investment pool / GDP'. Have three rows
//   in a row: world, shortlist, GER, and only then new capital far from best use"; split rows always run world → shortlist → countries). Germany's
//   line is its own pool ÷ GDP over the end window (criteria.mjs gerH, the member GER / NGF / PRU); the register's closed-major term (gerCM,
//   §10.100) stays in the loss, and its full-employment half is the line's note.
row('Capital abundance. Unspent investment pool ÷ GDP, world', `<b>${f2(C.worldH_abs)} vs ${f2(R['world.H'])}</b>`, 'below vanilla’s', regV(C.worldH, -Infinity, 1.0));
row('Capital abundance. Unspent investment pool ÷ GDP, shortlist', `<b>${f2(C.poolH_abs)} vs ${f2(R['pool.H'])}</b>`, 'below vanilla’s', regV(C.poolH, -Infinity, 1.0));
if (fin(C.gerH_abs) && fin(R['ger.H'])) { const G = C.gerCM;
  row('Capital abundance. Unspent investment pool ÷ GDP, Germany', `<b>${f2(C.gerH_abs)} vs ${f2(R['ger.H'])}</b>`, 'below vanilla’s',
    regV(C.gerH, -Infinity, 1.0) + note(G && G.fe >= 0.1 ? 'fully employed in its better runs' : ''));
} else notRead('Capital abundance. Unspent investment pool ÷ GDP, Germany', 'below vanilla’s', 'criteria.json carries no gerH (rerun criteria.mjs)');
if (MIS) { const arm = MIS[Object.keys(MIS)[0]], decs = Object.entries(arm.decades || {}).filter(([, v]) => v.n >= arm.runs / 2);
  const last = decs[decs.length - 1], g = decs.map(([, v]) => v.gross);
  // ⚠ MOD ONLY (user, 2026-10-29: "Remove vanilla reference, the metrics are uncomparable"); no ruled band (§10.92: "as low as possible")
  row(`New capital placed far from its best use (payback over 3× the best open option, or a loss), ${last ? last[0] + '–' + String(+last[0] + 10).slice(2) : ''}`,
    `<b>${last ? pc(last[1].gross, 0) : '—'}</b>`, 'as low as possible', pill('dim', 'a reading') + note(g.length > 1 ? (100 * Math.min(...g)).toFixed(0) + '–' + pc(Math.max(...g), 0) + ' by decade' : ''));
} else notRead('New capital placed far from its best use', 'as low as possible', 'no misplaced.json');

// ================================================================ GOAL 4
grp('Do fewer people find productive work, each producing more?');
row('Productive workers per head, world', `<b>${x2(C.worldW)}</b>`, '0.60–0.95×', regV(C.worldW, 0.6, 0.95, x => x > 1.0));
row('Productive workers per head, shortlist', `<b>${x2(C.poolW)}</b>`, '0.60–0.95×', regV(C.poolW, 0.6, 0.95, x => x > 1.0));
row('Unemployed and peasants, share of the workforce, world', `<b>${pc(C.worldU_abs)} vs ${pc(R['world.U'])}</b>`, 'above vanilla’s',
  r2(C.worldU) < 1.0 ? pill('bad', 'beyond the soft line') : pill('dim', 'no aim'));
row('Unemployed and peasants, share of the workforce, shortlist', `<b>${pc(C.poolU_abs)} vs ${pc(R['pool.U'])}</b>`, `twice vanilla’s (${pc(2 * R['pool.U'])}) or more`,
  regV(C.poolU, 2.0, Infinity, x => x < 1.0));
row('GDP per productive worker, world', `<b>${x2(ppwR)}</b>`, 'above 1×', fin(ppwR) && ppwR > 1 ? pill('ok', 'more per worker') : pill('warn', 'not above vanilla'));
row('GDP of the shortlist', `<b>${x2(C.gdpP)}</b>`, '1.1–1.9×', regV(C.gdpP, 1.10, 1.90, x => x < 0.95 || x > 2.0));

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
writeFileSync(join(DIR, 'scorecard.html'), `<p class="small">Each figure reads this batch’s runs (${C.note}) over ${CR.end[0]}–${String(CR.end[1]).slice(2)} unless the line names a year, `
  + `against the median of ${CR.vanN} vanilla runs; × means this batch ÷ vanilla. The shortlist is Britain, the USA, France, the Low Countries and Prussia/Germany, read as one economy.</p>\n`
  + `<table class="score"><thead><tr><th>Line</th><th class="num">This batch / vanilla</th><th>Aim</th><th>Verdict</th></tr></thead><tbody>\n        `
  + rows.join('\n        ') + '\n</tbody></table>');

// ---- the footer's loss line (the config search's objective; out of the table by ruling, 2026-10-29)
{ let s;
  if (C.loss) { const parts = Object.entries(C.loss.parts).filter(([, v]) => Math.abs(v) > 0.005).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    const per = RUNS.filter(r => r.loss).map(r => r.loss.L).sort((a, b) => a - b);
    s = `<p class="dim"><b>The criteria register’s loss</b> (the config search’s objective: the weighted distance from every aim, steeper past a soft line; lower is better; directional only, BALANCE_FRAMEWORK §10.83.7): <b>${f2(C.loss.L)}</b> = ${parts.map(([k, v]) => k + ' ' + f2(v)).join(' + ')}; per run ${f1(per[0])}–${f1(per[per.length - 1])}.`
      + (C.loss.soft.length ? ` Not final: beyond a soft line on ${C.loss.soft.join(', ')}.` : '') + ` Vanilla reference n=${CR.vanN ?? '?'}, the end state the ${CR.end[0]}–${CR.end[1]} mean.</p>`;
  } else s = `<p class="dim">No consensus loss: ${C.divergent ? 'the pair diverges' : 'no intact run'}.</p>`;
  writeFileSync(join(DIR, 'scorecard_loss.html'), s); }

// ---- the two charts above the pages (user, 2026-10-29: "both building-input prices and world GDP run by run go up, before the view selector, and
//      after the wall clock speed")
{ const PY = [1900, 1910, 1920, 1930, 1935];
  const piRuns = RUNS.map(r => r.PIpath).filter(a => Array.isArray(a) && a.length === PY.length);
  const intro = {
    pi: { years: PY, mod: PY.map((_, i) => med(piRuns.map(a => a[i]))), lo: PY.map((_, i) => Math.min(...piRuns.map(a => a[i]).filter(fin))),
      hi: PY.map((_, i) => Math.max(...piRuns.map(a => a[i]).filter(fin))), van: PY.map(y => R['PI.' + y] ?? null), n: piRuns.length, vanN: CR.vanN },
    runs: { gdp: RUNS.map(r => ({ v: r.gdpW, broken: r.broken || null })).filter(o => fin(o.v)), consensus: C.gdpW, aim: CR.gdpAim || [0.9, 1.0], soft: [0.75, 1.33],
      hard: CR.gdpHard ? [CR.gdpHard.lo, CR.gdpHard.hi] : null, van95: CR.gdpHard ? [CR.gdpHard.lo / 0.8, CR.gdpHard.hi / 1.2] : null, vanN: CR.vanN, end: CR.end } };
  writeFileSync(join(DIR, 'intro.json'), JSON.stringify(intro)); }
console.log(`scorecard: ${rows.filter(r => !r.includes('class="grp"')).length} lines in ${rows.filter(r => r.includes('class="grp"')).length} groups · world GDP ${x2(C.gdpW)} · 1886 ${x2(C.line1886?.med)} (${C.line1886?.lo}–${C.line1886?.hi}) · loss ${C.loss ? f2(C.loss.L) : '—'} → ${join(DIR, 'scorecard.html')}, scorecard_loss.html, intro.json`);
