// analyse_weight_lever.mjs — did scaling a good's pop-need `weight` move its share of that need?
//
//   node tools/testbed/analyse_weight_lever.mjs --session tools/testbed/sessions/<stamp>_<label>
//        [--need popneed_luxury_items] [--treatment vanilla_x10]
//
// THE EXPERIMENT. `weight` is documented (a header comment in vanilla's own 00_pop_needs.txt) as the base
// weight a good gets inside a need, modulated by its share of market sell orders. Multiplying it ×10 in a
// treatment arm and comparing the WITHIN-NEED SHARE against a vanilla control says whether that field is
// the live lever the comment claims.
//
// ⭐ WHY WITHIN-NEED SHARE AND NOT UNITS. A share inside one need is robust to the two arms being
// different histories — different populations, different wealth, different everything — which is what
// makes n=1 per arm sufficient. Absolute units are not comparable across seeds and are not used here.
//
// ⭐ WHY popneed_luxury_items IS THE VENUE (FINDINGS F35). No pop need in the game has an observable
// budget — all 15 share at least one good with another need, and a shared good's measured spending cannot
// be attributed between them. `luxury_items` is the single exception while it lasts: silk, luxury_clothes,
// luxury_furniture and porcelain are each single-need and none is a `local` good, so the four of them ARE
// the need's whole measured money. radios join it later and are shared with `leisure`, so any date at
// which radios exist is excluded rather than silently biasing the denominator.
//
// ⚠ EVERY DUMP IS PARTIALLY TRUNCATED, at a different good (lib_breakdown rule 6). A date is scored ONLY
// if every good of the need was captured at that date — a partial denominator invents share movement out
// of nothing, which is exactly the artefact that once produced four phantom cap violations in F31.
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buyOrderTable, readBreakdown } from './lib_breakdown.mjs';
import { REPO } from '../econ_host.mjs';

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const SESSION   = argOf('--session', '');
const NEED      = argOf('--need', 'popneed_luxury_items');
const TREATMENT = argOf('--treatment', 'vanilla_x10');
const MARKET    = argOf('--market', 'British Market');   // '' = all. The campaigns' breakdown is GBR-only,
// so pinning to one market is what makes the two arms comparable at all.
if (!SESSION) { console.error('usage: analyse_weight_lever.mjs --session <dir> [--need N] [--treatment setup]'); process.exit(1); }
const SDIR = join(REPO, SESSION.replace(/^[.\\/]+/, ''));

// ---- the need's goods, read from the GAME rather than hardcoded, so a patch cannot silently rot this.
const GAME = process.env.VIC3_GAME || 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Victoria 3\\game';
const pnTxt = readFileSync(join(GAME, 'common', 'pop_needs', '00_pop_needs.txt'), 'utf8').replace(/^\uFEFF/, '');
const needs = {}; let cur = null;
for (const raw of pnTxt.split(/\r?\n/)) {
  const l = raw.trim(); let m;
  if ((m = l.match(/^(popneed_[a-z_]+)\s*=\s*\{/))) { cur = m[1]; needs[cur] = []; }
  else if ((m = l.match(/^goods\s*=\s*([a-z0-9_]+)/)) && cur) needs[cur].push(m[1]);
}
const GOODS = needs[NEED];
if (!GOODS) { console.error(`need ${NEED} not found`); process.exit(1); }
// Goods that do not exist early. A date where one is present is a date where the need's membership
// changed, so it is dropped rather than compared against dates where it was absent.
const LATE = new Set(['radios', 'telephones', 'automobiles', 'aeroplanes', 'steamers']);
const EARLY = GOODS.filter(g => !LATE.has(g));
console.log(`need ${NEED}`);
console.log(`  all goods   : ${GOODS.join(', ')}`);
console.log(`  market      : ${MARKET || "(all)"}`);
console.log(`  scored early: ${EARLY.join(', ')}   (a date is dropped if any of these is missing, or if a late good has appeared)`);

// ---- collect per (setup, date) shares
const runs = readdirSync(SDIR).filter(d => /^run\d+_/.test(d)).sort();
const perSetup = new Map();   // setup -> Map(date -> {good -> pop})
for (const r of runs) {
  const dir = join(SDIR, r);
  const metaP = join(dir, 'meta.json');
  if (!existsSync(metaP)) continue;
  const meta = JSON.parse(readFileSync(metaP, 'utf8'));
  const setup = r.replace(/^run\d+_/, '');
  const log = join(dir, 'logs_live', 'debug.log');
  if (!existsSync(log)) continue;
  const buyOf = await buyOrderTable(log, meta.token);
  const { blocks, stats } = await readBreakdown(log, meta.token, buyOf);
  if (!blocks.length) continue;
  console.error(`  ${r}: ${stats.ok} verified blocks (${stats.badTotal} total-mismatch, ${stats.noRef} no reference)`);
  if (!perSetup.has(setup)) perSetup.set(setup, new Map());
  const byDate = perSetup.get(setup);
  for (const b of blocks) {
    if (!GOODS.includes(b.good)) continue;
    if (MARKET && b.market !== MARKET) continue;
    // ⚠ KEY BY MARKET **AND** DATE. Keying by date alone silently merges different markets into one
    // cell — this session pools 14 single-market 1836 runs with the campaigns under the same setup
    // name, so a "date" would have held Belgian silk beside Japanese porcelain and the shares would
    // have been arithmetic on unrelated economies. Caught before publishing; the first run of this
    // script reported a control baseline built that way.
    const key = `${b.market}\t${b.date}`;
    if (!byDate.has(key)) byDate.set(key, {});
    // union across runs of the same arm; a good seen twice keeps the larger (truncation loses, never invents)
    const cell = byDate.get(key);
    cell[b.good] = Math.max(cell[b.good] ?? 0, b.pop);
  }
}

// ---- score only COMPLETE dates
const summary = new Map();    // setup -> {good -> [shares]}
for (const [setup, byDate] of perSetup) {
  const acc = {}; for (const g of EARLY) acc[g] = [];
  let complete = 0, partial = 0, lateSeen = 0;
  for (const [, cell] of [...byDate.entries()].sort()) {
    if (GOODS.some(g => LATE.has(g) && cell[g] != null && cell[g] > 0)) { lateSeen++; continue; }
    if (!EARLY.every(g => cell[g] != null)) { partial++; continue; }
    const tot = EARLY.reduce((s, g) => s + cell[g], 0);
    if (tot <= 0) { partial++; continue; }
    for (const g of EARLY) acc[g].push(100 * cell[g] / tot);
    complete++;
  }
  summary.set(setup, acc);
  console.log(`\n${setup}: ${complete} complete date(s) scored, ${partial} dropped as partial, ${lateSeen} dropped for a late good`);
}

const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const ctlName = [...summary.keys()].find(s => s !== TREATMENT);
console.log(`\n${'='.repeat(78)}\n  WITHIN-NEED SHARE, median across scored dates (%)\n${'='.repeat(78)}`);
if (!summary.has(TREATMENT) || !ctlName) { console.log('  need both arms to compare — one of them scored no complete date.'); process.exit(0); }
const rows = EARLY.map(g => {
  const c = med(summary.get(ctlName)[g]), t = med(summary.get(TREATMENT)[g]);
  return { good: g, control: c == null ? null : +c.toFixed(2), treatment: t == null ? null : +t.toFixed(2),
           delta: (c == null || t == null) ? null : +(t - c).toFixed(2),
           ratio: (c && t) ? +(t / c).toFixed(2) : null,
           n_ctl: summary.get(ctlName)[g].length, n_trt: summary.get(TREATMENT)[g].length };
});
console.table(rows);
console.log(`  control arm = ${ctlName}   treatment arm = ${TREATMENT}`);
console.log(`\n  ⚠ Read the SHARE, not the units: the two arms are different histories, so only a ratio inside`);
console.log(`     one need is comparable. ⚠ A date counts only when every scored good was captured.`);
