// READS THE FINISH-BOOST DIAGNOSTICS (research_events.finish_boost.diag, emitted by tools/emit_tech_finish.mjs).
//
//   node tools/testbed/ledger/finish_probe.mjs --session <stamp> [--session <stamp> …]
//
// Answers four questions from a probe's own debug.log mirror:
//   Q1 does the engine's cost of a technology equal era_cost × (1 + F × Σ) — the reconstruction the boost relies on?
//   Q2 which reading of the one unresearchable technology (sericulture) the engine uses: COUNTED (sa) or skipped (sr)?
//   Q3 what `has_technology_progress = { progress >= p }` means (h50 / h100 against the engine's own progress ÷ cost)
//   Q4 how the AI treats a technology the journal entries have paid for: the wait from "finishable" (ENGINE TRUTH,
//      progress >= cost) to acquisition, and the share of research choices made while one was available that took it.
//
// ⚠ THE WINDOW IS A POSITION. A mirror begins with the ring's leftovers from the previous run; this run's lines start
//   at its own PM_TECH_REHAUL init marker (the last one before the telemetry token), falling back to the token.
// ⚠ THE LINES CARRY NO GAME DATE in the first probe's build. A country's month index is the count of its own PMR_RS
//   lines so far (one per monthly pulse), so latencies are in pulses, i.e. months. Lines with a `d=` field use it.
// ⚠ Countries are identified by DISPLAY NAME (there is no tag data function) — a rename splits a country in two.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { usableRuns, reportDropped } from './lib_runs.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const ROOT = join(REPO, 'tools', 'testbed', 'sessions');
const GAME = 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const args = process.argv.slice(2);
const sessions = []; for (let i = 0; i < args.length; i++) if (args[i] === '--session') sessions.push(args[++i]);
if (!sessions.length) { console.error('usage: finish_probe.mjs --session <stamp> [--session …]'); process.exit(2); }

const ERACOST = {};
for (const f of readdirSync(join(GAME, 'common/technology/eras')))
  for (const m of readFileSync(join(GAME, 'common/technology/eras', f), 'utf8').matchAll(/era_(\d+)\s*=\s*\{[^}]*?technology_cost\s*=\s*(\d+)/g)) ERACOST[+m[1]] = +m[2];
const F = 0.25;
const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '—';
const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const q = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

for (const session of sessions) {
  const { runs, dropped } = usableRuns(ROOT, session);
  reportDropped(dropped);
  for (const rel of runs) {
    const rdir = join(ROOT, rel);
    const logf = join(rdir, 'logs_live', 'debug.log');
    if (!existsSync(logf)) { console.log(`${rdir}: no logs_live/debug.log`); continue; }
    const lines = readFileSync(logf, 'utf8').split('\n');
    if (lines.some(l => l.includes('recovered 0 chars from []'))) console.log('  ⚠ mirror seam found (landmine L28) — counts may carry duplicates');
    const runName = rdir.split(/[\\/]/).pop();
    const token = `|${session.slice(0, 15)}s${runName.slice(3, 6)}|`;
    const tokAt = lines.findIndex(l => l.includes(token));
    let start = -1;
    for (let i = (tokAt >= 0 ? tokAt : lines.length) - 1; i >= 0; i--) if (lines[i].includes('PM_TECH_REHAUL') && /init/i.test(lines[i])) { start = i; break; }
    if (start < 0) start = Math.max(0, tokAt);
    const L = lines.slice(start).map(l => { const i = l.indexOf('PMR_'); return i >= 0 ? l.slice(i).trim() : null; }).filter(Boolean);
    console.log(`\n== ${session}/${runName} — ${L.length} PMR lines after position ${start} (${tokAt >= 0 ? 'token found' : 'NO token line'})`);

    // ---------- Q1 / Q2 : the penalty and sericulture ----------
    const holders = new Set(L.filter(l => l.startsWith('PMR_UNRES|')).map(l => l.split('|')[1]));
    const aot = L.filter(l => l.startsWith('PMR_AOT|')).map(l => { const p = l.split('|'); return { c: p[1], t: p[2], cat: p[3], era: +p[4], cost: +p[5], sa: +p[6], sr: +p[7] }; });
    const fit = { all: 0, res: 0, both: 0, none: 0 }, byGroup = {}, miss = [];
    for (const x of aot) {
      if (!Number.isFinite(x.cost) || !x.cost) { fit.none++; if (miss.length < 6) miss.push(x); continue; }
      const pa = Math.round(ERACOST[x.era] * (1 + F * x.sa)), pr = Math.round(ERACOST[x.era] * (1 + F * x.sr));
      const ma = Math.abs(pa - x.cost) <= 1, mr = Math.abs(pr - x.cost) <= 1;
      const g = `${x.cat}${x.sa !== x.sr ? ' (readings differ)' : ''}${holders.has(x.c) ? ' [holds sericulture]' : ''}`;
      const G = byGroup[g] ||= { n: 0, all: 0, res: 0 };
      G.n++; if (ma) G.all++; if (mr) G.res++;
      if (ma && mr) fit.both++; else if (ma) fit.all++; else if (mr) fit.res++; else { fit.none++; if (miss.length < 6) miss.push({ ...x, pa, pr }); }
    }
    console.log(`Q1/Q2 PMR_AOT: ${aot.length} lines, ${new Set(aot.map(x => x.c)).size} countries, sericulture holders seen ${holders.size} (${[...holders].slice(0, 12).join(', ')})`);
    console.log(`  engine cost == era_cost × (1 + ${F} × Σ):  both readings ${fit.both} · COUNTED only ${fit.all} · SKIPPED only ${fit.res} · neither ${fit.none}`);
    for (const [g, G] of Object.entries(byGroup).sort()) console.log(`    ${g.padEnd(46)} n=${String(G.n).padStart(6)}  counted-reading matches ${pct(G.all, G.n).padStart(6)}  skipped-reading matches ${pct(G.res, G.n).padStart(6)}`);
    for (const x of miss) console.log(`    ✗ ${x.c} | ${x.t} (${x.cat} e${x.era}) cost ${x.cost} vs counted ${x.pa ?? '?'} / skipped ${x.pr ?? '?'} (sa ${x.sa}, sr ${x.sr})`);

    // ---------- per-country month index ----------
    const month = {}; const rows = []; const finc = {};
    for (const l of L) {
      const p = l.split('|');
      if (p[0] === 'PMR_RS') { month[p[1]] = (month[p[1]] ?? -1) + 1; rows.push({ k: 'RS', c: p[1], m: month[p[1]], cur: p[2], nel: +(p[3] || '').replace('nel=', '') }); }
      else if (p[0] === 'PMR_FIN') { const o = Object.fromEntries(p.slice(5).map(s => s.split('='))); rows.push({ k: 'FIN', c: p[1], m: month[p[1]] ?? 0, t: p[2], cat: p[3], era: +p[4], K: +o.k, el: +o.el, sa: +o.sa, sr: +o.sr, h50: +o.h50, h100: +o.h100, cur: +o.cur }); }
      else if (p[0] === 'PMR_FINC') { const key = `${p[1]}|${p[2]}|${month[p[1]] ?? 0}`; finc[key] = { cost: +p[3], prog: +p[4] }; }
      else if (p[0] === 'PMR_PICK') rows.push({ k: 'PICK', c: p[1], m: month[p[1]] ?? 0, cur: p[2], nel: +(p[3] || '').replace('nel=', '') });
    }
    const fin = rows.filter(r => r.k === 'FIN').map(r => ({ ...r, ...(finc[`${r.c}|${r.t}|${r.m}`] || {}) }));
    const withCost = fin.filter(r => Number.isFinite(r.cost) && r.cost > 0);
    console.log(`\nFIN lines ${fin.length} (with engine cost ${withCost.length}), countries ${new Set(fin.map(r => r.c)).size}, technologies ${new Set(fin.map(r => r.t)).size}`);

    // ---------- Q3 : has_technology_progress ----------
    let h50ok = 0, h100ok = 0;
    for (const r of withCost) { if ((r.prog >= r.cost / 2 - 0.5) === (r.h50 === 1)) h50ok++; if ((r.prog >= r.cost - 0.5) === (r.h100 === 1)) h100ok++; }
    console.log(`Q3 has_technology_progress as a FRACTION OF COST:  h50 agrees ${pct(h50ok, withCost.length)} · h100 agrees ${pct(h100ok, withCost.length)}  (n=${withCost.length})`);
    const h100on = withCost.filter(r => r.h100 === 1).length; console.log(`    h100 true on ${h100on} lines; engine prog >= cost on ${withCost.filter(r => r.prog >= r.cost - 0.5).length}`);

    // ---------- our eligibility against engine truth ----------
    const cm = { tp: 0, fp: 0, fn: 0, tn: 0 }, fpx = [], fnx = [];
    for (const r of withCost) {
      const truth = r.prog >= r.cost - 0.5;
      if (r.el && truth) cm.tp++; else if (r.el) { cm.fp++; if (fpx.length < 5) fpx.push(r); } else if (truth) { cm.fn++; if (fnx.length < 5) fnx.push(r); } else cm.tn++;
    }
    console.log(`OUR CONDITION (shipping reading) vs ENGINE progress >= cost:  true+ ${cm.tp} · FALSE+ ${cm.fp} · missed ${cm.fn} · true− ${cm.tn}`);
    for (const r of fpx) console.log(`    FALSE+ ${r.c} ${r.t} k=${r.K} sa=${r.sa} sr=${r.sr} prog ${r.prog} < cost ${r.cost}`);
    for (const r of fnx) console.log(`    missed ${r.c} ${r.t} k=${r.K} sa=${r.sa} sr=${r.sr} prog ${r.prog} >= cost ${r.cost}`);
    // the same test under each reading, rebuilt offline, so the two can be compared on engine truth
    for (const [lab, key] of [['counted', 'sa'], ['skipped', 'sr']]) {
      let tp = 0, fp = 0, fn = 0;
      for (const r of withCost) { const ms = r.K >= 3 ? 2 : r.K >= 2 ? 0 : -1; const e = ms >= 0 && r[key] <= ms; const t = r.prog >= r.cost - 0.5; if (e && t) tp++; else if (e) fp++; else if (t) fn++; }
      console.log(`    reading "${lab}" rebuilt: true+ ${tp} · FALSE+ ${fp} · missed ${fn}`);
    }

    // ---------- Q4 : the wait, and the picks ----------
    const ep = {};                                              // (country|tech) -> months finishable
    for (const r of withCost) { const k = `${r.c}|${r.t}`; (ep[k] ||= []).push({ m: r.m, fin: r.prog >= r.cost - 0.5, cur: r.cur }); }
    const lastMonth = month;
    const waits = [], open = [];
    for (const [k, arr] of Object.entries(ep)) {
      const f = arr.find(a => a.fin); if (!f) continue;
      const last = arr[arr.length - 1];
      const c = k.split('|')[0];
      if (last.m < lastMonth[c]) waits.push(last.m - f.m + 1);   // disappeared ⇒ researched by the next pulse
      else open.push(lastMonth[c] - f.m + 1);                      // still waiting at the end of the run
    }
    console.log(`\nQ4 finishable episodes (engine truth): ${waits.length + open.length} — resolved ${waits.length}, still open at the end ${open.length}`);
    if (waits.length) console.log(`    months from first finishable pulse to acquired: median ${med(waits)} · p25 ${q(waits, 0.25)} · p75 ${q(waits, 0.75)} · p90 ${q(waits, 0.9)} · max ${Math.max(...waits)}`);
    if (open.length) console.log(`    open episodes, months waited so far: median ${med(open)} · max ${Math.max(...open)}`);
    const picks = rows.filter(r => r.k === 'PICK');
    const pn = picks.filter(p => p.nel > 0);
    const TREE = JSON.parse(readFileSync(join(REPO, 'config', 'tech_tree_options.json'), 'utf8')).options.find(o => o.ships).techs;
    const byName = TREE.map(t => [t.name, t.id]).sort((a, b) => b[0].length - a[0].length);
    const keyOf = s => { for (const [n, id] of byName) if (s.includes(n)) return id; return null; };
    // eligible set of a country at the last pulse before the pick
    const elAt = {}; for (const r of fin) if (r.el) ((elAt[r.c] ||= {})[r.m] ||= new Set()).add(r.t);
    let hit = 0, resolved = 0;
    for (const p of pn) { const t = keyOf(p.cur); if (!t) continue; resolved++; const s = (elAt[p.c] || {})[p.m] || (elAt[p.c] || {})[p.m - 1]; if (s && s.has(t)) hit++; }
    console.log(`    research choices: ${picks.length} logged, ${pn.length} made while nel > 0; of those resolvable to a key (${resolved}), ${hit} took an eligible technology (${pct(hit, resolved)})`);
  }
}
