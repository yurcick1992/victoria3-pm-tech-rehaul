// THE GDP GATE of the 60-run plan (BALANCE_FRAMEWORK §10.76, user-ruled 2026-09-06): over the usable runs of a session (L17 rule via
// lib_runs), the MEAN of world GDP at the last anchor year ÷ the vanilla baseline's median, against a threshold.
//   ≥ threshold → PROCEED (the schedule runs on to 60 unchanged)
//   <  threshold → SWITCH  (stop the schedule at run 30 and launch the A 2.2 fallback for 30)
// Same GDP definition as first_run_decomp / the ledger's G4: the save's own world.gdp at 1935.1.1.
//
// usage: node tools/testbed/ledger/assess_gdp_gate.mjs --session <stamp> [--setup <name>] [--threshold 0.95] [--min-runs 30]
//        [--van 20260821_131149_vanilla-baseline-n16] [--year 1935]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { usableRuns, reportDropped } from './lib_runs.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
const SES = join(HERE, '..', 'sessions');
const argOf = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const SESSION = argOf('--session', null), SETUP = argOf('--setup', ''), TH = +argOf('--threshold', '0.95'), MIN = +argOf('--min-runs', '30');
const VAN = argOf('--van', '20260821_131149_vanilla-baseline-n16'), YEAR = argOf('--year', '1935');
if (!SESSION) { console.error('usage: assess_gdp_gate.mjs --session <stamp> [--setup <name>] [--threshold 0.95] [--min-runs 30]'); process.exit(2); }
const load = p => JSON.parse(gunzipSync(readFileSync(p)).toString());
const worldGdpAt = (runDir, year) => {
  const dir = join(runDir, 'save_summaries'); if (!existsSync(dir)) return NaN;
  for (const f of readdirSync(dir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort()) { const s = load(join(dir, f)); if (String(s.provenance.date).startsWith(String(year))) return +s.world.gdp || NaN; }
  return NaN;
};
const med = a => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? (b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : NaN; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const sd = a => { if (a.length < 2) return NaN; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };

const van = usableRuns(SES, VAN);
const vanGdp = med(van.runs.map(r => worldGdpAt(join(SES, r), YEAR)));
// ONE PLAN, POSSIBLY SEVERAL SESSIONS (2026-09-07): the 60-run plan's first session died at run 12 (a harness race, BUGS_AND_FIXES
// 2026-09-07) and continued in a second session, so the plan's "first 30 usable runs" straddle two folders. `--session a,b` pools
// the usable runs of every session named, in order; each row is labelled with its session so the two stay distinguishable.
const SESSIONS = SESSION.split(',').map(s => s.trim()).filter(Boolean);
const rows = [], dropped = [];
for (const ses of SESSIONS) {
  const arm = usableRuns(SES, ses, SETUP);
  for (const r of arm.runs) { const gdp = worldGdpAt(join(SES, r), YEAR); if (Number.isFinite(gdp)) rows.push({ ses, run: r.split('/')[1], gdp }); }
  dropped.push(...arm.dropped);
}
const ratios = rows.map(x => x.gdp / vanGdp);
console.log(`GDP GATE — ${SESSIONS.join(' + ')}${SETUP ? ' / ' + SETUP : ''} · world GDP at ${YEAR}.1.1 ÷ vanilla ${VAN} median (n=${van.runs.length}, £${(vanGdp / 1e6).toFixed(0)}M)`);
for (const x of rows) console.log(`  ${(SESSIONS.length > 1 ? x.ses.slice(0, 15) + '/' : '') + x.run.padEnd(24)} £${(x.gdp / 1e6).toFixed(0).padStart(5)}M  ${(x.gdp / vanGdp).toFixed(3)}×`);
if (dropped.length) reportDropped(dropped);
const m = mean(ratios);
console.log(`\n  usable runs ${ratios.length} · mean ${m.toFixed(3)}× · median ${med(ratios).toFixed(3)}× · sd ${sd(ratios).toFixed(3)} · min ${Math.min(...ratios).toFixed(3)} · max ${Math.max(...ratios).toFixed(3)}`);
if (ratios.length < MIN) console.log(`  ⚠ ${ratios.length} usable runs is fewer than the ${MIN} the gate was ruled on — a verdict now is provisional`);
const verdict = m >= TH ? 'PROCEED' : 'SWITCH';
console.log(`\n  ⭐ ${verdict}: mean ${m.toFixed(3)}× ${m >= TH ? '≥' : '<'} ${TH} — ${verdict === 'PROCEED' ? 'the schedule runs on unchanged to 60' : 'stop at run 30 (STOP file as run 31 starts), remove the STOP file, launch canon_je24_a22_n30.json (A 2.2 / B 1.5)'}`);
process.exit(verdict === 'PROCEED' ? 0 : 1);
