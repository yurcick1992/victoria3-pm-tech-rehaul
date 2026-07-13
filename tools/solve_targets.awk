# Solver: given a PM's vanilla input/output goods and a target break-even output
# price (BE%), emit re-sloped integer quantities that hit that BE.
#
# Method (balanced "sqrt split"): to move break-even from vanilla_BE to target_BE we
# multiply the input side by k and divide the output side by k, where k = sqrt(target/vanilla).
# This splits the change evenly between "raw-material efficiency" and "output volume",
# so neither raw-good demand nor finished-good supply is distorted too hard, and a tier's
# revenue at its *operating* price stays near vanilla revenue at base price.
#
# Input line format (one PM per line, fields space-separated):
#   <label> <target_be_percent> out=<good>:<qty> in=<good>:<qty>[,<good>:<qty>...]
BEGIN {
    p["grain"]=20; p["sugar"]=30; p["groceries"]=30; p["fabric"]=20; p["dye"]=40;
    p["tools"]=40; p["electricity"]=30; p["clothes"]=30; p["wood"]=20; p["furniture"]=30;
    p["lead"]=40; p["oil"]=40; p["glass"]=40; p["iron"]=40; p["steel"]=50; p["rubber"]=40;
    p["sulfur"]=50; p["paper"]=30;
    print "PM                                target  ->  out            inputs                              actualBE  IO@100  IO@150";
}
function round(x){ return int(x+0.5) }
{
    label=$1; tbe=$2/100.0;
    # parse out=
    split($3, o, "="); split(o[2], og, ":"); outgood=og[1]; outqty=og[2]+0;
    vanO = outqty*p[outgood];
    # parse in=
    split($4, iarg, "="); n=split(iarg[2], items, ",");
    vanI=0;
    for(i=1;i<=n;i++){ split(items[i], g, ":"); ing[i]=g[1]; inq[i]=g[2]+0; vanI += inq[i]*p[ing[i]]; }
    vbe = vanI/vanO;
    k = sqrt(tbe/vbe);
    # new quantities
    newOut = round(outqty/k);
    newO = newOut*p[outgood];
    newI=0; instr="";
    for(i=1;i<=n;i++){ nq=round(inq[i]*k); if(nq<1)nq=1; newI += nq*p[ing[i]]; instr=instr (i>1?", ":"") ing[i]":"nq; }
    abe = newI/newO*100;
    io100 = (newO-newI)/newI*100;
    io150 = (1.5*newO-newI)/newI*100;
    printf "%-30s  %4d%%   ->  %-12s   %-34s  %5.0f%%   %+6.1f%%  %+6.1f%%\n",
        label, $2, outgood":"newOut, instr, abe, io100, io150;
}
