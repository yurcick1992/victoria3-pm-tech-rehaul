// WHO OWNS THE TIERED SECTOR — company-held levels and output, per building type and per country.
//
// Written 2026-08-20 for FINDINGS F77, which established from the game files that **every** company
// mandate and **every** company throughput bonus lands on the FIRST rung of one of our chains and never
// on any other. That is the mechanism; this is the magnitude.
//
// ⚠ SINCE SAVE_SUMMARY_VERSION 7 (2026-08-21) THE SUMMARY CARRIES THE HEADLINE NUMBERS TOO — per-type
// `company_levels`, the `companies` register and the `ownership_levels` class rollup, per year. This
// tool remains the endpoint DEEP-DIVE: the rung split and the level-share VA apportionment live here.
// (Pre-v7 the summary's ownership pass read only `identity={ country= }` and could not answer this.)
// ⚠ COMPANY-HELD INCLUDES REGIONAL HQs since 2026-08-21: `building_regional_company_*` (the charter
// regional HQs) own through the same mechanism — 5,190 levels world-wide on the canon-n7 1936 endpoint
// against 40,466 via main HQs, ~520 of them on tiered types. F77.1's SHIPPED shares (38.5% vanilla /
// 9.0% ours) are on the older main-HQ-only basis and are therefore slight undercounts on BOTH sides.
//
// WHAT IT READS, out of the melted gamestate:
//   building_manager            id -> {type, state, levels, va_out, va_in}
//   states                      state id -> owning country
//   country_manager             country id -> tag
//   building_ownership_manager  {identity: country|building, building: id, levels}
// An ownership record whose identity is a BUILDING is company-held when that building's own type is a
// `building_company_*`. (Financial districts and manor houses own through the same mechanism, so the
// owner's TYPE is what separates them — never assume a building-identity owner is a company.)
//
// ⚠ LEVELS, NOT BUILDINGS. Ownership is recorded in levels, and a building's levels can be split
// between several owners, so a company "owning" a building usually means owning part of it.
// ⚠ Value added is apportioned BY LEVEL SHARE: a company holding 3 of a building's 10 levels is
// credited 30% of its VA. The save books VA per building, not per owner, so this is an apportionment
// and is labelled as one.
//
// USAGE
//   node tools/testbed/melted_company_ownership.mjs <save.v3> [--label X] [--json out.json]
//   node tools/testbed/melted_company_ownership.mjs <melted.txt> --melted

import { readFileSync, existsSync, writeFileSync, createReadStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ARGV = process.argv.slice(2);
const argOf = (n, d) => { const i = ARGV.indexOf(n); return i >= 0 && ARGV[i + 1] ? ARGV[i + 1] : d; };
const SAVE = ARGV[0];
if (!SAVE || !existsSync(SAVE)) { console.error('usage: melted_company_ownership.mjs <save.v3|melted.txt> [--melted]'); process.exit(1); }
const LABEL = argOf('--label', SAVE.split(/[\\/]/).pop());
const MAJORS = ['GBR', 'USA', 'FRA', 'NET', 'BEL', 'PRU', 'GER'];

// our tiered set, with the rung index — F77's whole point is WHICH rung
const cfg = JSON.parse(readFileSync(argOf('--config', 'config/mod_config.json'), 'utf8'));
const TIER = {};
for (const ind of cfg.industries || []) (ind.tiers || []).forEach((t, i) => {
  if (t.key) TIER[t.key] = { ind: ind.id, idx: i, era: t.era ?? 0, n: (ind.tiers || []).length };
});

// ---------------------------------------------------------------- the melt stream ----
function lines() {
  if (ARGV.includes('--melted')) return createInterface({ input: createReadStream(SAVE, 'utf8'), crlfDelay: Infinity });
  const rak = argOf('--rakaly', join(here, '..', 'vendor', 'rakaly', 'rakaly.exe'));
  if (!existsSync(rak)) { console.error('rakaly not found at ' + rak); process.exit(1); }
  const p = spawn(rak, ['melt', '--format', 'vic3', '--unknown-key', 'stringify', '-c', SAVE], { stdio: ['ignore', 'pipe', 'inherit'] });
  p.on('error', e => { console.error('rakaly failed: ' + e.message); process.exit(1); });
  return createInterface({ input: p.stdout, crlfDelay: Infinity });
}

const bld = new Map();          // id -> {type, state, levels, va}
const stateCountry = new Map(); // state id -> country id
const tag = new Map();          // country id -> tag
const own = [];                 // {ownerKind, ownerId, building, levels}

let mode = 'top', depth = 0, cur = null, id = null, inIdent = false, identKind = null, identId = null, saveDate = null;
const rl = lines();
for await (const raw of rl) {
  const t = raw.trim();
  if (!saveDate) { const d = /^date="?([\d.]+)"?$/.exec(t); if (d && raw[0] === 'd') saveDate = d[1]; }
  const opens = (t.match(/\{/g) || []).length, closes = (t.match(/\}/g) || []).length;

  if (mode === 'top') {
    if (t === 'building_manager={') { mode = 'bm'; depth = 1; continue; }
    if (t === 'states={') { mode = 'st'; depth = 1; continue; }
    if (t === 'country_manager={') { mode = 'cm'; depth = 1; continue; }
    if (t === 'building_ownership_manager={') { mode = 'own'; depth = 1; continue; }
    continue;
  }

  if (mode === 'bm') {
    const m = /^(\d+)=\{$/.exec(t);
    if (m && depth === 2) { id = +m[1]; cur = { type: null, state: null, levels: 0, va: 0 }; }
    else if (cur) {
      let x;
      if ((x = /^building="([a-z_0-9]+)"$/.exec(t))) cur.type = x[1];
      else if ((x = /^state=(\d+)$/.exec(t))) cur.state = +x[1];
      else if ((x = /^levels=(\d+)$/.exec(t))) cur.levels = +x[1];
      else if ((x = /^goods_sales=([\-\d.]+)$/.exec(t))) cur.va += +x[1];
    }
    const nd = depth + opens - closes;
    if (cur && nd <= 2) { if (cur.type) bld.set(id, cur); cur = null; }
    depth = nd; if (depth <= 0) mode = 'top';
    continue;
  }

  if (mode === 'st') {
    const m = /^(\d+)=\{$/.exec(t);
    // ⚠ DEPTH 3 EXACTLY, the same rule save_state_summary.mjs uses. A state record nests other blocks
    // that also carry a `country=`, so a depth-agnostic read attributes states to the wrong country —
    // and silently, because every world total still adds up and only the per-country split is wrong.
    if (m && depth === 2) { id = +m[1]; }
    else if (id != null && depth === 3) { const x = /^country=(\d+)$/.exec(t); if (x) stateCountry.set(id, +x[1]); }
    depth += opens - closes; if (depth <= 0) mode = 'top';
    continue;
  }

  if (mode === 'cm') {
    const m = /^(\d+)=\{$/.exec(t);
    if (m && depth === 2) { id = +m[1]; }
    else { const x = /^definition="([A-Z_0-9]+)"$/.exec(t); if (x && id != null && !tag.has(id)) tag.set(id, x[1]); }
    depth += opens - closes; if (depth <= 0) mode = 'top';
    continue;
  }

  if (mode === 'own') {
    const m = /^(\d+)=\{$/.exec(t);
    if (m && depth === 2) { cur = { levels: 0, building: null }; inIdent = false; identKind = null; identId = null; }
    else if (cur) {
      let x;
      if (t === 'identity={') inIdent = true;
      else if (inIdent) {
        if ((x = /^country=(\d+)$/.exec(t))) { identKind = 'country'; identId = +x[1]; }
        else if ((x = /^building=(\d+)$/.exec(t))) { identKind = 'building'; identId = +x[1]; }
        if (t === '}') inIdent = false;
      }
      else if ((x = /^levels=(\d+)$/.exec(t))) cur.levels = +x[1];
      else if ((x = /^building=(\d+)$/.exec(t))) cur.building = +x[1];
    }
    const nd = depth + opens - closes;
    if (cur && nd <= 2) {
      if (cur.building != null && identKind) own.push({ ownerKind: identKind, ownerId: identId, building: cur.building, levels: cur.levels });
      cur = null;
    }
    depth = nd; if (depth <= 0) mode = 'top';
    continue;
  }
}

if (!bld.size) { console.error('no buildings parsed — the save layout has moved'); process.exit(1); }

// ---------------------------------------------------------------- attribute ----
const isCompanyHq = id => { const t = bld.get(id)?.type || ''; return t.startsWith('building_company_') || t.startsWith('building_regional_company_'); };
const acc = {};   // scope -> {tierLv, tierVa, compLv, compVa, byRung:{}}
const scopeOf = b => { const c = stateCountry.get(b.state); return c != null ? (tag.get(c) || '?') : '?'; };
const bump = (scope, f, v) => { (acc[scope] ||= { tierLv: 0, tierVa: 0, compLv: 0, compVa: 0, byRung: {} })[f] += v; };

// total tiered levels / VA per scope
for (const b of bld.values()) {
  const t = TIER[b.type]; if (!t) continue;
  const s = scopeOf(b);
  for (const sc of ['WORLD', s]) { bump(sc, 'tierLv', b.levels); bump(sc, 'tierVa', b.va); }
}
// company-held share
let ownerTypeCount = {};
for (const o of own) {
  const b = bld.get(o.building); if (!b) continue;
  const t = TIER[b.type]; if (!t) continue;
  if (o.ownerKind !== 'building') continue;
  const ot = bld.get(o.ownerId)?.type || '(unknown)';
  ownerTypeCount[ot.replace(/_[a-z0-9_]+$/, m => ot.startsWith('building_company_') ? '_*' : m)] = (ownerTypeCount[ot.startsWith('building_company_') ? 'building_company_*' : ot] || 0) + 1;
  if (!isCompanyHq(o.ownerId)) continue;
  const share = b.levels > 0 ? o.levels / b.levels : 0;
  const s = scopeOf(b);
  for (const sc of ['WORLD', s]) {
    bump(sc, 'compLv', o.levels);
    bump(sc, 'compVa', b.va * share);
    const a = acc[sc]; a.byRung[t.idx] = (a.byRung[t.idx] || 0) + o.levels;
  }
}

// ---------------------------------------------------------------- report ----
const pct = (a, b) => b ? (100 * a / b).toFixed(2) + '%' : '—';
const fmt = n => Math.round(n).toLocaleString('en-GB');
console.log(`\n======== COMPANY OWNERSHIP OF THE TIERED SECTOR — ${LABEL} ========`);
console.log(`  save date ${saveDate || '?'} · ${bld.size.toLocaleString('en-GB')} buildings · ${own.length.toLocaleString('en-GB')} ownership records`);
console.log('  "value added" is the save\'s own per-building goods_sales, APPORTIONED to an owner by its level share.');
console.log('\n  scope        tier levels   company-held      share    tier VA £/wk   company VA      share');
const order = ['WORLD', ...MAJORS.filter(t => acc[t])];
for (const s of order) {
  const a = acc[s]; if (!a) continue;
  console.log(`  ${s.padEnd(10)} ${fmt(a.tierLv).padStart(11)}   ${fmt(a.compLv).padStart(12)}   ${pct(a.compLv, a.tierLv).padStart(7)}   ${fmt(a.tierVa).padStart(12)}   ${fmt(a.compVa).padStart(10)}   ${pct(a.compVa, a.tierVa).padStart(7)}`);
}
const W = acc.WORLD;
console.log('\n  company-held tier levels BY RUNG INDEX (F77 predicts rung 1 only):');
for (const k of Object.keys(W.byRung).map(Number).sort((a, b) => a - b))
  console.log(`     rung ${k + 1} of the chain: ${fmt(W.byRung[k]).padStart(9)}   ${pct(W.byRung[k], W.compLv)}`);
console.log('\n  building-identity owners seen (a company is only one kind):');
for (const [k, v] of Object.entries(ownerTypeCount).sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log('     ' + k.padEnd(38) + v);
if (argOf('--json', '')) writeFileSync(argOf('--json', ''), JSON.stringify({ label: LABEL, date: saveDate, acc }, null, 1));
console.log('');
