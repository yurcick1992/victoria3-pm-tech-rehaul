// analyse_three_arm.mjs — read a multi-ARM session and answer the questions it was launched for.
//
//   node tools/testbed/analyse_three_arm.mjs <session dir> [--out report.md] [--compare <session>,<session>]
//
// Built for the 2026-08-11 three-arm batch (vanilla / mod / mod-without-trade-centre-subsidy), but the
// shape is general: it groups run folders by SETUP, aggregates each arm across its runs, and prints the
// axes a step-4 question is actually decided on.
//
// ⚠⚠ IT READS BOTH INSTRUMENTS, AND SAYS WHICH ONE EACH NUMBER CAME FROM. The save summaries give an
// ANNUAL per-country state series (GDP, buildings by type, professions, technologies, the itemised
// budget); the log telemetry gives the twelve dump dates plus everything that is an EVENT. Mixing them
// silently would make a table nobody can re-derive, so every block is labelled `[saves]` or `[logs]`.
//
// ⚠ "DEFAULT" IS NOT "BANKRUPTCY" (TESTBED_METRICS §1). `on_country_default` fires on ENTERING the
// default state, which usually ends within about a month and may end in recovery rather than bankruptcy.
// A real bankruptcy is only visible as `last_bankruptcy_date` inside a save — so this reports the two
// separately and never calls the first one the second. Counting DISTINCT last_bankruptcy_date values per
// country across the annual save series is what finally makes bankruptcy FREQUENCY measurable.
import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const SESSION = args.filter(a => !a.startsWith('--'))[0];
const OUT = argOf('--out', '');
const COMPARE = argOf('--compare', '').split(',').filter(Boolean);
if (!SESSION || !existsSync(SESSION)) { console.error('usage: analyse_three_arm.mjs <session dir> [--out report.md]'); process.exit(1); }

const L = [];
const say = s => L.push(s);
const n0 = x => Number.isFinite(x) ? Math.round(x).toLocaleString('en-US') : '—';
const n2 = x => Number.isFinite(x) ? (Number.isInteger(x) ? x.toLocaleString("en-US") : x.toFixed(2)) : "—";
const pc = x => Number.isFinite(x) ? (x * 100).toFixed(2) + '%' : '—';
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;

// ------------------------------------------------------------------ load
function loadRun(sessionDir, dir) {
  const runDir = join(sessionDir, dir);
  const r = { dir, setup: dir.replace(/^run\d+_/, ''), runDir };
  try { r.meta = JSON.parse(readFileSync(join(runDir, 'meta.json'), 'utf8')); } catch { r.meta = null; }
  try { r.build = JSON.parse(readFileSync(join(runDir, 'build_state.json'), 'utf8')); } catch { r.build = null; }
  // save summaries, keyed by in-game date
  r.saves = new Map();
  const sd = join(runDir, 'save_summaries');
  if (existsSync(sd)) for (const f of readdirSync(sd).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.'))) {
    try { const s = JSON.parse(gunzipSync(readFileSync(join(sd, f))).toString('utf8')); r.saves.set(s.provenance.date, s); } catch {}
  }
  // events
  r.events = [];
  const ev = join(runDir, 'events.tsv');
  if (existsSync(ev)) for (const line of readFileSync(ev, 'utf8').split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue; const f = line.split('\t'); r.events.push({ kind: f[1], a: f[2], b: f[3], date: f[4] });
  }
  // telemetry: only what the saves cannot give — TRADE (market trade capacity) and the treasury totals
  r.trade = new Map();                      // date -> [{name, capacity, tcN, tcLv}]
  const log = join(runDir, 'logs_live', 'debug.log');
  if (r.meta && existsSync(log)) {
    const tok = r.meta.token;
    for (const line of readFileSync(log, 'utf8').split(/\r?\n/)) {
      const i = line.indexOf(`V3TB|${tok}|TRADE|`);
      if (i < 0) continue;
      const f = line.slice(i).split('|');
      const date = f[3];
      if (!r.trade.has(date)) r.trade.set(date, []);
      r.trade.get(date).push({ name: f[4], capacity: +f[5], tcN: +f[6], tcLv: +f[7] });
    }
  }
  return r;
}

const runDirs = readdirSync(SESSION).filter(d => /^run\d+_/.test(d) && statSync(join(SESSION, d)).isDirectory()).sort();
const allRuns = runDirs.map(d => loadRun(SESSION, d));
// ⚠ ONLY FINISHED RUNS ARE AGGREGATED. A run still playing has a partial event log, no summaries and no
// wall time, and folding it into an arm's mean silently drags every figure toward zero — run 2 of the
// first batch contributed "0.00 default entries" to the mod arm while it was at in-game 1843. `ended` in
// meta.json is the completion signal.
const runs = allRuns.filter(r => r.meta && r.meta.ended);
const skipped = allRuns.length - runs.length;
if (!runs.length) { console.error('no FINISHED run in this session yet'); process.exit(1); }
const arms = [...new Set(runs.map(r => r.setup))];
const byArm = a => runs.filter(r => r.setup === a);

say(`# Three-arm session report — \`${SESSION.replace(/\\/g, '/').split('/').pop()}\``);
say('');
say(`Generated ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC by \`tools/testbed/analyse_three_arm.mjs\`.`);
if (skipped) say(`\n⚠ **${skipped} run(s) had not finished and are excluded** — every figure below is over completed runs only.`);
say('');

// ------------------------------------------------------------------ 1. runs
say('## 1. The runs  `[logs]`');
say('');
say('| run | arm | wall | reached | resumes | error.log lines | ours | autosaves | summaries |');
say('|---|---|---|---|---|---|---|---|---|');
for (const r of runs) {
  const m = r.meta || {};
  // ⚠ error_log_lines is an UPPER BOUND (L9): the ring is shared, so it carries other runs' lines too.
  // What is ours by definition is the count naming our own telemetry file, and that should be ZERO.
  let ours = '—';
  const el = join(r.runDir, 'logs_live', 'error.log');
  if (existsSync(el)) ours = String((readFileSync(el, 'utf8').match(/zzz_v3tb_telemetry\.txt/g) || []).length);
  say(`| ${r.dir} | ${r.setup} | ${m.wall_seconds ? (m.wall_seconds / 3600).toFixed(2) + ' h' : '—'} | ${m.reached_ingame_date ?? '—'} | ${m.resumes ?? '—'} | ${n0(m.error_log_lines)} | ${ours} | ${m.autosaves_written ?? '—'} | ${r.saves.size} |`);
}
say('');

say('### Wall clock by arm');
say('');
say('| arm | n | mean wall | in-game years/min | vs vanilla |');
say('|---|---|---|---|---|');
const wallOf = r => r.meta?.wall_seconds;
const vanMean = mean(byArm('vanilla').map(wallOf).filter(Number.isFinite));
for (const a of arms) {
  const w = byArm(a).map(wallOf).filter(Number.isFinite);
  const m = mean(w);
  const yrs = 100;                                    // every run in this batch spans 1836→1936
  say(`| ${a} | ${w.length} | ${Number.isFinite(m) ? (m / 3600).toFixed(2) + ' h' : '—'} | ${Number.isFinite(m) ? (yrs / (m / 60)).toFixed(3) : '—'} | ${Number.isFinite(m) && Number.isFinite(vanMean) ? ((m / vanMean - 1) * 100).toFixed(1) + '%' : '—'} |`);
}
say('');
if (COMPARE.length) {
  say('### Against earlier sessions  `[logs]`');
  say('');
  say('| session | run | arm-ish | wall | reached | metrics |');
  say('|---|---|---|---|---|---|');
  for (const s of COMPARE) {
    if (!existsSync(s)) { say(`| ${s} | — | — | *not found* | | |`); continue; }
    for (const d of readdirSync(s).filter(x => /^run\d+_/.test(x))) {
      let m = null, tel = null;
      try { m = JSON.parse(readFileSync(join(s, d, 'meta.json'), 'utf8')); } catch {}
      try { tel = JSON.parse(readFileSync(join(s, d, 'telemetry.json'), 'utf8')); } catch {}
      if (!m) continue;
      say(`| ${s.replace(/\\/g, '/').split('/').pop()} | ${d} | ${d.replace(/^run\d+_/, '')} | ${m.wall_seconds ? (m.wall_seconds / 3600).toFixed(2) + ' h' : '—'} | ${m.reached_ingame_date ?? '—'} | ${(tel?.metrics ?? []).join(' ')} |`);
    }
  }
  say('');
}

// ------------------------------------------------------------------ 2. GDP
const DATES = ['1840.1.1', '1860.1.1', '1880.1.1', '1900.1.1', '1920.1.1', '1935.1.1'];
const nearestSave = (r, date) => {
  if (r.saves.has(date)) return r.saves.get(date);
  const y = +date.split('.')[0];
  let best = null, bd = 1e9;
  for (const [d, s] of r.saves) { const dd = Math.abs(+d.split('.')[0] - y); if (dd < bd) { bd = dd; best = s; } }
  return bd <= 1 ? best : null;
};
const worldGdp = s => s ? s.world.gdp : NaN;

say('## 2. GDP  `[saves]`');
say('');
say('World GDP (sum of every country\'s own `gdp` trend), mean over each arm\'s runs.');
say('');
say(`| arm | ${DATES.join(' | ')} |`);
say(`|---|${DATES.map(() => '---').join('|')}|`);
for (const a of arms) {
  const cells = DATES.map(d => n0(mean(byArm(a).map(r => worldGdp(nearestSave(r, d))).filter(Number.isFinite))));
  say(`| ${a} | ${cells.join(' | ')} |`);
}
say('');
say('Top 8 economies at the last shared date, arm by arm (first run of each arm):');
say('');
for (const a of arms) {
  const r = byArm(a)[0]; const s = r && nearestSave(r, '1935.1.1');
  if (!s) { say(`- **${a}** — no save near 1935`); continue; }
  const top = Object.entries(s.countries).filter(([, c]) => c.gdp).sort((x, y) => y[1].gdp - x[1].gdp).slice(0, 8);
  say(`- **${a}** (${s.provenance.date}): ` + top.map(([t, c]) => `${t} ${(c.gdp / 1e6).toFixed(0)}M`).join(' · '));
}
say('');

// ------------------------------------------------------------------ 3. trade + trade centres
say('## 3. Trade and trade centres  `[logs]` for capacity, `[saves]` for levels');
say('');
say('Market trade capacity is a MARKET property and is not persisted in a save, so it can only come from');
say('telemetry. Trade-centre levels come from both and are a cross-check.');
say('');
say(`| arm | date | Σ trade capacity | Σ trade-centre levels | countries with ≥1 TC |`);
say('|---|---|---|---|---|');
for (const a of arms) {
  for (const d of ['1870.1.1', '1900.1.1', '1935.1.1']) {
    const rows = byArm(a).map(r => r.trade.get(d)).filter(Boolean);
    if (!rows.length) continue;
    const cap = mean(rows.map(x => x.reduce((s, y) => s + (y.capacity || 0), 0)));
    const lv = mean(rows.map(x => x.reduce((s, y) => s + (y.tcLv || 0), 0)));
    const nc = mean(rows.map(x => x.filter(y => y.tcN > 0).length));
    say(`| ${a} | ${d} | ${n0(cap)} | ${n0(lv)} | ${n0(nc)} |`);
  }
}
say('');

// ------------------------------------------------------------------ 4. subsidies
const SUBSIDY_KEYS = ['building_trade_center', 'building_port', 'building_railway', 'building_power_plant'];
say('## 4. Subsidy spend  `[saves]`');
say('');
say('Straight out of `country_building_budget.expenses.subsidies`, per building type — the line no');
say('telemetry function can break down. £/week, summed over every country, mean over an arm\'s runs.');
say('');
say(`| arm | date | ${SUBSIDY_KEYS.map(k => k.replace('building_', '')).join(' | ')} | all subsidies | as % of all gov expense |`);
say(`|---|---|${SUBSIDY_KEYS.map(() => '---').join('|')}|---|---|`);
for (const a of arms) {
  for (const d of ['1870.1.1', '1900.1.1', '1935.1.1']) {
    const per = byArm(a).map(r => {
      const s = nearestSave(r, d); if (!s) return null;
      const tot = {}, all = { sub: 0, exp: 0 };
      for (const c of Object.values(s.countries)) {
        const bb = c.building_budget || {};
        for (const [k, v] of Object.entries(bb.subsidies || {})) { tot[k] = (tot[k] || 0) + v; all.sub += v; }
        all.exp += Object.values(bb.expense_by_category || {}).reduce((x, y) => x + y, 0);
      }
      return { tot, all };
    }).filter(Boolean);
    if (!per.length) continue;
    const cells = SUBSIDY_KEYS.map(k => n0(mean(per.map(p => p.tot[k] || 0))));
    const sub = mean(per.map(p => p.all.sub)), exp = mean(per.map(p => p.all.exp));
    say(`| ${a} | ${d} | ${cells.join(' | ')} | ${n0(sub)} | ${exp ? (sub / exp * 100).toFixed(2) + '%' : '—'} |`);
  }
}
say('');

// ------------------------------------------------------------------ 5. defaults and bankruptcies
say('## 5. Defaults `[logs]` and BANKRUPTCIES `[saves]` — two different things');
say('');
say('`on_country_default` fires on ENTERING default, which usually ends within about a month and may end');
say('in recovery rather than bankruptcy (TESTBED_METRICS §1). A real bankruptcy is only visible as');
say('`last_bankruptcy_date` in a save — counting DISTINCT values per country across the annual series is');
say('what makes frequency measurable at all.');
say('');
say('⚠ The bankruptcy count is a **lower bound**: a country holds only its LAST bankruptcy date, so two');
say('within one year of each other appear as one at annual cadence. The default count has no such limit,');
say('being an event. Neither is comparable to the other — they measure different things.');
say('');
say('| arm | default entries (mean/run) | distinct bankruptcies (mean/run) | countries ever bankrupt at 1935 |');
say('|---|---|---|---|');
for (const a of arms) {
  const defs = byArm(a).map(r => r.events.filter(e => e.kind === 'DEFAULT').length);
  const bk = byArm(a).map(r => {
    const seen = new Set();
    for (const [, s] of [...r.saves].sort()) for (const [tag, c] of Object.entries(s.countries)) if (c.last_bankruptcy_date) seen.add(tag + '@' + c.last_bankruptcy_date);
    return seen.size;
  });
  const ever = byArm(a).map(r => { const s = nearestSave(r, '1935.1.1'); return s ? Object.values(s.countries).filter(c => c.last_bankruptcy_date).length : NaN; }).filter(Number.isFinite);
  say(`| ${a} | ${n2(mean(defs))} | ${n2(mean(bk))} | ${n2(mean(ever))} |`);
}
say('');

// ------------------------------------------------------------------ 6. specialisation
say('## 6. Specialisation — does a leader drive the others out?  `[saves]`');
say('');
say('The mod\'s central claim, as one number: for each good, the leading producer\'s share of world');
say('output. A near-monopoly and a three-way tie are the same ranking and completely different');
say('economies, which is why the summary keeps quantities.');
say('');
say('| arm | date | mean top-1 share | median | goods with top-1 > 50% | > 80% |');
say('|---|---|---|---|---|---|');
for (const a of arms) {
  for (const d of ['1870.1.1', '1900.1.1', '1935.1.1']) {
    const per = byArm(a).map(r => {
      const s = nearestSave(r, d); if (!s) return null;
      const sh = [];
      for (const g of Object.values(s.top_producers)) if (g.world > 0 && g.top.length) sh.push(g.top[0][1] / g.world);
      return sh;
    }).filter(Boolean);
    if (!per.length) continue;
    const all = per.flat().sort((x, y) => x - y);
    say(`| ${a} | ${d} | ${pc(mean(all))} | ${pc(all[all.length >> 1])} | ${n2(mean(per.map(p => p.filter(x => x > 0.5).length)))} | ${n2(mean(per.map(p => p.filter(x => x > 0.8).length)))} |`);
  }
}
say('');

say('### The sharpest test: do runners-up hold fewer engineers, machinists and capitalists?  `[saves]`');
say('');
say('Per 1000 people, in the #1 economy by GDP against the #5 and #10, at 1935.');
say('');
say('| arm | rank | engineers/1k | machinists/1k | capitalists/1k | academics/1k |');
say('|---|---|---|---|---|---|');
for (const a of arms) {
  const r = byArm(a)[0]; const s = r && nearestSave(r, '1935.1.1');
  if (!s) continue;
  const rank = Object.entries(s.countries).filter(([, c]) => c.gdp).sort((x, y) => y[1].gdp - x[1].gdp);
  for (const i of [0, 4, 9]) {
    const e = rank[i]; if (!e) continue;
    const p = e[1].professions, tot = Object.values(p).reduce((x, y) => x + y, 0);
    const per1k = k => tot ? (1000 * (p[k] || 0) / tot).toFixed(1) : '—';
    say(`| ${a} | #${i + 1} ${e[0]} | ${per1k('engineers')} | ${per1k('machinists')} | ${per1k('capitalists')} | ${per1k('academics')} |`);
  }
}
say('');

// ------------------------------------------------------------------ 7. is it broken
say('## 7. How broken is it — the mod against vanilla  `[saves]` + `[logs]`');
say('');
say('| arm | date | loss-making building levels | of total | subsidised levels | 1-level buildings | techs held (top-10 mean) |');
say('|---|---|---|---|---|---|---|');
for (const a of arms) {
  for (const d of ['1900.1.1', '1935.1.1']) {
    const per = byArm(a).map(r => {
      const s = nearestSave(r, d); if (!s) return null;
      let loss = 0, lv = 0, sub = 0, one = 0;
      for (const c of Object.values(s.countries)) for (const b of Object.values(c.buildings)) {
        lv += b.levels; sub += b.subsidised_levels; if (b.profit < 0) loss += b.levels; if (b.levels === 1) one++;
      }
      const top = Object.entries(s.countries).filter(([, c]) => c.gdp).sort((x, y) => y[1].gdp - x[1].gdp).slice(0, 10);
      return { loss, lv, sub, one, tech: mean(top.map(([, c]) => c.technologies)) };
    }).filter(Boolean);
    if (!per.length) continue;
    const lv = mean(per.map(p => p.lv));
    say(`| ${a} | ${d} | ${n0(mean(per.map(p => p.loss)))} | ${lv ? (mean(per.map(p => p.loss)) / lv * 100).toFixed(1) + '%' : '—'} | ${n0(mean(per.map(p => p.sub)))} | ${n0(mean(per.map(p => p.one)))} | ${n2(mean(per.map(p => p.tech)))} |`);
  }
}
say('');
// ------------------------------------------------------------------ 8. capital
say('## 8. Does modernising cost capital?  `[saves]`');
say('');
say('The third of the mod\'s three goals: a newer factory must be BUILT, not toggled on for free, which');
say('should raise construction demand and show up as a capital deficit. Construction goods spend comes');
say('from `country_building_budget.expenses.construction_goods`; the investment pool is the country\'s own.');
say('');
say('| arm | date | Σ construction goods £/wk | as % of world GDP/52 | Σ investment pool | pool ÷ weekly construction |');
say('|---|---|---|---|---|---|');
for (const a of arms) {
  for (const d of ['1870.1.1', '1900.1.1', '1935.1.1']) {
    const per = byArm(a).map(r => {
      const s = nearestSave(r, d); if (!s) return null;
      let con = 0, pool = 0;
      for (const c of Object.values(s.countries)) {
        con += (c.building_budget?.expense_by_category?.construction_goods) || 0;
        pool += c.investment_pool || 0;
      }
      return { con, pool, gdp: s.world.gdp };
    }).filter(Boolean);
    if (!per.length) continue;
    const con = mean(per.map(p => p.con)), pool = mean(per.map(p => p.pool)), gdp = mean(per.map(p => p.gdp));
    say(`| ${a} | ${d} | ${n0(con)} | ${gdp ? (con / (gdp / 52) * 100).toFixed(2) + '%' : '—'} | ${n0(pool)} | ${con ? (pool / con).toFixed(1) + ' wk' : '—'} |`);
  }
}
say('');

// ------------------------------------------------------------------ 9. does a tech edge pay
say('## 9. Does a technological edge pay?  `[saves]`');
say('');
say('The mod\'s first goal, as a slope: regress ln(GDP per capita) on technologies held, across every');
say('country with at least 1 M people, at 1935. A steeper slope means the same number of extra');
say('technologies is worth more — which is exactly what "a tech lead should matter" asks for.');
say('');
say('⚠ This is a correlation across countries in one world, not a causal estimate: a rich country');
say('researches faster, so the slope runs both ways. It is comparable BETWEEN ARMS, which is the only');
say('use made of it here.');
say('');
say('| arm | n countries | slope (ln GDP/head per tech) | R² | techs: leader / median | GDP/head: leader ÷ median |');
say('|---|---|---|---|---|---|');
for (const a of arms) {
  const rows = [];
  let leadT = NaN, medT = NaN, ratio = NaN;
  for (const r of byArm(a)) {
    const s = nearestSave(r, '1935.1.1'); if (!s) continue;
    const pts = [];
    for (const c of Object.values(s.countries)) {
      const pop = Object.values(c.professions).reduce((x, y) => x + y, 0);
      if (!(pop >= 1e6) || !(c.gdp > 0) || !c.technologies) continue;
      pts.push({ x: c.technologies, y: Math.log(c.gdp / pop), gdp: c.gdp, pop });
    }
    if (pts.length < 5) continue;
    const mx = mean(pts.map(p => p.x)), my = mean(pts.map(p => p.y));
    const sxy = pts.reduce((s2, p) => s2 + (p.x - mx) * (p.y - my), 0);
    const sxx = pts.reduce((s2, p) => s2 + (p.x - mx) ** 2, 0);
    const syy = pts.reduce((s2, p) => s2 + (p.y - my) ** 2, 0);
    const b = sxy / sxx;
    rows.push({ n: pts.length, b, r2: (sxy * sxy) / (sxx * syy) });
    const byGdp = pts.slice().sort((p, q) => q.gdp - p.gdp);
    const perHead = pts.map(p => p.gdp / p.pop).sort((p, q) => p - q);
    leadT = byGdp[0].x; medT = pts.map(p => p.x).sort((p, q) => p - q)[pts.length >> 1];
    ratio = (byGdp[0].gdp / byGdp[0].pop) / perHead[perHead.length >> 1];
  }
  if (!rows.length) { say(`| ${a} | — | — | — | — | — |`); continue; }
  say(`| ${a} | ${n0(mean(rows.map(x => x.n)))} | ${mean(rows.map(x => x.b)).toFixed(4)} | ${n2(mean(rows.map(x => x.r2)))} | ${n0(leadT)} / ${n0(medT)} | ${n2(ratio)}× |`);
}
say('');

say('### Wars and peace  `[logs]`');
say('');
say('| arm | war starts (mean/run) | peaces | capitulations | diplomatic plays |');
say('|---|---|---|---|---|');
for (const a of arms) {
  const c = k => n2(mean(byArm(a).map(r => r.events.filter(e => e.kind === k).length)));
  say(`| ${a} | ${c('WARSTART')} | ${c('PEACE')} | ${c('CAPIT')} | ${c('DIPPLAY')} |`);
}
say('');

const text = L.join('\n') + '\n';
if (OUT) { writeFileSync(OUT, text); console.error(`wrote ${OUT} (${(text.length / 1024).toFixed(0)} KB)`); }
else process.stdout.write(text);
