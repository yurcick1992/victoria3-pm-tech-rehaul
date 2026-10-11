// THE §10.97 PROBE DECISION (user-ruled 2026-10-11): is the book "heavily broken"? Two lines, both against the vanilla n=16 baseline:
//   · TECH: the tech majors' MEDIAN GAIN in technologies held from the first summary (1837.1.1) to `--year` (default 1885), per run, the
//     arm's median over its runs ÷ vanilla's median over its runs — broken below `--tech-line` (default 0.70);
//   · GDP: world GDP as displayed at the first summary of `--gdp-year` (default 1845) ÷ vanilla's per-run median — broken below
//     `--gdp-line` (default 0.80).
// The tech majors are one ROW per state (lib_markets MEMBER_FAMILY: GBR USA FRA, the German state in whichever form, NET BEL UNL) plus SWE;
// a row is counted only where it exists at both dates (UNL forms late, so its row has no 1837 baseline; NET and BEL vanish where it forms).
// Also prints each year's gain and GDP ratio (`--years`) so the trajectory, not only the line, is read.
// usage: node tools/testbed/ledger/tech_gain_check.mjs <label>=<session>[,<session>][:<setup>] [...] [--van <session>] [--year 1885]
//        [--gdp-year 1845] [--years 1845,1855,1865,1875,1885] [--runs]
import fs from 'node:fs'; import zlib from 'node:zlib'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { MEMBER_FAMILY } from './lib_markets.mjs';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'sessions');
const args = process.argv.slice(2); const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const VAN = opt('--van', '20260821_131149_vanilla-baseline-n16'), YEAR = +opt('--year', 1885), GY = +opt('--gdp-year', 1845);
const YEARS = opt('--years', '1845,1855,1865,1875,1885').split(',').map(Number), RUNS = args.includes('--runs');
const TECH_LINE = +opt('--tech-line', 0.70), GDP_LINE = +opt('--gdp-line', 0.80);
const ROWS = { ...MEMBER_FAMILY, SWE: ['SWE'] };
const skip = new Set(['--van', '--year', '--gdp-year', '--years', '--tech-line', '--gdp-line']);
const specs = args.filter((a, i) => !a.startsWith('--') && !skip.has(args[i - 1]));
const med = a => { const s = a.filter(x => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
function runDirs(spec) {
  const [sessPart, setup] = spec.split(':'); const out = [];
  for (const s of sessPart.split(',')) { const d = path.join(ROOT, s); if (!fs.existsSync(d)) throw new Error('no session ' + s);
    for (const r of fs.readdirSync(d).filter(x => /^run\d/.test(x)).sort()) { if (setup && !r.endsWith('_' + setup)) continue; const sd = path.join(d, r, 'save_summaries'); if (fs.existsSync(sd)) out.push({ name: `${s.slice(0, 15)}/${r}`, dir: sd }); } }
  return out;
}
// the first summary of each year: { year -> {countries, gdp} }
function series(sd) {
  const out = {};
  for (const f of fs.readdirSync(sd).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(sd, f)))); } catch { continue; }
    const y = +String(j.provenance?.date ?? '').split('.')[0]; if (!y || out[y]) continue;
    const held = {}; for (const [k, c] of Object.entries(j.countries)) { if (k.includes('@')) continue; const t = c.technologies_held; held[k] = Array.isArray(t) ? t.length : (typeof c.technologies === 'number' ? c.technologies : null); }
    out[y] = { held, gdp: j.world?.gdp };
  }
  return out;
}
const rowTag = (held, cands) => cands.find(t => held[t] != null);
function readArm(spec) {
  return runDirs(spec).map(r => { const S = series(r.dir); const ys = Object.keys(S).map(Number).sort((a, b) => a - b); const y0 = ys[0];
    const gainAt = Y => { if (!S[Y]) return null; const g = []; for (const c of Object.values(ROWS)) { const a = rowTag(S[y0].held, c), b = rowTag(S[Y].held, c); if (a && b) g.push(S[Y].held[b] - S[y0].held[a]); } return med(g); };
    return { name: r.name, y0, last: ys[ys.length - 1], gain: Object.fromEntries([...new Set([...YEARS, YEAR])].map(Y => [Y, gainAt(Y)])), gdp: Object.fromEntries([...new Set([...YEARS, GY])].map(Y => [Y, S[Y]?.gdp ?? null])) }; });
}
const van = readArm(VAN);
const vGain = Y => med(van.map(r => r.gain[Y])), vGdp = Y => med(van.map(r => r.gdp[Y]));
console.log(`vanilla ${VAN}: ${van.length} runs; tech majors' median gain from ${van[0]?.y0}: ` + YEARS.map(Y => `${Y} ${vGain(Y)}`).join(' · '));
for (const spec of specs) {
  const [label, rest] = spec.includes('=') ? spec.split(/=(.*)/s) : [spec, spec];
  const arm = readArm(rest);
  const aG = Y => med(arm.map(r => r.gain[Y])), aD = Y => med(arm.map(r => r.gdp[Y]));
  console.log(`\n${label}: ${arm.length} run(s), reaching ${arm.map(r => r.last).join(', ')}`);
  console.log('  year   majors gain (arm / vanilla = ratio)   world GDP £M (arm / vanilla = ratio)');
  for (const Y of YEARS) { const g = aG(Y), v = vGain(Y), d = aD(Y), dv = vGdp(Y);
    console.log(`  ${Y}   ${g ?? '-'} / ${v ?? '-'} = ${g != null && v ? (g / v).toFixed(2) : '-'}`.padEnd(48) + `${d != null ? (d / 1e6).toFixed(0) : '-'} / ${dv != null ? (dv / 1e6).toFixed(0) : '-'} = ${d != null && dv ? (d / dv).toFixed(2) : '-'}`); }
  if (RUNS) for (const r of arm) console.log(`    ${r.name}: gain ${YEARS.map(Y => r.gain[Y] ?? '-').join(' / ')} · GDP ${YEARS.map(Y => r.gdp[Y] != null ? (r.gdp[Y] / 1e6).toFixed(0) : '-').join(' / ')}`);
  const tr = aG(YEAR) != null && vGain(YEAR) ? aG(YEAR) / vGain(YEAR) : null, dr = aD(GY) != null && vGdp(GY) ? aD(GY) / vGdp(GY) : null;
  console.log(`  ⇒ TECH ${YEAR}: ${tr == null ? 'not reached' : tr.toFixed(2) + (tr < TECH_LINE ? ` — BROKEN (under ${TECH_LINE})` : ` — fine (line ${TECH_LINE})`)}` +
    ` · GDP ${GY}: ${dr == null ? 'not reached' : dr.toFixed(2) + (dr < GDP_LINE ? ` — BROKEN (under ${GDP_LINE})` : ` — fine (line ${GDP_LINE})`)}`);
}
