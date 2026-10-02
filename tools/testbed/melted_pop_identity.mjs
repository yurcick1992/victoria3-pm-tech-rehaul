// melted_pop_identity.mjs — WHO each profession is, per country, and HOW MANY PEASANTS each state holds, out of a melted gamestate.
//
//   node tools/testbed/melted_pop_identity.mjs <melt> [--json config/measured_1836_pop_identity.json]
//
// ⭐ WHY THIS EXISTS (user-ruled 2026-10-01, FINDINGS F197 §4 and its follow-up): the 1836 craft seeding creates new shopkeeper and laborer
// pops for the craft levels it adds in a country's major cities. *"For their ethnos and religion, let's just take the ethnos and religion of
// the most numerous pop of that profession of the country; if for some reason none exists, highlight and default to country's first primary
// culture and declared religion."* And the seeding must keep vanilla's head count: *"take from peasants (in the states where shopkeepers /
// labourers are created, if possible, otherwise from the state with most peasants). Ignore ethnicity and religion of the peasants."* The
// history files cannot answer either question — 4,454 `create_pop` blocks, almost none typed; the engine assigns professions at init — so
// both come from a VANILLA gamestate at the reference date 1836.2.1 (*"Redo with 1836.2.1"*).
//
// WHAT IT WRITES:
//   countries.<TAG>.<profession> = { culture, religion, size, share } — the (culture, religion) pair holding the most people of that
//     profession in the country (people = workforce + dependents, summed over every pop record of that pair: a pop RECORD is split by
//     workplace and wealth, so "the most numerous pop" is read as the most numerous culture-religion group, never one record).
//   countries.<TAG>.total = people.
//   states."<STATE_REGION>|<TAG>" = { peasants, people, infrastructure, infrastructure_usage } — peasant people (workforce + dependents)
//     and all people in that state's share owned by that country (a split state has one entry per owner), and the WHOLE state's
//     infrastructure capacity and usage (the same pair under each owner of a split state; the seeding caps a city by the spare).
//
// ⚠ An unattributable pop (a state with no owner) is REPORTED, never dropped silently. ⚠ Culture is an INDEX into the save's own culture
// database (pop records carry `culture=15`), resolved through `cultures={ database={ 15={ type="..." }}}`; religion is a key string.
import { createReadStream, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const MELT = args.filter(a => !a.startsWith('--'))[0];
const JSONOUT = argOf('--json', '');
if (!MELT) { console.error('usage: melted_pop_identity.mjs <melt> [--json out.json]'); process.exit(1); }

// ---- pass 1: states (id -> region, country), countries (id -> tag), cultures (id -> type)
const stateRegion = new Map(), stateCountry = new Map(), countryTag = new Map(), cultureType = new Map(), stateInfra = new Map();
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
      else if (t === 'cultures={') { section = 'cultures'; depth = 1; }
      continue;
    }
    const o = (t.match(/\{/g) || []).length, c = (t.match(/\}/g) || []).length;
    const m = /^(\d+)=\{$/.exec(t);
    if (m && depth === 2) curId = +m[1];
    else if (curId != null && depth === 3) {
      let x;
      if (section === 'states') {
        if ((x = /^country=(\d+)$/.exec(t))) stateCountry.set(curId, +x[1]);
        else if ((x = /^region="([A-Za-z0-9_]+)"$/.exec(t))) stateRegion.set(curId, x[1]);
        else if ((x = /^infrastructure=([0-9.]+)$/.exec(t))) (stateInfra.get(curId) || stateInfra.set(curId, {}).get(curId)).cap = +x[1];
        else if ((x = /^infrastructure_usage=([0-9.]+)$/.exec(t))) (stateInfra.get(curId) || stateInfra.set(curId, {}).get(curId)).use = +x[1];
      } else if (section === 'countries') { if ((x = /^definition="([A-Z0-9_]+)"$/.exec(t)) && !countryTag.has(curId)) countryTag.set(curId, x[1]); }
      else if (section === 'cultures') { if ((x = /^type="([a-z0-9_]+)"$/.exec(t)) && !cultureType.has(curId)) cultureType.set(curId, x[1]); }
    }
    depth += o - c;
    if (depth <= 0) { section = null; curId = null; depth = 0; }
  }
}
console.error(`date ${date} · states ${stateRegion.size} (${stateCountry.size} owned) · countries ${countryTag.size} · cultures ${cultureType.size}`);
if (!date || !stateRegion.size || !countryTag.size || !cultureType.size) throw new Error('melted_pop_identity: a section did not parse — is this a melted Victoria 3 gamestate?');

// ---- pass 2: the pop table
const groups = new Map();   // TAG -> profession -> "culture|religion" -> people
const totals = new Map();   // TAG -> people
const states = new Map();   // "REGION|TAG" -> { peasants, people }
let pops = 0, orphan = 0, orphanPeople = 0, noCulture = 0;
{
  let sec = false, depth = 0, cur = null;
  const flush = () => {
    if (!cur || cur.state == null || !cur.type) { cur = null; return; }
    const size = (cur.workforce || 0) + (cur.dependents || 0);
    if (!(size > 0)) { cur = null; return; }
    const ci = stateCountry.get(cur.state); const tag = ci != null ? countryTag.get(ci) : null; const region = stateRegion.get(cur.state);
    if (!tag || !region) { orphan++; orphanPeople += size; cur = null; return; }
    const cult = cur.culture != null ? cultureType.get(cur.culture) : null; if (!cult) noCulture++;
    const key = `${cult || '?'}|${cur.religion || '?'}`;
    const g = (groups.get(tag) || groups.set(tag, {}).get(tag)); const p = (g[cur.type] ||= {}); p[key] = (p[key] || 0) + size;
    totals.set(tag, (totals.get(tag) || 0) + size);
    const sk = `${region}|${tag}`; const s = states.get(sk) || { peasants: 0, people: 0 }; states.set(sk, s);
    s.people += size; if (cur.type === 'peasants') s.peasants += size;
    // the state's infrastructure capacity and usage (the WHOLE state's — a split state carries the same pair under each owner)
    if (s.infrastructure == null) { const inf = stateInfra.get(cur.state); if (inf) { s.infrastructure = inf.cap ?? 0; s.infrastructure_usage = inf.use ?? 0; } }
    pops++; cur = null;
  };
  const rl = createInterface({ input: createReadStream(MELT, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    const t = line.trim();
    if (!sec) { if (t === 'pops={') { sec = true; depth = 1; } continue; }
    const o = (t.match(/\{/g) || []).length, c = (t.match(/\}/g) || []).length;
    const m = /^(\d+)=\{$/.exec(t);
    if (m && depth === 2) { flush(); cur = { state: null, type: null, culture: null, religion: null, workforce: 0, dependents: 0 }; }
    else if (cur && depth === 3) {
      let x;
      if ((x = /^location=(\d+)$/.exec(t))) cur.state = +x[1];
      else if ((x = /^type="([a-z_]+)"$/.exec(t))) cur.type = x[1];
      else if ((x = /^culture=(\d+)$/.exec(t))) cur.culture = +x[1];
      else if ((x = /^religion="([a-z0-9_]+)"$/.exec(t))) cur.religion = x[1];
      else if ((x = /^workforce=(\d+)$/.exec(t))) cur.workforce = +x[1];
      else if ((x = /^dependents=(\d+)$/.exec(t))) cur.dependents = +x[1];
    }
    depth += o - c;
    if (depth <= 0) { flush(); break; }
  }
}
const people = [...totals.values()].reduce((a, b) => a + b, 0);
console.error(`pop records ${pops} · countries ${totals.size} · people ${people.toLocaleString('en-US')}`);
if (orphan) console.error(`⚠ ${orphan} pop record(s) in states with no owner — ${orphanPeople.toLocaleString('en-US')} people, NOT attributed`);
if (noCulture) console.error(`⚠ ${noCulture} pop record(s) whose culture index did not resolve`);

const out = {
  _comment: 'Per country and profession, the culture-religion group holding the most people of that profession; per state share (REGION|TAG), its peasants and people. A pop\'s size is workforce + dependents. Read from a melted VANILLA gamestate. GENERATED by tools/testbed/melted_pop_identity.mjs — do not hand-edit. Used by tools/emit_craft_start.mjs (the 1836 craft seeding, FINDINGS F197 §4).',
  date, source: MELT.replace(/\\/g, '/').split('/').pop(), orphan_pops: orphan, orphan_people: orphanPeople, countries: {}, states: {},
};
for (const [tag, g] of [...groups].sort()) {
  const row = { total: Math.round(totals.get(tag)) };
  for (const [prof, m] of Object.entries(g).sort()) {
    const tot = Object.values(m).reduce((a, b) => a + b, 0);
    const [best, n] = Object.entries(m).sort((a, b) => b[1] - a[1])[0];
    const [culture, religion] = best.split('|');
    row[prof] = { culture, religion, size: Math.round(n), share: +(n / tot).toFixed(3) };
  }
  out.countries[tag] = row;
}
for (const [k, s] of [...states].sort()) out.states[k] = { peasants: Math.round(s.peasants), people: Math.round(s.people),
  ...(s.infrastructure != null ? { infrastructure: +s.infrastructure.toFixed(2), infrastructure_usage: +s.infrastructure_usage.toFixed(2) } : {}) };
if (JSONOUT) { writeFileSync(JSONOUT, JSON.stringify(out, null, 1)); console.error(`wrote ${JSONOUT}`); }
else console.log(JSON.stringify(out, null, 1).slice(0, 4000));
