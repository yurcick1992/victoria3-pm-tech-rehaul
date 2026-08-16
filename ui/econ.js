// THE economic model — hand-authored, NOT generated. Shared by the balance UI (ui/builder.html) and by
// headless Node tooling (tools/era_solver.mjs). There is exactly ONE implementation of this arithmetic:
// a second copy would drift, and the pop-demand rules below are measured results (FINDINGS F13/F19/F22/
// F24/F26/F27), not conventions you can re-derive from first principles.
//
// Everything here is PURE MODEL: no DOM, no rendering, no formatting. Presentation stays in builder.html.
//
// State is threaded through one object `S` handed to createEcon(). The UI passes GETTERS for the values it
// reassigns (POPS, SOL, BASE_WAGE, POPDIST) so it can keep using plain `let` bindings at its own call sites;
// every container it only ever mutates in place (BLDNUM, thresholds, …) is shared by reference.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PMECON = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ---- wages: a building's wage bill stems from its WORKFORCE, not from a fraction of its goods ----
  // Each employee's weekly wage = base wage × the pop type's vanilla wage_weight (common/pop_types/*.txt).
  // Everyone is treated as non-discriminated, so profession is the only wage modifier. Yearly = ×52.
  const WAGE_WEIGHT = { laborers:1, machinists:1.5, clerks:1.5, soldiers:1.5, farmers:2, shopkeepers:3, engineers:3,
    clergymen:3, bureaucrats:4, academics:4, officers:5, aristocrats:5, capitalists:5, peasants:0.2, slaves:0 };
  const WAGE_PROFS = ['laborers','machinists','clerks','soldiers','farmers','shopkeepers','engineers','clergymen',
    'bureaucrats','academics','officers','aristocrats','capitalists','peasants','slaves'];   // natural order (base up)
  const WEEKS_PER_YEAR = 52;
  const AIVAL_DEFAULT = 1000;   // PRODUCTION_BUILDING_BASE_VALUE — engine default when a building scripts no ai_value

  // ONE class order, used by the SoL row, the population row and the report: upper · middle · lower ·
  // peasants · slaves. Two lists in two orders is how the panel ended up with its rows misaligned.
  const CLASSES = ['upper','middle','lower','peasants','slaves'];
  const EMPTY_POPS = {total:0, upper:0, middle:0, lower:0, peasants:0, slaves:0};

  // Half-width of the standard-of-living spread applied INSIDE each stratum. A stratum is not one wealth
  // level: its pops sit on a range, and buy packages are steps, so collapsing them onto the mean
  // systematically misreads the basket. Each class's people are spread uniformly over
  // [mean−SOL_SPREAD, mean+SOL_SPREAD] (floored at 1).
  //
  // ONE global constant, not a fitted per-market vector, and it is worth 7 pp: scored against the game's own
  // pop-consumption figures across seven 1836 markets, mean error is 25.7% at the bare stratum mean and
  // 18.5% with this spread. Using every pop's TRUE measured SoL instead scores 16.7% — so the spread
  // recovers most of what per-pop data would give, for one number. Per-market fitting of the width buys
  // ~0.5 pp over the global 8 and is deliberately not done. See FINDINGS F24.
  const SOL_SPREAD = 8;

  const UNQUALIFIED_PROFS = ['laborers','farmers'];   // the jobs slaves and peasants compete for

  // Custom taxonomy: vanilla building_group -> our display category. The MODEL only needs the
  // 'subsistence' mapping (see isSubsistenceBuilding); the rest is here so the UI and the model cannot
  // disagree about what a building is. Unmapped groups fall back to a category of their own.
  const GRPCAT = {
    bg_private_infrastructure:'utilities_trade', bg_trade:'utilities_trade', bg_power:'utilities_trade',
    bg_arts:'arts',
    bg_staple_crops:'farms', bg_plantations:'plantations', bg_agriculture:'plantations', bg_ranching:'ranching',
    bg_mining:'mining', bg_gold_fields:'gold_fields', bg_logging:'logging', bg_oil_extraction:'oil', bg_rubber:'rubber',
    bg_army:'military_consumers', bg_army_logistics_center:'military_consumers', bg_conscription:'military_consumers',
    bg_naval_administration:'military_consumers', bg_naval_fortification:'military_consumers', bg_naval_logistics_center:'military_consumers',
    bg_company_headquarter:'property_owners', bg_company_regional_headquarter:'property_owners',
    bg_financial_districts:'property_owners', bg_manor_houses:'property_owners',
    bg_bureaucracy:'administration', bg_skyscraper:'administration', bg_technology:'administration',
    bg_fishing:'fishing_whaling', bg_whaling:'fishing_whaling',
    bg_subsistence_agriculture:'subsistence', bg_subsistence_ranching:'subsistence',
    bg_service:'service', bg_construction:'construction',
    bg_monuments:'unique', bg_monuments_hidden:'unique', bg_canals:'unique'
  };

  // building-cost model — mirrors tools/solve_building_cost.ps1 (that solver is authoritative).
  // £/point = construction sector iron PM: £3600/wk goods ÷ 5 pts/wk = 720 (0 efficiency bonus).
  // NOTE: poundPerPoint is STATIC here and may go STALE on a game update if Paradox changes the
  // construction sector's iron PM recipe or its construction output. See ON_GAME_UPDATE.md.
  const BCM = { paybackYears:10, weeksPerYear:52, marginPct:0.20, poundPerPoint:720, roundTo:5, basis:'cost' };

  const round = x => Math.floor(x + 0.5);

  // ---- LOCAL GOODS (BALANCE_FRAMEWORK §10.37, FINDINGS F43) --------------------------------------
  // `services`, `transportation` and `electricity` carry `local = yes` in common/goods. Their
  // SUBSTITUTION supply — and only that, never the price calculation — is not the market's: a state sees
  // its OWN production plus `(1 − the state's GDP share) × LOCAL_GOODS_SUBSTITUTION_SUPPLY_GDP_FACTOR ×`
  // the market's, the factor being 0.25.
  //
  // Our scenario is ONE state that IS the whole market, so the augmentation term used to vanish and we
  // fed a local good its full market supply. That is right for the market's arithmetic and WRONG for the
  // pops, who live in states — it handed local goods a share no real state ever sees, and correspondingly
  // starved everything competing with them (a debut good got 21.9 % of `free_movement` against the game's
  // 38.4 %). The fix is to model a REPRESENTATIVE state rather than the degenerate whole-market one:
  //
  //   state's own supply   = LOCAL_OWN_SHARE  × the market's        (a state holds a fifth of it)
  //   state's GDP share    = LOCAL_STATE_GDP                        (a state is a fifth of the country)
  //   ⇒ multiplier         = 0.2 + (1 − 0.2) × 0.25                 = 0.40
  //
  // ⭐ MEASURED, not assumed (F43): scored against the purchase weights eight VANILLA gamestates store,
  // over two markets × eight dates 1901-1920, the local-good needs err **0.835 pp** at 0.40 against
  // **4.226 pp** unaugmented — better in 16 of 16 market-dates. A sweep puts the empirical optimum at
  // 0.35-0.40 (0.809 pp), so the derived value sits inside the noise of the best constant available.
  // ⚠ The factor multiplies the WHOLE availability (supply minus the non-pop deduction), not the supply
  // alone: our one state is a scaled-down market, so its industry scales with its production. Scaling
  // supply alone while deducting a whole market's industrial demand drives electricity to zero.
  // `S.LOCAL_MULT = 1` restores the old unaugmented reading for A/B measurement; it is not a setting.
  const LOCAL_GOODS = new Set(['services', 'transportation', 'electricity']);
  const LOCAL_STATE_GDP = 0.2, LOCAL_OWN_SHARE = 0.2, LOCAL_GDP_FACTOR = 0.25;
  const LOCAL_MULT_DEFAULT = LOCAL_OWN_SHARE + (1 - LOCAL_STATE_GDP) * LOCAL_GDP_FACTOR;   // = 0.40

  // =================================================================================================
  function createEcon(S) {
    // S.PRICES, S.VAN, S.HAVE_VAN, S.IND, S.thresholds, S.BLDNUM, S.ADDBUY, S.ADDSELL, S.THRU,
    // S.UNITNUM, S.REFSEL, S.REFEDIT, S.REFBASE, S.OURS, S.POPM  (containers, shared by reference)
    // S.POPS, S.SOL, S.BASE_WAGE, S.POPDIST                      (may be getters — always read via S.x)
    const POPM = S.POPM;
    const UNITG = (POPM && POPM.unit_goods) || {};   // rides in pop_model, beside the other generated tables

    // ---- slave-basket constants, read off the game's own defines via the generated pop_model ----
    // slaves declare their OWN `working_adult_ratio = 0.5` (common/pop_types/slaves.txt), so the per-head
    // factor is 0.5 + 0.5×0.5 = 0.75, not the 0.625 the base 0.25 ratio gives.
    const SLAVE_WORK_RATIO = (POPM.slave_working_adult_ratio != null ? POPM.slave_working_adult_ratio : 0.5);
    // `SLAVE_BASKET_SUBSISTENCE_GOODS_MULT = 0.05`: a slave in a SUBSISTENCE building costs its owner a
    // twentieth of the basket, because subsistence meets those needs in kind. That term dominates —
    // modelling the full basket for every slave over-predicted the American market's measured slave
    // purchases by 3.9× (FINDINGS F27).
    const SLAVE_SUBSISTENCE_MULT = ((POPM.slave_basket || {}).subsistence_mult != null
      ? POPM.slave_basket.subsistence_mult : 0.05);

    // ---------- production-method helpers (PMVANILLA + the pm_goods overrides) ----------
    // power-bloc-gated PM: only active when a power-bloc principle is enabled (unlocking_principles).
    function pmGated(pm){ const r = S.VAN.pms && S.VAN.pms[pm]; return !!(r && r.gated); }
    // default (base) PM of a PMG = its first listed NON-gated PM (the vanilla "off"/baseline state). Some PMGs
    // list a power-bloc-gated PM first; in-game that gated PM is inactive without the bloc principle, so we
    // must never pick it as the default — fall back to pms[0] only if every PM is gated (shouldn't happen).
    function basePm(pmg){ const g = S.VAN.pmgs[pmg]; if(!(g && g.pms && g.pms.length)) return undefined;
      return g.pms.find(p => !pmGated(p)) || g.pms[0]; }
    function initSel(pmgs){ const s = {}; (pmgs||[]).forEach(pg => { const b = basePm(pg); if(b) s[pg] = b; }); return s; }
    // REFEDIT = the pm_goods overrides (config-backed, emitted into the owned production_methods files).
    // An entry may also carry `emp` — the per-PM EMPLOYMENT override (config `pm_employment`, folded in
    // by the host; the browser keeps it in a separate REFEMP because pm_goods is UI-editable and emp is
    // not). Override semantics are REPLACEMENT, not merge: an overridden map is the whole recipe/crew.
    function pmRec(pm){ const v = S.VAN.pms[pm] || {in:{},out:{},emp:{},mods:{}}; const o = S.REFEDIT[pm];
      return o ? {in:o.in||v.in, out:o.out||v.out, emp:o.emp||v.emp, mods:v.mods} : v; }
    function goodsVal(map, useThr){ let v = 0;
      for(const g in (map||{})) v += map[g]*(S.PRICES[g]||0)*(useThr ? (S.thresholds[g] ?? 100)/100 : 1);
      return v; }
    function selInVal(sel, useThr){ let v = 0; for(const pg in (sel||{})) v += goodsVal(pmRec(sel[pg]).in, useThr); return v; }
    function selOutVal(sel, useThr){ let v = 0; for(const pg in (sel||{})) v += goodsVal(pmRec(sel[pg]).out, useThr); return v; }
    // merge goods maps of selected PMs; non-goods modifiers accumulate too
    function selGoods(sel){ const inm={}, outm={}, mods={};
      for(const pg in (sel||{})){ const r = pmRec(sel[pg]);
        for(const g in r.in)  inm[g]  = (inm[g] ||0) + r.in[g];
        for(const g in r.out) outm[g] = (outm[g]||0) + r.out[g];
        for(const m in r.mods) mods[m] = (mods[m]||0) + r.mods[m]; }
      return {in:inm, out:outm, mods}; }
    function selEmp(sel){ const e = {};
      for(const pg in (sel||{})){ const r = pmRec(sel[pg]); if(r.emp) for(const k in r.emp) e[k] = (e[k]||0) + r.emp[k]; }
      return e; }

    // ---------- our tier buildings ----------
    function tierOut(i,t){ return t.output_good || i.output_good; }
    // workforce = base-PM employment (config) + the ACTIVE PM of EVERY secondary PMG (including its
    // default/base PM — each PMG always has one active PM in-game). Base secondary PMs are usually inert,
    // but some carry the building's jobs (e.g. the art academy's ownership PMG employs academics/clerks).
    function tierEmp(t){ const e = Object.assign({}, t.employment||{});
      for(const pg in (t._sec||{})){ const r = pmRec(t._sec[pg]);
        if(r.emp) for(const k in r.emp) e[k] = (e[k]||0) + r.emp[k]; }
      for(const k in e){ if(e[k] === 0) delete e[k]; } return e; }
    function empTotal(m){ let s = 0; for(const k in (m||{})) s += m[k]; return s; }

    function wageUnits(emp){ let u = 0; for(const p in (emp||{})) u += (emp[p]||0)*(WAGE_WEIGHT[p]||0); return u; }
    function tierBaseWage(t){ return t._baseWage != null ? t._baseWage : S.BASE_WAGE; }
    function refBaseWage(b){ return S.REFBASE[b] != null ? S.REFBASE[b] : S.BASE_WAGE; }
    function wageCost(t){ return wageUnits(tierEmp(t))*tierBaseWage(t); }

    // tier economics fold in the tier's selected secondary PMs (default base = inert, nothing moves until switched)
    function inputValue(t, useThr){ let v = 0;
      for(const [g,q] of Object.entries(t.inputs)) v += q*(S.PRICES[g]||0)*(useThr ? (S.thresholds[g] ?? 100)/100 : 1);
      return v + selInVal(t._sec, useThr); }
    function outputValue(i,t, useThr){ const og = tierOut(i,t);
      return t.output_qty*(S.PRICES[og]||0)*(useThr ? (S.thresholds[og] ?? 100)/100 : 1) + selOutVal(t._sec, useThr); }

    // THROUGHPUT belongs in the profit, not only in the order book. A bonus scales a building's goods —
    // inputs AND outputs — but NOT its workforce, so it does not cancel out: it raises the margin,
    // because the wage bill is the one cost that does not grow with it. Modelling it only in the scenario
    // aggregates (as this did) leaves the Profit column answering a different question from the market.
    //   revenue = k·O,  cost = k·I + W
    // FULL break-even: output price (% of base) at which full profit (input goods + wages) = 0.
    function BE(i,t){ const k = thruMult(t.key), O = k*outputValue(i,t,false);
      return O > 0 ? (k*inputValue(t,false)+wageCost(t))/O*100 : 0; }
    // FULL profitability at the current prices: (kO − kI − W)/(kI + W). Wages at base (fixed labor).
    function TPthr(i,t){ const k = thruMult(t.key), I = k*inputValue(t,true), W = wageCost(t); const C = I + W;
      return C > 0 ? (k*outputValue(i,t,true) - C)/C*100 : 0; }

    function buildingCostModel(i,t){
      const I = inputValue(t,false);
      const profit = (BCM.basis === 'output') ? BCM.marginPct*outputValue(i,t,false) : BCM.marginPct*(I + wageCost(t));
      const cost = BCM.paybackYears*BCM.weeksPerYear*profit/BCM.poundPerPoint;
      const pts = BCM.roundTo > 0 ? Math.round(cost/BCM.roundTo)*BCM.roundTo : Math.round(cost);
      return Math.max(1, pts);
    }
    function storedBuildCost(i,t){ return (t.building_cost != null ? t.building_cost : buildingCostModel(i,t)); }
    function capitalCost(i,t){ return storedBuildCost(i,t)*BCM.poundPerPoint; }
    function weeklyProfit(i,t){ const k = thruMult(t.key);
      return k*outputValue(i,t,true) - k*inputValue(t,true) - wageCost(t); }
    function paybackYears(i,t){ const p = weeklyProfit(i,t); return p > 0 ? capitalCost(i,t)/(BCM.weeksPerYear*p) : Infinity; }

    // Wages W are FIXED by the workforce, so (I + W)/O = target  =>  I = target/100 × O − W.
    // Only the MAIN recipe (t.inputs) scales: an active secondary PM's inputs are its own recipe, so they are
    // held fixed and subtracted off the goal first. OUTPUT is never touched — the ×1.5-per-tier output ladder
    // (BALANCE_FRAMEWORK §8) is the mod's core structure; inputs are the lever, matching solve_volumes.ps1.
    // Returns false when the target is unreachable (wages + secondary inputs already exceed target revenue).
    function solveTierToTarget(i,t){
      const Ob = outputValue(i,t,false), W = wageCost(t);
      const secI = selInVal(t._sec,false);
      const mainI = inputValue(t,false) - secI;
      if(!(mainI > 0 && Ob > 0)) return false;
      const targetMain = t.target_be/100*Ob - W - secI;
      const scale = Math.max(0, targetMain)/mainI;
      for(const g of Object.keys(t.inputs)) t.inputs[g] = Math.max(1, round(t.inputs[g]*scale));
      return targetMain > 0;
    }

    // ---------- reference (untiered vanilla) buildings ----------
    function refBuildings(){ return S.HAVE_VAN ? Object.keys(S.VAN.buildings).filter(b => !S.OURS.has(b)) : []; }
    function refSel(b){ const info = S.VAN.buildings[b], sel = S.REFSEL[b] || (S.REFSEL[b] = {});
      (info.pmgs||[]).forEach(pg => { if(!sel[pg]) sel[pg] = basePm(pg); }); return sel; }
    // throughput scales this building's goods but not its workforce (see BE/TPthr above)
    function refEcon(b){ const g = selGoods(refSel(b)), k = thruMult(b);
      const I = k*goodsVal(g.in,false), O = k*goodsVal(g.out,false), W = wageUnits(selEmp(refSel(b)))*refBaseWage(b);
      const Ith = k*goodsVal(g.in,true), Oth = k*goodsVal(g.out,true);
      return { I, O, W, goods:g, BE:(O>0 ? (I+W)/O*100 : null),
               tp:((I+W)>0 && O>0 ? (Oth-(Ith+W))/(Ith+W)*100 : null),
               p:(O>0 ? Oth-(Ith+W) : null) }; }
    function isSubsistenceBuilding(b){
      if(!S.HAVE_VAN) return /subsistence/.test(b);
      const g = (S.VAN.buildings[b]||{}).group || '';
      return GRPCAT[g] === 'subsistence' || /subsistence/.test(g) || /subsistence/.test(b);
    }

    // ---------- battalions ----------
    function unitTypes(){ return Object.keys(UNITG).filter(u => Object.keys(UNITG[u]||{}).length); }
    function unitRowKey(u, mob){ return u + '|' + (mob ? 'mob' : 'peace'); }
    function unitGoodsIO(u){ return {in:Object.assign({}, UNITG[u]||{}), out:{}}; }

    // ---------- population ----------
    function solOf(c){ const v = S.SOL[c]; return (v != null && v > 0) ? v : S.SOL.lower; }
    function popTotal(){ return CLASSES.reduce((s,c) => s + (S.POPS[c]||0), 0); }
    function depRatio(){ return (POPM.dependent_consumption_ratio != null ? POPM.dependent_consumption_ratio : 0.5); }

    // Share of the scenario's slaves employed in NON-subsistence buildings (0..1). DERIVED, not a knob,
    // from the same residual-employment logic the peasant/subsistence model uses: buildings hire first,
    // subsistence absorbs whoever is left.
    //   unqualified jobs U  = laborer + farmer jobs in the scenario's NON-subsistence buildings
    //   free pool F         = the LOWER stratum's working adults, who would otherwise fill them
    //   surplus jobs        = max(0, U − F), competed for by slaves and peasants
    //   slaves in real jobs = surplus × slaveWorkforce / (slaveWorkforce + peasantWorkforce)
    // It self-scales the way the subsistence model does: more industry ⇒ more slaves in real jobs ⇒ more
    // market demand. ⚠ Two stated assumptions, neither fitted. (1) Slaves fill LABORER and FARMER jobs.
    // (2) Slaves and peasants split the surplus in proportion to their workforce, the neutral choice:
    // "slaves first" gives the USA 0.38 and "peasants first" 0.05, and the measurement (0.225) sits
    // between. Scored: USA 0.209 against a measured 0.225, Britain 0.05 against 0.044. FINDINGS F27.
    function slaveRealShare(){
      const slaveWork = (S.POPS.slaves||0)*SLAVE_WORK_RATIO;
      if(!(slaveWork > 0)) return 0;
      const wr = (POPM.working_adult_ratio != null ? POPM.working_adult_ratio : 0.25);
      let U = 0;
      const add = emp => { for(const p in (emp||{})) if(UNQUALIFIED_PROFS.indexOf(p) >= 0) U += emp[p]; };
      S.IND.forEach(i => i.tiers.forEach(t => { const n = S.BLDNUM[t.key]||0; if(!n) return;
        const e = tierEmp(t), s = {}; for(const p in e) s[p] = e[p]*n; add(s); }));
      refBuildings().forEach(b => { const n = S.BLDNUM[b]||0; if(!n || isSubsistenceBuilding(b)) return;
        const e = selEmp(refSel(b)), s = {}; for(const p in e) s[p] = e[p]*n; add(s); });
      const surplus = Math.max(0, U - (S.POPS.lower||0)*wr);
      const peasWork = (S.POPS.peasants||0)*wr;
      const mine = surplus*(slaveWork/Math.max(1e-9, slaveWork + peasWork));
      return Math.min(1, mine/slaveWork);
    }
    // ⭐ F61 (re-derived 2026-08-16 by user ruling — supersedes F27's `share + 0.05×(1−share)` form):
    // the building-purchase multiplier is the EMPLOYED share ALONE. The 0.05 subsistence term
    // measurably worsens the melt reconstruction (USA 0.984 → 1.094); subsistence slaves consume
    // through the POP line instead, which slave pops now join (see popSpend).
    function slaveBasketMult(){ return slaveRealShare(); }

    // £/week each pop NEED is budgeted, for the current population and SoL.
    //   * each class buys the BUY PACKAGE of its wealth level, scaled by people / POP_SIZE_PACKAGE, by the
    //     per-head DEPENDENT factor (needs are per working adult; dependents need half → 0.25 + 0.75×0.5 =
    //     0.625 per head) and by its class multiplier (peasants 0.05 — the game's own `consumption_mult`:
    //     most of a peasant's needs are met inside the subsistence building and never reach the market).
    // ⭐ SLAVES ARE HERE TOO (F61, re-derived 2026-08-16 by user ruling): on 1.13.10 the game's Pop
    // Consumption line contains EVERY slave pop at its own wealth — melt-scored, the USA closes from
    // 0.863 to 1.003 only when all of them are included — at ordinary (wf + 0.5·dep) units, which for
    // slaves' working_adult_ratio 0.5 is 0.75/head, with NO class multiplier (the game has no
    // consumption_mult for slaves). Their wealth is the basket level (solOf('slaves')): measured slave
    // own-wealth means run 7.9–8.0 against the F27 basket 8, so the same knob serves both channels.
    // F27's "slaves are not a consuming class" is FALSE on 1.13.10 for the pop line.
    function popSpend(){
      const spend = {};
      const cm = POPM.class_mult||{}, PK = POPM.buy_packages||{};
      const wr = (POPM.working_adult_ratio != null ? POPM.working_adult_ratio : 0.25);
      const steps = 2*SOL_SPREAD + 1;
      ['upper','middle','lower','peasants','slaves'].forEach(cls => {
        const n = S.POPS[cls]||0; if(!(n > 0)) return;
        const r = (cls === 'slaves') ? SLAVE_WORK_RATIO : wr;
        const head = r + (1 - r)*depRatio();  // 0.625 ordinary classes, 0.75 slaves
        const lvl = solOf(cls);
        const units = n*head*(cm[cls] != null ? cm[cls] : 1)/(POPM.pop_size_package||10000)/steps;
        for(let k = -SOL_SPREAD; k <= SOL_SPREAD; k++){
          const pkg = PK[String(Math.max(1, Math.round(lvl + k)))]; if(!pkg) continue;
          for(const nd in pkg) spend[nd] = (spend[nd]||0) + pkg[nd]*units;
        }
      });
      return spend;
    }
    // £/week budgeted per NEED for the goods bought FOR the slaves — the F61 building line: one buy
    // package at the slaves' own wealth, for EMPLOYED (non-subsistence) slaves only, EVERY head at
    // FULL rate (units = size / POP_SIZE_PACKAGE — a building buys per slave, not per working-adult
    // equivalent; the 0.75 head factor belongs to the POP line, which slaves also join now).
    // Melt-scored (F61): this form reads USA 0.984 with spend-weighted per-good |err| 1.9%; the
    // (wf+0.5·dep)-units form reads 0.738 and the old F27 form 1.094. No SOL_SPREAD: the basket is a
    // single clamped number per building, and spreading it would push past the game's max.
    function slaveSpend(){
      const spend = {}, n = S.POPS.slaves||0; if(!(n > 0)) return spend;
      const pkg = (POPM.buy_packages||{})[String(Math.max(1, Math.round(solOf('slaves'))))]; if(!pkg) return spend;
      const units = n*slaveBasketMult()/(POPM.pop_size_package||10000);
      for(const nd in pkg) spend[nd] = pkg[nd]*units;
      return spend;
    }
    // pop + slave money per need, which is what the distribution fit sees: the observed order book cannot
    // tell the two channels apart, and both are split across a need's goods by the same rule.
    function allSpend(){ const s = popSpend(), t = slaveSpend(); for(const k in t) s[k] = (s[k]||0) + t[k]; return s; }

    // How a need's money splits across its goods. THE GAME'S DOCUMENTED RULE (vic3.paradoxwikis.com/Needs):
    //
    //   market share   = (sell orders − 0.5 × NON-POP buy orders) / Σ over the need's goods
    //   purchase weight= weight × market share, with market share clamped to the entry's
    //                    [min_supply_share, max_supply_share]
    //   units          = (need money / base price) × purchase weight / Σ purchase weights
    //
    // It needs no fixed point and no time series. Pops never sell, so supply does not depend on pop demand —
    // the allocation is one pass over the scenario's own sell orders. Nothing is stored per scenario.
    //
    // ⚠ The `− 0.5 × non-pop buy orders` term is the one that matters most and is the least guessable: a good
    // that industry consumes heavily has its market share SUPPRESSED for pops. Grain is the case in point —
    // abundant, but bought hard by mills — and leaving the term out over-fed grain by half. Measured on
    // Belgium within one run: pop demand error 30.3 % without it, **16.2 % with it** (FINDINGS F22).
    //
    // ⚠ The bounds CLAMP the market share. The wiki's summary says market share "has no effect" outside the
    // range, which reads as reverting to bare `weight` — that is measurably wrong: liquor is ~95 % of
    // Belgium's intoxicants supply, and reverting drops its predicted demand from 199 to 102 against an
    // observed 201. Clamping reproduces it.
    //
    // Units come from money ÷ base price, so goods are equivalent per POUND, not per unit. EVERY good the
    // need lists is a candidate: there is no availability gate — an unsupplied good scores a market share of
    // 0 and drops out on its own.
    //
    // `supply` is good -> sell orders. Falls back to POPDIST, then to the vanilla `weight`, when a need has
    // no supply at all in this scenario (an empty market must still produce a sane split).
    // ⚠ WHAT `max_supply_share` / `min_supply_share` ARE A BOUND *ON* IS AN OPEN QUESTION, and the two
    // readings are not close. `S.SPLIT_MODE` selects between them so the difference can be MEASURED
    // rather than argued (BALANCE_FRAMEWORK §10.34); it is an A/B switch, not a setting to configure.
    //
    //   'raw'   (default, the shipped reading) — the bound clamps the RAW supply share, which is then
    //           multiplied by weight and renormalised. ⚠ The renormalisation largely cancels the clamp:
    //           with one supplied good the cap shrinks its score and the total by the same factor, so
    //           transportation capped at 0.75 still lands on 99.7% of `popneed_communication`.
    //   'final' — the bound clamps each good's FINAL share of the need. Capped-proportional allocation:
    //           allocate by weight × supply share, clamp the resulting share to [min,max], hand the
    //           excess to the goods still unclamped, repeat. Under this reading transportation's 0.75
    //           entitles telephones to the other 25% from the moment anyone makes any, which is the
    //           demand a newly-invented good visibly gets in game.
    //
    // ⚠ CAPS YIELD WHEN NOTHING CAN ABSORB THE MONEY. A cap only redistributes to goods with effective
    // supply above zero; if every such good is already at its ceiling the remainder goes back to them in
    // proportion, ceilings ignored. Without this a need whose other goods do not exist yet — 1836
    // communication, free_movement, services, standard_clothing all have exactly one — would lose part of
    // its budget to a good nobody can sell, and F24's four zero-error single-good needs would break.
    // The rule keys on eff > 0, so a good the formula zeroes out (heavily industrially consumed) is
    // treated as unable to absorb, exactly as it already is in the 'raw' path.
    // ⭐⭐ AVAILABILITY IS A VALUE, NOT A COUNT (FINDINGS F40, measured 2026-08-07). The quantity that gets
    // normalised over a need is `(sell orders − ½ × non-pop demand) × BASE PRICE`, not the unit residual.
    // Measured directly against the purchase weights a savegame stores: within a fully clean need,
    // `sell × base` scores 0.59 pp against `sell` alone at 8.15 pp (British luxury_food, 4 goods) and
    // 1.63 pp against 5.43 pp (American basic_food, 5 goods). It is the same statement the game's own
    // localisation makes — "goods with a higher base price will contribute more to fulfilling a pop need…
    // a single unit of groceries is equivalent to several units of grain".
    // `S.AVAIL_MODE = 'units'` restores the old count-based reading for A/B measurement; it is not a setting.
    function needSplit(nd, def, supply, nonpop){
      const es = (def.entries||[]);
      if(!es.length) return null;
      const val = S.AVAIL_MODE === 'units' ? (() => 1) : (g => (S.PRICES[g]||0));
      // A `local` good is discounted to what one state actually sees of it — see LOCAL_MULT_DEFAULT above.
      const lm = S.LOCAL_MULT != null ? S.LOCAL_MULT : LOCAL_MULT_DEFAULT;
      const loc = g => LOCAL_GOODS.has(g) ? lm : 1;
      const eff = es.map(e => Math.max(0, ((supply||{})[e.g]||0) - 0.5*((nonpop||{})[e.g]||0)) * val(e.g) * loc(e.g));
      const tot = eff.reduce((a,b) => a + b, 0);
      if(!(tot > 0)){
        const pw = es.map(e => { const d = S.POPDIST[nd]; return (d && d[e.g] != null) ? d[e.g] : (e.w||0); });
        const s = pw.reduce((a,b) => a + b, 0);
        if(!(s > 0)) return null;
        return es.map((e,i) => ({g:e.g, s:pw[i]/s}));
      }
      if(S.SPLIT_MODE === 'final'){
        // score = weight × supply share, UNCLAMPED; the bounds act on the normalised result below.
        const base = es.map((e,i) => (e.w != null ? e.w : 1)*(eff[i]/tot));
        const live = es.map((e,i) => eff[i] > 0 && base[i] > 0);
        let pool = 0; for(let i = 0; i < es.length; i++) if(live[i]) pool += base[i];
        if(!(pool > 0)) return null;
        const sh = es.map((e,i) => live[i] ? base[i]/pool : 0);
        const fixed = es.map(() => false);
        // Clamp the worst violator, redistribute what it gave up (or took) across the goods still free,
        // and look again. One good is settled per pass, so it terminates in at most `es.length` passes.
        for(let pass = 0; pass < es.length; pass++){
          let hit = -1, over = 0;
          for(let i = 0; i < es.length; i++){
            if(!live[i] || fixed[i]) continue;
            const hi = es[i].max != null ? es[i].max : 1, lo = es[i].min || 0;
            const d = sh[i] > hi ? sh[i] - hi : (sh[i] < lo ? sh[i] - lo : 0);
            if(Math.abs(d) > Math.abs(over) + 1e-12){ over = d; hit = i; }
          }
          if(hit < 0) break;
          const hi = es[hit].max != null ? es[hit].max : 1, lo = es[hit].min || 0;
          sh[hit] = over > 0 ? hi : lo; fixed[hit] = true;
          let free = 0; for(let i = 0; i < es.length; i++) if(live[i] && !fixed[i]) free += sh[i];
          if(free > 0){ for(let i = 0; i < es.length; i++) if(live[i] && !fixed[i]) sh[i] += over*sh[i]/free; }
          else break;                                     // nothing free left to take it — the yield below
        }
        // YIELD: whatever the ceilings could not place (or the floors over-placed) goes back to the goods
        // that can actually supply it, in proportion. See the note above.
        let sum = 0; for(let i = 0; i < es.length; i++) sum += sh[i];
        if(!(sum > 0)) return null;
        return es.map((e,i) => ({g:e.g, s:sh[i]/sum}));
      }
      const pw = es.map((e,i) => {
        const ms = Math.min(e.max != null ? e.max : 1, Math.max(e.min||0, eff[i]/tot));
        return (e.w != null ? e.w : 1)*ms;
      });
      const s = pw.reduce((a,b) => a + b, 0);
      if(!(s > 0)) return null;
      return es.map((e,i) => ({g:e.g, s:pw[i]/s}));
    }
    // Turn a per-need money vector into per-good quantities. Shared by pop demand and the slave basket:
    // same needs, same split rule, different payer.
    function spendToGoods(spend, detail, supply, nonpop){
      const out = {};
      const note = (g,need,money,qty) => { if(!detail) return; (detail[g] = detail[g]||[]).push({need,money,qty}); };
      const ND = POPM.needs||{};
      for(const nd in spend){
        const def = ND[nd], money = spend[nd];
        if(!def || !(money > 0)) continue;
        const split = needSplit(nd, def, supply, nonpop);
        if(!split){ const g = def.def; if(g){ const q = money/(S.PRICES[g]||1); out[g] = (out[g]||0) + q; note(g, nd+' (fallback)', money, q); } continue; }
        split.forEach(e => { if(!(e.s > 0)) return;
          const m = money*e.s, q = m/(S.PRICES[e.g]||1); out[e.g] = (out[e.g]||0) + q; note(e.g, nd, m, q); });
      }
      return out;
    }

    // ---------- the scenario order book ----------
    // THROUGHPUT, per building type. Read off the building in-game (Building.GetThroughputBonusCurrent)
    // rather than summed from technology + law + company sub-factors. Scales inputs AND outputs together.
    function thruMult(b){ return 1 + (S.THRU[b]||0); }
    // tier's TOTAL goods (main PM baked into the building + its ACTIVE secondary PMs). Secondary outputs
    // include negative reductions (e.g. tank line −automobiles), so the map nets out per good.
    function tierGoodsIO(i,t){
      const inm = {...t.inputs}, outm = {}; const og = tierOut(i,t); outm[og] = (outm[og]||0) + t.output_qty;
      for(const pg in (t._sec||{})){ const sel = t._sec[pg]; if(sel === basePm(pg)) continue; const r = pmRec(sel);
        for(const g in r.in)  inm[g]  = (inm[g] ||0) + r.in[g];
        for(const g in r.out) outm[g] = (outm[g]||0) + r.out[g]; }
      return {in:inm, out:outm};
    }
    // ⭐⭐ GDP — THE GAME'S OWN DEFINITION, MEASURED, NOT A PROXY.
    //   annual GDP = 52 x weekly VALUE ADDED,  value added = building outputs - building INPUTS, at market
    //   prices. The wiki states it ("the market price value of national production reduced by the value of
    //   goods used as inputs"), and it is confirmed against the game's OWN persisted `gdp` series read out
    //   of three vanilla melted savegames beside the same saves' building input_goods/output_goods:
    //   median GDP / weekly value added = 52.44 (1901) · 51.44 (1912) · 49.94 (1920).
    // ⚠ IT IS NOT GROSS OUTPUT. Gross double-counts every intermediate, so its ratio to GDP FALLS as
    //   production chains lengthen — measured x48.5 in 1836 down to x36.7 in 1935. Anything calibrated
    //   against gross output is calibrated against a moving target; that is why this exists.
    // ⚠ POPS AND TRADE ARE NOT IN IT. Value added is a production-side quantity: what buildings make minus
    //   what buildings consume. Pop demand is final consumption and belongs on neither side.
    // ⭐ THE SCENARIO'S SHAPE — every building it contains, in the mod's seven standard sectors.
    // ONE classifier, shared by the UI summary and anything else that needs it, so "manufacturing from
    // raw inputs" cannot come to mean two things. Per TIER, not per industry: a ladder legitimately
    // crosses from raw to manufactured inputs as it modernises.
    // ⚠ EVERY building with a non-zero count lands somewhere. `other` is a real sector (government,
    // ownership, trade, construction, urban centres, universities), not a bin for things we failed to
    // classify — so the result also reports `otherGroups`, the vanilla building_groups that landed
    // there, which is what you read to check nothing fell through by accident.
    // ⚠ Infrastructure (port/railway/power) is classified by the SAME input test as any other tier
    // rather than getting a sector of its own: power eats coal and lands in raw, railway eats engines
    // and lands in manufactured. That is a deliberate choice, not an oversight.
    const SCEN_SECTORS = ['subsistence','agriculture','extraction','mfg_raw','mfg_mfg','military','other'];
    const AGRI_CATS = { farms:1, plantations:1, ranching:1, fishing_whaling:1 };
    const EXTRACT_CATS = { mining:1, logging:1, oil:1, rubber:1, gold_fields:1 };
    function scenarioValueAdded(agg){                       // £/week
      const a = agg || scenarioAggregates();
      let v = 0;
      for (const g in S.PRICES) v += (((a.outAgg[g]||0) - (a.inAgg[g]||0)) * mval1(g));
      return v;
    }
    function scenarioGDP(agg){ return scenarioValueAdded(agg) * WEEKS_PER_YEAR; }   // £/year
    // one good's unit price at the CURRENT scenario prices
    function mval1(g){ return (S.PRICES[g]||0) * ((S.thresholds[g] ?? 100)/100); }
    function scenarioAggregates(){
      const inAgg = {}, outAgg = {};
      S.IND.forEach(i => i.tiers.forEach(t => { const n = (S.BLDNUM[t.key]||0)*thruMult(t.key); if(!n) return;
        const g = tierGoodsIO(i,t);
        for(const k in g.in)  inAgg[k]  = (inAgg[k] ||0) + n*g.in[k];
        for(const k in g.out) outAgg[k] = (outAgg[k]||0) + n*g.out[k]; }));
      refBuildings().forEach(b => { const n = (S.BLDNUM[b]||0)*thruMult(b); if(!n) return; const g = selGoods(refSel(b));
        for(const k in g.in)  inAgg[k]  = (inAgg[k] ||0) + n*g.in[k];
        for(const k in g.out) outAgg[k] = (outAgg[k]||0) + n*g.out[k]; });
      // Battalions take no throughput bonus — the upkeep modifier is per battalion, not per building.
      unitTypes().forEach(u => { const g = unitGoodsIO(u);
        [false,true].forEach(mob => { const n = S.UNITNUM[unitRowKey(u,mob)]||0; if(!n) return;
          for(const k in g.in) inAgg[k] = (inAgg[k]||0) + n*g.in[k]; }); });
      // Pop demand and the slave basket LAST, fed this scenario's own sell orders: the within-need split
      // follows supply share, the way the game does it. Not circular — neither channel ever sells.
      // ⚠ Union of building output AND trade, not just outAgg: a good the market only IMPORTS has no
      // building output at all, and keying off outAgg alone made it invisible to the allocation.
      const supply = {};
      [...Object.keys(outAgg), ...Object.keys(S.ADDSELL)].forEach(g => supply[g] = (outAgg[g]||0) + (S.ADDSELL[g]||0));
      // NON-POP buy orders: buildings plus trade out. The market-share rule subtracts half of these.
      // ⚠ The slave basket is technically a BUILDING purchase, so on a strict reading it belongs in this
      // term too — but it is computed from the same market share it would then feed, and chasing that fixed
      // point buys nothing at 1836 slave counts.
      const nonpop = {};
      [...Object.keys(inAgg), ...Object.keys(S.ADDBUY)].forEach(g => nonpop[g] = (inAgg[g]||0) + (S.ADDBUY[g]||0));
      return { inAgg, outAgg, pop:spendToGoods(popSpend(), null, supply, nonpop),
                              slave:spendToGoods(slaveSpend(), null, supply, nonpop) };
    }
    function scenarioBuySell(agg, g){
      return { buy:(agg.inAgg[g]||0) + ((agg.pop||{})[g]||0) + ((agg.slave||{})[g]||0) + (S.ADDBUY[g]||0),
               sell:(agg.outAgg[g]||0) + (S.ADDSELL[g]||0) };
    }
    // Must pass the same supply the aggregate used, or the hover breakdown would explain a different number
    // than the column shows.
    function demandDetail(which){
      const d = {}, a = scenarioAggregates(), supply = {}, nonpop = {};
      [...Object.keys(a.outAgg), ...Object.keys(S.ADDSELL)].forEach(g => supply[g] = (a.outAgg[g]||0) + (S.ADDSELL[g]||0));
      [...Object.keys(a.inAgg), ...Object.keys(S.ADDBUY)].forEach(g => nonpop[g] = (a.inAgg[g]||0) + (S.ADDBUY[g]||0));
      spendToGoods(which === 'slave' ? slaveSpend() : popSpend(), d, supply, nonpop); return d;
    }

    // Victoria 3 market price (vic3.paradoxwikis.com/Market):
    //   price = base × [ 1 + 0.75 × clamp( (BUY − SELL) / min(BUY,SELL), ±1 ) ]  → 25%..175% of base.
    // Returned as a PERCENT (100 = base), which is exactly what `thresholds` stores. Edge cases (min ≤ 0):
    // one-sided market clamps to the extreme; an empty market (both 0) sits at base.
    function priceMultPct(buy, sell){
      buy = Math.max(0,buy); sell = Math.max(0,sell);
      if(buy === 0 && sell === 0) return 100;
      const mn = Math.min(buy,sell);
      let dev = mn > 0 ? (buy-sell)/mn : (buy > sell ? 1 : -1);
      dev = Math.max(-1, Math.min(1, dev));
      return Math.round((1 + 0.75*dev)*100);
    }
    // push every priced good's computed price into `thresholds` (what the UI's "auto" mode does).
    function syncPricesFromOrders(agg){
      agg = agg || scenarioAggregates();
      Object.keys(S.PRICES).forEach(g => { const {buy,sell} = scenarioBuySell(agg,g); S.thresholds[g] = priceMultPct(buy,sell); });
      return agg;
    }

    // ---------- constructing the editable tier model ----------
    // Build a group's editable tier list from a pristine config industry. Used at init AND by the
    // "Restore defaults" preset, so both produce identical fresh state.
    function makeTiers(i){ return i.tiers.map((t,ix) => ({
        key:t.key, name:t.name, tier:ix+1, output_qty:+t.output_qty, target_be:+t.target_be,
        tech:t.tech, natural_year:(t.natural_year != null ? +t.natural_year : null),
        era:(t.era != null ? +t.era : null),          // the mod's own 5-era ladder (independent of vanilla tech eras)
        // ⚠ THE DATE GATE'S INPUT MUST SURVIVE INTO THE MODEL (§10.44) — same lesson as input_ratio
        // below: a config field the model drops is a solver branch that silently never runs. The
        // scenario solver THROWS on a missing tech_year rather than falling back, which is how this
        // omission was caught in minutes instead of shipping.
        tech_year:(t.tech_year != null ? +t.tech_year : null),
        model_only:!!t.model_only,                     // modelled but NOT emitted (no real unlocking tech yet)
        output_good:t.output_good,                     // optional per-tier override (e.g. shipyard clippers→steamers)
        vanilla_pm:t.vanilla_pm,                       // base-game main PM this tier replaces
        building_cost:(t.building_cost != null ? +t.building_cost : null),
        wage_pct:(t.wage_pct != null ? +t.wage_pct : null),   // LEGACY config field, carried through on export
        // ⭐ per-tier recipe-solve profit override (§10.59, user-ruled 2026-08-16): replaces the band
        // edge AND the industry handicap for THIS tier's recipe solve (shipyard_steam e1 at +0.05).
        // Must survive into the model — same lesson as tech_year/input_ratio above: a dropped config
        // field is a solver branch that silently never runs (it did, for one full solve).
        solve_profit:(t.solve_profit != null ? +t.solve_profit : null),
        _baseWage:null,                                // this tier's own base wage; null ⇒ follows S.BASE_WAGE
        ai_value:(t.ai_value != null ? +t.ai_value : null),
        employment:(t.employment ? Object.fromEntries(Object.entries(t.employment).map(([k,v]) => [k,+v])) : null),
        pollution:(t.pollution != null ? +t.pollution : null),
        state_infrastructure:(t.state_infrastructure != null ? +t.state_infrastructure : null),
        ship_construction:(t.ship_construction != null ? +t.ship_construction : null),
        _sec:initSel((i.secondary_pmgs||[]).filter(pg => S.VAN.pmgs[pg])),
        inputs:Object.fromEntries(Object.entries(t.inputs).map(([g,q]) => [g,+q])),
        // ⚠ THE FROZEN RECIPE MIX MUST SURVIVE INTO THE MODEL. tools/era_scenarios.mjs solves only the
        // SCALE of a recipe and takes its proportions from an invariant source; `input_ratio` is that
        // source for the 22 model_only tiers, which have no vanilla recipe to fall back on. Dropping it
        // here made the solver's "frozen" branch unreachable, so those 22 re-derived their mix from the
        // inputs the previous `--write` had rounded — the last remaining channel of the write-cycle
        // wander (BALANCE_FRAMEWORK §10.25).
        input_ratio:(t.input_ratio ? Object.fromEntries(Object.entries(t.input_ratio).map(([g,q]) => [g,+q])) : null)
      })); }
    // Normalise the config's industries into the editable model. Returns a fresh array; the caller pushes
    // it into S.IND (mutated in place, so every alias of that array stays valid).
    function buildIND(industries){
      return (industries||[]).filter(i => !i.disabled).map(i => ({
        id:i.id, output_good:i.output_good,
        secondary_pmgs:(i.secondary_pmgs||[]).filter(pg => S.VAN.pmgs[pg]),
        follows_be:(i.follows_be !== false),   // false = stays on vanilla economics (ports, railways)
        no_mass_be:!!i.no_mass_be,             // new-economy buildings: excluded from mass BE tools by default
        ladder_end:i.ladder_end || null,       // 'plateau' | 'extinct' for a ladder that stops before era 5
        locked:!!i.no_mass_be,
        _open:false,
        tiers:makeTiers(i)
      }));
    }

    // Apply a saved market: OVERWRITE the building numbers, the non-building orders, the population, the
    // per-stratum SoL, the base wage and the PM selections (a preset records the PMs vanilla actually runs).
    // All of it is session state. Returns the PREVIOUS base wage when the preset moved it (null otherwise),
    // which is what the UI needs to re-inherit wages into unlocked groups.
    //
    // PRINCIPLE — a preset is a one-off overwrite, not a mode you sit in. Nothing may claim you are "in" a
    // preset afterwards; everything it knows about itself is reported once, when it is applied.
    function applyPreset(p){
      Object.keys(S.BLDNUM).forEach(k => delete S.BLDNUM[k]);
      Object.keys(S.ADDBUY).forEach(k => delete S.ADDBUY[k]);
      Object.keys(S.ADDSELL).forEach(k => delete S.ADDSELL[k]);
      Object.keys(S.REFSEL).forEach(k => delete S.REFSEL[k]);                        // reference PMs back to defaults
      S.IND.forEach(i => i.tiers.forEach(t => { t._sec = initSel(i.secondary_pmgs); })); // our secondaries back to base
      for(const k in (p.buildings||{})) S.BLDNUM[k] = p.buildings[k];
      // battalions: the peacetime row takes history's count, the mobilised row starts empty — 1836 is a
      // peace year, and a preset that silently mobilised everyone would misprice every military good.
      Object.keys(S.UNITNUM).forEach(k => delete S.UNITNUM[k]);
      for(const u in (p.units||{})) S.UNITNUM[unitRowKey(u,false)] = p.units[u];
      for(const k in (p.units_mob||{})) S.UNITNUM[unitRowKey(k,true)] = p.units_mob[k];
      Object.keys(S.THRU).forEach(k => delete S.THRU[k]);
      for(const b in (p.throughput||{})) S.THRU[b] = p.throughput[b];
      for(const g in (p.nonbuy ||{})) S.ADDBUY[g]  = p.nonbuy[g];
      for(const g in (p.nonsell||{})) S.ADDSELL[g] = p.nonsell[g];
      const byKey = {}; S.IND.forEach(i => i.tiers.forEach(t => byKey[t.key] = t));
      for(const b in (p.pms||{})){
        const sel = p.pms[b], t = byKey[b];
        if(t){ for(const pg in sel){ if(t._sec[pg] !== undefined) t._sec[pg] = sel[pg]; } }   // only real secondary PMGs
        else { const cur = (S.REFSEL[b] = S.REFSEL[b]||{}); for(const pg in sel) cur[pg] = sel[pg]; }
      }
      S.POPS = Object.assign({}, EMPTY_POPS, p.pops||{});
      if(p.sol) S.SOL = Object.assign({}, p.sol);
      // BASE WAGE — measured per market. A market's wage level is as much a property of the scenario as its
      // pops or its prices. A preset with no measured wage leaves the sheet's wage alone rather than
      // substituting the per-worker state average, which is a different quantity.
      // Per-building wage overrides are CLEARED: a preset overwrites the whole market, so its wage must
      // reach every building. Leaving them lets a locked group (and reference categories are locked by
      // default) keep a stale wage while the rest of the sheet moves, which silently prices part of the
      // economy at a wage the scenario never used.
      Object.keys(S.REFBASE).forEach(k => delete S.REFBASE[k]);
      S.IND.forEach(i => i.tiers.forEach(t => { t._baseWage = null; }));
      let wageOld = null;
      if(p.base_wage > 0 && p.base_wage !== S.BASE_WAGE){ S.BASE_WAGE = p.base_wage; }
      // the working-adult share is a property of the era being modelled, so a preset carries its own
      if(p.working_adult_ratio > 0) POPM.working_adult_ratio = p.working_adult_ratio;
      return wageOld;
    }

    return {
      state:S, makeTiers, buildIND, applyPreset,
      pmGated, basePm, initSel, pmRec, goodsVal, selInVal, selOutVal, selGoods, selEmp,
      tierOut, tierEmp, empTotal, wageUnits, tierBaseWage, refBaseWage, wageCost,
      inputValue, outputValue, BE, TPthr,
      buildingCostModel, storedBuildCost, capitalCost, weeklyProfit, paybackYears, solveTierToTarget,
      refBuildings, refSel, refEcon, isSubsistenceBuilding,
      unitTypes, unitRowKey, unitGoodsIO, UNITG,
      solOf, popTotal, depRatio, slaveRealShare, slaveBasketMult,
      popSpend, slaveSpend, allSpend, needSplit, spendToGoods,
      thruMult, tierGoodsIO, scenarioAggregates, scenarioBuySell, demandDetail,
      scenarioValueAdded, scenarioGDP,
      priceMultPct, syncPricesFromOrders,
      SLAVE_WORK_RATIO, SLAVE_SUBSISTENCE_MULT,
    };
  }

  // =================================================================================================
  // ILLOGICALITY — the acceptance criterion (BALANCE_FRAMEWORK §10.11), as ONE implementation shared by
  // the balance UI and tools/era_scenarios.mjs. The rule is what says whether the tech ladder works, so
  // two copies of it would be two different answers to the only question that matters.
  //
  // Three faults, counted per industry and SUMMING — a top tier that both loses money and is beaten by
  // the tier below it scores 2, because those are two separate things wrong with it:
  //   1. loss-making      the best tier present loses money
  //   2. stale-profitable a tier two or more eras behind it still turns a profit
  //   3. inverted         the best tier present earns less than the one below it
  //
  // ⚠⚠ PRESENCE IS THE GATE, AND IT IS NOT A DETAIL. Everything here is judged on the buildings the
  // scenario ACTUALLY CONTAINS, never on the config's tier list. A scenario is a thing you tinker with:
  // industries get zeroed out, tiers get set to 0, whole eras get emptied. In any of those cases the
  // arithmetic is still computable — a tier with no buildings still has a recipe and still reports a
  // margin — and counting it would report problems about factories that do not exist. So:
  //   * an industry with NO buildings at all contributes ZERO, however bad its numbers look;
  //   * a tier with count 0 is invisible: never a fault itself, and never the comparison partner
  //     for one;
  //   * `inverted` needs BOTH the best tier and a lower one present. No lower tier ⇒ no comparison
  //     ⇒ no fault. It must never be inflated by an absent building;
  //   * `stale-profitable` is measured in ERA DISTANCE from the best tier present (≥2), not by position
  //     in a list, so a gap in the ladder cannot turn a one-era-old tier into a "two-eras-stale" one.
  //
  // `profitOf` returns a FRACTION (0.2 = +20%), matching TPthr()/100.
  const LADDER_EXCUSED = new Set(['shipyard', 'shipyard_steam', 'art_academy']);
  // A shipyard at −10% is ON TARGET, not a fault: shipyards carry a deliberate −30pp penalty on a +20%
  // target because none of their income from naval ship construction is modelled (§10.2). Art academies
  // are excused wholesale rather than by threshold — fine_art's budget is fixed, so extra academies only
  // destroy their own price and no margin target is meaningful.
  // RAILWAY / PORT / POWER carry the SUBSIDY TOLERANCE (§10.47.4): vanilla's default AI strategy
  // subsidises all three at `must_have`, so in the game we mod a book loss down to −10% is subsidised
  // operation, not a fault. Scoring only — recipes are never enriched (the measured ERA_RAIL_PENALTY
  // failure). ⚠ Must match era_scenarios.mjs's ERA_SUBSIDY_TOL default; the criterion has ONE
  // implementation and these floors are part of it.
  const LADDER_LOSS_FLOOR = { shipyard: -0.10, shipyard_steam: -0.10,
                              railway: -0.10, port: -0.10, power: -0.10 };

  // ⭐ THE SCENARIO'S SHAPE — every building it contains, in the mod's seven standard sectors.
  // A PURE function taking callbacks, exactly like ladderFaults below and for exactly the same reason:
  // builder.html carries its own copy of the model's state, so a function that closed over `S` here
  // would be unreachable from the sheet and would end up implemented twice. "Manufacturing from raw
  // inputs" must not come to mean two things.
  // ⚠ EVERY building with a non-zero count lands somewhere. `other` is a REAL sector (government,
  // ownership, trade, construction, urban centres, universities), not a bin for unclassified things —
  // so the result also reports `otherGroups`, the vanilla building_groups that landed there, which is
  // what you read to confirm nothing fell through by accident.
  // ⚠ Infrastructure (port/railway/power) is classified by the SAME input test as any other tier rather
  // than getting a sector of its own: power eats coal and lands in raw, railway eats engines and lands
  // in manufactured. Deliberate, not an oversight.
  const SCEN_SECTORS = ['subsistence','agriculture','extraction','mfg_raw','mfg_mfg','military','other'];
  const AGRI_CATS = { farms:1, plantations:1, ranching:1, fishing_whaling:1 };
  const EXTRACT_CATS = { mining:1, logging:1, oil:1, rubber:1, gold_fields:1 };
  function scenarioSummary(industries, opts) {
    const o = opts || {};
    const countOf = o.countOf, outGood = o.tierOut, refs = o.refBuildings || (() => []);
    const groupOf = o.groupOf || (() => ''), isSub = o.isSubsistence || (() => false);
    const sectors = {}; for (const k of SCEN_SECTORS) sectors[k] = { levels: 0, types: 0 };
    const otherGroups = {};
    const manu = new Set();
    for (const i of industries) for (const t of i.tiers) manu.add(outGood(i, t));
    for (const i of industries) for (const t of i.tiers) {
      const n = countOf(t) || 0; if (!(n > 0)) continue;
      const k = Object.keys(t.inputs || {}).some(g => manu.has(g)) ? 'mfg_mfg' : 'mfg_raw';
      sectors[k].levels += n; sectors[k].types++;
    }
    for (const b of refs()) {
      const n = (o.countOfRef ? o.countOfRef(b) : 0) || 0; if (!(n > 0)) continue;
      const grp = groupOf(b) || '', cat = GRPCAT[grp] || '';
      let k;
      if (isSub(b)) k = 'subsistence';
      else if (AGRI_CATS[cat]) k = 'agriculture';
      else if (EXTRACT_CATS[cat]) k = 'extraction';
      else if (cat === 'military_consumers' || /^bg_(army|conscription|naval)/.test(grp)) k = 'military';
      else { k = 'other'; otherGroups[grp] = (otherGroups[grp] || 0) + n; }
      sectors[k].levels += n; sectors[k].types++;
    }
    return { sectors, order: SCEN_SECTORS, otherGroups };
  }

  function ladderFaults(industries, opts) {
    const o = opts || {};
    const countOf = o.countOf, profitOf = o.profitOf;
    const lossFloor = o.lossFloor || (ind => Math.min(0, LADDER_LOSS_FLOOR[ind.id] || 0));
    const skip = o.skip || (ind => ind.follows_be === false);
    const out = { loss: [], stale: [], inverted: [], byIndustry: {}, total: 0, net: 0, scored: 0 };
    for (const ind of industries) {
      if (skip(ind)) continue;
      // PRESENT tiers only, ascending by era. This one filter is what makes the count safe to look at
      // while editing a scenario.
      const present = ind.tiers.filter(t => countOf(t) > 0).sort((a, b) => a.era - b.era);
      if (!present.length) continue;                       // industry absent ⇒ nothing to judge
      out.scored++;
      const cur = present[present.length - 1];
      const below = present[present.length - 2];           // may be undefined — then no comparison
      const faults = [];
      const pc = profitOf(ind, cur);
      if (isFinite(pc) && pc < lossFloor(ind)) { out.loss.push(ind.id); faults.push('loss'); }
      // two-eras-stale, by ERA DISTANCE; any qualifying tier is enough, counted once per industry
      if (present.some(t => cur.era - t.era >= 2 && profitOf(ind, t) > 0)) {
        out.stale.push(ind.id); faults.push('stale');
      }
      if (below && isFinite(pc) && pc < profitOf(ind, below)) { out.inverted.push(ind.id); faults.push('inverted'); }
      if (faults.length) out.byIndustry[ind.id] = faults;
    }
    out.total = out.loss.length + out.stale.length + out.inverted.length;
    const ex = list => list.filter(id => !LADDER_EXCUSED.has(id)).length;
    out.net = ex(out.loss) + ex(out.stale) + ex(out.inverted);
    return out;
  }

  return { createEcon, WAGE_WEIGHT, WAGE_PROFS, WEEKS_PER_YEAR, AIVAL_DEFAULT,
           CLASSES, EMPTY_POPS, SOL_SPREAD, UNQUALIFIED_PROFS, GRPCAT, BCM, round,
           ladderFaults, scenarioSummary, LADDER_EXCUSED, LADDER_LOSS_FLOOR };
});
