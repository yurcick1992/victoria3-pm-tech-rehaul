// WHICH MAIN METHOD DOES A MERGED BUILDING RUN? (BALANCE_FRAMEWORK §10.91.2, 2026-09-30)
//
//   node tools/testbed/ledger/merge_methods.mjs --session <stamp> [--setup <name>] [--tags GBR,FRA] [--every N]
//
// A merged rung (`method_of`) is a second main METHOD of its host building, so the save summaries' building types cannot tell
// the two rungs apart — only `pms` (levels running each active method) can. Per run, per save date, per country and merged
// industry this prints the host's levels on its own method and on the merged one, and the levels whose secondary is the
// merged method's own copy (emit_secondaries mints one copy per main method, gated to it, so those levels can never exceed
// the merged method's). The pairs and method keys come from each run's OWN book (`_merge.pairs` via provenance).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const SESSION = argOf('--session', null);
if (!SESSION) { console.error('usage: node tools/testbed/ledger/merge_methods.mjs --session <stamp> [--setup <name>] [--tags GBR,FRA] [--every N]'); process.exit(2); }
const ROOT = join(process.cwd(), 'tools/testbed/sessions');
const sdir = existsSync(join(ROOT, SESSION)) ? join(ROOT, SESSION) : readdirSync(ROOT).filter(d => d.startsWith(SESSION)).map(d => join(ROOT, d))[0];
if (!sdir || !existsSync(sdir)) throw new Error(`merge_methods: no session ${SESSION}`);
const SETUP = argOf('--setup', null);
const TAGS = argOf('--tags', null) ? argOf('--tags', '').split(',') : null;
const EVERY = +argOf('--every', 1);

const runs = readdirSync(sdir).filter(d => /^run\d+_/.test(d) && (!SETUP || d.endsWith('_' + SETUP)));
if (!runs.length) throw new Error(`merge_methods: no run of setup ${SETUP || '(any)'} in ${sdir}`);
const load = f => JSON.parse(gunzipSync(readFileSync(f)).toString());
const strip = k => k.replace(/^building_/, '');

for (const run of runs) {
  const sumDir = join(sdir, run, 'save_summaries');
  const files = existsSync(sumDir) ? readdirSync(sumDir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort() : [];   // never the harvester's in-progress file (L25)
  if (!files.length) { console.log(`${run}: no save summaries`); continue; }
  const first = load(join(sumDir, files[0]));
  const cfgPath = first.provenance && first.provenance.built_from_config;
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8').replace(/^﻿/, ''));
  const pairs = (cfg._merge && cfg._merge.pairs) || {};
  if (!Object.keys(pairs).length) { console.log(`${run}: its book (${cfgPath}) carries no _merge — nothing merged`); continue; }
  const pm = {};
  for (const ind of cfg.industries || []) { if (ind.disabled) continue; for (const t of ind.tiers || []) pm[t.key] = t.pm_key; }
  const P = Object.entries(pairs).map(([id, p]) => ({ id, host: p.host, hostPm: pm[p.host], addPm: pm[p.added], addSfx: '_' + strip(p.added), grant: ((cfg._merge.probe_grant || {}).industries || []).includes(id) }));
  const granted = new Set(((cfg._merge.probe_grant || {}).tags) || []);
  console.log(`\n${run} — ${cfgPath.split(/[\\/]/).pop()}${granted.size ? ` (probe grant: ${[...granted].join(' ')} hold ${cfg._merge.probe_grant.techs.join(', ')})` : ''}`);
  console.log('  per country: <industry> own/merged levels [levels whose secondaries are the merged copies]');
  const worldRows = [];
  files.forEach((f, i) => {
    if (i % EVERY && i !== files.length - 1) return;
    const s = load(join(sumDir, f));
    const date = s.provenance && s.provenance.date;
    const world = {};
    const lines = [];
    for (const [tag, c] of Object.entries(s.countries || {})) {
      const cells = [];
      for (const p of P) {
        const b = c.buildings && c.buildings[p.host]; if (!b) continue;
        const pms = b.pms || {};
        const own = pms[p.hostPm] || 0, add = pms[p.addPm] || 0;
        const secAdd = Object.entries(pms).filter(([k]) => k.endsWith(p.addSfx)).reduce((a, [, v]) => a + v, 0);
        const w = world[p.id] ||= { own: 0, add: 0, sec: 0, bad: 0 };
        w.own += own; w.add += add; w.sec += secAdd;
        if (secAdd > add) w.bad++;
        if (!TAGS || TAGS.includes(tag)) cells.push(`${p.id} ${own}/${add}${secAdd ? ` [${secAdd}]` : ''}${secAdd > add ? ' !!' : ''}`);
      }
      if (cells.length && (!TAGS || TAGS.includes(tag)) && (TAGS || granted.has(tag) || cells.some(x => !/\/0( |$)/.test(x))))
        lines.push(`    ${tag.padEnd(4)}${granted.has(tag) ? '*' : ' '} ${cells.join('   ')}`);
    }
    console.log(`  ${date}`);
    for (const l of lines) console.log(l);
    worldRows.push({ date, world });
  });
  console.log('  WORLD (own/merged levels, [merged-copy secondary levels], !! = merged-copy secondaries on more levels than the merged method runs):');
  for (const { date, world } of worldRows)
    console.log(`    ${String(date).padEnd(10)} ` + P.map(p => { const w = world[p.id] || { own: 0, add: 0, sec: 0, bad: 0 }; return `${p.id} ${w.own}/${w.add}${w.sec ? ` [${w.sec}]` : ''}${w.bad ? ` !!${w.bad}` : ''}`; }).join('   '));
}
