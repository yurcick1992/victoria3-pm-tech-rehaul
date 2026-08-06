// melted_cultures.mjs — the culture database out of a melted save: id, type, and its CURRENT obsessions.
//
//   node tools/testbed/melted_cultures.mjs <melted.txt> --tsv out.tsv
//
// ⚠ OBSESSIONS ARE RUNTIME STATE, NOT FILE CONTENT. common/cultures gives the 1836 starting set; the
// game adds and removes them all campaign (OBSESSION_SPAWN_CHANCE, MAX_NUM_OBSESSIONS, the prohibition
// event). Reading them from the files instead of the save mis-labels every culture that acquired one -
// which showed up as 220 pp errors on Australian wine, a 1925 obsession that does not exist in 1836.
import { createReadStream, writeFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
const args = process.argv.slice(2);
const SRC = args.find(a => !a.startsWith('--'));
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const TSV = argOf('--tsv', '');
if (!SRC || !existsSync(SRC)) { console.error('usage: melted_cultures.mjs <melted.txt> --tsv f'); process.exit(1); }
let sec = false, depth = 0, id = null, type = null, obs = [], inObs = false;
const rows = [];
const flush = () => { if (id !== null) rows.push([id, type ?? '', obs.join(',')].join('\t')); id = null; type = null; obs = []; };
const rl = createInterface({ input: createReadStream(SRC, { encoding: 'utf8' }), crlfDelay: Infinity });
for await (const line of rl) {
  const t = line.trim();
  if (!sec) { if (t === 'cultures={') { sec = true; depth = 1; } continue; }
  const o = (t.match(/\{/g) || []).length, c = (t.match(/\}/g) || []).length;
  const m = /^(\d+)=\{$/.exec(t);
  if (m && depth === 2) { flush(); id = +m[1]; }
  else if (id !== null) {
    const tm = /^type="([a-z_]+)"$/.exec(t); if (tm) type = tm[1];
    if (t === 'obsessions={') inObs = true;
    else if (inObs) { if (t === '}') inObs = false; else for (const g of t.match(/"([a-z_]+)"/g) || []) obs.push(g.replace(/"/g, '')); }
  }
  depth += o - c;
  if (depth <= 0) { flush(); sec = false; }
}
flush();
const out = ['id\ttype\tobsessions', ...rows].join('\n') + '\n';
if (TSV) { writeFileSync(TSV, out); console.log(`${rows.length} cultures -> ${TSV}`); } else console.log(out);
console.log('with obsessions: ' + rows.filter(r => r.split('\t')[2]).length);
