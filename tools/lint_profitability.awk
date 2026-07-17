# PM & Tech Rehaul - profitability linter (BUILDING level)
#
# For every building whose main PM is on the ladder, recompute the building's
# FULL break-even output price (BE%) - input goods PLUS wages - using:
#   - the building's single main PM, PLUS
#   - the BASE (first-listed) PM of every other PMG the building runs.
# Base PMs are the default/"off" states; this is the building's baseline profitability
# with no optional PMs toggled on. Wages are modeled as wage_pct * input-goods cost
# (wage_pct comes from the tier map, default 0.33), so BE = (I + wage*I)/O. Checked
# against the tier's target_be in BALANCE_FRAMEWORK.md §8.1.
#
# Inputs (file1 = tier map "pm tier target_be wage_pct", file2 = concatenated vanilla+mod
# defs, vanilla first so mod overrides). Driven by lint.sh. Exit 1 if any in-scope building
# is more than TOL pp off its target BE.

BEGIN {
    p["ammunition"]=50; p["small_arms"]=60; p["artillery"]=70; p["tanks"]=80;
    p["aeroplanes"]=80; p["manowars"]=70; p["ironclads"]=80; p["grain"]=20;
    p["fish"]=20; p["fabric"]=20; p["wood"]=20; p["groceries"]=30; p["clothes"]=30;
    p["furniture"]=30; p["paper"]=30; p["services"]=30; p["transportation"]=30;
    p["electricity"]=30; p["merchant_marine"]=50; p["clippers"]=60; p["steamers"]=70;
    p["silk"]=40; p["dye"]=40; p["sulfur"]=50; p["coal"]=30; p["iron"]=40; p["lead"]=40;
    p["hardwood"]=40; p["rubber"]=40; p["oil"]=40; p["engines"]=60; p["steel"]=50;
    p["glass"]=40; p["fertilizer"]=30; p["tools"]=40; p["explosives"]=50;
    p["porcelain"]=70; p["meat"]=30; p["fruit"]=30; p["liquor"]=30; p["wine"]=50;
    p["tea"]=50; p["coffee"]=50; p["sugar"]=30; p["tobacco"]=40; p["opium"]=50;
    p["automobiles"]=100; p["telephones"]=70; p["radios"]=80; p["luxury_clothes"]=60;
    p["luxury_furniture"]=60; p["gold"]=100; p["fine_art"]=200;
    TOL=6;   # allowed deviation (pp) of a building's actual BE from its configured target_be
    cur="";
}
# ---- file1: tier map (pm  tier  target_be  wage_pct) ----
FNR==NR { if ($1 ~ /^pm_/) { tier[$1]=$2+0; target[$1]=$3+0; wage[$1]=($4=="")?0.33:$4+0 } next }

# ---- file2: object definitions (structural parse) ----
# top-level headers at column 0
/^pm_[a-z0-9_-]+[ ]*=[ ]*\{/       { cur="pm";  name=hdr(); pmIn[name]=0; pmOut[name]=0; next }
/^pmg_[a-z0-9_-]+[ ]*=[ ]*\{/      { cur="pmg"; name=hdr(); pmgBase[name]=""; inlist=0; next }
/^building_[a-z0-9_-]+[ ]*=[ ]*\{/ { cur="bld"; name=hdr(); blist[name]="";  inlist=0; next }

cur=="pm" {
    if ($1 ~ /^goods_input_[a-z_]+_add$/)  { g=$1; sub(/^goods_input_/,"",g);  sub(/_add$/,"",g); pmIn[name]  += ($3+0)*price(g) }
    if ($1 ~ /^goods_output_[a-z_]+_add$/) { g=$1; sub(/^goods_output_/,"",g); sub(/_add$/,"",g); pmOut[name] += ($3+0)*price(g) }
    next
}
cur=="pmg" {
    if ($0 ~ /production_methods[ ]*=[ ]*\{/) inlist=1;
    if (inlist) { collect_first_pm(); }
    if (inlist && $0 ~ /\}/) inlist=0;
    next
}
cur=="bld" {
    if ($0 ~ /production_method_groups[ ]*=[ ]*\{/) inlist=1;
    if (inlist) { collect_pmgs(); }
    if (inlist && $0 ~ /\}/) inlist=0;
    next
}

END {
    print  "BUILDING                                  TIER  bldBE  target   d    result";
    print  "----------------------------------------  ----  -----  ------  ----  ------";
    fails=0; rows=0;
    for (b in blist) {
        # find the main PMG (its base PM is on the ladder) and sum all base PMs
        m=""; t=0; tg=0; tin=0; tout=0; wg=0.33; k=split(blist[b], gs, " ");
        for (i=1;i<=k;i++){ pg=gs[i]; if(pg=="") continue; bp=pmgBase[pg];
            tin += pmIn[bp]; tout += pmOut[bp];
            if (bp in tier) { m=bp; t=tier[bp]; tg=target[bp]; wg=wage[bp] }
        }
        if (m=="") continue;                       # not an in-scope building
        rows++;
        # FULL break-even: input goods plus wages (wages = wg * input-goods cost)
        bldbe = (tout>0) ? tin*(1+wg)/tout*100 : 0;
        d = bldbe - tg; ad = (d<0)?-d:d;
        res = (ad<=TOL) ? "PASS" : "FAIL"; if(res=="FAIL") fails++;
        key=sprintf("%d_%s", t, b); rowT[key]=t; rowB[key]=b; rowD[key]=bldbe; rowG[key]=tg; rowE[key]=d; rowR[key]=res;
    }
    # print sorted by tier then name
    n=asorti_keys();
    for (i=1;i<=n;i++){ key=sk[i];
        printf "%-40s  T%-3d  %4.0f%%  %4.0f%%   %+4.0f  %s\n", rowB[key], rowT[key], rowD[key], rowG[key], rowE[key], rowR[key];
    }
    print "----";
    if (fails>0){ printf "LINT FAILED: %d building(s) more than %dpp off target BE.\n", fails, TOL; exit 1 }
    else printf "LINT PASSED: %d in-scope buildings within %dpp of target BE.\n", rows, TOL;
}

function hdr(){ h=$1; sub(/^[ \t]+/,"",h); return h }
function price(g){ if(!(g in p)){ print "WARN missing price: "g > "/dev/stderr"; return 0 } return p[g] }
function collect_first_pm(   i,w,nw){ gsub(/[{}]/," "); nw=split($0,w," ");
    for(i=1;i<=nw;i++){ if(w[i] ~ /^pm_/ && pmgBase[name]==""){ pmgBase[name]=w[i] } } }
function collect_pmgs(   i,w,nw){ gsub(/[{}]/," "); nw=split($0,w," ");
    for(i=1;i<=nw;i++){ if(w[i] ~ /^pmg_/){ blist[name]=blist[name] " " w[i] } } }
# simple insertion sort of keys (tier then building name embedded in key)
function asorti_keys(   i,j,tmp,c){ c=0; for(k in rowB){ sk[++c]=k }
    for(i=2;i<=c;i++){ tmp=sk[i]; j=i-1; while(j>=1 && cmp(sk[j],tmp)>0){ sk[j+1]=sk[j]; j-- } sk[j+1]=tmp } return c }
function cmp(a,b){ if(rowT[a]!=rowT[b]) return rowT[a]-rowT[b]; return (rowB[a]<rowB[b])?-1:((rowB[a]>rowB[b])?1:0) }
