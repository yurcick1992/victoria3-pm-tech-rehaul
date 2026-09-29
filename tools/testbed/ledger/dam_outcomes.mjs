// THE CHANCE THAT A STARTED DAM SURVEY / A STARTED DAM CONSTRUCTION IS FINISHED, by the relation between the actor and the target state
// (dams.rules = family; user-asked 2026-09-29). Pools every run of the sessions named.
//   relation of an actor A to the state's owner H at the start date:
//     own          A = H
//     overlord     A is above H in H's overlord chain
//     family       same top overlord, but A is not above H (A is H's subject, or a sibling)
//     outside      a different top overlord (under these rules: an investment-rights holder)
//   SURVEY: survey_start -> survey_complete (finished) / survey_ended (abandoned) / neither by 1936 (still running at the end)
//   CONSTRUCTION: one builder's continuous stay in its government queue on one dam, from the quarterly save summaries; a stay is split only
//     where the dam's built level count rose (a level finished) or the builder was absent more than two quarters. Outcomes:
//       finished     the dam's built level count rose within four quarters of the builder's last sighting
//       lost (log)   the MONTHLY dam log shows the queued level cancelled within ~20 months of the last sighting
//                    (queued count fell without a level added, or the dam's building record vanished with a level still queued)
//       vanished     gone from the queue without either (the quarterly listing sometimes drops a live construction - FINDINGS F177)
//       still queued at the last save
//     "progressed" = its points left fell below its full cost at some sighting.
// Usage: node tools/testbed/ledger/dam_outcomes.mjs <modDir> <runDir> [<runDir> ...]
import fs from 'node:fs'; import zlib from 'node:zlib'; import path from 'node:path';
const [modDir, ...runs] = process.argv.slice(2);
const G = 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';

const dams = {};
{ const txt = fs.readFileSync(path.join(modDir, 'common/buildings/zzz_pm_rehaul_dams.txt'), 'utf8');
  for (const blk of txt.split(/\n(?=building_dam_)/).filter(b => b.startsWith('building_dam_')))
    dams[/^building_dam_(\w+)/.exec(blk)[1]] = { cost: +/required_construction = (\d+)/.exec(blk)[1], region: /state_region = s:(\w+)/.exec(blk)[1] };
}
const nameTags = {};
{ const loc = {};
  for (const f of fs.readdirSync(`${G}/localization/english`).filter(f => /countries|dynamic/.test(f)))
    for (const m of fs.readFileSync(`${G}/localization/english/${f}`, 'utf8').matchAll(/^\s*([\w.]+):\d* "(.*)"/gm)) loc[m[1]] = m[2];
  const add = (n, t) => (nameTags[n] ??= new Set()).add(t);
  for (const [k, v] of Object.entries(loc)) if (/^[A-Z][A-Z0-9]{2}$/.test(k)) add(v, k);
  let tag = null;
  for (const l of fs.readFileSync(`${G}/common/dynamic_country_names/00_dynamic_country_names.txt`, 'utf8').split('\n')) {
    const t = /^([A-Z][A-Z0-9]{2}) = \{/.exec(l); if (t) tag = t[1]; const n = /^\s*name = (\w+)/.exec(l); if (tag && n && loc[n[1]]) add(loc[n[1]], tag); }
}
const toD = x => { const [y, m, d] = x.split('.').map(Number); return Date.UTC(y, m - 1, d || 1); };

const surveys = [], builds = [], notes = { unresolvedName: 0, unknownHost: 0 };
for (const run of runs) {
  const dir = path.join(run, 'save_summaries');
  const snaps = fs.readdirSync(dir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort()
    .map(f => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f))))).map(j => {
      const regionOwners = {}; for (const s of Object.values(j.states || {})) (regionOwners[s.region] ??= new Set()).add(s.country);
      const lvl = {}, bhost = {};
      for (const [t, c] of Object.entries(j.countries)) for (const [k, b] of Object.entries(c.buildings || {})) if (k.startsWith('building_dam_')) { const id = k.slice(13); lvl[id] = (lvl[id] || 0) + b.levels; bhost[id] ??= t; }
      const q = {}; for (const [t, c] of Object.entries(j.countries)) for (const [k, v] of Object.entries(c.queues?.government?.by_type || {})) if (k.startsWith('building_dam_')) q[`${t}|${k.slice(13)}`] = v;
      const ovl = {}; for (const [t, c] of Object.entries(j.countries)) ovl[t] = c.overlord;
      return { date: j.provenance?.date, t: toD(j.provenance?.date), regionOwners, lvl, bhost, q, ovl, exists: new Set(Object.keys(j.countries)) };
    });
  const snapAt = t => { let lo = 0; for (let i = 0; i < snaps.length; i++) if (snaps[i].t <= t) lo = i; return lo; };
  const chain = (s, x) => { const c = []; let y = s.ovl[x], g = 0; while (y && g++ < 12) { c.push(y); y = s.ovl[y]; } return c; };
  const top = (s, x) => chain(s, x).at(-1) || x;
  const hostAt = (i, dam) => {
    const s = snaps[i]; const owners = s.regionOwners[dams[dam].region]; if (!owners) return null;
    if (owners.size === 1) return [...owners][0];
    // split region: the dam building's host where one exists (nearest snapshot), if it still owns part of the region
    for (let d = 0; d < snaps.length; d++) for (const j of [i + d, i - d]) { const h = snaps[j]?.bhost[dam]; if (h && owners.has(h)) return h; }
    return null;
  };
  const relation = (i, actor, host) => {
    const s = snaps[i]; if (!host) return 'unknown host';
    if (actor === host) return 'own';
    if (chain(s, host).includes(actor)) return 'overlord';
    if (top(s, actor) === top(s, host)) return 'family';
    return 'outside';
  };
  // --- surveys, from this run's log ---
  let L = fs.readFileSync(path.join(run, 'logs_live/debug.log'), 'utf8').split('\n');
  L = L.slice(Math.max(0, L.findLastIndex(l => l.includes('PMR_DAM|start|'))));
  L = [...new Set(L.filter(l => l.includes('PMR_DAM|')).map(l => l.slice(l.indexOf('PMR_DAM|')).trim()))].map(l => l.split('|'));
  const dt = s => Date.parse(s + ' UTC');
  const ends = L.filter(l => l[1] === 'survey_complete' || l[1] === 'survey_ended').map(l => ({ k: l[1], dam: l[2], who: l[3], t: dt(l[4]) }));
  for (const l of L.filter(l => l[1] === 'survey_start')) {
    const t = dt(l[4]); const i = snapAt(t); const s = snaps[i];
    const cands = [...(nameTags[l[3]] || [])].filter(x => s.exists.has(x));
    const host = hostAt(i, l[2]);
    let actor = cands.length === 1 ? cands[0] : cands.find(x => x === host) || cands.find(x => host && chain(s, host).includes(x)) || cands[0];
    if (!actor) { notes.unresolvedName++; }
    const end = ends.filter(e => e.dam === l[2] && e.who === l[3] && e.t >= t).sort((a, b) => a.t - b.t)[0];
    const rel = actor ? relation(i, actor, host) : 'unresolved name';
    if (rel === 'unknown host') notes.unknownHost++;
    surveys.push({ run: path.basename(run), dam: l[2], actor, host, rel, outcome: end ? (end.k === 'survey_complete' ? 'finished' : 'abandoned') : 'still running at the end' });
  }
  // --- monthly-log cancellations ---
  const mon = {}; for (const l of L) if (l[1] === 'probe_lvl' || l[1] === 'probe_q') ((mon[l[2]] ??= {})[dt(l[4])] ??= {})[l[1]] = +l[3].split('/')[0];
  const cancels = []; const lastMonth = Math.max(...Object.values(mon).flatMap(m => Object.keys(m).map(Number)));
  for (const [dam, m] of Object.entries(mon)) {
    const ts = Object.keys(m).map(Number).sort((a, b) => a - b);
    for (let x = 1; x < ts.length; x++) { const a = m[ts[x - 1]], b = m[ts[x]]; if (a.probe_q != null && b.probe_q != null && b.probe_q < a.probe_q && (b.probe_lvl ?? 0) <= (a.probe_lvl ?? 0)) cancels.push({ dam, t: ts[x] }); }
    const e = m[ts.at(-1)]; if (ts.at(-1) < lastMonth - 40 * 864e5 && (e.probe_q ?? 0) > (e.probe_lvl ?? 0)) cancels.push({ dam, t: ts.at(-1) + 31 * 864e5 });
  }
  // --- constructions ---
  const series = {}; snaps.forEach((s, i) => { for (const [key, v] of Object.entries(s.q)) (series[key] ??= []).push({ i, ...v }); });
  for (const [key, ser] of Object.entries(series)) {
    const [builder, dam] = key.split('|');
    const segs = []; let seg = [ser[0]];
    for (let x = 1; x < ser.length; x++) {
      const gap = ser[x].i - ser[x - 1].i > 3;
      const levelDone = (snaps[ser[x].i].lvl[dam] || 0) > (snaps[ser[x - 1].i].lvl[dam] || 0);
      if (gap || levelDone) { segs.push(seg); seg = []; } seg.push(ser[x]);
    }
    segs.push(seg);
    for (const g of segs) {
      const first = g[0], last = g.at(-1), cost = dams[dam].cost * first.n;
      const host = hostAt(first.i, dam) || snaps[first.i].bhost[dam] || null;
      const rel = relation(first.i, builder, host);
      const progressed = g.some(e => e.left < cost - 1);
      const lvl0 = snaps[last.i].lvl[dam] || 0;
      let outcome;
      const after = snaps.slice(last.i + 1, last.i + 5);
      if (last.i === snaps.length - 1) outcome = 'still queued';
      else if (after.some(s => (s.lvl[dam] || 0) > lvl0)) outcome = 'finished';
      else if (cancels.some(c => c.dam === dam && c.t - snaps[last.i].t > -100 * 864e5 && c.t - snaps[last.i].t < 620 * 864e5)) outcome = 'lost (log)';
      else outcome = 'vanished';
      builds.push({ run: path.basename(run), dam, builder, host, rel, progressed, outcome, share: Math.max(0, 1 - Math.min(...g.map(e => e.left)) / cost) });
    }
  }
}

const REL = ['own', 'overlord', 'family', 'outside', 'unknown host', 'unresolved name'];
const pct = (a, b) => b ? `${(100 * a / b).toFixed(0)}%` : '-';
console.log(`${runs.length} run(s)`);
console.log('\nSURVEYS started, by the surveyor\'s relation to the target state\'s owner');
console.log('relation        started  finished  abandoned  running@1936  | P(finished | started)  P(finished | ended by 1936)');
for (const r of REL) {
  const s = surveys.filter(x => x.rel === r); if (!s.length) continue;
  const f = s.filter(x => x.outcome === 'finished').length, a = s.filter(x => x.outcome === 'abandoned').length, o = s.length - f - a;
  console.log(`${r.padEnd(15)} ${String(s.length).padStart(7)}  ${String(f).padStart(8)}  ${String(a).padStart(9)}  ${String(o).padStart(12)}  | ${pct(f, s.length).padStart(21)}  ${pct(f, f + a).padStart(27)}`);
}
console.log('\nCONSTRUCTIONS queued, by the builder\'s relation to the target state\'s owner');
console.log('relation        queued  progressed | finished  lost(log)  vanished  queued@1936 | P(finished | queued, ended)  P(finished | progressed, ended)   lost: mean share built');
for (const r of REL) {
  const b = builds.filter(x => x.rel === r); if (!b.length) continue;
  const c = o => b.filter(x => x.outcome === o).length;
  const ended = b.filter(x => x.outcome !== 'still queued'), endedP = ended.filter(x => x.progressed);
  const lost = b.filter(x => x.outcome === 'lost (log)' && x.progressed);
  console.log(`${r.padEnd(15)} ${String(b.length).padStart(6)}  ${String(b.filter(x => x.progressed).length).padStart(10)} | ${String(c('finished')).padStart(8)}  ${String(c('lost (log)')).padStart(9)}  ${String(c('vanished')).padStart(8)}  ${String(c('still queued')).padStart(11)} | ` +
    `${pct(ended.filter(x => x.outcome === 'finished').length, ended.length).padStart(27)}  ${pct(endedP.filter(x => x.outcome === 'finished').length, endedP.length).padStart(31)}   ${lost.length ? (100 * lost.reduce((a, x) => a + x.share, 0) / lost.length).toFixed(0) + '%' : '-'}`);
}
console.log(`\nnotes: survey starts with an unresolved country name ${notes.unresolvedName}, with no single owner found for a split state ${notes.unknownHost}`);
if (process.env.DUMP) fs.writeFileSync(process.env.DUMP, JSON.stringify({ surveys, builds }, null, 1));
