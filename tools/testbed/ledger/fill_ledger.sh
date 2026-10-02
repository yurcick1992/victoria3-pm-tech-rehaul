#!/usr/bin/env bash
# THE BATCH LEDGER'S DATA FILL FOR ONE CONFIGURATION, AS ONE COMMAND (promoted from the session scratchpad 2026-10-02; it pays off the README's
# "not yet a single command" TODO for the data half). It runs every data script in the README's order on the arm's COMPLETE runs against the
# pinned vanilla n=16 baseline; the prose half (lede / incidents / next / footer .html, tokens.json, title.txt) is written by hand afterwards,
# then `node tools/testbed/ledger/fill_assemble.mjs <outDir>` and `node tools/testbed/ledger/fill_verify.mjs <outDir>` (exit 0 = publishable).
#
#   bash tools/testbed/ledger/fill_ledger.sh <session> <setup> <book> <outName>
#   e.g. bash tools/testbed/ledger/fill_ledger.sh 20261002_120946_e1a12-ai1135-n2 e1a12-ai1135 config/mod_config.e1a12-ai1135-artmerge.json out_e1a12_ai1135
#
# ⚠ ONE session: analyse_gdp_gap, fill_tierchoice and fill_obsolescence take --session. The --mod run list is comma-separated sess/run, so the
#   other steps could pool sessions, but the page would then mix pooled and single-session panels — run one session per report.
# ⚠ A run counts when its meta.json says it reached its own until date with no abandoned_reason (landmine L17); a run BROKEN on the register is
#   still complete and is reported, not dropped (the F161 / F209 precedent) — say so in the prose.
set -u
cd "$(dirname "$0")/../../.."
[ $# -eq 4 ] || { echo "usage: fill_ledger.sh <session> <setup> <book> <outName>"; exit 1; }
SESSION=$1; SETUP=$2; BOOK=$3; OUT=tools/testbed/ledger/$4
L=tools/testbed/ledger; S=tools/testbed/sessions; VANS=20260821_131149_vanilla-baseline-n16
[ -d "$S/$SESSION" ] || { echo "no such session: $S/$SESSION"; exit 1; }
[ -f "$BOOK" ] || { echo "no such book: $BOOK"; exit 1; }
mkdir -p "$OUT"
complete_runs() {   # $1 session, $2 run-folder glob suffix → comma-separated sess/run of the COMPLETE runs
  for d in $S/$1/run*_$2; do [ -f "$d/meta.json" ] && node -e "const m=require('./$d/meta.json'); if (m.reached_ingame_date===m.until_date && !m.abandoned_reason) console.log('$1/'+'$(basename $d)')"; done | paste -sd,
}
MOD=$(complete_runs "$SESSION" "$SETUP")
VAN=$(complete_runs "$VANS" "vanilla")
[ -n "$MOD" ] || { echo "no complete run of setup $SETUP in $SESSION"; exit 1; }
echo "$MOD" > "$OUT/_mod.txt"; echo "$VAN" > "$OUT/_van.txt"
echo "MOD runs: $MOD"; echo "VAN runs: $(echo "$VAN" | tr ',' '\n' | wc -l)"
step() { echo; echo "=== $*"; "$@" || echo "!!! FAILED ($?): $*"; }
step node $L/analyse_gdp_gap.mjs --session $SESSION --setup $SETUP --config $BOOK --out $OUT
step node $L/report_data.mjs --mod $MOD --van $VAN --nb none --config $BOOK --out $OUT
step node $L/report_data2.mjs --mod $MOD --van $VAN --config $BOOK --out $OUT
step node $L/report_perf.mjs $(echo $MOD | tr ',' '\n' | sed "s|^|$S/|") $S/$VANS --json $OUT/perf_raw.json
step node $L/fill_build_perf.mjs $OUT
step node $L/fill_consts.mjs $OUT --mod $MOD --van $VAN --nb none
step node $L/fill_emp.mjs $OUT --mod $MOD --config $BOOK
step node $L/fill_payback.mjs $OUT --mod $MOD --config $BOOK
step node $L/fill_research.mjs $OUT --mod $MOD
step node $L/fill_tierchoice.mjs $OUT --session $SESSION --setup $SETUP --config $BOOK
step node $L/fill_indecomp.mjs $OUT --mod $MOD --van $VAN --config $BOOK
step node $L/fill_obsolescence.mjs $OUT --session $SESSION --setup $SETUP --config $BOOK
step node $L/fill_goals.mjs $OUT/goals.html $OUT
echo; echo "data filled in $OUT — now write lede.html incidents.html next.html footer.html tokens.json title.txt, then fill_assemble + fill_verify"
