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

// ---- G1 — graded on the LESS-EFFICIENT cut: a level added below the best held rung AND earning less per level than that country's
//   frontier. Building a lower rung that PAYS MORE is the AI following profit, which §10.92 asks for; only the less-efficient kind is the
//   fault. Reference = the four-rung canon family as measured with the same tool: canon4v-hai3 21.4% (F106), canon-je24 21.6 / 21.0% (F107).
//   ⚠ The old pill read "first read" whenever the RAW share was above 39% — solver2f's six-rung figure (F93), a book retired 2026-09-05.
//   The raw and unit-weighted shares are printed for context only: a craft level is a tenth of a factory (unit-weighted) and a cheap craft
//   built beside an e1 rung is often the more profitable choice, so the raw share mixes the two kinds.
const G1REF = 21.6;
const less = TCR.less, unit = TCR.unit ?? TCR.raw;
const g1cls = less == null ? 'warn' : less <= G1REF ? 'ok' : less <= G1REF + 5 ? 'warn' : 'bad';
const gap0 = PB[1900]?.gap, gap1 = p.gap;
// ---- G2 — the register's T0 aim: e0 workers falling decade over decade (soft line: 1935 > 1.3 × the 1900s), and death = no e0 part
//   paying back inside 30 y (the 2+1 standard's obsolescence line, F114). On a craft book the parts are the crafts and the e0 factories.
const DEC = [1900, 1910, 1920, 1930, 1935].filter(y => EMP[y]);
const e0s = DEC.map(e0of);
const falling = e0s.every((v, i) => i === 0 || v < e0s[i - 1]);
const shrinks = e0of(Y) < e0of(1900);
const softT0 = e0of(Y) > 1.3 * e0of(1900);
const parts = 'staleArt' in p ? [['artisans', p.staleArt], ['e0 factories', p.staleOther]] : [['e0', p.stale]];
const stillPays = parts.filter(([, v]) => v != null && v < 30);
const dies = shrinks && !stillPays.length;
const g2pill = softT0 ? 'oldest rung grows (soft breach)' : !shrinks ? 'oldest rung still grows'
  : dies ? (falling ? 'oldest rung dies' : 'oldest rung dies, unevenly')
  : 'shrinks; ' + stillPays.map(([n, v]) => n + ' still pay back in ' + v.toFixed(0) + ' y').join(', ');
const g2cls = softT0 || !shrinks ? 'bad' : dies && falling ? 'ok' : 'warn';
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
// ---- G7 — THE ERA RULE'S ANCHORS (§10.78; anchors 1836 / 1875 / 1905 / 1940, the book's own where given). The largest-employment era
//   at year Y may be the latest era whose anchor has passed, or the next one if its anchor is within 5 years. So 1900 → e1 or e2,
//   1920 → e2, 1935 → e2 or e3. ⚠ The old target "t2 · t3 · t3" was the RETIRED six-rung ladder's (e3 anchored 1900 there); on the four-
//   rung books e3 is anchored at 1940, so "e3 the largest employer in 1920" demanded the 1940 rung 20 years early, and the row was red on
//   every four-rung report. ⚠ The e0 columns of a craft book are summed (the old code compared "e0 artisans" and "e0 other" separately).
const ANCH = (CFG?.era_anchor_years && CFG.era_anchor_years.length >= NERA) ? CFG.era_anchor_years : [1836, 1875, 1905, 1940].slice(0, NERA);
const allowed = y => { let cur = 0; ANCH.forEach((a, e) => { if (a <= y) cur = e; }); const s = [cur]; if (cur + 1 < ANCH.length && ANCH[cur + 1] <= y + 5) s.push(cur + 1); return s; };
const G7Y = [1900, 1920, Y].filter(y => EMP[y]);
const g7 = G7Y.map(y => { const t = topEra(y), a = allowed(y); return { y, t, a, ok: a.includes(t), late: t < Math.min(...a) }; });
const g7miss = g7.filter(r => !r.ok);
const g7cls = !g7miss.length ? 'ok' : g7miss.length === 1 ? 'warn' : 'bad';
const g7pill = !g7miss.length ? 'on the anchors' : g7miss.every(r => r.late) ? 'eras arrive late' : g7miss.every(r => !r.late) ? 'eras arrive early' : 'off the anchors';
const topShare = (() => { const e = byEra(Y), t = e.reduce((a, b) => a + b, 0); return t ? 100 * e[NERA - 1] / t : null; })();

const rows = [
  row('G1', 'A tech edge wins markets',
      'Below-best builds onto a <b>less profitable</b> rung <span class="dim">· all below-best, unit-weighted · leader−p25 stock-era gap 1900→' + Y + '</span>',
      (less == null ? '—' : '<b>' + less.toFixed(1) + '%</b>') + ' <span class="dim">· ' + (unit == null ? '—' : unit.toFixed(1) + '%') + ' · ' + (gap0 == null ? '' : gap0.toFixed(2) + '→') + (gap1 == null ? '—' : gap1.toFixed(2)) + ' era</span>',
      '≤' + G1REF + '% <span class="dim">(canon family) · — · widening</span>',
      less == null ? 'no reading' : less <= G1REF ? 'at or better than the canon' : 'worse than the canon', g1cls),
  row('G2', 'Inefficient producers die',
      'Oldest rung (e0) workers 1900→' + Y + ' <span class="dim">· its payback</span>',
      '<b>' + e0s.map(v => v.toFixed(2)).join('→') + 'M</b>' + (E0.length > 1 ? ' <span class="dim">(' + e0txt(1900) + ' → ' + e0txt(Y) + ')</span>' : '')
        + ' <span class="dim">· ' + parts.map(([n, v]) => (parts.length > 1 ? n + ' ' : '') + (v == null ? 'loss' : v.toFixed(1) + ' y')).join(' · ') + '</span>',
      'falling every decade <span class="dim">· ≥30 y</span>', g2pill, g2cls),
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
      'Largest employment era at ' + G7Y.join(' · ') + ' <span class="dim">· e' + (NERA - 1) + '’s share of tier workers at ' + Y + '</span>',
      g7.map((r, i) => (i === g7.length - 1 ? '<b>e' + r.t + '</b>' : 'e' + r.t)).join(' <span class="dim">·</span> ') + ' <span class="dim">· ' + (topShare == null ? '—' : topShare.toFixed(0) + '%') + '</span>',
      g7.map(r => r.a.map(e => 'e' + e).join('/')).join(' · ') + ' <span class="dim">(anchors ' + ANCH.join(' / ') + ')</span>',
      g7pill, g7cls),
];
writeFileSync(OUTFILE, rows.join('\n    '));
console.log(`goals computed: GDP ${f2(gdpR)} · W ${f2(wR)}${perHead ? '' : ' (absolute)'} · perWorker ${f2(ppwR)} · early ${early.toFixed(2)}x · less-efficient below-best ${less}% · constr ${f2(constrR)} (${constrLab}) · frontier ${fr}y · e0 ${e0s.map(v => v.toFixed(2)).join('>')} · top era ${g7.map(r => 'e' + r.t).join('/')}`);
