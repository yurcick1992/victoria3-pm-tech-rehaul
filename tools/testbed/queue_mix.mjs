// queue_mix.mjs — THE CONSTRUCTION-MIX REASONABILITY CHECK (user-directed 2026-08-16, after F66).
//
// For select majors separately and the world as a whole: the distribution of what got built —
// private queue and government queue separately — must be REASONABLE. A single building family
// dominating a major's queue is a red flag that can invalidate a run: F66's founding case is the
// port spam, where GBR's private queue read 100% `port_steam` for five straight years in EVERY
// arm (mandate or not) and nobody looked until 1855.
//
// Part of the ~5-minute smoke check (CLAUDE.md): run it against the run's save_summaries as soon
// as the concurrent harvest lands the first one (~10 min for the 1837 autosave), and again at any
// later point. It reads v5+ summaries (the `queues` block); older summaries have no queues and are
// reported as such rather than passing silently.
//
//   node tools/testbed/queue_mix.mjs <runDir|summariesDir> [--tags GBR,FRA,RUS,USA,PRU,AUS]
//        [--all]            read every summary (default: the NEWEST only)
//        [--warn-share 0.6] family-dominance threshold (of a queue with >= --warn-min items)
//        [--warn-min 3]
//
// A "family" is the building key with tier suffixes collapsed (building_port_steam -> port,
// building_tooling_workshop_steel -> tooling_workshop): the spam presents per-tier, the concern
// is per-family. Exit code 1 when any WARN fired, 0 otherwise — so a script can gate on it, while
// a human run just reads the lines.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

const args = process.argv.slice(2);
const root = args.find(a => !a.startsWith('--'));
if (!root) { console.error('usage: node queue_mix.mjs <runDir|summariesDir> [--tags A,B] [--all]'); process.exit(2); }
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const TAGS = opt('--tags', 'GBR,FRA,RUS,USA,PRU,AUS').split(',').filter(Boolean);
const ALL = args.includes('--all');
const WARN_SHARE = +opt('--warn-share', 0.6);
const WARN_MIN = +opt('--warn-min', 3);

const dir = existsSync(join(root, 'save_summaries')) ? join(root, 'save_summaries') : root;
const files = readdirSync(dir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort();
if (!files.length) { console.error(`no save summaries under ${dir} — nothing to check yet`); process.exit(2); }
const picked = ALL ? files : [files[files.length - 1]];

// tier suffixes collapse to the vanilla-ish family; keep this dumb and transparent
const family = k => k.replace(/^building_/, '')
  .replace(/_(steam|industrial|modern|motor|electric|steel|pig_iron|excavators|tracer|bessemer|leaded|metal.*|arc_welding|complex|sulfite|mechanised.*|automated.*|electrified.*|pulverized|oil_fired|turbine|steel_hull)$/,'');

let warned = false;
const report = (label, agg) => {
  for (const side of ['private', 'government']) {
    const m = agg[side]; const tot = Object.values(m).reduce((a, b) => a + b, 0);
    if (!tot) { console.log(`  ${label} ${side}: (empty)`); continue; }
    const fams = {};
    for (const [k, n] of Object.entries(m)) fams[family(k)] = (fams[family(k)] || 0) + n;
    const top = Object.entries(fams).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([f, n]) => `${f} ${n} (${Math.round(100 * n / tot)}%)`).join(' · ');
    console.log(`  ${label} ${side}: ${tot} item(s) — ${top}`);
    const [f0, n0] = Object.entries(fams).sort((a, b) => b[1] - a[1])[0];
    if (tot >= WARN_MIN && n0 / tot >= WARN_SHARE) {
      console.log(`  ⚠ WARN ${label} ${side}: family '${f0}' holds ${Math.round(100 * n0 / tot)}% of the queue — construction-mix red flag (F66); check before trusting the run`);
      warned = true;
    }
  }
};

for (const f of picked) {
  const s = JSON.parse(gunzipSync(readFileSync(join(dir, f))));
  const date = (s.world && s.world.date) || f;
  console.log(`=== ${f} (${date})`);
  if (s.save_summary_version == null || s.save_summary_version < 5) {
    console.log('  summary predates v5 — no queue data; this check cannot run'); continue;
  }
  const world = { private: {}, government: {} };
  for (const [tag, c] of Object.entries(s.countries || {})) {
    for (const side of ['private', 'government']) {
      const bt = c.queues && c.queues[side] && c.queues[side].by_type || {};
      for (const [k, v] of Object.entries(bt)) world[side][k] = (world[side][k] || 0) + (v.n || 0);
    }
  }
  for (const tag of TAGS) {
    const c = (s.countries || {})[tag]; if (!c) continue;
    const agg = { private: {}, government: {} };
    for (const side of ['private', 'government']) {
      const bt = c.queues && c.queues[side] && c.queues[side].by_type || {};
      for (const [k, v] of Object.entries(bt)) agg[side][k] = (v.n || 0);
    }
    report(tag, agg);
  }
  report('WORLD', world);
}
process.exit(warned ? 1 : 0);
