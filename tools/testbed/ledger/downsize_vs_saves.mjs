// The downsizing poll checked against a run's own saves (F261): every drop the saves show on a qualifying building, matched with the
// poll's DZ lines by building id and month.
//
//   1. keep the run's saves (run_schedule.ps1 -KeepSaves, monthly autosaves for a fine check) and extract each one:
//        <rakaly> melt --format vic3 --unknown-key stringify -c <save.v3> | node tools/testbed/ledger/downsize_series.mjs extract <dir>/<name>.json
//   2. node tools/testbed/ledger/downsize_vs_saves.mjs <extract dir> <run dir>/harness.log
//
// Save side: a building that qualified at the earlier save (not wholly government-owned, levels − staffing ≥ 1, staffing < 0.9 × levels;
// government, military, ownership, urban-centre and trade-centre types left out, as in downsize_series.mjs) and has fewer levels at the
// next. Poll side: the DZ lines with the building id of the DZX line after each, counted once per date and id (harness.log can hold a
// line twice, its place names decoded two ways). A poll drop matches a save drop of the same id within ~2 months. Prints matched, the
// same size, the same private split, and the unmatched on each side (the first eight); a poll line later than the last save, or the
// month before a continuation's second poll, cannot match by construction.
import fs from 'node:fs';
const [dir, log] = process.argv.slice(2);
if (!dir || !log) { console.error('usage: downsize_vs_saves.mjs <dir of downsize_series extracts> <harness.log>'); process.exit(2); }
const MON = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };
const dkey = d => {
  if (/^\d+\.\d+\.\d+$/.test(d)) { const [y, m, dd] = d.split('.').map(Number); return y * 10000 + m * 100 + dd; }
  const m = /^(\w+) (\d+), (\d+)$/.exec(d.trim()); if (!m) throw new Error(`unreadable date '${d}'`);
  return +m[3] * 10000 + MON[m[1]] * 100 + +m[2];
};
const months = (a, b) => { const y = k => Math.floor(k / 10000), m = k => Math.floor(k / 100) % 100; return Math.abs((y(a) * 12 + m(a)) - (y(b) * 12 + m(b))); };
const SKIP = /conscription|barrack|naval_base|subsistence|government_administration|construction_sector|university|port$|railway|manor_house|financial_district|building_company_|regional_company|urban_center|trade_center|logistics|naval_admin|fortification|monument|canal/;
const byDate = new Map();
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { const s = JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8')); byDate.set(dkey(s.date), s); }
const S = [...byDate.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]);
if (S.length < 2) throw new Error(`${S.length} save extract(s) in ${dir}: need two or more`);
const sd = [];
for (let i = 1; i < S.length; i++) {
  const a = S[i - 1], b = S[i];
  for (const [id, r] of Object.entries(a.b)) {
    const [type, , , L, P, , staff] = r;
    if (SKIP.test(type) || !(P > 0 && L - staff >= 0.99 && staff < 0.9 * L)) continue;
    const n = b.b[id]; if (!n || n[3] >= L) continue;
    sd.push({ id, from: a.date, to: b.date, k: dkey(b.date), type, L0: L, L1: n[3], P0: P, P1: n[4], G0: r[5], G1: n[5] });
  }
}
const lines = fs.readFileSync(log, 'utf8').split(/\r?\n/), seen = new Set(), pd = [];
let dupes = 0;
for (let i = 0; i < lines.length; i++) {
  const f = lines[i].split('|');
  if (f[2] !== 'DZ') continue;
  const x = (lines[i + 1] || '').split('|');
  const id = x[2] === 'DZX' && x[3] === f[3] && x[6] === f[6] ? (/id=([^|\s]+)/.exec(lines[i + 1]) || [])[1] : null;
  const key = id === '-1' ? `vanished|${i}` : `${f[3]}|${id}`;
  if (seen.has(key)) { dupes++; continue; }
  seen.add(key);
  pd.push({ date: f[3], k: dkey(f[3]), country: f[4], state: f[5], type: f[6], L0: +f[7], L1: +f[8], P0: +f[9], P1: +f[10], id });
}
const used = new Set(); let match = 0, sizeEq = 0, privEq = 0; const pOnly = [];
for (const p of pd) {
  const c = sd.findIndex((s, j) => !used.has(j) && s.id === p.id && months(s.k, p.k) <= 2);
  if (c < 0) { pOnly.push(p); continue; }
  used.add(c); match++; const s = sd[c];
  if (s.L0 - s.L1 === p.L0 - p.L1) sizeEq++;
  if (s.P0 === p.P0 && s.P1 === p.P1) privEq++;
}
const sOnly = sd.filter((s, j) => !used.has(j));
const last = dkey(S.at(-1).date);
console.log(`saves ${S.length} (${S[0].date} .. ${S.at(-1).date}); save-side drops ${sd.length}; poll drops ${pd.length} (${dupes} duplicate line(s) dropped)`);
console.log(`matched ${match}: same size ${sizeEq}, same private split ${privEq}; save-only ${sOnly.length}; poll-only ${pOnly.length} `
  + `(${pOnly.filter(p => p.k > last).length} later than the last save)`);
for (const s of sOnly.slice(0, 8)) console.log(`  save-only ${s.from} -> ${s.to}  ${s.type}  id ${s.id}  ${s.L0}->${s.L1}  private ${s.P0}->${s.P1}  government ${s.G0}->${s.G1}`);
for (const p of pOnly.filter(p => p.k <= last).slice(0, 8)) console.log(`  poll-only ${p.date}  ${p.type}  ${p.country} / ${p.state}  ${p.L0}->${p.L1}  private ${p.P0}->${p.P1}  id ${p.id}`);
