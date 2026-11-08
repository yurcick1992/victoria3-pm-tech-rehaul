#!/usr/bin/env node
// L50 — A LAUNCH THAT MOUNTED NO DLC. Per game launch of a run: the DLCs the game LISTED (the "DLC:" block of debug.log) against the
// DLC folders it MOUNTED ("Mounted Data: ...\game\dlc\<folder>"). A launch whose store lookup failed ("Could not find item in store
// backend.", dlc.cpp) lists every installed DLC and mounts none, then plays an ordinary-looking game without any DLC content: every
// has_dlc_feature check is false and every event or journal entry carrying `dlc = ...` is dead (F266: the 1.15 probe's canon run,
// 1836-1856, never scheduled Kenesary, Congress Poland or the Caucasian War, and played without Sphere of Influence's or State and
// Revolution's content beside a vanilla run that had them).
//
//   node tools/testbed/dlc_mounts.mjs <session-or-run-dir> [...]   every launch of every run (exit 1 on any short launch)
//   node tools/testbed/dlc_mounts.mjs --all                          every session under tools/testbed/sessions
//   node tools/testbed/dlc_mounts.mjs --live <run-dir>               the run's NEWEST launch only (the five-minute smoke check)
//
// A launch belongs to the run only if its header time matches one of the run's attempts (meta.json attempt_log, within 3 minutes):
// the log mirror can carry an EARLIER run's launch out of the shared ring (L9; 2026-08-19 aival-n4). Unmatched launches are printed as
// declined, never judged. A run of a no-DLC test (meta.json disabled_dlc non-empty) is declined: no DLC is its designed outcome.
// Exit 0 = every judged launch mounted every DLC it listed; 1 = at least one launch mounted fewer; 2 = usage error.
import { readFileSync, readdirSync, existsSync, statSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const live = args.includes('--live');
const all = args.includes('--all');
const paths = args.filter(a => !a.startsWith('--'));
if (!all && paths.length === 0) { console.error('usage: dlc_mounts.mjs <session-or-run-dir> [...] | --all | --live <run-dir>'); process.exit(2); }

const readJson = p => { try { return JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, '')); } catch { return null; } };
const isRun = d => /^run\d+/.test(basename(d)) && statSync(d).isDirectory();
const runsOf = d => isRun(d) ? [d] : readdirSync(d).map(n => join(d, n)).filter(p => existsSync(p) && isRun(p)).sort();

let dirs = [];
if (all) {
  const root = resolve(here, 'sessions');
  for (const s of readdirSync(root).sort()) { const p = join(root, s); if (statSync(p).isDirectory()) dirs.push(...runsOf(p)); }
} else for (const p of paths) {
  if (!existsSync(p)) { console.error(`no such folder: ${p}`); process.exit(2); }
  dirs.push(...runsOf(resolve(p)));
}

const HDR = /^\[(\d\d):(\d\d):(\d\d)\]\[jominiapplication\.cpp:\d+\]: DLC:\s*$/;
const MOUNT = /Mounted Data: .*[\/\\]game[\/\\]dlc[\/\\]([^\/\\\s]+)/;
const MISS = /Could not find item in store backend/;
const secs = (h, m, s) => (+h) * 3600 + (+m) * 60 + (+s);

// Streamed: a mirrored debug.log can pass 512 MB (a node string's limit).
async function launchesOf(file) {
  const out = [];
  let cur = null, listing = false;
  for await (const line of createInterface({ input: createReadStream(file), crlfDelay: Infinity })) {
    const h = line.match(HDR);
    if (h) { cur = { t: secs(h[1], h[2], h[3]), at: `${h[1]}:${h[2]}:${h[3]}`, listed: 0, mounted: new Set(), misses: 0 }; out.push(cur); listing = true; continue; }
    if (!cur) continue;
    if (listing) {
      if (line.startsWith('[')) listing = false;
      else { if (line.includes('|dlc/')) cur.listed++; continue; }
    }
    const m = line.match(MOUNT); if (m) cur.mounted.add(m[1]);
    if (MISS.test(line)) cur.misses++;
  }
  return out;
}

let judged = 0, short = [], declined = [];
for (const run of dirs) {
  const name = `${basename(dirname(run))}/${basename(run)}`;
  const meta = readJson(join(run, 'meta.json'));
  if (meta && Array.isArray(meta.disabled_dlc) && meta.disabled_dlc.length) { declined.push(`${name}: a no-DLC test (disabled_dlc)`); continue; }
  const log = join(run, 'logs_live', 'debug.log');
  if (!existsSync(log)) { declined.push(`${name}: no logs_live/debug.log`); continue; }
  let launches = await launchesOf(log);
  if (!launches.length) { declined.push(`${name}: no DLC header in the mirrored log (its start was not mirrored)`); continue; }
  if (live) launches = launches.slice(-1);
  else if (meta && Array.isArray(meta.attempt_log) && meta.attempt_log.length) {
    const starts = meta.attempt_log.map(a => String(a.started || '').match(/T(\d\d):(\d\d):(\d\d)/)).filter(Boolean).map(m => secs(m[1], m[2], m[3]));
    const own = launches.filter(l => starts.some(s => { const d = (l.t - s + 86400) % 86400; return d <= 180; }));
    for (const l of launches) if (!own.includes(l)) declined.push(`${name}: launch ${l.at} matches none of the run's attempts (an earlier run's lines in the ring)`);
    launches = own;
  }
  launches.forEach((l, i) => {
    judged++;
    const line = `${name} launch ${i + 1} @${l.at}: listed ${l.listed}, mounted ${l.mounted.size}, store misses ${l.misses}`;
    const span = meta?.attempt_log?.[i] ? ` - played ${meta.attempt_log[i].resumed_from || 'the start'} -> ${meta.attempt_log[i].ended_at_ingame}` : '';
    // FAIL: a store lookup failed, or nothing was mounted. A PARTIAL mount with no store miss is the log mirror's gap (L28/L29: the
    // third mount line cut mid-word, the log jumping ahead - seven runs 2026-09-07..10-15), so it is printed as unreadable, not judged.
    if (l.misses > 0 || (l.listed > 0 && l.mounted.size === 0)) short.push(line + span);
    else if (l.mounted.size < l.listed) { judged--; declined.push(`${line}: a partial mount with no store miss - the mirror's gap, unreadable`); }
    else if (args.includes('--verbose') || live) console.log('ok   ' + line);
  });
}
for (const d of declined) console.log('skip ' + d);
for (const s of short) console.log('FAIL ' + s);
console.log(`L50: ${judged} launch(es) of ${dirs.length} run(s) judged, ${short.length} without their DLCs (a store miss or nothing mounted), ${declined.length} declined`);
process.exit(short.length ? 1 : 0);
