// VERIFY A RELEASE BUILD — the one check that a folder is what players may be given (the `release` skill, step 1).
//
// A RELEASE BUILD (strict definition; POLISH_1_0.md H8, the `release` skill) is the output of
//   powershell -ExecutionPolicy Bypass -File tools\build.ps1 -Release
// on the canon (config/mod_config.json), with nothing passed but -Release, on the installed game, and nothing changed in it after the build.
// It has: no telemetry file (zzz_v3tb_*); no debug_log line in any file the build emits but the one start-up manifest line
// ("PM_TECH_REHAUL: init OK - <name> <version> loaded (release build)") in zzz_pm_rehaul_diag.txt; no "Recipe BE" in any name; no build
// stamp in the mod name; metadata.json's version the release's, and its supported_game_version covering the installed game.
// This tool checks all of that on mod/ AND on the deployed copy the user uploads from, and that the two are identical (text files without their line endings).
//
//   node tools/verify_release_build.mjs [--version 1.1.1] [--mod mod] [--deployed <folder>] [--game <Victoria 3 root>]
//
// Exit 0 = a release build, deployed; exit 1 = not (every failure is printed). It changes nothing.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MOD = arg('--mod', 'mod');
const WANT = arg('--version', null);
const GAME = arg('--game', process.env.VIC3_GAME ? join(process.env.VIC3_GAME, '..') : 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Victoria 3');
const docs = () => {
  // build.ps1 deploys to the SHELL's Documents folder (OneDrive may redirect it, POLISH_1_0.md H10); ask PowerShell for the same answer.
  try { return execSync('powershell -NoProfile -Command "[Environment]::GetFolderPath(\'MyDocuments\')"', { encoding: 'utf8' }).trim(); }
  catch { return join(homedir(), 'Documents'); }
};
const DEPLOYED = arg('--deployed', join(docs(), 'Paradox Interactive', 'Victoria 3', 'mod', 'pm_tech_rehaul'));

const fail = [], ok = [];
const check = (cond, good, bad) => (cond ? ok : fail).push(cond ? good : bad);
const walk = d => existsSync(d) ? readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; }) : [];
// Text files are compared without their line endings: git's core.autocrlf rewrites mod/ to CRLF on a checkout while the deployed copy keeps the
// build's LF, and the game reads both. Binary files (dds, png, …) are compared byte for byte.
const TEXT = /\.(txt|yml|json|gui|gfx|asset|shader|csv|settings|info)$/i;
const sha = p => { const b = readFileSync(p); return createHash('sha256').update(TEXT.test(p) ? b.toString('latin1').replace(/\r\n/g, '\n') : b).digest('hex'); };

function inspect(root, label) {
  if (!existsSync(join(root, 'common'))) { fail.push(`${label}: ${root} is not a mod folder (no common/)`); return null; }
  const files = walk(root);
  const rel = p => relative(root, p).replace(/\\/g, '/');
  const meta = JSON.parse(readFileSync(join(root, '.metadata', 'metadata.json'), 'utf8').replace(/^\uFEFF/, ''));
  check(!/\(built /.test(meta.name), `${label}: mod name "${meta.name}" (no build stamp)`, `${label}: the mod name carries a build stamp: "${meta.name}" (a debug build)`);
  if (WANT) check(meta.version === WANT, `${label}: version ${meta.version}`, `${label}: version ${meta.version}, expected ${WANT}`);
  const tele = files.filter(p => /[\\/]zzz_v3tb_/.test(p)).map(rel);
  check(!tele.length, `${label}: no telemetry file`, `${label}: telemetry in the folder: ${tele.join(', ')}`);
  const ours = files.filter(p => /[\\/](common|events)[\\/]/.test(p) && /[\\/]zzz_pm_rehaul[^\\/]*\.txt$/.test(p));
  const logs = [];
  for (const p of ours) readFileSync(p, 'utf8').split(/\r?\n/).forEach((l, i) => { if (/debug_log/.test(l)) logs.push({ f: rel(p), i: i + 1, l: l.trim() }); });
  const manifest = `PM_TECH_REHAUL: init OK - ${meta.name} ${meta.version} loaded (release build)`;
  const isManifest = x => /zzz_pm_rehaul_diag\.txt$/.test(x.f) && x.l === `debug_log = "${manifest}"`;
  check(logs.filter(isManifest).length === 1, `${label}: the manifest line names ${meta.name} ${meta.version}`,
    `${label}: expected exactly one manifest line "${manifest}" in zzz_pm_rehaul_diag.txt, found ${logs.filter(isManifest).length}`);
  const extra = logs.filter(x => !isManifest(x));
  check(!extra.length, `${label}: no other debug_log line in ${ours.length} emitted script files`,
    `${label}: ${extra.length} debug_log line(s) besides the manifest (a debug build?): ${extra.slice(0, 5).map(x => `${x.f}:${x.i}`).join(', ')}`);
  const be = files.filter(p => /[\\/]localization[\\/]/.test(p) && readFileSync(p, 'utf8').includes('Recipe BE')).map(rel);
  check(!be.length, `${label}: no "Recipe BE" in the names`, `${label}: "Recipe BE" in ${be.length} localization file(s), e.g. ${be[0]}`);
  return { meta, map: new Map(files.map(p => [rel(p), sha(p)])) };
}

const m = inspect(MOD, 'mod/');
const d = inspect(DEPLOYED, 'deployed');
if (m && d) {
  const only = (a, b) => [...a.keys()].filter(k => !b.has(k));
  const missing = only(m.map, d.map), extra = only(d.map, m.map);
  const differ = [...m.map.keys()].filter(k => d.map.has(k) && d.map.get(k) !== m.map.get(k));
  check(!missing.length && !extra.length && !differ.length, `deployed: identical to mod/ (${m.map.size} files; text compared without line endings) at ${DEPLOYED}`,
    `deployed: differs from mod/ — ${missing.length} missing, ${extra.length} extra, ${differ.length} changed (e.g. ${[...missing, ...extra, ...differ].slice(0, 3).join(', ')}); rebuild with -Release or re-deploy`);
}
// The installed game must be a version the metadata claims (supported_game_version "1.15.*" covers "1.15.1").
try {
  const ls = JSON.parse(readFileSync(join(GAME, 'launcher', 'launcher-settings.json'), 'utf8'));
  const sgv = m?.meta.supported_game_version ?? '';
  const re = new RegExp('^' + sgv.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
  check(re.test(ls.rawVersion), `game: installed ${ls.rawVersion}, covered by supported_game_version "${sgv}"`,
    `game: installed ${ls.rawVersion} is NOT covered by supported_game_version "${sgv}"`);
} catch (e) { fail.push(`game: cannot read the installed version under ${GAME} (${e.message})`); }
// Git: the folder should be the committed release build, so the tag can name it.
try {
  const dirty = execSync('git status --porcelain -- mod', { encoding: 'utf8' }).trim();
  const head = execSync('git log -1 --format="%h %s" -- mod', { encoding: 'utf8' }).trim();
  check(!dirty, `git: mod/ is committed — last commit touching it: ${head}`, `git: mod/ has uncommitted changes (${dirty.split('\n').length} paths): commit the release build before the upload`);
  const canon = createHash('sha256').update(readFileSync('config/mod_config.json')).digest('hex').slice(0, 16);   // raw bytes, as sha256sum and CLAUDE.md §4.1
  ok.push(`canon: config/mod_config.json sha256 ${canon} (compare with CLAUDE.md §4.1)`);
} catch (e) { fail.push(`git: ${e.message.split('\n')[0]}`); }

for (const s of ok) console.log('  ok   ' + s);
for (const s of fail) console.log('  FAIL ' + s);
console.log(fail.length ? `NOT A RELEASE BUILD READY FOR UPLOAD (${fail.length} failure(s))` : 'RELEASE BUILD VERIFIED: mod/ and the deployed copy are the release build; ready for the upload');
process.exit(fail.length ? 1 : 0);
