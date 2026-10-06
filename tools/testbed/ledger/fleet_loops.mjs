// FLEETS STUCK ON A REPAIR LOOP, OUT OF ONE SAVE (2026-10-06, FINDINGS F218 — the cause of most mid-game slowdown episodes).
// A fleet flagged `is_recalled_for_repairs` can sail back and forth near its home port for decades; the engine APPENDS each new leg
// to the same travel path instead of replacing it, so the path grows ~250–300 moves a year and the tick cost grows with it (two US
// torpedo-boat loops of 4,559 and 4,349 moves cost run 3 of 20261005_154629 ~+500 s per in-game year by 1902). It is VANILLA's
// behaviour (3 of 30 vanilla endpoints carry one, 14 of 258 mod endpoints).
//
//   node tools/testbed/ledger/fleet_loops.mjs <save.v3> [<save.v3> …] [--min 200] [--json]
//
// Streams the save through rakaly (nothing written to disk) and prints every formation whose travel path holds ≥ --min moves:
// owner tag, country id (and its index mod 4 → the sub-tick the loop's cost lands in besides hour 0, F218 §8: ≡ 1 → hour 6 (USA, Siam,
// Brazil), ≡ 0 → hour 12 (Bulgaria, Sicily, Greece), ≡ 2 → hour 0 ONLY (Portugal, Norway — invisible to the disqualification test),
// ≡ 3 → hour 18 presumed, no costly case seen), type, the recall flag, creation date, its ships (type@hit points), the path's move
// count, current_move, the distance it has sailed (total_distance_progress — the cost tracks THIS, not the move count: ≲ 125k costs
// 0–10 s a year, ~150–200k 20–30 s, ~470k 100–200 s) and the repair target state.
// ⚠ Only the travel path is counted; the supply paths (`full_supply_path`, `naval_supply_path`) are separate blocks and skipped.
// ⚠ A save KEPT by the harvester is each run's newest (its 1936 endpoint): a loop that ended earlier is gone from it — read the run's
//   sub-tick profile (tick_profile.mjs) for the history.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const RAK = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'vendor', 'rakaly', 'rakaly.exe');
const args = process.argv.slice(2);
const MIN = (() => { const i = args.indexOf('--min'); return i >= 0 ? +args[i + 1] : 200; })();
const files = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--min');
if (!files.length) { console.error('usage: fleet_loops.mjs <save.v3> [...] [--min 200] [--json]'); process.exit(2); }

async function scan(file) {
  const p = spawn(RAK, ['melt', '--format', 'vic3', '--unknown-key', 'stringify', '-c', file], { stdio: ['ignore', 'pipe', 'inherit'] });
  const rl = createInterface({ input: p.stdout, crlfDelay: Infinity });
  let sec = null, depth = 0, date = null, key = null, f = null, ship = null, inTravel = false, inTarget = false;
  const tag = {}, stRegion = {}, stTpl = {}, tpl = {}, stGone = {}, F = [], ships = {};
  for await (const line of rl) {
    if (depth === 0) { const m = /^(\w+)=/.exec(line); sec = m ? m[1] : null; if (sec === 'date') date = line.slice(5); }
    if (depth === 2) { const m = /^\t\t(\d+)=\{/.exec(line); key = m ? m[1] : null; if (!m && sec === 'states') { const g = /^\t\t(\d+)=none/.exec(line); if (g) stGone[g[1]] = true; } }
    if (key && depth === 3) {
      let m;
      if (sec === 'country_manager' && (m = /^\t\t\tdefinition="(\w+)"/.exec(line))) tag[key] = m[1];
      else if (sec === 'states' && (m = /^\t\t\tregion="(\w+)"/.exec(line))) stTpl[key] = m[1];
      else if (sec === 'state_region_manager' && (m = /^\t\t\ttemplate="(\w+)"/.exec(line))) tpl[key] = m[1];
    }
    // the state's region index sits at depth 3 or 4 depending on the save version: take the first one inside the state's block
    if (key && depth >= 3 && sec === 'states' && !stRegion[key]) { const m = /^\t+state_region=(\d+)/.exec(line); if (m) stRegion[key] = m[1]; }
    if (sec === 'military_formation_manager') {
      if (depth === 2 && key) { f = { id: key, country: '', type: '', created: '', recalled: false, moves: 0, cur: null, dist: null, target: null }; F.push(f); inTravel = false; inTarget = false; }
      if (f && depth === 3) {
        let m;
        if ((m = /^\t\t\tcountry=(\d+)/.exec(line))) f.country = m[1];
        else if ((m = /^\t\t\ttype=(\w+)/.exec(line))) f.type = m[1];
        else if ((m = /^\t\t\tcreation_date=(\S+)/.exec(line))) f.created = m[1];
        else if (/^\t\t\tis_recalled_for_repairs=yes/.test(line)) f.recalled = true;
        else if (/^\t\t\ttravel_progress=/.test(line)) inTravel = true;
        else if (/^\t\t\t(full_supply_path|naval_supply_path)=/.test(line)) inTravel = false;
        else if (/^\t\t\ttarget_location=/.test(line)) inTarget = true;
      }
      // ⚠ the target is TYPED (state / military_formation / front / prov): the Norwegian loops of vanilla n=16 run 11 target FORMATION 202, which
      //   F218 first read as "state 202, no longer exists" (2026-10-06)
      if (f && inTarget) { const ty = /^\t+type=(\w+)/.exec(line); if (ty) f.ttype = ty[1]; const m = /identity=(\d+)/.exec(line); if (m) { f.target = m[1]; inTarget = false; } }
      if (f && inTravel) {
        if (/^\t+to_node=/.test(line)) f.moves++;
        let m;
        if ((m = /^\t\t\t\tcurrent_move=(\d+)/.exec(line))) f.cur = +m[1];
        else if ((m = /^\t\t\t\ttotal_distance_progress=([\d.]+)/.exec(line))) f.dist = +m[1];
      }
    }
    if (sec === 'ship_manager') {
      if (depth === 2 && key) ship = { def: '', hp: null, fleet: null };
      if (ship && depth === 3) { let m; if ((m = /^\t\t\tfleet=(\d+)/.exec(line))) ship.fleet = m[1]; else if ((m = /^\t\t\thit_points=([\d.]+)/.exec(line))) ship.hp = +m[1]; }
      if (ship && !ship.def) { const m = /definition="([^"]+)"/.exec(line); if (m) ship.def = m[1]; }
    }
    for (let i = 0; i < line.length; i++) { const c = line.charCodeAt(i); if (c === 123) depth++; else if (c === 125) depth--; }
    if (depth <= 2) {
      if (sec === 'military_formation_manager' && f && depth <= 1) f = null;
      if (sec === 'ship_manager' && ship) { if (ship.fleet) (ships[ship.fleet] ||= []).push(`${ship.def.replace(/^ship_names_historical_|^shipname_fallback_(ordinal_)?/, '')}@${Math.round(ship.hp)}`); ship = null; }
    }
  }
  const out = F.filter(x => x.moves >= MIN).sort((a, b) => b.moves - a.moves).map(x => {
    const idx = (+x.country) & 0xFFFFFF;
    return { tag: tag[x.country] || x.country, country_id: +x.country, bucket: idx % 4, hour: [12, 6, 0, 18][idx % 4], type: x.type, recalled: x.recalled, created: x.created,
      ships: ships[x.id] || [], path_moves: x.moves, current_move: x.cur, distance_sailed: x.dist == null ? null : Math.round(x.dist),
      target_type: x.ttype ?? null, target_state: x.ttype === 'state' ? x.target : null, target_id: x.target,
      target_region: x.ttype !== 'state' ? (x.target ? `${x.ttype} ${x.target}` : null)
        : x.target ? (stTpl[x.target] || tpl[stRegion[x.target]] || (stGone[x.target] ? 'STATE NO LONGER EXISTS' : null)) : null };
  });
  return { file, date, formations: F.length, loops: out };
}

const res = [];
for (const file of files) res.push(await scan(file));
if (args.includes('--json')) console.log(JSON.stringify(res, null, 1));
else for (const r of res) {
  console.log(`${r.file}\n  date ${r.date} · ${r.formations} formations · ${r.loops.length} with ≥ ${MIN} path moves`);
  for (const l of r.loops) console.log(`   ${l.tag} (id ${l.country_id}, bucket ${l.bucket} → hour ${l.hour}${l.bucket === 3 ? '?' : ''}) ${l.type}${l.recalled ? ' RECALLED-FOR-REPAIRS' : ''} created ${l.created} · ${l.path_moves} moves (at ${l.current_move}) · sailed ${l.distance_sailed} · target ${l.target_region || l.target_state} · ships ${l.ships.join(', ') || '—'}`);
}
