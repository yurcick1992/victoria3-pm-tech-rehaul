// IS ANYTHING DEAD, AND IS ANY MARKET LEFT WITH A TOKEN? — an arm's save summaries at one date against a reference's (user-asked
// 2026-10-01 for the craft probe: "check that no industries are completely dead, and no market that has some goods produced in canon
// is left with only a token amount").
//
//   node tools/testbed/ledger/health_vs_ref.mjs --arm <session>[:<setup>] --ref <session>[:<setup>] [--ref …] [--date 1846.1.1]
//        [--dead 0.10] [--token 0.20] [--min-levels 5] [--min-qty 5] [--min-share 0.02]
//
// 1. INDUSTRIES: world STAFFED levels per building type. A type is DEAD when the reference's median holds ≥ --min-levels staffed and every
//    arm run holds under --dead × that median. A merged rung (`method_of`, §10.91.2) is no building type in the arm, so each merged key is
//    folded into its host on BOTH sides (the arm's own `_merge.pairs`), and so is the rung's staffing.
// 2. MARKETS: per market and good, the members' summed `goods_out` (weekly units produced by buildings). A market is named by its
//    largest-GDP member (market ids are save-internal and differ by seed). A cell is a TOKEN when the reference median produces
//    ≥ --min-qty units AND ≥ --min-share of that market's reference production of the good's … no: of the WORLD's reference production
//    of the good, and every arm run produces under --token × that median AND under half the reference minimum (so a seed's own spread
//    does not flag). Markets present in every arm run and in at least half the reference runs only.
// ⚠ One date: a reading, not a path. ⚠ Territory moves between seeds, so a market's size moves too — the reference MINIMUM guard is
//   what keeps a seed-level difference from reading as a design one.
import zlib from 'node:zlib'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const args = process.argv.slice(2);
const all = n => args.flatMap((a, i) => a === n && args[i + 1] ? [args[i + 1]] : []);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const DATE = argOf('--date', '1846.1.1');
const DEAD = +argOf('--dead', '0.10'), TOKEN = +argOf('--token', '0.20');
const MINLV = +argOf('--min-levels', '5'), MINQ = +argOf('--min-qty', '5'), MINSH = +argOf('--min-share', '0.02');
const ARMS = all('--arm'), REFS = all('--ref');
if (!ARMS.length || !REFS.length) { console.error('usage: health_vs_ref.mjs --arm <session>[:<setup>] --ref <session>[:<setup>] [--date 1846.1.1]'); process.exit(2); }
const SESS = path.join(REPO, 'tools', 'testbed', 'sessions');

function runs(spec) {
  const [s, setup] = spec.split(':');
  const dir = fs.readdirSync(SESS).find(d => d === s || d.startsWith(s + '_'));
  if (!dir) throw new Error(`no session ${s}`);
  const out = [];
  for (const r of fs.readdirSync(path.join(SESS, dir)).filter(d => /^run\d+/.test(d) && (!setup || d.endsWith('_' + setup)))) {
    const sd = path.join(SESS, dir, r, 'save_summaries'); if (!fs.existsSync(sd)) continue;
    for (const f of fs.readdirSync(sd).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort()) {
      const j = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(sd, f))));
      if (j.provenance.date === DATE) { out.push({ name: `${dir.slice(0, 15)}/${r}`, j }); break; }
    }
  }
  if (!out.length) console.error(`WARN: no summary at ${DATE} in ${spec}`);
  return out;
}
const arm = ARMS.flatMap(runs), ref = REFS.flatMap(runs);
// the arm's merges: added rung key -> host key
const fold = new Map();
for (const r of arm) {
  const cfgPath = r.j.provenance.built_from_config; if (!cfgPath || !fs.existsSync(cfgPath)) continue;
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  for (const p of Object.values(cfg._merge?.pairs ?? {})) fold.set(p.added, p.host);
}
const K = k => fold.get(k) ?? k;
const med = v => { const s = [...v].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };

// ---- 1. industries
const staffed = j => { const m = {}; for (const c of Object.values(j.countries)) for (const [k, b] of Object.entries(c.buildings || {})) m[K(k)] = (m[K(k)] || 0) + (b.staffing || 0); return m; };
const aS = arm.map(r => staffed(r.j)), rS = ref.map(r => staffed(r.j));
const types = new Set([...aS, ...rS].flatMap(Object.keys));
const rows = [];
for (const t of types) {
  const rv = rS.map(m => m[t] || 0), av = aS.map(m => m[t] || 0), rm = med(rv);
  if (rm < MINLV) continue;
  rows.push({ t, rm, rmin: Math.min(...rv), av, ratio: Math.max(...av) / rm, dead: Math.max(...av) < DEAD * rm && Math.max(...av) < 0.5 * Math.min(...rv) });
}
rows.sort((a, b) => a.ratio - b.ratio);
console.log(`\n1. INDUSTRIES at ${DATE} — world staffed levels, arm (${arm.map(r => r.name).join(', ')}) vs the reference median of ${ref.length} (${[...new Set(ref.map(r => r.name.slice(0, 15)))].join(', ')})`);
console.log(`   DEAD = every arm run under ${DEAD} of the reference median AND under half its minimum (types the reference staffs ≥ ${MINLV} levels). The 15 lowest ratios:`);
for (const r of rows.slice(0, 15)) console.log(`   ${r.dead ? "DEAD " : "     "}${r.t.padEnd(52)} ref med ${r.rm.toFixed(1).padStart(8)} (min ${r.rmin.toFixed(1)})  arm ${r.av.map(x => x.toFixed(1)).join(' / ').padStart(16)}  ×${r.ratio.toFixed(2)}`);
const dead = rows.filter(r => r.dead);
console.log(`   → ${dead.length} dead of ${rows.length} types${dead.length ? ': ' + dead.map(r => r.t).join(', ') : ''}`);

// ---- 2. markets
const markets = j => {
  const byId = new Map();
  for (const [k, c] of Object.entries(j.countries)) { if (c.market == null) continue; (byId.get(c.market) ?? byId.set(c.market, []).get(c.market)).push([k, c]); }
  const out = {};
  for (const mem of byId.values()) {
    const lead = mem.reduce((b, x) => (x[1].gdp || 0) > (b[1].gdp || 0) ? x : b)[0].split('@')[0];
    const g = out[lead] ??= {};
    for (const [, c] of mem) for (const [good, q] of Object.entries(c.goods_out || {})) g[good] = (g[good] || 0) + q;
  }
  return out;
};
const aM = arm.map(r => markets(r.j)), rM = ref.map(r => markets(r.j));
const world = ms => { const w = {}; for (const m of ms) for (const g of Object.values(m)) for (const [k, q] of Object.entries(g)) w[k] = (w[k] || 0) + q / ms.length; return w; };
const rW = world(rM);
const cand = [];
const leads = new Set(rM.flatMap(Object.keys));
for (const L of leads) {
  if (!aM.every(m => m[L])) continue;
  const present = rM.filter(m => m[L]); if (present.length < rM.length / 2) continue;
  const goods = new Set(present.flatMap(m => Object.keys(m[L])));
  for (const g of goods) {
    const rv = present.map(m => m[L][g] || 0), rm = med(rv), av = aM.map(m => m[L][g] || 0);
    if (rm < MINQ || rm < MINSH * (rW[g] || Infinity)) continue;
    cand.push({ L, g, rm, rmin: Math.min(...rv), av, ratio: Math.max(...av) / rm, token: Math.max(...av) < TOKEN * rm && Math.max(...av) < 0.5 * Math.min(...rv) });
  }
}
cand.sort((a, b) => a.ratio - b.ratio);
console.log(`\n2. MARKETS at ${DATE} — goods produced by the market's members (weekly units), markets present in every arm run; cells the reference median`);
console.log(`   produces ≥ ${MINQ} units and ≥ ${MINSH * 100}% of the world's. TOKEN = every arm run under ${TOKEN} of the reference median AND under half its minimum. The 25 lowest:`);
for (const c of cand.slice(0, 25)) console.log(`   ${c.token ? 'TOKEN ' : '      '}${c.L.padEnd(5)} ${c.g.padEnd(18)} ref med ${c.rm.toFixed(0).padStart(7)} (min ${c.rmin.toFixed(0)})  arm ${c.av.map(x => x.toFixed(0)).join(' / ').padStart(14)}  ×${c.ratio.toFixed(2)}`);
const tok = cand.filter(c => c.token);
console.log(`   → ${tok.length} token cells of ${cand.length}${tok.length ? ': ' + tok.map(c => `${c.L} ${c.g}`).join(', ') : ''}`);
