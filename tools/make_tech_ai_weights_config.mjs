// THE TECHNOLOGIES' AI RESEARCH WEIGHTS, RESTORED WHERE A RESEARCH ENTRY EXISTS (user-ruled 2026-11-12, GAME_UPDATE_1_15_1 Q8; BALANCE_FRAMEWORK
// §10.111.3).
//
//   node tools/make_tech_ai_weights_config.mjs --base config/mod_config.<book>.json --suffix <new book> --old-game <old game dir>
//        [--game <game dir>] [--mod <built mod of the base book>] [--keep <tech,...>]
//
// The canon's step (§10.111.3) keeps five at the installed game's weight with --keep central_archives,egalitarianism,general_staff,
// nationalism,rifling: their 1.15 pushes serve vanilla's own story content (the Tsar-points entries, Russia, Italy), and Russia's literacy
// is likely too low for our entries to reach it - where an entry does, it supersedes the push (the user, 2026-11-12). Tech AI weights are
// retuned later (mod 1.3, perhaps).
//
// The user: "restore the weights to 1.13.11 on all techs that have our tech JEs. Leave them 1.15.1 where we don't have a JE." Our research
// entries (§10.95, §10.97, §10.98) already pull those technologies by industry, units, laws and the country's condition; the AI research
// weights vanilla added in 1.15.0 and 1.15.1 push some of them again. So every technology that has a research entry gets back the ai_weight
// block it had in the old game (1.13.11, the version the research system was calibrated on), and every other technology keeps the installed
// game's weight.
//
// WHAT IT WRITES. The new book = the base + `tech_ai_weights` = { rule, old_game, game, techs: { <tech>: { old, vanilla } } } and the record
// `_tech_ai_weights_variant`. Only technologies whose block DIFFERS are listed: `old` is the old game's block verbatim (null when it had none:
// the engine's default weight 1), `vanilla` the installed game's block, which the emitter (tools/emit_tech_finish.mjs) asserts before it
// replaces it, so a later patch that changes a listed technology's weight fails the build instead of being overwritten unseen.
// WHAT IT READS. The research entries from the built mod (`--mod`, default mod/), which must be built from the base book: every
// `can_research = <tech>` in the `possible` of zzz_pm_rehaul_research.txt. The ai_weight blocks from both games' common/technology/technologies.
// It PRINTS what it declined: technologies whose weight changed but that have no entry (kept as the installed game has them), and entries
// whose technology the old game lacks.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const die = m => { throw new Error('make_tech_ai_weights_config: ' + m); };
const BASE = opt('--base') || die('--base <book> required');
const SUFFIX = opt('--suffix') || die('--suffix <name> required');
const OLD = opt('--old-game') || die('--old-game <old game dir> required');
const GAME = opt('--game', process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game');
const MOD = opt('--mod', 'mod');
const read = f => fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '');
const version = dir => { try { const j = JSON.parse(read(path.join(dir, '..', 'launcher-settings.json'))); return j.rawVersion || j.version; } catch {}
  try { const j = JSON.parse(read(path.join(dir, '..', 'launcher', 'launcher-settings.json'))); return j.rawVersion || j.version; } catch {}
  try { const m = read(path.join(dir, '..', 'SNAPSHOT.txt')).match(/game (\d+\.\d+(?:\.\d+)?)/); if (m) return m[1]; } catch {}   // a kept snapshot's record
  die(`cannot tell the game version of ${dir} (no launcher-settings.json, no SNAPSHOT.txt)`); };

// ---- the mod must be the base book's build
const baseRaw = fs.readFileSync(BASE);
const canonRaw = fs.existsSync('config/mod_config.json') ? fs.readFileSync('config/mod_config.json') : null;
const sha = b => crypto.createHash('sha256').update(b).digest('hex').slice(0, 16);
const jeFile = path.join(MOD, 'common/journal_entries/zzz_pm_rehaul_research.txt');
if (!fs.existsSync(jeFile)) die(`no research entries at ${jeFile} - build the base book first`);
const jeText = read(jeFile);
// The entry file's header does not name its book, so the default mod/ (built from config/mod_config.json) is accepted only when the canon is
// byte-identical to the base; a different base needs its own build passed by --mod (the caller vouches for it, and it is recorded).
const modGiven = argv.includes('--mod');
if (!modGiven && !(canonRaw && sha(canonRaw) === sha(baseRaw)))
  die(`the base ${BASE} is not the canon config/mod_config.json, so mod/ is not its build - build the base (build.ps1 -SaveTo <x> -Config <base>) and pass --mod mod_<x>`);

// ---- research entries: the technology each entry's `possible` names
const entries = new Set([...jeText.matchAll(/possible\s*=\s*\{\s*can_research\s*=\s*([a-z_0-9-]+)\s*\}/g)].map(m => m[1]));
if (entries.size < 50) die(`only ${entries.size} technologies with research entries found in ${jeFile} - the entry file changed shape`);

// ---- ai_weight blocks per technology, from a game's technology files
const mask = t => t.replace(/"[^"\n]*"/g, s => '"' + ' '.repeat(s.length - 2) + '"').replace(/#[^\n]*/g, s => ' '.repeat(s.length));
function children(m, from, to) {
  const out = []; let d = 0;
  for (let i = from; i < to; i++) {
    const c = m[i];
    if (c === '{') { if (d === 0) { const km = m.slice(Math.max(from, i - 120), i).match(/([A-Za-z_0-9.:-]+)\s*=\s*$/); out.push({ key: km ? km[1] : null, open: i, close: -1 }); } d++; }
    else if (c === '}') { d--; if (d < 0) die(`unbalanced braces at ${i}`); if (d === 0) out[out.length - 1].close = i; }
  }
  if (d !== 0) die('unbalanced braces at end');
  return out;
}
function weights(gameDir) {
  const dir = path.join(gameDir, 'common/technology/technologies');
  const out = new Map();
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.txt'))) {
    const txt = read(path.join(dir, f)); const m = mask(txt);
    for (const b of children(m, 0, m.length).filter(b => b.key && /^[a-z_0-9-]+$/.test(b.key))) {
      const aw = children(m, b.open + 1, b.close).filter(c => c.key === 'ai_weight');
      if (aw.length > 1) die(`${gameDir}: ${b.key} has ${aw.length} ai_weight blocks`);
      let block = null;
      if (aw.length) { const ls = txt.lastIndexOf('\n', aw[0].open) + 1; block = txt.slice(ls, aw[0].close + 1); }
      out.set(b.key, { file: f, block });
    }
  }
  if (out.size < 150) die(`only ${out.size} technologies parsed in ${dir}`);
  return out;
}
const norm = s => s == null ? null : s.replace(/#[^\n]*/g, '').replace(/\s+/g, ' ').trim();

// --keep <tech,...>: technologies WITH a research entry kept at the installed game's weight by ruling (§10.111.3: the five whose 1.15 push is
// tied to vanilla's own story content - the Tsar-points entries, Russia, Italy). Each must be one the rule would otherwise restore, or it throws.
const KEEP = new Set((opt('--keep', '') || '').split(',').map(s => s.trim()).filter(Boolean));
const oldW = weights(OLD), newW = weights(GAME);
const techs = {}, declinedNoEntry = [], declinedNoOld = [], keptByRuling = [];
for (const [t, n] of [...newW].sort()) {
  const o = oldW.get(t);
  if (!o) { if (entries.has(t)) declinedNoOld.push(t); continue; }
  if (norm(o.block) === norm(n.block)) continue;
  if (!entries.has(t)) { declinedNoEntry.push(t); continue; }
  if (KEEP.has(t)) { keptByRuling.push(t); continue; }
  techs[t] = { old: o.block, vanilla: n.block };
}
const badKeep = [...KEEP].filter(t => !keptByRuling.includes(t));
if (badKeep.length) die(`--keep names technologies the rule would not restore (no entry, no change, or unknown): ${badKeep.join(', ')}`);
const ids = Object.keys(techs);
const oldV = version(OLD), newV = version(GAME);

const book = JSON.parse(baseRaw.toString('utf8'));
if (book.tech_ai_weights) die(`${BASE} already carries tech_ai_weights`);
book.tech_ai_weights = {
  rule: `the ai_weight of every technology with a research entry is the ${oldV} block; every other technology keeps the installed game's (${newV})`
    + (keptByRuling.length ? `, and so do ${keptByRuling.length} with an entry whose ${newV} push is tied to vanilla's own story content (${keptByRuling.join(', ')})` : ''),
  old_game: oldV, game: newV, techs,
};
book._tech_ai_weights_variant = {
  name: SUFFIX, base: path.basename(BASE), ruling: 'BALANCE_FRAMEWORK §10.111.3 (user, 2026-11-12, GAME_UPDATE_1_15_1.md Q8)',
  command: `node tools/make_tech_ai_weights_config.mjs ${argv.join(' ')}`,
  restored: ids, kept_by_ruling: keptByRuling, kept_no_entry: declinedNoEntry, entries_without_old_tech: declinedNoOld, generated: new Date().toISOString(),
};
const out = `config/mod_config.${SUFFIX}.json`;
fs.writeFileSync(out, JSON.stringify(book));
const twinIn = BASE.replace('mod_config.', 'tech_tree_options.'), twinOut = `config/tech_tree_options.${SUFFIX}.json`;
if (!fs.existsSync(twinIn)) die(`no tree twin ${twinIn}`);
fs.writeFileSync(twinOut, fs.readFileSync(twinIn));
console.log(`${entries.size} technologies have research entries; ${ids.length} of them have an ai_weight that differs ${oldV} → ${newV}:`);
for (const t of ids) console.log(`  restored ${t.padEnd(26)} ${norm(techs[t].vanilla)?.slice(0, 70) ?? '(none)'}  →  ${norm(techs[t].old)?.slice(0, 70) ?? '(none: engine default 1)'}`);
console.log(`declined (an entry, kept at the installed game's weight by --keep): ${keptByRuling.join(', ') || 'none'}`);
console.log(`declined (weight changed, no research entry: the installed game's kept): ${declinedNoEntry.join(', ') || 'none'}`);
console.log(`declined (an entry's technology the old game lacks): ${declinedNoOld.join(', ') || 'none'}`);
console.log(`wrote ${out} + ${twinOut} (base ${BASE})`);
