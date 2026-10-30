// Auto-downsizing read from a series of saves (F260). The engine has no hook for it: a building that misses ≥ 1 privately held
// level of staffing and ≥ 10% of its staffing sets `auto_downsize_start_date` 6 months ahead, then loses one private level a week
// (`NEconomy.AUTO_DOWNSIZE_BUILDING_*`). The save keeps the timer, the levels, the staffing (in levels) and the owners, so a drop in
// private levels on a building that was understaffed at the earlier save is the event.
//
//   extract: <rakaly> melt --format vic3 --unknown-key stringify -c <save.v3> | node downsize_series.mjs extract <dir>/<name>.json
//            one compact JSON per save: { date, b: { id: [type, state, country, levels, private, government, staffing, timer, lastLayoff] } }
//   read:    node downsize_series.mjs read <dir>
//            every pair of consecutive saves is classified; quarterly pairs add the speed, the rebuild lag and the yearly and
//            half-yearly undercount against the quarterly count.
//
// A drop counts when total and private levels fall, government levels do not, the state keeps its owner, the building was understaffed
// at the earlier save (≥ 1 empty level and ≤ 90% staffed), and fewer than three buildings of its state lost levels (a split, a merger
// or a bombardment). Government, military, ownership, urban-centre and trade-centre buildings are left out (trade centres downsize on
// unused trade capacity, a rule of their own).
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const [mode, target] = process.argv.slice(2);
if (!['extract', 'read'].includes(mode) || !target) {
  console.error('usage: <rakaly melt -c save> | node downsize_series.mjs extract <out.json>\n       node downsize_series.mjs read <dir of extracts>');
  process.exit(2);
}

if (mode === 'extract') {
  const b = new Map(), own = new Map(), stOwner = new Map();
  let sec = '', cur = null, o = null, inIdent = false, date = null, st = null;
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.startsWith('\t')) {
      if (line.startsWith('date=')) date = line.slice(5);
      sec = line.startsWith('building_manager=') ? 'b' : line.startsWith('building_ownership_manager=') ? 'o' : line.startsWith('states=') ? 's' : '';
      continue;
    }
    let m;
    if (sec === 'b') {
      if ((m = /^\t\t(\d+)=\{$/.exec(line))) { cur = { type: null, state: null, levels: 0, staffing: 0, ad: null, ll: null }; b.set(+m[1], cur); continue; }
      if (!cur) continue;
      if (line === '\t\t}') { cur = null; continue; }
      if (!line.startsWith('\t\t\t') || line.startsWith('\t\t\t\t')) continue;
      const t = line.slice(3);
      if ((m = /^building="(.+)"$/.exec(t))) cur.type = m[1];
      else if ((m = /^levels=(\d+)$/.exec(t))) cur.levels = +m[1];
      else if ((m = /^state=(\d+)$/.exec(t))) cur.state = +m[1];
      else if ((m = /^staffing=([\d.]+)$/.exec(t))) cur.staffing = +m[1];
      else if ((m = /^auto_downsize_start_date=(.+)$/.exec(t))) cur.ad = m[1];
      else if ((m = /^last_layoff_date=(.+)$/.exec(t))) cur.ll = m[1];
    } else if (sec === 'o') {
      // an owner whose identity is a country is the government; any other identity (the building itself, a manor house, a financial
      // district, a company) is private
      if ((m = /^\t\t(\d+)=\{$/.exec(line))) { o = { levels: 0, gov: false, building: null }; continue; }
      if (!o) continue;
      const t = line.trim();
      if (t === 'identity={') inIdent = true;
      else if (inIdent && t === '}') inIdent = false;
      else if (inIdent && t.startsWith('country=')) o.gov = true;
      else if (!inIdent && (m = /^levels=(\d+)$/.exec(t))) o.levels = +m[1];
      else if (!inIdent && (m = /^building=(\d+)$/.exec(t))) o.building = +m[1];
      if (line === '\t\t}') {
        const r = own.get(o.building) ?? [0, 0];
        r[o.gov ? 1 : 0] += o.levels;
        own.set(o.building, r); o = null;
      }
    } else if (sec === 's') {
      if ((m = /^\t\t(\d+)=\{$/.exec(line))) { st = +m[1]; continue; }
      if (st != null && (m = /^\t\t\tcountry=(\d+)$/.exec(line))) stOwner.set(st, +m[1]);
    }
  }
  if (!date || !b.size) throw new Error(`no date or no buildings read (date ${date}, ${b.size} buildings): is stdin a melted save?`);
  const rec = {};
  for (const [id, x] of b) {
    const r = own.get(id) ?? [0, 0];
    rec[id] = [x.type, x.state, stOwner.get(x.state) ?? null, x.levels, r[0], r[1], +x.staffing.toFixed(3), x.ad, x.ll];
  }
  fs.writeFileSync(target, JSON.stringify({ date, b: rec }));
  console.log(`${date}: ${b.size} buildings -> ${target}`);
  process.exit(0);
}

// ---- read ----
const T = 0, ST = 1, C = 2, LV = 3, PRIV = 4, GOV = 5, STAFF = 6, AD = 7;
const dnum = d => { const [y, m, dd] = d.split('.').map(Number); return y * 10000 + m * 100 + dd; };
const days = d => { const [y, m, dd] = d.split('.').map(Number); return y * 365 + [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334][m - 1] + dd; };
let ser = fs.readdirSync(target).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(target, f), 'utf8')));
ser.sort((a, b) => dnum(a.date) - dnum(b.date));
const dup = ser.filter((s, i) => i > 0 && s.date === ser[i - 1].date).length;
ser = ser.filter((s, i) => i === 0 || s.date !== ser[i - 1].date);
if (ser.length < 2) throw new Error(`${ser.length} save(s) in ${target}: need at least two`);
console.log(`${ser.length} saves, ${ser[0].date} -> ${ser.at(-1).date}${dup ? ` (${dup} repeated dates dropped)` : ''}`);

const SKIP = /conscription|barrack|naval_base|subsistence|government_administration|construction_sector|university|port$|railway|manor_house|financial_district|building_company_|regional_company|urban_center|trade_center|logistics|naval_admin|fortification|monument|canal/;
const understaffed = r => r[LV] - r[STAFF] >= 1 && r[STAFF] <= 0.9 * r[LV];
function owners(s) { const m = new Map(); for (const id in s.b) { const r = s.b[id]; if (r[C] != null) m.set(r[ST], r[C]); } return m; }

// id -> { lost, gone, rec } for one pair of saves
function drops(A, Z) {
  const zOwn = owners(Z), perState = new Map(), any = [], out = new Map();
  for (const id in A.b) {
    const x = A.b[id];
    if (SKIP.test(x[T] ?? '')) continue;
    const y = Z.b[id];
    if (y ? y[LV] < x[LV] : true) { any.push([id, x, y]); perState.set(x[ST], (perState.get(x[ST]) ?? 0) + 1); }
  }
  for (const [id, x, y] of any) {
    if (!understaffed(x) || perState.get(x[ST]) >= 3) continue;
    if (y) {
      if (y[C] !== x[C] || y[PRIV] >= x[PRIV] || y[GOV] < x[GOV]) continue;
      out.set(id, { lost: x[PRIV] - y[PRIV], gone: false, x, y });
    } else {
      if (zOwn.get(x[ST]) !== x[C] || x[GOV] > 0) continue;
      out.set(id, { lost: x[PRIV], gone: true, x, y: null });
    }
  }
  return out;
}
const sumLost = m => [...m.values()].reduce((a, d) => a + d.lost, 0);
const hist = a => { const h = {}; for (const v of a) { const k = v >= 13 ? '13+' : v >= 6 ? '6-12' : String(v); h[k] = (h[k] ?? 0) + 1; } return h; };
const pct = (a, b) => b ? `${(100 * a / b).toFixed(1)}%` : '-';

// 1. Every pair, whatever the cadence: timers at the earlier save, and the drops.
console.log('\nPAIR BY PAIR (timers set at the earlier save; how many of those lost private levels by the later one; classified drops):');
for (let i = 0; i + 1 < ser.length; i++) {
  const A = ser[i], Z = ser[i + 1], d = drops(A, Z);
  let timers = 0, timersLost = 0;
  for (const id in A.b) {
    const x = A.b[id];
    if (!x[AD] || SKIP.test(x[T] ?? '')) continue;
    timers++;
    const y = Z.b[id];
    if (y ? y[PRIV] < x[PRIV] : true) timersLost++;
  }
  const flagged = [...d.values()].filter(v => v.x[AD]);
  if (ser.length <= 30 || A.date.endsWith('.1.1'))
    console.log(`  ${A.date} -> ${Z.date}: timers ${timers}, lost levels ${timersLost} | drops ${d.size} buildings, ${sumLost(d)} private levels; timer set at the earlier save: ${flagged.length} buildings, ${flagged.reduce((a, v) => a + v.lost, 0)} levels`);
}

// 2. Quarterly pairs: the speed, episodes and rebuilds.
const quarterly = [];
for (let i = 0; i + 1 < ser.length; i++) if (days(ser[i + 1].date) - days(ser[i].date) <= 100) quarterly.push(i);
if (quarterly.length < 8) { console.log('\n(fewer than 8 quarterly pairs: no speed, rebuild or cadence reading)'); process.exit(0); }
const qDrops = new Map();     // pair index -> drops
for (const i of quarterly) qDrops.set(i, drops(ser[i], ser[i + 1]));
let qN = 0, qLost = 0, withTimer = 0; const perQ = [], speed = [], episodes = new Map(), lag = {};
for (const i of quarterly) {
  const A = ser[i], Z = ser[i + 1];
  for (const [id, d] of qDrops.get(i)) {
    qN++; qLost += d.lost; perQ.push(d.lost);
    const ad = d.x[AD];
    if (ad) {
      withTimer += d.lost;
      const weeks = Math.max(0, Math.floor((days(Z.date) - Math.max(days(ad), days(A.date))) / 7));
      speed.push({ lost: d.lost, cap: Math.min(weeks, Math.floor(d.x[LV] - d.x[STAFF])), when: dnum(ad) <= dnum(A.date) ? 'passed' : dnum(ad) <= dnum(Z.date) ? 'inside' : 'after' });
    }
    const e = episodes.get(id);
    if (e && e.last === i - 1) { e.q++; e.lv += d.lost; e.last = i; } else episodes.set(id, { q: 1, lv: d.lost, last: i });
    if (!d.gone) {
      for (let k = i + 2; k <= Math.min(i + 9, ser.length - 1); k++) {
        const r = ser[k].b[id];
        if (r && r[LV] > d.y[LV]) { const key = `+${k - i - 1}q`; lag[key] = (lag[key] ?? 0) + Math.min(d.lost, r[LV] - d.y[LV]); break; }
      }
    }
  }
}
console.log(`\nQUARTERLY (${quarterly.length} pairs): ${qN} drops, ${qLost} private levels; on buildings whose timer was set at the start of the quarter: ${withTimer} (${pct(withTimer, qLost)})`);
console.log('  levels lost per building per quarter:', hist(perQ));
const ep = [...episodes.values()];
console.log(`  episodes (consecutive quarters with drops): ${ep.length}; quarters`, hist(ep.map(e => e.q)), '; levels', hist(ep.map(e => e.lv)));
for (const [label, w] of [['timer ran out inside the quarter', 'inside'], ['timer had run out before the quarter', 'passed'], ['timer still ahead at the quarter\'s end', 'after']]) {
  const g = speed.filter(s => s.when === w);
  const lost = g.reduce((a, s) => a + s.lost, 0), cap = g.reduce((a, s) => a + s.cap, 0);
  console.log(`  ${label}: ${g.length} drops, ${lost} levels against ${cap} weekly steps available (min(weeks after the timer, empty levels), ${pct(lost, cap)}); drops taking every step: ${g.filter(s => s.lost >= s.cap).length}`);
}
const lagKeys = Object.keys(lag).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
console.log(`  rebuilt, by the quarter of the first gain after the drop (levels, capped at the levels lost; of ${qLost}):`, lagKeys.map(k => `${k} ${lag[k]}`).join(', '));

// 3. Coarser cadences against the quarterly count: the same rule on half-yearly (1 Jan, 1 Jul) and yearly (1 Jan) saves.
function cadence(keep, span) {
  const idx = ser.map((s, i) => [s, i]).filter(([s]) => keep(s.date));
  let q = 0, n = 0, hit = 0; const why = { staffedAtStart: 0, netted: 0, stateWide: 0, other: 0 };
  for (let k = 0; k + 1 < idx.length; k++) {
    const [A, ia] = idx[k], [Z, iz] = idx[k + 1];
    if (iz - ia !== span || !quarterly.includes(ia)) continue;
    const qq = new Map();
    for (let i = ia; i < iz; i++) for (const [id, d] of qDrops.get(i) ?? drops(ser[i], ser[i + 1])) qq.set(id, (qq.get(id) ?? 0) + d.lost);
    const c = drops(A, Z);
    q += [...qq.values()].reduce((a, v) => a + v, 0); n += sumLost(c);
    for (const [id, d] of c) if (qq.has(id)) hit += Math.min(d.lost, qq.get(id));
    const perState = new Map();
    for (const id in A.b) { const x = A.b[id], z = Z.b[id]; if (SKIP.test(x[T] ?? '')) continue; if (z ? z[LV] < x[LV] : true) perState.set(x[ST], (perState.get(x[ST]) ?? 0) + 1); }
    for (const [id, l] of qq) {
      const missed = l - Math.min(l, c.get(id)?.lost ?? 0);
      if (missed <= 0) continue;
      const x = A.b[id], z = Z.b[id];
      if (!x) why.other += missed;
      else if (z && x[PRIV] - z[PRIV] < l) why.netted += Math.min(missed, l - Math.max(0, x[PRIV] - z[PRIV]));
      else if (!understaffed(x)) why.staffedAtStart += missed;
      else if (perState.get(x[ST]) >= 3) why.stateWide += missed;
      else why.other += missed;
    }
  }
  return { q, n, hit, why };
}
for (const [label, keep, span] of [['HALF-YEARLY', d => d.endsWith('.1.1') || d.endsWith('.7.1'), 2], ['YEARLY', d => d.endsWith('.1.1'), 4]]) {
  const r = cadence(keep, span);
  console.log(`\n${label}: counts ${r.n} levels against the quarterly ${r.q} over the same spans; recall ${(r.hit / r.q).toFixed(3)}, precision ${(r.hit / r.n).toFixed(3)}`);
  console.log('  missed, by reason (levels):', r.why);
}
