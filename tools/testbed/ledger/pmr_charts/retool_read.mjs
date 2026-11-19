// How much construction goes into PMR's retool sites, by decade, over the PMR arm's runs.
// usage: node retool_read.mjs <session dir>
// Trap: a year's summary is taken by file position, so a run that resumed after a crash reads one year early from the crash on
// (the last line printed lists the dates read).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const session = process.argv[2];
const runs = fs.readdirSync(session).filter(d => /^run\d+_pmr$/.test(d)).sort();
const YEARS = [1846, 1856, 1866, 1876, 1886, 1896, 1906, 1916, 1926, 1935];
const kindOf = t => /retool_gova_/.test(t) ? 'gov abroad' : /retool_gov_/.test(t) ? 'gov home' : /_2$/.test(t) ? 'private abroad' : 'private home';
const med = a => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };

const rows = {}; // year -> array of per-run records
for (const run of runs) {
  const dir = path.join(session, run, 'save_summaries');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort();
  // yearly autosaves: file k is the save of year 1836 + k (0001 = 1837.1.1)
  for (const y of YEARS) {
    const f = files[y - 1837];
    if (!f) continue;
    const s = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString('utf8'));
    const r = { govLeft: 0, govRetool: 0, privLeft: 0, privRetool: 0, govN: 0, govRetoolN: 0, privN: 0, privRetoolN: 0, standing: {}, countriesGov: 0, countriesPriv: 0, date: s.provenance?.date ?? s.provenance?.game_date };
    for (const c of Object.values(s.countries)) {
      const q = c.queues || {};
      let g = 0, p = 0;
      for (const [t, v] of Object.entries(q.government?.by_type || {})) { r.govLeft += v.left; r.govN += v.n; if (/pmr_retool/.test(t)) { r.govRetool += v.left; r.govRetoolN += v.n; g = 1; } }
      for (const [t, v] of Object.entries(q.private?.by_type || {})) { r.privLeft += v.left; r.privN += v.n; if (/pmr_retool/.test(t)) { r.privRetool += v.left; r.privRetoolN += v.n; p = 1; } }
      r.countriesGov += g; r.countriesPriv += p;
      for (const [t, b] of Object.entries(c.buildings || {})) if (/pmr_retool/.test(t)) { const k = kindOf(t); r.standing[k] = (r.standing[k] || 0) + (b.levels || 0); }
    }
    (rows[y] ||= []).push(r);
  }
}
const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '-';
console.log(`PMR arm, ${runs.length} runs. Construction queues at 1 January of each year, the world summed; medians over runs.`);
console.log('year  n  | government queue: points left, of which retool sites (share) [items] | private queue: points left, of which retool sites (share) [items] | countries with a retool item gov / private | standing retool-site levels by kind');
for (const y of YEARS) {
  const a = rows[y] || [];
  const m = k => med(a.map(r => r[k]));
  const share = (num, den) => med(a.map(r => r[den] ? 100 * r[num] / r[den] : 0)).toFixed(1) + '%';
  const kinds = ['private home', 'private abroad', 'gov home', 'gov abroad'].map(k => `${k} ${med(a.map(r => r.standing[k] || 0)).toFixed(0)}`).join(', ');
  console.log(`${y}  ${a.length} | ${m('govLeft').toFixed(0)} / ${m('govRetool').toFixed(0)} (${share('govRetool', 'govLeft')}) [${m('govN')} / ${m('govRetoolN')}] | ${m('privLeft').toFixed(0)} / ${m('privRetool').toFixed(0)} (${share('privRetool', 'privLeft')}) [${m('privN')} / ${m('privRetoolN')}] | ${m('countriesGov')} / ${m('countriesPriv')} | ${kinds}`);
}
console.log('dates read:', [...new Set(Object.values(rows).flat().map(r => r.date))].slice(0, 12).join(' '));
