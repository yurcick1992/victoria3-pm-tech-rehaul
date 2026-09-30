// AN INTEREST GROUP'S CLOUT BY WHERE ITS MEMBERS WORK, YEAR BY YEAR — from the save summaries (v14+: `ig_by_workplace`). Written for the
// user's tracking-only ruling of 2026-10-01: the Petite Bourgeoisie is meant to FALL with the crafts and RE-RISE with the urban centres'
// (and trade centres') shopkeepers; this prints whether it does.
//
//   node tools/testbed/ledger/ig_workplace_series.mjs --arm <session>[:<setup>] [--arm …] [--ig ig_petty_bourgeoisie] [--every 5]
//        [--tags GBR,FRA,…] [--pool]
//
// Per run and year (the first summary of each year): the IG's clout — the MEAN over main countries holding it (F190's metric), or with --tags /
// --pool the listed countries' mean — split by workplace class: each country's clout × the class's members × exp(wealth/5) ÷ the country's
// total (F192's attribution; the split rests on that fitted weight, the totals are the recorded clout). Beside it the shopkeeper workforce by
// class, world-wide. Classes: light6 (a craft rung in a craft book, the e0 rung in a four-rung book, the WHOLE industry in vanilla), urban_center,
// trade_center, owner (financial districts, manor houses, company HQs), other, unemployed (no workplace, incl. peasants).
// ⚠ Summaries before v14 carry no `ig_by_workplace` and are skipped, named.
import zlib from 'node:zlib'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SESS = path.join(REPO, 'tools', 'testbed', 'sessions');
const args = process.argv.slice(2);
const all = n => args.flatMap((a, i) => a === n && args[i + 1] ? [args[i + 1]] : []);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const ARMS = all('--arm'), IG = argOf('--ig', 'ig_petty_bourgeoisie'), EVERY = +argOf('--every', '5');
const TAGS = args.includes('--pool') ? ['GBR', 'USA', 'FRA', 'NET', 'BEL', 'UNL', 'PRU', 'NGF', 'GER'] : (argOf('--tags', '') ? argOf('--tags', '').split(',') : null);
if (!ARMS.length) { console.error('usage: ig_workplace_series.mjs --arm <session>[:<setup>] [--ig …] [--every 5] [--tags …|--pool]'); process.exit(2); }
const CLS = ['light6', 'urban_center', 'trade_center', 'owner', 'other', 'unemployed'];

for (const spec of ARMS) {
  const [s, setup] = spec.split(':');
  const dir = fs.readdirSync(SESS).find(d => d === s || d.startsWith(s + '_'));
  if (!dir) throw new Error(`no session ${s}`);
  for (const r of fs.readdirSync(path.join(SESS, dir)).filter(d => /^run\d+/.test(d) && (!setup || d.endsWith('_' + setup)))) {
    const sd = path.join(SESS, dir, r, 'save_summaries'); if (!fs.existsSync(sd)) continue;
    const seen = new Set(), rows = [], old = [];
    for (const f of fs.readdirSync(sd).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort()) {
      const j = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(sd, f))));
      const y = +j.provenance.date.split('.')[0];
      if (seen.has(y) || (y - 1836) % EVERY) continue; seen.add(y);
      if (!(j.save_summary_version >= 14)) { old.push(y); continue; }
      const k = j.world.ig_order.indexOf(IG); if (k < 0) throw new Error(`${IG} not in ig_order`);
      const cs = Object.entries(j.countries).filter(([key, c]) => (TAGS ? TAGS.includes(key) : c.is_main_tag) && c.interest_groups?.[IG] && c.ig_by_workplace);
      const att = Object.fromEntries(CLS.map(c => [c, 0])), mem = Object.fromEntries(CLS.map(c => [c, 0])); let clout = 0;
      const shop = Object.fromEntries(CLS.map(c => [c, 0]));
      for (const [, c] of cs) {
        const w = c.ig_by_workplace, tot = CLS.reduce((a, cl) => a + (w[cl]?.wm[k] || 0), 0), cl0 = c.interest_groups[IG].clout;
        clout += cl0;
        for (const cl of CLS) { if (tot > 0) att[cl] += cl0 * (w[cl]?.wm[k] || 0) / tot; shop[cl] += w[cl]?.shop || 0; mem[cl] += w[cl]?.mem[k] || 0; }
      }
      const mt = CLS.reduce((a, c) => a + mem[c], 0);
      rows.push({ y, n: cs.length, clout: clout / cs.length, att: Object.fromEntries(CLS.map(c => [c, att[c] / cs.length])), mem: Object.fromEntries(CLS.map(c => [c, mt ? mem[c] / mt : 0])), shop });
    }
    console.log(`\n${dir}/${r} — ${IG} clout (%), ${TAGS ? 'mean over ' + TAGS.join('/') : 'mean over main countries'}, split by the members' workplace; shopkeeper workforce (k) by workplace, ${TAGS ? 'those countries' : 'world'}`);
    if (old.length) console.log(`   (pre-v14 summaries skipped: ${old[0]}–${old[old.length - 1]})`);
    const H = { light6: 'light6', urban_center: 'urban', trade_center: 'trade', owner: 'owner', other: 'other', unemployed: 'unemp' };
    console.log(`   attributed clout points ∝ members × exp(wealth/5) (⚠ steep for the rich: the owner class is over-weighted); members % exact`);
    console.log('   year    n  clout | clout pts: ' + CLS.map(c => H[c].padStart(7)).join('') + ' | members %: ' + CLS.map(c => H[c].padStart(7)).join('') + ' | shopkeepers k: ' + CLS.map(c => H[c].padStart(7)).join(''));
    for (const w of rows) console.log(`   ${w.y} ${String(w.n).padStart(4)} ${(100 * w.clout).toFixed(2).padStart(6)} |            ` + CLS.map(c => (100 * w.att[c]).toFixed(2).padStart(7)).join('') + ' |            ' + CLS.map(c => (100 * w.mem[c]).toFixed(1).padStart(7)).join('') + ' |                ' + CLS.map(c => (w.shop[c] / 1e3).toFixed(0).padStart(7)).join(''));
  }
}
