#!/usr/bin/env bash
# THE BATCH HEARTBEAT — one command per wake-up while a schedule runs (CLAUDE.md: smoke-check every run ~5 min after it starts;
# post only on crash / resume / stall). For the session given: every run's clock, CRASHED and resume counts and summary count; for the
# NEWEST run the smoke items — mod marker, game-version mismatch, this run's error window by PARSED time (BOM-tolerant), the classes
# left after the four vanilla noise classes, and anything naming our files; SCHEDULE DONE; and, for the 60-run plan of §10.76, a
# reminder when run030 has landed. Read-only.
#   bash tools/testbed/batch_heartbeat.sh <session-folder-name>
cd "$(dirname "$0")/../.." || exit 1
S=tools/testbed/sessions/$1
[ -d "$S" ] || { echo "no such session: $S"; exit 2; }
echo "=== heartbeat $(date -u +%Y-%m-%d\ %H:%M) UTC — $1"
for r in $S/run0*/; do
  r=${r%/}; n=$(basename $r)
  printf "%-28s %s | CRASHED %s · resumes %s · summaries %s\n" "$n" "$(tail -1 $r/run.log 2>/dev/null | cut -c1-70)" "$(grep -c CRASHED $r/run.log 2>/dev/null)" "$(grep -c 'resume attempt' $r/run.log 2>/dev/null)" "$(ls $r/save_summaries 2>/dev/null | wc -l)"
done | tail -4
echo "runs with a folder: $(ls -d $S/run0*/ 2>/dev/null | wc -l) · complete (meta reached until): $(for r in $S/run0*/; do node -e "try{const m=JSON.parse(require('fs').readFileSync('${r}meta.json','utf8'));if(!m.abandoned_reason&&String(m.reached_ingame_date).startsWith(String(m.until_date).split('.')[0]))process.stdout.write('1')}catch(e){}"; done | wc -c) · SCHEDULE DONE: $(grep -c 'SCHEDULE DONE' $S/session.log 2>/dev/null)"
RUN=$(ls -d $S/run0*/ 2>/dev/null | tail -1); RUN=${RUN%/}
if [ -n "$RUN" ] && [ -f $RUN/run.log ]; then
  echo "--- newest run $(basename $RUN): marker $(grep -c PM_TECH_REHAUL $RUN/logs_live/debug.log 2>/dev/null) · version-mismatch lines $(grep -c 'does not match game version' $RUN/logs_live/error.log 2>/dev/null)"
  START=$(sed '1s/^\xEF\xBB\xBF//' $RUN/run.log | grep -m1 -o -E '^\[[0-9]{2}:[0-9]{2}:[0-9]{2}\]' | tr -d '[]')
  if [ -n "$START" ] && [ -f $RUN/logs_live/error.log ]; then
    SS=$(echo $START | awk -F: '{print $1*3600+$2*60+$3}')
    N=$(awk -v START=$SS 'match($0,/^\[[0-9][0-9]:[0-9][0-9]:[0-9][0-9]\]/){h=substr($0,2,2);m=substr($0,5,2);s=substr($0,8,2); if(h*3600+m*60+s>=START){print NR; exit}}' $RUN/logs_live/error.log)
    if [ -n "$N" ]; then
      W=$(tail -n +$N $RUN/logs_live/error.log | grep -v -E "jomini_spline_network_graphics|is_production_method_active|lawgroup_navy_model|Could not get leader of interest group|jomini_script_system.cpp:247|Script location" | wc -l)
      echo "    error window from $START: $(tail -n +$N $RUN/logs_live/error.log | wc -l) lines, $W after the noise classes; top classes:"
      tail -n +$N $RUN/logs_live/error.log | grep -v -E "jomini_spline_network_graphics|is_production_method_active|lawgroup_navy_model|Could not get leader of interest group|jomini_script_system.cpp:247|Script location" | sed -E 's/^\[[0-9:]+\]\[[^]]*\]: //; s/[0-9]+/N/g' | cut -c1-100 | sort | uniq -c | sort -rn | head -4 | sed 's/^/      /'
      OURS=$(tail -n +$N $RUN/logs_live/error.log | grep -i -E "zzz_pm_rehaul|pm_rehaul|journal_entries/zzz|scripted_progress_bars/zzz|company_types" | grep -v "is_production_method_active\|utf8-bom" | wc -l)
      [ "$OURS" != "0" ] && { echo "    ⚠ $OURS lines name OUR files:"; tail -n +$N $RUN/logs_live/error.log | grep -i -E "zzz_pm_rehaul|pm_rehaul" | grep -v "utf8-bom" | cut -c1-140 | sort | uniq -c | sort -rn | head -3 | sed 's/^/      /'; }
    fi
  fi
fi
if [ -f $S/run030_*/meta.json ] 2>/dev/null; then echo "⭐ run030 has landed — the §10.76 gate: node tools/testbed/ledger/assess_gdp_gate.mjs --session $1 --setup $(ls -d $S/run001_*/ | sed 's#.*/run001_##; s#/##')"; fi
[ -f tools/testbed/STOP ] && echo "⚠ tools/testbed/STOP EXISTS — it will stop the current run at once and kill the next launch's first run; delete it unless that is intended"
exit 0
