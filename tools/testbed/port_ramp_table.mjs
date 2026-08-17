// THE MONTHLY PORT RAMP TABLE — t0 and t1 port levels per MARKET per month, averaged over the runs
// of one session, with a '!' on any cell whose spread across runs is large enough to distrust.
//
//   node tools/testbed/port_ramp_table.mjs <sessionDir> [--to 1841.2.1] [--tsv]
//
// ⚠ It reads SAVE SUMMARIES, never the building_inventory boot dump — that dump is a ~12k-line burst
// which overflows the game's log ring and loses part of itself at random (the defect that voided
// session 20260817_184413). A save summary comes from the savegame and cannot be truncated that way.
// ⚠ A MARKET is resolved per sample, not once: membership changes as countries are annexed or join
// another market, and a market row that silently starts aggregating a different set of countries is
// exactly how two unrelated series come to look identical (Portugal joins the French market by 1880).
// ⚠ Runs are matched BY DATE, not by index — a run that stalls a month behind must not be averaged
// against its siblings' following month.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

const args = process.argv.slice(2);
const SESSION = args.find(a => !a.startsWith('--'));
const TSV = args.includes('--tsv');
if (!SESSION) { console.error('usage: port_ramp_table.mjs <sessionDir> [--tsv]'); process.exit(2); }

const LEAD = ['GBR', 'NET', 'FRA', 'POR', 'SPA', 'USA', 'RUS'];
const T0 = 'building_port', T1 = 'building_port_steam';

// ---- read every run's summaries into {date -> {market -> {t0,t1}}} -----------------------------
const runs = readdirSync(SESSION).filter(f => /^run\d+/.test(f)).sort()
  .map(r => join(SESSION, r, 'save_summaries')).filter(existsSync);
if (!runs.length) { console.error('no save_summaries in ' + SESSION); process.exit(2); }

const perRun = runs.map(dir => {
  const byDate = {};
  for (const f of readdirSync(dir).filter(x => x.endsWith('.json.gz')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, f)))); } catch { continue; }
    const date = j.provenance?.date; if (!date) continue;
    const mkOf = {};
    for (const L of LEAD) { const c = j.countries?.[L]; if (c) mkOf[L] = c.market; }
    const acc = {}; for (const L of LEAD) acc[L] = { t0: 0, t1: 0, present: mkOf[L] != null };
    for (const c of Object.values(j.countries || {})) {
      const a = c.buildings?.[T0], b = c.buildings?.[T1];
      const l0 = a ? (a.levels ?? a.count ?? 0) : 0, l1 = b ? (b.levels ?? b.count ?? 0) : 0;
      if (!l0 && !l1) continue;
      for (const L of LEAD) if (mkOf[L] != null && c.market === mkOf[L]) { acc[L].t0 += l0; acc[L].t1 += l1; }
    }
    byDate[date] = acc;
  }
  return byDate;
});

// ---- date axis: only dates EVERY run reached, in calendar order --------------------------------
const key = d => { const [y, m, dd] = d.split('.').map(Number); return y * 10000 + m * 100 + dd; };
const common = Object.keys(perRun[0]).filter(d => perRun.every(r => r[d])).sort((a, b) => key(a) - key(b));
const dropped = Object.keys(perRun[0]).length - common.length;

// ---- average, and flag spread ------------------------------------------------------------------
// '!' when the runs disagree by more than max(2 levels, 15% of the mean) — an absolute floor so a
// tiny market is not flagged for a one-level difference, and a relative term so a big one still is.
const flagged = (vals) => {
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const spread = Math.max(...vals) - Math.min(...vals);
  return spread > Math.max(2, 0.15 * mean);
};
const cell = (vals) => {
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const txt = Number.isInteger(mean) ? String(mean) : mean.toFixed(1);
  return { txt, flag: flagged(vals), mean, spread: Math.max(...vals) - Math.min(...vals) };
};

const rows = common.map(d => {
  const r = { date: d, m: {} };
  for (const L of LEAD) {
    r.m[L] = { t0: cell(perRun.map(x => x[d][L].t0)), t1: cell(perRun.map(x => x[d][L].t1)) };
  }
  return r;
});

// ---- emit ---------------------------------------------------------------------------------------
if (TSV) {
  console.log(['date', ...LEAD.flatMap(L => [L + '_t0', L + '_t1'])].join('\t'));
  for (const r of rows) console.log([r.date, ...LEAD.flatMap(L => [r.m[L].t0.txt + (r.m[L].t0.flag ? '!' : ''),
                                                                  r.m[L].t1.txt + (r.m[L].t1.flag ? '!' : '')])].join('\t'));
} else {
  console.log(`MONTHLY PORT LEVELS PER MARKET — mean of ${runs.length} run(s)`);
  console.log(`session ${SESSION}`);
  console.log(`'!' = the runs disagree by more than max(2 levels, 15% of the mean) — treat that cell as unsettled`);
  if (dropped) console.log(`(${dropped} date(s) dropped: not reached by every run)`);
  console.log('');
  const head = 'date        ' + LEAD.map(L => (L + ' t0/t1').padStart(15)).join('');
  console.log(head);
  console.log('-'.repeat(head.length));
  for (const r of rows) {
    const line = r.date.padEnd(12) + LEAD.map(L => {
      const a = r.m[L].t0, b = r.m[L].t1;
      return (a.txt + (a.flag ? '!' : '') + '/' + b.txt + (b.flag ? '!' : '')).padStart(15);
    }).join('');
    console.log(line);
  }
  console.log('');
  const flags = rows.flatMap(r => LEAD.flatMap(L => [r.m[L].t0, r.m[L].t1])).filter(c => c.flag);
  console.log(`${rows.length} months · ${flags.length} flagged cell(s) of ${rows.length * LEAD.length * 2}`);
}
