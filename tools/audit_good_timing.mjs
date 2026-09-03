// GOOD BY GOOD: when can it first be PRODUCED, and when is it first DEMANDED by a building?
// A consumer reachable before any producer is a chain that cannot run; a producer long before any
// consumer is a building nobody will staff. ⚠ POP demand is fine either way and is not counted.
import {readFileSync,readdirSync} from 'fs';
import {readVanilla} from './lib_vanilla_ladder.mjs';
const rd=p=>JSON.parse(readFileSync(p,'utf8'));
const GAME=process.env.VIC3_GAME||'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const V=readVanilla(GAME);
const cfg=rd('config/mod_config.tier4.json');
const T=rd('config/tech_tree_options.tier4.json').options[0].techs;
const by=Object.fromEntries(T.map(t=>[t.id,t]));
const eraOf=id=>(by[id]||{}).era ?? 1;
const prodEra={}, consEra={}, prodWho={}, consWho={};
// our tiered industries
for(const i of cfg.industries){ if(i.disabled) continue;
  for(const t of i.tiers||[]){ const e=eraOf(t.tech);
    const g=i.output_good; if(g){ if(prodEra[g]==null||e<prodEra[g]){prodEra[g]=e;prodWho[g]=i.id+' t'+t.era;} }
    for(const c of Object.keys(t.inputs||{})) if(consEra[c]==null||e<consEra[c]){consEra[c]=e;consWho[c]=i.id+' t'+t.era;} } }
// every vanilla building we still ship (mines, farms, the vanilla power plant, ports, railways …)
const modBld=new Set(); for(const f of readdirSync('mod/common/buildings')) {}
for(const [k,body] of Object.entries(V.BLD)){
  const m=/production_method_groups\s*=\s*\{([\s\S]*?)\}/.exec(body); if(!m) continue;
  const bg=/unlocking_technologies\s*=\s*\{([\s\S]*?)\}/.exec(body);
  const be=bg?eraOf((bg[1].match(/[a-z_0-9-]+/g)||[])[0]):1;
  for(const g of (m[1].match(/[a-z_0-9-]+/g)||[])) for(const pm of (V.PMG[g]||[])){
    const pe=Math.max(be, eraOf(V.gatesOf(pm)[0]));
    const gd=V.goodsOf(pm);
    for(const o of Object.keys(gd.out)) if(prodEra[o]==null||pe<prodEra[o]){prodEra[o]=pe;prodWho[o]=k;}
    for(const c of Object.keys(gd.in))  if(consEra[c]==null||pe<consEra[c]){consEra[c]=pe;consWho[c]=k;} } }
const goods=[...new Set([...Object.keys(prodEra),...Object.keys(consEra)])].sort();
const gaps=[];
for(const g of goods){ const p=prodEra[g], c=consEra[g];
  if(p==null||c==null) continue;
  if(c<p) gaps.push({g,kind:'CONSUMER FIRST',d:p-c,p,c});
  else if(p<c-1) gaps.push({g,kind:'producer early',d:c-p,p,c}); }
console.log('GOOD TIMING — building demand vs building supply (pop demand excluded)\n');
const bad=gaps.filter(x=>x.kind==='CONSUMER FIRST');
console.log('  CONSUMER REACHABLE BEFORE ANY PRODUCER ('+bad.length+') — a chain that cannot run:');
for(const x of bad.sort((a,b)=>b.d-a.d))
  console.log('     '+x.g.padEnd(16)+'consumed era '+x.c+' by '+String(consWho[x.g]).padEnd(26)+' produced era '+x.p+' by '+prodWho[x.g]);
const early=gaps.filter(x=>x.kind==='producer early');
console.log('\n  PRODUCER 2+ ERAS BEFORE ANY BUILDING CONSUMER ('+early.length+') — pops may still buy it:');
for(const x of early.sort((a,b)=>b.d-a.d))
  console.log('     '+x.g.padEnd(16)+'produced era '+x.p+' by '+String(prodWho[x.g]).padEnd(26)+' first building consumer era '+x.c+' ('+consWho[x.g]+')');
