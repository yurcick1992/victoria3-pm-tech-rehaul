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
import { dirname, isAbsolute, join } from 'node:path';
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
  //
  // ⚠ `MOD_CONFIG` OVERRIDES WHICH CONFIG THE MODEL SPEAKS FOR, AND IT MATTERS FOR ARM-MATCHING.
  // The pop split reads the SCENARIO'S OWN sell orders and non-pop buy orders, which come from the
  // scenario's buildings × the config's recipes. So scoring the model against a measured session only
  // means anything when the config describes the SAME economy the game was running:
  //   * a `config` arm (our tiered mod)  -> config/mod_config.json, the default. Model and game agree,
  //     because extract_presets maps vanilla 1836 history onto our tier buildings and convert_history
  //     makes the game's own 1836 start that same re-tiering.
  //   * a `control` arm (true vanilla)   -> MOD_CONFIG=config/mod_config.vanilla_stub.json, whose tiers
  //     carry the VANILLA recipes. Predicting with our recipes against a vanilla game compares two
  //     different economies and the resulting error is not the pop model's.
  // Absolute or repo-relative. Getting this wrong is silent: the run scores, the number is just answering
  // a question nobody asked.
  let cfg = win.PMDATA.config;
  const cfgRel = process.env.MOD_CONFIG || join('config', 'mod_config.json');
  const cfgPath = isAbsolute(cfgRel) ? cfgRel : join(REPO, cfgRel);
  try {
    cfg = JSON.parse(readFileSync(cfgPath, 'utf8').replace(/^﻿/, ''));
    // ⛔ SIX-RUNG MACHINERY GUARD (2026-09-05). The canonical config is the four-rung canon4v; the era pipeline and its
    //   readers were written for the six-rung book and would score or REWRITE a four-rung config as if it had six eras.
    //   Only the named tools are refused, and only when no MOD_CONFIG was given — an explicit override is honoured.
    {
      const tool = (process.argv[1] || '').split(/[\\/]/).pop();
      const SIX_RUNG_TOOLS = ['build_era_ladder.mjs', 'era_solver.mjs', 'era_scenarios.mjs', 'era_tech_sync.mjs', 'payback_census.mjs', 'vanilla_payback_census.mjs', 'verify_pms.mjs'];
      if (!process.env.MOD_CONFIG && cfg && cfg.era_game_era && SIX_RUNG_TOOLS.includes(tool)) throw new Error("config/mod_config.json is the FOUR-RUNG canon (canon4v, canonised 2026-09-05); this is six-rung machinery - point it at the six-rung book explicitly: MOD_CONFIG=config/mod_config.six_rung.json (BALANCE_FRAMEWORK §10.74)");
    }
    if (!quiet && process.env.MOD_CONFIG) console.error(`econ_host: config <- ${cfgRel}`);
  } catch (e) {
    // An EXPLICIT override that cannot be read is a mistake, not a fallback: silently scoring the
    // default config under a flag asking for another one is exactly the failure this guard exists for.
    if (process.env.MOD_CONFIG) throw new Error(`MOD_CONFIG=${cfgRel} could not be read: ${e.message}`);
    /* no config on disk (a bare ui/ checkout) — fall back to the copy inside data.js */
  }
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
    // the WHOLE config, for the few rules that are properties of the LADDER rather than of a tier:
    // today only `era_game_era`, the rung-index -> game-era map era_pm.mjs needs (2026-09-01).
    CFG: cfg,
    HAVE_VAN: !!win.PMVANILLA,
    IND: [],
    thresholds: {},
    BLDNUM: {}, ADDBUY: {}, ADDSELL: {}, THRU: {}, UNITNUM: {},
    REFSEL: {},
    // pm_goods (goods overrides) + pm_employment (per-PM employment overrides) fold into ONE override
    // map — econ.js's pmRec reads {in,out,emp} off the same entry. Kept as two config keys because the
    // UI edits pm_goods and must never carry emp into it (the recipe book drops pm_goods wholesale).
    REFEDIT: (() => {
      const r = JSON.parse(JSON.stringify(cfg.pm_goods || {}));
      for (const pm in (cfg.pm_employment || {})) {
        (r[pm] = r[pm] || {}).emp = JSON.parse(JSON.stringify(cfg.pm_employment[pm]));
      }
      return r;
    })(),
    REFBASE: {},
    OURS: new Set(),
    POPM,
    get POPS() { return POPS; }, set POPS(v) { POPS = v; },
    get SOL() { return SOL; }, set SOL(v) { SOL = v; },
    get BASE_WAGE() { return BASE_WAGE; }, set BASE_WAGE(v) { BASE_WAGE = v; },
    get POPDIST() { return POPDIST; }, set POPDIST(v) { POPDIST = v; },
  };
  Object.keys(S.PRICES).forEach(g => { S.thresholds[g] = 100; });
  // A/B knob for the local-goods discount (FINDINGS F43). `LOCAL_MULT=1` restores the pre-F43 reading, in
  // which a local good counted at its full market supply. Same status as SPLIT_MODE / AVAIL_MODE: it
  // exists so the change can be MEASURED against what it replaced, not so it can be configured.
  if (process.env.LOCAL_MULT) {
    S.LOCAL_MULT = +process.env.LOCAL_MULT;
    if (!quiet) console.error(`econ_host: LOCAL_MULT <- ${S.LOCAL_MULT}`);
  }

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
