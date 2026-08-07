// melted_pops_by_profession.mjs — POPULATION BY PROFESSION, per country, out of a melted gamestate.
//
//   node tools/testbed/melted_pops_by_profession.mjs <melt> [--json out.json] [--date 1836.4.1]
//
// ⭐ WHY THIS EXISTS. The balance sheet's population is edited BY PROFESSION and the three wealth strata
// are their SUM — a stratum is not an input, it is a total. But `extract_presets.ps1` derives the strata
// from history + measurement and had no per-profession source at all, so the sheet had to fall back to
// editable strata whenever a preset carried none. That inverts the model: it makes the derived quantity
// the source of truth. The save fixes it, because a pop record carries its own `type`.
//
// ⚠ IT EMITS PER COUNTRY, NOT PER MARKET, DELIBERATELY. Market membership is `extract_presets.ps1`'s job
// (lead country + every subject sharing its market, `grant_own_market` resolved transitively) and it is
// derived from HISTORY, which is the version-tracking source. Emitting per market here would put a second,
// save-derived definition of "who is in this market" in the tree, and the two would drift apart silently.
//
// ⚠ A POP'S SIZE IS `workforce + dependents`, NOT `workforce`. The measured `by_pop_type` table in
// config/measured_1836.json holds WORKFORCE, which is roughly a quarter of the people — feeding that to a
// buy-package model under-counts consumption fourfold. They are different quantities; do not swap them.
import { createReadStream, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const MELT = args.filter(a => !a.startsWith('--'))[0];
const JSONOUT = argOf('--json', '');
if (!MELT) { console.error('usage: melted_pops_by_profession.mjs <melt> [--json out.json]'); process.exit(1); }

// ---- pass 1: state -> country, country -> tag. Same record shapes melted_building_goods.mjs reads;
// kept in step with it deliberately — if the save's layout moves, both move together.
const stateCountry = new Map(), countryTag = new Map();
let date = '';
{
  let section = null, depth = 0, curId = null;
  const rl = createInterface({ input: createReadStream(MELT, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    const t = line.trim();
    if (!date) { const d = /^date=(\d+\.\d+\.\d+)$/.exec(line); if (d) date = d[1]; }
    if (!section) {
      if (t === 'states={') { section = 'states'; depth = 1; }
      else if (t === 'country_manager={') { section = 'countries'; depth = 1; }
      continue;
    }
    const o = (t.match(/\{/g) || []).length, c = (t.match(/\}/g) || []).length;
    const m = /^(\d+)=\{$/.exec(t);
    if (m && depth === 2) curId = +m[1];
    else if (curId != null) {
      if (section === 'states') { const cm = /^country=(\d+)$/.exec(t); if (cm) stateCountry.set(curId, +cm[1]); }
      else { const dm = /^definition="([A-Z_]+)"$/.exec(t); if (dm && !countryTag.has(curId)) countryTag.set(curId, dm[1]); }
    }
    depth += o - c;
    if (depth <= 0) { section = null; curId = null; depth = 0; }
  }
}
console.error(`date ${date} · states ${stateCountry.size} · countries ${countryTag.size}`);

// ---- pass 2: the pop table
const byTag = new Map();          // tag -> { type -> people }
let pops = 0, orphan = 0, orphanPeople = 0;
{
  let sec = false, depth = 0, cur = null;
  const flush = () => {
    if (!cur || cur.state == null || !cur.type) { cur = null; return; }
    const size = (cur.workforce || 0) + (cur.dependents || 0);
    if (!(size > 0)) { cur = null; return; }
    const ci = stateCountry.get(cur.state);
    const tag = ci != null ? countryTag.get(ci) : null;
    // ⚠ An unattributable pop is REPORTED, never dropped silently: a decentralised or unowned state has
    // no country, and if that were quietly skipped the totals would look clean while missing people.
    if (!tag) { orphan++; orphanPeople += size; cur = null; return; }
    if (!byTag.has(tag)) byTag.set(tag, {});
    const m = byTag.get(tag); m[cur.type] = (m[cur.type] || 0) + size;
    pops++; cur = null;
  };
  const rl = createInterface({ input: createReadStream(MELT, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    const t = line.trim();
    if (!sec) { if (t === 'pops={') { sec = true; depth = 1; } continue; }
    const o = (t.match(/\{/g) || []).length, c = (t.match(/\}/g) || []).length;
    const m = /^(\d+)=\{$/.exec(t);
    if (m && depth === 2) { flush(); cur = { state: null, type: null, workforce: 0, dependents: 0 }; }
    else if (cur) {
      let x;
      if ((x = /^location=(\d+)$/.exec(t))) cur.state = +x[1];
      else if ((x = /^type="([a-z_]+)"$/.exec(t))) cur.type = x[1];
      else if ((x = /^workforce=(\d+)$/.exec(t))) cur.workforce = +x[1];
      else if ((x = /^dependents=(\d+)$/.exec(t))) cur.dependents = +x[1];
    }
    depth += o - c;
    if (depth <= 0) { flush(); break; }
  }
}
const total = [...byTag.values()].reduce((s, m) => s + Object.values(m).reduce((a, b) => a + b, 0), 0);
console.error(`pop records ${pops} · countries with pops ${byTag.size} · people ${total.toLocaleString('en-US')}`);
if (orphan) console.error(`⚠ ${orphan} pop record(s) in states with no owner — ${orphanPeople.toLocaleString('en-US')} people, NOT attributed to any country`);

const out = { _comment: 'Population BY PROFESSION per country, read from a melted VANILLA gamestate. A pop\'s size is workforce + dependents. GENERATED by tools/testbed/melted_pops_by_profession.mjs — do not hand-edit.', date, source: MELT.replace(/\\/g, '/').split('/').pop(), orphan_pops: orphan, orphan_people: orphanPeople, countries: {} };
for (const [tag, m] of [...byTag].sort()) out.countries[tag] = Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round(v)]));
if (JSONOUT) { writeFileSync(JSONOUT, JSON.stringify(out, null, 1)); console.error(`wrote ${JSONOUT}`); }
else console.log(JSON.stringify(out, null, 1));
