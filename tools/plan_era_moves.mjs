// Which technologies must move UP so no t3 rung is gated below era 4, and what does each move drag?
// HARD RULE: a technology may not have a prerequisite from a HIGHER era. So raising X to era E forces
// every technology that DEPENDS on X to be at least E as well.
import {readFileSync} from 'fs';
const rd=p=>JSON.parse(readFileSync(p,'utf8'));
const cfg=rd('config/mod_config.tier4.json');
const T=rd('config/tech_tree_options.tier4.json').options[0].techs;
const by=Object.fromEntries(T.map(t=>[t.id,t]));
const TARGET=+(process.argv[2]||4);            // minimum era for a top rung's gate
const era=id=>(by[id]||{}).era ?? null;
const dependents=id=>T.filter(x=>(x.prereqs||[]).includes(id));
// seeds: the gate of every industry's LAST rung, if below TARGET
const seeds=new Map();
for(const i of cfg.industries){ if(i.disabled)continue;
  const ts=i.tiers||[]; if(!ts.length)continue;
  const top=ts[ts.length-1]; const e=era(top.tech);
  if(e!=null && e<TARGET) seeds.set(top.tech, Math.max(seeds.get(top.tech)||0, TARGET));}
// close under "dependents must be >= the raised era"
const want=new Map(seeds);
let changed=true;
while(changed){ changed=false;
  for(const [id,e] of [...want]) for(const d of dependents(id)){
    const need=Math.max(want.get(d.id)||era(d.id)||0, e);
    if(need>(want.get(d.id)||era(d.id)||0)){ want.set(d.id,need); changed=true; } } }
console.log(`RAISING EVERY TOP-RUNG GATE TO ERA >= ${TARGET}\n`);
console.log('  SEEDS (a top rung sitting too low):');
for(const [id,e] of seeds) console.log('     '+id.padEnd(26)+'era '+era(id)+' -> '+e+
  '   tops: '+cfg.industries.filter(i=>!i.disabled&&(i.tiers||[]).length&&i.tiers[i.tiers.length-1].tech===id).map(i=>i.id).join(', '));
const drag=[...want].filter(([id,e])=>!seeds.has(id));
console.log('\n  DRAGGED ALONG (dependents that must rise too): '+drag.length);
for(const [id,e] of drag.sort((a,b)=>a[1]-b[1]))
  console.log('     '+id.padEnd(26)+'era '+era(id)+' -> '+e+'   ('+(by[id].origin||'?')+', gates: '+
    (cfg.industries.filter(i=>!i.disabled).flatMap(i=>(i.tiers||[]).filter(t=>t.tech===id).map(t=>i.id+' t'+t.era)).join(', ')||'no rung of ours')+')');
const over=[...want].filter(([id,e])=>e>5);
console.log('\n  would exceed era 5 (impossible): '+(over.length?over.map(o=>o[0]).join(', '):'none'));
console.log('  total technologies moved: '+want.size);
// what our rungs would then sit on
console.log('\n  RESULTING TOP-RUNG GATE ERAS:');
for(const i of cfg.industries){ if(i.disabled)continue; const ts=i.tiers||[]; if(!ts.length)continue;
  const top=ts[ts.length-1]; const e=want.get(top.tech)??era(top.tech);
  console.log('     '+i.id.padEnd(13)+'t'+top.era+'  '+String(top.tech).padEnd(26)+'era '+e+(e<TARGET?'   STILL LOW':''));}
