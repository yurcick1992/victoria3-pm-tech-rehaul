// The reader half of landmine L53 (the same-book rule, BALANCE_FRAMEWORK §10.118): a probe run is never economy data, so
// ledger/lib_runs.mjs usableRuns() must drop every run whose build_state.json says `run_kind: probe:*` and keep the rest.
// Run by tools/preflight.ps1 Test-LmL53 on the stub session beside this file; prints one verdict line, exit 0 = as expected.
//   node tools/testbed/fixtures/same_book/check_readers.mjs
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { usableRuns, runKind, isProbeKind } from '../../ledger/lib_runs.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SESSION = 'reader_session';
const want = {                       // run folder -> [kind on record, counted?]
  run001_book: ['full', true],
  run002_book: ['probe:syntax', false],
  run003_book: [null, true],         // a run from before run_kind existed: behaves as it always did
  run004_book: ['probe:performance', false],
  run005_book: ['checkpoint', true],
};
const problems = [];
let res;
try { res = usableRuns(here, SESSION, 'book'); } catch (e) { console.log(`FAIL usableRuns threw: ${e.message}`); process.exit(1); }
const kept = new Set(res.runs.map(r => r.split('/')[1]));
const dropped = new Map(res.dropped.map(d => [d.run, d.reason]));
for (const [run, [kind, counted]] of Object.entries(want)) {
  const k = runKind(here, `${SESSION}/${run}`);
  if (k !== kind) problems.push(`${run}: runKind() says ${JSON.stringify(k)}, the record says ${JSON.stringify(kind)}`);
  if (isProbeKind(k) === counted) problems.push(`${run}: isProbeKind(${JSON.stringify(k)}) is ${isProbeKind(k)}`);
  if (counted && !kept.has(run)) problems.push(`${run} (${kind}) was dropped: ${dropped.get(run) || 'no reason given'}`);
  if (!counted && kept.has(run)) problems.push(`${run} (${kind}) was COUNTED - a probe run entered a usable-run list`);
  if (!counted && !/probe/.test(dropped.get(run) || '')) problems.push(`${run} (${kind}) is not named as a probe among the dropped runs`);
}
if (kept.size + dropped.size !== Object.keys(want).length) problems.push(`the session holds ${kept.size + dropped.size} run(s), the fixture expects ${Object.keys(want).length}`);
if (problems.length) { console.log('FAIL ' + problems.join('; ')); process.exit(1); }
console.log(`readers: usableRuns() keeps ${kept.size} of ${Object.keys(want).length} stub runs and drops the ${dropped.size} probe runs`);
