// THE GOALS TABLE (rows G1-G7), COMPUTED — never hardcoded.
//
// ⚠⚠ THIS FILE USED TO CARRY A PREVIOUS BATCH'S NUMBERS AS LITERAL PROSE. Six of the seven rows had
// their values, targets and verdicts baked in ("0.86x", "0.97x", "59%", "e0 · e0 · e3"); only three
// numbers came from the data. Filling it for a new batch therefore republished the old batch's
// verdict under the new batch's title — the precise failure fill_manifest.json exists to prevent,
// living inside the fill pipeline itself. The canon-6 original is kept beside it as
// fill_goals.mjs.canon6 for reference.
//
// EVERY ROW READS POSITIONALLY: metric A · metric B -> value A · value B -> target A · target B.
// A term with no target carries an explicit em-dash rather than being dropped, because dropping it
// silently re-pairs the remaining values against the wrong targets.
//
// USAGE: node fill_goals.mjs <outFile> <outDir>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const OUTFILE = process.argv[2], DIR = process.argv[3];
// ⭐ --config <book> (2026-10-08): the era anchors G7 grades against are the BOOK's own (`era_anchor_years`); without it the four-rung
//   canon's 1836 / 1875 / 1905 / 1940 are assumed and the row says so.
const CFGP = (() => { const i = process.argv.indexOf('--config'); return i > 0 ? process.argv[i + 1] : null; })();
const CFG = CFGP && existsSync(CFGP) ? JSON.parse(readFileSync(CFGP, 'utf8')) : null;
const J = n => JSON.parse(readFileSync(`${DIR}/${n}`, 'utf8'));
const C = J('consts.json'), PB = J('payback.json'), EMP = J('emp.json'), TC = J('tierchoice.json');
const Y = 1935, p = PB[Y];
const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// ⭐⭐ THE GOAL TABLE WAS REVIEWED AGAINST THE PROJECT'S RULED CRITERIA ON 2026-10-08 (user: "independently check its conditions against
//   high-level goals documented elsewhere"). Every band below names where it comes from; a band that is this file's own proposal says so.
//   Three-level grading everywhere: ok / warn / bad — a near miss is a warn, never a red (user, on G3's 7.6 y against 8–15 y).

// END STATE = the 1932–1936 MEAN, the criteria register's rule (§10.83: a single year sits 7–10% off the mean on GDP).
const END = [1932, 1933, 1934, 1935, 1936];
const meanOf = (ser, f) => { const v = END.map(y => ser[y] != null ? f(ser[y]) : null).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const gdpR = meanOf(C.GDP_FLAT, x => x) / meanOf(C.GDP_VAN, x => x);
// W = productive workers PER HEAD (the register's W) where consts.json carries world population (`p`, since 2026-10-08); older fills
//   carry absolute productive workers only, and the row says which it graded.
const perHead = END.some(y => C.PROD_FLAT[y]?.p && C.PROD_VAN[y]?.p);
const wOf = r => perHead ? (r.p ? r.w / r.p : null) : r.w;
const wR = meanOf(C.PROD_FLAT, wOf) / meanOf(C.PROD_VAN, wOf);
const ppwR = (meanOf(C.PROD_FLAT, r => r.g) / meanOf(C.PROD_FLAT, r => r.w)) / (meanOf(C.PROD_VAN, r => r.g) / meanOf(C.PROD_VAN, r => r.w));
// early game: mean ratio 1837-1860
const early = (() => { let a = 0, b = 0; for (let y = 1837; y <= 1860; y++) { a += C.GDP_FLAT[y] || 0; b += C.GDP_VAN[y] || 0; } return a / b; })();

// G3's construction: points added 1880–1935 (the modernising half-century), the MEDIAN over the arm's runs ÷ vanilla's mean.
//   ⚠ It used to read RD.flat — the FIRST mod run only — and one year (1934→35), so on the jex n=16 it graded one seed's single year.
//   `ptsByYear` / `vanPtsByYear` are report_data.mjs's since 2026-10-08; an older report_data.json falls back to the 1935 point, labelled.
const RD = J('report_data.json');
const CW = [1880, 1935];
let constrR = null, constrLab = '1880–1935';
if (RD.flats?.[0]?.ptsByYear && RD.vanPtsByYear) {
  const sum = ser => Object.entries(ser).filter(([y]) => +y >= CW[0] && +y <= CW[1]).reduce((a, [, v]) => a + v, 0);
  const vs = sum(RD.vanPtsByYear);
  constrR = vs > 0 ? med(RD.flats.map(f => sum(f.ptsByYear))) / vs : null;
} else {
  const cm = med((RD.flats || [RD.flat]).map(f => f?.years?.[Y]?.ptsAdd)), cv = RD.vanMean?.[Y]?.ptsAdd;
  constrR = cm && cv ? cm / cv : null; constrLab = 'the year to 1935 only';
}

// ⭐ THE EMPLOYMENT COLUMNS ARE LABELLED (emp_cols.json, lib_era_cols.mjs, 2026-10-02): on a craft book e0 is TWO columns, artisans
//   and other, so a column INDEX is no longer an era. Every reader keys on the ERA a label names; e0 is the SUM of its parts.
const COLS = existsSync(`${DIR}/emp_cols.json`) ? J('emp_cols.json') : ['e0', 'e1', 'e2', 'e3', 'e4', 'e5'];
const eraOfCol = l => +(/^[et](\d+)/.exec(l)?.[1] ?? NaN);
const NERA = Math.max(...COLS.map(eraOfCol).filter(Number.isFinite)) + 1;
const byEra = y => { const o = Array(NERA).fill(0); COLS.forEach((l, i) => { const e = eraOfCol(l); if (Number.isFinite(e)) o[e] += +(EMP[y] || [])[i] || 0; }); return o; };
const E0 = COLS.map((l, i) => l.startsWith('e0') ? i : -1).filter(i => i >= 0);
const e0of = y => byEra(y)[0];
const e0txt = y => E0.length > 1 ? E0.map(i => COLS[i].replace('e0 ', '') + ' ' + (+(EMP[y] || [])[i] || 0).toFixed(2)).join(' + ') : '';
const topEra = y => { const e = byEra(y); let bi = 0; e.forEach((v, i) => { if (v > e[bi]) bi = i; }); return bi; };

// ⚠ THE ARM'S ROW IS THE LAST ONE. fill_tierchoice pushes every --baseline row FIRST and the arm's row last.
const TCR = (TC.rows && TC.rows.length) ? TC.rows[TC.rows.length - 1] : {};
const f2 = x => x == null || !isFinite(x) ? '—' : x.toFixed(2) + '×';
const row = (id, goal, metric, val, target, pill, cls) =>
  `<tr><td>${id}</td><td class="goalcell">${goal}</td><td>${metric}</td><td class="num">${val}</td><td class="num dim">${target}</td><td><span class="pill ${cls}">${pill}</span></td></tr>`;
const band3 = (x, okLo, okHi, wLo, wHi) => x == null ? 'warn' : (x >= okLo && x <= okHi) ? 'ok' : (x >= wLo && x <= wHi) ? 'warn' : 'bad';

// ---- G1 — graded on the BELOW-BEST share itself (user-ruled 2026-10-08: "the whole mod intends to make obsolete rungs less
//   profitable and thus dying out, and the point measures that. If AI builds below-last but it is best on profits, this is still a
//   failure by G1 standards"). So a below-best level is a fault whether or not it out-earns the frontier; the less-efficient cut is not
//   a G1 reading. Graded on the UNIT-weighted share (a craft level is a tenth of a factory, its workforce_mult), raw printed beside it.
//   Bands: the four-rung canon family as measured with the same tool runs 34.9–40.2% (F106, F107, F109, the C 1.9 sweep) — below 35%
//   is better than any canon measured (ok), up to 45% warn, above it bad. ⚠ "First read" (until 2026-10-08) meant "above 39%",
//   solver2f's six-rung figure (F93), a book retired 2026-09-05.
const unit = TCR.unit ?? TCR.raw, raw = TCR.raw;
const g1cls = unit == null ? 'warn' : band3(unit, 0, 35, 0, 45);
const g1pill = unit == null ? 'no reading' : unit < 35 ? 'better than the canon family' : unit <= 40.2 ? 'at the canon family' : unit <= 45 ? 'worse than the canon family' : 'old rungs still built';
const gap0 = PB[1900]?.gap, gap1 = p.gap;
// ---- G2 — the OLD RUNGS, e0 AND e1 (user-ruled 2026-10-08: "G2 should probably track t1 too"). e0: the register's T0 aim, falling every
//   decade from 1900 (soft breach when 1935 > 1.3 × 1900); dead = every e0 part pays back in ≥ 30 y (artisans and e0 factories apart on a
//   craft book). e1: falling every decade from 1920 — e1 is the rung two below e3, and a rung is meant to die once its N+2 floods the
//   market; e3's technologies open from about 1920 on the way to their 1940 anchor, so e1 may still grow before that.
const DEC = [1900, 1910, 1920, 1930, 1935].filter(y => EMP[y]);
const fallsFrom = (era, y0) => { const v = DEC.filter(y => y >= y0).map(y => byEra(y)[era]); return v.length > 1 && v.every((x, i) => i === 0 || x < v[i - 1]); };
const e0s = DEC.map(e0of), e1s = DEC.map(y => byEra(y)[1] || 0);
const e0fall = fallsFrom(0, 1900), e1fall = NERA > 1 ? fallsFrom(1, 1920) : true;
const shrinks = e0of(Y) < e0of(1900);
const softT0 = e0of(Y) > 1.3 * e0of(1900);
const parts = 'staleArt' in p ? [['artisans', p.staleArt], ['e0 factories', p.staleOther]] : [['e0', p.stale]];
const stillPays = parts.filter(([, v]) => v != null && v < 30);
const g2bits = [];
if (softT0) g2bits.push('e0 grows (soft breach)'); else if (!shrinks) g2bits.push('e0 still grows'); else if (!e0fall) g2bits.push('e0 falls unevenly');
if (shrinks && stillPays.length) g2bits.push(stillPays.map(([n, v]) => n + ' pay back in ' + v.toFixed(0) + ' y').join(', '));
if (!e1fall) g2bits.push('e1 not falling since 1920');
const g2cls = softT0 || !shrinks ? 'bad' : g2bits.length ? 'warn' : 'ok';
const g2pill = g2bits.length ? g2bits.join('; ') : 'old rungs die';
// ---- G3 — capital demand: construction at or above vanilla's (warn 0.9–1, bad under 0.9), and the frontier rung's payback 8–15 y at
//   £720 a point (vanilla's realised manufacturing payback, F53: 21 y in 1838 → 8.2 y in 1900; the band floor is vanilla's own late
//   figure), warn 6–8 or 15–20 y, bad outside. ⚠ £720 is the iron-frame rate held flat (§10.61): with steel/arc frames a late building
//   really costs £527–540 a point, so the real late payback is ~25% SHORTER than printed.
const fr = p.frontier;
const prBand = fr == null ? 'warn' : band3(fr, 8, 15, 6, 20);
const coBand = constrR == null ? 'warn' : constrR >= 1 ? 'ok' : constrR >= 0.9 ? 'warn' : 'bad';
const g3cls = [prBand, coBand].includes('bad') ? 'bad' : [prBand, coBand].includes('warn') ? 'warn' : 'ok';
const g3pill = fr == null ? 'frontier at a loss' : coBand === 'bad' ? 'less capital than vanilla'
  : fr < 6 ? 'capital too cheap' : fr < 8 ? 'frontier pays back fast' : fr > 20 ? 'frontier too dear' : fr > 15 ? 'frontier slow to pay back'
  : coBand === 'warn' ? 'construction just under vanilla' : 'met';
// ---- G4 — the register's world GDP (end-state mean, displayed GDP): the 0.80–1.20 band in which U* and H read normally, the WEAKENED
//   band out to the derived hard floor/ceiling (~0.66 / ~1.38 at n=16), beyond it broken (§10.83, §10.83.8). Ruled bands, not this file's.
const g4cls = band3(gdpR, 0.8, 1.2, 0.66, 1.38);
const g4pill = g4cls === 'ok' ? 'met' : g4cls === 'warn' ? (gdpR < 1 ? 'low (weakened readings)' : 'high (weakened readings)') : (gdpR < 1 ? 'stall territory' : 'runoff territory');
// ---- G5 — the register's world W aim 0.6–0.95, soft above 1.0 (a W under the aim is a stall's signature, a warn); product per worker
//   must exceed vanilla's — it is the goal's "more product per worker", and with GDP near 1 it follows from W.
const g5w = wR == null ? 'warn' : wR > 1.0 ? 'bad' : (wR >= 0.6 && wR <= 0.95) ? 'ok' : 'warn';
const g5cls = g5w === 'bad' ? 'bad' : (g5w === 'warn' || !(ppwR > 1)) ? 'warn' : 'ok';
const g5pill = wR > 1.0 ? 'more workers than vanilla (soft breach)' : wR < 0.6 ? 'very few workers (stall?)' : wR > 0.95 ? 'workers barely below vanilla'
  : !(ppwR > 1) ? 'productivity not above vanilla' : 'met';
// ---- G6 — the opening quarter-century's world GDP. ⚠ This file's band, not a ruling: 0.9–1.1 ok, 0.8–1.2 warn. The register's HARD
//   anchor (1836–1845, per run, against vanilla's seed interval ± 10%) is criteria.mjs's job and is not graded here.
const g6cls = band3(early, 0.9, 1.1, 0.8, 1.2);
// ---- G7 — THE ERA RULE'S ANCHORS (§10.78; anchors 1836 / 1875 / 1905 / 1940, the book's own where given). Fact and target in ONE
//   format (user-ruled 2026-10-08): "if any era is over 50%, only it is listed; otherwise all are listed through slash until 50% of tiered
//   employment is reached" — eras by descending share of tiered workers (e0 parts summed). The target at year Y is the latest era whose
//   anchor has passed, plus the next one if its anchor is within 5 years: e1/e2 at 1900, e2 at 1920, e2/e3 at 1935. Met when every era
//   in the fact is in the target. ⚠ The old target "t2 · t3 · t3" was the retired six-rung ladder's.
const ANCH = (CFG?.era_anchor_years && CFG.era_anchor_years.length >= NERA) ? CFG.era_anchor_years : [1836, 1875, 1905, 1940].slice(0, NERA);
const allowed = y => { let cur = 0; ANCH.forEach((a, e) => { if (a <= y) cur = e; }); const s = [cur]; if (cur + 1 < ANCH.length && ANCH[cur + 1] <= y + 5) s.push(cur + 1); return s; };
const majority = y => { const e = byEra(y), t = e.reduce((a, b) => a + b, 0); const ord = e.map((v, i) => [i, v]).sort((a, b) => b[1] - a[1]); const out = []; let acc = 0;
  for (const [i, v] of ord) { out.push(i); acc += v; if (acc > 0.5 * t) break; } return out; };
const G7Y = [1900, 1920, Y].filter(y => EMP[y]);
const g7 = G7Y.map(y => { const f = majority(y), a = allowed(y), bad = f.filter(e => !a.includes(e)); return { y, f, a, ok: !bad.length, late: bad.length && bad.every(e => e < Math.min(...a)) }; });
const g7miss = g7.filter(r => !r.ok);
const g7cls = !g7miss.length ? 'ok' : g7miss.length === 1 ? 'warn' : 'bad';
const g7pill = !g7miss.length ? 'on the anchors' : g7miss.every(r => r.late) ? 'old eras linger' : g7miss.every(r => !r.late) ? 'eras arrive early' : 'off the anchors';
const eraList = l => l.map(e => 'e' + e).join('/');
const rows = [
  row('G1', 'A tech edge wins markets',
      'Levels built below the best held rung, unit-weighted <span class="dim">· raw · leader−p25 era gap</span>',
      (unit == null ? '—' : '<b>' + unit.toFixed(1) + '%</b>') + ' <span class="dim">· ' + (raw == null ? '—' : raw.toFixed(1) + '%') + ' · ' + (gap0 == null ? '' : gap0.toFixed(2) + '→') + (gap1 == null ? '—' : gap1.toFixed(2)) + '</span>',
      '&lt;35% <span class="dim">(canon 35–40) · — · widening</span>', g1pill, g1cls),
  row('G2', 'Inefficient producers die',
      'e0 workers, M, ' + DEC.join('/') + ' <span class="dim">· e1 workers · e0 payback</span>',
      '<b>' + e0s.map(v => v.toFixed(1)).join('→') + '</b> <span class="dim">· ' + e1s.map(v => v.toFixed(1)).join('→') + ' · '
        + parts.map(([n, v]) => (parts.length > 1 ? n.replace('e0 ', '') + ' ' : '') + (v == null ? 'loss' : v.toFixed(0) + ' y')).join(', ') + '</span>',
      '↓ from 1900 <span class="dim">· ↓ from 1920 · ≥30 y</span>', g2pill, g2cls),
  row('G3', 'Modernising costs capital',
      'Construction ÷ vanilla, ' + constrLab + ' <span class="dim">· frontier-rung (e' + (p.topEra ?? '?') + ') payback at £720/pt</span>',
      f2(constrR) + ' <span class="dim">· <b>' + (fr == null ? 'loss' : fr.toFixed(1) + ' y') + '</b></span>', '≥1× <span class="dim">· 8–15 y (warn 6–8, 15–20)</span>',
      g3pill, g3cls),
  row('G4', 'GDP stays on vanilla’s path', 'World GDP ÷ vanilla, 1932–36 mean',
      '<b>' + gdpR.toFixed(2) + '×</b>', '0.80–1.20× <span class="dim">(weakened to 0.66 / 1.38)</span>', g4pill, g4cls),
  row('G5', 'Fewer workers, more product per worker',
      'Productive workers' + (perHead ? ' per head' : ' (absolute)') + ' ÷ van <span class="dim">· GDP per worker ÷ van, 1932–36</span>',
      '<b>' + f2(wR) + '</b> <span class="dim">· <b>' + f2(ppwR) + '</b></span>',
      '0.6–0.95× <span class="dim">· &gt;1×</span>', g5pill, g5cls),
  row('G6', 'Early game still grows', '1837–1860 world GDP ÷ vanilla', early.toFixed(2) + '×', '0.9–1.1× <span class="dim">(warn 0.8–1.2)</span>',
      g6cls === 'ok' ? 'met' : early < 1 ? 'slow start' : 'fast start', g6cls),
  row('G7', 'Eras arrive on the anchors',
      'Eras holding half the tier workers, ' + G7Y.join(' · '),
      g7.map(r => (r.ok ? '' : '<b>') + eraList(r.f) + (r.ok ? '' : '</b>')).join(' · '),
      g7.map(r => eraList(r.a)).join(' · '), g7pill, g7cls),
];
writeFileSync(OUTFILE, rows.join('\n    '));
console.log(`goals computed: GDP ${f2(gdpR)} · W ${f2(wR)}${perHead ? '' : ' (absolute)'} · perWorker ${f2(ppwR)} · early ${early.toFixed(2)}x · below-best ${unit}% unit / ${raw}% raw · constr ${f2(constrR)} (${constrLab}) · frontier ${fr}y · e0 ${e0s.map(v => v.toFixed(2)).join('>')} · majority ${g7.map(r => eraList(r.f)).join(' · ')}`);
