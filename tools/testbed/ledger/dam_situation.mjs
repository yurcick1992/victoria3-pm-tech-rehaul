// The dam situation of ONE run under dams.rules = family: surveys, built levels, stalled queue elements (a year or more
// queued without progress, and whether another country could have built the dam meanwhile) and wasted constructions
// (progress made, then the element vanished without a level being added), classified by cause.
// Sources: the run's QUARTERLY save summaries (who queued which dam, points left, overlords, technologies) and the
// PMR_DAM debug.log lines of THIS run (surveys, family surveys, completions). Resolution: one quarter.
// Usage: node tools/testbed/ledger/dam_situation.mjs <runDir> <modDir>   (modDir = a build of the run's own book, e.g. build.ps1 -SaveTo <name> -Config <book>)
// ⚠ The quarterly queue listing sometimes drops a construction that is still going on (a builder that lost its rights, a state in revolt), so
// a "gone" element is only a wasted construction when the MONTHLY log confirms it (CONFIRMED lines); the rest are an upper bound (FINDINGS F177).
import fs from 'node:fs'; import zlib from 'node:zlib'; import path from 'node:path';
const [run, modDir] = process.argv.slice(2);
const G = 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';

// ---- dam definitions: cost and the technology each level needs (tech_1 always; tech_k once level_after_queued >= T) ----
const dams = {};
{ const txt = fs.readFileSync(path.join(modDir, 'common/buildings/zzz_pm_rehaul_dams.txt'), 'utf8');
  for (const blk of txt.split(/\n(?=building_dam_)/).filter(b => b.startsWith('building_dam_'))) {
    const k = /^(building_dam_\w+)/.exec(blk)[1];
    const cap = +(/level_after_queued_constructions >= (\d+) \} \}\n/.exec(blk) || [0, 0])[1];
    const techs = [];
    const t1 = /_tech_1_tt\n\s*scope:investor_country \?= \{ has_technology_researched = (\w+)/.exec(blk); if (t1) techs.push({ from: 0, tech: t1[1] });
    for (const m of blk.matchAll(/level_after_queued_constructions >= (\d+) \} \}\n\s*scope:investor_country \?= \{ has_technology_researched = (\w+)/g)) techs.push({ from: +m[1], tech: m[2] });
    dams[k] = { cost: +/required_construction = (\d+)/.exec(blk)[1], cap, techs };
  }
}
const techsFor = (k, levelIndex /*0-based level being built*/) => dams[k].techs.filter(t => t.from <= levelIndex).map(t => t.tech);

// ---- country NAME -> tags (the log names countries, the saves tag them) ----
const nameTags = {};
const addName = (n, t) => (nameTags[n] ??= new Set()).add(t);
{ const loc = {};
  for (const f of fs.readdirSync(`${G}/localization/english`).filter(f => /countries|dynamic/.test(f)))
    for (const m of fs.readFileSync(`${G}/localization/english/${f}`, 'utf8').matchAll(/^\s*([\w.]+):\d* "(.*)"/gm)) loc[m[1]] = m[2];
  for (const [k, v] of Object.entries(loc)) if (/^[A-Z][A-Z0-9]{2}$/.test(k)) addName(v, k);
  const dyn = fs.readFileSync(`${G}/common/dynamic_country_names/00_dynamic_country_names.txt`, 'utf8');
  let tag = null;
  for (const l of dyn.split('\n')) { const t = /^([A-Z][A-Z0-9]{2}) = \{/.exec(l); if (t) tag = t[1]; const n = /^\s*name = (\w+)/.exec(l); if (tag && n && loc[n[1]]) addName(loc[n[1]], tag); }
}

// ---- log ----
let lines = fs.readFileSync(path.join(run, 'logs_live/debug.log'), 'utf8').split('\n');
lines = lines.slice(Math.max(0, lines.findLastIndex(l => l.includes('PMR_DAM|start|'))));
const L = [...new Set(lines.filter(l => l.includes('PMR_DAM|')).map(l => l.slice(l.indexOf('PMR_DAM|')).trim()))].map(l => l.split('|'));
const ev = k => L.filter(l => l[1] === k);
const surveyTags = {}, unresolved = new Set();   // dam -> Set of tags that completed a survey
for (const l of ev('survey_complete')) { const ts = nameTags[l[3]]; if (!ts) unresolved.add(l[3]); for (const t of ts || []) (surveyTags['building_dam_' + l[2]] ??= new Set()).add(t); }
const familyDam = new Set(ev('family_survey').map(l => 'building_dam_' + l[2]));

// ---- quarterly snapshots ----
const dir = path.join(run, 'save_summaries');
const snaps = fs.readdirSync(dir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort().map(f => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f)))));
const dateOf = j => j.provenance?.date || j.date;
const chainOf = (j, t) => { const c = []; let x = j.countries[t]?.overlord, g = 0; while (x && g++ < 10) { c.push(x); x = j.countries[x]?.overlord; } return c; };
const topOf = (j, t) => chainOf(j, t).at(-1) || t;
const held = (j, t) => new Set(j.countries[t]?.technologies_held || []);
const snapInfo = snaps.map(j => {
  const lvl = {}, host = {};
  for (const [t, c] of Object.entries(j.countries)) for (const [k, b] of Object.entries(c.buildings || {})) if (k.startsWith('building_dam_')) { lvl[k] = (lvl[k] || 0) + b.levels; host[k] ??= t; }
  const q = {};
  for (const [t, c] of Object.entries(j.countries)) for (const [k, v] of Object.entries(c.queues?.government?.by_type || {})) if (k.startsWith('building_dam_')) q[`${t}|${k}`] = v;
  return { j, date: dateOf(j), lvl, host, q };
});

// candidates to build dam k at snapshot s, other than `builder`: rights (the host, its chain; investment rights NOT visible
// in a save summary, so not counted), a survey (own completed, or a family survey and in the host's top-overlord family),
// and the technology for the next level
function candidates(s, k, builder) {
  const { j, host, lvl } = snapInfo[s]; const h = host[k]; if (!h) return [];
  const rights = [h, ...chainOf(j, h)];
  const fam = topOf(j, h);
  const need = techsFor(k, lvl[k] || 0);
  return rights.filter(t => t !== builder && ((surveyTags[k]?.has(t)) || (familyDam.has(k) && topOf(j, t) === fam)) && need.every(x => held(j, t).has(x)));
}

// ---- queue elements: per (builder, dam), segmented where points left jump up ----
const series = {};
snapInfo.forEach((s, i) => { for (const [key, v] of Object.entries(s.q)) (series[key] ??= []).push({ i, ...v }); });
const elems = [];
for (const [key, s] of Object.entries(series)) {
  const [builder, k] = key.split('|'); const cost = dams[k].cost;
  let seg = [s[0]]; const segs = [];
  for (let x = 1; x < s.length; x++) { if (s[x].i !== s[x - 1].i + 1 || s[x].left > s[x - 1].left + 1 || s[x].n !== s[x - 1].n) { segs.push(seg); seg = []; } seg.push(s[x]); }
  segs.push(seg);
  for (const g of segs) {
    const first = g[0], last = g.at(-1), endI = last.i + 1;
    const full = first.n * cost;
    const lvlBefore = snapInfo[first.i].lvl[k] || 0;
    let outcome;
    if (endI >= snapInfo.length) outcome = 'still queued';
    else { const la = Math.min(snapInfo.length - 1, endI + 4); const lvlAfter = Math.max(...snapInfo.slice(endI, la + 1).map(x => x.lvl[k] || 0)); outcome = lvlAfter > (snapInfo[last.i].lvl[k] || 0) ? 'built' : 'gone'; }
    const progressed = last.left < full - 1 || outcome === 'built';
    // stall: 5 consecutive snapshots (>= 12 months) with points left unchanged
    let stall = null, run0 = 0;
    for (let x = 1; x < g.length; x++) { if (Math.abs(g[x].left - g[x - 1].left) < 1) { run0++; if (run0 >= 4 && !stall) stall = { from: x - 4, to: x }; if (stall) stall.to = x; } else run0 = 0; }
    let stallInfo = null;
    if (stall) {
      const quarters = stall.to - stall.from;
      const cands = new Set(); for (let x = stall.from; x <= stall.to; x++) for (const c of candidates(g[x].i, k, builder)) cands.add(c);
      stallInfo = { quarters, since: snapInfo[g[stall.from].i].date, until: snapInfo[g[stall.to].i].date, beforeProgress: g[stall.from].left >= full - 1, cands: [...cands] };
    }
    const h0 = snapInfo[first.i].host[k], jb = snapInfo[first.i].j;
    const rel = builder === h0 ? 'own' : chainOf(jb, h0).includes(builder) ? 'overlord' : 'outside chain';
    let cause = null;
    if (outcome === 'gone') {
      const je = snapInfo[endI].j, hE = snapInfo[endI].host[k];
      if (hE && hE !== h0) cause = `state changed hands (${h0} -> ${hE})`;
      else if (!je.countries[builder]) cause = `builder ${builder} ceased to exist`;
      else if (rel === 'overlord' && !chainOf(je, h0).includes(builder)) cause = `subject status lost (${h0} left ${builder})`;
      else if (rel === 'outside chain') cause = 'builder outside the chain (investment-rights case)';
      else cause = 'other';
    }
    elems.push({ builder, k, host: h0, rel, n: first.n, from: snapInfo[first.i].date, to: snapInfo[last.i].date, quarters: g.length, outcome, progressed,
      builtShare: Math.max(0, Math.min(1, 1 - last.left / full)), stall: stallInfo, cause, lvlBefore });
  }
}

// ---- monthly log: cancellations ----
const mon = {}; for (const l of L) if (l[1] === "probe_lvl" || l[1] === "probe_q") { const d = new Date(l[4]); ((mon[l[2]] ??= {})[+d] ??= {})[l[1]] = +l[3].split("/")[0]; }
const cancels = [];
for (const [dam, m] of Object.entries(mon)) { const ts = Object.keys(m).map(Number).sort((a, b) => a - b); for (let x = 1; x < ts.length; x++) { const a = m[ts[x - 1]], b = m[ts[x]]; if (a.probe_q != null && b.probe_q != null && b.probe_q < a.probe_q && (b.probe_lvl ?? 0) <= (a.probe_lvl ?? 0)) cancels.push({ dam, date: new Date(ts[x]).toISOString().slice(0, 7), q: a.probe_q + "->" + b.probe_q, lvl: b.probe_lvl }); } }
// building record vanished while a level was still queued above the built count (the log stops before the run ends)
const lastMonth = Math.max(...Object.values(mon).flatMap(m => Object.keys(m).map(Number)));
for (const [dam, m] of Object.entries(mon)) { const ts = Object.keys(m).map(Number).sort((a, b) => a - b); const e = m[ts.at(-1)]; if (ts.at(-1) < lastMonth - 40 * 864e5 && (e.probe_q ?? 0) > (e.probe_lvl ?? 0)) cancels.push({ dam, date: new Date(ts.at(-1) + 31 * 864e5).toISOString().slice(0, 7), q: e.probe_q + "->record gone", lvl: e.probe_lvl }); }
const toD = x => { const [y, m, d] = x.split(/[.-]/).map(Number); return Date.UTC(y, m - 1, d || 1); };
const confirmed = e => cancels.some(c => "building_dam_" + c.dam === e.k && toD(c.date) - toD(e.to) > -100 * 864e5 && toD(c.date) - toD(e.to) < 620 * 864e5);
// ---- report ----
const lastS = snapInfo.at(-1);
const builtDams = Object.entries(lastS.lvl).filter(([, v]) => v > 0);
const levelsBuilt = builtDams.reduce((a, [, v]) => a + v, 0);
const complete = builtDams.filter(([k, v]) => v >= dams[k].cap).length;
console.log(`run ${path.basename(run)} · last save ${lastS.date} · ${snapInfo.length} quarterly saves`);
console.log(`SURVEYS: started ${ev('survey_start').length}, completed ${ev('survey_complete').length} (over ${new Set(ev('survey_complete').map(l => l[2])).size} dams), abandoned ${ev('survey_ended').length}, family surveys ${ev('family_survey').length}` +
  (unresolved.size ? ` · unresolved names: ${[...unresolved].join(', ')}` : ''));
console.log(`BUILT at the last save: ${levelsBuilt} levels on ${builtDams.length} of 144 dams, ${complete} complete (of ${Object.values(dams).reduce((a, d) => a + d.cap, 0)} levels in all)`);
const by = f => elems.filter(f);
console.log(`QUEUE ELEMENTS (builder x dam x contiguous stay): ${elems.length} · built ${by(e => e.outcome === 'built').length} · still queued at the end ${by(e => e.outcome === 'still queued').length} · gone ${by(e => e.outcome === 'gone').length}`);
console.log(`  builder relation: own ${by(e => e.rel === 'own').length} · overlord ${by(e => e.rel === 'overlord').length} · outside chain ${by(e => e.rel === 'outside chain').length}`);
const st = by(e => e.stall);
console.log(`STALLED (>= 1 year queued with no progress): ${st.length} elements · blocking a candidate ${st.filter(e => e.stall.cands.length).length} · no other candidate ${st.filter(e => !e.stall.cands.length).length}`);
for (const e of st) console.log(`   ${e.k.slice(13).padEnd(28)} builder ${e.builder} (${e.rel}, host ${e.host}) ${e.stall.beforeProgress ? 'never started' : 'paused mid-build'} ${e.stall.since}..${e.stall.until} (${e.stall.quarters} q) · outcome ${e.outcome}, ${Math.round(100 * e.builtShare)}% built${e.stall.cands.length ? ' · BLOCKING ' + e.stall.cands.join(',') : ''}`);
const gone = by(e => e.outcome === 'gone');
console.log(`GONE without a level: ${gone.length} · with progress (WASTED) ${gone.filter(e => e.progressed).length} · unstarted ${gone.filter(e => !e.progressed).length}`);
console.log(`MONTHLY LOG: cancelled queued levels (queued fell, built did not rise): ${cancels.length}`); for (const c of cancels) console.log(`   ${c.dam.padEnd(28)} ${c.date} queued ${c.q} built ${c.lvl}`);
console.log(`CONFIRMED by the monthly log: ${gone.filter(confirmed).length} of ${gone.length} (avg built ${Math.round(100*gone.filter(confirmed).reduce((a,e)=>a+e.builtShare,0)/Math.max(1,gone.filter(confirmed).length))}%)`);
for (const e of gone) console.log(`   ${confirmed(e) ? "CONFIRMED" : "unconfirmed"} ${e.k.slice(13).padEnd(28)} builder ${e.builder} (${e.rel}, host ${e.host}) queued ${e.from}..${e.to} · ${Math.round(100 * e.builtShare)}% built · ${e.cause}`);
