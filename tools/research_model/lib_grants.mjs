// THE RESEARCH-ENTRY GRANTS A RUN ACTUALLY RECEIVED, DATED AND KEYED (BALANCE_FRAMEWORK §10.96) — the model's input for a book with research
// journal entries. From the run's debug.log mirror:
//   · `PMR_JE|<stage>|<tech key>|<country display name>` — one completed stage (inception / development / implementation); each grants
//     grant_fraction × the tech's era cost (the run's own config, default 0.5; emit_research_events.mjs);
//   · dated by the nearest PRECEDING `V3TB|<token>|TECH|<country>|<in-game date>|<tech name>` line (tech_log telemetry): the two are written
//     to one log in game order, and TECH lines arrive many times a month;
//   · the display name is mapped to the save summaries' country KEY by matching each name's acquisitions (TECH lines, tech names → keys
//     through the English localisation, vanilla + the emitted mod) against each key's held-set changes year by year — the key that explains
//     most of a name's acquisitions wins. Display names change with governments, which is why the match is per name, not per tag.
// ⚠ Lines before the run's own token are another run's (the mirror copies the shared ring — the je_tally rule); completions are de-duplicated
// on (stage, tech, country) because the mirror can re-copy a chunk (landmine L28).
import fs from 'node:fs'; import path from 'node:path';
import { GAME } from './lib_tree.mjs';
const MONTHS = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };
const parseDate = s => { const m = /^([A-Za-z]+) (\d+), (\d{4})$/.exec(s.trim()); return m ? +m[3] + (MONTHS[m[1]] - 1) / 12 + (+m[2] - 1) / 365 : null; };
function techNames(modDir) {
  const name2key = new Map();
  const read = f => { for (const m of fs.readFileSync(f, 'utf8').matchAll(/^\s*([a-z_0-9\-]+):\d*\s+"([^"]*)"/gm)) if (!name2key.has(m[2])) name2key.set(m[2], m[1]); };
  if (modDir) { const d = path.join(modDir, 'localization/english/replace/zzz_pm_rehaul_tech_l_english.yml'); if (fs.existsSync(d)) read(d); }
  read(path.join(GAME, 'localization/english/inventions_l_english.yml'));
  return name2key;
}
// paths: lib_paths output for the same run (used for the name → key match); tree: lib_tree output
export function extractGrants(runDir, tree, paths, { modDir = null, grantFraction = null } = {}) {
  const meta = JSON.parse(fs.readFileSync(path.join(runDir, 'meta.json'), 'utf8')); const tok = meta.token;
  let gf = grantFraction;
  if (gf == null) { try { const bs = JSON.parse(fs.readFileSync(path.join(runDir, 'build_state.json'), 'utf8'));
    const cfgPath = bs.deterministic?.mod_under_test?.built_from_config; const cfg = JSON.parse(fs.readFileSync(path.resolve(path.dirname(runDir), '../../../..', cfgPath), 'utf8'));
    gf = cfg.research_events?.grant_fraction ?? 0.5; } catch { gf = 0.5; } }
  const name2key = techNames(modDir);
  const lines = fs.readFileSync(path.join(runDir, 'logs_live/debug.log'), 'utf8').split(/\r?\n/);
  let start = lines.findIndex(l => l.includes(tok)); if (start < 0) start = 0;
  let curDate = 1836; const seen = new Set(); const je = []; const acq = new Map();   // name -> [{y, key}]
  for (let i = start; i < lines.length; i++) {
    const l = lines[i];
    let m = /V3TB\|([^|]+)\|TECH\|([^|]+)\|([^|]+)\|(.+)$/.exec(l);
    if (m && m[1] === tok) { const d = parseDate(m[3]); if (d) curDate = d; const k = name2key.get(m[4].trim());
      if (k) { if (!acq.has(m[2])) acq.set(m[2], []); acq.get(m[2]).push({ y: d ?? curDate, k }); } continue; }
    m = /PMR_JE\|(inception|development|implementation)\|([a-z_0-9\-]+)\|(.+)$/.exec(l);
    if (m) { const id = `${m[1]}|${m[2]}|${m[3].trim()}`; if (seen.has(id)) continue; seen.add(id); je.push({ stage: m[1], tech: m[2], name: m[3].trim(), y: curDate }); }
  }
  // name → key: per year of acquisition, the keys whose held set gained that tech between the year's summary and the next
  const gain = {}; const ys = paths.years;
  for (let i = 0; i + 1 < ys.length; i++) { const A = paths.at[ys[i]], B = paths.at[ys[i + 1]];
    for (const [k, b] of Object.entries(B)) { const a = A[k]; if (!a) continue; const ha = new Set(a.held);
      for (const t of b.held) if (!ha.has(t)) { const key = `${ys[i]}|${t}`; (gain[key] ||= []).push(k); } } }
  const yearOf = y => { let best = ys[0]; for (const v of ys) if (v <= y) best = v; return best; };
  const nameKey = new Map();
  for (const [name, list] of acq) { const score = {};
    for (const { y, k } of list) for (const key of gain[`${yearOf(y)}|${k}`] || []) score[key] = (score[key] || 0) + 1;
    const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0]; if (best && best[1] >= Math.max(2, 0.3 * list.length)) nameKey.set(name, best[0]); }
  const out = {}; let unmapped = 0;
  for (const g of je) { const k = nameKey.get(g.name); const t = tree.techs[g.tech]; if (!k || !t) { unmapped++; continue; }
    (out[k] ||= []).push({ y: g.y, tech: g.tech, pts: Math.round(tree.eraCost[t.era] * gf), stage: g.stage }); }
  return { grants: out, stats: { completions: je.length, unmapped, names: acq.size, mapped: nameKey.size, grantFraction: gf } };
}
