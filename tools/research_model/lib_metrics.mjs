// THE TARGET METRICS OF §10.96, from a { year: { key: [held techs] } } map (observed or simulated):
//   · the leader (most technologies held) and the third: their share of game era N's technologies (tech_census D's definition);
//   · the all-country distribution of technologies held (median / p75 / p90 / max — F138's columns);
//   · the tech majors' counts (tech_census's list; a tag absent from the map is skipped).
export const MAJORS = ['GBR', 'USA', 'NET', 'BEL', 'FRA', 'PRU', 'SWE', 'UNL', 'NGF', 'GER'];
const q = (v, p) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
export const median = v => { const s = [...v].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };
export function metricsAt(tree, Y, onlyMain = true) {
  const rows = Object.entries(Y).filter(([k]) => !onlyMain || !k.includes('@')).map(([k, h]) => ({ k, h, n: h.length }));
  rows.sort((a, b) => b.n - a.n);
  const eraIds = e => Object.values(tree.techs).filter(t => t.era === e).map(t => t.id);
  const share = (r, e) => { if (!r) return NaN; const ids = new Set(eraIds(e)); return r.h.filter(t => ids.has(t)).length / ids.size; };
  const cnt = rows.map(r => r.n);
  return { leader: rows[0]?.k, leaderN: rows[0]?.n, eraShare: e => share(rows[0], e), eraShare3: e => share(rows[2], e),
    median: median(cnt), p75: q(cnt, .75), p90: q(cnt, .9), max: cnt[0], n: rows.length,
    majors: Object.fromEntries(MAJORS.filter(t => Y[t]).map(t => [t, Y[t].length])) };
}
