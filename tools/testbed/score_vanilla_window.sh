#!/usr/bin/env bash
# Score the vanilla campaign's saves around a good's debut.
#   bash tools/testbed/score_vanilla_window.sh <session dir> <good> [market] [probe state]
# Picks the archived saves nearest a set of dates around the good's first appearance in the market's
# order book, melts each, and runs the full reconstruction against it.
set -uo pipefail
SESS=${1:?session dir}; GOOD=${2:-automobiles}
MARKET=${3:-American Market}; PROBE=${4:-STATE_NEW_YORK}
MK="$SESS/markets_all.tsv"; LOG="$SESS/run001_vanilla/run.log"
[ -f "$MK" ] || { echo "no $MK yet"; exit 1; }
# first dump date at which the market has a non-zero sell order for the good
DEBUT=$(awk -F'\t' -v g="$GOOD" -v m="$MARKET" '$4==m && $6==g && $8+0>0 {print $3}' "$MK" | sort -t. -k1,1n -k2,2n | head -1)
echo "### $GOOD first supplied in '$MARKET' at: ${DEBUT:-never}"
awk -F'\t' -v g="$GOOD" -v m="$MARKET" '$4==m && $6==g {printf "  %-11s buy=%9.1f sell=%9.1f price=%7.2f imports=%8.1f prod=%9.1f\n",$3,$7,$8,$9,$10,$12}' "$MK" | head -30
