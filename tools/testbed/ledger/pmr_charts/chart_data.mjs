// chart_data.mjs <repo root> <out.json>
// Per-run yearly series of every metric arm_compare.mjs tracks, for the three-arm chart page.
// Definitions are arm_compare's (criteria.mjs addC / fin): U* = (unemployed + peasants) / workforce,
// W = (salaried - government - military) / population, pool / GDP, GDP per productive worker.
// ECONOMY: this batch glued to the 10 + 10 batch of 12-14 November. PLAY TIME: this batch only.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.argv[2], OUT = process.argv[3];
const L = p => import(pathToFileURL(join(ROOT, 'tools', 'testbed', p)).href);
const { usableRuns } = await L('ledger/lib_runs.mjs');
const { POOL } = await L('ledger/lib_markets.mjs');
const { yearTimes } = await L('slow_quarantine.mjs');
const { wallFromTicks } = await L('ledger/lib_wall.mjs');
const SES = join(ROOT, 'tools', 'testbed', 'sessions');

const NEW = '20261116_005659_g1151-alt-pmr15-vanilla5-canon5', OLD = '20261112_113429_g1151-alt-vanilla10-canon10';
const ARMS = [
  { key: 'vanilla', name: 'Vanilla 1.15.1', short: 'Vanilla', groups: [[OLD, 'vanilla'], [NEW, 'vanilla']], planned: 5 },
  { key: 'pmr', name: 'Production Method Rework 0.4.0', short: 'PMR', groups: [[NEW, 'pmr']], planned: 15 },
  { key: 'nfu', name: 'No Free Upgrades 1.1.1', short: 'NFU', groups: [[OLD, 'canon'], [NEW, 'canon']], planned: 5 },
];
const MAJORS = [
  { label: 'GBR', name: 'Great Britain', tags: ['GBR'], mode: 'first' },
  { label: 'USA', name: 'United States', tags: ['USA'], mode: 'first' },
  { label: 'FRA', name: 'France', tags: ['FRA'], mode: 'first' },
  { label: 'GER', name: 'Germany (or North Germany, or Prussia)', tags: ['GER', 'NGF', 'PRU'], mode: 'first' },
  { label: 'RUS', name: 'Russia', tags: ['RUS'], mode: 'first' },
  { label: 'AUS', name: 'Austria', tags: ['AUS'], mode: 'first' },
  { label: 'JAP', name: 'Japan', tags: ['JAP'], mode: 'first' },
  { label: 'LOW', name: 'Low Countries (Netherlands + Belgium)', tags: ['UNL', 'NET', 'BEL'], mode: 'sum' },
];
const Y0 = 1837, Y1 = 1936, YEARS = []; for (let y = Y0; y <= Y1; y++) YEARS.push(y);
const HMIN = 5e6;

const agg = () => ({ gdp: 0, pop: 0, prod: 0, sal: 0, un: 0, pe: 0, pool: 0, n: 0 });
const addC = (a, c) => {
  const p = c.pop_statistics || {};
  const sal = +p.population_salaried_workforce || 0, un = +p.population_unemployed_workforce || 0, pe = (+p.population_subsisting_workforce || 0) * 1e5;
  a.gdp += +c.gdp || 0; a.pop += Object.values(c.strata || {}).reduce((x, y) => x + y, 0);
  a.prod += sal - (+p.population_government_workforce || 0) - (+p.population_military_workforce || 0);
  a.sal += sal; a.un += un; a.pe += pe; a.pool += +c.investment_pool || 0; a.n++;
};
const fin = a => { const wf = a.sal + a.un + a.pe; return { ...a,
  W: a.pop > 0 ? a.prod / a.pop : NaN, U: wf > 0 ? (a.un + a.pe) / wf : NaN, P: wf > 0 ? a.pe / wf : NaN,
  H: a.gdp > 0 ? a.pool / a.gdp : NaN, Y: a.prod > 0 ? a.gdp / a.prod : NaN }; };
function readRun(rel) {
  const dir = join(SES, rel, 'save_summaries'), years = new Map();
  for (const fn of readdirSync(dir).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, fn))).toString('utf8')); } catch { continue; }
    const y = +String(j.provenance?.date || '').split('.')[0]; if (!y || years.has(y)) continue;
    const C = j.countries || {}, world = agg(), pool = agg(), M = {};
    for (const [tag, c] of Object.entries(C)) { addC(world, c); if (POOL.includes(tag)) addC(pool, c); }
    world.gdp = +j.world?.gdp || world.gdp;
    for (const m of MAJORS) {
      const a = agg();
      if (m.mode === 'sum') { for (const t of m.tags) if (C[t]) addC(a, C[t]); }
      else { const t = m.tags.find(x => C[x]); if (t) addC(a, C[t]); }
      M[m.label] = a.n ? fin(a) : null;
    }
    years.set(y, { world: fin(world), pool: fin(pool), majors: M });
  }
  return years;
}

// ---- the charts
const CH = [];
const chart = (id, group, title, unit, fmt, pick, get, note = '') => CH.push({ id, group, title, unit, fmt, pick, get, note, series: {} });
const w = o => o.world, s = o => o.pool, mj = l => o => o.majors[l];
chart('w_gdp', 'World', 'World GDP', '£M a year, as the game displays it', 'int', w, x => x.gdp / 1e6);
chart('w_u', 'World', 'World unemployment including peasants (U*)', '% of the workforce unemployed or subsisting', 'pct', w, x => x.U * 100);
chart('w_p', 'World', 'World peasants', '% of the workforce subsisting', 'pct', w, x => x.P * 100);
chart('w_w', 'World', 'World productive workers per capita (W)', 'salaried workers outside government and the military, per head', 'w', w, x => x.W);
chart('w_y', 'World', 'World GDP per productive worker', '£ a year', 'f1', w, x => x.Y);
chart('w_h', 'World', 'World investment pool', 'every country’s pool, in years of world GDP', 'f2', w, x => x.H);
chart('s_gdp', 'Shortlist', 'Shortlist GDP', '£M a year', 'int', s, x => x.gdp / 1e6);
chart('s_u', 'Shortlist', 'Shortlist unemployment including peasants (U*)', '% of the workforce unemployed or subsisting', 'pct', s, x => x.U * 100);
chart('s_w', 'Shortlist', 'Shortlist productive workers per capita (W)', 'salaried workers outside government and the military, per head', 'w', s, x => x.W);
chart('s_h', 'Shortlist', 'Shortlist investment pool', 'in years of the shortlist’s GDP', 'f2', s, x => x.H);
for (const m of MAJORS) chart('m_gdp_' + m.label, 'Majors: GDP', m.name, '£M a year', 'int', mj(m.label), x => x.gdp / 1e6);
for (const m of MAJORS) chart('m_u_' + m.label, 'Majors: unemployment including peasants (U*)', m.name, '% of the workforce', 'pct', mj(m.label), x => x.U * 100);
for (const m of MAJORS) chart('m_h_' + m.label, 'Majors: investment pool', m.name, 'years of the country’s GDP', 'f2', mj(m.label), x => x.pop >= HMIN ? x.H : NaN);
const WALL = { id: 'wall', group: 'Play time', title: 'Play speed', unit: 'in-game years played per minute of real time (higher is faster); this batch’s games only', fmt: 'f2', note: '', series: {} };
const WALLRUNS = {};   // per arm, this batch's games: the century in minutes (lib_wall's wall_play: load + play, crash replays taken out)

const r4 = v => Number.isFinite(v) ? +v.toPrecision(4) : null;
const arms = [];
for (const A of ARMS) {
  const runs = [];
  for (const [ses, setup] of A.groups) for (const rel of usableRuns(SES, ses, setup).runs) runs.push({ rel, here: ses === NEW });
  const meta = { key: A.key, name: A.name, short: A.short, planned: A.planned, n: runs.length, nHere: runs.filter(r => r.here).length,
    runs: runs.map(r => ({ id: r.rel.split('/')[1].replace(/_.*/, '').replace('run', 'run '), here: r.here })) };
  for (const c of CH) c.series[A.key] = [];
  WALL.series[A.key] = []; WALLRUNS[A.key] = [];
  for (const r of runs) {
    const years = readRun(r.rel);
    for (const c of CH) c.series[A.key].push(YEARS.map(y => { const o = years.get(y); const sc = o && c.pick(o); return sc ? r4(c.get(sc)) : null; }));
    if (r.here) {
      const dir = join(SES, r.rel), ty = yearTimes(dir).ty;
      WALL.series[A.key].push(YEARS.map(y => y === Y1 ? null : r4(60 / +ty[y])));
      let meta = null; try { meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')); } catch {}
      WALLRUNS[A.key].push({ id: r.rel.split('/')[1].replace(/_.*/, '').replace('run', 'run '), min: r4(wallFromTicks(dir, meta)?.wall_play / 60), resumes: +meta?.resumes || 0 });
    }
    process.stderr.write(`${A.key} ${r.rel} years ${years.size}\n`);
  }
  arms.push(meta);
}
const now = new Date(), p2 = n => String(n).padStart(2, '0');
const out = {
  stamp: `${now.getUTCFullYear()}-${p2(now.getUTCMonth() + 1)}-${p2(now.getUTCDate())}, ${p2(now.getUTCHours())}:${p2(now.getUTCMinutes())} UTC`,
  years: YEARS, arms, wall: WALLRUNS,
  charts: [...CH, WALL].map(({ id, group, title, unit, fmt, note, series }) => ({ id, group, title, unit, fmt, note, series })),
};
writeFileSync(OUT, JSON.stringify(out));
process.stderr.write(`wrote ${OUT}: ${(JSON.stringify(out).length / 1e6).toFixed(2)} MB, arms ${arms.map(a => a.key + ' n=' + a.n + ' (here ' + a.nHere + ')').join(', ')}\n`);
