BEGIN {
    # base prices
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
}
# PM header at column 0
/^pm_[a-z0-9_-]+[ ]*=[ ]*\{/ {
    if (name != "") flush();
    name=$1; inv=0; outv=0; nin=0; nout=0; instr=""; outstr="";
    next;
}
/goods_input_[a-z_]+_add[ ]*=/ {
    g=$1; sub(/^goods_input_/,"",g); sub(/_add$/,"",g);
    q=$3+0;
    if (p[g]=="") { print "MISSING PRICE: "g > "/dev/stderr"; }
    inv += q*p[g]; nin++;
    instr = instr (nin>1?", ":"") g"x"q"@"p[g];
    next;
}
/goods_output_[a-z_]+_add[ ]*=/ {
    g=$1; sub(/^goods_output_/,"",g); sub(/_add$/,"",g);
    q=$3+0;
    if (p[g]=="") { print "MISSING PRICE: "g > "/dev/stderr"; }
    outv += q*p[g]; nout++;
    outstr = outstr (nout>1?", ":"") g"x"q"@"p[g];
    next;
}
END { if (name!="") flush(); }
function flush(   ioB, ioA) {
    if (outv>0) {
        ioB = (outv-inv)/inv*100;          # base output price
        ioA = (1.5*outv-inv)/inv*100;      # 150% output price
        be  = inv/outv*100;                # break-even output price %
        printf "%-45s in=%-6d out=%-6d  IO@100%%=%+7.1f%%  IO@150%%=%+7.1f%%  BE=%5.0f%%\n",
            name, inv, outv, ioB, ioA, be;
    }
}
