# PM & Tech Rehaul - negative-goods invariant linter.
#
# For EVERY building, no legal combination of one active PM per PMG may drive any good's total
# goods_input_*_add or goods_output_*_add below zero.
#
# Why: reduction PMs legitimately emit NEGATIVE goods (e.g. the aeroplane/tank lines subtract from a
# car plant's automobiles output; luxury/ceramics/rayon PMs subtract from a base good). The design
# guarantees the active main output covers the maximum reduction. The balance UI can edit any PM's
# goods (via pm_goods, negatives allowed), so this check enforces that no edit lets a player-selectable
# combination push a good's building-level total below zero.
#
# Method (brute force - PM counts are tiny): for each building, enumerate the Cartesian product of its
# PMGs' PMs (one active PM per PMG). A combination is LEGAL only if every chosen PM's
# unlocking_production_methods gate (if any) is satisfied by another chosen PM in the same combination
# - so gated secondaries (e.g. pm_elastics, unlocked only by the sewing/electric main PMs) are never
# counted against a main PM that can't run them. For each legal combination, sum every good's input and
# output; any total < 0 is a violation. (Only "risky" goods - those with a negative contribution in some
# PM - can go negative, so buildings with none are skipped outright.)
#
# PM names are NOT all pm_-prefixed: plantations/farms use default_/automatic_/worker_/slave_/... , so
# every top-level block in a production_methods file is treated as a PM, and every token in a
# production_methods / unlocking_production_methods list is a PM reference.
#
# Input: one concatenated file (vanilla first, mod second so mod overrides via header reset) of all
# production_method_groups, the mod's OWNED production_methods (so pm_goods edits are seen), and all
# buildings. Driven by lint.sh. Exit 1 on any violation.

# ---- structural parse; top-level headers at column 0. Order matters: building_/pmg_ before generic PM ----
/^building_[a-z0-9_-]+[ ]*=[ ]*\{/ { cur="bld"; name=hdr(); blist[name]=""; inlist=0; next }
/^pmg_[a-z0-9_-]+[ ]*=[ ]*\{/      { cur="pmg"; name=hdr(); pmgCount[name]=0; inlist=0; next }
/^[A-Za-z_][A-Za-z0-9_-]*[ ]*=[ ]*\{/ { cur="pm"; name=hdr(); inGoods[name]=""; outGoods[name]=""; unlock[name]=""; ulist=0; next }

cur=="pm" {
    if ($0 ~ /unlocking_production_methods[ ]*=[ ]*\{/) ulist=1;   # gate: PM available only if a listed PM is active
    if (ulist) collect_unlock($0);
    if (ulist && $0 ~ /\}/) ulist=0;
    if ($1 ~ /^goods_input_[a-z_]+_add$/)  { g=$1; sub(/^goods_input_/,"",g);  sub(/_add$/,"",g); gin[name,g]=($3+0);  addgood(inGoods,name,g) }
    if ($1 ~ /^goods_output_[a-z_]+_add$/) { g=$1; sub(/^goods_output_/,"",g); sub(/_add$/,"",g); gout[name,g]=($3+0); addgood(outGoods,name,g) }
    next
}
cur=="pmg" {
    if ($0 ~ /production_methods[ ]*=[ ]*\{/) inlist=1;
    if (inlist) collect_pms($0);
    if (inlist && $0 ~ /\}/) inlist=0;
    next
}
cur=="bld" {
    if ($0 ~ /production_method_groups[ ]*=[ ]*\{/) inlist=1;
    if (inlist) collect_pmgs($0);
    if (inlist && $0 ~ /\}/) inlist=0;
    next
}

END {
    viol=0; nb=0; nchk=0;
    for (b in blist) { nb++; check_building(b); }
    # report (sorted by building then good)
    n=0; for (k in worst) sk[++n]=k;
    for (i=2;i<=n;i++){ tmp=sk[i]; j=i-1; while(j>=1 && sk[j]>tmp){ sk[j+1]=sk[j]; j-- } sk[j+1]=tmp }
    print "----";
    for (i=1;i<=n;i++){ split(sk[i], a, SUBSEP);
        printf "FAIL  %-42s  %-16s  %-6s  min total %d\n", a[1], a[2], a[3], worst[sk[i]]; viol++ }
    if (viol>0){ printf "NEGATIVE-GOODS CHECK FAILED: %d building/good case(s) can go negative.\n", viol; exit 1 }
    else       { printf "NEGATIVE-GOODS CHECK PASSED: no legal PM combination drives any good negative (%d buildings, %d with reduction PMs enumerated).\n", nb, nchk }
}

function hdr(){ h=$1; sub(/^[ \t]+/,"",h); return h }
function addgood(arr,nm,g){ if(index(" " arr[nm] " ", " " g " ")==0) arr[nm]=arr[nm] " " g }
function ident(t){ return (t ~ /^[A-Za-z_][A-Za-z0-9_-]*$/) }
function collect_pms(line,   i,w,nw,t){ gsub(/[{}]/," ",line); nw=split(line,w," ");
    for(i=1;i<=nw;i++){ t=w[i]; if(ident(t) && t!="production_methods"){ pmgCount[name]++; PMV[name,pmgCount[name]]=t } } }
function collect_unlock(line,   i,w,nw,t){ gsub(/[{}]/," ",line); nw=split(line,w," ");
    for(i=1;i<=nw;i++){ t=w[i]; if(ident(t) && t!="unlocking_production_methods") unlock[name]=unlock[name] " " t } }
function collect_pmgs(line,   i,w,nw){ gsub(/[{}]/," ",line); nw=split(line,w," ");
    for(i=1;i<=nw;i++){ if(w[i] ~ /^pmg_/) blist[name]=blist[name] " " w[i] } }

# enumerate legal PM combinations for one building; flag any good whose total goes < 0
function check_building(b,   PG, npg, i, j, k, pg, np, tmp, riskyIn, riskyOut, anyRisky, gg, nn, x, g, p, combos, ok, s) {
    npg=0; delete PG;
    k=split(blist[b], tmp, " ");
    for(i=1;i<=k;i++){ pg=tmp[i]; if(pg!="" && (pg in pmgCount) && pmgCount[pg]>0){ npg++; PG[npg]=pg } }
    if(npg==0) return;
    # risky goods: some PM in some PMG contributes a negative
    delete riskyIn; delete riskyOut; anyRisky=0;
    for(i=1;i<=npg;i++){ pg=PG[i]; np=pmgCount[pg];
        for(j=1;j<=np;j++){ p=PMV[pg,j];
            nn=split(inGoods[p], gg, " ");  for(x=1;x<=nn;x++){ g=gg[x]; if(g!="" && gin[p,g]<0){ riskyIn[g]=1;  anyRisky=1 } }
            nn=split(outGoods[p], gg, " "); for(x=1;x<=nn;x++){ g=gg[x]; if(g!="" && gout[p,g]<0){ riskyOut[g]=1; anyRisky=1 } } } }
    if(!anyRisky) return;
    nchk++;
    combos=1; for(i=1;i<=npg;i++){ combos*=pmgCount[PG[i]]; }
    if(combos>1000000){ printf "WARN  %s: %d combinations - skipped (raise cap in lint_negative_goods.awk)\n", b, combos > "/dev/stderr"; return }
    for(i=1;i<=npg;i++) idx[i]=1;
    while(1){
        delete present; ok=1;
        for(i=1;i<=npg;i++) present[PMV[PG[i],idx[i]]]=1;
        for(i=1;i<=npg;i++){ p=PMV[PG[i],idx[i]]; if(unlock[p]!="" && !gateOK(p)){ ok=0; break } }
        if(ok){
            for(g in riskyIn){  s=0; for(i=1;i<=npg;i++){ p=PMV[PG[i],idx[i]]; if((p,g) in gin)  s+=gin[p,g]  } if(s<0) recordWorst(b,g,"input",s) }
            for(g in riskyOut){ s=0; for(i=1;i<=npg;i++){ p=PMV[PG[i],idx[i]]; if((p,g) in gout) s+=gout[p,g] } if(s<0) recordWorst(b,g,"output",s) }
        }
        i=npg; while(i>=1){ idx[i]++; if(idx[i]<=pmgCount[PG[i]]) break; idx[i]=1; i-- } if(i<1) break;
    }
}
function gateOK(p,   n,w,i){ n=split(unlock[p],w," "); for(i=1;i<=n;i++){ if(w[i]!="" && (w[i] in present)) return 1 } return 0 }
function recordWorst(b,g,dir,s,   key){ key=b SUBSEP g SUBSEP dir; if(!(key in worst) || s<worst[key]) worst[key]=s }
