// ============================================================================================
// THE LADDER WORKBENCH — the ANALYSIS page that sits beside the balance sheet.
//
// The sheet (tools/build_ui2.mjs) is the editor: what each building costs and earns, tunable. This is
// the reading instrument for the questions the sheet cannot show on one screen — does a rung actually
// die two eras on, what margin does vanilla itself run at, and does each good's price follow the
// design. Called from build_ui2.mjs with `--report`; it writes an artifact-safe page (no document
// tags) plus nothing else.
//
// It wears ui/builder.html's tokens for the same reason the sheet does: one project, one look.
// ============================================================================================
import { readFileSync, writeFileSync, statSync } from 'node:fs';

export function buildReport({ REPO, INV, INV_PATH, MRG_PATH, CMP_PATH, OUT }) {
  const A = INV;
  let C = null; try { C = JSON.parse(readFileSync(CMP_PATH || (REPO + '/config/era_inverse.json'), 'utf8')); } catch { }
  let M = null; try { M = JSON.parse(readFileSync(MRG_PATH, 'utf8')); } catch { }

  const headline = j => {
    if (!j) return null;
    const recipes = Object.values(j.recipes || {}), caps = {};
    for (const r of recipes) caps[r.cap || 'on target'] = (caps[r.cap || 'on target'] || 0) + 1;
    const nEra = (j.eras || []).length, AL = j.analytic_ladder || [];
    let checked = 0, dead = 0;
    for (const ind of (j.industries || [])) {
      const last = Math.max(...ind.eras);
      for (const e of ind.eras) {
        if (e >= last || e + 2 > nEra - 1) continue;
        const m = ((AL[e + 2] || {}).margins || {})[ind.id];
        if (!m || m[e] == null) continue;
        checked++; if (m[e] < 0) dead++;
      }
    }
    return { eras: nEra, years: (j.eras || []).map(e => e.year), tiers: recipes.length,
      industries: (j.industries || []).length,
      onTarget: caps['on target'] || 0, lean: (caps['lean-floor'] || 0) + (caps['insolvent-at-target'] || 0),
      ratchet: caps['ratchet'] || 0, deadChecked: checked, dead,
      illogicality: AL.length ? AL.reduce((a, x) => a + (x.faults ? x.faults.net : 0), 0) : null,
      seeded: (j.scenarios || []).reduce((a, s) => a + ((s.faults && s.faults.net) || 0), 0),
      slopeClamps: Object.entries((j.granular || {}).slopes || {}).filter(([, v]) => v <= 0.7001 || v >= 0.9199).map(([g]) => g),
      margins: (j.granular || {}).margins || null };
  };

  const { presets, ...DATA } = A;
  DATA._headline = headline(A);
  DATA._compare = headline(C);
  DATA._vanillaMargins = M;
  DATA._source = { artifact: INV_PATH.replace(REPO, '').replace(/^[\\/]/, ''), margins: M ? MRG_PATH.replace(REPO, '').replace(/^[\\/]/, '') : null };
  const stamp = new Date().toISOString().replace('T', ', ').slice(0, 17) + ' UTC';

  const HTML = String.raw`<title>Four-Rung Ladder</title>
<style>
:root{
  --bg:#12161c; --panel:#1b212b; --panel2:#222a36; --line:#2e3947; --ink:#e6ebf2;
  --muted:#93a1b3; --accent:#5aa9ff; --good:#4ec98f; --bad:#e8735a; --warn:#e6b455;
  --tier1:#e8735a; --tier2:#e6b455; --tier3:#8ecb6a; --tier4:#5aa9ff; --tier5:#b98cff;
  --era0:#8a7d5b; --gold:#d9a441; --blue:#5c9ede;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,Segoe UI,Roboto,sans-serif}
header{position:sticky;top:0;z-index:5;background:var(--panel);border-bottom:1px solid var(--line);
  padding:10px 16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
header h1{font-size:15px;margin:0 8px 0 0;font-weight:650;letter-spacing:.2px}
header .sp{flex:1}
header .stamp{color:var(--muted);font-size:11px;font-variant-numeric:tabular-nums}
button{background:var(--panel2);color:var(--ink);border:1px solid var(--line);border-radius:7px;
  padding:5px 11px;font:inherit;cursor:pointer}
button:hover{border-color:var(--accent)}
button[aria-selected="true"],button[aria-pressed="true"]{background:var(--accent);color:#0a0e14;border-color:var(--accent);font-weight:650}
button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
main{padding:16px;max-width:1520px;margin:0 auto}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;margin-bottom:16px;overflow:hidden}
.card>.hd{padding:9px 14px;background:var(--panel2);border-bottom:1px solid var(--line);font-weight:650;
  display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.card>.hd .tag{color:var(--muted);font-weight:400;font-size:12px}
.card>.bd{padding:12px 14px}
.scrollx{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:13px}
th,td{padding:5px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:middle}
th{color:var(--muted);font-weight:600;font-size:11.5px;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap}
tbody tr:last-child td{border-bottom:none}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
.muted{color:var(--muted)} .good{color:var(--good)} .bad{color:var(--bad)}
.pill{display:inline-block;min-width:20px;text-align:center;border-radius:6px;padding:1px 7px;font-size:11px;font-weight:700;color:#0a0e14}
.note{color:var(--muted);font-size:12.5px;max-width:104ch;margin:0 0 10px}
.note b{color:var(--ink);font-weight:600}
.mx td{padding:3px 8px} .mx tr.first td{border-top:1px solid var(--line)}
.mx td.ind{font-weight:650;white-space:nowrap} .mx td.rung{white-space:nowrap;color:var(--muted);font-size:11.5px}
.mx th.era{text-align:center}
.cell{display:block;text-align:center;border-radius:5px;padding:3px 2px;font-size:12px;font-weight:650;font-variant-numeric:tabular-nums}
.cell.void{color:var(--muted);opacity:.35;font-weight:400}
.cell.own{box-shadow:inset 0 0 0 1.5px var(--ink)}
.verd{font-variant-numeric:tabular-nums;font-size:12px;white-space:nowrap}
.legend{display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin-top:10px;font-size:12px;color:var(--muted)}
.legend i{display:inline-block;width:22px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.chips{display:flex;flex-wrap:wrap;gap:9px;margin-bottom:12px}
.chip{background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:7px 12px;min-width:98px}
.chip .k{color:var(--muted);font-size:10.5px;text-transform:uppercase;letter-spacing:.4px}
.chip .v{font-size:17px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.25}
.chip .x{color:var(--muted);font-size:11px}
.cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px}
@media (max-width:1100px){.cols{grid-template-columns:minmax(0,1fr)}}
.paths{display:grid;grid-template-columns:repeat(auto-fill,minmax(212px,1fr));gap:10px}
.path{border:1px solid var(--line);border-radius:8px;padding:9px 11px 6px;background:var(--panel2)}
.path .t{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.path .t b{font-size:12.5px;font-weight:650}
.path .t span{font-size:10.5px;color:var(--muted);font-variant-numeric:tabular-nums}
.path svg{display:block;width:100%;height:56px;margin:4px 0 2px}
ul.tight{margin:6px 0 0;padding-left:18px} ul.tight li{margin:5px 0;color:var(--muted);font-size:12.5px}
ul.tight li b{color:var(--ink);font-weight:600}
</style>

<header>
  <h1>Four-Rung Ladder — workbench</h1>
  <span class="tag muted" id="sub"></span>
  <span class="sp"></span>
  <span class="stamp" id="stamp"></span>
</header>
<main>
  <div class="card"><div class="hd">Does it hold up<span class="tag">the four-rung book against the shipped six-rung canon, same solver</span></div>
    <div class="bd">
      <p class="note">The six-rung ladder is over its price budget. The death condition needs a per-rung
      slope, every rung of slope compounds, and by the last rung the design asks for prices the engine's
      25&ndash;175% band cannot deliver &mdash; so a third of its recipes get clamped on the 4:1 lean floor,
      never earn their designed margin, and the margin ladder inverts at the top.</p>
      <div class="scrollx" id="verdict"></div></div></div>

  <div class="card" id="anchorCard" hidden><div class="hd">The margin anchor<span class="tag">what a vanilla building actually earns at the 1836 start</span></div>
    <div class="bd"><p class="note">Measured off five vanilla runs at <b>1836.2.1</b>, on the model's own
    definition and the game's own numbers: <b>margin = profit &divide; (revenue &minus; profit)</b>, because
    total cost <em>is</em> revenue minus profit. No wage model, nothing to get wrong.</p>
    <div class="cols"><div id="anchorSummary"></div><div class="scrollx" id="anchorTable"></div></div></div></div>

  <div class="card"><div class="hd">The obsolescence matrix<span class="tag">every rung's margin in every era &mdash; read a row left to right and watch it die</span></div>
    <div class="bd"><p class="note">One row per building. The outlined cell is the era that rung is
    <b>designed</b> for; everything right of it is the same building still standing while the world builds
    past it. The rule is <b>current&minus;2</b>: two eras on, an old rung must be losing money.</p>
    <div class="scrollx" id="matrix"></div><div class="legend" id="mxLegend"></div></div></div>

  <div class="card"><div class="hd">Price paths<span class="tag">designed against achieved, per good</span></div>
    <div class="bd"><p class="note">Dashed is the <b>design</b> &mdash; the good's measured vanilla 1836 anchor
    declining by the slope its own death condition demands. Solid is what the seeded scenario
    <b>achieved</b>. A good on its line is one the ladder controls; a good that wanders is one the
    population's budget decides.</p><div class="paths" id="paths"></div></div></div>

  <div class="card"><div class="hd">Reading notes</div><div class="bd" id="notes"></div></div>
</main>

<script id="payload" type="application/json">__DATA__</script>
<script>
"use strict";
const D = JSON.parse(document.getElementById('payload').textContent);
const H = D._headline, HC = D._compare, VM = D._vanillaMargins;
const ERAS = D.eras, NE = ERAS.length, AL = D.analytic_ladder, SC = D.scenarios, TIERS = D.tiers, INDS = D.industries;
const TIERCOL = {0:'var(--era0)',1:'var(--tier1)',2:'var(--tier2)',3:'var(--tier3)',4:'var(--tier4)',5:'var(--tier5)'};
const esc = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt = (x,d=0)=>(x==null||!isFinite(x))?'—':x.toLocaleString('en-GB',{minimumFractionDigits:d,maximumFractionDigits:d});
const pc = x => x==null?'—':(x>=0?'+':'')+Math.round(x*100)+'%';
const title = s => s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const pill = e => '<span class="pill" style="background:'+(TIERCOL[e]||'#5b6b7d')+'">e'+e+'</span>';
function marginStyle(m){ if(m==null) return '';
  const t=Math.min(1,Math.abs(m)/0.6), hue=m>=0?'var(--good)':'var(--bad)';
  return 'background:color-mix(in oklab,'+hue+' '+Math.round((0.08+0.34*t)*100)+'%, transparent);'+(Math.abs(m)>0.2?'color:'+hue+';':''); }

const VAN = D.vanilla_industries || [];
document.getElementById('sub').textContent = ERAS.map(e=>e.year).join(' · ')
  + '  ·  ' + H.tiers + ' buildings over ' + H.industries + ' industries'
  + (VAN.length ? '  ·  vanilla again: ' + VAN.join(', ') : '');
document.getElementById('stamp').textContent = 'built __STAMP__ · ' + D._source.artifact;

(function(){
  const mgOf = h => h && h.margins && h.margins.length
    ? (h.margins.every(m=>m===h.margins[0]) ? '+'+Math.round(h.margins[0]*100)+'% flat' : h.margins.map(m=>'+'+Math.round(m*100)+'%').join('/')) : '—';
  const rows = [
    ['Design margin, by era', ()=>mgOf(H), ()=>mgOf(HC), null],
    ['Tier buildings the player must learn', h=>h.tiers, null, false],
    ['Recipes earning their designed margin', h=>h.onTarget+' / '+h.tiers+' ('+Math.round(100*h.onTarget/h.tiers)+'%)', null, true],
    ['Recipes clamped — the design price is unbuildable', h=>h.lean+' / '+h.tiers+' ('+Math.round(100*h.lean/h.tiers)+'%)', null, false],
    ['Recipes capped by the ratchet — they earn MORE than target', h=>h.ratchet+' / '+h.tiers, null, null],
    ['Superseded rungs dead two eras on', h=>h.dead+' / '+h.deadChecked+' ('+Math.round(100*h.dead/Math.max(1,h.deadChecked))+'%)', null, true],
    ['Goods whose price slope hits a clamp', h=>h.slopeClamps.length+(h.slopeClamps.length?' — '+h.slopeClamps.join(', '):''), null, false],
    ['Illogicality, analytic', h=>h.illogicality, null, false],
    ['Illogicality, on the seeded scenarios', h=>h.seeded, null, false],
  ];
  let s='<table><thead><tr><th style="width:44%">Metric</th><th class="num">Four rungs</th>'+(HC?'<th class="num">Six rungs (canon)</th>':'')+'</tr></thead><tbody>';
  for (const [label,f,fC,hb] of rows){
    const a = fC?f():f(H), b = HC ? (fC?fC():f(HC)) : null;
    const na=parseFloat(String(a)), nb=b==null?NaN:parseFloat(String(b));
    const win = hb!=null && isFinite(na) && isFinite(nb) && na!==nb && (hb?na>nb:na<nb);
    s += '<tr><td>'+esc(label)+'</td><td class="num'+(win?' good':'')+'">'+esc(String(a))+'</td>'
       + (HC?'<td class="num muted">'+esc(String(b))+'</td>':'')+'</tr>';
  }
  document.getElementById('verdict').innerHTML = s+'</tbody></table>';
})();

if (VM) {
  document.getElementById('anchorCard').hidden = false;
  const classes={}; for (const [k,v] of Object.entries(VM.by_building)) (classes[v.cls] ||= []).push({k,...v});
  const aggOf = rs => { const lv=rs.reduce((a,x)=>a+x.levels,0); return lv?rs.reduce((a,x)=>a+x.margin*x.levels,0)/lv:NaN; };
  let s='<div class="chips">';
  for (const c of ['manufacturing','extraction','agriculture']){ const rs=classes[c]||[]; if(!rs.length) continue;
    s += '<div class="chip"><div class="k">'+c+'</div><div class="v">'+Math.round(100*aggOf(rs))+'%</div><div class="x">'+rs.length+' building types</div></div>'; }
  s += '</div><p class="note">The design margin is set to the manufacturing figure and held <b>flat across '
     + 'every era</b>: a tier-N industry earns the same at its own era as a tier-1 industry does at its own. '
     + 'The rising 0.30&rarr;0.70 ladder it replaces was spending margin the band could not pay for — a fat '
     + 'frontier margin raises the bar the price decline has to clear, which is what put a third of the '
     + 'six-rung book on the lean floor.</p>';
  document.getElementById('anchorSummary').innerHTML = s;
  const mfg = (classes.manufacturing||[]).sort((a,b)=>b.levels-a.levels);
  let t='<table><thead><tr><th>Vanilla building</th><th class="num">Levels</th><th class="num">Margin</th></tr></thead><tbody>';
  for (const r of mfg) t += '<tr><td>'+esc(title(r.k.replace('building_','')))+'</td><td class="num muted">'+fmt(r.levels)
    + '</td><td class="num"><span class="cell" style="'+marginStyle(r.margin)+'">'+pc(r.margin)+'</span></td></tr>';
  document.getElementById('anchorTable').innerHTML = t+'</tbody></table>';
}

(function(){
  let s='<table class="mx"><thead><tr><th>Industry</th><th>Rung</th>'+ERAS.map(e=>'<th class="era">'+e.year+'</th>').join('')+'<th>Dies at &minus;2?</th></tr></thead><tbody>';
  for (const ind of INDS){
    const last=Math.max.apply(null,ind.eras);
    ind.eras.forEach((rung,k)=>{
      const key=Object.keys(TIERS).find(t=>TIERS[t].industry===ind.id&&TIERS[t].era===rung), T=key?TIERS[key]:null;
      s += '<tr'+(k===0?' class="first"':'')+'><td class="ind">'+(k===0?esc(ind.id):'')+'</td>'
         + '<td class="rung">'+pill(rung)+' '+(T?esc(T.name)+' · '+(T.tech_year||''):'')+'</td>';
      for (let e=0;e<NE;e++){
        const m=((AL[e].margins||{})[ind.id]||{})[rung];
        s += '<td><span class="cell'+(m==null?' void':'')+(e===rung?' own':'')+'" style="'+marginStyle(m)+'" title="'
           + (m==null?'not present in '+ERAS[e].year:esc(ind.id)+' rung e'+rung+' in '+ERAS[e].year+': '+pc(m))+'">'
           + (m==null?'·':pc(m))+'</span></td>';
      }
      const tgt=rung+2; let v;
      if (rung>=last) v='<span class="verd muted">top rung</span>';
      else if (tgt>NE-1) v='<span class="verd muted">no e'+tgt+'</span>';
      else { const m=((AL[tgt].margins||{})[ind.id]||{})[rung];
        v = m==null?'<span class="verd muted">absent</span>' : m<0?'<span class="verd good">✓ '+pc(m)+'</span>':'<span class="verd bad">✗ still '+pc(m)+'</span>'; }
      s += '<td>'+v+'</td></tr>';
    });
  }
  document.getElementById('matrix').innerHTML = s+'</tbody></table>';
  document.getElementById('mxLegend').innerHTML =
    '<span><i style="background:color-mix(in oklab,var(--good) 40%,transparent)"></i>profitable</span>'
  + '<span><i style="background:color-mix(in oklab,var(--good) 10%,transparent)"></i>thin</span>'
  + '<span><i style="background:color-mix(in oklab,var(--bad) 12%,transparent)"></i>losing</span>'
  + '<span><i style="background:color-mix(in oklab,var(--bad) 40%,transparent)"></i>dead</span>'
  + '<span>outlined = the rung\'s own era. Every cell prints its number, so the tint is never the only signal.</span>';
})();

(function(){
  const goods=Object.keys(D.granular.slopes).sort(), W=190, Ht=56, PAD=6;
  const y=p=>Ht-PAD-(Math.max(25,Math.min(175,p))-25)/150*(Ht-2*PAD);
  const x=i=>PAD+i*(W-2*PAD)/Math.max(1,NE-1);
  let s='';
  for (const g of goods){
    const dsn=ERAS.map((e,i)=>(D.mandate[i].goods||{})[g] ?? null);
    const ach=ERAS.map((e,i)=>{const o=(SC[i].order_book||[]).find(o=>o.g===g);return o?o.price:null;});
    if (dsn.every(v=>v==null)) continue;
    const dp=dsn.map((v,i)=>v==null?null:x(i)+','+y(v)).filter(Boolean).join(' ');
    const av=ach.map((v,i)=>v==null?null:{i,v}).filter(Boolean);
    let line='',dots='';
    if (av.length>1) line='<polyline points="'+av.map(p=>x(p.i)+','+y(p.v)).join(' ')+'" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>';
    for (const p of av) dots+='<circle cx="'+x(p.i)+'" cy="'+y(p.v)+'" r="3.4" fill="var(--accent)" stroke="var(--panel2)" stroke-width="2"><title>'+ERAS[p.i].year+': achieved '+p.v+'% of base</title></circle>';
    const la=av.length?av[av.length-1]:null, drift=la&&dsn[la.i]!=null?la.v-dsn[la.i]:null;
    s += '<div class="path"><div class="t"><b>'+esc(title(g))+'</b><span>×'+D.granular.slopes[g].toFixed(2)+'/era</span></div>'
       + '<svg viewBox="0 0 '+W+' '+Ht+'" role="img" aria-label="'+esc(g)+' designed against achieved price">'
       + '<line x1="'+PAD+'" y1="'+y(100)+'" x2="'+(W-PAD)+'" y2="'+y(100)+'" stroke="var(--line)" stroke-width="1"/>'
       + '<polyline points="'+dp+'" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="3 3"/>'+line+dots+'</svg>'
       + '<div class="t"><span>design '+dsn.filter(v=>v!=null).map(Math.round).join(' → ')+'</span>'
       + '<span class="'+(drift==null?'':Math.abs(drift)>20?'bad':'good')+'">'+(drift==null?'':(drift>=0?'+':'')+Math.round(drift)+'pp')+'</span></div></div>';
  }
  document.getElementById('paths').innerHTML = s;
})();

document.getElementById('notes').innerHTML =
  '<p class="note"><b>This is the reading instrument, not the editor.</b> The balance sheet is where a '
+ 'recipe is tuned; this page answers the two questions the sheet cannot put on one screen — does a rung '
+ 'actually die two eras on, and does each good follow its designed price.</p>'
+ '<p class="note"><b>Era 0 is 1836 and is anchored to vanilla.</b> Every good\'s era-0 design price is its '
+ 'measured price in a real vanilla 1836 market; the ladder rebases to 100 at era 1 and declines from there '
+ 'by the slope each good\'s own death condition demands.</p>'
+ '<ul class="tight">'
+ '<li><b>Only two of the four rungs get a death horizon.</b> Under current−2, e0 dies at e2 and e1 dies at '
+ 'e3; e2 and e3 have no e4 or e5 to die into. The matrix says <em>no e4</em> rather than hiding it.</li>'
+ '<li><b>Textile and furniture stay profitable when they should not.</b> Clothes and furniture are bought '
+ 'almost entirely by the population, and a population\'s budget is not something a price ladder can '
+ 'mandate — it pays what it can afford.</li>'
+ '<li><b>The recipe ratchet is now the main clamp.</b> A later rung may not be less input-efficient than '
+ 'the rung below it at base prices. With a flat margin and a pop-lifted output price the design sometimes '
+ 'wants exactly that, so the ratchet caps it and the rung earns MORE than its target.</li>'
+ '</ul>'
+ '<p class="note" style="margin-top:10px">Built by <code>tools/build_ui2_report.mjs</code> from <code>'
+ esc(D._source.artifact)+'</code>'+(D._source.margins?', margins from <code>'+esc(D._source.margins)+'</code>':'')
+ '. Nothing canonical was modified.</p>';
</script>`;

  const out = HTML.replace('__DATA__', JSON.stringify(DATA)).replace('__STAMP__', stamp);
  for (const tag of ['<!DOCTYPE', '<html', '<head>', '<body'])
    if (out.toLowerCase().includes(tag.toLowerCase())) throw new Error(`the report carries ${tag} — it must be artifact-safe (no document tags)`);
  writeFileSync(OUT, out);
  console.log(`WORKBENCH   → ${OUT.replace(REPO, '').replace(/^[\\/]/, '')}  (${(statSync(OUT).size / 1024).toFixed(0)} KB)`);
}
