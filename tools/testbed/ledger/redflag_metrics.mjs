// THE RED FLAGS' HEADLINE AND DIGEST — reads input_price_flags.mjs --json (redflags.json) and writes, into the report's out dir:
//   redflags_metrics.json  problem market-years and chronic markets per arm and basis, with every run's values (lib_redflag_metrics.mjs)
//   redflags_digest.md     the compact per market · good digest the redflag-summary skill writes its 3–15 sentences from
//   redflags_card.html     the report's card: the metrics table, the token __RF_SUMMARY__ (filled by fill_assemble from redflags_summary.html,
//                          the skill's output) and the rule line. The flag-by-flag listing stays in redflags_full.html, off the page.
// User-ruled 2026-10-08: the listing "is at least 100 times too large to be readable" — show the metrics and a summary only.
//
//   node tools/testbed/ledger/redflag_metrics.mjs <outDir> [--json <redflags.json>] [--span 1836-1935] [--full redflags_full.html]
import fs from 'node:fs'; import path from 'node:path';
import { armMetrics, digest, cardHtml } from './lib_redflag_metrics.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : d; };
const JSON_IN = opt('--json', ''), SPAN = opt('--span', '1836-1935'), FULL = opt('--full', 'redflags_full.html');
const DIR = argv[0]; if (!DIR) { console.error('usage: redflag_metrics.mjs <outDir> [--json <redflags.json>] [--span 1836-1935]'); process.exit(1); }
const [y0, y1] = SPAN.split('-').map(Number);
const report = JSON.parse(fs.readFileSync(JSON_IN || path.join(DIR, 'redflags.json'), 'utf8'));

const metrics = { span: [y0, y1], arms: [] };
for (const a of report.arms) {
  const out = { label: a.label, ref: !!a.ref, bases: {} };
  if (a.counts_only) out.counts_only = a.counts_only;
  // a run is read once per source (`--source both` reads it twice): one basis per source, plus the production-only summary basis the
  // book carries for the like-for-like vanilla line (prodFlags, written by input_price_flags.mjs since 2026-10-08)
  for (const src of [...new Set(a.runs.map(r => r.source))]) {
    const runs = a.runs.filter(r => r.source === src);
    out.bases[src] = armMetrics(runs, r => r.flags, y0, y1);
    if (src === 'market' || src === 'summary') out.flag_count = (out.flag_count || 0) + runs.reduce((n, r) => n + r.flags.length, 0);
  }
  const prodRuns = [...new Map(a.runs.filter(r => Array.isArray(r.prodFlags)).map(r => [r.run, r])).values()];
  if (!a.ref && prodRuns.length) out.bases.summary_production = armMetrics(prodRuns, r => r.prodFlags, y0, y1);
  metrics.arms.push(out);
}
fs.writeFileSync(path.join(DIR, 'redflags_metrics.json'), JSON.stringify(metrics, null, 1));
fs.writeFileSync(path.join(DIR, 'redflags_digest.md'), digest(report, metrics));
fs.writeFileSync(path.join(DIR, 'redflags_card.html'), cardHtml(report, metrics, FULL));
for (const a of metrics.arms) for (const [b, M] of Object.entries(a.bases))
  console.log(`${a.ref ? '[ref] ' : ''}${a.label} · ${b}: problem market-years ${M.problem_market_years.median} (${M.problem_market_years.min}–${M.problem_market_years.max}) of ${8 * (y1 - y0 + 1)}`
    + ` · chronic markets ${M.chronic_markets.median} (${M.chronic_markets.min}–${M.chronic_markets.max}) · n ${M.n}`);
console.log(`wrote redflags_metrics.json, redflags_digest.md, redflags_card.html in ${DIR}`);
if (!fs.existsSync(path.join(DIR, 'redflags_summary.html'))) console.log('  → now write redflags_summary.html with the redflag-summary skill (.claude/skills/redflag-summary/SKILL.md)');
