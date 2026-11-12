// LANDMINE L51 — a data-system function our script calls that the installed engine no longer registers.
//
//   node tools/lint_data_functions.mjs --exe <victoria3.exe> [--text <file> ...] [--mod <built mod dir>]
//
// Every `[...]` data-system expression in a loc string (the telemetry's debug_log lines, the mod's localization) calls functions by name
// (`THIS.GetCountry.GetMarket.GetTradeCapacity`). A name the engine dropped fails only at runtime: the line logs
// "Could not find data system function" in error.log, prints its raw text, and the reading is lost with nothing in the build failing.
// Game 1.15.1 removed `Market.GetCountryTradeCapacity(Country)` and the telemetry's TRADE line went empty in three runs before anyone saw it
// (GAME_UPDATE_1_15_1 V18). The engine's own strings carry every name it registers, so this reads the installed exe's identifier strings
// and fails on any PascalCase function name in a `[...]` chain that the exe does not contain as a whole identifier.
//
// What it reads: each `[...]` group that holds a `.` (a chain), with quoted arguments ('v3tb_x', "...") and a format suffix (`|2`) removed;
// the names are the PascalCase tokens after a `.`, `(`, `,` or the start. All-caps scope words (THIS, ROOT, PREV, SCOPE) are not checked.
// What it declines, and prints: a group with no `.` (a concept link or a plain token) and a group with a `$` (a PowerShell variable left in
// source text; lint the GENERATED telemetry, as preflight does).
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const all = k => argv.flatMap((a, i) => a === k && argv[i + 1] ? [argv[i + 1]] : []);
const one = k => all(k)[0];
const exe = one('--exe');
if (!exe) throw new Error('lint_data_functions: --exe <victoria3.exe> required');
if (!fs.existsSync(exe)) throw new Error(`lint_data_functions: exe not found: ${exe}`);

// The engine's names. A long name is a string in the binary's data; a short one the compiler inlines as 8-byte immediates in the machine
// code (`48 B8` + "GetState"), so a name of 9–16 characters is split across two immediates a few bytes apart. A name is KNOWN when it
// appears whole, or as its 8-character chunks in order, each within 48 bytes of the last. Found on the 1.15.1 and 1.13.11 exes (2026-11-12):
// whole-token matching alone reported GetState, GetOwner, GetGoods, GetLevel and GetMoney missing. ⚠ A removed name that survives as part
// of a longer one passes (the check errs toward silence, never toward a false alarm that stops a build).
const bin = fs.readFileSync(exe).toString('latin1');
const memo = new Map();
const isKnown = n => {
  if (memo.has(n)) return memo.get(n);
  let ok = bin.includes(n);
  if (!ok && n.length > 8) {
    const parts = []; for (let i = 0; i < n.length; i += 8) parts.push(n.slice(i, i + 8));
    for (let from = 0; !ok;) {
      const i = bin.indexOf(parts[0], from); if (i < 0) break;
      let at = i + parts[0].length, all = true;
      for (const p of parts.slice(1)) { const j = bin.indexOf(p, at); if (j < 0 || j - at > 48) { all = false; break; } at = j + p.length; }
      ok = all; from = i + 1;
    }
  }
  memo.set(n, ok); return ok;
};

const files = [...all('--text')];
const mod = one('--mod');
if (mod) {
  const walk = (d, test) => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name), test) : test(e.name) ? [path.join(d, e.name)] : []) : [];
  files.push(...walk(path.join(mod, 'localization', 'english'), n => n.endsWith('.yml')));
  files.push(...walk(path.join(mod, 'common'), n => n.startsWith('zzz_pm_rehaul') && n.endsWith('.txt')));
}
if (!files.length) throw new Error('lint_data_functions: nothing to read (give --text <file> or --mod <dir>)');

const missing = new Map(); // name -> { count, where, example }
let groups = 0, names = 0; const declined = { noChain: 0, psVariable: 0 };
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  for (const m of text.matchAll(/\[([^\[\]\r\n]+)\]/g)) {
    const g = m[1];
    if (g.includes('$')) { declined.psVariable++; continue; }
    if (!g.includes('.')) { declined.noChain++; continue; }
    groups++;
    const bare = g.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""').replace(/\|[^|]*$/, '');
    for (const t of bare.matchAll(/(?:^|[.(,\s])([A-Z][A-Za-z0-9_]*)/g)) {
      const name = t[1];
      if (/^[A-Z_0-9]+$/.test(name)) continue; // scope words: THIS, ROOT, PREV, SCOPE
      names++;
      if (isKnown(name)) continue;
      const e = missing.get(name) || { count: 0, where: new Set(), example: `[${g}]` };
      e.count++; e.where.add(path.relative(process.cwd(), f)); missing.set(name, e);
    }
  }
}
const decl = `declined: ${declined.noChain} group(s) with no chain, ${declined.psVariable} with a PowerShell variable`;
if (missing.size) {
  console.log(`DATA-FUNCTION CHECK FAILED (L51): ${missing.size} function name(s) the installed engine does not register (${exe}):`);
  for (const [n, e] of missing) console.log(`  ${n}  ×${e.count}  in ${[...e.where].join(', ')}  e.g. ${e.example.slice(0, 160)}`);
  console.log(`  (${groups} chain(s), ${names} name(s) read in ${files.length} file(s); ${decl})`);
  process.exit(1);
}
console.log(`DATA-FUNCTION CHECK PASSED (L51): ${names} function name(s) in ${groups} chain(s) over ${files.length} file(s) all registered by the installed engine; ${decl}`);
