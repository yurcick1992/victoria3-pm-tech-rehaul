import { readFileSync } from 'node:fs';
import * as fs from 'node:fs';
const SP='C:/Users/User/AppData/Local/Temp/claude/C--claude-code-victoria-3-PM-and-tech-rehaul/8ddababb-019a-4319-9548-3fda4e90b426/scratchpad/';
const J=JSON.parse(readFileSync(SP+'pool.json','utf8'));
const med=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;};

// samples: cost (sec per in-game year) against the two drivers DD76 names
for(const r of J.runs){ try{ r._save=JSON.parse(fs.readFileSync('tools/testbed/sessions/'+r.label.split('/')[0]+'/schedule.json','utf8')).defaults?.autosave_interval||'yearly'; }catch(e){ r._save='yearly'; } }
const rows=[];
for(const r of J.runs){
  if(!r.complete) continue;
  for(const p of r.curve){
    // ⚠ autosave cadence is instrumentation, not economy: a monthly-save run writes 12x as often and
    // the engine stalls on every write. Excluded rather than fitted around.
    if(r._save && r._save!=='yearly') continue;
    if(p.spy>0 && p.pops>0 && p.levels>0)
      rows.push({run:r.label, v:r._v, y:p.spy, a:p.pops/1e3, b:p.levels/1e3});
  }
}
console.log(`samples ${rows.length} over ${new Set(rows.map(r=>r.run)).size} complete runs`);

function fit(pts, cols){                      // least squares, cols = array of x-extractors
  const k=cols.length, S=Array.from({length:k},()=>new Array(k).fill(0)), T=new Array(k).fill(0);
  for(const p of pts){ const x=cols.map(f=>f(p));
    for(let i=0;i<k;i++){ T[i]+=x[i]*p.y; for(let j=0;j<k;j++) S[i][j]+=x[i]*x[j]; } }
  const M=S.map((r,i)=>[...r,T[i]]);
  for(let i=0;i<k;i++){ let mx=i; for(let q=i+1;q<k;q++) if(Math.abs(M[q][i])>Math.abs(M[mx][i])) mx=q;
    [M[i],M[mx]]=[M[mx],M[i]];
    for(let q=0;q<k;q++){ if(q===i) continue; const f=M[q][i]/M[i][i]; for(let j=i;j<=k;j++) M[q][j]-=f*M[i][j]; } }
  return M.map((r,i)=>r[k]/r[i][i] ?? 0).map((v,i)=>M[i][k]/M[i][i]);
}
const cv=(pts,pred)=>{const v=pts.map(p=>p.y/pred(p));const m=v.reduce((s,x)=>s+x,0)/v.length;
  return Math.sqrt(v.reduce((s,x)=>s+(x-m)**2,0)/v.length)/m;};
const BASE=[p=>1,p=>p.a,p=>p.b];
const show=(c)=>`cost = ${c[0].toFixed(2)} + ${c[1].toFixed(4)}·kpops + ${c[2].toFixed(4)}·klevels`;

// ---- pass 1: everything ----
let c=fit(rows,BASE);
const pred=cc=>p=>cc[0]+cc[1]*p.a+cc[2]*p.b;
console.log(`\npass 1 (all): ${show(c)}   cv ${cv(rows,pred(c)).toFixed(3)}`);

// ---- outlier detection: a run whose median actual/predicted sits far from the pack ----
const runsOf=pts=>[...new Set(pts.map(p=>p.run))];
const ratios={}; for(const rn of runsOf(rows)) ratios[rn]=med(rows.filter(p=>p.run===rn).map(p=>p.y/pred(c)(p)));
const rv=Object.values(ratios), mid=med(rv);
const mad=med(rv.map(x=>Math.abs(x-mid)))||1e-9;
console.log(`\nper-run cost multiplier (median actual ÷ predicted): centre ${mid.toFixed(3)}, MAD ${mad.toFixed(3)}`);
const out=[];
for(const [rn,x] of Object.entries(ratios).sort((a,b)=>b[1]-a[1])){
  const z=(x-mid)/(1.4826*mad);
  const flag=Math.abs(z)>3.5?'  <-- OUTLIER':'';
  if(Math.abs(z)>3.5) out.push(rn);
  if(Math.abs(z)>2||flag) console.log(`   ${x.toFixed(3)}  z=${z.toFixed(1).padStart(5)}  ${rn}${flag}`);
}
if(!out.length) console.log('   (no run beyond z=3.5)');

// ---- pass 2: outliers discarded ----
const kept=rows.filter(p=>!out.includes(p.run));
c=fit(kept,BASE);
console.log(`\npass 2 (${out.length} run(s) discarded): ${show(c)}   cv ${cv(kept,pred(c)).toFixed(3)}`);

// ---- does GAME VERSION matter? add a 1.13.10 dummy, and compare like-for-like ----
const withV=fit(kept,[...BASE,p=>p.v==='1.13.10'?1:0]);
console.log(`\nversion term: 1.13.10 adds ${withV[3].toFixed(2)} s/yr (intercept ${withV[0].toFixed(2)})`);
const cvV=cv(kept,p=>withV[0]+withV[1]*p.a+withV[2]*p.b+(p.v==='1.13.10'?withV[3]:0));
console.log(`   cv with version ${cvV.toFixed(3)}  vs without ${cv(kept,pred(c)).toFixed(3)}  -> ${cvV<cv(kept,pred(c))-0.002?'version matters':'NO material effect'}`);
for(const v of ['1.13.9','1.13.10']){
  const s=kept.filter(p=>p.v===v);
  if(!s.length) continue;
  console.log(`   ${v}: ${s.length} samples, median actual÷predicted ${med(s.map(p=>p.y/pred(c)(p))).toFixed(3)}`);
}

// ---- what the model buys against single drivers ----
console.log(`\nflatness (cv of cost ÷ model), kept samples:`);
console.log(`   two-term pops+levels   ${cv(kept,pred(c)).toFixed(3)}`);
console.log(`   levels only            ${cv(kept,p=>p.b).toFixed(3)}`);
console.log(`   pop objects only       ${cv(kept,p=>p.a).toFixed(3)}`);
console.log(`   raw                    ${cv(kept,p=>1).toFixed(3)}`);
const lp=kept.map(p=>p.b/p.a);
console.log(`\nlevels-per-kpop spread across the pool: ${Math.min(...lp).toFixed(2)} – ${Math.max(...lp).toFixed(2)} (median ${med(lp).toFixed(2)})`);
