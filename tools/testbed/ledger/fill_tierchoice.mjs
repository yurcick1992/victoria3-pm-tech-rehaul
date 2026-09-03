// The build-choice panel's data (user-requested 2026-08-24): the share of tiered construction
// that goes BELOW the best tier the country already holds, and the share that is below-best AND
// LESS EFFICIENT (per-level profit) than the standing frontier.
//
// ⚠ ONE SOURCE PER NUMBER, deliberately: the raw / unit-weighted / ex-ports trio comes from
// analyse_ai_tier_choice.mjs (the F75/F76-family basis — its numbers are what the canon→aival→
// aival2 ladder table is quoted in), and the less-efficient share from analyse_ai_tier_profit.mjs
// section (c). The two tools qualify country-industry-years slightly differently (~0.5pp on the
// raw share), so each figure is quoted on ITS OWN basis and the caption says so — re-deriving
// either here would be a second definition of a measured quantity (the ladderFaults lesson).
// This script SPAWNS the tools and parses their stable headline lines; any parse miss exits 1.
//
// USAGE: node tools/testbed/ledger/fill_tierchoice.mjs <outDir> --session <stamp> --config <path>
//        [--baseline "label|raw|unit|exports|less" ...]   (extra comparison rows, pre-measured)
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ARGV = process.argv.slice(2);
const OUT = ARGV[0];
const argOf = (n, d) => { const i = ARGV.indexOf(n); return i >= 0 && ARGV[i + 1] ? ARGV[i + 1] : d; };
const allOf = n => ARGV.reduce((a, v, i) => (v === n && ARGV[i + 1] ? [...a, ARGV[i + 1]] : a), []);
const SESSION = argOf('--session', null), CFG = argOf('--config', null);
if (!OUT || !SESSION || !CFG) { console.error('usage: fill_tierchoice.mjs <outDir> --session <stamp> --config <path>'); process.exit(1); }

const run = tool => execFileSync(process.execPath,
  [join('tools/testbed/ledger', tool), '--session', SESSION, '--config', CFG, ...(argOf('--setup', null) ? ['--setup', argOf('--setup', null)] : [])], { encoding: 'utf8', maxBuffer: 1 << 26 });
const grab = (text, re, what) => {
  const m = text.match(re);
  if (!m) { console.error(`PARSE MISS (${what}): ${re}`); process.exit(1); }
  return +m[1];
};

const tc = run('analyse_ai_tier_choice.mjs');
const raw = grab(tc, /levels built BELOW it \(the fault\)\s*:\s*[\d\s,]+\s+([\d.]+)%/, 'raw below-best');
const unit = grab(tc, /unit-weighted[^:]*:\s*below\s+([\d.]+)%/, 'unit-weighted');
const exports_ = grab(tc, /excluding ports entirely\s*:\s*below\s+([\d.]+)%/, 'ex-ports');
// the per-decade trajectory (rows like "  1860        627       523   45.5%")
const dec = [];
for (const m of tc.matchAll(/^\s+(1[89]\d0)\s+[\d,]+\s+[\d,]+\s+([\d.]+)%\s*$/gm)) dec.push([+m[1], +m[2]]);
if (!dec.length) { console.error('PARSE MISS: decade table'); process.exit(1); }

const tp = run('analyse_ai_tier_profit.mjs');
const less = grab(tp, /below-best AND less efficient:\s*([\d.]+)%/, 'less-efficient share');
const lessOfCmp = grab(tp, /added to a rung earning LESS per level than the frontier:[\d\s,]+\s+([\d.]+)%/, 'less-of-comparable');
const rawB = grab(tp, /below-best alone:\s*([\d.]+)%/, 'profit-tool raw basis');

const rows = [];
for (const b of allOf('--baseline')) {
  const [arm, r, u, x, l] = b.split('|');
  rows.push({ arm, raw: r ? +r : null, unit: u ? +u : null, exports: x ? +x : null, less: l ? +l : null });
}
rows.push({ arm: argOf('--label', SESSION), raw, unit, exports: exports_, less });

const cap = `Below-best = levels a country adds to a tier BELOW the best one it already holds (F75; the trio is on
analyse_ai_tier_choice.mjs's basis, the same the canon→aival→aival2 family is quoted in). The last column is the
user-requested sharper cut: below-best AND the rung was earning LESS per level than that country's standing frontier
at that moment (analyse_ai_tier_profit.mjs §c — its own qualification set reads below-best ${rawB.toFixed(1)}% here,
~0.5pp off the trio's basis; ${lessOfCmp.toFixed(0)}% of comparable below-best levels are the less-efficient kind).
Baseline rows are prior batches' published figures, measured by the same tools on their own sessions.`;

writeFileSync(join(OUT, 'tierchoice.json'), JSON.stringify({ rows, dec, cap: cap.replace(/\n/g, ' ') }));
console.log(`tierchoice.json: raw ${raw}% · unit ${unit}% · ex-ports ${exports_}% · less-efficient ${less}% (rows ${rows.length}, decades ${dec.length})`);
