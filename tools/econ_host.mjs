// Node host for ui/econ.js — loads the generated browser data files and hands back a live econ instance.
// There is NO second model here: the arithmetic all lives in ui/econ.js, which the balance UI loads from
// the same file. This module only supplies the state containers the browser would otherwise supply.
//
//   import { loadEcon } from './econ_host.mjs';
//   const { E, S, presets } = loadEcon();
//   E.applyPreset(presets.find(p => p.id === 'bel_1836'));
//   const agg = E.scenarioAggregates();
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = join(HERE, '..');
const UI = join(REPO, 'ui');

// The generated files are plain `window.X = {...}` assignments, not modules — run them against a shim.
function loadWindowGlobals(files) {
  const win = {};
  const ctx = vm.createContext({ window: win });
  for (const f of files) {
    const path = join(UI, f);
    let src;
    try { src = readFileSync(path, 'utf8'); }
    catch { continue; }                       // icons.js is gitignored; presets.js may not exist yet
    vm.runInContext(src, ctx, { filename: path });
  }
  return win;
}

export function loadEcon({ quiet = false } = {}) {
  const win = loadWindowGlobals(['data.js', 'vanilla.js', 'presets.js']);
  if (!win.PMDATA) throw new Error('ui/data.js missing or empty — run tools\\build.ps1 first.');
  const require = createRequire(import.meta.url);
  const PMECON = require(join(UI, 'econ.js'));

  // ⚠ THE CONFIG COMES FROM config/mod_config.json, NOT from ui/data.js — even though data.js embeds a
  // copy of it. data.js is BUILD OUTPUT: it only matches the config after a build. The solvers WRITE
  // mod_config.json and then read their own result back, so sourcing it from data.js put a build step
  // inside that loop, and re-running without one silently re-read the PREVIOUS values. That is not a
  // theoretical hazard: it made `era_scenarios --write` followed by a re-run reproduce its numbers
  // exactly and look like a converged fixed point, when in fact the second run had never seen the first
  // one's output. Once the build caught up, the figures moved by nine points.
  // data.js is still the source of PRICES (goods_prices.tsv) and of the vanilla extract beside it.
  let cfg = win.PMDATA.config;
  try { cfg = JSON.parse(readFileSync(join(REPO, 'config', 'mod_config.json'), 'utf8')); }
  catch { /* no config on disk (a bare ui/ checkout) — fall back to the copy inside data.js */ }
  const PRE = win.PMPRESETS || null;
  const POPM = (PRE && PRE.pop_model) || { pop_size_package: 10000, class_mult: {}, buy_packages: {}, needs: {} };

  // Mutable scenario state. Everything the model only mutates in place is shared by reference; the four
  // values it reassigns get accessors, exactly as the browser passes them.
  let POPS = Object.assign({}, PMECON.EMPTY_POPS);
  let SOL = { upper: 35, middle: 16, lower: 9, peasants: 9, slaves: 8 };
  let BASE_WAGE = 0.04;
  let POPDIST = (POPM.distribution && Object.keys(POPM.distribution).length)
    ? JSON.parse(JSON.stringify(POPM.distribution)) : {};

  const S = {
    PRICES: win.PMDATA.prices,
    VAN: win.PMVANILLA || { buildings: {}, pmgs: {}, pms: {} },
    HAVE_VAN: !!win.PMVANILLA,
    IND: [],
    thresholds: {},
    BLDNUM: {}, ADDBUY: {}, ADDSELL: {}, THRU: {}, UNITNUM: {},
    REFSEL: {},
    REFEDIT: JSON.parse(JSON.stringify(cfg.pm_goods || {})),
    REFBASE: {},
    OURS: new Set(),
    POPM,
    get POPS() { return POPS; }, set POPS(v) { POPS = v; },
    get SOL() { return SOL; }, set SOL(v) { SOL = v; },
    get BASE_WAGE() { return BASE_WAGE; }, set BASE_WAGE(v) { BASE_WAGE = v; },
    get POPDIST() { return POPDIST; }, set POPDIST(v) { POPDIST = v; },
  };
  Object.keys(S.PRICES).forEach(g => { S.thresholds[g] = 100; });

  const E = PMECON.createEcon(S);
  S.IND.push(...E.buildIND(cfg.industries));
  S.IND.forEach(i => i.tiers.forEach(t => S.OURS.add(t.key)));

  const presets = (PRE && PRE.presets) || [];
  if (!quiet) {
    console.error(`econ_host: ${S.IND.length} industries / ${S.IND.reduce((n, i) => n + i.tiers.length, 0)} tiers, `
      + `${E.refBuildings().length} reference buildings, ${presets.length} presets, `
      + `${Object.keys(S.PRICES).length} priced goods`);
  }
  return { E, S, PMECON, presets, config: cfg, raw: win };
}

// Set every priced good back to base (100%). The scenario solver drives prices from orders instead, but a
// clean start matters when comparing two scenarios.
export function resetPrices(S) { Object.keys(S.PRICES).forEach(g => { S.thresholds[g] = 100; }); }
