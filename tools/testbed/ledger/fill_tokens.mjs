// Fill every batch-specific token. Kept separate from fill_assemble so the prose can be re-edited
// without re-deriving the numbers.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const DIR = process.argv[2];
const R = n => readFileSync(join(DIR, n), 'utf8');
let s = readFileSync(join(DIR, 'REPORT.html'), 'utf8');
const put = (t, v) => { if (!s.includes(t)) { console.error("MISSING TOKEN: " + t); process.exit(1); } s = s.split(t).join(v); };
put('__SESSION__', '20260818_221216_canon-n7');
put('__ARM__', 'mod only — config, frozen <span class="mono">mod_config.canon_n7.json</span> (d9512c19…)');
put('__N__', '6 <span class="dim">(7th abandoned, incomplete)</span>');
put('__GAME__', '1.13.10');
put('__DELTA__', 'research events only: battalion ladder 30×(era+1) · naval possession channel');
put('__BASE__', '20260813_083557 vanilla n=4 <span class="dim">(different night)</span>');
// ⚠ A HARDCODED HEADLINE IS A STALENESS BUG WEARING A PLAUSIBLE NUMBER. This literal carried
//   'P −2.9% PASS' from an older batch and would have been republished under this one had the
//   out-dir tokens.json not overridden it. Same class as fill_build_perf.mjs's provenance line.
//   Keep it OBVIOUSLY unfilled so a missing override is visible instead of believable.
put('__HEALTH__', 'HEALTH CHIP NOT SUPPLIED - put __HEALTH__ in the out-dir tokens.json');
put('__LEDE__', R('lede.html'));
put('__GOALS__', R('goals.html'));
put('__INCIDENTS__', R('incidents.html'));
put('__NEXT__', R('next.html'));
put('__FOOTER__', R('footer.html'));
writeFileSync(join(DIR, 'REPORT.html'), s);
console.log('tokens filled; none left: ' + !/__[A-Z]+__/.test(s));