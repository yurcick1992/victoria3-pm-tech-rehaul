// VANILLA'S CONSTRUCTION DATA, read live from the game files. ONE implementation, because two tools
// need it and two copies would drift: `payback_census.mjs` anchors the infra cost book on vanilla's own
// `required_construction`, and `vanilla_payback_census.mjs` prices every vanilla building with it.
//
// Two things live here and they are different quantities:
//   requiredConstruction()  building key -> construction POINTS  (via common/script_values)
//   constructionMethods()   the construction sector's methods -> £ of goods per POINT
//
// ⭐⭐ £720 PER POINT IS ONE METHOD'S RATE, NOT A CONSTANT (FINDINGS F53). Both the goods bill and
// `country_construction_add` are `workforce_scaled`, so staffing cancels and the rate is a property of
// the METHOD alone: wooden 1000 · iron frame 720 · steel frame 540 · arc welded 527. The mod pins £720
// (the iron-frame rate) everywhere by ruling — see BALANCE_FRAMEWORK §10.57 for why, and for the size of
// the bias that accepts.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const GAME = process.env.VIC3_GAME
  || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';

const strip = s => s.replace(/^\uFEFF/, '');
const braces = t => (t.match(/\{/g) || []).length - (t.match(/\}/g) || []).length;

// construction_cost_* script values -> numbers.
export function constructionCostValues(game = GAME) {
  const out = {};
  for (const l of strip(readFileSync(join(game, 'common/script_values/building_values.txt'), 'utf8')).split('\n')) {
    const m = /^\s*(construction_cost_[a-z_]+)\s*=\s*([\d.]+)/.exec(l);
    if (m) out[m[1]] = +m[2];
  }
  if (!Object.keys(out).length) throw new Error('no construction_cost_* script values found — has building_values.txt moved?');
  return out;
}

// building key -> required_construction in POINTS. Depth-aware, so only a block's OWN top-level field
// counts: several buildings carry a second `required_construction` inside a conditional, and a
// line-oriented scan reads whichever came last.
export function requiredConstruction(game = GAME) {
  const SV = constructionCostValues(game), out = {};
  for (const f of readdirSync(join(game, 'common/buildings')).filter(x => x.endsWith('.txt'))) {
    let cur = null, depth = 0;
    for (const raw of strip(readFileSync(join(game, 'common/buildings', f), 'utf8')).split('\n')) {
      const t = raw.replace(/#.*$/, '');
      if (depth === 0) { const m = /^([a-z_0-9]+)\s*=\s*\{/.exec(t.trim()); if (m) cur = m[1]; }
      else if (cur && depth === 1) {
        const m = /^\s*required_construction\s*=\s*(\S+)/.exec(t);
        if (m && out[cur] == null) out[cur] = SV[m[1]] != null ? SV[m[1]] : +m[1];
      }
      depth += braces(t);
      if (depth <= 0) { depth = 0; cur = null; }
    }
  }
  if (!out.building_steel_mill) throw new Error('required_construction scan found no steel mill — the buildings files have moved.');
  return out;
}

// The construction sector's methods: [{ pm, pts, in:{good:qty} }]. £/point = Σ qty×price ÷ pts.
export function constructionMethods(game = GAME) {
  const out = [];
  let cur = null, depth = 0, inWS = false;
  for (const raw of strip(readFileSync(join(game, 'common/production_methods/13_construction.txt'), 'utf8')).split('\n')) {
    const t = raw.replace(/#.*$/, ''), s = t.trim();
    if (depth === 0) { const m = /^([a-z_0-9]+)\s*=\s*\{/.exec(s); if (m) { cur = { pm: m[1], pts: 0, in: {} }; out.push(cur); } }
    if (cur) {
      if (/^workforce_scaled\s*=\s*\{/.test(s)) inWS = true;
      let m;
      if ((m = /^country_construction_add\s*=\s*([\d.]+)/.exec(s))) cur.pts = +m[1];
      if (inWS && (m = /^goods_input_([a-z_]+)_add\s*=\s*([\d.]+)/.exec(s))) cur.in[m[1]] = +m[2];
      if (s === '}') inWS = inWS && depth > 2;
    }
    depth += braces(t);
    if (depth <= 0) { depth = 0; cur = null; inWS = false; }
  }
  const live = out.filter(c => c.pts > 0 && Object.keys(c.in).length);
  if (!live.length) throw new Error('no construction method with both points and goods — 13_construction.txt has moved.');
  return live;
}
