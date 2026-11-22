#!/usr/bin/env node
// LANDMINE L55 — A LEDGER READER THAT COUNTS THE TIERED DEPOSITS AS MANUFACTURING (found 2026-11-22, FINDINGS F285 §3).
// The mod 1.2 book carries its nine tiered deposits (coal … oil, §10.115) in the same `cfg.industries` array as the seventeen manufacturing
// industries. A ledger reader that walks every entry to build its tier map counts mines, wharves and rigs as tier rungs, and nothing fails:
// on `m12b-first` the published report read new levels below the best tier at 46.0% (manufacturing alone 26–28.5%) and tier-1 workers at
// 29.0M in 1935 (6.1M). A deposit's first rung key IS vanilla's building key, so the same reader also counted vanilla's mines as tier-0 rungs.
//
// THE RULE: every script the ledger fill runs (tools/testbed/ledger/fill_ledger.sh's `node $L/<x>.mjs` steps, the tools a step runs by name
// — `run('<x>.mjs')` — and every local module they import, followed through) that reads the BOOK's industries (`cfg.industries`, any case)
// (a reader that already takes lib_industries.mjs's lists is counted too, so a fixed reader stays in the population) either takes the
// manufacturing list of lib_industries.mjs (`manufacturing(` / `manufacturingList(`) or carries a reviewed marker comment
// `L55: ALL INDUSTRIES — <why>` (the red flags need every producer and consumer of a good) or `L55: REVIEWED — <why>`.
// A file that only mentions the industries in a comment is not counted. The population must be non-empty (at least five readers of the book's
// industries), or the check proves nothing.
//
//   node tools/lint_ledger_industries.mjs [--root <ledger dir>]     exit 0 = pass, 1 = a reader without the list or a marker
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const ROOT = resolve(argv.includes('--root') ? argv[argv.indexOf('--root') + 1] : join(HERE, 'testbed', 'ledger'));
const FILL = join(ROOT, 'fill_ledger.sh');
if (!existsSync(FILL)) { console.error('L55: no fill_ledger.sh under ' + ROOT); process.exit(2); }
const code = s => s.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/(^|[^:'"`\\])\/\/.*$/, '$1')).join('\n');   // comments out (crude, enough here)
const queue = [...readFileSync(FILL, 'utf8').matchAll(/node \$L\/([A-Za-z0-9_]+\.mjs)/g)].map(m => m[1]);
if (queue.length < 10) { console.error('L55: read only ' + queue.length + ' step(s) from fill_ledger.sh — its layout moved'); process.exit(2); }
const seen = new Set(), rows = [];
while (queue.length) {
  const f = queue.shift(); if (seen.has(f)) continue; seen.add(f);
  const p = join(ROOT, f); if (!existsSync(p)) continue;
  const src = readFileSync(p, 'utf8'), c = code(src);
  for (const m of c.matchAll(/from\s+['"]\.\/([A-Za-z0-9_]+\.mjs)['"]/g)) queue.push(m[1]);
  for (const m of c.matchAll(/\brun\(\s*['"]([A-Za-z0-9_]+\.mjs)['"]/g)) queue.push(m[1]);
  if (f === 'lib_industries.mjs') continue;
  if (!/\bcfg\??\.industries\b/i.test(c) && !/\b(manufacturing(List)?|depositList)\(/.test(c)) continue;   // a reader of the book's industries, fixed or not
  const marker = /L55: (ALL INDUSTRIES|REVIEWED)/.exec(src);
  const listed = /\bmanufacturing(List)?\(/.test(c);
  rows.push({ f, ok: listed || !!marker, how: listed ? 'the manufacturing list' : marker ? 'marker: ' + marker[1].toLowerCase() : 'NEITHER' });
}
const bad = rows.filter(r => !r.ok);
for (const r of rows) console.log((r.ok ? '  ok   ' : '  FAIL ') + r.f.padEnd(34) + r.how);
if (rows.length < 5) { console.error('L55: only ' + rows.length + ' ledger reader(s) of the book\'s industries found in ' + seen.size + ' file(s) — the walk proves nothing'); process.exit(1); }
if (bad.length) { console.error('L55 FAIL: ' + bad.length + ' ledger reader(s) walk every industry of the book without lib_industries.mjs\'s manufacturing list or an L55 marker: ' + bad.map(r => r.f).join(', ')); process.exit(1); }
console.log('L55 PASS: ' + rows.length + ' ledger readers of the book\'s industries, every one on the manufacturing list or reviewed (' + seen.size + ' files walked from fill_ledger.sh)');
