// THE SAME-ACRE STEPS — the world-technology gate and irrigation's two drives (the mod 1.2 book: BALANCE_FRAMEWORK §10.115 ruling 7 and
// §10.124 item 1, the world gate; §10.116.1 and §10.124 item 3, the drives).
//
//   node tools/emit_agri_steps.mjs <mod dir> <config>          (build.ps1 runs it after it has owned the production-method files)
//
// Config `agri_steps` (absent: nothing is emitted, the tool says so):
//   world_gate: [vanilla method keys] — each method's `unlocking_technologies` becomes `unlocking_global_technologies` (the WORLD's technology,
//     "technologies that need to be invented in the world to be able to activate this pm", the game's production_methods.md; proven by F276):
//     the same-acre steps whose technology is tech era 3 or later, so the 1836 map stays vanilla's; since §10.126 (2026-11-21) also the
//     untiered logging camp's electric saw mills (tech era 4), for foreign timber concessions.
//   irrigation: { methods: [vanilla automatic_irrigation_* keys], steam_coal_per_engine, diesel: { engines_mult, oil_value_of_steam_coal,
//     tech, name } } —
//     - THE STEAM DRIVE is vanilla's method with one coal per engine added (engines 5 + coal 5; tea 4 + 4), on its world gate;
//     - THE DIESEL STEP is a new method beside it in the same group, the same output, staffing and pollution, on the country's OWN technology
//       (vanilla's ordinary `unlocking_technologies`): half the engines and oil worth half the steam drive's coal at base prices — engines 2.5
//       + oil 1.9 (tea 2 + 1.5), £226 a level against the steam drive's £450 (§10.124 item 3). A succession, not a choice: the diesel step is
//       clearly superior, so the newest drive a country holds is always the answer (§10.116.1).
// It reads the production-method and group files THIS build already owns (build.ps1 may have written them) and vanilla's otherwise, and
// throws on anything it cannot do exactly once.
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const MOD = process.argv[2] || 'mod';
const CFGP = process.argv[3] || 'config/mod_config.json';
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const BOM = '\uFEFF';
const rd = p => readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const die = m => { throw new Error('emit_agri_steps: ' + m); };
const cfg = JSON.parse(rd(CFGP));
const A = cfg.agri_steps;
if (!A) { console.log('emit_agri_steps: the book carries no agri_steps — nothing emitted'); process.exit(0); }
const PRICE = {}; for (const l of rd('tools/goods_prices.tsv').split(/\r?\n/)) { const m = l.trim().split(/\t|\s+/); if (m.length >= 2 && +m[1] > 0) PRICE[m[0]] = +m[1]; }
const r1 = x => Math.round(x * 10) / 10;

// the file a block lives in: this build's owned copy if it has one, else vanilla's
const files = {};   // rel -> { text, eol, touched }
const fileOf = (dir, rel) => {
  const k = dir + '/' + rel; if (files[k]) return files[k];
  const own = join(MOD, 'common', dir, rel), van = join(GAME, 'common', dir, rel);
  const raw = readFileSync(existsSync(own) ? own : van, 'utf8').replace(/^\uFEFF/, '');
  return (files[k] = { dir, rel, text: raw, eol: raw.includes('\r\n') ? '\r\n' : '\n', touched: false, own: existsSync(own) });
};
// where each vanilla method / group is defined
const where = dir => { const o = {}; for (const f of readdirSync(join(GAME, 'common', dir)).filter(x => x.endsWith('.txt'))) for (const m of rd(join(GAME, 'common', dir, f)).matchAll(/^([A-Za-z_][A-Za-z0-9_-]*)\s*=\s*\{/gm)) o[m[1]] ||= f; return o; };
const PMF = where('production_methods'), PMGF = where('production_method_groups');
const pmgText = {}; const PMG_TEXT = f => (pmgText[f] ??= rd(join(GAME, 'common/production_method_groups', f)));
// the block of `key` in a file's text: [start, end) of the whole `key = { … }`
const blockAt = (text, key) => {
  const m = new RegExp('^' + key + '\\s*=\\s*\\{', 'm').exec(text); if (!m) return null;
  let i = m.index + m[0].length, d = 1; while (i < text.length && d > 0) { const c = text[i]; if (c === '#') { while (i < text.length && text[i] !== '\n') i++; continue; } if (c === '{') d++; else if (c === '}') d--; i++; }
  return [m.index, i];
};
const edit = (dir, key, fn) => {
  const rel = (dir === 'production_methods' ? PMF : PMGF)[key] || die(`${key} is not a vanilla ${dir} key`);
  const F = fileOf(dir, rel); const at = blockAt(F.text, key) || die(`${key} not found in ${dir}/${rel}`);
  const blk = F.text.slice(at[0], at[1]); const nb = fn(blk);
  if (nb === blk) die(`${key}: the edit changed nothing`);
  F.text = F.text.slice(0, at[0]) + nb + F.text.slice(at[1]); F.touched = true;
};
const report = [];

// ---- 1. the world gate ---------------------------------------------------------------------------------------------------------------
for (const pm of A.world_gate || []) edit('production_methods', pm, b => {
  const n = (b.match(/\bunlocking_technologies\s*=\s*\{/g) || []).length;
  if (n !== 1) die(`${pm}: ${n} unlocking_technologies blocks, the world gate needs exactly one`);
  report.push(`world gate: ${pm} (${(b.match(/\bunlocking_technologies\s*=\s*\{([^}]*)\}/) || [])[1].trim()})`);
  return b.replace(/\bunlocking_technologies(\s*=\s*\{)/, 'unlocking_global_technologies$1');
});

// ---- 2. irrigation: the steam drive, then the diesel step ------------------------------------------------------------------------------
const I = A.irrigation;
const newPms = [], loc = [];
if (I) {
  const D = I.diesel || die('irrigation.diesel missing');
  for (const pm of I.methods || []) {
    const van = rd(join(GAME, 'common/production_methods', PMF[pm] || die(`${pm} is not a vanilla method`)));
    const vb = (() => { const at = blockAt(van, pm); return van.slice(at[0], at[1]); })();
    const eng = +((vb.match(/goods_input_engines_add\s*=\s*([0-9.]+)/) || die(`${pm}: no engines input`))[1]);
    if (/goods_input_(coal|oil|electricity)_add/.test(vb)) die(`${pm}: already burns a fuel — not designed`);
    const coal = r1(eng * +I.steam_coal_per_engine);
    // the steam drive: vanilla's method + one coal per engine (in this build's copy, which also carries the world gate)
    edit('production_methods', pm, b => b.replace(/(\n([ \t]*)goods_input_engines_add\s*=\s*[0-9.]+[^\n]*)/, `$1\n$2goods_input_coal_add = ${coal}`));
    // the diesel step: a copy of VANILLA's method, its own technology gate, fewer engines and oil worth half the steam drive's coal
    const dEng = r1(eng * +D.engines_mult), dOil = r1(coal * PRICE.coal * +D.oil_value_of_steam_coal / PRICE.oil);
    const key = pm.replace(/^automatic_irrigation_/, 'pmr_diesel_irrigation_');
    let nb = vb.replace(new RegExp('^' + pm), key)
      .replace(/\bunlocking_technologies\s*=\s*\{[^}]*\}/, `unlocking_technologies = {\n\t\t${D.tech}\n\t}`)
      .replace(/(\n([ \t]*)goods_input_engines_add\s*=\s*)[0-9.]+[^\n]*/, `$1${dEng}\n$2goods_input_oil_add = ${dOil}`);
    if (!/unlocking_technologies/.test(nb)) die(`${pm}: no technology gate to replace`);
    newPms.push(nb); loc.push([key, D.name]);
    // the group: the diesel step joins the steam drive's group, right after it
    const grp = Object.keys(PMGF).find(g => { const t = PMG_TEXT(PMGF[g]); const at = blockAt(t, g); return at && new RegExp('\\b' + pm + '\\b').test(t.slice(at[0], at[1])); }) || die(`${pm}: no group lists it`);
    edit('production_method_groups', grp, b => b.replace(new RegExp('(\\n([ \\t]*)' + pm + '\\b)'), `$1\n$2${key}`));
    report.push(`irrigation: ${pm} steam engines ${eng} + coal ${coal} (£${eng * PRICE.engines + coal * PRICE.coal}); ${key} engines ${dEng} + oil ${dOil} (£${(dEng * PRICE.engines + dOil * PRICE.oil).toFixed(0)}) on ${D.tech}, in ${grp}`);
  }
}

// ---- write -----------------------------------------------------------------------------------------------------------------------------
let n = 0;
for (const F of Object.values(files)) if (F.touched) {
  const out = join(MOD, 'common', F.dir); mkdirSync(out, { recursive: true });
  writeFileSync(join(out, F.rel), BOM + F.text.replace(/\r?\n/g, F.eol)); n++;
}
if (newPms.length) {
  writeFileSync(join(MOD, 'common/production_methods/zzz_pm_rehaul_agri_steps.txt'), BOM + '# AUTO-GENERATED by tools/emit_agri_steps.mjs (the diesel irrigation step, BALANCE_FRAMEWORK §10.116.1, §10.124 item 3) - do not edit.\r\n' + newPms.join('\r\n\r\n').replace(/\r?\n/g, '\r\n') + '\r\n');
  for (const lang of cfg.languages || ['english']) {
    const dir = join(MOD, 'localization', lang, 'replace'); mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `zzz_pm_rehaul_agri_l_${lang}.yml`), BOM + `l_${lang}:\n` + loc.map(([k, v]) => ` ${k}:0 "${v}"`).join('\n') + '\n');
  }
}
console.log(`emit_agri_steps: ${(A.world_gate || []).length} method(s) on the world's technology, ${newPms.length} diesel irrigation step(s); ${n} vanilla file(s) owned or re-written`);
for (const r of report) console.log('  ' + r);
