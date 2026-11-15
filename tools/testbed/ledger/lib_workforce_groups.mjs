// THE WHOLE WORKFORCE OUTSIDE THE TIER BUILDINGS, in groups, for the "Who works where" charts' second view (user, 2026-11-15): one country
// record of a save summary → headcounts (workers, not millions), in GROUP_LABELS order, stacked above the tier columns (lib_era_cols):
//   agriculture            farms, plantations, ranches, vineyards (bg_agriculture, bg_plantations, bg_ranching; not subsistence, not Cossacks)
//   mines & extraction     mines and gold fields, and the rest of the game's extraction group: logging, fishing, whaling, oil, rubber
//   infrastructure         ports, railways, canals, power plants and the dams (bg_infrastructure, bg_power; not the construction sector)
//   trade centres          ig_by_workplace.trade_center.wf (exact)
//   other buildings        every building in none of these groups and not a tier rung: shipyards, the vanilla industries the mod leaves
//                          untiered, monuments …
//   urban centres          ig_by_workplace.urban_center.wf (exact)
//   rentiers               ig_by_workplace.owner.wf (exact): Financial Districts, Manor Houses, company and regional company headquarters
//   government             pop_statistics.population_government_workforce (exact): government buildings, universities AND the construction
//                          sector — the save's own figure equals their sum (checked 2026-11-15: Britain 1936, 0.28M + 0.86M = 1.14M)
//   military               pop_statistics.population_military_workforce (exact; the barracks' staffing models only a third to two-thirds of it)
//   peasants & Cossacks    EVERYONE working in a subsistence building — peasants, and the farmers peasant proprietorship or homesteading put
//                          there (user, 2026-11-15) — and the Cossack Hosts (game 1.15; peasants by §10.112)
//   unemployed             pop_statistics.population_unemployed_workforce (exact; the strict figure, not U*)
// Exact where the save has a figure; elsewhere MODELLED: a building type's workers = its staffing × the employment of one level under its
// active methods. A save records `staffing` = the staffed headcount ÷ one level's employment (checked 2026-11-15 on F271's run 2: Russia's
// serf subsistence farms read 5,000 peasants per unit of staffing exactly; the model gives Britain's urban centres 7.37M against the save's
// exact 7.36M; the whole modelled workforce lands within 1–4% of the save's salaried + unemployed + peasants, the excess mostly the tier
// columns, which take a rung's main-method employment and ignore the labour-saving secondaries).
// A summary before v14 has no ig_by_workplace: the three groups it feeds come back null, and the chart says they were not read.
// ⚠ COUPLINGS (ON_GAME_UPDATE.md §2.3.3): the method employment and the building-group tree are read LIVE from the game folder and the mod
//   build passed in (the mod's files override vanilla's by name). The per-run builds are deleted after a batch, so a reader passes the build of
//   the book the runs played — `mod/` by default, which is the canon. The group names above are vanilla's (1.15.1).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const GROUP_LABELS = ['agriculture', 'mines & extraction', 'infrastructure', 'trade centres', 'other buildings', 'urban centres',
  'rentiers', 'government', 'military', 'peasants & Cossacks', 'unemployed'];
export const DEFAULT_GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';

const strip = s => s.replace(/^\uFEFF/, '').replace(/#.*$/gm, '');
function blocks(dir, fn) {
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir).filter(x => x.endsWith('.txt')).sort()) {
    const s = strip(readFileSync(join(dir, f), 'utf8')), re = /^([a-zA-Z_0-9\-]+)\s*=\s*\{/gm; let m;
    while ((m = re.exec(s))) {
      let d = 0, j = m.index + m[0].length - 1;
      for (; j < s.length; j++) { if (s[j] === '{') d++; else if (s[j] === '}') { d--; if (!d) break; } }
      fn(m[1], s.slice(m.index, j + 1)); re.lastIndex = j + 1;
    }
  }
}

// workforceModel({ game, mod, tierKeys }) → { groups(country) → number[GROUP_LABELS.length], missing: Set of methods with no employment entry }
export function workforceModel({ game = DEFAULT_GAME, mod = 'mod', tierKeys = {} } = {}) {
  const par = {}, bg = {}, emp = {};
  for (const root of [join(game, 'common'), join(mod, 'common')]) {
    blocks(join(root, 'building_groups'), (k, b) => { const p = /\bparent_group\s*=\s*([a-z_0-9]+)/.exec(b); par[k] = p ? p[1] : null; });
    blocks(join(root, 'buildings'), (k, b) => { const g = /\bbuilding_group\s*=\s*([a-z_0-9]+)/.exec(b); if (g) bg[k] = g[1]; });
    blocks(join(root, 'production_methods'), (k, b) => {
      emp[k] = [...b.matchAll(/building_employment_[a-z_]+_add\s*=\s*(-?[0-9.]+)/g)].reduce((t, x) => t + +x[1], 0);
    });
  }
  if (!Object.keys(emp).length || !Object.keys(bg).length) throw new Error('lib_workforce_groups: no methods or buildings read under ' + game);
  const chainOf = {};
  const chain = k => chainOf[k] ??= (() => { const c = []; let g = bg[k]; while (g && !c.includes(g)) { c.push(g); g = par[g]; } return c; })();
  const IDX = Object.fromEntries(GROUP_LABELS.map((l, i) => [l, i]));
  // the MODELLED groups by building type; null = counted elsewhere (a tier rung, or a group read exactly from the save)
  const bucket = k => {
    if (tierKeys[k]) return null;
    const c = chain(k);
    if (c.some(g => /^bg_subsistence_|^bg_cossack_host$/.test(g))) return IDX['peasants & Cossacks'];
    if (/^building_(company_|regional_company_)/.test(k) || c.some(g => /^bg_(owner_buildings|service|trade|military|government|technology|construction)$/.test(g))) return null;
    if (c.some(g => /^bg_(agriculture|plantations|ranching)$/.test(g))) return IDX.agriculture;
    if (c.includes('bg_extraction')) return IDX['mines & extraction'];
    if (c.some(g => /^bg_(infrastructure|power)$/.test(g))) return IDX.infrastructure;
    return IDX['other buildings'];
  };
  const missing = new Set();
  function groups(c) {
    const out = new Array(GROUP_LABELS.length).fill(0), p = c.pop_statistics || {}, w = c.ig_by_workplace;
    for (const [k, b] of Object.entries(c.buildings || {})) {
      const i = bucket(k); if (i == null || !b.levels) continue;
      let pe = 0;
      for (const [pm, n] of Object.entries(b.pms || {})) { if (emp[pm] == null) missing.add(pm); else pe += n * emp[pm]; }
      out[i] += (b.staffing || 0) * pe / b.levels;
    }
    out[IDX['trade centres']] = w ? (w.trade_center?.wf || 0) : null;
    out[IDX['urban centres']] = w ? (w.urban_center?.wf || 0) : null;
    out[IDX.rentiers] = w ? (w.owner?.wf || 0) : null;
    out[IDX.government] = +p.population_government_workforce || 0;
    out[IDX.military] = +p.population_military_workforce || 0;
    out[IDX.unemployed] = +p.population_unemployed_workforce || 0;
    return out;
  }
  return { groups, missing };
}
