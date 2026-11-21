// THE DEPOSITS' 1836 START: THE PAIR — tier 0 beside every tier 1 on the 1836 map (BALANCE_FRAMEWORK §10.126, user-ruled 2026-11-21).
//
//   node tools/emit_deposit_start.mjs <mod dir> <config>        (build.ps1 runs it after convert_history.ps1, before emit_deposit_slots.mjs)
//
// The ruling: a country whose 1836 deposit runs on the second map rung (the atmospheric pump, sailing trawlers, wooden whaling ships) works
// its easier ground too — the first rung (picks and shovels, simple fishing, shore whaling) gets the SAME number of levels — and the
// country's 1836 supply of the good stays vanilla's. The recipes do not move: the pair is sized instead. A building of N levels on the second
// rung becomes k levels on each of the two, with k = N × V1 ÷ (V0 + V1), V the rung's output value at base prices (⅔ for the mines, fishing
// and whaling, coal 40 ÷ 65 = 0.615, gold 15 ÷ 23), so k × (q0 + q1) = N × q1. Rounding: each building at least 1 and at most N, the floor of
// N × share otherwise, then the country's buildings of that deposit take the remainder by largest fraction until the country's total
// reaches round(ΣN × share). Workers rise by 2k ÷ N (about a third, §10.126 records the reading); the second rung's inputs fall to k ÷ N.
//
// What it writes: the converted history (common/history/buildings/*.txt, convert_history.ps1's output) in place — the second-rung block's
// ownership levels re-allocated to k (largest remainder over its owners, an owner left at 0 dropped), and right after it a twin block for
// the first rung: the same text with the rung key and the main method replaced (a building that owns itself — `type = <its own key>` —
// owns itself on the twin too). Every method the twin activates must belong to one of the first rung's groups (the engine rejects a whole
// history block naming a method its building lacks, CLAUDE.md §5.4): checked against the emitted building and its groups, the build stops
// otherwise. A state that already holds the first rung of the same deposit is not designed for (vanilla has one building of a type per
// state; the conversion keeps that) and stops the build.
// Prints every country and deposit it changed, its supply against the converted map's, and every building the floor of 1 lifted.
// A book without `_deposits`, or whose `_deposits.start_1836` is not 'pair', is left as converted (the tool says so).
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const MOD = process.argv[2] || 'mod';
const CFGP = process.argv[3] || 'config/mod_config.json';
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const rd = p => readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const die = m => { throw new Error('emit_deposit_start: ' + m); };
const cfg = JSON.parse(rd(CFGP));
const D = cfg._deposits;
if (!D) { console.log('emit_deposit_start: the book carries no _deposits record — the 1836 start is left as converted'); process.exit(0); }
if (D.start_1836 !== 'pair') { console.log(`emit_deposit_start: _deposits.start_1836 is ${JSON.stringify(D.start_1836 ?? null)}, not 'pair' — the 1836 start is left as converted`); process.exit(0); }

// ---- prices and the pairs --------------------------------------------------------------------------------------------------------------
const PRICE = {}; for (const l of rd(join(REPO, 'tools/goods_prices.tsv')).split(/\r?\n/)) { const m = l.trim().split(/\t|\s+/); if (m.length >= 2 && +m[1] > 0) PRICE[m[0]] = +m[1]; }
const valueOf = t => { const o = { [t.output_good]: t.output_qty, ...(t.extra_outputs || {}) }; let v = 0;
  for (const [g, q] of Object.entries(o)) { if (!(PRICE[g] > 0)) die(`no base price for ${g}`); v += q * PRICE[g]; } return v; };
const PAIR = {};   // second-rung key -> { id, k0 (first-rung key), pm0, pm1, share, q0, q1 }
for (const ind of cfg.industries.filter(i => i.deposit && !i.disabled)) {
  const R = D.industries[ind.id]; if (!R) die(`${ind.id} has no _deposits record`);
  if (R.map_rungs !== 2) continue;   // oil: one map rung, nothing on the 1836 map
  const [t0, t1] = ind.tiers.slice().sort((a, b) => a.era - b.era);
  const v0 = valueOf(t0), v1 = valueOf(t1);
  PAIR[t1.key] = { id: ind.id, k0: t0.key, k1: t1.key, pm0: t0.pm_key, pm1: t1.pm_key, share: v1 / (v0 + v1), v0, v1 };
}
if (!Object.keys(PAIR).length) die('no deposit has two map rungs — nothing to pair, but start_1836 says pair');

// ---- what the first rung may activate: its groups' methods, from the emitted mod first, else the game ----------------------------------
function topBlock(dirs, key) {   // the text of `key = { … }` at the top level of any .txt in dirs (the mod's first)
  const re = new RegExp('(^|\\n)\\s*' + key + '\\s*=\\s*\\{');
  for (const d of dirs) { if (!existsSync(d)) continue;
    for (const f of readdirSync(d).filter(n => n.endsWith('.txt')).sort().reverse()) {   // later files win in the engine: read them first
      const t = rd(join(d, f)).replace(/#[^\n]*/g, ''); const m = re.exec(t); if (!m) continue;
      let i = m.index + m[0].length, e = 1; const s = i; while (i < t.length && e > 0) { if (t[i] === '{') e++; else if (t[i] === '}') e--; i++; }
      return t.slice(s, i - 1); } }
  return null;
}
const listIn = (b, k) => { const m = (b || '').match(new RegExp('(^|\\s)' + k + '\\s*=\\s*\\{([^}]*)\\}')); return m ? m[2].trim().split(/\s+/).map(s => s.replace(/"/g, '')).filter(Boolean) : []; };
const ALLOWED = {};
for (const p of Object.values(PAIR)) {
  const b = topBlock([join(MOD, 'common/buildings'), join(GAME, 'common/buildings')], p.k0) || die(`no building block for ${p.k0}`);
  const groups = listIn(b, 'production_method_groups'); if (!groups.length) die(`${p.k0}: no production_method_groups`);
  ALLOWED[p.k0] = new Set(groups.flatMap(g => listIn(topBlock([join(MOD, 'common/production_method_groups'), join(GAME, 'common/production_method_groups')], g) || die(`no group ${g}`), 'production_methods')));
  if (!ALLOWED[p.k0].has(p.pm0)) die(`${p.k0} does not list its own main method ${p.pm0}`);
}

// ---- the converted history: every second-rung block, with its state and owner ---------------------------------------------------------
const HIST = join(MOD, 'common/history/buildings');
if (!existsSync(HIST)) die(`no converted history in ${HIST} — run after convert_history.ps1`);
const close = (t, open) => { let i = open + 1, d = 1; while (i < t.length && d > 0) { if (t[i] === '{') d++; else if (t[i] === '}') d--; i++; } if (d) die('unbalanced braces'); return i - 1; };
const FILES = {}, BLOCKS = [];
for (const f of readdirSync(HIST).filter(n => n.endsWith('.txt'))) {
  const raw = readFileSync(join(HIST, f), 'utf8'); FILES[f] = raw;
  for (const sm of raw.matchAll(/s:(STATE_[A-Z0-9_]+)\s*=\s*\{/g)) {
    const sOpen = sm.index + sm[0].length - 1, sEnd = close(raw, sOpen);
    for (const rm of raw.slice(sOpen, sEnd).matchAll(/region_state:([A-Za-z0-9_]+)\s*=\s*\{/g)) {
      const rOpen = sOpen + rm.index + rm[0].length - 1, rEnd = close(raw, rOpen);
      const keysHere = [];
      for (const cm of raw.slice(rOpen, rEnd).matchAll(/create_building\s*=\s*\{/g)) {
        const cOpen = rOpen + cm.index + cm[0].length - 1, cEnd = close(raw, cOpen);
        const body = raw.slice(cOpen, cEnd + 1);
        const key = (body.match(/building\s*=\s*"?([a-z_0-9]+)"?/) || [])[1];
        keysHere.push(key);
        if (!PAIR[key]) continue;
        const lineStart = raw.lastIndexOf('\n', cOpen) + 1;
        BLOCKS.push({ f, state: sm[1], tag: rm[1], key, start: lineStart, end: cEnd + 1, indent: raw.slice(lineStart, cOpen).match(/^\s*/)[0], text: raw.slice(lineStart, cEnd + 1) });
      }
      for (const b of BLOCKS.filter(x => x.f === f && x.state === sm[1] && x.tag === rm[1])) if (keysHere.includes(PAIR[b.key].k0))
        die(`${sm[1]} (${rm[1]}) already holds ${PAIR[b.key].k0} beside ${b.key} — two buildings of one type in a state is not designed for`);
    }
  }
}

// ---- k per block: the floor (at least 1, at most N), then the country's remainder by largest fraction -----------------------------------
const levelsOf = text => [...text.matchAll(/levels\s*=\s*(\d+)/g)].reduce((s, m) => s + +m[1], 0);
for (const b of BLOCKS) { b.N = levelsOf(b.text); if (!(b.N > 0)) die(`${b.state} ${b.tag} ${b.key}: a block with no ownership levels`); }
const groups = {};
for (const b of BLOCKS) (groups[`${b.tag}|${PAIR[b.key].id}`] ||= []).push(b);
const lifted = [], report = [];
for (const [g, bs] of Object.entries(groups)) {
  const p = PAIR[bs[0].key]; const N = bs.reduce((s, b) => s + b.N, 0); const want = Math.round(N * p.share);
  for (const b of bs) { b.k = Math.min(b.N, Math.max(1, Math.floor(b.N * p.share))); if (b.k > b.N * p.share) lifted.push(`${b.state} ${b.tag} ${p.id}: ${b.N} level(s) → ${b.k} + ${b.k}`); }
  let tot = bs.reduce((s, b) => s + b.k, 0);
  for (const b of bs.slice().sort((x, y) => (y.N * p.share - y.k) - (x.N * p.share - x.k))) { if (tot >= want) break; if (b.k < b.N) { b.k++; tot++; } }
  const before = N * (p.v1), after = tot * (p.v0 + p.v1);
  report.push({ tag: bs[0].tag, id: p.id, N, k: tot, ratio: after / before, workers: 2 * tot / N });
}

// ---- rewrite: the block's ownership levels to k, and its twin on the first rung right after it ------------------------------------------
function reallocate(text, N, k) {
  // the ownership entries inside add_ownership, each carrying levels: `building = { … }`, `country = { … }` and `company = { … }` (the only
  // three forms on the 1.15.2 map; any other named block stops the build rather than being left at its old levels)
  const ao = text.match(/add_ownership\s*=\s*\{/); if (!ao) die('a block without add_ownership');
  const aOpen = ao.index + ao[0].length - 1, aEnd = close(text, aOpen);
  const inner = text.slice(aOpen + 1, aEnd);
  const forms = [...inner.matchAll(/([a-z_]+)\s*=\s*\{/g)].map(m => m[1]);
  const unknown = forms.filter(x => !['building', 'country', 'company'].includes(x));
  if (unknown.length) die(`an ownership form this tool does not know: ${unknown.join(', ')}`);
  const ents = []; for (const em of inner.matchAll(/(building|country|company)\s*=\s*\{/g)) { const o = aOpen + 1 + em.index + em[0].length - 1, c = close(text, o);
    const lm = text.slice(o, c).match(/levels\s*=\s*(\d+)/); if (!lm) die('an ownership entry without levels');
    const ls = text.lastIndexOf('\n', aOpen + 1 + em.index) + 1; ents.push({ ls, from: aOpen + 1 + em.index, to: c + 1, lv: +lm[1] }); }
  const alloc = ents.map(e => Math.floor(e.lv * k / N)); let s = alloc.reduce((a, x) => a + x, 0);
  ents.map((e, i) => ({ i, r: e.lv * k / N - alloc[i] })).sort((a, b) => b.r - a.r).forEach(({ i }) => { if (s < k) { alloc[i]++; s++; } });
  if (s !== k) die(`ownership allocation ${s} ≠ ${k}`);
  let out = text;
  for (let i = ents.length - 1; i >= 0; i--) {
    const e = ents[i];
    if (alloc[i] === 0) { const lineEnd = out.indexOf('\n', e.to); out = out.slice(0, e.ls) + out.slice(lineEnd + 1); }   // the whole entry and its line
    else out = out.slice(0, e.from) + out.slice(e.from, e.to).replace(/levels\s*=\s*\d+/, m => m.replace(/\d+$/, String(alloc[i]))) + out.slice(e.to);
  }
  if (levelsOf(out) !== k) die(`re-allocated block holds ${levelsOf(out)} levels, not ${k}`);
  return out;
}
const edits = {};
for (const b of BLOCKS) {
  const p = PAIR[b.key];
  const kept = reallocate(b.text, b.N, b.k);
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const twin = kept.replace(new RegExp('"' + esc(p.k1) + '"', 'g'), `"${p.k0}"`).replace(new RegExp('\\b' + esc(p.pm1) + '\\b', 'g'), p.pm0);
  if (twin.includes(p.k1) || !twin.includes(p.pm0)) die(`${b.state} ${b.tag}: the twin of ${p.k1} still names it, or lacks ${p.pm0}`);
  const pms = listIn(twin, 'activate_production_methods');
  const bad = pms.filter(m => !ALLOWED[p.k0].has(m));
  if (bad.length) die(`${b.state} ${b.tag}: the twin ${p.k0} would activate ${bad.join(', ')}, which its groups do not list — the engine would reject the block`);
  (edits[b.f] ||= []).push({ start: b.start, end: b.end, text: kept + '\n' + twin });
}
for (const [f, es] of Object.entries(edits)) {
  let t = FILES[f];
  for (const e of es.sort((a, b) => b.start - a.start)) t = t.slice(0, e.start) + e.text + t.slice(e.end);
  writeFileSync(join(HIST, f), t);   // the file's own bytes kept: a BOM stays where convert_history wrote one
}

// ---- report ------------------------------------------------------------------------------------------------------------------------------
console.log(`emit_deposit_start: the 1836 pair (§10.126) — ${BLOCKS.length} second-rung buildings in ${Object.keys(edits).length} files, each now k + k`);
const byId = {};
for (const r of report) { const x = (byId[r.id] ||= { N: 0, k: 0, out: [] }); x.N += r.N; x.k += r.k; if (Math.abs(r.ratio - 1) > 0.1) x.out.push(`${r.tag} ${r.N}→${r.k}+${r.k} (${r.ratio.toFixed(2)})`); }
for (const [id, x] of Object.entries(byId)) {
  const p = Object.values(PAIR).find(q => q.id === id);
  console.log(`  ${id.padEnd(16)} share ${p.share.toFixed(3)}: ${x.N} second-rung levels → ${x.k} + ${x.k}; supply ${((x.k * (p.v0 + p.v1)) / (x.N * p.v1)).toFixed(3)} of the converted map's, workers ${(2 * x.k / x.N).toFixed(2)}×`
    + (x.out.length ? `; countries off by more than 10%: ${x.out.join(', ')}` : ''));
}
const big = report.filter(r => r.N >= 10).sort((a, b) => b.N - a.N);
console.log('  countries with 10+ levels: ' + big.map(r => `${r.tag} ${r.id.replace(/_(mine|wharf|station)$/, '')} ${r.N}→${r.k}+${r.k} (${r.ratio.toFixed(2)})`).join(', '));
console.log(`  the floor of one level lifted ${lifted.length} building(s) above N × share: ${lifted.join('; ')}`);
