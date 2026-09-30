// WHICH PROFESSION IS MISSING IN AN UNDERSTAFFED CRAFT? (BALANCE_FRAMEWORK §10.91.1, FINDINGS F184 §4, 2026-09-30)
//
//   node tools/testbed/ledger/craft_fill.mjs <save.v3> <book.json> [--min-levels 10] [--top 40]
//
// Out of one save (streamed rakaly melt): every craft building's levels, staffed levels, failed-hire and auto-downsize dates and
// profit, and its WORKERS BY PROFESSION, joined through the pop table's `workplace`, against the book's own per-level staffing ×
// levels (the base block only — a kept secondary adds a few shopkeepers or laborers on top, so a fill can exceed 100%). Rows are
// per country and industry, worst occupancy first. The question it answers: is an understaffed craft short of ONE profession (the
// machinist literacy gate, F180 §2) or of every profession alike (hiring, or a dying building)?
// ⚠⚠ A POP'S `workplace` IS THE BUILDING RECORD'S FULL ID. A record id carries a generation prefix once its slot has been reused
//   (slot + k·2^24), and the pop's handle carries the same prefix: reducing the handle modulo 2^24 loses every worker of a reused
//   slot. The first cut of this reader did that; harmless at 1836–1838 (first-generation ids), wrong by 1866.
// ⚠ A building's `staffing` field is STAFFED LEVELS, not a share: occupancy = staffing ÷ levels.
// ⚠ Rows are keyed by the country's TAG through the states database, so two countries sharing one definition (a revolution's rebel
//   side) are summed together here — unlike the save summaries, which keep one of them.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const [SAVE, BOOK] = args.filter(a => !a.startsWith('--') && !/^\d+$/.test(a));
if (!SAVE || !BOOK) { console.error('usage: node tools/testbed/ledger/craft_fill.mjs <save.v3> <book.json> [--min-levels 10] [--top 40]'); process.exit(2); }
const MINLV = +argOf('--min-levels', 10), TOP = +argOf('--top', 40);
const cfg = JSON.parse(readFileSync(BOOK, 'utf8'));
const CRAFT = {};
for (const ind of cfg.industries) if (!ind.disabled) for (const t of ind.tiers) if (t.craft)
  CRAFT[t.key] = { ind: ind.id, emp: Object.fromEntries(Object.entries(t.employment || {}).map(([k, v]) => [k, v * (t.workforce_mult || 1)])) };
if (!Object.keys(CRAFT).length) throw new Error(`craft_fill: ${BOOK} carries no craft rung (tier.craft) — not a craft book`);
const rak = spawn(join(REPO, 'tools/vendor/rakaly/rakaly.exe'), ['melt', '--format', 'vic3', '--unknown-key', 'stringify', '-c', SAVE]);
let rakErr = ''; rak.stderr.on('data', d => { rakErr += d; });
const rakDone = new Promise((res, rej) => rak.on('close', code => code === 0 ? res() : rej(new Error(`rakaly exited ${code}: ${rakErr.slice(0, 300)}`))));
const rl = createInterface({ input: rak.stdout, crlfDelay: Infinity });
let mode = 'top', date = null, id = null, rec = null, pop = null, cid = null, sid = null;
const B = new Map(), tagOf = new Map(), stateCountry = new Map(), work = new Map();   // work: full building id -> {profession: workforce}
const closePop = () => { if (pop && pop.wp != null && pop.type) { const w = work.get(pop.wp) || {}; w[pop.type] = (w[pop.type] || 0) + pop.w; work.set(pop.wp, w); } pop = null; };
for await (const line of rl) {
  if (mode === 'top') {
    if (!date) { const d = /^date=(\d+\.\d+\.\d+)/.exec(line); if (d) { date = d[1]; continue; } }
    const s = /^([a-z_]+)=\{$/.exec(line); if (!s) continue;
    mode = ['building_manager', 'pops', 'country_manager', 'states'].includes(s[1]) ? s[1] : 'skip'; continue;
  }
  if (mode === 'skip') { if (line.charCodeAt(0) === 125) mode = 'top'; continue; }
  if (line.charCodeAt(0) === 125) { if (mode === 'pops') closePop(); mode = 'top'; id = cid = sid = null; rec = null; continue; }
  // records open at two tabs ("\t\t<id>={", or "\t\t<id>=none" for a freed slot); their own fields sit at three tabs
  if (line.startsWith('\t\t') && !line.startsWith('\t\t\t')) {
    const m = /^\t\t(\d+)=\{$/.exec(line);
    if (mode === 'pops') { closePop(); if (m) pop = { type: null, w: 0, wp: null }; }
    else if (mode === 'building_manager') { id = m ? +m[1] : null; rec = null; }
    else if (mode === 'country_manager') cid = m ? +m[1] : null;
    else if (mode === 'states') sid = m ? +m[1] : null;
    continue;
  }
  if (!line.startsWith('\t\t\t') || line.startsWith('\t\t\t\t')) continue;
  const t = line.slice(3);
  if (mode === 'country_manager' && cid !== null && t.startsWith('definition="')) tagOf.set(cid, t.slice(12, -1));
  else if (mode === 'states' && sid !== null && t.startsWith('country=')) stateCountry.set(sid, +t.slice(8));
  else if (mode === 'pops' && pop) {
    if (t.startsWith('type="')) pop.type = t.slice(6, -1);
    else if (t.startsWith('workforce=')) pop.w = +t.slice(10);
    else if (t.startsWith('workplace=')) pop.wp = +t.slice(10);   // the FULL record id — never reduce it (header)
  } else if (mode === 'building_manager' && id !== null) {
    if (t.startsWith('building="')) { const k = t.slice(10, -1); if (CRAFT[k]) { rec = { id, key: k }; B.set(id, rec); } }
    else if (rec) {
      let x;
      if ((x = /^levels=(\d+)$/.exec(t))) rec.levels = +x[1];
      else if ((x = /^state=(\d+)$/.exec(t))) rec.state = +x[1];
      else if ((x = /^staffing=([\d.]+)$/.exec(t))) rec.staffing = +x[1];
      else if ((x = /^last_failed_hire_date=([\d.]+)$/.exec(t))) rec.failed = x[1];
      else if ((x = /^auto_downsize_start_date=([\d.]+)$/.exec(t))) rec.downsize = x[1];
      else if ((x = /^profit_after_reserves=(-?[\d.]+)$/.exec(t))) rec.profit = +x[1];
    }
  }
}
closePop();
await rakDone;
if (!date || !tagOf.size || !stateCountry.size) throw new Error(`craft_fill: read date ${date}, ${tagOf.size} countries, ${stateCountry.size} states — the melt's layout moved?`);
const [sy] = date.split('.').map(Number);
const agg = {};
let joined = 0;
for (const r of B.values()) {
  const tag = tagOf.get(stateCountry.get(r.state)) || '?'; const w = work.get(r.id) || {};
  if (Object.keys(w).length) joined++;
  const need = CRAFT[r.key].emp;
  const a = agg[`${tag}|${CRAFT[r.key].ind}`] ||= { tag, ind: CRAFT[r.key].ind, n: 0, levels: 0, occ: 0, failed: 0, down: 0, profit: 0, have: {}, need: {} };
  a.n++; a.levels += r.levels || 0; a.occ += r.staffing || 0; a.profit += r.profit || 0;
  if (r.failed && +r.failed.split('.')[0] >= sy - 1) a.failed++;
  if (r.downsize) a.down++;
  for (const [p, v] of Object.entries(need)) a.need[p] = (a.need[p] || 0) + v * (r.levels || 0);
  for (const [p, v] of Object.entries(w)) a.have[p] = (a.have[p] || 0) + v;
}
const rows = Object.values(agg).filter(a => a.levels >= MINLV).sort((x, y) => (x.occ / x.levels) - (y.occ / y.levels));
const PROFS = [...new Set(Object.values(CRAFT).flatMap(c => Object.keys(c.emp)))];
console.log(`${date}: ${B.size} craft buildings, ${joined} with workers joined through the pop table. Per country and industry (≥ ${MINLV} levels),`);
console.log(`worst occupancy first. Fill = workers ÷ the base block's slots (a kept secondary's own jobs are not in the slots, so a fill can exceed 100%).`);
console.log('country  industry     bldg  levels  occupancy  failed hire ≤1y  downsize flag  profit £/wk' + PROFS.map(p => p.padStart(15)).join('') + '    (other workers)');
const fill = (a, p) => a.need[p] ? `${Math.round((a.have[p] || 0) / a.need[p] * 100)}%`.padStart(5) + ` of ${Math.round(a.need[p] / 1000)}k` : '';
for (const a of rows.slice(0, TOP)) {
  const other = Object.entries(a.have).filter(([p]) => !a.need[p]).map(([p, v]) => `${p} ${Math.round(v / 1000)}k`).join(' ');
  console.log(`${a.tag.padEnd(8)} ${a.ind.padEnd(10)} ${String(a.n).padStart(5)} ${String(a.levels).padStart(7)} ${((a.occ / a.levels) * 100).toFixed(0).padStart(9)}% ${String(a.failed).padStart(10)}/${a.n} ${String(a.down).padStart(10)}/${a.n} ${Math.round(a.profit).toString().padStart(11)}  ` + PROFS.map(p => fill(a, p).padStart(15)).join('') + `   ${other}`);
}
