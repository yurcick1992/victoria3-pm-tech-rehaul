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

TMP2="$(mktemp)"
trap 'rm -f "$TMP2"' EXIT

# EVERY definition the game reads (vanilla + mod). VANILLA FIRST, MOD SECOND everywhere, so the mod overrides: the
# builder only owns a production_methods file it actually CHANGES (01_industry.txt carries the secondary gate remap),
# so the vanilla set is the base and the mod contributes its changed file(s) plus our zzz_* methods and groups.
# (Before that change the mod carried a verbatim copy of every vanilla PM file and the vanilla ones were redundant.)
# ⭐ BOTH linters read the same concatenation. The profitability check used to read vanilla 01_industry plus the mod's
# zzz_* files alone, which was enough while it took each group's FIRST member blindly; since 2026-10-03 it picks the
# first member LEGAL beside each main method (BALANCE_FRAMEWORK §10.93), so it needs every group a building names
# and every method's real gate - the mod's own 01_industry.txt included, which carries the remapped gates.
sed 's/^\xEF\xBB\xBF//' \
  "$C"/production_method_groups/*.txt \
  "$MODROOT/$MODDIR"/common/production_method_groups/*.txt \
  "$C"/production_methods/*.txt \
  "$MODROOT/$MODDIR"/common/production_methods/*.txt \
  "$C"/buildings/*.txt \
  "$MODROOT/$MODDIR"/common/buildings/*.txt \
  > "$TMP2"

# prices come from the ONE shared table, never a copy inside the linter
awk -v PRICES="$HERE/goods_prices.tsv" -f "$HERE/lint_profitability.awk" "$LADDER" "$TMP2"

# --- negative-goods invariant: no legal PM combination drives any good's building total below zero ---
awk -f "$HERE/lint_negative_goods.awk" "$TMP2"
