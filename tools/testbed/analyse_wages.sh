#!/usr/bin/env bash
# Analysis for the `wages` telemetry metric (Q1 base wage / Q2 wage+SoL trajectory / Q3 workforce
# ratio). Usage:  analyse_wages.sh <session folder> [--csv <dir>]
#
# Two things here are not incidental detail - they are what makes the numbers trustworthy:
#
# 1. TOKEN FILTERING. The game's log ring is shared across runs, and a run's folder demonstrably
#    contains other sessions' lines: session 20260802_222826/run001 holds 976 Belgian pop lines
#    stamped 20260802_215913 across five dates, for a country with 187 pops. Every line is therefore
#    matched against THIS run's own token from meta.json. Without that the counts are fiction.
#
# 2. PER-SOURCE COMPLETENESS, not a deduplicated union. The live mirror and the exit-time ring copy
#    each hold a DIFFERENT fragment of the same stream, so both must be read - but per-pop lines
#    cannot be safely deduplicated, because two pops with equal values emit byte-identical lines and
#    collapsing them destroys the distribution being measured. Instead the WC line carries each
#    country's pop-OBJECT count, so the expected number of PW lines is known independently: for each
#    (date, country) the source that matches the expected count is used whole, and only if none does
#    is a deduplicated union used, with the shortfall reported rather than hidden.
set -uo pipefail

SESS="${1:?usage: analyse_wages.sh <session folder> [--csv <dir>]}"
CSVDIR=""
[[ "${2:-}" == "--csv" ]] && CSVDIR="${3:?--csv needs a directory}" && mkdir -p "$CSVDIR"

# wage_weight per pop type, in the order Get-WagePopTypes defines (the integer on each PW line).
# Source: common/pop_types/*.txt. Index 0 is "unknown type" - a patch adding a pop type shows as 0.
TYPES=(unknown laborers farmers machinists clerks shopkeepers engineers clergymen bureaucrats \
       academics officers soldiers aristocrats capitalists peasants slaves)
WEIGHTS=(0 1 2 1.5 1.5 3 3 3 4 4 5 1.5 5 5 0.2 0)

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

for RUN in "$SESS"/run*/; do
  [[ -d "$RUN" ]] || continue
  RUNNAME=$(basename "$RUN")
  TOKEN=$(grep -o '"token":[^,]*' "$RUN/meta.json" 2>/dev/null | head -1 | sed 's/.*"\([^"]*\)".*/\1/')
  [[ -n "$TOKEN" ]] || { echo "[$RUNNAME] no token in meta.json - skipping"; continue; }

  echo
  echo "################################################################"
  echo "# $RUNNAME   token=$TOKEN"
  echo "################################################################"

  # --- collect every source fragment, token-filtered, tagged with its source ---
  : > "$TMP/all.txt"
  for SRC in "$RUN"/logs_live/debug.log "$RUN"/logs/debug.log "$RUN"/logs/debug.?.log; do
    [[ -f "$SRC" ]] || continue
    grep -F "V3TB|$TOKEN|" "$SRC" 2>/dev/null \
      | sed "s|^.*V3TB|$(basename "$SRC")\tV3TB|" >> "$TMP/all.txt"
  done
  [[ -s "$TMP/all.txt" ]] || { echo "  no telemetry lines for this token"; continue; }
  # payload without the source tag, de-duplicated. Safe for every line kind EXCEPT PW (two pops can
  # be byte-identical), which is why the per-pop set is built separately and never from this file.
  awk -F'\t' '{print $2}' "$TMP/all.txt" | sort -u > "$TMP/all_payload.txt"

  # --- WC: expected pop-object count per (date,country); also population and mean SoL ---
  awk -F'\t' '{print $2}' "$TMP/all.txt" | awk -F'|' '$3=="WC"' | sort -u > "$TMP/wc.txt"
  # fields: V3TB|tok|WC|date|leadtag|country|market|popobj|states|totalpop|avgsol
  awk -F'|' '{print $4"\t"$6"\t"$8}' "$TMP/wc.txt" | sort -u > "$TMP/expected.txt"

  echo
  echo "=== DUMPS PRESENT ==="
  awk -F'|' '{print $4}' "$TMP/wc.txt" | sort -u | tr '\n' ' '; echo

  # --- PW completeness per (date,country), choosing the best single source ---
  awk -F'\t' '{print $1"\t"$2}' "$TMP/all.txt" | awk -F'\t' '$2 ~ /\|PW\|/' > "$TMP/pw_tagged.txt"
  : > "$TMP/pw.txt"
  echo
  echo "=== PER-POP COMPLETENESS (expected from the WC pop-object count) ==="
  printf '  %-10s %-22s %7s %7s  %s\n' DATE COUNTRY EXPECT GOT SOURCE
  while IFS=$'\t' read -r d c exp; do
    best=""; bestn=0
    while read -r src; do
      n=$(awk -F'\t' -v s="$src" -v d="$d" -v c="$c" \
            '$1==s { split($2,f,"|"); if (f[4]==d && f[7]==c) n++ } END{print n+0}' "$TMP/pw_tagged.txt")
      (( n > bestn )) && { bestn=$n; best=$src; }
      [[ "$n" == "$exp" ]] && break
    done < <(awk -F'\t' '{print $1}' "$TMP/pw_tagged.txt" | sort -u)
    [[ -z "$best" ]] && continue
    if [[ "$exp" == "?" ]]; then
      # No WC denominator survived for this (date, country). Keep every pop line - the union of all
      # sources - and say plainly that completeness could not be checked, rather than dropping data
      # or implying it is verified.
      awk -F'\t' -v d="$d" -v c="$c" '{ split($2,f,"|"); if (f[4]==d && f[7]==c) print $2 }' \
        "$TMP/pw_tagged.txt" | sort -u >> "$TMP/pw.txt"
      u=$(awk -F'\t' -v d="$d" -v c="$c" '{ split($2,f,"|"); if (f[4]==d && f[7]==c) print $2 }' \
        "$TMP/pw_tagged.txt" | sort -u | wc -l)
      printf '  %-10s %-22s %7s %7s  %s\n' "$d" "$c" "?" "$u" "no WC line survived - completeness UNKNOWN"
    elif [[ "$bestn" != "$exp" ]]; then
      # no single source is complete - fall back to a deduplicated union and say so
      awk -F'\t' -v d="$d" -v c="$c" '{ split($2,f,"|"); if (f[4]==d && f[7]==c) print $2 }' \
        "$TMP/pw_tagged.txt" | sort -u >> "$TMP/pw.txt"
      u=$(awk -F'\t' -v d="$d" -v c="$c" '{ split($2,f,"|"); if (f[4]==d && f[7]==c) print $2 }' \
        "$TMP/pw_tagged.txt" | sort -u | wc -l)
      # No SINGLE source held the whole set, so the fragments were merged. That is the normal case
      # and is fine when the merge reaches the expected count; only a shortfall is a warning.
      if [[ "$u" == "$exp" ]]; then flag="union of fragments - complete"
      else flag="** SHORT by $((exp - u)) - exclude or treat as a sample **"; fi
      printf '  %-10s %-22s %7s %7s  %s\n' "$d" "$c" "$exp" "$u" "$flag"
    else
      awk -F'\t' -v s="$best" -v d="$d" -v c="$c" \
        '$1==s { split($2,f,"|"); if (f[4]==d && f[7]==c) print $2 }' "$TMP/pw_tagged.txt" >> "$TMP/pw.txt"
      printf '  %-10s %-22s %7s %7s  %s\n' "$d" "$c" "$exp" "$bestn" "$best"
    fi
  done < <(
      # Drive off the PER-POP lines, not off WC. ⚠ Driving off WC silently DISCARDED every pop whose
      # WC line was lost - and the 1836 dump is exactly that case (its WC lines sit at the head of
      # the biggest burst and get clipped, §5.7), so Q1's own anchor date vanished from the report
      # while looking merely "absent". The WC count is used as the expected value WHERE IT EXISTS
      # and the completeness column says "unknown" where it does not; the pops are kept either way.
      awk -F'\t' '{ split($2,f,"|"); if (f[3]=="PW") print f[4]"\t"f[7] }' "$TMP/pw_tagged.txt" \
        | sort -u \
        | while IFS=$'\t' read -r d c; do
            e=$(awk -F'|' -v d="$d" -v c="$c" '$4==d && $6==c {print $8; exit}' "$TMP/wc.txt")
            printf '%s\t%s\t%s\n' "$d" "$c" "${e:-?}"
          done)

  # ---------------------------------------------------------------- Q1 / Q2 : WAGES
  # PW fields: V3TB|tok|PW|date|grp|anchor|country|state|typeid|wf|dep|total|sol|income|wfinc|depinc|exp
  echo
  echo "=== SUCCESSOR CHECK — which country anchored each group at each date ==="
  echo "    A group whose anchor CHANGES is no longer the same market. BEL falls back to NET and AUS"
  echo "    to GER if the lead tag is annexed or formed away, so anything keyed on the group alone"
  echo "    would silently average two different economies across the switch."
  awk -F'|' '$3=="PWG" && $6=="anchor" { print "  "$4"  "$5" -> "$7 }' "$TMP/all_payload.txt" 2>/dev/null | sort -u
  awk -F'|' '$3=="PWG" && $6=="ABSENT" { print "  "$4"  "$5" -> NOTHING EXISTS ("$7")" }' "$TMP/all_payload.txt" 2>/dev/null | sort -u

  echo
  echo "=== Q1/Q2  BASE WAGE per market  (base = weekly workforce income / worker / wage_weight) ==="
  echo "    LABOUR base excludes capitalists + aristocrats (dividends and rent arrive through the same"
  echo "    income field as a wage; including them inflated Belgium 3.85 -> 4.55/yr) and peasants"
  echo "    (subsistence is not a market wage). ALL is every pop, shown so the gap stays visible."
  printf '  %-10s %-6s %-6s %10s %10s %10s %10s %12s\n' DATE GROUP ANCHOR 'LABOUR/wk' 'LABOUR/yr' 'ALL/yr' 'WAGE/wkr' 'WORKERS'
  awk -F'|' -v W="${WEIGHTS[*]}" -v T="${TYPES[*]}" '
    BEGIN { split(W,wt," "); split(T,tn," ")
            split("laborers farmers machinists clerks shopkeepers engineers clergymen bureaucrats academics officers soldiers",L," ")
            for (i in L) isLab[L[i]]=1 }
    $3=="PW" {
      k=$4"|"$5"|"$6; ti=$9+0; wf=$10+0; wi=$15+0; w=wt[ti+1]+0;
      inc[k]+=wi; units[k]+=wf*w; work[k]+=wf;
      if (isLab[tn[ti+1]]) { linc[k]+=wi; lunits[k]+=wf*w }
    }
    END {
      for (k in inc) {
        split(k,a,"|");
        lb   = (lunits[k]>0) ? linc[k]/lunits[k] : 0;
        base = (units[k]>0)  ? inc[k]/units[k]   : 0;
        perw = (work[k]>0)   ? inc[k]/work[k]*52 : 0;
        printf "  %-10s %-6s %-6s %10.5f %10.3f %10.3f %10.3f %12d\n",
               a[1], a[2], a[3], lb, lb*52, base*52, perw, work[k];
      }
    }' "$TMP/pw.txt" | sort

  echo
  echo "=== Q1  STATE AVERAGE ANNUAL WAGE per tracked market (the game's own figure) ==="
  echo "    weighted = by each state's non-subsistence working adults is NOT available, so both are shown"
  # SW fields: V3TB|tok|SW|date|leadtag|country|state|avgwage|subsist_wa|unemp_wa
  awk -F'\t' '{print $2}' "$TMP/all.txt" | awk -F'|' '$3=="SW"' | sort -u > "$TMP/sw.txt"
  printf '  %-10s %-5s %7s %10s %10s %10s %10s\n' DATE MKT STATES 'MEAN' 'MEDIAN' 'MIN' 'MAX'
  awk -F'|' '$3=="SW" { print $4"|"$5"|"$8 }' "$TMP/sw.txt" | sort -t'|' -k1,1 -k2,2 -k3,3g | awk -F'|' '
    { key=$1"|"$2; v[key]=v[key]" "$3; n[key]++ }
    END { for (k in v) {
        split(k,a,"|"); c=split(v[k],x," ");
        s=0; for(i=1;i<=c;i++) s+=x[i];
        med = (c%2) ? x[int(c/2)+1] : (x[c/2]+x[c/2+1])/2;
        printf "  %-10s %-5s %7d %10.4f %10.4f %10.4f %10.4f\n", a[1], a[2], c, s/c, med, x[1], x[c];
    } }' | sort

  # ---------------------------------------------------------------- TRAJECTORY (every dump)
  # WSTR is what carries Q2 and Q3 at the dates where the per-pop sweep cannot fit in the log ring
  # (§5.7). Fields: |WSTR|date|group|country|workforce|dependents|totalpop|avgSoL| then five
  # (SoL x workforce, workforce) pairs for upper/middle/lower/peasants/slaves.
  echo
  echo "=== Q2/Q3 TRAJECTORY — per-stratum SoL and workforce ratio, EVERY dump ==="
  echo "    people-weighted SoL per stratum; ratio = workforce / total population"
  printf '  %-10s %-6s %-20s %8s %8s %8s %8s %8s %8s\n' DATE GROUP COUNTRY RATIO 'SoL avg' upper middle lower peasant
  awk -F'|' '$3=="WSTR" {
      # 4=date 5=group 6=country 7=workforce 8=dependents 9=totalpop 10=avgSoL,
      # then five (SoL x workforce, workforce) pairs from field 11.
      date=$4; grp=$5; ctry=$6; wf=$7+0; dep=$8+0; tot=$9+0; asol=$10+0;
      u = ($12>0)? $11/$12 : 0; m = ($14>0)? $13/$14 : 0; l = ($16>0)? $15/$16 : 0; p = ($18>0)? $17/$18 : 0;
      printf "  %-10s %-6s %-20s %8.4f %8.2f %8.2f %8.2f %8.2f %8.2f\n",
             date, grp, ctry, (tot>0?wf/tot:0), asol, u, m, l, p;
    }' "$TMP/all_payload.txt" | sort -k1,1 -k3,3

  # ---------------------------------------------------------------- Q3 : WORKFORCE RATIO
  echo
  echo "=== Q3  WORKFORCE RATIO  (workforce / total size = 1 - dependent share) ==="
  echo "    define WORKING_ADULT_RATIO_BASE = 0.25; aristocrats override 0.2, slaves 0.5"
  printf '  %-10s %-6s %-6s %12s %12s %10s\n' DATE GROUP ANCHOR 'WORKFORCE' 'TOTAL' 'RATIO'
  awk -F'|' '$3=="PW" { k=$4"|"$5"|"$6; wf[k]+=$10; tot[k]+=$12 }
    END { for (k in wf) { split(k,a,"|");
      printf "  %-10s %-6s %-6s %12d %12d %10.4f\n", a[1], a[2], a[3], wf[k], tot[k], (tot[k]>0?wf[k]/tot[k]:0) } }' \
    "$TMP/pw.txt" | sort

  echo
  echo "  -- by pop type, per COUNTRY (not per group: the successor chain re-anchors, so a group"
  echo "     label can cover two different countries across runs and pooling them invents a trend) --"
  printf '  %-10s %-18s %-13s %12s %10s %12s %10s\n' DATE COUNTRY TYPE 'WORKFORCE' 'RATIO' 'WAGE/wkr/yr' 'BASE £/yr'
  # ⚠ Keyed on COUNTRY ($7), never on the group label ($5). Measured 2026-08-03: keying on the group
  # pooled Austria (run 1) with the German Empire (run 2) under "AUS", and the Netherlands with
  # Belgium under "BEL", which manufactured a uniform 0.02-0.03 downward "drift" that does not exist
  # (FINDINGS F25 Q3). A group label is a sweep scope, not an entity.
  awk -F'|' -v T="${TYPES[*]}" -v W="${WEIGHTS[*]}" '
    BEGIN { split(T,tn," "); split(W,wt," ") }
    $3=="PW" { k=$4"|"$7"|"($9+0); wf[k]+=$10; tot[k]+=$12; wi[k]+=$15 }
    END { for (k in wf) { split(k,a,"|"); w=wt[a[3]+1]+0;
      if (wf[k] < 1000) continue;
      perw = (wf[k]>0) ? wi[k]/wf[k]*52 : 0;
      printf "  %-10s %-18s %-13s %12d %10.4f %12.3f %10.3f\n", a[1], a[2], tn[a[3]+1], wf[k],
             (tot[k]>0?wf[k]/tot[k]:0), perw, (w>0?perw/w:0) } }' "$TMP/pw.txt" \
    | sort -k1,1 -k2,2 -k3,3

  # ---------------------------------------------------------------- SoL
  echo
  echo "=== Q2  STANDARD OF LIVING distribution (people-weighted by workforce) ==="
  printf '  %-10s %-13s %8s %8s %8s %8s %8s\n' DATE GROUP/ANCHOR MEAN P10 MEDIAN P90 MAX
  awk -F'|' '$3=="PW" { print $4"|"$5"/"$6"|"$13"|"$10 }' "$TMP/pw.txt" \
    | sort -t'|' -k1,1 -k2,2 -k3,3g | awk -F'|' '
    { key=$1"|"$2; sol[key]=sol[key]" "$3; wt[key]=wt[key]" "$4 }
    END { for (k in sol) {
      split(k,a,"|"); c=split(sol[k],s," "); split(wt[k],w," ");
      tot=0; sm=0; for(i=1;i<=c;i++){ tot+=w[i]; sm+=s[i]*w[i] }
      run=0; p10=s[1]; p50=s[1]; p90=s[c];
      for(i=1;i<=c;i++){ run+=w[i];
        if (run<=tot*0.10) p10=s[i]; if (run<=tot*0.50) p50=s[i]; if (run<=tot*0.90) p90=s[i] }
      printf "  %-10s %-13s %8.3f %8s %8s %8s %8s\n", a[1], a[2], (tot>0?sm/tot:0), p10, p50, p90, s[c];
    } }' | sort

  if [[ -n "$CSVDIR" ]]; then
    cp "$TMP/pw.txt" "$CSVDIR/${RUNNAME}_pw.txt"
    cp "$TMP/sw.txt" "$CSVDIR/${RUNNAME}_sw.txt"
    cp "$TMP/wc.txt" "$CSVDIR/${RUNNAME}_wc.txt"
    echo; echo "  raw lines written to $CSVDIR/${RUNNAME}_{pw,sw,wc}.txt"
  fi
done
