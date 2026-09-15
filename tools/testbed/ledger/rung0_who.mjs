// Who adds rung-0 buildings 1900 -> 1935 on a run: per country, the change in rung-0 building COUNT and LEVELS, beside whether the
// country holds any e2/e3 building at 1935 (a proxy for holding the frontier technology). Args: <runDir> <cfg>
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const [runDir, cfgPath] = process.argv.slice(2);
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const era = {}; for (const ind of cfg.industries) { if (ind.disabled) continue; for (const t of ind.tiers) era[t.key] = t.era; }
const dir = runDir + '/save_summaries';
const load = y => { const f = readdirSync(dir).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).map(x => { const o = JSON.parse(gunzipSync(readFileSync(dir + '/' + x)).toString()); return { d: o.provenance.date, o }; }).filter(o => o.d.startsWith(y + '.')).sort((a, b) => a.d.localeCompare(b.d))[0]; return f.o; };
const a = load(1900), b = load(1935);
const stat = (c) => { let n = 0, lv = 0, hi = 0; for (const [k, x] of Object.entries(c.buildings || {})) { if (era[k] === 0) { n += x.n; lv += x.levels; } if (era[k] >= 2) hi += x.levels; } return { n, lv, hi }; };
const rows = [];
for (const [tag, c] of Object.entries(b.countries)) { const s1 = a.countries[tag] ? stat(a.countries[tag]) : { n: 0, lv: 0, hi: 0 }; const s2 = stat(c); rows.push({ tag, dn: s2.n - s1.n, dlv: s2.lv - s1.lv, hi: s2.hi, n2: s2.n }); }
rows.sort((x, y) => y.dn - x.dn);
const withHi = rows.filter(r => r.hi > 0), noHi = rows.filter(r => r.hi === 0);
const sum = (rs, k) => rs.reduce((s, r) => s + r[k], 0);
console.log(`rung-0 buildings added 1900->1935: ${sum(rows, 'dn')} (levels ${sum(rows, 'dlv')}) — by countries holding e2/e3 buildings: ${sum(withHi, 'dn')} buildings / ${sum(withHi, 'dlv')} levels (${withHi.length} countries); by countries with NO e2/e3 building: ${sum(noHi, 'dn')} / ${sum(noHi, 'dlv')} (${noHi.length} countries)`);
console.log('top adders: ' + rows.slice(0, 12).map(r => `${r.tag} +${r.dn}b/+${r.dlv}L${r.hi ? '' : ' (no frontier)'}`).join(', '));
const SHORT = ['GBR', 'USA', 'FRA', 'GER', 'PRU', 'RUS', 'AUS', 'JAP', 'NET', 'BEL'];
console.log('majors: ' + rows.filter(r => SHORT.includes(r.tag)).map(r => `${r.tag} ${r.dn >= 0 ? '+' : ''}${r.dn}b/${r.dlv >= 0 ? '+' : ''}${r.dlv}L (e2+ levels ${r.hi})`).join(', '));
