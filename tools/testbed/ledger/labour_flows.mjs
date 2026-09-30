// WHERE DID EACH SECTOR'S HIRES COME FROM? — the labour-flow matrix of one save, from the buildings' own transfer logs (FINDINGS F188).
//
//   node tools/testbed/ledger/labour_flows.mjs <save.v3> --mod <the book's emitted mod dir> [--book <config.json>]
//
// Every building record carries `employee_transfers`, its recent job moves. In the log of a building of type K (verified record by record,
// 2026-09-30 — new=K & old=K's own type never both unless it is a re-typing):
//   new=K, no old          a hire FROM UNEMPLOYMENT
//   old=X, new=K           a hire FROM building type X (the same move also sits in X's log as old=X, new=K)
//   old=K, no new          a layoff INTO UNEMPLOYMENT
//   old=K, new=Y           a departure to Y (counted in Y's log, as its hire)
//   old=K, new=K           a re-typing inside the building type (slaves → laborers, farmers → slaves …)
// Each move is counted ONCE, on the hiring side (and layoffs on the laying-off side), weighted by `transfer_total`. The log is a snapshot of
// RECENT moves, not a stock — read shares, not totals. Sectors as hiring_census.mjs: the book's crafts and tiered rungs (by ERA), then
// vanilla's building-group tree.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const GAME = argOf('--game', process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game');
const SAVE = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const MOD = argOf('--mod', null);
if (!SAVE || !MOD) { console.error('usage: node tools/testbed/ledger/labour_flows.mjs <save.v3> --mod <emitted mod dir> [--book <config>]'); process.exit(2); }
let BOOK = argOf('--book', null);
if (!BOOK) { const bs = join(dirname(dirname(resolve(SAVE))), 'build_state.json'); if (existsSync(bs)) BOOK = JSON.parse(readFileSync(bs, 'utf8')).deterministic?.mod_under_test?.built_from_config; }
if (!BOOK || !existsSync(BOOK)) throw new Error(`labour_flows: no book (pass --book; the save's run folder names none readable: ${BOOK})`);
const strip = s => s.replace(/^\uFEFF/, ''), braces = t => (t.match(/\{/g) || []).length - (t.match(/\}/g) || []).length;
const layered = sub => { const v = join(GAME, sub), m = join(MOD, sub), mf = existsSync(m) ? readdirSync(m).filter(x => x.endsWith('.txt')) : []; const skip = new Set(mf); return [...readdirSync(v).filter(x => x.endsWith('.txt') && !skip.has(x)).map(x => join(v, x)), ...mf.map(x => join(m, x))]; };
const GROUP = {}, PARENT = {};
for (const f of layered('common/buildings')) { let cur = null, depth = 0; for (const raw of strip(readFileSync(f, 'utf8')).split(/\r?\n/)) { const t = raw.replace(/#.*$/, ''); if (depth === 0) { const mm = /^([a-z_0-9]+)\s*=\s*\{/.exec(t.trim()); if (mm) cur = mm[1]; } else if (cur && depth === 1) { const mm = /^\s*building_group\s*=\s*(\S+)/.exec(t); if (mm && !GROUP[cur]) GROUP[cur] = mm[1]; } depth += braces(t); if (depth <= 0) { depth = 0; cur = null; } } }
for (const f of layered('common/building_groups')) { let cur = null, depth = 0; for (const raw of strip(readFileSync(f, 'utf8')).split(/\r?\n/)) { const t = raw.replace(/#.*$/, ''); if (depth === 0) { const mm = /^(bg_[a-z_0-9]+)\s*=\s*\{/.exec(t.trim()); if (mm) { cur = mm[1]; if (!(cur in PARENT)) PARENT[cur] = null; } } else if (cur && depth === 1) { const mm = /^\s*parent_group\s*=\s*(\S+)/.exec(t); if (mm) PARENT[cur] = mm[1]; } depth += braces(t); if (depth <= 0) { depth = 0; cur = null; } } }
const book = JSON.parse(readFileSync(BOOK, 'utf8'));
const TIER = {};
for (const ind of book.industries || []) { if (ind.disabled) continue; for (const t of ind.tiers || []) if (!t.method_of) TIER[t.key] = { era: t.era ?? 0, craft: !!t.craft }; }
const SG = { bg_subsistence_agriculture: 'subsistence', bg_subsistence_ranching: 'subsistence', bg_service: 'urban', bg_owner_buildings: 'owners', bg_construction: 'construction', bg_military: 'military', bg_government: 'government', bg_staple_crops: 'agriculture', bg_agriculture: 'agriculture', bg_plantations: 'plantations', bg_ranching: 'ranching', bg_extraction: 'extraction', bg_private_infrastructure: 'infrastructure', bg_power: 'infrastructure', bg_public_infrastructure: 'infrastructure', bg_canals: 'infrastructure', bg_light_industry: 'light industry (untiered)', bg_manufacturing: 'manufacturing (untiered)', bg_urban_facilities: 'urban', bg_monuments: 'monuments', bg_monuments_hidden: 'monuments' };
const sec = key => { if (!key) return 'UNEMPLOYED'; const t = TIER[key]; if (t) return t.craft ? 'crafts' : `tiered e${t.era}`; if (/^building_(regional_)?company_/.test(key)) return 'owners'; for (let g = GROUP[key], h = 0; g && h < 12; g = PARENT[g], h++) if (SG[g]) return SG[g]; return 'other'; };

const rak = spawn(join(REPO, 'tools/vendor/rakaly/rakaly.exe'), ['melt', '--format', 'vic3', '--unknown-key', 'stringify', '-c', SAVE]);
let rakErr = ''; rak.stderr.on('data', x => { rakErr += x; });
const rl = createInterface({ input: rak.stdout, crlfDelay: Infinity });
let b = false, key = null, t = false, rec = null, date = null, records = 0;
const IN = {}, LAYOFF = {}, PAIRS = {};   // IN[dest][src] = Σ transfer_total; LAYOFF[src]; PAIRS[dest] = {"type→type from source": Σ}
for await (const l of rl) {
  if (!date) { const m = /^date=(\d+\.\d+\.\d+)/.exec(l); if (m) date = m[1]; }
  if (!b) { if (l === 'building_manager={') b = true; continue; }
  if (l === '}') break;
  let m;
  if ((m = /^\t\t\tbuilding="([^"]+)"$/.exec(l))) key = m[1];
  else if (l === '\t\t\temployee_transfers={') t = true;
  else if (t && l === '\t\t\t}') t = false;
  else if (t && l === '\t\t\t\t{') rec = { v: 0 };
  else if (t && l === '\t\t\t\t}' && rec) {
    records++;
    const o = rec.old, n = rec.new;
    if (n === key && o !== key) {
      const d = sec(key), s = sec(o);
      (IN[d] ||= {})[s] = (IN[d][s] || 0) + rec.v;
      const pk = `${rec.ot}→${rec.nt} from ${o ? o.replace(/^building_/, '') : 'unemployment'}`; (PAIRS[d] ||= {})[pk] = (PAIRS[d][pk] || 0) + rec.v;
    } else if (o === key && n === undefined) { const s = sec(key); LAYOFF[s] = (LAYOFF[s] || 0) + rec.v; }
    rec = null;
  } else if (t && rec && (m = /^\t\t\t\t\t(old_employment|new_employment|old_pop_type|new_pop_type|transfer_total)="?([^"]*)"?$/.exec(l))) {
    if (m[1] === 'old_employment') rec.old = m[2]; else if (m[1] === 'new_employment') rec.new = m[2]; else if (m[1] === 'old_pop_type') rec.ot = m[2]; else if (m[1] === 'new_pop_type') rec.nt = m[2]; else rec.v = +m[2];
  }
}
rak.kill();
if (!records) throw new Error(`labour_flows: no transfer records read (${rakErr.slice(0, 200)}) — the melt's layout moved?`);
const tot = o => Object.values(o).reduce((a, v) => a + v, 0);
const all = Object.values(IN).reduce((a, o) => a + tot(o), 0);
const pc = (a, b) => (100 * a / b).toFixed(b && a / b < 0.1 ? 1 : 0) + '%';
console.log(`${date} — ${SAVE} (${records} transfer records)\nHIRES by destination sector (share of all hires in the logs), and where each sector's hires came from:`);
for (const [d, o] of Object.entries(IN).sort((a, b) => tot(b[1]) - tot(a[1]))) {
  const T = tot(o);
  console.log(`  ${d.padEnd(26)} ${pc(T, all).padStart(6)} of hires — from ` + Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([s, v]) => `${s} ${pc(v, T)}`).join(', '));
}
console.log(`\nFROM OTHER WORKING BUILDINGS (not unemployment, subsistence or the sector itself), per destination: ` +
  Object.entries(IN).map(([d, o]) => [d, Object.entries(o).filter(([s]) => !['UNEMPLOYED', 'subsistence', d].includes(s)).reduce((a, [, v]) => a + v, 0) / tot(o)]).sort((a, b) => b[1] - a[1]).map(([d, v]) => `${d} ${(100 * v).toFixed(0)}%`).join(' · '));
const out = {}; for (const [d, o] of Object.entries(IN)) for (const [s, v] of Object.entries(o)) if (s !== d) out[s] = (out[s] || 0) + v;
console.log(`AS A SOURCE: each sector's workers leaving for another sector's jobs, share of all hires: ` + Object.entries(out).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([s, v]) => `${s} ${pc(v, all)}`).join(' · '));
console.log(`LAYOFFS into unemployment by sector (share of all layoffs): ` + Object.entries(LAYOFF).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([s, v]) => `${s} ${pc(v, tot(LAYOFF))}`).join(' · '));
if (PAIRS.crafts) console.log(`the crafts' hires by pop type and source (top 8): ` + Object.entries(PAIRS.crafts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${pc(v, tot(PAIRS.crafts))}`).join(' · '));
