#!/usr/bin/env node
// ⭐⭐ THE EARLY-GAME PROBE READER — what a short 1836→1838 batch says about the anchor, written 2026-09-19 for the in0 probe
// (schedule `in0_early_probe.json`) and reusable for any batch of the same shape: several one-lever arms, two in-game years,
// quarterly save summaries, market dumps through the window.
//
// It answers exactly the three questions the probe was launched to answer, and nothing else:
//   1. IS THE WORLD PRODUCT DISTORTED?   world GDP per arm at each summary year, ÷ the control arm's.
//   2. WHAT ARE THE REALISED MARGINS?    per ERA (the rung's own era from that run's config), by F92's identity
//                                        margin = profit ÷ (va_out − profit) — the same definition as the register and the sheet.
//   3. DO WE HIT THE PREDICTION FOR DEAD INDUSTRIES?  the count AND the staffed-level share of tiered building types running a
//                                        NEGATIVE margin, with the worst named, and the control arm's own count beside it.
//   plus the input-price path (the feedback the paper census could not see) from markets.tsv.
//
// ⚠ Two in-game years is not the century: nothing here speaks to obsolescence, the price decline or the hoard.
// ⚠ A building type with no staffed levels is not counted — "unprofitable" and "absent" are different statements (§10.17's rule).
//
// usage: node tools/testbed/ledger/early_probe.mjs --session <stamp> [--control vanilla] [--years 1837,1838] [--goods fabric,wood,...]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SES = join(REPO, 'tools/testbed/sessions');
const { usableRuns, reportDropped } = await import(pathToFileURL(join(REPO, 'tools/testbed/ledger/lib_runs.mjs')).href);
const argOf = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const SESSION = argOf('--session', '');
const CONTROL = argOf('--control', 'vanilla');
const YEARS = argOf('--years', '1837,1838').split(',').map(Number);
const GOODS = argOf('--goods', 'fabric,wood,iron,coal,sulfur,clothes,groceries,furniture,glass,paper,tools,steel').split(',');
if (!SESSION) { console.error('usage: --session <stamp> [--control vanilla] [--years 1837,1838]'); process.exit(2); }

const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const f2 = (x, d = 2) => Number.isFinite(x) ? x.toFixed(d) : '—';
const pc = (x, d = 1) => Number.isFinite(x) ? (100 * x).toFixed(d) + '%' : '—';
const BASE = Object.fromEntries(readFileSync(join(REPO, 'tools/goods_prices.tsv'), 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#')).map(l => l.split('\t')).map(([g, p]) => [g.trim(), +p]));

// ---- the setups in this session, from its own schedule
const sched = JSON.parse(readFileSync(join(SES, SESSION, 'schedule.json'), 'utf8'));
const SETUPS = Object.keys(sched.setups || {});

// ---- a run's config → key → {era, industry}
function tierMapOf(runDir) {
  let p = '';
  try { const bs = JSON.parse(readFileSync(join(runDir, 'build_state.json'), 'utf8')); const d = bs.deterministic || {};
    p = (d.mod_under_test || {}).built_from_config || d.built_from_config || ''; } catch { p = ''; }
  if (!p) return null;
  const abs = existsSync(p) ? p : join(REPO, p); if (!existsSync(abs)) return null;
  const cfg = JSON.parse(readFileSync(abs, 'utf8')); const tier = {};
  for (const ind of cfg.industries || []) { if (ind.disabled) continue; for (const t of ind.tiers || []) tier[t.key] = { era: t.era, ind: ind.id,
    emp: Object.values(t.employment || {}).reduce((a, b) => a + (+b || 0), 0) * (t.workforce_mult || 1), out: +t.output_qty || 0 }; }
  return { path: abs.replace(REPO, '').replace(/^[\\/]/, ''), tier };
}
// ---- one run's summaries
function readRun(rel) {
  const dir = join(SES, rel, 'save_summaries'); const years = new Map();
  if (!existsSync(dir)) return years;
  for (const fn of readdirSync(dir).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, fn))).toString('utf8')); } catch { continue; }
    const date = String((j.provenance && j.provenance.date) || ''); const y = +date.split('.')[0]; if (!y) continue;
    const C = j.countries || {}; let gdp = +((j.world || {}).gdp) || 0, pool = 0;
    const B = {};   // building type → {profit, vaOut, vaIn, staffing, levels}
    for (const c of Object.values(C)) { if (!+((j.world || {}).gdp)) gdp += +c.gdp || 0; pool += +c.investment_pool || 0;
      for (const [k, b] of Object.entries(c.buildings || {})) { const r = (B[k] ||= { profit: 0, vaOut: 0, vaIn: 0, staffing: 0, levels: 0 });
        r.profit += +b.profit || 0; r.vaOut += +b.va_out || 0; r.vaIn += +b.va_in || 0; r.staffing += +b.staffing || 0; r.levels += +b.levels || 0; } }
    // keep the LAST summary of each year (the probe writes four)
    years.set(y, { date, gdp, pool, B });
  }
  return years;
}
// ---- prices from markets.tsv
function readPrices(rel) {
  const f = join(SES, rel, 'markets.tsv'); const out = {}; if (!existsSync(f)) return out;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) { const c = line.split('\t'); if (c.length < 8) continue;
    const date = String(c[1]), mk = c[2], g = c[4], p = +c[7]; if (!(p > 0) || !BASE[g]) continue;
    (((out[date] ||= {})[mk] ||= {})[g] = p); }
  return out;
}

// ---- gather
const ARM = {};
for (const s of SETUPS) { let runs = [];
  // an arm that has not run yet is EMPTY, not an error — a probe is read while it is still playing
  try { const r = usableRuns(SES, SESSION, s); runs = r.runs; reportDropped(r.dropped); } catch { runs = []; }
  ARM[s] = runs.map(rel => ({ rel, years: readRun(rel), P: readPrices(rel), map: tierMapOf(join(SES, rel)) })).filter(r => r.years.size); }
// ⭐ the CONTROL arm has no config of its own, but an era-0 rung's KEY IS the vanilla building's key (make_tier4_config keeps it, and
// that is load-bearing there), so a mod arm's map read against a vanilla save matches exactly the era-0 buildings and nothing else.
// That makes vanilla's own shedding of the same building types the baseline this batch is judged against.
const FALLBACK = Object.values(ARM).flat().find(r => r.map);
if (FALLBACK) for (const rs of Object.values(ARM)) for (const r of rs) if (!r.map) r.map = { ...FALLBACK.map, borrowed: true };

console.log('EARLY-GAME PROBE — ' + SESSION + ' · control arm "' + CONTROL + '" · ' + SETUPS.map(s => s + ' n=' + (ARM[s] || []).length).join(' · '));
console.log('margin = profit ÷ (va_out − profit), F92\'s identity — the game\'s own profitability, no wage model. Two in-game years: the ANCHOR, not the century.\n');

// ---- 1. the world product
console.log('=== 1. IS THE WORLD PRODUCT DISTORTED? (world GDP, median over each arm\'s runs) ===');
const ctlG = {}; for (const y of YEARS) ctlG[y] = med((ARM[CONTROL] || []).map(r => r.years.get(y) && r.years.get(y).gdp));
console.log('arm            ' + YEARS.map(y => ('£M ' + y).padStart(12)).join('') + '   ' + YEARS.map(y => ('÷ control').padStart(11)).join('') + '   per-run spread at ' + YEARS[YEARS.length - 1]);
for (const s of SETUPS) { const rs = ARM[s] || []; if (!rs.length) { console.log('  ' + s.padEnd(13) + ' (no usable run)'); continue; }
  const g = YEARS.map(y => med(rs.map(r => r.years.get(y) && r.years.get(y).gdp)));
  const last = rs.map(r => { const v = r.years.get(YEARS[YEARS.length - 1]); return v && v.gdp; }).filter(Number.isFinite);
  console.log('  ' + s.padEnd(13) + g.map(v => f2(v / 1e6, 0).padStart(12)).join('') + '   ' + YEARS.map((y, i) => f2(g[i] / ctlG[y]).padStart(11)).join('')
    + '   ' + (last.length ? last.map(v => f2(v / 1e6, 0)).join(' / ') : '—')); }

// ---- 2 + 3. margins and the dead, per era and per type
for (const y of YEARS) {
  console.log('\n=== 2+3. REALISED MARGINS AND THE DEAD AT ' + y + ' ===');
  console.log('arm            era0    era1    era2    era3   | tiered types running NEGATIVE (of those with staffed levels), and their share of tiered staffed levels');
  for (const s of SETUPS) { const rs = (ARM[s] || []).filter(r => r.years.has(y)); if (!rs.length) continue;
    const eraM = [0, 1, 2, 3].map(e => med(rs.map(r => { if (!r.map) return NaN; let p = 0, o = 0;
      for (const [k, b] of Object.entries(r.years.get(y).B)) { const t = r.map.tier[k]; if (!t || t.era !== e) continue; p += b.profit; o += b.vaOut; }
      return (o - p) > 0 ? p / (o - p) : NaN; })));
    const neg = med(rs.map(r => { if (!r.map) return NaN; let n = 0; for (const [k, b] of Object.entries(r.years.get(y).B)) { if (!r.map.tier[k] || !(b.staffing > 0)) continue; if (b.profit < 0) n++; } return n; }));
    const tot = med(rs.map(r => { if (!r.map) return NaN; let n = 0; for (const [k, b] of Object.entries(r.years.get(y).B)) { if (!r.map.tier[k] || !(b.staffing > 0)) continue; n++; } return n; }));
    const negLv = med(rs.map(r => { if (!r.map) return NaN; let a = 0, t = 0; for (const [k, b] of Object.entries(r.years.get(y).B)) { if (!r.map.tier[k] || !(b.staffing > 0)) continue; t += b.staffing; if (b.profit < 0) a += b.staffing; } return t > 0 ? a / t : NaN; }));
    console.log('  ' + s.padEnd(13) + eraM.map(v => pc(v, 0).padStart(7)).join(' ') + '   | ' + (Number.isFinite(neg) ? neg + ' of ' + tot + ' (' + pc(neg / tot, 0) + ' of types, ' + pc(negLv, 0) + ' of staffed levels)' : '— (control arm: no tiered buildings)'));
  }
  // the named worst, per arm
  console.log('  the worst tiered types (margin, staffed levels), median run of each arm:');
  for (const s of SETUPS) { const rs = (ARM[s] || []).filter(r => r.years.has(y) && r.map); if (!rs.length) continue;
    const r = rs[Math.floor(rs.length / 2)]; const list = [];
    for (const [k, b] of Object.entries(r.years.get(y).B)) { const t = r.map.tier[k]; if (!t || !(b.staffing > 0)) continue;
      const m = (b.vaOut - b.profit) > 0 ? b.profit / (b.vaOut - b.profit) : NaN; if (m < 0) list.push({ k: t.ind + ' e' + t.era, m, s: b.staffing }); }
    list.sort((a, b) => a.m - b.m);
    console.log('    ' + s.padEnd(13) + (list.length ? list.slice(0, 8).map(x => x.k + ' ' + pc(x.m, 0) + '/' + f2(x.s, 0) + 'lv').join(' · ') + (list.length > 8 ? ' · +' + (list.length - 8) : '') : 'none')); }
}

// ---- 3b. ⭐⭐ WHAT THE INSOLVENT INDUSTRY LOSES — the reading a binary "insolvent" hides
// (user, 2026-09-19: "It's important to understand the total output or employment of the 1836.1.1 insolvent industry.
//  Shedding half of the workforce and becoming profitable is OK, shedding 95% is death.")
// The engine lays a building off before it demolishes it, so the measure is STAFFED LEVELS, and the question is how much of
// the 1836 workforce and output survives the adjustment — and at what margin it ends up.
{
  const BASEY = Math.min(...[...new Set(Object.values(ARM).flat().flatMap(r => [...r.years.keys()]))]);   // the first summary year, ~1836.4.1
  const ENDY = YEARS[YEARS.length - 1];
  const band = x => !Number.isFinite(x) ? '—' : x >= 0.85 ? 'intact' : x >= 0.50 ? 'shed <half — an adjustment' : x >= 0.20 ? 'WOUNDED' : x >= 0.10 ? 'DYING' : 'DEAD';
  console.log('\n=== 3b. WHAT THE INSOLVENT INDUSTRY LOSES — staffed levels, workers and output retained ' + BASEY + ' → ' + ENDY + ' ===');
  console.log('Retained = staffed levels at ' + ENDY + ' ÷ staffed levels at the first summary. Workers = staffed levels × per-level employment,');
  console.log('output = staffed levels × the rung\'s own output_qty — both from the run\'s OWN config, so the arms are comparable in units.');
  console.log('Bands: intact ≥ 85% · an adjustment ≥ 50% · WOUNDED ≥ 20% · DYING ≥ 10% · DEAD below.\n');
  console.log('arm            tiered workers      tiered output      | of the ' + BASEY + ' tiered WORKFORCE, the share sitting in a type that by ' + ENDY + ' has');
  console.log('               ' + BASEY + ' → ' + ENDY + '        ' + BASEY + ' → ' + ENDY + '     | shed >half    shed >80%     shed >90% (death)');
  const per = {};
  for (const s of SETUPS) { const rs = (ARM[s] || []).filter(r => r.map && r.years.has(BASEY) && r.years.has(ENDY)); if (!rs.length) continue;
    const g = fn => med(rs.map(fn));
    const tot = (r, y, f) => { let v = 0; for (const [k, b] of Object.entries(r.years.get(y).B)) { const t = r.map.tier[k]; if (!t) continue; v += b.staffing * f(t); } return v; };
    const w0 = g(r => tot(r, BASEY, t => t.emp)), w1 = g(r => tot(r, ENDY, t => t.emp));
    // ⚠ OUTPUT is only computed for an arm with its OWN config: a borrowed map carries the MOD's output_qty, and a vanilla
    //   glassworks running pm_leaded_glass makes 40 where the era-0 rung makes 30. Employment is safe to borrow — per-level
    //   employment is constant across an industry's main methods on both sides (the tiered_panel.mjs finding).
    const own = rs.every(r => !r.map.borrowed);
    const o0 = own ? g(r => tot(r, BASEY, t => t.out)) : NaN, o1 = own ? g(r => tot(r, ENDY, t => t.out)) : NaN;
    const shareShed = thr => g(r => { let a = 0, t = 0;
      for (const [k, b] of Object.entries(r.years.get(BASEY).B)) { const ti = r.map.tier[k]; if (!ti || !(b.staffing > 0)) continue;
        const e = r.years.get(ENDY).B[k]; const keep = e ? e.staffing / b.staffing : 0; const w = b.staffing * ti.emp; t += w; if (keep < thr) a += w; }
      return t > 0 ? a / t : NaN; });
    console.log('  ' + s.padEnd(13) + (f2(w0 / 1e3, 0) + 'k → ' + f2(w1 / 1e3, 0) + 'k').padEnd(20) + (own ? f2(o0, 0) + ' → ' + f2(o1, 0) : '— (map borrowed)').padEnd(19)
      + '| ' + pc(shareShed(0.5), 0).padStart(9) + pc(shareShed(0.2), 0).padStart(13) + pc(shareShed(0.1), 0).padStart(13));
    // per (industry, era) detail for the median run
    const r = rs[Math.floor(rs.length / 2)]; const rows = [];
    for (const [k, b] of Object.entries(r.years.get(BASEY).B)) { const t = r.map.tier[k]; if (!t || !(b.staffing > 0)) continue;
      const e = r.years.get(ENDY).B[k] || { staffing: 0, profit: 0, vaOut: 0 };
      const m0 = (b.vaOut - b.profit) > 0 ? b.profit / (b.vaOut - b.profit) : NaN;
      const m1 = (e.vaOut - e.profit) > 0 ? e.profit / (e.vaOut - e.profit) : NaN;
      rows.push({ n: t.ind + ' e' + t.era, keep: e.staffing / b.staffing, m0, m1, w: b.staffing * t.emp, lv0: b.staffing, lv1: e.staffing }); }
    per[s] = rows.sort((a, b) => a.keep - b.keep);
  }
  // ⭐ PER INDUSTRY — the level the question actually lives at, and the only cross-arm comparison that is like for like:
  //   vanilla has ONE glassworks type where the mod has an e0 and an e1, so a per-TYPE comparison across arms is not one.
  console.log('\n  PER INDUSTRY — staffed levels retained ' + BASEY + ' → ' + ENDY + ', all rungs of the industry summed (median run of each arm):');
  const inds = [...new Set(Object.values(per).flat().map(x => x.n.split(' ')[0]))].sort();
  console.log('    industry     ' + SETUPS.filter(s => (ARM[s] || []).length).map(s => s.replace('probe-', '').padStart(13)).join(''));
  for (const id of inds) { const cells = SETUPS.filter(s => (ARM[s] || []).length).map(s => {
      const rs = (ARM[s] || []).filter(r => r.map && r.years.has(BASEY) && r.years.has(ENDY)); if (!rs.length) return '—';
      const r = rs[Math.floor(rs.length / 2)]; let a = 0, b = 0, m = 0, o = 0;
      for (const [k, v] of Object.entries(r.years.get(BASEY).B)) { const t = r.map.tier[k]; if (!t || t.ind !== id || !(v.staffing > 0)) continue;
        a += v.staffing; const e = r.years.get(ENDY).B[k]; b += e ? e.staffing : 0; if (e) { m += e.profit; o += e.vaOut; } }
      if (!(a > 0)) return '—';
      return pc(b / a, 0) + ' @' + pc((o - m) > 0 ? m / (o - m) : NaN, 0); });
    if (cells.every(c => c === '—')) continue;
    console.log('    ' + id.padEnd(13) + cells.map(c => c.padStart(13)).join('')); }
  console.log('    (x% @y% = the share of 1836 staffed levels still staffed at ' + ENDY + ', and the industry\'s margin there.)');

  for (const s of SETUPS) { const rows = per[s]; if (!rows || !rows.length) continue;
    const hurt = rows.filter(x => x.keep < 0.85);
    console.log('\n  ' + s + ' — every tiered type that lost staffing (median run), worst first:');
    console.log('    industry/rung     staffed lv ' + BASEY + '→' + ENDY + '   retained   margin ' + BASEY + ' → ' + ENDY + '   workers ' + BASEY + '   verdict');
    if (!hurt.length) { console.log('    (none — every tiered type held its staffing)'); continue; }
    for (const x of hurt.slice(0, 14)) console.log('    ' + x.n.padEnd(17) + (f2(x.lv0, 0) + ' → ' + f2(x.lv1, 0)).padStart(14) + pc(x.keep, 0).padStart(11)
      + ('   ' + pc(x.m0, 0) + ' → ' + pc(x.m1, 0)).padEnd(24) + f2(x.w / 1e3, 0).padStart(9) + 'k   ' + band(x.keep));
    if (hurt.length > 14) console.log('    … +' + (hurt.length - 14) + ' more'); }
}

// ---- 4. the input-price feedback
console.log('\n=== 4. THE PRICE PATH — British market, % of base, median over each arm\'s runs ===');
// ⚠ sort by the DATE, not the string: "1837.12.1" sorts before "1837.7.1" lexicographically
const dnum = d => { const [y, m, dd] = String(d).split('.').map(Number); return y * 10000 + (m || 1) * 100 + (dd || 1); };
const dates = [...new Set(Object.values(ARM).flat().flatMap(r => Object.keys(r.P)))].sort((a, b) => dnum(a) - dnum(b));
for (const s of SETUPS) { const rs = ARM[s] || []; if (!rs.length) continue;
  console.log('  ' + s + ':');
  console.log('    good        ' + dates.map(d => d.padStart(11)).join(''));
  for (const g of GOODS) { const row = dates.map(d => med(rs.map(r => { const m = r.P[d] && r.P[d]['British Market']; return m && m[g] ? 100 * m[g] / BASE[g] : NaN; })));
    if (row.every(v => !Number.isFinite(v))) continue;
    console.log('    ' + g.padEnd(12) + row.map(v => (Number.isFinite(v) ? v.toFixed(0) + '%' : '—').padStart(11)).join('')); } }
