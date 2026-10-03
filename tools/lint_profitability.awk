# PM & Tech Rehaul - profitability linter (BUILDING level)
#
# For every building whose main group holds a method on the ladder, recompute the FULL break-even output price
# (BE%) - input goods PLUS wages - of EACH such main method, under THE MOST BASIC SECONDARY METHODS AVAILABLE beside it
# (user-ruled 2026-10-03, BALANCE_FRAMEWORK §10.93: "BE numbers should mean 'under most basic of all secondary PMs
# available for the building'. Not 'main PM only'. Skipping checks is wrong, rather we should check properly so that
# it'd match"):
#   - the main method itself, PLUS
#   - in every other group the building runs, the FIRST member that is legal beside it: not power-bloc gated
#     (unlocking_principles) and either ungated or gated (unlocking_production_methods) on the main method or on a method
#     already chosen. For an ordinary group that is its inert "off" first member, exactly as before; for a MANDATED
#     automation (Mechanized Looms beside Sewing Machines, Automatic Power Looms beside Electric Sewing Machines, Assembly
#     Lines beside Mass Production) it is the copy gated to that main method - the only member legal beside it.
#   Technology gates are not read: the basic method is what the building runs once its main method stands.
# ⚠ EVERY main method of a merged building is checked, the host's own and each merged one, each with its own basic
#   secondaries. Until 2026-10-03 only the group's FIRST member was, so a merged rung's recipe had no drift guard, and a
#   mandated group was SKIPPED - ruled wrong ("Skipping checks is wrong").
# make_ab_config.mjs restates target_be / wage_pct on the same basis (lib_secondary_compat.mjs basicTotals /
# basicEmployment); tools/restate_basic_be.mjs re-applies it to a book written before the ruling. Wages are the
# wage_pct fraction of TOTAL cost (wage_pct comes from the tier map, default 0.25), so BE = I/(1-wage)/O. Checked
# against the tier's target_be in BALANCE_FRAMEWORK.md §8.1.
#
# Inputs (-v PRICES=<goods_prices.tsv>, file1 = tier map "pm tier target_be wage_pct", file2 =
# concatenated vanilla+mod defs, vanilla first so mod overrides). Driven by lint.sh. Exit 1 if any
# in-scope main method is more than TOL pp off its target BE, or has a group with nothing legal beside it.
#
# PRICES is read from tools/goods_prices.tsv - the ONE price table shared by the builder, both
# solvers and the UI. It used to be copied into this file as a literal table, which meant a price
# refreshed after a game patch reached everything EXCEPT the linter, silently.

BEGIN {
    # NOTE: `exit` in BEGIN still runs END, so bail out via ABORT rather than printing a stray report.
    if (PRICES == "") { print "lint_profitability: -v PRICES=<goods_prices.tsv> is required" > "/dev/stderr"; ABORT=1; exit 2 }
    np = 0;
    while ((getline pl < PRICES) > 0) {
        if (pl ~ /^[ \t]*#/ || pl ~ /^[ \t]*$/) continue;
        nf = split(pl, pf, "\t");
        if (nf < 2) continue;
        gsub(/^[ \t]+|[ \t\r]+$/, "", pf[1]); gsub(/^[ \t]+|[ \t\r]+$/, "", pf[2]);
        if (pf[1] != "") { p[pf[1]] = pf[2]+0; np++ }
    }
    close(PRICES);
    if (np == 0) { printf "lint_profitability: no prices read from %s\n", PRICES > "/dev/stderr"; ABORT=1; exit 2 }
    TOL=6;         # allowed deviation (pp) of a building's actual BE from its configured target_be
    DEFWAGE=0.25;  # wage fraction of TOTAL cost when the tier map carries no wage_pct column (BALANCE_FRAMEWORK 1)
    cur="";
}
# ---- file1: tier map (pm  tier  target_be  wage_pct) ----
FNR==NR { if ($1 ~ /^pm_/) { tier[$1]=$2+0; target[$1]=$3+0; wage[$1]=($4=="")?DEFWAGE:$4+0 } next }

# ---- file2: object definitions (structural parse) ----
# top-level headers at column 0. A REDEFINITION (the mod's whole-file copy of a vanilla file, read after vanilla's)
# resets everything the earlier one set. ⚠ Any other column-0 block ends the current object: a PM whose name does not
# start with pm_ must not leak its goods into the PM above it.
/^pm_[a-z0-9_-]+[ ]*=[ ]*\{/       { cur="pm";  name=hdr(); pmIn[name]=0; pmOut[name]=0; gate[name]=""; princ[name]=0; ingate=0; next }
/^pmg_[a-z0-9_-]+[ ]*=[ ]*\{/      { cur="pmg"; name=hdr(); nmem[name]=0; inlist=0; next }
/^building_[a-z0-9_-]+[ ]*=[ ]*\{/ { cur="bld"; name=hdr(); blist[name]="";  inlist=0; next }
/^[A-Za-z_][A-Za-z0-9_-]*[ ]*=[ ]*\{/ { cur=""; next }

cur=="pm" {
    if ($0 ~ /unlocking_principles/) princ[name]=1;
    if ($0 ~ /unlocking_production_methods/) ingate=1;
    if (ingate) { collect_gate(); if ($0 ~ /\}/) ingate=0; next }
    if ($1 ~ /^goods_input_[a-z_]+_add$/)  { g=$1; sub(/^goods_input_/,"",g);  sub(/_add$/,"",g); pmIn[name]  += ($3+0)*price(g) }
    if ($1 ~ /^goods_output_[a-z_]+_add$/) { g=$1; sub(/^goods_output_/,"",g); sub(/_add$/,"",g); pmOut[name] += ($3+0)*price(g) }
    next
}
cur=="pmg" {
    if ($0 ~ /production_methods[ ]*=[ ]*\{/) inlist=1;
    if (inlist) { lineEnds = ($0 ~ /\}/); collect_members(); if (lineEnds) inlist=0 }
    next
}
cur=="bld" {
    if ($0 ~ /production_method_groups[ ]*=[ ]*\{/) inlist=1;
    if (inlist) { lineEnds = ($0 ~ /\}/); collect_pmgs(); if (lineEnds) inlist=0 }
    next
}

END {
    if (ABORT) exit 2;
    print  "BUILDING / MAIN METHOD                    TIER  bldBE  target   d    result";
    print  "----------------------------------------  ----  -----  ------  ----  ------";
    fails=0; rows=0; nomain=0;
    for (b in blist) {
        k=split(blist[b], gs, " ");
        # the MAIN group: the one holding a method on the ladder
        mg="";
        for (i=1;i<=k;i++){ pg=gs[i]; if(pg=="") continue;
            for (j=1;j<=nmem[pg];j++) if (mem[pg,j] in tier) { mg=pg; break }
            if (mg!="") break }
        if (mg=="") continue;                      # not an in-scope building
        first=1;
        for (j=1;j<=nmem[mg];j++){ m=mem[mg,j]; if (!(m in tier)) continue;
            rows++;
            delete chosen; chosen[m]=1;
            tin=pmIn[m]; tout=pmOut[m]; basics=""; bad="";
            for (i=1;i<=k;i++){ pg=gs[i]; if(pg=="" || pg==mg) continue;
                x=basic_of(pg);
                if (x=="") { bad=bad " " pg; continue }
                chosen[x]=1; tin += pmIn[x]; tout += pmOut[x];
                if (pmIn[x]!=0 || pmOut[x]!=0) basics=basics " " x;
            }
            # FULL break-even: total cost (goods + wages); the wage share is of TOTAL cost, so total = goods/(1-wg)
            wg=wage[m]; tg=target[m]; t=tier[m];
            bldbe = (tout>0) ? tin/(1-wg)/tout*100 : 0;
            d = bldbe - tg; ad = (d<0)?-d:d;
            res = (ad<=TOL && bad=="") ? "PASS" : "FAIL"; if(res=="FAIL") fails++;
            lbl = first ? b : "  + " m; first=0;
            key=sprintf("%s|%d|%s", b, j, m); rowT[key]=t; rowB[key]=b; rowJ[key]=j; rowL[key]=lbl; rowD[key]=bldbe; rowG[key]=tg; rowE[key]=d; rowR[key]=res;
            rowX[key] = (bad!="") ? "   NOTHING LEGAL beside " m " in:" bad : ((basics!="") ? "   (basic:" basics ")" : "");
        }
        if (first) nomain++;
    }
    # print sorted by the building's first tier, then name, then method order
    n=asorti_keys();
    for (i=1;i<=n;i++){ key=sk[i];
        printf "%-40s  T%-3d  %4.0f%%  %4.0f%%   %+4.0f  %s%s\n", rowL[key], rowT[key], rowD[key], rowG[key], rowE[key], rowR[key], rowX[key];
    }
    print "----";
    if (fails>0){ printf "LINT FAILED: %d main method(s) more than %dpp off target BE, or with a group that has nothing legal beside them.\n", fails, TOL; exit 1 }
    else printf "LINT PASSED: %d main method(s) within %dpp of target BE, each under its most basic legal secondaries.\n", rows, TOL;
}

function hdr(){ h=$1; sub(/^[ \t]+/,"",h); return h }
function price(g){ if(!(g in p)){ print "WARN missing price: "g > "/dev/stderr"; return 0 } return p[g] }
# the gate list of the current PM: every pm_ token on the unlocking_production_methods lines
function collect_gate(   i,w,nw,s){ s=$0; gsub(/[{}=]/," ",s); nw=split(s,w," ");
    for(i=1;i<=nw;i++){ if(w[i] ~ /^pm_/) gate[name]=gate[name] " " w[i] } }
function collect_members(   i,w,nw,s){ s=$0; gsub(/[{}]/," ",s); nw=split(s,w," ");
    for(i=1;i<=nw;i++){ if(w[i] ~ /^pm_/){ nmem[name]++; mem[name,nmem[name]]=w[i] } } }
function collect_pmgs(   i,w,nw,s){ s=$0; gsub(/[{}]/," ",s); nw=split(s,w," ");
    for(i=1;i<=nw;i++){ if(w[i] ~ /^pmg_/){ blist[name]=blist[name] " " w[i] } } }
# the most basic method of group pg legal beside the methods already chosen (the main method first)
function basic_of(pg,   j,x,gl,nw,w,q){
    for (j=1;j<=nmem[pg];j++){ x=mem[pg,j];
        if (princ[x]) continue;
        if (gate[x]=="") return x;
        nw=split(gate[x], w, " ");
        for (q=1;q<=nw;q++) if (w[q] in chosen) return x;
    }
    return "";
}
# simple insertion sort of keys (the building's first tier, then building name, then method order)
function asorti_keys(   i,j,tmp,c,kk){ c=0; for(kk in rowB){ sk[++c]=kk }
    for(i=2;i<=c;i++){ tmp=sk[i]; j=i-1; while(j>=1 && cmp(sk[j],tmp)>0){ sk[j+1]=sk[j]; j-- } sk[j+1]=tmp } return c }
function firstT(key,   kk){ for(kk in rowB) if (rowB[kk]==rowB[key] && rowJ[kk]<rowJ[key]) return firstT(kk); return rowT[key] }
function cmp(a,b,   ta,tb){ ta=firstT(a); tb=firstT(b); if(ta!=tb) return ta-tb;
    if (rowB[a]!=rowB[b]) return (rowB[a]<rowB[b])?-1:1; return rowJ[a]-rowJ[b] }
