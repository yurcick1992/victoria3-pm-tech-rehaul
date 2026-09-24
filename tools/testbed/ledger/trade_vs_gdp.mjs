// IS THERE MORE TRADE THAN IN RUNS OF THE SAME GDP, AND ARE PRICES CLOSER BETWEEN MARKETS? (FINDINGS F161 §1–§2; user-asked
// 2026-09-24: "Is there much more trade than in canon and other four-rung runs of similar GDP? Are prices normalised better
// between markets as a result?")
// Per complete run with a kept 1936 save: world GDP (1932–36 mean ÷ vanilla's median, same years) · trade intensity at 1936 (a
// year's base-£ moved one way ÷ world GDP, from the v10+ per-good trade capacity × that run's OWN traded quantities × cost —
// the trade centres' quantity multiplier NOT included, the same basis in every run) · import share of demand VALUE in the five
// markets every run logged (British, French/Communard, American, Russian, Japanese; the 1930 + 1935 dumps) · the cross-market
// price DISPERSION (per good the sd of price ÷ base across those five markets, goods with demand in ≥ 4; median by class).
// Then each arm run against the other runs within ±--match of its world GDP.
// ⚠ Comparison runs' yearly summaries may predate v10: their kept 1936 SAVE is re-summarised into --cache (named
// <session>__<run>.json.gz); --build-cache melts the missing ones (≈ 6 s each, three at a time).
// usage: node tools/testbed/ledger/trade_vs_gdp.mjs --arm <session>:<setup> [--arm …] --cache <dir> [--build-cache]
//          [--since 20260905] [--match 0.08] [--van 20260821_131149_vanilla-baseline-n16]
import fs from 'node:fs'; import zlib from 'node:zlib'; import path from 'node:path'; import { spawn } from 'node:child_process';
import { goodsTable, tradedQuantity, tradeClasses } from './lib_goods.mjs';
import { REPO, SES } from './lib_obsolescence.mjs';
const argv = process.argv.slice(2); const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const allOf = k => argv.flatMap((a, i) => a === k ? [argv[i + 1]] : []);
const ARMS = allOf('--arm').map(s => { const [session, setup] = s.split(':'); return { session, setup }; });
const CACHE = argOf('--cache', null), SINCE = argOf('--since', '20260905'), MATCH = +argOf('--match', '0.08');
const VAN = argOf('--van', '20260821_131149_vanilla-baseline-n16');
if (!ARMS.length || !CACHE) { console.error('usage: --arm <session>:<setup> [--arm …] --cache <dir> [--build-cache]'); process.exit(1); }
fs.mkdirSync(CACHE, { recursive: true });
const G = goodsTable(), { classes, classOf } = tradeClasses(null), K = Object.keys(classes);
const FIVE = { 'British Market': 'GBR', 'French Market': 'FRA', 'Communard Market': 'FRA', 'American Market': 'USA', 'Russian Market': 'RUS', 'Japanese Market': 'JAP' };
const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const m = (s.length - 1) / 2; return (s[Math.floor(m)] + s[Math.ceil(m)]) / 2; };
const sd = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
const load = f => JSON.parse(f.endsWith('.gz') ? zlib.gunzipSync(fs.readFileSync(f)) : fs.readFileSync(f, 'utf8'));
// ---- the runs: every complete run (reached 1936, not abandoned) with a kept save, since --since
const runs = [];
for (const s of fs.readdirSync(SES).filter(d => d.slice(0, 8) >= SINCE && fs.statSync(path.join(SES, d)).isDirectory())) {
  for (const r of fs.readdirSync(path.join(SES, s)).filter(d => /^run\d+/.test(d))) { const dir = path.join(SES, s, r);
    let m; try { m = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8')); } catch { continue; } if (!String(m.reached_ingame_date).startsWith('1936') || m.abandoned_reason) continue;
    let bs = null; try { bs = JSON.parse(fs.readFileSync(path.join(dir, 'build_state.json'), 'utf8')); } catch { }
    if (bs?.deterministic?.arm && bs.deterministic.arm !== 'config') continue;   // four-rung MOD runs only; vanilla is the GDP reference
    const sv = path.join(dir, 'saves'); const save = fs.existsSync(sv) ? fs.readdirSync(sv).filter(x => x.endsWith('.v3')).sort().pop() : null; if (!save) continue;
    const isArm = ARMS.some(a => a.session === s && r.endsWith('_' + a.setup));
    // ⚠ the run's OWN book decides its traded quantities — an arm read with vanilla's would lose exactly the effect under test
    let cfg = null; const cp = bs?.deterministic?.mod_under_test?.built_from_config;
    try { if (cp) cfg = JSON.parse(fs.readFileSync(path.isAbsolute(cp) ? cp : path.join(REPO, cp), 'utf8')); } catch { }
    if (isArm && !cfg) throw new Error(`${s}/${r}: the arm's book (build_state → mod_under_test.built_from_config) cannot be read — refusing to read it with vanilla's traded quantities`);
    runs.push({ session: s, run: r, dir, save: path.join(sv, save), isArm, cfg, cache: path.join(CACHE, s + '__' + r + '.json.gz') });
  } }
// ---- build the cache where asked
const missing = runs.filter(x => !fs.existsSync(x.cache));
if (missing.length && argv.includes('--build-cache')) {
  let i = 0; const next = () => { if (i >= missing.length) return null; const x = missing[i++];
    return new Promise(res => spawn(process.execPath, [path.join(REPO, 'tools/testbed/save_state_summary.mjs'), x.save, '--out', x.cache], { stdio: 'ignore' }).on('close', res)); };
  const worker = async () => { let p; while ((p = next())) await p; };
  await Promise.all([worker(), worker(), worker()]); console.log(`cache: built ${missing.length} summaries into ${CACHE}`);
} else if (missing.length) console.log(`⚠ ${missing.length} run(s) have no cached 1936 summary and read without trade intensity (pass --build-cache)`);
// ---- vanilla medians of world GDP per year 1932–1936
const vg = {}; for (const r of fs.readdirSync(path.join(SES, VAN)).filter(d => /^run\d+/.test(d))) { const sd_ = path.join(SES, VAN, r, 'save_summaries');
  for (const f of fs.readdirSync(sd_).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).sort().slice(-10)) { const j = load(path.join(sd_, f)); const d = j.provenance?.date; if (/^193[2-6]\.1\.1$/.test(d)) (vg[d.slice(0, 4)] ??= []).push(j.world.gdp); } }
const vmed = Object.fromEntries(Object.entries(vg).map(([y, a]) => [y, med(a)]));
function endGdp(dir) { const sd_ = path.join(dir, 'save_summaries'); const v = {}; for (const f of fs.readdirSync(sd_).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).sort().slice(-10)) { let j; try { j = load(path.join(sd_, f)); } catch { continue; } const d = j.provenance?.date; if (/^193[2-6]\.1\.1$/.test(d)) v[d.slice(0, 4)] = j.world.gdp / vmed[d.slice(0, 4)]; }
  const a = Object.values(v); return a.length === 5 ? a.reduce((x, y) => x + y, 0) / 5 : NaN; }
function tradeInt(j, TQ) { let V = 0; const vc = {}; for (const [g, x] of Object.entries(j.world.trade_goods || {})) { if (!G[g]?.cost || !classOf[g]) continue; const v = (x.imp + x.exp) * (TQ[g] || 0) * G[g].cost / 2; V += v; vc[classOf[g]] = (vc[classOf[g]] || 0) + v; }
  return { int: 52 * V / j.world.gdp, vc, gdp: j.world.gdp }; }
const tsv = {};
function priceStats(x) { const runNo = String(+x.run.slice(3, 6)); let file = path.join(x.dir, 'markets.tsv'), filt = null; if (!fs.existsSync(file)) { file = path.join(SES, x.session, 'markets_all.tsv'); filt = runNo; } if (!fs.existsSync(file)) return null;
  const L = (tsv[file] ??= fs.readFileSync(file, 'utf8').split(/\r?\n/)); const ix = Object.fromEntries(L[0].split('\t').map((h, i) => [h, i])); const rc = ix.run_index ?? ix.run; const D = {};
  for (let i = 1; i < L.length; i++) { const p = L[i].split('\t'); if (p.length < 10 || (filt && p[rc] !== filt)) continue; const d = p[ix.dump_date]; if (d !== '1930.1.1' && d !== '1935.1.1') continue;
    const m = FIVE[p[ix.tag]]; const g = p[ix.good]; if (!m || !G[g]?.cost) continue; ((D[d] ??= {})[m] ??= {})[g] = { buy: +p[ix.buy_orders], imp: +p[ix.imports], pr: +p[ix.price] / G[g].cost }; }
  const disp = {}, all = []; let buy = 0, imp = 0;
  for (const M of Object.values(D)) { const by = {}; for (const g of Object.keys(G)) { if (!classOf[g]) continue; const ps = Object.values(M).map(v => v[g]).filter(v => v && v.buy > 0).map(v => v.pr); if (ps.length >= 4) { const s = sd(ps); (by[classOf[g]] ??= []).push(s); all.push(s); } }
    for (const k of K) (disp[k] ??= []).push(med(by[k] || [])); for (const V of Object.values(M)) for (const [g, v] of Object.entries(V)) { if (!classOf[g]) continue; buy += v.buy * G[g].cost; imp += v.imp * G[g].cost; } }
  return { disp: Object.fromEntries(K.map(k => [k, med(disp[k] || [])])), all: med(all), imp: imp / buy }; }
const rows = runs.map(x => ({ ...x, g: endGdp(x.dir), t: fs.existsSync(x.cache) ? tradeInt(load(x.cache), tradedQuantity(x.cfg, G)) : null, p: priceStats(x) })).filter(x => Number.isFinite(x.g)).sort((a, b) => a.g - b.g);
const pc = x => Number.isFinite(x) ? (100 * x).toFixed(1) + '%' : '—', f3 = x => Number.isFinite(x) ? x.toFixed(3) : '—';
const others = rows.filter(x => !x.isArm), arm = rows.filter(x => x.isArm);
console.log(`${others.length} comparison runs (four-rung, since ${SINCE}) · ${arm.length} arm run(s) · GDP matched within ±${MATCH}`);
const q = (a, p) => { a = a.filter(Number.isFinite).sort((x, y) => x - y); return a[Math.round(p * (a.length - 1))]; };
for (const [lab, f, fmt] of [['trade ÷ GDP', x => x.t?.int, pc], ['import share', x => x.p?.imp, pc], ['dispersion, all goods', x => x.p?.all, f3]]) {
  const a = others.map(f); console.log(`  ${lab.padEnd(22)} others min ${fmt(q(a, 0))} median ${fmt(q(a, 0.5))} max ${fmt(q(a, 1))}`); }
for (const t of arm) { const m = others.filter(o => Math.abs(o.g - t.g) <= MATCH); const md = f => med(m.map(f));
  console.log(`\n  ${t.session.slice(0, 15)}/${t.run.slice(0, 6)}  world GDP ${t.g.toFixed(2)} · n=${m.length} matched`);
  console.log(`    trade ÷ GDP ${pc(t.t?.int)} vs ${pc(md(o => o.t?.int))} (above ${others.filter(o => o.t && o.t.int < t.t?.int).length} of ${others.filter(o => o.t).length} runs) · import share ${pc(t.p?.imp)} vs ${pc(md(o => o.p?.imp))}`);
  console.log(`    per class trade ÷ GDP: ` + K.map(k => `${k} ${pc(52 * (t.t?.vc[k] || 0) / t.t?.gdp)} vs ${pc(md(o => o.t ? 52 * (o.t.vc[k] || 0) / o.t.gdp : NaN))}`).join(' · '));
  console.log(`    price dispersion (sd of price÷base, 5 markets): all ${f3(t.p?.all)} vs ${f3(md(o => o.p?.all))} | ` + K.map(k => `${k} ${f3(t.p?.disp[k])}/${f3(md(o => o.p?.disp[k]))}`).join(' ')); }
