// THE EMPLOYMENT-BY-ERA COLUMNS OF A BOOK — one implementation for every reader of the ledger that splits tier employment by era
// (fill_emp.mjs for the world, report_data2.mjs for the watchlist), so the two pages can never disagree.
//
//   ⭐ e0 IS SPLIT INTO ARTISANS AND OTHER where the book has craft rungs (`craft: true`, BALANCE_FRAMEWORK §10.91.1) — user-ruled
//      2026-10-02: "for the art- family, split report into e0-artisans and e0-other, where appropriate". A craft is a 500-worker rung
//      meant to fade on its own economics; an e0 FACTORY that survives is the ladder failing. Lumping them hid which was which.
//   ⭐ A MERGE HOST's staffing is shared out over its MAIN METHODS by the levels running each (the summary's `pms`), each share at
//      its own method's era and per-level staffing — criteria.mjs's rule (§10.91.2). Without it every merged rung's workers sat at
//      the host's era: textile's electric-sewing e3 counted as e2, food's baking-powder e2 as e1.
//   ⚠ A summary without `pms` falls back to the host's own era (pre-v8 summaries; no merge book is that old).
//
//   import { eraCols } from './lib_era_cols.mjs';
//   const E = eraCols(cfg);  E.labels → ['e0 artisans','e0 other','e1','e2','e3'] (crafts) or ['e0','e1','e2','e3'];
//   E.parts(key, buildingRecord) → [[column, workers], …] ([] when the key is not a tier building);  E.e0 → the e0 column indices;
//   E.countrySplit(country.buildings) → { all, b1, b2 } per column: every tier worker, and those one / two-or-more eras behind the
//   best rung the SAME country staffs in the SAME industry (b2 = the old rung surviving beside its replacement).
export function eraCols(cfg) {
  const tier = {};
  let hasCraft = false, maxEra = 0;
  for (const I of cfg.industries || []) {
    if (I.disabled) continue;   // ⚠ a disabled industry's rung-0 KEY IS THE VANILLA BUILDING (landmine L27)
    for (const t of I.tiers || []) {
      if (!t.key) continue;
      const emp = Object.values(t.employment || {}).reduce((a, b) => a + (+b || 0), 0) * (+(t.workforce_mult ?? 1));
      tier[t.key] = { era: t.era ?? 0, emp, craft: !!t.craft, pm: t.pm_key };
      if (t.craft) hasCraft = true;
      if ((t.era ?? 0) > maxEra) maxEra = t.era ?? 0;
    }
  }
  for (const I of cfg.industries || []) {
    if (I.disabled) continue;
    for (const t of I.tiers || []) if (t.method_of && tier[t.method_of]) {
      const h = tier[t.method_of];
      (h.methods ||= [{ pm: h.pm, era: h.era, emp: h.emp, craft: h.craft }]).push({ pm: t.pm_key, era: t.era ?? 0, emp: tier[t.key].emp, craft: false });
    }
  }
  const labels = hasCraft
    ? ['e0 artisans', 'e0 other', ...Array.from({ length: maxEra }, (_, i) => 'e' + (i + 1))]
    : Array.from({ length: maxEra + 1 }, (_, i) => 'e' + i);
  const col = (era, craft) => hasCraft ? (era === 0 ? (craft ? 0 : 1) : era + 1) : era;
  const parts = (k, b) => {
    const t = tier[k]; if (!t) return [];
    const st = +b.staffing || 0;
    if (t.methods && b.pms) {
      const lv = t.methods.map(m => +b.pms[m.pm] || 0), tot = lv.reduce((x, y) => x + y, 0);
      if (tot > 0) return t.methods.map((m, i) => [col(m.era, m.craft), st * lv[i] / tot * m.emp]).filter(([, w]) => w > 0);
    }
    return [[col(t.era, t.craft), st * t.emp]];
  };
  const e0 = labels.map((l, i) => l.startsWith('e0') ? i : -1).filter(i => i >= 0);
  // ⭐ OLD RUNGS BESIDE THEIR REPLACEMENT (2026-10-02, for "how significant is the non-obsolescence problem"): one COUNTRY's tier
  //   workers per column, and the part of them on a rung TWO OR MORE eras behind the highest-era rung that same country STAFFS in the
  //   same industry (b2; exactly one behind = b1, normal succession). The by-era columns alone cannot separate the ladder failing to
  //   retire a rung (b2) from a backward country that runs nothing newer — which is most of the world's old-rung workforce.
  //   A merge host's workers are shared over its methods first (parts), so a merged method counts at its own era.
  const eraOfCol = labels.map(l => +l.replace(/^e(\d+).*$/, '$1'));
  const indOf = {};
  for (const I of cfg.industries || []) { if (I.disabled) continue; for (const t of I.tiers || []) if (t.key) indOf[t.key] = I.id; }
  const countrySplit = buildings => {
    const per = {};
    for (const [k, b] of Object.entries(buildings || {})) {
      const ind = indOf[k]; if (!ind) continue;
      for (const [ci, w] of parts(k, b)) {
        if (!(w > 0)) continue;
        const p = (per[ind] ||= { w: new Array(labels.length).fill(0), top: -1 });
        p.w[ci] += w; if (eraOfCol[ci] > p.top) p.top = eraOfCol[ci];
      }
    }
    const all = new Array(labels.length).fill(0), b1 = all.slice(), b2 = all.slice();
    for (const p of Object.values(per)) p.w.forEach((w, ci) => {
      all[ci] += w; const gap = p.top - eraOfCol[ci];
      if (gap >= 2) b2[ci] += w; else if (gap === 1) b1[ci] += w;
    });
    return { all, b1, b2 };
  };
  return { labels, parts, hasCraft, e0, tier, eraOfCol, countrySplit };
}
