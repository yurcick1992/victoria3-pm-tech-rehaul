// THE RESEARCH MODEL (BALANCE_FRAMEWORK §10.96) — a weekly simulation of every country's research over the real technology tree, driven by
// each country's MEASURED literacy and innovation paths (from the yearly save summaries), with the rules measured on vanilla's own saves:
//   · directed research: min(innovation, cap) a week on the chosen technology — cap = capBase + capLit × literacy (flow_check: obs ÷ formula
//     median 1.000 over 20k intervals);
//   · the AI's choice: P ∝ score^aiK among researchable technologies, score = ai_weight ÷ (1 + 5 × penalty ÷ era cost) (research_pick: the
//     soft-max family fits best at k ≈ 3; the documented TECH_COST_PENALTY_FACTOR is 5);
//   · spread, per tree: (spreadBase + spreadLit × literacy + excess × unspent innovation) × (1 + law and rank multipliers) × U(0.5, 1.5), on ONE
//     technology per tree picked UNIFORMLY among the eligible technologies of the OLDEST era the country is missing (eligible = researchable and
//     held by another country) — spread_pick: 100% of 6,908 picks in the oldest era, uniform inside it (holders^γ best at γ 0);
//   · cost: era cost × costMult × (1 + penalty × Σ unheld earlier-era techs of the same tree × era gap); progress beyond the cost is lost;
//   · grants: journal-entry stages from a measured list, applied while the technology is researchable (the emitted entries' rule).
// Not modelled: events' progress grants, research-speed modifiers (IG traits, companies), the AI's strategy-dependent ai_weight terms, and any
// feedback from technology to literacy, universities or GDP (inputs are fixed paths; that is the model's stated limit).
import { canResearch } from './lib_tree.mjs';

export const DEFAULT_LEVERS = {
  innovBase: 50, capBase: 50, capLit: 150, uniMult: 1, uniResponse: 'same-levels',   // or 'to-cap': the AI rebuilds to buildToCap × its new cap
  buildToCap: 1.1, spreadBase: 25, spreadLit: 75, excess: 0.2, costMult: 1, penalty: 0.25, aiRule: 'tree-lowest', aiK: 4, jeMult: 1,
  rankMult: { recognized: 0, colonial: 0, unrecognized: -0.234, decentralized: -0.234, company: 0 },   // measured: 0.985 / 0.976 / 0.766
};
const LAW_SPREAD = { law_outlawed_dissent: -0.15, law_censorship: -0.10, law_protected_speech: 0.25, law_isolationism: -0.15, law_canton_system: -0.10, law_sakoku: -0.20 };

// a tiny seeded RNG (mulberry32) so a run is reproducible
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// paths: { years: [y…], at: { y: { key: { tag, lit, innov, ctype, laws, held: [...] } } } }; grants: { key: [{ y (fractional year), tech, pts }] }
export function simulate(tree, paths, L0 = {}, { seed = 1, grants = null, from = null, to = null, record = null } = {}) {
  const L = { ...DEFAULT_LEVERS, ...L0, rankMult: { ...DEFAULT_LEVERS.rankMult, ...(L0.rankMult || {}) }, eraMult: { ...(L0.eraMult || {}) } };
  for (const e of [1, 2, 3, 4, 5]) if (L0['era' + e] != null) L.eraMult[e] = L0['era' + e];   // era4=1.2 on the command line
  const R = rng(seed); const T = tree.techs; const ids = Object.keys(T);
  const byCat = {}; for (const c of tree.cats) byCat[c] = ids.filter(i => T[i].category === c);
  const years = paths.years.filter(y => (from == null || y >= from) && (to == null || y <= to));
  const holders = {}; for (const i of ids) holders[i] = 0;
  const C = new Map();   // key -> state
  const costOf = (s, id) => {
    const t = T[id]; let gap = 0;
    for (const u of byCat[t.category]) if (T[u].researchable && T[u].era < t.era && !s.held.has(u)) gap += t.era - T[u].era;   // F160: sericulture skipped
    return tree.eraCost[t.era] * L.costMult * (L.eraMult[t.era] ?? 1) * (1 + L.penalty * gap);
  };
  const add = (s, id) => { if (s.held.has(id)) return; s.held.add(id); holders[id]++; delete s.prog[id]; s.cost = {};
    if (s.research === id) s.research = null; for (const c of tree.cats) if (s.spread[c] === id) s.spread[c] = null; };
  const cost = (s, id) => s.cost[id] ?? (s.cost[id] = costOf(s, id));
  // the AI's research choice, as MEASURED on vanilla (research_pick.mjs over 5,884 picks, 1836–1921): 97% of picks sit in their own tree's
  // LOWEST researchable era, and inside that set P ∝ ai_weight^4 fits best with no further penalty term (it reproduces the tree mix:
  // society 2,651 / military 1,787 / production 1,281 predicted against 2,656 / 1,692 / 1,371 observed). aiRule 'score' is the documented
  // formula over every researchable tech (kept for comparison; it sends the AI into later eras far too early).
  const pickResearch = s => {
    const E = []; let tot = 0;
    if (L.aiRule === 'score') {
      for (const id of ids) if (canResearch(tree, id, s.held)) { const c = cost(s, id), base = tree.eraCost[T[id].era] * L.costMult;
        const w = (T[id].ai / (1 + 5 * (c - base * (L.eraMult[T[id].era] ?? 1)) / base)) ** L.aiK; E.push([id, w]); tot += w; }
    } else {
      const low = {}; const cand = ids.filter(id => canResearch(tree, id, s.held));
      for (const id of cand) low[T[id].category] = Math.min(low[T[id].category] ?? 9, T[id].era);
      for (const id of cand) if (T[id].era === low[T[id].category]) { const w = T[id].ai ** L.aiK; E.push([id, w]); tot += w; }
    }
    if (!E.length) return null; let r = R() * tot; for (const [id, w] of E) { r -= w; if (r <= 0) return id; } return E.at(-1)[0];
  };
  const pickSpread = (s, cat) => {
    let minE = 9, E = [];
    for (const id of byCat[cat]) { if (!canResearch(tree, id, s.held) || holders[id] - 0 < 1) continue; const e = T[id].era;
      if (e < minE) { minE = e; E = [id]; } else if (e === minE) E.push(id); }
    return E.length ? E[Math.floor(R() * E.length)] : null;
  };
  const out = {};   // y -> key -> held count etc
  const gq = new Map(); if (grants) for (const [k, list] of Object.entries(grants)) gq.set(k, [...list].sort((a, b) => a.y - b.y));
  for (let yi = 0; yi < years.length; yi++) {
    const y = years[yi], P = paths.at[y];
    // countries present this year: new ones take their observed holdings; gone ones leave
    for (const [k, s] of C) if (!P[k]) { for (const id of s.held) holders[id]--; C.delete(k); }
    for (const [k, p] of Object.entries(P)) if (!C.has(k)) {
      const s = { key: k, held: new Set(), prog: {}, cost: {}, research: null, spread: {}, p };
      for (const id of p.held) if (T[id]) { s.held.add(id); holders[id]++; }
      C.set(k, s);
    }
    for (const [k, s] of C) s.p = P[k];
    if (record) record(y, C, holders);
    out[y] = {}; for (const [k, s] of C) out[y][k] = [...s.held];
    if (yi === years.length - 1) break;
    const weeks = Math.round((years[yi + 1] - y) * 52);
    for (let w = 0; w < weeks; w++) {
      const yf = y + w / 52;
      for (const [k, s] of C) {
        const p = s.p, lit = p.lit ?? 0;
        const cap = L.capBase + L.capLit * lit;
        let uni = Math.max(0, (p.innov ?? 50) - 50) * L.uniMult;
        if (L.uniResponse === 'to-cap' && p.capped) uni = Math.max(0, L.buildToCap * cap - L.innovBase);
        else if (p.capped) uni = Math.min(uni, Math.max(0, L.buildToCap * cap - L.innovBase));   // the AI does not overbuild a lowered cap
        const innov = L.innovBase + uni;
        const R_ = Math.min(innov, cap) * (L.resEff ?? 1), excess = Math.max(0, innov - cap);
        if (!s.research || s.held.has(s.research)) s.research = pickResearch(s);
        if (s.research) { s.prog[s.research] = (s.prog[s.research] || 0) + R_ * (1 + (L['res_' + T[s.research].category] ?? 0));   // res_military=-0.3: the game's country_<tree>_tech_research_speed_mult
          if (s.prog[s.research] >= cost(s, s.research)) add(s, s.research); }
        const mult = 1 + (L.rankMult[p.ctype] ?? 0) + (p.laws || []).reduce((a, l) => a + (LAW_SPREAD[l] || 0), 0);
        const sp = (L.spreadBase + L.spreadLit * lit + L.excess * excess) * Math.max(0, mult);
        for (const c of tree.cats) {
          if (!s.spread[c] || s.held.has(s.spread[c])) s.spread[c] = pickSpread(s, c);
          const id = s.spread[c]; if (!id) continue;
          s.prog[id] = (s.prog[id] || 0) + sp * Math.max(0, 1 + (L['spr_' + c] ?? 0)) * (0.5 + R());   // spr_production=0.2: country_<tree>_tech_spread_mult
          if (s.prog[id] >= cost(s, id)) add(s, id);
        }
        const q = gq.get(k);
        if (q && q.length && q[0].y <= yf) {   // a due grant waits while its tech is not researchable
          let shifted = false;
          for (let i = 0; i < q.length && q[i].y <= yf; ) {
            const g = q[i];
            if (s.held.has(g.tech)) { q.splice(i, 1); continue; }
            if (!canResearch(tree, g.tech, s.held)) { i++; continue; }
            // a stage that comes due late (its tech not yet researchable here) delays the tech's LATER stages by as much: in game the entry
            // only starts when the tech becomes researchable, and each stage takes its full bar after the previous one
            const late = yf - g.y; if (late > 1 / 52) for (const h of q) if (h !== g && h.tech === g.tech) { h.y += late; shifted = true; }
            q.splice(i, 1); s.prog[g.tech] = (s.prog[g.tech] || 0) + g.pts * L.jeMult * (L.grantsFollowCost === false ? 1 : L.costMult * (L.eraMult[T[g.tech].era] ?? 1));
            if (s.prog[g.tech] >= cost(s, g.tech)) add(s, g.tech);   // a stage grants grant_fraction × the era cost the BUILD reads, so it follows a cost lever
          }
          if (shifted) q.sort((a, b) => a.y - b.y);
        }
      }
    }
  }
  return out;
}
