#!/usr/bin/env bash
# THE BATCH LEDGER'S DATA FILL FOR ONE CONFIGURATION, AS ONE COMMAND (promoted from the session scratchpad 2026-10-02; it pays off the README's
# "not yet a single command" TODO for the data half). It runs every data script in the README's order on the arm's COMPLETE runs against the
# pinned vanilla n=16 baseline; the prose half (lede / incidents / next / footer .html, tokens.json, title.txt) is written by hand afterwards,
# then `node tools/testbed/ledger/fill_assemble.mjs <outDir>` and `node tools/testbed/ledger/fill_verify.mjs <outDir>` (exit 0 = publishable).
#
#   bash tools/testbed/ledger/fill_ledger.sh <session> <setup> <book> <outName>
#   e.g. bash tools/testbed/ledger/fill_ledger.sh 20261002_120946_e1a12-ai1135-n2 e1a12-ai1135 config/mod_config.e1a12-ai1135-artmerge.json out_e1a12_ai1135
#
# ⚠ (superseded 2026-10-08: "ONE session per report") — analyse_gdp_gap, fill_tierchoice and fill_obsolescence now read the same group
#   through lib_runs, so every panel is on the same runs. ⚠ input_price_flags takes whole sessions only (`a,b`): a group with single-run items
#   reads its sessions' every run there — name whole sessions, or check its run count in the output.
# ⚠ A run counts when its meta.json says it reached its own until date with no abandoned_reason (landmine L17); a run BROKEN on the register is
#   still complete and is reported, not dropped (the F161 / F209 precedent) — say so in the prose.
#
# ⭐⭐ A GROUP OF RUNS, NOT ONLY ONE SESSION (2026-10-08, user: "support random grouping of similar-config runs"). <session> may be a
#   COMMA LIST of session names and/or single `<session>/runNNN_<setup>` folders; every step reads the same group (lib_runs.mjs: L17/L34-
#   usable runs only, printed). ⭐ THE GROUP MUST BE ONE FAMILY (user-ruled 2026-10-08: identical builds are not required — "it should
#   belong to the same family … shouldn't have different tier or building structure", while different ladder coefficients and before/after
#   minor-bugfix builds may pool): lib_runs.configFamilies() compares each run's config STRUCTURE (enabled industries, rung keys, eras, crafts,
#   merged methods) and the fill STOPS on more than one family — ALLOW_MIXED=1 overrides. Inside a family it PRINTS every distinct config and
#   build, so the prose can say what was pooled. ⚠ The steps take ONE <book> for costs, eras and labels: with coefficient variants in the group,
#   pass the book most runs used and say so — the per-run register (criteria.mjs) reads each run's own config.
#   e.g. bash tools/testbed/ledger/fill_ledger.sh 20261005_154629_jex-n16,20261006_193418_jex-n8-v16 jex config/mod_config.e1a12-ai1135-tex1140-jex-artmerge.json out_jex_n16
set -u
cd "$(dirname "$0")/../../.."
[ $# -eq 4 ] || { echo "usage: fill_ledger.sh <session[,session|session/runNNN_setup…]> <setup> <book> <outName>"; exit 1; }
SESSION=$1; SETUP=$2; BOOK=$3; OUT=tools/testbed/ledger/$4
L=tools/testbed/ledger; S=tools/testbed/sessions; VANS=20260821_131149_vanilla-baseline-n16
[ -f "$BOOK" ] || { echo "no such book: $BOOK"; exit 1; }
mkdir -p "$OUT"
group_runs() {      # $1 group spec, $2 setup → comma-separated sess/run of the USABLE runs (lib_runs), the exclusions printed on stderr
  node -e "import('./$L/lib_runs.mjs').then(({usableRuns})=>{const r=usableRuns('$S','$1','$2');for(const d of r.dropped)console.error('  EXCLUDED '+d.run+': '+d.reason);console.log(r.runs.join(','))}).catch(e=>{console.error(e.message);process.exit(1)})"
}
MOD=$(group_runs "$SESSION" "$SETUP") || exit 1
VAN=$(group_runs "$VANS" "vanilla") || exit 1
[ -n "$MOD" ] || { echo "no usable run of setup $SETUP in $SESSION"; exit 1; }
node -e "import('./$L/lib_runs.mjs').then(({configFamilies})=>{const f=configFamilies('$S','$MOD'.split(','));for(const x of f){console.log('  family '+x.family+' x'+x.runs.length+': '+x.configs.length+' config(s), '+x.builds.length+' build(s)');for(const c of x.configs)console.log('    config '+String(c.sha).slice(0,16)+' x'+c.runs+'  '+c.path);if(x.changed.length)console.log('    ! config file changed since the run (structure read from today\'s file): '+x.changed.join(' '))}if(f.length>1&&process.env.ALLOW_MIXED!=='1'){console.error('MORE THAN ONE FAMILY (different tier/building structure) IN THE GROUP; ALLOW_MIXED=1 to report it anyway');process.exit(1)}})" || exit 1
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
# ⭐ the input-price red flags (BALANCE_FRAMEWORK §10.94): prose, highlighted inline in the verdict — every report carries it
#   with vanilla's line beside it: at the ruled thresholds vanilla throws ~21 SWING flags a century run, so a book's count needs it. The yearly
#   vanilla reference is the eleven-tag set (v9+ summaries; the pinned n=16 is v8 and prices nothing) — the prose names it as such
#   ⭐ 2026-10-08 (user: the listing "is at least 100 times too large to be readable"): the flag-by-flag listing goes to redflags_full.html, KEPT
#   beside the report and off the page; the page carries redflag_metrics.mjs's card (problem market-years, chronic markets) and the 3–15-sentence
#   summary the redflag-summary skill writes from redflags_digest.md into redflags_summary.html
step node $L/input_price_flags.mjs "$SETUP=$SESSION:$SETUP" --ref "vanilla (eleven-tag set, n=4)=20260920_225047_schedule,20260920_192007_schedule:vanilla" --yearly --html $OUT/redflags_full.html --json $OUT/redflags.json --list 0
step node $L/redflag_metrics.mjs $OUT
step node $L/fill_goals.mjs $OUT/goals.html $OUT
echo; echo "data filled in $OUT — now write lede.html incidents.html next.html footer.html tokens.json title.txt, and redflags_summary.html with the"
echo "redflag-summary skill (.claude/skills/redflag-summary/SKILL.md, from redflags_digest.md); then fill_assemble + fill_verify, and copy redflags_full.html"
echo "into the session folder beside REPORT.html"
