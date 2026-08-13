// HOW FAR IS THE MOD FROM "every buildable building and allowed PM in country X in 1836 survives"?
// Read-only, structural. For each of our tiers that replaces a vanilla MAIN PM, compare the gate a
// country needs in OUR mod against the gate it needed in VANILLA. If ours is harder, the capability
// moved — and if ours crosses out of mechanical era 1, it moved out of the 1836 starting grant, which
// `add_era_researched = era_1` hands to tier-1/2 countries.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const REPO = 'C:/claude-code/victoria 3 PM and tech rehaul';
const strip = s => s.replace(/^\uFEFF/, '');
const read = f => strip(readFileSync(f, 'utf8'));
const txts = d => readdirSync(d).filter(f => f.endsWith('.txt')).map(f => join(d, f));
// ⚠ hyphen in the id class — four vanilla keys contain one and three are `vanilla_pm` values of ours.
const ID = '[A-Za-z_0-9-]+';

// ---- vanilla technology eras ----
const vanEra = {};
for (const f of txts(join(GAME, 'common/technology/technologies'))) {
  const t = read(f);
  for (const m of t.matchAll(new RegExp(`^(${ID})\\s*=\\s*\\{`, 'gm'))) {
    const start = m.index, next = t.indexOf('\n}', start);
    const body = t.slice(start, next < 0 ? t.length : next);
    const e = /era\s*=\s*era_(\d)/.exec(body);
    if (e) vanEra[m[1]] = +e[1];
  }
}
// ---- vanilla PM gates ----
const pmGate = {};
for (const f of txts(join(GAME, 'common/production_methods'))) {
  const t = read(f);
  const re = new RegExp(`^(${ID})\\s*=\\s*\\{`, 'gm');
  let m;
  while ((m = re.exec(t))) {
    const start = m.index;
    const nxt = re.exec(t); re.lastIndex = nxt ? nxt.index : t.length;
    const body = t.slice(start, nxt ? nxt.index : t.length);
    if (nxt) re.lastIndex = nxt.index;
    const g = /unlocking_technologies\s*=\s*\{([^}]*)\}/.exec(body);
    pmGate[m[1]] = g ? (g[1].match(new RegExp(ID, 'g')) || []) : [];
  }
}
// ---- our tree: technology -> mechanical era, and origin ----
const tree = JSON.parse(read(join(REPO, 'config/tech_tree_options.json')));
const opt = tree.options.find(o => o.id === 'o1') || tree.options[0];
const ourTech = {};
const arr = Array.isArray(opt.techs) ? opt.techs : Object.entries(opt.techs).map(([k, v]) => ({ id: k, ...v }));
for (const t of arr) ourTech[t.id || t.key] = t;

// ---- vanilla BUILDING gates. ⚠⚠ A PM WITH NO `unlocking_technologies` IS NOT UNGATED: you still have
// to be able to BUILD the building. emit_techs.mjs documents this exact trap ("vanilla's side needs the
// BUILDING's gate as well as the METHOD's"), and ignoring it turns every gateless PM into a phantom
// "available to everyone at 1836", which is the permissive direction and therefore the dangerous one.
const bldGate = {};
for (const f of txts(join(GAME, 'common/buildings'))) {
  const t = read(f);
  const re = new RegExp(`^(${ID})\\s*=\\s*\\{`, 'gm');
  let m, prev = null, prevStart = 0;
  while ((m = re.exec(t))) {
    if (prev) { const body = t.slice(prevStart, m.index); const g = /unlocking_technologies\s*=\s*\{([^}]*)\}/.exec(body);
      bldGate[prev] = g ? (g[1].match(new RegExp(ID, 'g')) || []) : []; }
    prev = m[1]; prevStart = m.index;
  }
  if (prev) { const body = t.slice(prevStart); const g = /unlocking_technologies\s*=\s*\{([^}]*)\}/.exec(body);
    bldGate[prev] = g ? (g[1].match(new RegExp(ID, 'g')) || []) : []; }
}

const cfg = JSON.parse(read(join(REPO, 'config/mod_config.json')));
const rows = [];
for (const ind of cfg.industries) for (const t of ind.tiers) {
  if (!t.vanilla_pm) continue;                       // invented tiers have no vanilla capability to lose
  const vg = pmGate[t.vanilla_pm];
  if (vg === undefined) { rows.push({ ind: ind.id, t, vgate: '(PM NOT FOUND)', ve: null, oe: null, verdict: 'UNKNOWN' }); continue; }
  // the vanilla capability needs BOTH gates: the base building's and the method's
  const baseKey = ind.tiers[0].key;
  const bg = bldGate[baseKey] || [];
  const both = [...bg, ...vg];
  const vGateEra = both.length ? Math.max(...both.map(x => vanEra[x] ?? 1)) : 1;
  const ot = ourTech[t.tech] || {};
  const oGateEra = ot.e ?? ot.era ?? null;
  let verdict = 'same';
  if (oGateEra != null) {
    if (oGateEra > vGateEra) verdict = (vGateEra === 1 && oGateEra > 1) ? 'LOST AT START' : 'later';
    else if (oGateEra < vGateEra) verdict = 'earlier';
  }
  rows.push({ ind: ind.id, t, vgate: (both.join('+') || '(none)'), ve: vGateEra, oe: oGateEra, verdict });
}

const pad = (s, n) => String(s).padEnd(n);
// ---- the residual the ERA test cannot see: a same-era technology SWAP. Vanilla needs tech A (era 2+),
// we need tech B (also era 2+). Nobody loses a technology — L15 stays green — but a country that starts
// with A as a per-country `add_technology_researched` extra and not B has lost the CAPABILITY.
{
  console.log('=== SAME-ERA TECHNOLOGY SWAPS AT ERA >= 2 (what the era comparison cannot see) ===');
  let n = 0;
  for (const ind of cfg.industries) for (const t of ind.tiers) {
    if (!t.vanilla_pm) continue;
    const vg = pmGate[t.vanilla_pm] || [];
    const hard = vg.filter(g => (vanEra[g] ?? 1) >= 2);
    if (!hard.length || hard.includes(t.tech)) continue;
    n++;
    console.log('   ' + pad(ind.id + ' e' + t.era, 18) + 'vanilla ' + pad(hard.join('+'), 26)
      + '-> ours ' + t.tech + '  (ours is ' + (vanEra[t.tech] != null ? 'vanilla era ' + vanEra[t.tech] : 'a NEW technology') + ')');
  }
  console.log('   total: ' + n + '\n');
}

const by = {};
for (const r of rows) (by[r.verdict] ??= []).push(r);
console.log(`${rows.length} tiers carry a vanilla main PM (of ${cfg.industries.reduce((n, i) => n + i.tiers.length, 0)} total).\n`);
for (const v of ['LOST AT START', 'later', 'same', 'earlier', 'UNKNOWN']) {
  const g = by[v] || []; if (!g.length) continue;
  console.log(`### ${v} — ${g.length}`);
  for (const r of g) {
    console.log('   ' + pad(r.ind + ' e' + r.t.era, 20) + pad(r.t.vanilla_pm, 32)
      + 'vanilla ' + pad(r.vgate + ' (era ' + r.ve + ')', 40)
      + '-> ours ' + r.t.tech + ' (era ' + r.oe + ')');
  }
  console.log('');
}
