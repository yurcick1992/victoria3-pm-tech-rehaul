// ⭐ THE DAM SLOT CHECK (2026-10-09, user-asked with the four-class dam book): do dams on the engine's RESOURCE SLOTS stay inside their
// state region's slots, built AND queued, whoever builds them — and who does build them?
//   node tools/testbed/ledger/dam_slots.mjs <session>[:<setup>] [--every N] [--list 30]
// Per run (every run folder of the setup, finished or not — an unfinished run is marked), from its OWN book (build_state.json →
// built_from_config) through tools/lib_dams.mjs resourceLayout(): each project's state region and its slots per dam type. From the
// yearly save summaries (v17+: `states.<id>.res.building_dam_*` = levels standing, `states.<id>.dam_q` = queued levels by builder):
//   • BREACHES — any year in which a region's standing levels, or standing + queued, exceed its slots (summed over the region's split
//     states). The engine's own cap should make this zero; a single line here is the failure the hand test was for.
//   • BUILDERS — every queued dam level seen at a yearly sample, by the builder's relation to the host state's owner: own · overlord (above
//     the owner in its chain) · family (same top overlord, not above) · outside (another family: investment rights).
//   • THE END — per class, levels standing against slots, and regions full.
// ⚠ A level queued and finished between two yearly samples is never seen in a queue: BUILDERS undercount quick builds, BREACHES cannot.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { deriveAll, resourceLayout } from '../../lib_dams.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const SES = join(REPO, 'tools/testbed/sessions');
const args = process.argv.slice(2);
const spec = args.find(a => !a.startsWith('--'));
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const EVERY = +(opt('--every') || 1), LIST = +(opt('--list') || 30);
if (!spec) { console.error('usage: dam_slots.mjs <session>[:<setup>] [--every N] [--list 30]'); process.exit(2); }
const [session, setup = ''] = spec.split(':');
const runs = readdirSync(join(SES, session)).filter(d => /^run\d+_/.test(d) && (!setup || d.endsWith('_' + setup))).sort();
if (!runs.length) { console.error(`no run folders for ${spec}`); process.exit(2); }

const total = { breaches: 0, rel: { own: 0, overlord: 0, family: 0, outside: 0, unknown: 0 } };
for (const run of runs) {
  const dir = join(SES, session, run);
  const bs = JSON.parse(readFileSync(join(dir, 'build_state.json'), 'utf8').replace(/^﻿/, ''));
  const cfg = JSON.parse(readFileSync(bs.deterministic.mod_under_test.built_from_config, 'utf8'));
  if (cfg.dams?.layout !== 'resource4') { console.log(`${run}: book has no resource-slot dams (layout ${cfg.dams?.layout || 'per_project'}) — skipped`); continue; }
  const { P, projects } = deriveAll(cfg);
  const L = resourceLayout(P, projects);
  const slots = new Map(L.projects.map(p => [p.state, { type: `building_dam_${p.dcls}`, slots: p.stages, id: p.id, cls: p.dcls }]));
  const sdir = join(dir, 'save_summaries');
  const files = existsSync(sdir) ? readdirSync(sdir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort() : [];
  const meta = existsSync(join(dir, 'meta.json')) ? JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8').replace(/^﻿/, '')) : {};
  const seen = new Set(), breaches = [], rel = { own: 0, overlord: 0, family: 0, outside: 0, unknown: 0 }, relEx = [];
  let last = null, lastY = null, old = 0;
  for (const f of files) {
    const j = JSON.parse(gunzipSync(readFileSync(join(sdir, f))).toString());
    if ((j.save_summary_version || 0) < 17) { old++; continue; }
    const y = +String(j.provenance?.date || j.date).split('.')[0];
    if (seen.has(y) || (y - 1836) % EVERY) continue; seen.add(y);
    last = j; lastY = y;
    const over = {}; for (const [k, c] of Object.entries(j.countries)) over[k] = c.overlord || null;
    const chain = k => { const a = []; let x = over[k], g = 0; while (x && g++ < 10) { a.push(x); x = over[x]; } return a; };
    const top = k => { const c = chain(k); return c.length ? c[c.length - 1] : k; };
    const reg = new Map();   // region -> { built, queued, owners }
    for (const s of Object.values(j.states || {})) {
      const S = slots.get(s.region); if (!S) continue;
      const r = reg.get(s.region) || { built: 0, queued: 0 }; reg.set(s.region, r);
      r.built += s.res?.[S.type]?.[0] || 0;
      for (const [b, n] of Object.entries(s.dam_q?.[S.type] || {})) {
        r.queued += n;
        const own = s.country;
        const k = !own || !b || b.startsWith('id') ? 'unknown' : b === own ? 'own' : chain(own).includes(b) ? 'overlord' : top(b) === top(own) ? 'family' : 'outside';
        rel[k] += n; if (k === 'outside' && relEx.length < 6) relEx.push(`${y} ${b} in ${own}'s ${s.region.replace('STATE_', '')}`);
      }
      // a dam type standing where its project does not live would also be a defect
      for (const t of Object.keys(s.res || {})) if (t.startsWith('building_dam_') && t !== S.type) breaches.push(`${y} ${s.region}: ${t} stands in a ${S.type} region`);
    }
    for (const s of Object.values(j.states || {})) if (!slots.has(s.region)) for (const t of Object.keys(s.res || {})) if (t.startsWith('building_dam_') && s.res[t][0] > 0) breaches.push(`${y} ${s.region}: ${t} ×${s.res[t][0]} in a region with no dam slots`);
    for (const [region, r] of reg) { const S = slots.get(region);
      if (r.built > S.slots || r.built + r.queued > S.slots) breaches.push(`${y} ${region.replace('STATE_', '')} ${S.cls}: built ${r.built} + queued ${r.queued} > slots ${S.slots}`); }
  }
  const reached = meta.reached_ingame_date || '(running)';
  console.log(`\n${run}: ${seen.size} yearly v17 summaries${old ? ` (${old} older skipped)` : ''}, last ${lastY ?? '—'}; run reached ${reached}`);
  if (!last) { console.log('  no v17 summary yet'); continue; }
  console.log(`  BREACHES: ${breaches.length}` + (breaches.length ? '\n    ' + breaches.slice(0, LIST).join('\n    ') : ''));
  const qn = Object.values(rel).reduce((a, b) => a + b, 0);
  console.log(`  BUILDERS (queued levels seen at yearly samples): ${qn} — ` + Object.entries(rel).map(([k, n]) => `${k} ${n}`).join(' · ') + (relEx.length ? `\n    outside e.g. ${relEx.join('; ')}` : ''));
  const byCls = {};
  for (const [region, S] of slots) { const b = byCls[S.cls] ||= { built: 0, slots: 0, regions: 0, full: 0, started: 0 }; b.slots += S.slots; b.regions++; }
  for (const s of Object.values(last.states || {})) { const S = slots.get(s.region); if (!S) continue; byCls[S.cls].built += s.res?.[S.type]?.[0] || 0; }
  const builtBy = new Map(); for (const s of Object.values(last.states || {})) { const S = slots.get(s.region); if (S) builtBy.set(s.region, (builtBy.get(s.region) || 0) + (s.res?.[S.type]?.[0] || 0)); }
  for (const [region, n] of builtBy) { const S = slots.get(region); if (n > 0) byCls[S.cls].started++; if (n >= S.slots) byCls[S.cls].full++; }
  console.log(`  AT ${lastY}: ` + Object.entries(byCls).sort().map(([c, b]) => `${c} ${b.built}/${b.slots} levels, ${b.started}/${b.regions} regions started, ${b.full} full`).join(' · '));
  total.breaches += breaches.length; for (const k in rel) total.rel[k] += rel[k];
}
console.log(`\nALL RUNS: breaches ${total.breaches}; queued levels by builder ` + Object.entries(total.rel).map(([k, n]) => `${k} ${n}`).join(' · '));
process.exitCode = total.breaches ? 1 : 0;
