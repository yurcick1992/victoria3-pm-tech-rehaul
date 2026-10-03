// DOES EVERY BUILDING RUN ITS MANDATED AUTOMATION BESIDE THE MAIN METHOD IT BELONGS TO? (BALANCE_FRAMEWORK §10.93, 2026-10-03)
//
//   node tools/testbed/ledger/mandate_switch.mjs --session <stamp> [--setup <name>] [--detail] [--every N]
//
// A MANDATED automation (lib_secondary_compat MANDATED: Mechanized Looms beside Sewing Machines, Automatic Power Looms beside Electric Sewing
// Machines, Assembly Lines beside Mass Production) is emitted as a copy gated to its main method, the only member of its group legal there — so
// in a healthy save every level running the main method runs that copy, and no level runs a copy beside another main method. ⭐ The case it
// exists for is a MERGED building (§10.91.2): when a level switches its main method the engine must move the automation to the other method's
// copy. Measured on 20261002_235755 (run 1): it does so at first, then from 1913 holds ONE stale level now and then (Electric Sewing Machines
// still running the Mechanized Looms copy) — the engine does not re-check a selected secondary when the main method changes (the VERDICT there).
// Per run and yearly summary: the levels on each mandated main method against those on its copy, world-wide, and (--detail) the countries
// where they differ. The pairs come from each run's OWN book (provenance), through the same library the emitter reads.
// Promoted from the session folder of 20261002_235755, where it began as a one-off check of that batch's merged textile building.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { mandatedFor, vanillaMainOfTier } from '../../lib_secondary_compat.mjs';

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const SESSION = argOf('--session', null);
if (!SESSION) { console.error('usage: node tools/testbed/ledger/mandate_switch.mjs --session <stamp> [--setup <name>] [--detail] [--every N]'); process.exit(2); }
const ROOT = join(process.cwd(), 'tools/testbed/sessions');
const sdir = existsSync(join(ROOT, SESSION)) ? join(ROOT, SESSION) : (readdirSync(ROOT).filter(d => d.startsWith(SESSION)).map(d => join(ROOT, d))[0]);
if (!sdir || !existsSync(sdir)) throw new Error(`mandate_switch: no session ${SESSION}`);
const SETUP = argOf('--setup', null), DETAIL = args.includes('--detail'), EVERY = +argOf('--every', 1);
const strip = k => k.replace(/^building_/, '');
const load = f => JSON.parse(gunzipSync(readFileSync(f)).toString());

const runs = readdirSync(sdir).filter(d => /^run\d+_/.test(d) && (!SETUP || d.endsWith('_' + SETUP)));
if (!runs.length) throw new Error(`mandate_switch: no run of setup ${SETUP || '(any)'} in ${sdir}`);
let anyBad = 0;
for (const run of runs) {
  const sumDir = join(sdir, run, 'save_summaries');
  const files = existsSync(sumDir) ? readdirSync(sumDir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort() : [];   // never the harvester's in-progress file (L25)
  if (!files.length) { console.log(`${run}: no save summaries`); continue; }
  const first = load(join(sumDir, files[0]));
  const cfgPath = first.provenance && first.provenance.built_from_config;
  if (!cfgPath || !existsSync(cfgPath)) { console.log(`${run}: its book (${cfgPath}) is not readable`); continue; }
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8').replace(/^﻿/, ''));
  // per building: [{ main: pm_key, copy: mandated copy key, label }] — a merged building carries one pair per main method
  const PAIRS = {};
  for (const ind of cfg.industries || []) {
    if (ind.disabled) continue;
    for (const t of ind.tiers || []) {
      const a = mandatedFor(vanillaMainOfTier(ind, t)); if (!a) continue;
      const host = t.method_of || t.key;
      (PAIRS[host] ||= []).push({ main: t.pm_key, copy: a + '_' + strip(t.key), label: strip(t.key) });
    }
  }
  if (!Object.keys(PAIRS).length) { console.log(`${run}: its book carries no rung with a mandated automation`); continue; }
  console.log(`\n${run} — ${cfgPath.split(/[\\/]/).pop()}`);
  console.log('  date         | ' + Object.values(PAIRS).flat().map(p => `${p.label.slice(0, 34)} main/copy`).join(' | ') + ' | countries off');
  let everCopy = 0, bad = 0;
  files.forEach((f, i) => {
    if (i % EVERY && i !== files.length - 1) return;
    let s; try { s = load(join(sumDir, f)); } catch { return; }
    const date = (s.provenance && s.provenance.date) || f;
    const tot = {}, off = [];
    for (const [tag, c] of Object.entries(s.countries || {})) {
      for (const [b, ps] of Object.entries(PAIRS)) {
        const bb = c.buildings && c.buildings[b]; if (!bb) continue;
        const pms = bb.pms || {}; const cell = [];
        for (const p of ps) {
          const m = pms[p.main] || 0, k = pms[p.copy] || 0; const w = tot[p.label] ||= { m: 0, k: 0 };
          w.m += m; w.k += k; everCopy += k;
          if (m !== k) cell.push(`${p.label} ${m}/${k}`);
        }
        if (cell.length) off.push(`${tag} ${cell.join(', ')}`);
      }
    }
    if (off.length) bad++;
    console.log('  ' + String(date).padEnd(12) + ' | ' + Object.values(PAIRS).flat().map(p => { const w = tot[p.label] || { m: 0, k: 0 }; return `${String(w.m).padStart(5)} / ${String(w.k).padEnd(5)}`.padEnd(p.label.slice(0, 34).length + 10); }).join(' | ') + ' | ' + off.length);
    if (DETAIL) for (const x of off.slice(0, 10)) console.log('      ' + x);
  });
  if (!everCopy) console.log('  ⚠ no level ever ran a mandated copy — a build from before BALANCE_FRAMEWORK §10.93 (2026-10-02)?');
  console.log(`  ${bad} snapshot(s) with a country whose levels on a main method and on its mandated copy differ`);
  anyBad += bad;
}
process.exit(0);
