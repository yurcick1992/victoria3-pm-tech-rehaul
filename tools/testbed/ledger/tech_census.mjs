// ⭐ THE TECHNOLOGY CENSUS AT THE END OF A RUN, ACROSS ARMS (2026-10-05, the extra research entries' batch; BALANCE_FRAMEWORK §10.95).
//
//   node tools/testbed/ledger/tech_census.mjs <label>=<session>[,<session>][:<setup>] [...] [--tree config/tech_tree_options.json] [--top-era 5]
//
// Read on each run's LAST yearly save summary (the 1936 endpoint), except the anchors:
//   A. TOP-LEVEL TECHNOLOGIES (the last game era, --top-era): per technology, how many countries hold it — every main country record, two
//      countries count twice — the mean per run, and in how many runs anyone does (user, 2026-10-05).
//   B. THE TECH MAJORS, individually: GBR USA NET BEL FRA PRU SWE and the upgraded NET and PRU (UNL, NGF, GER); a tag absent from a run is
//      dropped for that run, never replaced (user, 2026-10-05). Mean technologies held, total and per tree, over the runs where it exists.
//   C. THE TOP TEN INDEPENDENT COUNTRIES BY GDP that are NOT in B's list (no overlord), per run: their mean technologies held, and who they are.
//   D. THE ANCHOR PRINCIPLE (CLAUDE.md): at 1875 / 1905 / the end, the share of game era 3 / 4 / 5 technologies held by the run's TECH LEADER
//      (most technologies held) and by its third — "a technology leader should hold about half of that era's technologies at the anchor year".
//   E. RELIANCE ON THE RESEARCH ENTRIES, for B's countries: of the technologies acquired after the first summary, the share with at least one
//      entry stage completed (a stage can only complete while the technology is unheld), and the entries' grants (stages × half the era base
//      cost) as a share of the era base cost of those acquisitions. From the run's debug.log mirror (PMR_JE lines, display names; windowed
//      by the run's telemetry token and de-duplicated, as je_tally.mjs does).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { usableRuns } from './lib_runs.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const SES = join(REPO, 'tools/testbed/sessions');
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const TREE = JSON.parse(readFileSync(join(REPO, opt('--tree', 'config/tech_tree_options.json')), 'utf8')).options.find(o => o.ships);
const T = Object.fromEntries(TREE.techs.map(t => [t.id, t]));
const TOP = +opt('--top-era', '5');
const CATS = ['production', 'military', 'society'];
const MAJ = ['GBR', 'USA', 'NET', 'BEL', 'FRA', 'PRU', 'SWE', 'UNL', 'NGF', 'GER'];
const NAMES = { GBR: ['Great Britain', 'British Republic', 'United Kingdom', 'British Empire'], USA: ['United States of America', 'United States'],
  FRA: ['France', 'French Republic', 'French Commune', 'French Empire', 'Kingdom of France'], NET: ['Netherlands'], BEL: ['Belgium', 'United Belgian States'],
  UNL: ['United Netherlands'], PRU: ['Prussia'], NGF: ['North German Federation'], GER: ['German Empire', 'Germany'], SWE: ['Sweden'] };
const TAG_OF_NAME = Object.fromEntries(Object.entries(NAMES).flatMap(([t, ns]) => ns.map(n => [n, t])));
const ERACOST = {};
for (const f of readdirSync(join(GAME, 'common/technology/eras'))) for (const m of readFileSync(join(GAME, 'common/technology/eras', f), 'utf8').matchAll(/era_(\d+)\s*=\s*\{[^}]*?technology_cost\s*=\s*(\d+)/g)) ERACOST[+m[1]] = +m[2];
const arms = args.filter((a, i) => a.includes('=') && !args[i - 1]?.startsWith('--')).map(a => {
  const [label, rest] = a.split('='); const [ses, setup = ''] = rest.split(':');
  return { label, runs: ses.split(',').flatMap(s => usableRuns(SES, s, setup).runs) };
});
if (!arms.length) { console.error('usage: tech_census.mjs <label>=<session>[,<session>][:<setup>] ...'); process.exit(2); }
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const f1 = x => Number.isFinite(x) ? x.toFixed(1) : '—';
const catCount = held => Object.fromEntries(CATS.map(c => [c, held.filter(t => T[t] && T[t].category === c).length]));

function readRun(rel) {
  const dir = join(SES, rel, 'save_summaries'); const byYear = {};
  for (const f of readdirSync(dir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort()) {
    const j = JSON.parse(gunzipSync(readFileSync(join(dir, f))).toString());
    const y = +String(j.provenance.date).split('.')[0]; if (byYear[y]) continue;
    const c = {}; for (const [k, v] of Object.entries(j.countries)) if (!k.includes('@')) c[k] = { held: v.technologies_held || [], gdp: v.gdp || 0, overlord: v.overlord || null };
    byYear[y] = c;
  }
  const ys = Object.keys(byYear).map(Number).sort((a, b) => a - b);
  // the run's entry completions, unique (country, technology, stage)
  const comp = [], compAll = [];
  const dbg = join(SES, rel, 'logs_live', 'debug.log');
  if (existsSync(dbg)) {
    const [session, run] = rel.split('/');
    const lines = readFileSync(dbg, 'utf8').split('\n'); const token = `|${session.slice(0, 15)}s${run.slice(3, 6)}|`;
    let start = lines.findIndex(l => l.includes(token)); if (start < 0) start = 0; const seen = new Set();
    for (let i = start; i < lines.length; i++) { const m = lines[i].match(/PMR_JE\|([a-z]+)\|([a-z_0-9]+)\|(.*?)\s*$/); if (!m) continue;
      const name = m[3].trim(); const k = `${name}|${m[2]}|${m[1]}`; if (seen.has(k)) continue; seen.add(k);
      compAll.push({ name, tech: m[2], stage: m[1] });
      const tag = TAG_OF_NAME[name]; if (tag) comp.push({ tag, tech: m[2], stage: m[1] }); }
  }
  return { byYear, ys, first: byYear[ys[0]], last: byYear[ys[ys.length - 1]], lastYear: ys[ys.length - 1], comp, compAll, hasLog: existsSync(dbg) };
}
const at = (R, y) => { const k = R.ys.find(x => x >= y); return k != null ? R.byYear[k] : null; };

for (const a of arms) {
  a.R = a.runs.map(readRun).filter(R => R.ys.length);
  console.log(`\n================ ${a.label}: ${a.R.length} run(s), endpoints ${[...new Set(a.R.map(R => R.lastYear))].join('/')}`);
  // A
  const top = TREE.techs.filter(t => t.era === TOP).sort((p, q) => p.category.localeCompare(q.category) || (p.onset ?? 0) - (q.onset ?? 0));
  console.log(`A. game-era-${TOP} technologies: countries holding each at the end — mean per run (runs where anyone holds it)`);
  for (const c of CATS) {
    const rows = top.filter(t => t.category === c).map(t => { const per = a.R.map(R => Object.values(R.last).filter(x => x.held.includes(t.id)).length);
      return `${t.id} ${f1(mean(per))} (${per.filter(x => x > 0).length})`; });
    console.log(`   ${c}: ` + rows.join(' · '));
  }
  // B
  console.log('B. the tech majors, technologies held at the end (production / military / society), runs where the tag exists');
  const bRows = MAJ.map(tag => { const xs = a.R.map(R => R.last[tag]).filter(Boolean); if (!xs.length) return `${tag} —`;
    const cc = xs.map(x => catCount(x.held)); return `${tag} ${f1(mean(xs.map(x => x.held.length)))} (${CATS.map(c => f1(mean(cc.map(z => z[c])))).join('/')}; n ${xs.length})`; });
  console.log('   ' + bRows.slice(0, 5).join(' · ') + '\n   ' + bRows.slice(5).join(' · '));
  // C
  const cTech = [], who = {};
  for (const R of a.R) { const ten = Object.entries(R.last).filter(([k, v]) => !MAJ.includes(k) && !v.overlord).sort((p, q) => q[1].gdp - p[1].gdp).slice(0, 10);
    for (const [k, v] of ten) { cTech.push(v.held.length); who[k] = (who[k] || 0) + 1; } }
  console.log(`C. the top ten independents by GDP outside B's list: mean ${f1(mean(cTech))} technologies (median ${med(cTech)}); members: ` +
    Object.entries(who).sort((p, q) => q[1] - p[1]).map(([k, n]) => `${k}×${n}`).join(' '));
  // D
  const anchors = [[1875, 3], [1905, 4], [9999, 5]];
  const d = anchors.map(([y, era]) => { const ids = TREE.techs.filter(t => t.era === era).map(t => t.id);
    const lead = [], third = [];
    for (const R of a.R) { const S = y === 9999 ? R.last : at(R, y); if (!S) continue; const rank = Object.values(S).sort((p, q) => q.held.length - p.held.length);
      const share = x => x ? x.held.filter(t => ids.includes(t)).length / ids.length : NaN; lead.push(share(rank[0])); third.push(share(rank[2])); }
    return `${y === 9999 ? 'end' : y} game era ${era}: leader ${f1(100 * med(lead))}%, third ${f1(100 * med(third))}%`; });
  console.log('D. anchor principle (median over runs; the aim is about half for the leader): ' + d.join(' · '));
  // E
  if (a.R.every(R => R.hasLog)) {
    const per = {}; let help = 0, acq = 0, grant = 0, cost = 0;
    for (const R of a.R) for (const tag of MAJ) { const e = R.last[tag], s = R.first[tag]; if (!e) continue;
      const before = new Set(s ? s.held : []); const got = e.held.filter(t => !before.has(t) && T[t]);
      const stages = {}; for (const c of R.comp) if (c.tag === tag) stages[c.tech] = (stages[c.tech] || 0) + 1;
      const h = got.filter(t => stages[t]).length; const g = got.reduce((x, t) => x + (stages[t] || 0) * 0.5 * (ERACOST[T[t].era] || 0), 0);
      const k = got.reduce((x, t) => x + (ERACOST[T[t].era] || 0), 0);
      (per[tag] ||= { help: 0, acq: 0, grant: 0, cost: 0 }); per[tag].help += h; per[tag].acq += got.length; per[tag].grant += g; per[tag].cost += k;
      help += h; acq += got.length; grant += g; cost += k; }
    console.log(`E. reliance on the entries (B's countries pooled): ${f1(100 * help / acq)}% of acquisitions had an entry stage; entry grants ${f1(100 * grant / cost)}% of their base cost · ` +
      Object.entries(per).map(([t, p]) => `${t} ${f1(100 * p.help / p.acq)}%/${f1(100 * p.grant / p.cost)}%`).join(' '));
  } else console.log('E. reliance: no debug.log mirror in some runs — skipped');
  // F. WHO FIRES THEM: per technology of --techs (default: every technology with a completion), the countries completing at least one stage
  //    (mean per run) and how many of those are B's majors — a leaders' channel or a catch-up channel. Every display name counts here.
  if (a.R.every(R => R.hasLog) && args.includes('--who')) {
    const list = opt('--techs', null) ? opt('--techs', '').split(',') : [...new Set(a.R.flatMap(R => R.compAll.map(c => c.tech)))].sort();
    const rows = list.map(t => { const per = a.R.map(R => { const cs = new Set(R.compAll.filter(c => c.tech === t).map(c => c.name)); return [cs.size, [...cs].filter(n => TAG_OF_NAME[n]).length]; });
      return `${t} ${f1(mean(per.map(x => x[0])))} (majors ${f1(mean(per.map(x => x[1])))})`; });
    console.log('F. who fires them — countries completing a stage, mean per run (of which majors):\n   ' + rows.join(' · '));
  }
}
