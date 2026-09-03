// Does a rung sit on a technology from a LATER era than the rung itself? And if so, can that
// technology be moved down an era without inverting a prerequisite (hard rule: a technology may not
// have a prerequisite from a HIGHER era), or is it at least EARLY in its own era?
import {readFileSync} from 'fs';
const rd=p=>JSON.parse(readFileSync(p,'utf8'));
const cfg=rd('config/mod_config.tier4.json');
const T=rd('config/tech_tree_options.tier4.json').options[0].techs;
const by=Object.fromEntries(T.map(t=>[t.id,t]));
const LEAD=[2,3,4,5];                       // our rung index -> mechanical era a leader has reached
// depth of a technology inside its OWN era: longest chain of same-era prerequisites behind it
const depth=(id,seen=new Set())=>{const t=by[id]; if(!t||seen.has(id))return 0; seen.add(id);
  const same=(t.prereqs||[]).filter(p=>by[p]&&by[p].era===t.era);
  return same.length?1+Math.max(...same.map(p=>depth(p,seen))):0;};
const canDrop=id=>{const t=by[id]; if(!t)return null;
  const bad=(t.prereqs||[]).filter(p=>by[p]&&by[p].era>=t.era);   // would become higher-era after a drop
  return bad.length?bad:[];};
const rows=[];
for(const i of cfg.industries){ if(i.disabled)continue;
  (i.tiers||[]).forEach((t,n)=>{const g=by[t.tech]; if(!g)return;
    const target=LEAD[n]??LEAD[LEAD.length-1];
    if(g.era<=target) return;                                     // at or below its rung's era: fine
    rows.push({ind:i.id,rung:n,tech:t.tech,era:g.era,target,depth:depth(t.tech),block:canDrop(t.tech)});});}
console.log('RUNGS GATED BY A TECHNOLOGY FROM A LATER ERA THAN THE RUNG\n');
if(!rows.length){console.log('  none.');process.exit(0);}
console.log('  industry      rung  technology                 tech era  rung target  in-era depth  drop one era?');
for(const r of rows.sort((a,b)=>b.era-a.era||a.ind.localeCompare(b.ind)))
  console.log('  '+r.ind.padEnd(13)+'e'+r.rung+'    '+r.tech.padEnd(26)+String(r.era).padStart(5)+String(r.target).padStart(12)+String(r.depth).padStart(13)+'   '+
    (r.block.length?'NO - prereq '+r.block.join(',')+' would end up higher':'yes, no prerequisite blocks it'));
const d=rows.map(r=>r.depth);
console.log('\n  in-era prerequisite depth: min '+Math.min(...d)+'  max '+Math.max(...d)+
  '   (0 = the technology sits at the START of its era, nothing same-era behind it)');
console.log('  movable down one era without inverting anything: '+rows.filter(r=>!r.block.length).length+' of '+rows.length);
