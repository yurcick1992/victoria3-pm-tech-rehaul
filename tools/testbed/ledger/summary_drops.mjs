// summary_drops.mjs — WHICH SAVE SUMMARIES LOST A COUNTRY RECORD, AND HOW MUCH (landmine L38, FINDINGS F186).
//
//   node tools/testbed/ledger/summary_drops.mjs --session <stamp>[,<stamp>][:<setup>] [--session …] [--years 1932-1936]
//                                               [--all] [--detail] [--json out]
//   node tools/testbed/ledger/summary_drops.mjs --check <session dir|stamp> [--every 10]     (L38, post-run; exit 1 on a breach)
//   node tools/testbed/ledger/summary_drops.mjs --selftest                                   (L38, pre-batch; exit 1 on a breach)
//
// ⭐⭐ WHAT BROKE. Up to SAVE_SUMMARY_VERSION 11, save_state_summary.mjs keyed `countries` by the country's DEFINITION, so
// records sharing one overwrote each other — a civil war's two sides, a country a revolt left behind for decades, two records
// that both carry `is_main_tag` — and `world.gdp` / `world.population`, summed over that map, lost every dropped record. The
// later record in the save's slot order won: the main side as often as the other. Measured on the 22 kept 1936 saves of the
// canon n=6 and the vanilla n=16 (F186): 3–18 records dropped per save, world GDP read 0.00–3.0% low and world population
// 0.01–16% low (vanilla seed 5 dropped the main CHINA, 251.5M people); vanilla seed 7's `countries.PRU` was a second, 2.4–4.5M
// Prussia from 1871 to 1936 in place of the 16M main one.
//
// ⭐ A PRE-v12 SUMMARY CANNOT BE REPAIRED — its save is reaped, which makes the summary the record — BUT IT CAN BE CHECKED:
// `world.buildings` was always summed over country IDS, so Σ countries' building levels falls short of the world's by exactly
// the dropped records' levels, and Σ countries' base-priced value added by exactly theirs. This prints, per run and year:
//   · the dropped LEVELS (exact) and the dropped value added (exact, v6+);
//   · an ESTIMATE of the dropped GDP = 52 × that value added × the survivors' displayed-GDP-per-£-of-value-added. Scored
//     against the exact figure on the 22 kept 1936 saves (drops over £1M): 0.61–1.27 of it in 18 of 20, median 0.97, two
//     outliers (0.09 on a £3M drop, 1.77 on £7.5M). Good enough to say whether a drop is MATERIAL, not to correct a number;
//   · every SHORTLIST member (lib_markets POOL) whose entry is not a main record (`is_main_tag` false), and ⚑⚑ when it
//     answers to its own tag (`overlord` === its key) — the record it answers to IS the main, i.e. the one that was dropped.
// ⚠ POPULATION CANNOT BE ESTIMATED from a summary: people per live pop object runs 659–75,583 among the dropped records
//   (China's pops are huge), so W / U* / H are exact only where a kept save could be re-summarised.
// ⚠ A v12+ summary must show NO gap at all — the rule `--check` enforces for the preflight.
//
// It reads the FIRST summary of each year by default, which is exactly what criteria.mjs reads; --all reads every one.

import { readFileSync, readdirSync, existsSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { usableRuns, reportDropped } from './lib_runs.mjs';
import { POOL } from './lib_markets.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SES = join(HERE, '..', 'sessions');
const WRITER = resolve(HERE, '..', 'save_state_summary.mjs');
const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const M = x => (x / 1e6).toFixed(1);
const listSummaries = dir => existsSync(dir)
  ? readdirSync(dir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort() : [];
const load = p => JSON.parse(gunzipSync(readFileSync(p)).toString('utf8'));

// ---- the identities a v12+ summary must satisfy, and the gaps a pre-v12 one reveals
function scan(j) {
  const C = j.countries || {}, W = j.world || {};
  let lvW = 0, lvC = 0, vaW = 0, vaC = 0, va = false, popC = 0, gdpC = 0;
  for (const b of Object.values(W.buildings || {})) { lvW += +b.levels || 0; if (b.va_out != null) { va = true; vaW += (+b.va_out || 0) - (+b.va_in || 0); } }
  for (const c of Object.values(C)) {
    for (const b of Object.values(c.buildings || {})) { lvC += +b.levels || 0; vaC += (+b.va_out || 0) - (+b.va_in || 0); }
    popC += Object.values(c.professions || {}).reduce((a, x) => a + x, 0); gdpC += +c.gdp || 0;
  }
  const k = va && vaC > 0 ? (+W.gdp || 0) / (52 * vaC) : NaN;
  const est = va && vaW - vaC > 0 && Number.isFinite(k) ? 52 * (vaW - vaC) * k : 0;
  const members = [];
  for (const t of POOL) {
    const c = C[t]; if (!c || c.is_main_tag !== false) continue;
    members.push({ tag: t, id: c.id, selfOverlord: c.overlord === t, civil_war: c.civil_war ?? null });
  }
  return { v: +j.save_summary_version || 0, date: j.provenance?.date || '', lvGap: lvW - lvC, vaGap: va ? vaW - vaC : null,
    estGdp: est, share: est > 0 ? est / ((+W.gdp || 0) + est) : 0, gdp: +W.gdp || 0,
    idGdp: (+W.gdp || 0) - Math.round(gdpC), idPop: (+W.population || 0) - Math.round(popC), members, C };
}

// ---- keys: in v12 an entry's key is its tag or tag@<its id>; nothing else
function keyBreaches(C) {
  const bad = [];
  for (const [k, c] of Object.entries(C)) {
    if (c.tag == null) { bad.push(`${k}: no tag field`); continue; }
    if (k !== c.tag && k !== `${c.tag}@${c.id}`) bad.push(`${k}: key is neither its tag ${c.tag} nor ${c.tag}@${c.id}`);
  }
  return bad;
}

// ---- --check: L38's post-run half. Every run's newest summary and every Nth before it.
function check(target) {
  const every = Math.max(1, +argOf('--every', '10'));
  const dir = existsSync(target) ? target : join(SES, target);
  if (!existsSync(dir)) { console.log(`L38 check: no such session ${target}`); return 1; }
  let v12 = 0, pre = 0, preHit = 0, runs = 0; const bad = [];
  for (const r of readdirSync(dir).filter(x => /^run\d+/.test(x)).sort()) {
    const sd = join(dir, r, 'save_summaries'); const fl = listSummaries(sd); if (!fl.length) continue; runs++;
    const pick = fl.filter((_, i) => i === fl.length - 1 || i % every === 0);
    for (const f of pick) {
      let j; try { j = load(join(sd, f)); } catch (e) { bad.push(`${r}/${f}: unreadable (${e.message})`); continue; }
      const s = scan(j);
      if (s.v < 12) { pre++; if (s.lvGap > 0.5) preHit++; continue; }
      v12++;
      const why = [];
      if (Math.abs(s.lvGap) > 0.5) why.push(`Σ countries' levels ${s.lvGap > 0 ? 'short of' : 'over'} the world's by ${s.lvGap}`);
      if (Math.abs(s.idPop) > 2) why.push(`world.population differs from Σ countries by ${s.idPop}`);
      if (Math.abs(s.idGdp) > 2) why.push(`world.gdp differs from Σ countries by ${s.idGdp}`);
      why.push(...keyBreaches(s.C).slice(0, 3));
      if (why.length) bad.push(`${r}/${f} (${s.date}, v${s.v}): ${why.join('; ')}`);
    }
  }
  const pre_note = pre ? ` · ${pre} pre-v12 summary(ies) read, ${preHit} with a dropped record (cannot be repaired — summary_drops.mjs --session sizes them)` : '';
  if (bad.length) { console.log(`L38 FAIL: ${bad.length} v12+ summary(ies) break the one-entry-per-record identities:\n  ` + bad.slice(0, 12).join('\n  ') + pre_note); return 1; }
  console.log(`L38 PASS: ${v12} v12+ summary(ies) over ${runs} run(s) hold every country record (Σ countries = world on levels, population, GDP; keys tag or tag@id)${pre_note}`);
  return 0;
}

// ---- --selftest: L38's pre-batch half. A synthetic melt with two records on one definition through the REAL writer.
function selftest() {
  const melt = [
    'date=1900.1.1',
    'country_manager={', '\tdatabase={',
    '\t\t1={', '\t\t\tdefinition="AAA"', '\t\t\tis_main_tag=yes',
    '\t\t\tpop_statistics={', '\t\t\t\tpopulation_by_profession={', '\t\t\t\t\t0=1000 8=5000', '\t\t\t\t}', '\t\t\t}',
    '\t\t\tgdp={', '\t\t\t\tchannels={', '\t\t\t\t\t0={', '\t\t\t\t\t\tvalues={', '\t\t\t\t\t\t\t100 200', '\t\t\t\t\t\t}', '\t\t\t\t\t}', '\t\t\t\t}', '\t\t\t}',
    '\t\t}',
    // the SECOND record of AAA comes later in slot order — exactly the one a definition-keyed writer lets win
    '\t\t2={', '\t\t\tdefinition="AAA"', '\t\t\tcivil_war=yes',
    '\t\t\tpop_statistics={', '\t\t\t\tpopulation_by_profession={', '\t\t\t\t\t8=700', '\t\t\t\t}', '\t\t\t}',
    '\t\t\tgdp={', '\t\t\t\tchannels={', '\t\t\t\t\t0={', '\t\t\t\t\t\tvalues={', '\t\t\t\t\t\t\t30', '\t\t\t\t\t\t}', '\t\t\t\t\t}', '\t\t\t\t}', '\t\t\t}',
    '\t\t}',
    '\t\t3={', '\t\t\tdefinition="BBB"', '\t\t\tis_main_tag=yes', '\t\t}',
    '\t}', '}',
    'states={', '\tdatabase={', '\t\t10={', '\t\t\tcountry=1', '\t\t}', '\t\t11={', '\t\t\tcountry=2', '\t\t}', '\t}', '}',
    'building_manager={', '\tdatabase={',
    '\t\t100={', '\t\t\tbuilding="building_selftest"', '\t\t\tstate=10', '\t\t\tlevels=5', '\t\t}',
    '\t\t101={', '\t\t\tbuilding="building_selftest"', '\t\t\tstate=11', '\t\t\tlevels=3', '\t\t}',
    '\t}', '}', ''].join('\n');
  const tmp = mkdtempSync(join(tmpdir(), 'l38-'));
  try {
    const src = join(tmp, 'selftest_melt.txt'), out = join(tmp, 'selftest.json');
    writeFileSync(src, melt);
    const p = spawnSync(process.execPath, [WRITER, src, '--out', out], { encoding: 'utf8' });
    if (p.status !== 0) { console.log(`L38 FAIL: the summary writer threw on the self-test melt: ${(p.stderr || '').trim().slice(-400)}`); return 1; }
    const j = JSON.parse(readFileSync(out, 'utf8')), C = j.countries || {}, why = [];
    if (!(+j.save_summary_version >= 12)) why.push(`version ${j.save_summary_version} (expected ≥ 12)`);
    if (!C.AAA || C.AAA.id !== 1) why.push(`countries.AAA is ${C.AAA ? 'record ' + C.AAA.id : 'absent'} — it must be the main record 1`);
    if (!C['AAA@2'] || C['AAA@2'].id !== 2) why.push(`countries['AAA@2'] is ${C['AAA@2'] ? 'record ' + C['AAA@2'].id : 'absent'} — the second AAA record was dropped`);
    if (!C.BBB) why.push('countries.BBB absent');
    if (+j.world.population !== 6700) why.push(`world.population ${j.world.population}, expected 6700 (1000 + 5000 + 700)`);
    if (+j.world.gdp !== 230) why.push(`world.gdp ${j.world.gdp}, expected 230 (200 + 30)`);
    const s = scan(j); if (Math.abs(s.lvGap) > 0.5) why.push(`Σ countries' levels short of the world's by ${s.lvGap}`);
    why.push(...keyBreaches(C));
    if (j.states?.['11']?.country !== 'AAA@2') why.push(`states.11.country is ${j.states?.['11']?.country}, expected AAA@2`);
    if (why.length) { console.log(`L38 FAIL: save_state_summary.mjs loses a country record that shares a definition: ${why.join('; ')}`); return 1; }
    console.log('L38 PASS: save_state_summary.mjs keeps both records of a shared definition (AAA + AAA@2), world totals over every record');
    return 0;
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

if (argv.includes('--selftest')) process.exit(selftest());
if (argv.includes('--check')) process.exit(check(argOf('--check', '')));

// ---- report mode
const specs = []; for (let i = 0; i < argv.length; i++) if (argv[i] === '--session') specs.push(argv[i + 1]);
if (!specs.length) { console.error('usage: --session <stamp>[,<stamp>][:<setup>] [--years a-b] [--all] [--detail] [--json out] | --check <session> | --selftest'); process.exit(2); }
const [Y0, Y1] = (argOf('--years', '') || '0-9999').split('-').map(Number);
const ALL = argv.includes('--all'), DETAIL = argv.includes('--detail'), JSON_OUT = argOf('--json', '');
const report = [];
for (const spec of specs) {
  const [s, setup] = spec.split(':');
  const { runs, dropped } = usableRuns(SES, s, setup || ''); reportDropped(dropped);
  console.log(`\n== ${spec} · ${runs.length} usable run(s)${Y0 > 0 ? ` · years ${Y0}–${Y1}` : ''} · ${ALL ? 'every summary' : 'the first summary of each year (what criteria.mjs reads)'}`);
  for (const rel of runs) {
    const sd = join(SES, rel, 'save_summaries'); const seenY = new Set(); const rows = [];
    for (const f of listSummaries(sd)) {
      let j; try { j = load(join(sd, f)); } catch { continue; }
      const date = j.provenance?.date || ''; const y = +date.split('.')[0];
      if (!y || y < Y0 || y > Y1) continue;
      if (!ALL) { if (seenY.has(y)) continue; seenY.add(y); }
      const x = scan(j); delete x.C; rows.push({ file: f, ...x });
    }
    const hit = rows.filter(r => r.lvGap > 0.5), v12 = rows.filter(r => r.v >= 12);
    const mean = rows.length ? rows.reduce((a, r) => a + r.share, 0) / rows.length : 0;
    const worst = rows.reduce((b, r) => (!b || r.share > b.share ? r : b), null);
    // the register's world GDP over the window, as read and with the estimated dropped GDP put back
    const gRead = rows.reduce((a, r) => a + r.gdp, 0), gEst = rows.reduce((a, r) => a + r.gdp + r.estGdp, 0);
    const memb = {};
    for (const r of rows) for (const m of r.members) { const e = memb[m.tag + (m.selfOverlord ? '⚑⚑' : '')] ??= { from: r.date, to: r.date, n: 0 }; e.to = r.date; e.n++; }
    const mtxt = Object.entries(memb).map(([t, e]) => `${t} ${e.n}× ${e.from}→${e.to}`).join(', ');
    console.log(`  ${basename(rel).padEnd(32)} ${String(rows.length).padStart(3)} read (v${[...new Set(rows.map(r => r.v))].join('/')}) · ${String(hit.length).padStart(3)} with a dropped record` +
      ` · est. dropped GDP ${(100 * mean).toFixed(2)}% mean, ${worst ? (100 * worst.share).toFixed(2) + '% max at ' + worst.date : '—'}` +
      ` · world GDP ×${gRead ? (gEst / gRead).toFixed(4) : '—'} restored${mtxt ? ` · ⚠ SHORTLIST not main: ${mtxt}` : ''}${v12.length && v12.some(r => Math.abs(r.lvGap) > 0.5) ? ' · ⛔ A v12 SUMMARY WITH A GAP' : ''}`);
    if (DETAIL) for (const r of rows) if (r.lvGap > 0.5 || r.members.length)
      console.log(`      ${r.date.padEnd(10)} v${r.v} dropped ${String(r.lvGap).padStart(6)} levels · VA £${M(r.vaGap ?? 0)}M → est. GDP £${M(r.estGdp)}M (${(100 * r.share).toFixed(2)}% of the world)${r.members.length ? ' · ' + r.members.map(m => `${m.tag}${m.selfOverlord ? '⚑⚑' : ''} id ${m.id}`).join(' ') : ''}`);
    report.push({ spec, run: rel, rows, meanShare: mean, restore: gRead ? gEst / gRead : null, members: memb });
  }
}
if (JSON_OUT) { writeFileSync(JSON_OUT, JSON.stringify(report, null, 1)); console.log(`\nwrote ${JSON_OUT}`); }
