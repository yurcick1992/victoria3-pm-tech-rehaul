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

import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

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

// ------------------------------------------- 6. LAYOUT: nothing runs past the right edge ----
// ⭐ THE REPORT IS READ AS AN EXTERNAL DOCUMENT (user, 2026-10-29: "some text gets past the rightmost alignment line"). The fake DOM above
//   has no layout, so this step opens the finished page in a REAL headless browser (Edge or Chrome over the DevTools protocol; LEDGER_BROWSER
//   names another) at 1000 px and at a 390 px phone width, on both pages with every <details> open, and fails on: the page scrolling
//   sideways; any element crossing the content's right edge outside a scrolling box (only the OUTERMOST offender is named); a chart label
//   drawn past its chart's edge, where the SVG clips it. It found the three offenders of F249's first publication (the health pill, the lede's
//   laggard table, the red-flag card's table — all text set never to wrap). No browser found = a WARN, not a pass.
const CHECK = `(() => {
  const out = [];
  const scan = label => {
    document.querySelectorAll('details').forEach(d => d.open = true);
    const W = document.documentElement.clientWidth, wrap = document.querySelector('.wrap'); if (!wrap) return;
    const wr = wrap.getBoundingClientRect(), edge = Math.min(W, wr.right - parseFloat(getComputedStyle(wrap).paddingRight || 0));
    if (document.documentElement.scrollWidth > W + 1) out.push(label + ': the page scrolls sideways (' + document.documentElement.scrollWidth + ' px wide in a ' + W + ' px window)');
    const clipped = e => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { if (a.tagName.toLowerCase() === 'svg') return true; const cs = getComputedStyle(a); if (cs.overflowX !== 'visible' || cs.display === 'none') return true; } return false; };
    const crosses = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > edge + 1; };
    for (const e of wrap.querySelectorAll('*')) { if (!crosses(e) || clipped(e)) continue; if (e.parentElement && e.parentElement !== wrap && crosses(e.parentElement) && !clipped(e.parentElement)) continue;
      out.push(label + ': <' + e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ').join('.') : '') + '> ends at ' + Math.round(e.getBoundingClientRect().right) + ' px, the content edge is ' + Math.round(edge) + ' px — "' + (e.textContent || '').trim().slice(0, 60) + '"'); }
    for (const t of wrap.querySelectorAll('svg text')) { const svg = t.closest('svg'), r = t.getBoundingClientRect(), s = svg.getBoundingClientRect();
      if (r.width && (r.right > s.right + 1 || r.left < s.left - 1)) out.push(label + ': a chart label is clipped by its chart — "' + t.textContent.trim().slice(0, 50) + '"'); }
  };
  scan('World page');
  const tab = document.getElementById('tab-watch'); if (tab) { tab.click(); scan('Shortlist page'); }
  return out;
})()`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function layoutCheck(file) {
  const exe = [process.env.LEDGER_BROWSER, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].filter(Boolean).find(p => existsSync(p));
  if (!exe) return { skipped: 'no Edge or Chrome found (set LEDGER_BROWSER to one)' };
  const prof = mkdtempSync(join(tmpdir(), 'ledger-verify-'));
  const proc = spawn(exe, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--remote-debugging-port=0', '--user-data-dir=' + prof, 'about:blank'], { stdio: 'ignore' });
  let ws = null, port = null;
  try {
    for (let i = 0; i < 150 && !port; i++) { await sleep(100); const f = join(prof, 'DevToolsActivePort'); if (existsSync(f)) port = readFileSync(f, 'utf8').split('\n')[0].trim() || null; }
    if (!port) return { skipped: 'the browser opened no debugging port' };
    const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page');
    if (!page) return { skipped: 'the browser has no page to drive' };
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('websocket')); });
    let id = 0; const pending = new Map(), events = [];
    ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else events.push(m); };
    const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params }));
      setTimeout(() => { if (pending.has(i)) { pending.delete(i); rej(new Error(method + ' timed out')); } }, 30000); });
    await send('Page.enable');
    const found = [];
    for (const [w, mobile] of [[1000, false], [390, false]]) {   // 390 px without the mobile flag: a local REPORT.html has no viewport meta (the Artifact skeleton adds it), so mobile emulation would lay out at 980 px
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile });
      events.length = 0; await send('Page.navigate', { url: pathToFileURL(resolve(file)).href });
      for (let i = 0; i < 400 && !events.some(e => e.method === 'Page.loadEventFired'); i++) await sleep(50);
      await sleep(400);
      const r = await send('Runtime.evaluate', { expression: CHECK, returnByValue: true });
      if (r.result?.exceptionDetails) return { skipped: 'the check threw in the page: ' + r.result.exceptionDetails.text };
      for (const x of r.result?.result?.value || []) found.push(w + ' px · ' + x);
    }
    return { found };
  } catch (e) { return { skipped: 'the browser check failed: ' + e.message }; }
  finally {
    // ⚠ END THE WHOLE BROWSER (2026-10-29): killing the launched process alone left its renderer, GPU and utility children running — 45 headless
    //   Edge processes after six gate runs — and a tree kill misses them too, because Edge's launched process hands off to a separate browser
    //   process. So: ask the browser to close (Browser.close on its own endpoint), then end every process still holding this run's private
    //   profile (its folder name is unique), then remove the folder. Proven by a process count after the gate: zero left.
    try { ws && ws.close(); } catch {}
    if (port) try { const v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); const b = new WebSocket(v.webSocketDebuggerUrl);
      await new Promise((res, rej) => { b.onopen = res; b.onerror = rej; setTimeout(rej, 3000); }); b.send(JSON.stringify({ id: 1, method: 'Browser.close' })); await sleep(800); try { b.close(); } catch {} } catch {}
    try { proc.kill(); } catch {}
    if (process.platform === 'win32') { const tag = prof.split(/[\\/]/).pop().replace(/[^A-Za-z0-9_-]/g, '');
      spawnSync('powershell', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "Name='msedge.exe' or Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${tag}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { stdio: 'ignore' }); }
    for (let i = 0; i < 20; i++) { await sleep(250); try { rmSync(prof, { recursive: true, force: true }); if (!existsSync(prof)) break; } catch {} }
  }
}
{ const L = await layoutCheck(REPORT);
  if (L.skipped) warn('layout not checked — ' + L.skipped);
  else { for (const x of L.found.slice(0, 25)) fail('LAYOUT ' + x, 'let the text wrap (no white-space:nowrap on prose), or put the table or chart in a scrolling box (class tablewrap)');
    if (L.found.length > 25) fail(`LAYOUT … and ${L.found.length - 25} more`, 'as above');
    if (!L.found.length) console.log('  layout: nothing crosses the right edge at 1000 px or 390 px, on either page'); } }

// ------------------------------------------------------------------ verdict ----
console.log('\nFILL VERIFY — ' + REPORT);
console.log(`  tokens ${M.tokens.length} · consts ${M.consts.length} · tables ${M.tables.length} · controls ${M.controls.length}`);
for (const w of warns) console.log('  WARN  ' + w);
if (!fails.length) { console.log('  ✅ PASS — safe to publish\n'); process.exit(0); }
console.log('');
for (const f of fails) { console.log('  ❌ ' + f.what); console.log('        fix: ' + f.fix); }
console.log(`\nFILL VERIFY FAILED: ${fails.length} problem(s) — do NOT publish\n`);
process.exit(1);
