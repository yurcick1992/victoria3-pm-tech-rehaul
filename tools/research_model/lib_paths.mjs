// A RUN'S RESEARCH INPUTS, YEAR BY YEAR (BALANCE_FRAMEWORK §10.96): per country, from the FIRST save summary of each year — literacy,
// innovation (the v18 snapshot where the summary carries one, else 50 + 1.14 × the universities' nominal output: innovation_fit.mjs), the
// country type (the spread rank malus), its laws (v11+), and the technologies held (the observed stock the simulation is scored against, and
// the starting holdings of a country when it first appears).
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { uniInnovation } from './innovation_fit.mjs';
const toDay = d => { const [y, m, dd] = d.split('.').map(Number); return y * 365 + (m - 1) * 30.4 + dd; };
const headDate = f => { const fd = fs.openSync(f, 'r'); const buf = Buffer.alloc(4096); const n = fs.readSync(fd, buf, 0, 4096, 0); fs.closeSync(fd);
  try { const t = zlib.gunzipSync(buf.subarray(0, n), { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString('utf8'); return /"date":"([0-9.]+)"/.exec(t)?.[1]; } catch { return null; } };
export const UNI_K = 1.14;
// dir: a folder of summaries (a run's save_summaries, or saves_debut/summaries_v18)
export function loadPaths(dir, { from = 1836, to = 1936 } = {}) {
  const byYear = {};
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.'))) {
    const d = headDate(path.join(dir, f)); if (!d) continue; const y = +d.split('.')[0]; if (y < from || y > to) continue;
    if (!byYear[y] || toDay(d) < toDay(byYear[y].d)) byYear[y] = { d, f };
  }
  const years = Object.keys(byYear).map(Number).sort((a, b) => a - b); const at = {};
  for (const y of years) {
    const s = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, byYear[y].f)))); at[y] = {};
    for (const [k, c] of Object.entries(s.countries)) {
      const lit = c.literacy ?? 0; const cap = c.max_innovation ?? 50 + 150 * lit;
      const innov = c.innovation ?? uniInnovation(c, UNI_K);
      at[y][k] = { tag: c.tag ?? k.split('@')[0], lit, innov, cap, capped: innov >= 0.95 * cap, ctype: c.country_type, laws: c.laws || [],
        held: c.technologies_held || [], gdp: c.gdp, overlord: c.overlord ?? null, measured: c.innovation != null };
    }
  }
  return { years, at, dates: Object.fromEntries(years.map(y => [y, byYear[y].d])) };
}
