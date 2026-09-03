import {readVanilla,mainLadder} from './lib_vanilla_ladder.mjs';
import {readFileSync} from 'fs';
const G='C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const V=readVanilla(G);
const rd=p=>JSON.parse(readFileSync(p,'utf8'));
const t4=rd('config/mod_config.tier4.json'), canon=rd('config/mod_config.json');
const T=rd('config/tech_tree_options.tier4.json').options[0].techs;
const tmeta=id=>T.find(x=>x.id===id);
// RULED clash resolutions (user, 2026-08-30)
const RULED={ glass:['pm_forest_glass','pm_leaded_glass','pm_crystal_glass','pm_houseware_plastics'],
              paper:['pm_pulp_pressing','pm_bleached_paper','pm_sulfite_pulping'],   // reordered by date
              explosives:['pm_leblanc_process','pm_ammonia-soda_process','pm_vacuum_evaporation','pm_brine_electrolysis'],
              arms:['pm_muskets','pm_rifles','pm_repeaters','pm_bolt_action_rifles'],
              artillery:['pm_cannons','pm_smoothbores','pm_breech_loaders','pm_recoiled_barrels'] };
// vanilla production technologies not gating anything in the proposal yet -> peg candidates
const used=new Set();
const rows=[];
for(const i of t4.industries){
  if(i.id==='power'){ rows.push({id:'power',vanilla:true}); continue; }
  if(i.disabled){ rows.push({id:i.id,disabled:true}); continue; }
  const ci=canon.industries.find(x=>x.id===i.id);
  const L=mainLadder(V,i,ci);
  const methods=RULED[i.id]||L.methods;
  const rungs=methods.map(p=>{const g=V.gatesOf(p)[0]||null; if(g)used.add(g);
    const m=g?tmeta(g):null; return {pm:p,gate:g,era:m?m.era:0,year:m?(m.year??m.onset):null};});
  rows.push({id:i.id,group:L.group,rungs,need:Math.max(0,(i.tiers||[]).length-rungs.length)});
}
const freeProd=T.filter(t=>t.origin==='vanilla'&&t.category==='production'&&!used.has(t.id))
  .map(t=>({id:t.id,era:t.era,y:t.year??t.onset})).sort((a,b)=>a.y-b.y);
console.log('PROPOSED LADDERS — built FROM vanilla, with the ruled clash resolutions\n');
for(const r of rows){
  if(r.vanilla){console.log('  power         -> VANILLA-SHAPED (disabled), pm_early_power_plant removed from its PMG\n');continue;}
  if(r.disabled){console.log('  '+r.id.padEnd(13)+'-> vanilla (already disabled)\n');continue;}
  console.log('  '+r.id+(r.need?'   [needs '+r.need+' invented rung(s)]':'   [1:1 with vanilla]'));
  r.rungs.forEach((x,n)=>console.log('     e'+n+'  '+x.pm.padEnd(28)+'gate '+String(x.gate||'(ungated)').padEnd(26)+'van era '+x.era+'  '+(x.year||'start')));
  console.log();}
console.log('VANILLA PRODUCTION TECHNOLOGIES STILL FREE (peg candidates for invented rungs), by year:');
for(const f of freeProd) console.log('   '+String(f.y).padStart(6)+'  era '+f.era+'  '+f.id);
