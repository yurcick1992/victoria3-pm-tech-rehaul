// RELEASE BUILDS CARRY NO LOGGING (POLISH_1_0.md H8, user-ruled 2026-10-21: "DEBUG builds (run locally, full telemetry and logging) and
// RELEASE builds (designated explicitly; no telemetry or logging at all except a start-up manifest line saying mod version X is loaded)").
// build.ps1 -Release runs this after every content emitter, on the finished mod folder. It removes the mod's own debug_log lines from
// every script file the build emits (common/** and events/** named zzz_pm_rehaul*), except the manifest file zzz_pm_rehaul_diag.txt:
//   - a line that is only `debug_log = "…"`                      -> the line goes
//   - a line that is only `<scope> = { debug_log = "…" }` (or ?=) -> the line goes (the wrapper exists only to log)
// Anything else that still says debug_log in those files is a form this tool does not know, and it THROWS with file:line (CLAUDE.md
// §2.12: a generator that cannot do its job throws). So does a telemetry file (zzz_v3tb_*) in the folder. A block left empty by a removed
// line stays: `if = { limit = { … } }` and `else = { }` are valid no-ops, and removing blocks would risk changing what a kept one means.
// Vanilla-path files the mod replaces keep vanilla's own debug_log lines untouched (they are vanilla's content, not ours).
//   node tools/strip_release_logging.mjs <mod folder>
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
const MOD = process.argv[2];
if (!MOD || !existsSync(join(MOD, 'common'))) throw new Error(`strip_release_logging: ${MOD} is not a mod folder (no common/)`);
const walk = d => existsSync(d) ? readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; }) : [];
const all = [...walk(join(MOD, 'common')), ...walk(join(MOD, 'events'))];
const tele = all.filter(p => /[\\/]zzz_v3tb_/.test(p));
if (tele.length) throw new Error(`strip_release_logging: telemetry in a release build: ${tele.map(p => relative(MOD, p)).join(', ')}`);
const ours = all.filter(p => /[\\/]zzz_pm_rehaul[^\\/]*\.txt$/.test(p) && !/[\\/]zzz_pm_rehaul_diag\.txt$/.test(p));
const LINE = /^[ \t]*debug_log[ \t]*=[ \t]*"[^"\r\n]*"[ \t]*$/;
const WRAP = /^[ \t]*[\w.:@]+[ \t]*\??=[ \t]*\{[ \t]*debug_log[ \t]*=[ \t]*"[^"\r\n]*"[ \t]*\}[ \t]*$/;
let total = 0; const per = [], left = [];
for (const p of ours) {
  const raw = readFileSync(p, 'utf8');
  if (!raw.includes('debug_log')) continue;
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/); let n = 0;
  const kept = lines.filter(l => { if (LINE.test(l) || WRAP.test(l)) { n++; return false; } return true; });
  kept.forEach((l, i) => { if (l.includes('debug_log')) left.push(`${relative(MOD, p)}:${i + 1}: ${l.trim().slice(0, 120)}`); });
  if (n) { writeFileSync(p, kept.join(eol), 'utf8'); per.push(`${relative(MOD, p)} ${n}`); total += n; }
}
if (left.length) throw new Error(`strip_release_logging: ${left.length} debug_log line(s) in a form this tool does not remove - fix the emitter or teach the tool:\n  ` + left.slice(0, 20).join('\n  '));
console.log(`release: removed ${total} debug_log line(s) from ${per.length} of ${ours.length} emitted script file(s): ${per.join(' · ') || 'none'}`);
