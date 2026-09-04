// THE RESEARCH-JOURNAL-ENTRY TALLY — how often the industry-driven research entries fire, per run, per country, and
// for Britain by the era of the rung each technology unlocks. Reads the run's continuous debug.log MIRROR and applies
// two rules learned the hard way (2026-09-04, canon4-je-n5):
//   1. THE WINDOW IS A POSITION, NOT A TIME. The mirror begins with the ring's leftovers from the previous run, whose
//      wall stamps can be LATER in the day than this run's start (a run that crosses midnight); the run's own telemetry
//      token (`|<session stamp>s<NNN>|`, first written at the 1836.2.1 dump) marks where its lines begin.
//   2. COMPLETIONS ARE UNIQUE (country, technology, stage) TRIPLETS. The mirror re-copies the current log on a FALSE
//      rotation (landmine L28 — a stale directory length below the read position; run 4 of canon4-je-n5 re-copied one
//      946-line chunk 27 times in eight seconds), so one completion can appear N times; the engine completes a stage at
//      most once per country (the entry is invalidated once the technology is held). Raw lines are printed beside.
// Usage: node tools/testbed/ledger/je_tally.mjs --session <stamp>[:<setup>] [--config <path>] [--years 1900,1935]
//   The config defaults to the session's built_from_config (build_state.json), which is what maps a technology to the
//   era of the rung it unlocks; pass one explicitly for an older session.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { usableRuns, reportDropped } from './lib_runs.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const SES = join(REPO, 'tools', 'testbed', 'sessions');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const [session, setup = ''] = String(arg('--session', '')).split(':'); if (!session) { console.error('usage: --session <stamp>[:<setup>] [--config <path>] [--years y,y]'); process.exit(2); }
const YEARS = String(arg('--years', '1900,1935')).split(',').map(s => s.trim()).filter(Boolean);
let cfgPath = arg('--config', '');
if (!cfgPath) { // build_state.json is PER RUN (the scheduler rebuilds before every run): deterministic.mod_under_test.built_from_config
  try { const root = join(SES, session); const r0 = readdirSync(root).filter(x => /^run\d+_/.test(x)).sort()[0]; const bs = JSON.parse(readFileSync(join(root, r0, 'build_state.json'), 'utf8')); cfgPath = bs.deterministic?.mod_under_test?.built_from_config || bs.deterministic?.built_from_config || ''; } catch { } }
if (!cfgPath) throw new Error('no --config and the session records no built_from_config');
const cfg = JSON.parse(readFileSync(existsSync(cfgPath) ? cfgPath : join(REPO, cfgPath), 'utf8'));
// a disabled industry's rung-0 key IS the vanilla building (landmine L27): drop them before anything reads the ladder
const industries = cfg.industries.filter(ind => !ind.disabled);
const techOf = {}; const rungKeys = {};
for (const ind of industries) { if (ind.disabled) continue; const tiers = (ind.tiers || []).filter(t => !t.model_only); rungKeys[ind.id] = tiers.map(t => t.key); tiers.forEach((t, i) => { if (t.tech) techOf[t.tech] = { ind: ind.id, era: t.era, rung: i }; }); }
const { runs, dropped } = usableRuns(SES, session, setup); reportDropped(dropped);
const MAJORS = ['Great Britain', 'France', 'United States of America', 'Prussia', 'German Empire', 'Russia', 'Austria'];
const by = (arr, f) => { const o = {}; for (const x of arr) { const k = f(x); o[k] = (o[k] || 0) + 1; } return o; };
const readGz = (p) => JSON.parse(gunzipSync(readFileSync(p)).toString('utf8'));
for (const rel of runs) {
  const D = join(SES, rel); const run = rel.split('/')[1];
  const lines = readFileSync(join(D, 'logs_live', 'debug.log'), 'utf8').split('\n');
  const token = `|${session.slice(0, 15)}s${run.slice(3, 6)}|`; let start = lines.findIndex(l => l.includes(token)); const how = start >= 0 ? 'token' : 'file start (no token line)'; if (start < 0) start = 0;
  const comp = []; const seen = new Set(); let raw = 0;
  lines.forEach((l, i) => { if (i < start) return; const m = l.match(/PMR_JE\|([a-z]+)\|([a-z_0-9]+)\|(.*?)\s*$/); if (!m) return; raw++; const c = m[3].trim(); const k = `${c}|${m[2]}|${m[1]}`; if (seen.has(k)) return; seen.add(k); comp.push({ stage: m[1], tech: m[2], c }); });
  const byC = by(comp, x => x.c);
  console.log(`\n== ${rel} — ${comp.length} unique completions (${raw} raw lines, ${raw - comp.length} mirror duplicates; window by ${how}); ${Object.keys(byC).length} countries; stages ${JSON.stringify(by(comp, x => x.stage))}`);
  console.log('   top: ' + Object.entries(byC).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, n]) => `${c} ${n}`).join(' · '));
  for (const c of MAJORS) { const mine = comp.filter(x => x.c === c); if (!mine.length && !['Great Britain', 'France', 'United States of America'].includes(c)) continue; const techs = new Set(mine.map(x => x.tech)); console.log(`   ${c}: ${mine.length} over ${techs.size} technologies`); }
  const gbTechs = new Set(comp.filter(x => x.c === 'Great Britain').map(x => x.tech)); const byEra = {};
  for (const [t, v] of Object.entries(techOf)) { const e = v.era; byEra[e] ??= { n: 0, hit: 0, miss: [] }; byEra[e].n++; if (gbTechs.has(t)) byEra[e].hit++; else byEra[e].miss.push(t); }
  console.log('   GBR coverage by the unlocked rung\'s era: ' + Object.keys(byEra).sort().map(e => `e${e} ${byEra[e].hit}/${byEra[e].n} (${Math.round(100 * byEra[e].hit / byEra[e].n)}%)`).join(' · '));
  const other = comp.filter(x => !techOf[x.tech]); if (other.length) console.log(`   entries outside the tier ladder (war channel / vanilla anchors): ${other.length} — ${JSON.stringify(by(other, x => x.tech))}`);
  const majorsOther = other.filter(x => MAJORS.includes(x.c)); if (majorsOther.length) console.log(`     of which majors: ${JSON.stringify(by(majorsOther, x => x.c + '/' + x.tech))}`);
  // tech pace + frontier levels from the summaries, indexed by each summary's own date
  const SD = join(D, 'save_summaries'); const idx = []; for (const f of readdirSync(SD).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort()) { try { const S = readGz(join(SD, f)); idx.push({ y: String(S.provenance?.date || '').slice(0, 4), S }); } catch { } }
  const at = (y) => idx.find(x => x.y === String(y))?.S;
  for (const y of YEARS) { const S = at(y); if (!S) continue; const row = ['GBR', 'FRA', 'USA', 'GER', 'PRU', 'RUS'].map(t => { const c = S.countries?.[t]; if (!c) return `${t} —`; const n = Array.isArray(c.technologies_held) ? c.technologies_held.length : (typeof c.technologies === 'number' ? c.technologies : '?'); return `${t} ${n}`; }).join(' · '); console.log(`   technologies held at ${y}: ${row}`); }
  const S05 = at(1905); const gbr = S05?.countries?.GBR; if (gbr?.buildings) console.log('   GBR 1905 levels by rung — ' + ['glass', 'tooling', 'textile', 'steel', 'motor', 'arms'].filter(id => rungKeys[id]).map(id => `${id} ${rungKeys[id].map(k => (gbr.buildings[k] || {}).levels ?? 0).join('/')}`).join(' · '));
}
