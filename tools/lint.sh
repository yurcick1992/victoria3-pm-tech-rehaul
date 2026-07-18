#!/bin/bash
# PM & Tech Rehaul - profitability linter wrapper.
# Concatenates the vanilla + mod object files (BOM-stripped, vanilla first so mod overrides)
# and runs lint_profitability.awk to check each in-scope building's break-even against the ladder.
#
# Usage:  tools/lint.sh
# Override the game path with:  VIC3_GAME="/path/to/Victoria 3/game" tools/lint.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
MODROOT="$(cd "$HERE/.." && pwd)"
GAME="${VIC3_GAME:-C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game}"
C="$GAME/common"
MODDIR="${PM_MOD_DIR:-mod}"       # which built mod folder to lint (build.ps1 sets this for -DryRun/-SaveTo)
LADDER="${PM_LADDER:-$HERE/ladder_tiers.txt}"   # tier map to lint against (alt builds pass a temp one)

TMP="$(mktemp)"
TMP2="$(mktemp)"
trap 'rm -f "$TMP" "$TMP2"' EXIT

# vanilla first, then mod overrides; strip UTF-8 BOM from any line start
sed 's/^\xEF\xBB\xBF//' \
  "$C/production_methods/01_industry.txt" \
  "$C/production_method_groups/01_industry.txt" \
  "$C/buildings/01_industry.txt" \
  "$MODROOT/$MODDIR"/common/production_methods/zzz_*.txt \
  "$MODROOT/$MODDIR"/common/production_method_groups/zzz_*.txt \
  "$MODROOT/$MODDIR"/common/buildings/*.txt \
  > "$TMP"

awk -f "$HERE/lint_profitability.awk" "$LADDER" "$TMP"

# --- negative-goods invariant: no legal PM combination drives any good's building total below zero ---
# EVERY building (vanilla + mod). Reads the MOD's OWNED (overridden) production_methods so pm_goods edits
# are checked, all vanilla PMGs (PMG->PM lists), and all buildings (vanilla first, mod overrides second).
sed 's/^\xEF\xBB\xBF//' \
  "$C"/production_method_groups/*.txt \
  "$MODROOT/$MODDIR"/common/production_method_groups/zzz_*.txt \
  "$MODROOT/$MODDIR"/common/production_methods/*.txt \
  "$C"/buildings/*.txt \
  "$MODROOT/$MODDIR"/common/buildings/*.txt \
  > "$TMP2"

awk -f "$HERE/lint_negative_goods.awk" "$TMP2"
