// WHEN do industry research JEs fire, and FOR WHOM — against each technology's own onset year.
// Uses the canon-n2 logs (wall clock -> in-game date via run.log) and the save summaries' tech sets.
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
const S='tools/testbed/sessions/20260818_084128_canon-n2';
const RUNS=['run001_canonfull','run002_canonfull'];
const MAJORS=['GBR','RUS','FRA','USA','PRU','TUR','AUS','SPA','BRZ','SIC','POR','NET'];

// tech -> {onset year, era, category}
const tt=JSON.parse(readFileSync('config/tech_tree_options.json','utf8'));
const OPT=tt.options.find(o=>o.ships);
const raw=OPT.technologies??OPT.techs;
const arr=Array.isArray(raw)?raw:Object.entries(raw).map(([id,v])=>({id,...v}));
const TI={}; for(const t of arr) TI[t.id]={onset:t.onset??t.year??null, era:t.era, cat:t.category, name:t.name||t.id};

// which bars are war-gated (excluded here: this is the INDUSTRY channel)
const bars=readFileSync('mod/common/scripted_progress_bars/zzz_pm_rehaul_research_bars.txt','utf8');
const warSet=new Set(bars.split(/\npmr_bar_/).slice(1)
  .filter(b=>/pmr_wargate_|pmr_navown_/.test(b)).map(b=>b.slice(0,b.indexOf(' ')).trim()));

const NAME2TAG={'Great Britain':'GBR','United Kingdom':'GBR','Russia':'RUS','France':'FRA',
 'United States of America':'USA','Prussia':'PRU','Ottoman Empire':'TUR','Austria':'AUS','Spain':'SPA',
 'Brazil':'BRZ','Two Sicilies':'SIC','Portugal':'POR','Netherlands':'NET'};

const rows=[];            // {tech, tag|null, stage, year}
for(const run of RUNS){
  // wall-clock -> in-game year, from the observer's own tick lines
  const rl=readFileSync(join(S,run,'run.log'),'utf8');
  const ticks=[...rl.matchAll(/^\[(\d\d):(\d\d):(\d\d)\].*?in-game (\d{4})\.(\d+)\.(\d+)/gm)]
    .map(m=>({s:+m[1]*3600+ +m[2]*60+ +m[3], y:+m[4]+(+m[5]-1)/12}));
  if(ticks.length<5) continue;
  const at=sec=>{ // linear interpolation between the bracketing ticks
    if(sec<=ticks[0].s) return ticks[0].y;
    for(let i=1;i<ticks.length;i++) if(sec<=ticks[i].s){
      const a=ticks[i-1],b=ticks[i]; const f=(sec-a.s)/Math.max(1,b.s-a.s); return a.y+f*(b.y-a.y); }
    return ticks[ticks.length-1].y; };
  const meta=JSON.parse(readFileSync(join(S,run,'meta.json'),'utf8'));
  const START=meta.started.slice(11,19);
  for(const L of readFileSync(join(S,run,'logs_live','debug.log'),'utf8').split(/\r?\n/)){
    const m=L.match(/^\[(\d\d:\d\d:\d\d)\].*PMR_JE\|([a-z]+)\|([a-z0-9_]+)\|(.+)$/);
    if(!m||m[1]<START) continue;
    if(warSet.has(m[3])) continue;                     // industry channel only
    const [h,mi,se]=m[1].split(':').map(Number);
    rows.push({tech:m[3], stage:m[2], tag:NAME2TAG[m[4].trim()]||null, year:at(h*3600+mi*60+se), run});
  }
}
console.log(`industry JE firings parsed: ${rows.length}`);

// ---- most EGREGIOUS: implementation completed farthest before the tech's own onset ----
const impl=rows.filter(r=>r.stage==='implementation'&&TI[r.tech]?.onset);
const byTech={};
for(const r of impl){ (byTech[r.tech] ??= []).push(r); }
const egr=Object.entries(byTech).map(([tech,rs])=>{
  const first=Math.min(...rs.map(r=>r.year));
  return {tech, onset:TI[tech].onset, era:TI[tech].era, first, lead:TI[tech].onset-first,
          n:rs.length, majors:new Set(rs.filter(r=>MAJORS.includes(r.tag)).map(r=>r.tag)).size,
          countries:new Set(rs.map(r=>r.tag||'?')).size};
}).filter(x=>x.lead>0).sort((a,b)=>b.lead-a.lead);
console.log(`\n=== MOST EGREGIOUS: implementation granted before the technology's own onset year ===`);
console.log('  tech                          era  onset  first fired   years early   firings  majors');
for(const x of egr.slice(0,14))
  console.log('  '+x.tech.padEnd(28)+String(x.era).padStart(3)+String(x.onset).padStart(7)+
    x.first.toFixed(0).padStart(13)+('-'+x.lead.toFixed(0)).padStart(14)+String(x.n).padStart(9)+String(x.majors).padStart(8));

// ---- most SYSTEMIC: reach x earliness, weighted ----
const all=Object.entries(byTech).map(([tech,rs])=>({
  tech, onset:TI[tech].onset, era:TI[tech].era, n:rs.length,
  countries:new Set(rs.map(r=>r.tag||'?')).size,
  medLead: TI[tech].onset ? TI[tech].onset - rs.map(r=>r.year).sort((a,b)=>a-b)[Math.floor(rs.length/2)] : null,
})).filter(x=>x.medLead!=null && x.medLead>0);   // EARLY only: a negative lead means it fired after onset, which is not the fault
console.log(`\n=== MOST SYSTEMIC: reach x earliness (firings x median years early) ===`);
console.log('  tech                          era  onset  firings  distinct countries  median yrs early');
for(const x of all.sort((a,b)=>(b.n*b.medLead)-(a.n*a.medLead)).slice(0,12))
  console.log('  '+x.tech.padEnd(28)+String(x.era).padStart(3)+String(x.onset).padStart(7)+
    String(x.n).padStart(9)+String(x.countries).padStart(20)+x.medLead.toFixed(1).padStart(18));

// ---- distribution over time, and who ----
console.log(`\n=== WHEN (all industry stages, both runs pooled) ===`);
const dec={}; for(const r of rows){ const d=Math.floor(r.year/10)*10; dec[d]=(dec[d]||0)+1; }
const mx=Math.max(...Object.values(dec));
for(const d of Object.keys(dec).map(Number).sort((a,b)=>a-b))
  console.log('  '+d+'s '+String(dec[d]).padStart(5)+'  '+'#'.repeat(Math.round(40*dec[d]/mx)));
console.log(`\n=== FOR WHOM ===`);
const maj=rows.filter(r=>MAJORS.includes(r.tag)).length, other=rows.length-maj;
console.log(`  the 12 majors: ${maj} (${(100*maj/rows.length).toFixed(1)}%)   everyone else: ${other} (${(100*other/rows.length).toFixed(1)}%)`);
const perTag={}; for(const r of rows) if(MAJORS.includes(r.tag)) perTag[r.tag]=(perTag[r.tag]||0)+1;
console.log('  '+Object.entries(perTag).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+' '+v).join(' · '));
