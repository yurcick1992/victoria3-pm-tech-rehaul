// THE INPUT-PRICE RED FLAGS, REDUCED TO TWO NUMBERS PER RUN — the report's headline for BALANCE_FRAMEWORK §10.94 (2026-10-08).
// Written because the flag-by-flag listing input_price_flags.mjs --html writes had grown to 1,625 flags (576k characters) on the jex n=16
// report, "at least 100 times too large to be readable" (the user). The listing is kept as redflags_full.html; the page shows these metrics
// and a 3–15-sentence summary written from redflag_metrics.mjs's digest (the redflag-summary skill).
//
//   PROBLEM YEAR       an in-game year Y in which a major market has a HIGH flag running (≥ 1.70 × base for ≥ 2 years) on a good with at
//                      least PROBLEM_DEMAND (10) units a week of BUILDING demand — the same 10 the ruled SWING line uses for supply. The demand
//                      floor drops the phantom HIGHs: a good nobody makes and almost nobody eats (radios on 1–8 units, obsolete clippers on 7)
//                      sits at the 175% band edge for decades and says nothing about a starved industry. A flag covers Y when its readings
//                      [from, to] touch [Y, Y+1).
//   PROBLEM MARKET-YEARS   Σ over the MAJOR markets of their problem years, of markets × years (8 × 100 = 800 for a century run).
//   CHRONIC MARKETS    markets with ≥ CHRONIC_YEARS (20, a fifth of the century) problem years.
// ⚠ The two forms first proposed — "years with a major problem in any market" and "markets with a problem in ≥ 5 of the 99 two-year
//   intervals" — SATURATE on the four-rung books (jex n=16: 96 of 100 years, 8 of 8 markets; 86 and 7 with the demand floor), so they say
//   nothing between books. Both are still computed (`years_any`, `markets_win5`) and kept in the JSON.
// ⚠ BASIS. A flag is a statement about one PRICE SOURCE: the order books (yearly GW lines, every batch since 2026-10-03) or the save
//   summaries (the producers' realised price, supply = production [+ imports from v10]). A good with demand and no producer is priced on the
//   order book (pinned at 175%) and unpriced in the summaries, so the two bases differ several-fold. The pinned vanilla references are read
//   on the summaries alone, so a like-for-like vanilla line uses the book's `prodFlags` (the summary basis, production alone), never its
//   order-book flags.
export const PROBLEM_DEMAND = 10, CHRONIC_YEARS = 20;
export const MAJOR = ['British Market', 'American Market', 'French Market', 'Dutch Market', 'Belgian Market', 'German Market', 'Russian Market', 'Japanese Market'];
export const PERIODS = [[1836, 1869], [1870, 1899], [1900, 1935]];

export const flagYears = (f, y0, y1) => { const s = []; for (let y = y0; y <= y1; y++) if (f.from < y + 1 && f.to >= y - 1e-9) s.push(y); return s; };
export const med = v => { const s = v.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };
const isProblem = f => f.type === 'HIGH' && f.dem >= PROBLEM_DEMAND;

// one run's flags → its metrics. y0..y1 are the in-game years scored (1836..1935 for a century run).
export function runMetrics(flags, y0 = 1836, y1 = 1935) {
  const per = Object.fromEntries(MAJOR.map(m => [m, { P: new Set(), H: new Set(), S: new Set() }]));
  const mg = {};
  for (const f of flags) { const p = per[f.market]; if (!p) continue;
    const ys = flagYears(f, y0, y1);
    for (const y of ys) { (f.type === 'HIGH' ? p.H : p.S).add(y); if (isProblem(f)) p.P.add(y); }
    if (isProblem(f)) { const k = `${f.market.replace(' Market', '')} · ${f.good}`; (mg[k] ||= new Set()); ys.forEach(y => mg[k].add(y)); } }
  const sum = k => MAJOR.reduce((a, m) => a + per[m][k].size, 0);
  const win = set => { let n = 0; for (let y = y0; y < y1; y++) if (set.has(y) || set.has(y + 1)) n++; return n; };
  const count = y => MAJOR.filter(m => per[m].P.has(y)).length;
  const years = []; for (let y = y0; y <= y1; y++) years.push(y);
  return {
    span: [y0, y1], markets: MAJOR.length,
    problem_market_years: sum('P'), high_market_years: sum('H'), swing_market_years: sum('S'),
    chronic_markets: MAJOR.filter(m => per[m].P.size >= CHRONIC_YEARS).length,
    markets_win5: MAJOR.filter(m => win(per[m].P) >= 5).length,
    years_any: years.filter(y => count(y) >= 1).length, years_ge3: years.filter(y => count(y) >= 3).length,
    by_period: PERIODS.map(([a, b]) => MAJOR.reduce((n, m) => n + [...per[m].P].filter(y => y >= a && y <= b).length, 0)),
    by_market: Object.fromEntries(MAJOR.map(m => [m, per[m].P.size])),
    by_market_good: Object.fromEntries(Object.entries(mg).map(([k, s]) => [k, s.size])),
  };
}
// an arm's runs → medians, ranges and the per-run values, on one basis (`which` picks the flag list of a run)
export function armMetrics(runs, which = r => r.flags, y0 = 1836, y1 = 1935) {
  const per = runs.map(r => ({ run: r.run, ...runMetrics(which(r) || [], y0, y1) }));
  const stat = k => { const v = per.map(p => p[k]); return { median: med(v), min: Math.min(...v), max: Math.max(...v), runs: v }; };
  const keys = ['problem_market_years', 'high_market_years', 'swing_market_years', 'chronic_markets', 'markets_win5', 'years_any', 'years_ge3'];
  const mgAll = {}; for (const p of per) for (const [k, v] of Object.entries(p.by_market_good)) (mgAll[k] ||= []).push(v);
  return {
    n: per.length, ...Object.fromEntries(keys.map(k => [k, stat(k)])),
    by_period: PERIODS.map((pp, i) => ({ period: pp, median: med(per.map(p => p.by_period[i])) })),
    by_market: Object.fromEntries(MAJOR.map(m => [m, med(per.map(p => p.by_market[m]))])),
    // a market · good's MEAN problem years per run (absent runs count 0) and the runs it appears in — what the summary is built on
    top: Object.entries(mgAll).map(([k, v]) => ({ k, mean: v.reduce((a, b) => a + b, 0) / per.length, runs: v.length }))
      .sort((a, b) => b.mean - a.mean),
    per_run: per.map(({ by_market_good, ...p }) => p),
  };
}

// the compact text the redflag-summary skill reads in place of the full listing: per market the problem years, then per market · good
// the runs it is flagged in, its share of the problem years, its span, price, supply, demand, producers and the buyers it was starving
export function digest(report, metrics) {
  const L = [], r1 = x => Number.isFinite(x) ? Math.round(x * 10) / 10 : '?';
  const fy = t => { const y = Math.floor(t + 1e-6), m = Math.round((t - y) * 12) + 1; return m > 1 ? `${y}.${m}` : `${y}`; };
  L.push(`# Input-price red flags — digest (${report.ruled})`);
  L.push(`Problem year = a HIGH flag (≥ ${report.thresholds?.HIGH ?? 1.7}× base for ≥ ${report.thresholds?.YEARS ?? 2} y) on ≥ ${PROBLEM_DEMAND} units/wk of building demand, in one of the ${MAJOR.length} major markets.`);
  for (const a of report.arms) {
    const m = metrics.arms.find(x => x.label === a.label);
    L.push('', `## ${a.ref ? '[reference] ' : ''}${a.label} — ${a.runs.length || a.counts_only?.runs || 0} run(s)`);
    if (a.counts_only) { const c = a.counts_only; L.push(`Counts only (no flag spans): ${c.high_per_run} HIGH and ${c.swing_per_run} SWING flags per run on the summaries' basis; on that basis the book reads ${c.book_on_ref_basis?.high_per_run} HIGH and ${c.book_on_ref_basis?.swing_per_run} SWING per run.`); continue; }
    for (const [basis, M] of Object.entries(m?.bases || {})) {
      const t = M.problem_market_years, c = M.chronic_markets;
      L.push(`Basis ${basis}: problem market-years median ${t.median} of ${MAJOR.length * 100} (range ${t.min}–${t.max}); chronic markets (≥ ${CHRONIC_YEARS} y) median ${c.median} (${c.min}–${c.max}); `
        + `by period ${M.by_period.map(p => `${p.period[0]}–${String(p.period[1]).slice(2)} ${p.median}`).join(', ')}; all HIGH market-years ${M.high_market_years.median}; SWING market-years ${M.swing_market_years.median}; `
        + `years with ≥ 3 markets in a problem ${M.years_ge3.median}; the saturating forms: years with any ${M.years_any.median}, markets with ≥ 5 of the two-year windows ${M.markets_win5.median}.`);
      L.push(`Problem years by market (median): ${Object.entries(M.by_market).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k.replace(' Market', '')} ${v}`).join(', ')}.`);
    }
    const flags = a.runs.flatMap(r => (r.flags || []).map(f => ({ ...f, run: r.run })));
    if (!flags.length) continue;
    const groups = {}; for (const f of flags) (groups[`${f.type}|${f.market}|${f.good}`] ||= []).push(f);
    const totalP = m?.bases?.[Object.keys(m.bases)[0]]?.problem_market_years?.runs.reduce((x, y) => x + y, 0) || 1;
    const line = (k, gs) => {
      const [type, market, good] = k.split('|'), runs = new Set(gs.map(f => f.run)).size;
      const pyears = gs.filter(isProblem).reduce((n, f) => n + flagYears(f, 1836, 1935).length, 0);
      const cm = {}; for (const f of gs) for (const c of f.consumers || []) { const o = cm[c.k] ||= { k: c.k, max: 0, n: 0 }; o.max = Math.max(o.max, c.max); o.n++; }
      const buyers = Object.values(cm).sort((x, y) => y.n - x.n || y.max - x.max).slice(0, 3).map(c => `${c.k} ≤ ${c.max} lv (in ${c.n} of ${gs.length} flags)`).join('; ');
      const nobuy = gs.filter(f => !(f.consumers || []).length).length;
      return `- ${type} ${market.replace(' Market', '')} · ${good} (made by ${gs.find(f => f.industry)?.industry || '?'}): ${gs.length} flags in ${runs}/${a.runs.length} runs, ${fy(Math.min(...gs.map(f => f.from)))}–${fy(Math.max(...gs.map(f => f.to)))}`
        + (type === 'HIGH' ? `, ${r1(pyears / a.runs.length)} problem years a run (of the arm's ${r1(totalP / a.runs.length)})` : '')
        + `; price ${Math.min(...gs.map(f => f.lo)).toFixed(2)}–${Math.max(...gs.map(f => f.hi)).toFixed(2)}×; supply med ${r1(med(gs.map(f => f.sup)))}/wk`
        + (gs.some(f => f.imp > 0) ? ` (imported ≥ med ${r1(med(gs.map(f => f.imp ?? 0)))})` : '')
        + `; building demand med ${r1(med(gs.map(f => f.dem)))}/wk; producers med ${r1(med(gs.map(f => f.producers_staffed)))} staffed lv; `
        + (nobuy ? `no buyer in ${nobuy} of ${gs.length}; ` : '') + `buyers: ${buyers || '—'}`;
    };
    const yrsOf = gs => gs.reduce((n, f) => n + flagYears(f, 1836, 1935).length, 0), pOf = gs => yrsOf(gs.filter(isProblem));
    const highs = Object.entries(groups).filter(([k]) => k.startsWith('HIGH')).sort((x, y) => pOf(y[1]) - pOf(x[1]) || yrsOf(y[1]) - yrsOf(x[1]));
    L.push('', '### HIGH, by market · good, most problem years first (the top 20 in full)');
    for (const [k, gs] of highs.slice(0, 20)) L.push(line(k, gs));
    const rest = highs.slice(20);
    if (rest.length) L.push(`- the other ${rest.length} HIGH market · goods, problem years a run (all flagged years a run): `
      + rest.map(([k, gs]) => `${k.split('|')[1].replace(' Market', '')} · ${k.split('|')[2]} ${r1(pOf(gs) / a.runs.length)} (${r1(yrsOf(gs) / a.runs.length)})`).join(', '));
    const swings = Object.entries(groups).filter(([k]) => k.startsWith('SWING')).sort((x, y) => yrsOf(y[1]) - yrsOf(x[1]));
    L.push('', '### SWING, the 10 with most flagged years');
    for (const [k, gs] of swings.slice(0, 10)) L.push(line(k, gs));
  }
  return L.join('\n') + '\n';
}

// the card the report shows: the metrics table, the summary (token __RF_SUMMARY__, filled from redflags_summary.html by fill_assemble), the rule
export function cardHtml(report, metrics, fullName = 'redflags_full.html') {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const book = metrics.arms.find(a => !a.ref), refs = metrics.arms.filter(a => a.ref);
  const pm = MAJOR.length * 100;
  const cell = (s, pct) => s ? `<b>${s.median}</b>${pct ? ` <span class="dim">(${Math.round(100 * s.median / pct)}%)</span>` : ''} <span class="dim">· ${s.min}–${s.max}</span>` : '<span class="dim">—</span>';
  const B = book?.bases || {}, prim = B.market || B.summary, primName = B.market ? 'order books' : 'save summaries';
  const like = B.summary_production, ref = refs[0];
  const refCell = (k, pct) => ref?.bases?.summary ? cell(ref.bases.summary[k], pct)
    : ref?.counts_only && k === 'high_count' ? `<span class="dim">${ref.counts_only.high_per_run} HIGH / run</span>` : '<span class="dim">not read on this basis</span>';
  const rows = [
    ['Problem market-years — a HIGH flag on ≥ ' + PROBLEM_DEMAND + ' units/wk of building demand, of ' + pm + ' (' + MAJOR.length + ' major markets × 100 years)', 'problem_market_years', pm],
    ['Chronic markets — major markets with ≥ ' + CHRONIC_YEARS + ' problem years, of ' + MAJOR.length, 'chronic_markets', 0],
  ];
  let h = `<div class="card" style="border-left:4px solid var(--${prim && prim.problem_market_years.median > 0 ? 'bad' : 'ok'});background:var(--${prim && prim.problem_market_years.median > 0 ? 'badbg' : 'okbg'})">`
    + `<h3 style="margin-top:0">⚑ Input-price red flags — how much of the major markets’ century is spent short of an industrial input</h3>`
    + `<table><tr><th></th><th class="num">${esc(book?.label || 'book')} <span class="dim">· ${primName}, median · range</span></th>`
    + (like ? `<th class="num">${esc(book.label)} <span class="dim">· summaries, production only</span></th><th class="num">${esc(ref?.label || 'vanilla')} <span class="dim">· same basis</span></th>` : '') + '</tr>';
  for (const [lab, k, pct] of rows) h += `<tr><td>${esc(lab)}</td><td class="num">${cell(prim?.[k], pct)}</td>` + (like ? `<td class="num">${cell(like[k], pct)}</td><td class="num">${refCell(k, pct)}</td>` : '') + '</tr>';
  if (prim) {
    h += `<tr><td class="dim">Problem market-years by period</td><td class="num dim" colspan="${like ? 3 : 1}">${prim.by_period.map(p => `${p.period[0]}–${String(p.period[1]).slice(2)}: ${p.median}`).join(' · ')}</td></tr>`;
    h += `<tr><td class="dim">Problem years by market (median)</td><td class="num dim" colspan="${like ? 3 : 1}">${Object.entries(prim.by_market).sort((x, y) => y[1] - x[1]).map(([m, v]) => `${esc(m.replace(' Market', ''))} ${v}`).join(' · ')}</td></tr>`;
  }
  h += '</table>';
  if (!like && ref?.counts_only) h += `<p class="dim">The reference, ${esc(ref.label)}, is read on the save summaries only, where a good with no producer is unpriced: there it throws ${ref.counts_only.high_per_run} HIGH and ${ref.counts_only.swing_per_run} SWING flags a run, against this book’s ${ref.counts_only.book_on_ref_basis?.high_per_run} and ${ref.counts_only.book_on_ref_basis?.swing_per_run} on that basis. Its problem market-years need the flag spans, which this report’s fill did not keep.</p>`;
  h += `__RF_SUMMARY__`;
  const n = (book?.flag_count ?? 0);
  h += `<p class="dim">HIGH = an industrially consumed good at ≥ ${report.thresholds?.HIGH ?? 1.7}× base for ≥ ${report.thresholds?.YEARS ?? 2} years; SWING = a ≥ ${report.thresholds?.SWING ?? 0.5}× base swing within ${report.thresholds?.WINDOW ?? 3} years on under ${report.thresholds?.SUPPLY ?? 10} units a week of supply; local goods excluded — ${esc(report.ruled)}. Not a loss term. A flag covers a year when its readings touch it. The full flag-by-flag listing${n ? ` (${n} flags)` : ''} is kept as <code>${esc(fullName)}</code> beside this report.</p></div>\n`;
  return h;
}
