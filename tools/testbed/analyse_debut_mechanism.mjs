// analyse_debut_mechanism.mjs — WHERE DOES A NEWLY INVENTED GOOD'S DEMAND COME FROM?
//
// Our model gives a debut good almost no demand, so its first factory is insolvent and the industry never
// starts (BALANCE_FRAMEWORK §10.29/§10.35). FINDINGS F28 eliminated the only named mechanism. This reads
// the answer off a full campaign instead, by lining up four signals that must come from ONE run:
//
//   1. the monthly order book of the deep markets  — WHEN demand and production start
//   2. every technology acquired by every country  — whether anyone COULD have produced it yet
//   3. the yearly 50-market sweep                  — whether someone ELSE produced it first
//   4. the pop-vs-building channel split           — WHO the early buyers actually are
//
// ⚠ THEY MUST BE ONE RUN. Dates found in one campaign do not transfer to another: seeds differ, so
// "go back and sample 1863" is meaningless in a fresh game. That is why the expensive split rides along.
//
//   node tools/testbed/analyse_debut_mechanism.mjs --session tools/testbed/sessions/<stamp>_<label>
//        [--goods steamers,telephones,automobiles,radios] [--game <path>]
import { readFileSync, existsSync, readdirSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, isAbsolute } from 'node:path';
import { loadEcon, REPO } from '../econ_host.mjs';
import { buyOrderTable, readBreakdown } from './lib_breakdown.mjs';

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const SESSION = argOf('--session', '');
const GAME = argOf('--game', 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game');
const ONLY = argOf('--goods', '').split(',').map(s => s.trim()).filter(Boolean);
if (!SESSION) { console.error('usage: analyse_debut_mechanism.mjs --session <dir> [--goods a,b] [--game <path>]'); process.exit(1); }
const SDIR = isAbsolute(SESSION) ? SESSION : join(REPO, SESSION.replace(/^[.\\/]+/, ''));
if (!existsSync(SDIR)) { console.error(`session not found: ${SDIR}`); process.exit(1); }

const dnum = d => { const p = String(d).split('.'); return (+p[0]) * 12 + ((+p[1] || 1) - 1); };
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
// The tech log prints a DISPLAY date ("September 29, 1857"); everything else uses "1857.9.1".
const parseLongDate = s => { const m = String(s).match(/(\w+)\s+(\d+),\s*(\d+)/); return m ? `${m[3]}.${MONTHS.indexOf(m[1]) + 1}.1` : null; };

// ---------------------------------------------------------------- what gates what
const { S } = loadEcon({ quiet: true });
const PMS = S.VAN.pms || {};
const producersOf = g => Object.entries(PMS).filter(([, r]) => r && ((r.out || {})[g] > 0));
const consumersOf = g => Object.entries(PMS).filter(([, r]) => r && ((r.in || {})[g] > 0));
const needsOf = g => Object.keys(S.POPM.needs || {}).filter(nd => (S.POPM.needs[nd].entries || []).some(e => e.g === g));

// technology key -> display name, so the tech log can be matched back. Falls back to a normalised guess.
const techName = {};
{
  const f = join(GAME, 'localization', 'english', 'inventions_l_english.yml');
  if (existsSync(f)) for (const ln of readFileSync(f, 'utf8').split('\n')) {
    const m = ln.match(/^\s*([a-z0-9_]+):\d*\s+"(.+)"/);
    if (m) techName[m[1]] = m[2];
  }
}
const displayOf = k => techName[k] || k.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');

// ---------------------------------------------------------------- read the session
const runs = readdirSync(SDIR, { withFileTypes: true }).filter(d => d.isDirectory() && /^run\d+_/.test(d.name)).map(d => d.name).sort();
// ⚠ The session stamp is `yyyymmdd_HHMMSS` — TWO underscore-separated parts. Cutting at the first
// underscore yields `20260805`, so every token becomes `20260805s001`, every filter matches nothing, and
// the run looks like it produced no data at all. meta.json carries the real token but only after harvest,
// so a LIVE run always falls back to this.
const stamp = (SDIR.split(/[\\/]/).pop().match(/^(\d{8}_\d{6})/) || [, ''])[1];
const plan = runs.map(r => ({
  run: r,
  token: existsSync(join(SDIR, r, 'meta.json'))
    ? (JSON.parse(readFileSync(join(SDIR, r, 'meta.json'), 'utf8')).token || `${stamp}s${r.match(/^run0*(\d+)/)[1].padStart(3, '0')}`)
    : `${stamp}s${r.match(/^run0*(\d+)/)[1].padStart(3, '0')}`,
  log: join(SDIR, r, 'logs_live', 'debug.log'),
})).filter(p => existsSync(p.log));
if (!plan.length) { console.error('no run logs'); process.exit(1); }
console.log(`session ${SDIR.split(/[\\/]/).pop()} · ${plan.length} run(s)\n`);

// ⚠ per-run reference tables — see lib_breakdown. Pooling them across seeds destroyed the verification.

// tech: display name -> earliest date seen anywhere, and who had it
const techFirst = new Map();
// wide sweep: good -> earliest date with production > 0, and where
const wideFirst = new Map();
// order book (deep markets): run|market|good -> {firstBuy, firstProd}
const deep = new Map();
const splits = [];

for (const p of plan) {
  // ⚠ SPLIT ON /\r?\n/, NOT '\n'. The game's log is CRLF, and JavaScript's `.` does NOT match `\r` — it is
  // a line terminator — so any `$`-anchored capture fails on every single line while `includes()` on the
  // same text succeeds. That reads as "the metric never fired": 19 604 TECH lines present, 0 matched.
  // ⚠ STREAMED, not slurped: two 500 MB mirrors read whole exhausted a 4 GB heap.
  const txt = createInterface({ input: createReadStream(p.log, { encoding: 'utf8' }), crlfDelay: Infinity });
  const reT = new RegExp(`\\|${p.token}\\|TECH\\|([^|]+)\\|([^|]+)\\|(.+)$`);
  const reG = new RegExp(`\\|${p.token}\\|G\\|([^|]+)\\|([^|]+)\\|([^|]+)\\|([0-9.]+)\\|([0-9.]+)\\|[0-9.]+\\|[0-9.]+\\|[0-9.]+\\|([0-9.]+)`);
  const reW = new RegExp(`\\|${p.token}\\|GW\\|([^|]+)\\|([^|]+)\\|([^|]+)\\|([0-9.]+)\\|([0-9.]+)\\|[0-9.]+\\|([0-9.]+)`);
  for await (const ln of txt) {
    if (ln.length >= 600) continue;
    let m;
    if ((m = ln.match(reT))) {
      const d = parseLongDate(m[2]); if (!d) continue;
      const t = m[3].trim(), cur = techFirst.get(t);
      if (!cur || dnum(d) < dnum(cur.date)) techFirst.set(t, { date: d, country: m[1] });
    } else if ((m = ln.match(reG))) {
      const [, date, mkt, good, buy, sell, prod] = m;
      const k = `${p.run}|${mkt}|${good}`, e = deep.get(k) || {};
      if (+buy > 0 && (!e.firstBuy || dnum(date) < dnum(e.firstBuy))) e.firstBuy = date;
      if (+prod > 0 && (!e.firstProd || dnum(date) < dnum(e.firstProd))) e.firstProd = date;
      if (!e.seen || dnum(date) < dnum(e.seen)) e.seen = date;
      deep.set(k, e);
    } else if ((m = ln.match(reW))) {
      const [, date, mkt, good, , , prod] = m;
      if (+prod > 0) { const cur = wideFirst.get(good); if (!cur || dnum(date) < dnum(cur.date)) wideFirst.set(good, { date, market: mkt }); }
    }
  }
  const buyOf = await buyOrderTable(p.log, p.token);
  const { blocks, stats } = await readBreakdown(p.log, p.token, buyOf);
  console.log(`  ${p.run}: ${blocks.length} verified breakdown blocks (dropped ${stats.dropped}, total-mismatch ${stats.badTotal}, no reference ${stats.noRef})`);
  for (const b of blocks) splits.push({ run: p.run, ...b });
}

// ---------------------------------------------------------------- report
const candidates = ONLY.length ? ONLY
  : [...new Set([...deep.keys()].map(k => k.split('|')[2]))].filter(g => needsOf(g).length);

console.log(`\n${'='.repeat(100)}\n  DEBUT MECHANISM — per good\n${'='.repeat(100)}`);
for (const good of candidates) {
  const rows = [...deep.entries()].filter(([k]) => k.endsWith(`|${good}`)).map(([k, v]) => ({ run: k.split('|')[0], market: k.split('|')[1], ...v }));
  const withBuy = rows.filter(r => r.firstBuy);
  if (!withBuy.length) continue;
  const earliest = withBuy.reduce((a, b) => dnum(a.firstBuy) < dnum(b.firstBuy) ? a : b);
  // is this a debut at all, or was it trading from the start?
  const startedLate = rows.some(r => r.seen && dnum(r.seen) > dnum('1837.1.1')) || dnum(earliest.firstBuy) > dnum('1838.1.1');
  if (!startedLate) continue;

  const prodTechs = [...new Set(producersOf(good).map(([, r]) => r.tech).filter(Boolean))];
  const consTechs = [...new Set(consumersOf(good).map(([, r]) => r.tech).filter(Boolean))];
  const techRow = t => { const f = techFirst.get(displayOf(t)); return f ? `${t} → world-first ${f.date} (${f.country})` : `${t} → NOT ACQUIRED by anyone`; };

  console.log(`\n■ ${good.toUpperCase()}   needs: ${needsOf(good).map(n => n.replace('popneed_', '')).join(', ') || '(none — industrial only)'}`);
  console.log(`   producing tech : ${prodTechs.map(techRow).join('\n                    ') || '(none)'}`);
  console.log(`   consuming tech : ${consTechs.map(techRow).join('\n                    ') || '(none)'}`);
  const w = wideFirst.get(good);
  console.log(`   first production ANYWHERE (50-market sweep): ${w ? `${w.date} in ${w.market}` : 'never seen'}`);
  console.table(rows.map(r => ({ run: r.run, market: r.market, firstBuy: r.firstBuy || '—', firstProduction: r.firstProd || '—',
    gap: (r.firstBuy && r.firstProd) ? `${((dnum(r.firstProd) - dnum(r.firstBuy)) / 12).toFixed(1)} yr` : '—' })));

  // WHO was buying, at the earliest splits that captured this good
  const sp = splits.filter(s => s.good === good).sort((a, b) => dnum(a.date) - dnum(b.date)).slice(0, 8);
  if (sp.length) {
    console.log('   channel split (earliest dumps that captured it):');
    console.table(sp.map(s => {
      const bld = s.buildings.reduce((a, b) => a + b.v, 0);
      return { run: s.run, date: s.date, market: s.market, total: +s.total.toFixed(1),
               pops: +s.pop.toFixed(1), buildings: +bld.toFixed(1), slaves: +s.slaves.toFixed(1),
               // ⚠ Share of THIS GOOD's buy orders, NOT of the need. Mislabelling it `popShare` invited
               // exactly the misreading it deserved: 0.3 of 11.3 steamers is 3% of steamers, while the
               // same 0.3 units are 0.08% of popneed_leisure, which `services` dominates. If you want a
               // need share, divide pop MONEY by the pop money of every good in that need at the SAME
               // dump — and discard the answer unless most of the need's goods survived truncation.
               popShareOfGood: s.total > 0 ? `${(100 * s.pop / s.total).toFixed(1)}%` : '—',
               topBuyer: s.buildings.sort((a, b) => b.v - a.v)[0]?.name || '—' };
    }));
  } else {
    console.log('   channel split: NOT CAPTURED for this good (every dump truncated before reaching it)');
  }
}
