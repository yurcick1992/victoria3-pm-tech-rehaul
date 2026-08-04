#!/usr/bin/env bash
# Sweep the output ladder multiplier and count ILLOGICAL cases at each setting.
# Full pipeline per value: ladder -> build (regenerates ui/data.js, which the solvers read) -> fit -> solve.
#   bash tools/sweep_mult.sh 1.5 1.55 1.6
set -e
export PATH="/c/Program Files/nodejs:$PATH"
for M in "$@"; do
  echo "############ OUTPUT_MULT = $M ############"
  node tools/build_era_ladder.mjs --write --mult="$M" >/dev/null
  powershell -ExecutionPolicy Bypass -File tools/build.ps1 -NoLint -NoDeploy >/dev/null 2>&1
  node tools/era_solver.mjs --write >/dev/null
  node tools/era_scenarios.mjs --write 2>&1 | grep -E "^--- era|ILLOGICAL"
done
