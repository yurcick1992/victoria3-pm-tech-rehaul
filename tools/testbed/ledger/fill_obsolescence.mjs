// THE OBSOLESCENCE PANEL — in-market vs trade (user-agreed 2026-09-24; FINDINGS F161 §4) → <outDir>/obsolescence.json, spliced
// into the ledger as `const OBS` by fill_assemble.mjs. ONE arm, like every ledger fill (one configuration per report).
// usage: node tools/testbed/ledger/fill_obsolescence.mjs <outDir> --session <stamp> --setup <setup> --config <book>
//          [--pool 1920,1930,1935] [--override-dir <dir of re-summaries named session__run.json.gz>]
// The metric set and its caveats live in lib_obsolescence.mjs's header; the reader for arm-vs-arm comparison is
// trade_obsolescence.mjs.
import { writeFileSync } from 'node:fs'; import { join } from 'node:path'; import { measure, summarise } from './lib_obsolescence.mjs';
const argv = process.argv.slice(2); const OUT = argv[0]; const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const session = argOf('--session', null), setup = argOf('--setup', null), config = argOf('--config', null);
if (!OUT || !session || !config) { console.error('usage: fill_obsolescence.mjs <outDir> --session <stamp> --setup <setup> --config <book>'); process.exit(1); }
const pool = argOf('--pool', '1920,1930,1935').split(',').map(Number);
const S = summarise(measure({ session, setup, config, years: pool, overrideDir: argOf('--override-dir', null) }), pool);
const n = Object.values(S.industries).filter(o => o['IN-MARKET'] || o['TRADE-ONLY']).length;   // the SUMMARY's industries: lib_obsolescence already skipped disabled ones (L27)
if (!n) { console.error('no industry has an in-market or trade-only old rung in the pooled years — nothing to publish'); process.exit(1); }
writeFileSync(join(OUT, 'obsolescence.json'), JSON.stringify(S));
console.log(`obsolescence.json: ${S.runs} run(s), pool ${pool.join('+')}, ${n} industries with old rungs, ${Object.keys(S.tags).length} tags`);
