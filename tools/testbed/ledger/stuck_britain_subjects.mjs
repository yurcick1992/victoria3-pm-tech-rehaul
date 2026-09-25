// BRITAIN'S SUBJECTS IN THE STUCK-BRITAIN RUNS (FINDINGS F166 §4, 2026-09-26): does the EIC (BIC) still exist, and how many
// people do Britain's subjects hold, at 1860–1920, stuck runs against the rest and vanilla? A NULL result: India still a
// subject at 1900 goes with 7/67 stuck runs, India gone with 6/78. Reads the save summaries directly (~2 min).
//   node tools/testbed/ledger/stuck_britain_subjects.mjs [corpus_runs.jsonl]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
const SES = fileURLToPath(new URL('../sessions', import.meta.url));
const L = readFileSync(process.argv[2] || new URL('corpus_runs.jsonl', import.meta.url), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const st = r => [1900, 1910, 1920, 1930, 1936].every(y => r.years[y].g.U >= 0.45);
const want = [1860, 1880, 1890, 1900, 1910, 1920];
const out = [];
for (const r of L) { if (r.arm === 'vanilla' && !r.session.startsWith('20260821_131149')) continue;
  const sd = SES + '/' + r.rel + '/save_summaries'; if (!existsSync(sd)) continue; const rec = {};
  for (const fn of readdirSync(sd).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).sort()) { const y0 = null;
    const j = JSON.parse(gunzipSync(readFileSync(sd + '/' + fn))); const y = +j.provenance.date.split('.')[0]; if (!want.includes(y) || rec[y]) continue;
    const C = j.countries; const subj = Object.entries(C).filter(([t, c]) => c.overlord === 'GBR');
    const popOf = c => Object.values(c.strata || {}).reduce((a, b) => a + b, 0);
    rec[y] = { bic: !!C.BIC, bicPop: C.BIC ? popOf(C.BIC) : 0, gbrPop: C.GBR ? popOf(C.GBR) : 0, subjPop: subj.reduce((a, [, c]) => a + popOf(c), 0), nsubj: subj.length, bicGdp: C.BIC ? C.BIC.gdp : 0 };
    if (Object.keys(rec).length === want.length) break; }
  out.push({ rel: r.rel, arm: r.arm, stuck: r.arm === 'mod' && st(r), rec }); }
const med = a => { a = a.filter(Number.isFinite).sort((x, y) => x - y); return a[a.length >> 1]; };
for (const [nm, S] of [['vanilla', out.filter(o => o.arm === 'vanilla')], ['mod stuck', out.filter(o => o.stuck)], ['mod rest', out.filter(o => o.arm === 'mod' && !o.stuck)]]) {
  console.log(nm.padEnd(10), 'n' + S.length, want.map(y => y + ': BIC ' + S.filter(o => o.rec[y] && o.rec[y].bic).length + '/' + S.length + ' pop ' + (med(S.map(o => o.rec[y] && o.rec[y].bicPop)) / 1e6).toFixed(0) + 'M, GBR ' + (med(S.map(o => o.rec[y] && o.rec[y].gbrPop)) / 1e6).toFixed(0) + 'M, subjects ' + (med(S.map(o => o.rec[y] && o.rec[y].subjPop)) / 1e6).toFixed(0) + 'M').join(' | ')); }
console.log('\nstuck runs, BIC present 1840..1900:'); for (const o of out.filter(o => o.stuck)) console.log(o.rel.slice(0, 50).padEnd(52), want.map(y => o.rec[y] ? (o.rec[y].bic ? 'B' : '-') + (o.rec[y].subjPop / 1e6).toFixed(0) : '?').join(' '));
console.log('\nshare of runs whose British subjects hold > 150M people:');
for (const [nm, S] of [['vanilla', out.filter(o => o.arm === 'vanilla')], ['mod stuck', out.filter(o => o.stuck)], ['mod rest', out.filter(o => o.arm === 'mod' && !o.stuck)]])
  console.log(nm.padEnd(10), want.map(y => y + ' ' + S.filter(o => o.rec[y] && o.rec[y].subjPop > 150e6).length + '/' + S.length).join(' · '));
// among mod runs, stuck rate by whether India is still a British subject at 1900
const m = out.filter(o => o.arm === 'mod' && o.rec[1900]); const inI = m.filter(o => o.rec[1900].subjPop > 150e6), outI = m.filter(o => o.rec[1900].subjPop <= 150e6);
console.log('mod: India still subject at 1900 → stuck', inI.filter(o => o.stuck).length + '/' + inI.length, '· India gone → stuck', outI.filter(o => o.stuck).length + '/' + outI.length);
// when India leaves (first year subjects < 150M after being above) in rest vs vanilla
const leave = o => { let was = false; for (const y of want) { const v = o.rec[y] && o.rec[y].subjPop; if (v > 150e6) was = true; else if (was && v != null) return y; } return null; };
for (const [nm, S] of [['vanilla', out.filter(o => o.arm === 'vanilla')], ['mod rest', out.filter(o => o.arm === 'mod' && !o.stuck)], ['mod stuck', out.filter(o => o.stuck)]]) { const c = {}; for (const o of S) { const k = leave(o) ?? 'kept/never'; c[k] = (c[k] || 0) + 1; } console.log('India leaves by', nm.padEnd(10), JSON.stringify(c)); }
