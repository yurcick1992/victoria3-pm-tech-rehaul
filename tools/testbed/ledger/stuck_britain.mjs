// THE STUCK-BRITAIN RUNS (FINDINGS F166, 2026-09-26): Britain's U* ≥ 45% at every decade 1900–1936 (F165 §4). For every corpus
// run: the early British shocks from events.tsv (a revolt against Great Britain that the REVOLT side wins; the East India
// Company losing to a revolt), and Britain's own record from corpus_gbr_extract.mjs (government type, treasury, debt,
// bankruptcy, the construction sector, the pool, GDP), mod against vanilla, stuck against not.
//   node tools/testbed/ledger/stuck_britain.mjs [corpus_runs.jsonl] [corpus_gbr.jsonl]
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load, med, mean, f } from './lib_corpus_stats.mjs';
import { isStuck } from './lib_depeasant.mjs';
const SES = join(fileURLToPath(new URL('../../..', import.meta.url)), 'tools/testbed/sessions');
const C = load(process.argv[2] || new URL('corpus_runs.jsonl', import.meta.url)); const G = new Map(load(process.argv[3] || new URL('corpus_gbr.jsonl', import.meta.url)).map(r => [r.rel, r.years]));
const yearOf = s => { const m = String(s).match(/(1[89]\d\d)/); return m ? +m[1] : null; };
// events: a REVOLT line names the country revolted against; the next CIVILWARWON of that war names the winner
function shocks(rel) {
  const p = join(SES, rel, 'events.tsv'); const out = { gbrLost: null, gbrWon: [], eicLost: null, revolts: [] }; if (!existsSync(p)) return null;
  const lines = readFileSync(p, 'utf8').split(/\r?\n/).slice(1).map(l => l.split('\t'));
  for (const c of lines) {
    if (c[1] === 'REVOLT' && c[2] === 'Great Britain') out.revolts.push(yearOf(c[3]));
    if (c[1] !== 'CIVILWARWON') continue; const w = c[2] || '', y = yearOf(c[3]);
    if (/^(British|English|Scottish).*Revolt$/.test(w) && !out.gbrLost) out.gbrLost = y;
    if (/East India .*Revolt$/.test(w) && !out.eicLost) out.eicLost = y;
    if (w === 'Great Britain') out.gbrWon.push(y);
  }
  return out;
}
const rows = C.map(r => { const g = G.get(r.rel) || {}; const s = shocks(r.rel);
  const yr = y => g[y] || {};
  const firstZero = (() => { for (let y = 1840; y <= 1936; y++) if (yr(y).money === 0) return y; return null; })();
  const zeroYears = Object.entries(g).filter(([y, v]) => +y >= 1860 && +y <= 1936 && v.money === 0).length;
  const govs = [...new Set(Object.keys(g).sort().map(y => g[y].gov).filter(Boolean))];
  const bank = [...new Set(Object.values(g).map(v => v.bank).filter(Boolean))];
  return { rel: r.rel, arm: r.arm, stuck: isStuck(r), config: r.config, s, firstZero, zeroYears, govs, bank,
    cons: [1850, 1860, 1870, 1880, 1900, 1920, 1935].map(y => yr(y).cons), pool: [1860, 1880, 1900, 1920, 1935].map(y => yr(y).pool / 1e6),
    gdp: [1850, 1880, 1900, 1935].map(y => yr(y).gdp / 1e6), gov1880: yr(1880).gov, gov1900: yr(1900).gov };
}).filter(r => r.s);
const van = rows.filter(r => r.arm === 'vanilla' && r.rel.startsWith('20260821_131149')), mod = rows.filter(r => r.arm === 'mod');
const stuck = mod.filter(r => r.stuck), rest = mod.filter(r => !r.stuck);
console.log('runs: vanilla', van.length, '· mod', mod.length, '(stuck', stuck.length + ', rest', rest.length + ')');
const share = (S, fn) => f(S.filter(fn).length / S.length * 100, 0) + '% (' + S.filter(fn).length + '/' + S.length + ')';
const before = (y, cut) => y != null && y < cut;
console.log('\n=== the shocks ===');
for (const [nm, fn] of [
  ['a revolt against Britain WON before 1880', r => before(r.s.gbrLost, 1880)],
  ['the EIC lost to a revolt before 1880', r => before(r.s.eicLost, 1880)],
  ['either before 1880', r => before(r.s.gbrLost, 1880) || before(r.s.eicLost, 1880)],
  ['any revolt against Britain before 1880', r => r.s.revolts.some(y => y < 1880)],
  ['Britain\'s treasury at 0 in a summary by 1870', r => before(r.firstZero, 1871)],
  ['Britain bankrupt at some point', r => r.bank.length > 0],
]) console.log(nm.padEnd(46), '| vanilla', share(van, fn).padEnd(14), '| mod stuck', share(stuck, fn).padEnd(14), '| mod rest', share(rest, fn));
console.log('\n=== given the shock, how often does Britain stay stuck? ===');
for (const [nm, fn] of [['revolt won <1880', r => before(r.s.gbrLost, 1880)], ['EIC lost <1880', r => before(r.s.eicLost, 1880)], ['either <1880', r => before(r.s.gbrLost, 1880) || before(r.s.eicLost, 1880)], ['neither', r => !(before(r.s.gbrLost, 1880) || before(r.s.eicLost, 1880))]]) {
  const m = mod.filter(fn), v = van.filter(fn); console.log(nm.padEnd(18), '| mod stuck', share(m, r => r.stuck), '| vanilla stuck', share(v, r => r.stuck)); }
console.log('\n=== Britain\'s record, medians (construction levels 1850/1860/1870/1880/1900/1920/1935 · pool £M 1860/1880/1900/1920/1935 · treasury-0 years 1860–1936) ===');
const shockedRest = rest.filter(r => before(r.s.gbrLost, 1880) || before(r.s.eicLost, 1880)), shockedVan = van.filter(r => before(r.s.gbrLost, 1880) || before(r.s.eicLost, 1880));
for (const [nm, S] of [['vanilla, all', van], ['vanilla, shocked', shockedVan], ['mod stuck', stuck], ['mod shocked, not stuck', shockedRest], ['mod rest', rest]]) {
  if (!S.length) continue; console.log(nm.padEnd(24), 'n' + S.length, '| cons', [0, 1, 2, 3, 4, 5, 6].map(i => f(med(S.map(r => r.cons[i])), 0)).join('/'), '| pool', [0, 1, 2, 3, 4].map(i => f(med(S.map(r => r.pool[i])), 1)).join('/'), '| t0 yrs', f(med(S.map(r => r.zeroYears)), 0), '| GDP £M 1850/1880/1900/1935', [0, 1, 2, 3].map(i => f(med(S.map(r => r.gdp[i])), 0)).join('/')); }
console.log('\n=== each stuck run ===');
for (const r of stuck) console.log(r.rel.split('/')[0].slice(0, 15), r.config.replace('mod_config.', '').replace('.json', '').padEnd(24), '| revolt won', r.s.gbrLost ?? '—', '| EIC lost', r.s.eicLost ?? '—', '| revolts', r.s.revolts.join(',') || '—', '| treasury 0 from', r.firstZero ?? '—', '(' + r.zeroYears + ' y)', '| bankrupt', r.bank.join(',') || '—', '| gov', r.govs.join('→'), '| cons', r.cons.join('/'));
console.log('\n=== mod runs shocked but NOT stuck ===');
for (const r of shockedRest) console.log(r.rel.split('/')[0].slice(0, 15), r.config.replace('mod_config.', '').replace('.json', '').padEnd(24), '| revolt won', r.s.gbrLost ?? '—', '| EIC lost', r.s.eicLost ?? '—', '| treasury 0 from', r.firstZero ?? '—', '(' + r.zeroYears + ' y)', '| gov', r.govs.join('→'), '| cons', r.cons.join('/'));
console.log('\n=== governments ever held (runs) ===');
const gv = S => { const c = {}; for (const r of S) for (const g of r.govs) c[g] = (c[g] || 0) + 1; return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([g, n]) => g.replace('gov_', '') + ' ' + n).join(' · '); };
console.log('vanilla:', gv(van)); console.log('stuck:  ', gv(stuck)); console.log('rest:   ', gv(rest));
