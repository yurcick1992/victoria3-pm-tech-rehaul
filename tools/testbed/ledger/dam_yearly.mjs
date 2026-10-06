// ⭐ THE DAMS OF A BATCH WITH YEARLY SAVES, ACROSS ARMS (2026-10-05) — dam_situation / dam_outcomes need the canon batch's QUARTERLY summaries;
// the artmerge batches save yearly. Per arm: dam levels standing at the end (mean per run, range), projects with a level, the levels hosted by
// SUBJECTS against the subjects' share of the potential, and WHO BUILT each level, by the builder's relation to the host at completion:
//   own · overlord (above the host in its chain) · family (same top overlord, not above) · outside (another top overlord: investment rights) · unknown
// The builder is the country that had that dam in its GOVERNMENT queue at the last yearly sample before the level was finished (PMR_DAM|built
// lines, this run's own, windowed by its telemetry token); a construction that began and ended between two samples is "unknown".
//   node tools/testbed/ledger/dam_yearly.mjs <label>=<session>[,<session>][:<setup>] [...]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { usableRuns } from './lib_runs.mjs';
import { deriveAll } from '../../lib_dams.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const SES = join(REPO, 'tools/testbed/sessions');
const args = process.argv.slice(2);
const arms = args.filter(a => a.includes('=')).map(a => { const [label, rest] = a.split('='); const [ses, setup = ''] = rest.split(':');
  return { label, runs: ses.split(',').flatMap(s => usableRuns(SES, s, setup).runs) }; });
if (!arms.length) { console.error('usage: dam_yearly.mjs <label>=<session>[,<session>][:<setup>] ...'); process.exit(2); }
const MON = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };
const dateY = s => { const m = /([A-Za-z]+) (\d+), (\d{4})/.exec(s || ''); return m ? +m[3] + (MON[m[1]] - 1) / 12 + (+m[2] - 1) / 365 : null; };
const f1 = x => Number.isFinite(x) ? x.toFixed(1) : '—';
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;

function readRun(rel) {
  const bs = JSON.parse(readFileSync(join(SES, rel, 'build_state.json'), 'utf8'));
  const cp = bs.deterministic.mod_under_test.built_from_config; const cfg = JSON.parse(readFileSync(cp, 'utf8'));
  if (!cfg.dams || !cfg.dams.enabled) return null;
  const P = Object.fromEntries(deriveAll(cfg).projects.map(p => [p.id, p]));
  const dir = join(SES, rel, 'save_summaries'); const Y = {};
  for (const f of readdirSync(dir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort()) {
    const j = JSON.parse(gunzipSync(readFileSync(join(dir, f))).toString()); const y = +String(j.provenance.date).split('.')[0]; if (Y[y]) continue;
    const over = {}, host = {}, queued = {}, regionOwner = {};
    for (const [k, c] of Object.entries(j.countries)) {
      over[k] = c.overlord || null;
      for (const [b, v] of Object.entries(c.buildings || {})) if (b.startsWith('building_dam_')) (host[b.slice(13)] ||= []).push([k, v.levels]);
      for (const b of Object.keys(((c.queues || {}).government || {}).by_type || {})) if (b.startsWith('building_dam_')) (queued[b.slice(13)] ||= []).push(k);
    }
    for (const s of Object.values(j.states || {})) (regionOwner[s.region] ||= new Set()).add(s.country);
    Y[y] = { over, host, queued, regionOwner };
  }
  const ys = Object.keys(Y).map(Number).sort((a, b) => a - b);
  const built = [];
  const dbg = join(SES, rel, 'logs_live', 'debug.log');
  if (existsSync(dbg)) {
    const [session, run] = rel.split('/'); const lines = readFileSync(dbg, 'utf8').split('\n'); const token = `|${session.slice(0, 15)}s${run.slice(3, 6)}|`;
    let start = lines.findIndex(l => l.includes(token)); if (start < 0) start = 0; const seen = new Set();
    for (let i = start; i < lines.length; i++) { const m = lines[i].match(/PMR_DAM\|built\|([a-z_0-9]+)\|([^|]*)\|([^|]*)\|level (\d+)\//); if (!m) continue;
      const k = m[1] + '|' + m[4]; if (seen.has(k)) continue; seen.add(k); built.push({ id: m[1], t: dateY(m[3]), level: +m[4] }); }
  }
  return { P, Y, ys, built, hasLog: existsSync(dbg) };
}
const chain = (over, k) => { const out = []; let c = over[k], guard = 0; while (c && guard++ < 10) { out.push(c); c = over[c]; } return out; };
const top = (over, k) => { const ch = chain(over, k); return ch.length ? ch[ch.length - 1] : k; };
function relation(Ys, builder, hostTag) {
  if (builder === hostTag) return 'own';
  if (chain(Ys.over, hostTag).includes(builder)) return 'overlord';
  if (top(Ys.over, builder) === top(Ys.over, hostTag)) return 'family';
  return 'outside';
}
for (const a of arms) {
  const R = a.runs.map(readRun).filter(Boolean);
  if (!R.length) { console.log(`\n== ${a.label}: no dam book`); continue; }
  const end = R.map(r => { const S = r.Y[r.ys[r.ys.length - 1]];
    let lv = 0, proj = 0, lvSub = 0, potSub = 0, pot = 0;
    for (const [id, p] of Object.entries(r.P)) {
      pot += p.stages;
      const hs = S.host[id] || []; const l = hs.reduce((x, [, v]) => x + v, 0);
      const h = hs.length ? hs.sort((p1, p2) => p2[1] - p1[1])[0][0] : [...(S.regionOwner[p.state] || [])][0];
      const sub = h && S.over[h]; if (sub) potSub += p.stages;
      lv += l; if (l) proj++; if (sub) lvSub += l;
    }
    const rel = { own: 0, overlord: 0, family: 0, outside: 0, unknown: 0 };
    for (const b of r.built) { const yAfter = r.ys.find(y => y > b.t); const yBefore = [...r.ys].reverse().find(y => y <= b.t);
      const Sa = yAfter != null ? r.Y[yAfter] : S; const hostTag = ((Sa.host[b.id] || []).sort((p1, p2) => p2[1] - p1[1])[0] || [])[0];
      const qs = r.ys.filter(y => y <= b.t && y >= b.t - 4).reverse().map(y => [y, r.Y[y].queued[b.id] || []]).find(([, q]) => q.length);
      if (!qs || !hostTag) { rel.unknown++; continue; }
      rel[relation(r.Y[qs[0]], qs[1][0], hostTag)]++; }
    return { lv, proj, lvSub, potSub, pot, rel, nBuilt: r.built.length, hasLog: r.hasLog };
  });
  const sum = k => end.reduce((x, e) => x + e.rel[k], 0); const tot = ['own', 'overlord', 'family', 'outside', 'unknown'].reduce((x, k) => x + sum(k), 0);
  console.log(`\n== ${a.label}: ${R.length} run(s) — dam levels at the end ${f1(mean(end.map(e => e.lv)))} per run (${end.map(e => e.lv).join(' ')}) of ${end[0].pot} possible; projects with a level ${f1(mean(end.map(e => e.proj)))}`);
  console.log(`   hosted by subjects: ${f1(mean(end.map(e => e.lvSub)))} levels per run = ${f1(100 * mean(end.map(e => e.lvSub / Math.max(1, e.lv))))}% of built, against the subjects' ${f1(100 * mean(end.map(e => e.potSub / e.pot)))}% of the potential levels`);
  console.log(`   built by (levels finished, all runs): ` + ['own', 'overlord', 'family', 'outside', 'unknown'].map(k => `${k} ${sum(k)} (${f1(100 * sum(k) / Math.max(1, tot))}%)`).join(' · ') + (end.some(e => !e.hasLog) ? '  ⚠ some runs have no debug.log' : ''));
}
