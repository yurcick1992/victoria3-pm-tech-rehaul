// Auto-downsizing read from the telemetry poll (telemetry v15, metric `downsizing`, on by default through the scheduler's downsize
// feed; FINDINGS F260 for the engine's rule and the save-based reading this replaces).
//
//   node tools/testbed/ledger/downsize_telemetry.mjs <label>=<group>[:<setup>] [...] [--list] [--types N] [--from Y] [--to Y]
//
// <group> = a session, a comma list of sessions, or <session>/runNNN_<setup> folders (lib_runs: usable runs only). Each run's harness.log
// carries, per monthly poll, a DZ line for every producing building that qualified for auto-downsizing at the previous poll (some private
// ownership, under 90% staffed, at least one empty level) and has fewer levels now (DZ|date|country|state|type|level before|level now|
// private before|private now|employment now) and a DZM line closing the poll (tracked, read, drops, over).
//
// A drop is AUTO-DOWNSIZING when its private levels fell and its government levels did not, and fewer than three buildings of its state
// dropped in the same poll (a split, a merger or a bombardment). The levels counted are the private levels lost. Every other drop is
// printed by its reason, never silently skipped. Per arm: auto-downsized private levels per run (mean), by decade and by building type,
// with the rung's tier where the run's book is a tiered one (build_state.json -> built_from_config); "-" is a building outside the ladder.
import fs from 'node:fs';
import path from 'node:path';
import { usableRuns, reportDropped } from './lib_runs.mjs';
import { SESSIONS } from './lib_sumidx.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const LIST = args.includes('--list'), TYPES = +opt('--types', 15), FROM = +opt('--from', 0), TO = +opt('--to', 9999);
const armArgs = args.filter((a, i) => a.includes('=') && !args[i - 1]?.startsWith('--'));
if (!armArgs.length) {
  console.error('usage: downsize_telemetry.mjs <label>=<group>[:<setup>] [...] [--list] [--types N] [--from Y] [--to Y]');
  process.exit(2);
}

const tierCache = new Map();
function tiersOf(runDir) {
  let cfgPath = null;
  try { cfgPath = JSON.parse(fs.readFileSync(path.join(runDir, 'build_state.json'), 'utf8')).deterministic.mod_under_test.built_from_config; } catch { }
  if (!cfgPath || !fs.existsSync(cfgPath)) return {};
  if (!tierCache.has(cfgPath)) {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')), m = {};
    for (const I of cfg.industries || []) { if (I.disabled) continue; for (const t of I.tiers || []) if (!t.method_of) m[t.key] = `t${t.era}`; }
    tierCache.set(cfgPath, m);
  }
  return tierCache.get(cfgPath);
}

function readRun(rel) {
  const dir = path.join(SESSIONS, rel), log = path.join(dir, 'harness.log');
  if (!fs.existsSync(log)) throw new Error(`${rel}: no harness.log`);
  const dz = [], polls = new Map();
  // the date is the engine's display string ("January 1, 1836"); the year is its last number
  const yearOf = d => { const m = /(\d{3,4})\s*$/.exec(d); if (!m) throw new Error(`${rel}: unreadable date '${d}'`); return +m[1]; };
  const kv = fields => Object.fromEntries(fields.map(x => x.split('=')).filter(p => p.length === 2).map(([k, v]) => [k, +v]));
  // ⚠ harness.log can hold one line twice, its place names decoded two ways (the live mirror and the streamed copy), so a drop is
  // keyed by its date and its building id (the DZX line that follows it) and counted once
  const lines = fs.readFileSync(log, 'utf8').split(/\r?\n/), seen = new Set();
  let dupes = 0;
  for (let i = 0; i < lines.length; i++) {
    const f = lines[i].split('|');
    if (f[2] === 'DZ' && f.length >= 12) {
      const [date, country, state, type] = f.slice(3, 7), [l0, l1, p0, p1] = f.slice(7, 11).map(Number), emp = f[11];
      if ([l0, l1, p0, p1].some(x => !Number.isFinite(x))) throw new Error(`${rel}: unreadable DZ line: ${lines[i]}`);
      const x = (lines[i + 1] || '').split('|');
      const id = x[2] === 'DZX' && x[3] === date && x[6] === type ? (/id=([^|\s]+)/.exec(lines[i + 1]) || [])[1] : null;
      const key = `${date}|${id ?? `${type}|${l0}|${l1}|${p0}|${p1}|${emp}`}`;
      if (seen.has(key)) { dupes++; continue; }
      seen.add(key);
      dz.push({ date, year: yearOf(date), country, state, type, l0, l1, p0, p1, emp, id });
    } else if (f[2] === 'DZM') polls.set(`${yearOf(f[3])}|${f[3].split(' ')[0]}`, { year: yearOf(f[3]), ...kv(f.slice(4)) });
  }
  // state-wide: three or more buildings of one state dropping in the same poll
  const perState = new Map();
  for (const d of dz) { const k = `${d.date}|${d.country}|${d.state}`; perState.set(k, (perState.get(k) || 0) + 1); }
  for (const d of dz) {
    const gov0 = d.l0 - d.p0, gov1 = d.l1 - d.p1;
    d.priv = d.p0 - d.p1;
    d.reason = perState.get(`${d.date}|${d.country}|${d.state}`) >= 3 ? 'state-wide' : gov1 < gov0 ? 'government levels fell'
      : d.priv <= 0 ? 'no private level lost' : 'auto';
  }
  return { dz: dz.filter(d => d.year >= FROM && d.year < TO), polls, tiers: tiersOf(dir), dupes };
}

const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN;
for (const a of armArgs) {
  const [label, spec] = a.split(/=(.*)/s);
  const [group, setup = ''] = spec.split(':');
  const { runs, dropped } = usableRuns(SESSIONS, group, setup);
  console.log(`\n=== ${label}: ${runs.length} usable run(s) of ${group}${setup ? ':' + setup : ''}`);
  reportDropped(dropped);
  if (!runs.length) continue;
  const per = [], byDecade = new Map(), byType = new Map(), reasons = new Map();
  for (const rel of runs) {
    const R = readRun(rel);
    const auto = R.dz.filter(d => d.reason === 'auto');
    const months = [...R.polls.values()].filter(p => p.year >= FROM && p.year < TO);
    per.push({ rel, drops: auto.length, levels: auto.reduce((s, d) => s + d.priv, 0), polls: months.length,
      tracked: mean(months.map(p => p.tracked)), over: months.reduce((s, p) => s + (p.over || 0), 0), dupes: R.dupes });
    for (const d of R.dz) { const r = reasons.get(d.reason) || { drops: 0, levels: 0 }; r.drops++; r.levels += d.l0 - d.l1; reasons.set(d.reason, r); }
    for (const d of auto) {
      const dec = Math.floor(d.year / 10) * 10;
      byDecade.set(dec, (byDecade.get(dec) || 0) + d.priv);
      const t = byType.get(d.type) || { levels: 0, drops: 0, tier: R.tiers[d.type] || '-' };
      t.levels += d.priv; t.drops++; byType.set(d.type, t);
      if (LIST) console.log(`  ${rel}  ${d.date}  ${d.country} / ${d.state}  ${d.type}  ${d.l0}->${d.l1}  private ${d.p0}->${d.p1}  employment ${d.emp}`);
    }
  }
  const n = runs.length;
  console.log('\nper run: auto-downsizing drops · private levels lost · polls read · buildings tracked per poll (mean) · duplicate lines dropped');
  for (const p of per) console.log(`  ${p.rel.padEnd(60)} ${String(p.drops).padStart(6)} ${String(p.levels).padStart(7)} ${String(p.polls).padStart(6)} ${p.tracked.toFixed(0).padStart(7)} ${String(p.dupes).padStart(5)}`);
  if (per.some(p => !p.polls)) console.log('  ⚠ a run with no DZM line carried no downsizing poll (an older schema, or the feed was off) - its zero is not a measurement');
  if (per.some(p => p.over)) console.log(`  ⚠ ${per.reduce((s, p) => s + p.over, 0)} building-polls too large to remember (4,096 levels or more) - not tracked`);
  console.log(`  mean of ${n}: ${mean(per.map(p => p.drops)).toFixed(1)} drops, ${mean(per.map(p => p.levels)).toFixed(1)} private levels lost a run`);
  console.log('\nall level drops on tracked buildings, by reason (levels = total levels lost, all runs):');
  for (const [r, v] of [...reasons].sort((x, y) => y[1].levels - x[1].levels)) console.log(`  ${r.padEnd(24)} ${String(v.drops).padStart(6)} drops ${String(v.levels).padStart(7)} levels`);
  console.log('\nauto-downsized private levels by decade (mean a run):');
  console.log('  ' + [...byDecade].sort((x, y) => x[0] - y[0]).map(([d, v]) => `${d}s ${(v / n).toFixed(1)}`).join(' · '));
  console.log(`\nby building type (top ${TYPES}; private levels lost, mean a run · drops, all runs · tier):`);
  for (const [k, v] of [...byType].sort((x, y) => y[1].levels - x[1].levels).slice(0, TYPES))
    console.log(`  ${k.padEnd(48)} ${(v.levels / n).toFixed(1).padStart(7)} ${String(v.drops).padStart(6)}  ${v.tier}`);
  const byTier = new Map();
  for (const v of byType.values()) byTier.set(v.tier, (byTier.get(v.tier) || 0) + v.levels);
  if ([...byTier.keys()].some(t => t !== '-'))
    console.log('\nby tier (private levels lost, mean a run): ' + [...byTier].sort().map(([t, v]) => `${t} ${(v / n).toFixed(1)}`).join(' · '));
}
