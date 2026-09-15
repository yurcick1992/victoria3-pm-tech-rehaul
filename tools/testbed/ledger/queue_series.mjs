// private / government queue backlog per year for a run (save_summaries `queues`: {n,left,speed,by_type}); world + named tags
import { readFileSync, readdirSync } from 'node:fs'; import { gunzipSync } from 'node:zlib'; import { join } from 'node:path';
const run = process.argv[2]; const years = (process.argv[3] || '1900,1920,1935').split(','); const tags = (process.argv[4] || 'GBR,USA,FRA').split(',');
const dir = join(run, 'save_summaries'); const files = readdirSync(dir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort();
const seen = new Set();
for (const f of files) { let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, f)))); } catch { continue; }
  const y = ((j.provenance && j.provenance.date) || '').split('.')[0]; if (!years.includes(y) || seen.has(y)) continue; seen.add(y);
  const W = { pn: 0, pl: 0, ps: 0, gn: 0, gl: 0, gs: 0, pool: 0, gdp: 0, cs: 0 }; const per = [];
  for (const [tag, c] of Object.entries(j.countries || {})) { const q = c.queues || {}; const p = q.private || {}, g = q.government || {};
    W.pn += p.n || 0; W.pl += p.left || 0; W.ps += p.speed || 0; W.gn += g.n || 0; W.gl += g.left || 0; W.gs += g.speed || 0;
    W.pool += +c.investment_pool || 0; W.gdp += +c.gdp || 0; W.cs += +((c.buildings || {}).building_construction_sector?.levels || 0);
    if (tags.includes(tag)) per.push(`${tag}: priv n ${p.n || 0} left ${Math.round(p.left || 0)} spd ${Math.round(p.speed || 0)}/wk → ${p.speed ? Math.round((p.left || 0) / p.speed / 52 * 10) / 10 : '∞'} y backlog · gov n ${g.n || 0} left ${Math.round(g.left || 0)} spd ${Math.round(g.speed || 0)} → ${g.speed ? Math.round((g.left || 0) / g.speed / 52 * 10) / 10 : '∞'} y · pool £${Math.round((+c.investment_pool || 0) / 1e6)}M = ${(((+c.investment_pool || 0) / (+c.gdp || 1))).toFixed(2)} GDP · constr lvls ${(c.buildings || {}).building_construction_sector?.levels || 0}`); }
  console.log(`${y} WORLD private: n ${W.pn} left ${Math.round(W.pl)} pts, speed ${Math.round(W.ps)} pts/wk → ${(W.pl / W.ps / 52).toFixed(1)} y backlog | government: n ${W.gn} left ${Math.round(W.gl)}, speed ${Math.round(W.gs)} → ${(W.gl / W.gs / 52).toFixed(1)} y | private share of speed ${(W.ps / (W.ps + W.gs) * 100).toFixed(0)}% | pool £${Math.round(W.pool / 1e6)}M = ${(W.pool / W.gdp).toFixed(2)} GDP | constr lvls ${W.cs}`);
  for (const l of per) console.log('   ' + l);
}
