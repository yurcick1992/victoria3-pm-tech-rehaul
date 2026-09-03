// fill_verify.mjs — THE GATE ON PUBLISHING A BATCH REPORT.
//
// WHY THIS EXISTS. Two failures kept happening and NEITHER was visible on the finished page:
//   1. STALE PROSE. Batch-specific text lived in the template shell, so a report published for one
//      batch carried the previous batch's incidents, its CTD and a "next lever" built on the opposite
//      result. Every sentence wrong, none of it obviously so.
//   2. SILENTLY EMPTY PANELS. A data section the fill scripts did not populate rendered as an empty
//      table, or threw and took every renderer after it down with it. A reader cannot tell an empty
//      table from a table of zeroes.
// A checklist would not have caught either. This reads the ARTIFACT — the same principle as
// preflight.ps1 and verify_pms.mjs — and exits non-zero, so a bad report cannot reach an Artifact URL.
//
// USAGE:  node tools/testbed/ledger/fill_verify.mjs <dir-holding-REPORT.html>
// Exit 0 = safe to publish. Exit 1 = do not publish; every failure is named with its fix.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = process.argv[2] || '.';
const REPORT = join(DIR, 'REPORT.html');
const M = JSON.parse(readFileSync(join(HERE, 'fill_manifest.json'), 'utf8'));

if (!existsSync(REPORT)) { console.error('no REPORT.html in ' + DIR); process.exit(1); }
const html = readFileSync(REPORT, 'utf8');
// HTML comments are MAINTAINER notes, not reader-facing prose: the template's own warning about
// stale text names the batch it was written against, and flagging that would train everyone to
// ignore this gate. Scan the visible document for tokens and staleness; run the full file for JS.
const visible = html.replace(/<!--[\s\S]*?-->/g, '');

const fails = [], warns = [];
const fail = (what, fix) => fails.push({ what, fix });
const warn = (what) => warns.push(what);

// ---------------------------------------------------------------- 1. tokens ----
for (const t of M.tokens) {
  if (visible.includes(t.name))
    fail(`token ${t.name} was never filled (${t.means})`, `supply it from ${t.from}`);
}
// any token the manifest does not know about, minus the VA fill instruction comment
for (const m of new Set([...visible.matchAll(/__[A-Z][A-Z0-9_]*__/g)].map(x => x[0]))) {
  if (m === '__VA__') continue;                       // a comment marker, not a token
  if (!M.tokens.some(t => t.name === m))
    fail(`unknown token ${m} left in the report`, 'add it to fill_manifest.json or remove it from the template');
}

// ---------------------------------------------------------------- 2. consts ----
// Read each `const X=<json>;` back out of the artifact and check it actually carries something.
for (const c of M.consts) {
  const re = new RegExp('^const ' + c.name + '=([\\s\\S]*?);\\s*$', 'm');
  const m = html.match(re);   // consts live in <script>, which is not stripped
  if (!m) { if (c.required) fail(`const ${c.name} is absent (${c.means})`, `emit it from ${c.from}`); continue; }
  let val = null;
  try { val = JSON.parse(m[1]); } catch { warn(`${c.name} is not plain JSON — skipped the emptiness check`); continue; }
  const n = val && typeof val === 'object' ? Object.keys(val).length : 0;
  if (c.required && n === 0)
    fail(`const ${c.name} is EMPTY (${c.means})`, `${c.from} produced nothing — an empty panel is worse than an absent one`);
  else if (c.minKeys && n < c.minKeys)
    fail(`const ${c.name} has ${n} entries, expected at least ${c.minKeys} (${c.means})`, `check ${c.from}'s run list`);
}

// ------------------------------------------------------------- 3. staleness ----
// ⭐ A DELIBERATE CROSS-BATCH REFERENCE IS NOT STALENESS. A report legitimately names another session
//   when that session is the SUBJECT — "fill_emp was reading canon-n7", "superseded by X". Marking it
//   <code class="xref">…</code> exempts it, and the exemption cannot fire by accident: prose left
//   behind in the template shell never wears the class, so the tripwire keeps its whole strength.
//   Naming what was exempted, every run, is the price — a silent exemption is an absent check.
const XREF = /<code class="xref">([\s\S]*?)<\/code>/g;
const xrefs = [...visible.matchAll(XREF)].map(m => m[1]);
const scan = visible.replace(XREF, '');
if (xrefs.length) console.log('  cross-batch references (exempt from staleness): ' + xrefs.join(', '));
for (const s of M.staleness.forbidden)
  if (scan.includes(s))
    fail(`STALE: the report still contains "${s}" from a previous batch`,
         'that text belongs to another session — it is prose in the shell that should be a token');

// -------------------------------------------------- 4. render, rows, controls ----
// A headless DOM just rich enough to run the page. Anything that throws or hangs is a defect the
// reader would otherwise meet as a blank panel or a frozen tab.
const mk = (id) => { const el = {
  id, textContent: '', innerHTML: '', style: {}, children: [], attrs: {}, dataset: {}, value: '', checked: false,
  setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; }, removeAttribute(k) { delete this.attrs[k]; },
  appendChild(c) { this.children.push(c); return c; },
  insertRow() { const r = mk(this.id + ':row'); this.children.push(r); return r; },
  insertCell() { const c = mk(this.id + ':cell'); this.children.push(c); return c; },
  closest() { return mk(id + ':fig'); }, querySelector() { return mk(id + ':q'); }, querySelectorAll() { return []; },
  addEventListener() {}, focus() {}, click() { if (typeof this.onclick === 'function') this.onclick(); },
  getBoundingClientRect: () => ({ width: 900, height: 300, left: 0, top: 0 }), getContext: () => null,
  classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, remove() {} }; return el; };
const reg = new Map();
const byId = (id) => { if (!reg.has(id)) reg.set(id, mk(id)); return reg.get(id); };
globalThis.document = { getElementById: byId, querySelector: s => byId('q:' + s), querySelectorAll: () => [],
  createElement: t => mk('new:' + t), createElementNS: (n, t) => mk('ns:' + t),
  body: mk('body'), documentElement: mk('html'), addEventListener() {} };
globalThis.window = { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }), devicePixelRatio: 1 };
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '#888' });

const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n;\n');
try { (0, eval)(blocks); }
catch (e) { fail('the page THREW while rendering: ' + e.message, 'one renderer failing blanks everything after it — guard it, do not reorder'); }

const rowsOf = (el) => el.children.length + (String(el.innerHTML).match(/<tr/g) || []).length;
for (const t of M.tables) {
  const el = reg.get(t.id);
  if (!el) { fail(`table #${t.id} was never rendered (${t.means})`, 'its renderer did not run'); continue; }
  const n = rowsOf(el);
  if (n < t.minRows) fail(`table #${t.id} has ${n} row(s), expected ${t.minRows}+ (${t.means})`,
    'populate it from the batch rather than leaving it blank — a reader cannot tell empty from zero');
}
for (const id of M.controls) {
  const el = reg.get(id);
  if (!el || typeof el.onclick !== 'function') { warn(`control #${id} has no handler`); continue; }
  const t0 = Date.now();
  try { el.onclick(); } catch (e) { fail(`control #${id} THREW: ${e.message}`, 'every selector must render or degrade'); continue; }
  const ms = Date.now() - t0;
  if (ms > 2000) fail(`control #${id} took ${ms}ms`, 'suspect an unbounded loop — an empty series used to hang the page');
}

// ------------------------------------- 5. EVERY table carries DATA, not zeroes ----
// HARD REQUIREMENT (user-ruled 2026-08-24, after two watchlist panels shipped rendering nothing but
// zeroes): a table that renders rows of 0/—/blank is indistinguishable from a measured zero and
// worse than an absent panel. After every control has run, EVERY element whose id starts with `t-`
// must hold at least one data row with a nonzero number that is not a year; every `chart*` element
// must have drawn something. This is generic on purpose — a new panel is covered the day it is
// added, without anyone remembering to register it.
const digitless = s => String(s).replace(/<[^>]*>/g, ' ')      // strip tags
  .replace(/\b1[6-9]\d\d(?:s|–1[6-9]\d\d)?\b/g, ' ')            // years and year ranges
  .replace(/\b(?:19|20)\d\d\b/g, ' ');
for (const [id, el] of reg) {
  if (/^t-/.test(id) && !id.includes(':')) {
    const rows = el.children.filter(r => r.innerHTML && !/<th[\s>]/.test(r.innerHTML));
    if (!rows.length) { if (!M.tables.some(t => t.id === id)) warn(`table #${id} rendered no data rows`); continue; }
    const hasData = rows.some(r => /[1-9]/.test(digitless(r.innerHTML)));
    if (!hasData) fail(`table #${id} renders ONLY zeroes/dashes (${rows.length} data rows)`,
      'the panel is unpopulated for this batch — fill its source (see fill_manifest.json) or the section is lying');
  }
  if (/^chart/.test(id) && !id.includes(':')) {
    if (!(el.children.length || (el.innerHTML && String(el.innerHTML).length > 40)))
      fail(`chart #${id} drew nothing`, 'its series is empty — fill the const it reads');
  }
}

// ------------------------------------------------------------------ verdict ----
console.log('\nFILL VERIFY — ' + REPORT);
console.log(`  tokens ${M.tokens.length} · consts ${M.consts.length} · tables ${M.tables.length} · controls ${M.controls.length}`);
for (const w of warns) console.log('  WARN  ' + w);
if (!fails.length) { console.log('  ✅ PASS — safe to publish\n'); process.exit(0); }
console.log('');
for (const f of fails) { console.log('  ❌ ' + f.what); console.log('        fix: ' + f.fix); }
console.log(`\nFILL VERIFY FAILED: ${fails.length} problem(s) — do NOT publish\n`);
process.exit(1);
