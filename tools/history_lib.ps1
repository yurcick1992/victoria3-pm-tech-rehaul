<#
  Shared parsing for the vanilla-reading tools (convert_history.ps1, extract_start.ps1,
  extract_vanilla.ps1, extract_presets.ps1).
  Dot-source this file:  . (Join-Path $PSScriptRoot 'history_lib.ps1')
#>

# Read every top-level `<prefix>NAME = { ... }` block from a directory of .txt files, brace-tracked.
# Returns an ordered hashtable name -> array of block lines (header .. matching close).
function Get-TopBlocks([string]$dir, [string]$prefix) {
    $blocks = [ordered]@{}
    foreach ($f in (Get-ChildItem -LiteralPath $dir -Filter *.txt | Sort-Object Name)) {
        $text = [System.IO.File]::ReadAllText($f.FullName)   # ReadAllText strips the BOM
        $lines = $text -split "`r?`n"
        $i = 0
        while ($i -lt $lines.Count) {
            if ($lines[$i] -match ("^(" + $prefix + "[A-Za-z0-9_-]+)\s*=\s*\{")) {   # keys may contain '-' (e.g. pm_coal-fired_plant)
                $name = $Matches[1]; $depth = 0
                $buf = New-Object System.Collections.Generic.List[string]
                do {
                    $ln = $lines[$i]
                    $depth += ([regex]::Matches($ln, '\{')).Count - ([regex]::Matches($ln, '\}')).Count
                    $buf.Add($ln); $i++
                } while ($i -lt $lines.Count -and $depth -gt 0)
                $blocks[$name] = $buf.ToArray()
            } else { $i++ }
        }
    }
    return $blocks
}

# Parse a vanilla numeric literal: int when it is one, double when the file writes a fraction
# (PM goods values are fractional in the subsistence / urban-centre / agro files: 1.0, 0.5, 0.33).
function Get-Num([string]$s) {
    $d = [double]$s
    if ($d -eq [math]::Truncate($d)) { return [int]$d }
    return $d
}

# Collect the `key_` tokens inside a `<field> = { ... }` list (single- or multi-line, no nested braces).
function Get-ListTokens([string[]]$block, [string]$field, [string]$tokenPrefix) {
    $joined = ($block -join " ")
    if ($joined -match ($field + '\s*=\s*\{([^}]*)\}')) {
        return ([regex]::Matches($Matches[1], '(' + $tokenPrefix + '[A-Za-z0-9_-]+)') | ForEach-Object { $_.Groups[1].Value })   # keys may contain '-'
    }
    return @()
}

# Build lookup maps from the mod config.
#   baseIndustry : base building key (T1 key) -> industry id
#   pmMap        : industry id -> hashtable(vanilla_pm -> @{ tier_key; new_pm; tier })
#   industryById : industry id -> the industry config object (for tiers[] indexing)
function Get-SplitMaps($cfg) {
    $baseIndustry = @{}; $pmMap = @{}; $industryById = @{}
    foreach ($ind in $cfg.industries) {
        if ($ind.disabled) { continue }   # e.g. shipyards: leave vanilla, don't split/convert
        $industryById[$ind.id] = $ind
        $pmMap[$ind.id] = @{}
        $n = 0
        foreach ($t in $ind.tiers) {
            $n++
            if ($n -eq 1) { $baseIndustry[$t.key] = $ind.id }
            $entry = @{ tier_key = $t.key; new_pm = $t.pm_key; tier = $n }
            $pmMap[$ind.id][$t.vanilla_pm] = $entry
            # extra vanilla main PMs that also map to this tier (e.g. an undeveloped port's pm_anchorage → T1)
            if ($t.vanilla_pm_aliases) { foreach ($a in $t.vanilla_pm_aliases) { $pmMap[$ind.id][$a] = $entry } }
        }
    }
    return @{ baseIndustry = $baseIndustry; pmMap = $pmMap; industryById = $industryById }
}

# READ-ONLY variant of Walk-HistoryFile: invoke $Handler ($blockLines, $state, $country) for every
# `<keyword> = {` block in a history file, with the same s:STATE_x / region_state:TAG context tracking,
# but emitting nothing (the caller just collects). $keyword is a literal, e.g. 'create_pop'.
function Read-HistoryBlocks([string]$path, [string]$keyword, [scriptblock]$Handler) {
    $lines = Get-Content -LiteralPath $path
    $stack = New-Object System.Collections.Generic.List[object]
    $open = [regex]::Escape($keyword) + '\s*=\s*\{'
    $i = 0
    while ($i -lt $lines.Count) {
        $line = $lines[$i]
        if ($line -match $open) {
            $block = New-Object System.Collections.Generic.List[string]
            $depth = 0
            do {
                $l = $lines[$i]
                $depth += ([regex]::Matches($l, '\{')).Count - ([regex]::Matches($l, '\}')).Count
                $block.Add($l); $i++
            } while ($i -lt $lines.Count -and $depth -gt 0)
            $state = $null; $country = $null
            for ($s = $stack.Count - 1; $s -ge 0; $s--) {
                if (-not $country -and $stack[$s].type -eq 'country') { $country = $stack[$s].name }
                if (-not $state   -and $stack[$s].type -eq 'state')   { $state   = $stack[$s].name }
            }
            & $Handler $block.ToArray() $state $country
        } else {
            $delta = ([regex]::Matches($line, '\{')).Count - ([regex]::Matches($line, '\}')).Count
            if ($delta -ge 1) {
                $type = 'generic'; $name = $null
                if     ($line -match 's:(STATE_[A-Za-z0-9_]+)\s*=')      { $type = 'state';   $name = $Matches[1] }
                elseif ($line -match 'region_state:([A-Za-z0-9_]+)\s*=') { $type = 'country'; $name = $Matches[1] }
                $stack.Add(@{ type = $type; name = $name })
                for ($k = 1; $k -lt $delta; $k++) { $stack.Add(@{ type = 'generic'; name = $null }) }
            } elseif ($delta -le -1) {
                for ($k = 0; $k -lt [math]::Abs($delta); $k++) { if ($stack.Count -gt 0) { $stack.RemoveAt($stack.Count - 1) } }
            }
            $i++
        }
    }
}

# Walk a history/buildings file. Tracks the enclosing s:STATE_x and region_state:TAG so each
# create_building block is handed its (state, country) context. Calls $BlockHandler with
# ($blockLines, $state, $country); whatever it returns (array of lines, or @()/nothing to drop)
# is emitted in place. Non-block lines pass through unchanged. Returns the full emitted line array.
function Walk-HistoryFile([string]$path, [scriptblock]$BlockHandler) {
    $lines = Get-Content -LiteralPath $path
    $out = New-Object System.Collections.Generic.List[string]
    $stack = New-Object System.Collections.Generic.List[object]
    $i = 0
    while ($i -lt $lines.Count) {
        $line = $lines[$i]
        if ($line -match 'create_building\s*=\s*\{') {
            $block = New-Object System.Collections.Generic.List[string]
            $depth = 0
            do {
                $l = $lines[$i]
                $depth += ([regex]::Matches($l, '\{')).Count - ([regex]::Matches($l, '\}')).Count
                $block.Add($l); $i++
            } while ($i -lt $lines.Count -and $depth -gt 0)
            $state = $null; $country = $null
            for ($s = $stack.Count - 1; $s -ge 0; $s--) {
                if (-not $country -and $stack[$s].type -eq 'country') { $country = $stack[$s].name }
                if (-not $state   -and $stack[$s].type -eq 'state')   { $state   = $stack[$s].name }
            }
            $emit = & $BlockHandler $block.ToArray() $state $country
            if ($null -ne $emit) { foreach ($e in $emit) { $out.Add($e) } }
        } else {
            $opens  = ([regex]::Matches($line, '\{')).Count
            $closes = ([regex]::Matches($line, '\}')).Count
            $delta = $opens - $closes
            if ($delta -ge 1) {
                $type = 'generic'; $name = $null
                if     ($line -match 's:(STATE_[A-Za-z0-9_]+)\s*=')     { $type = 'state';   $name = $Matches[1] }
                elseif ($line -match 'region_state:([A-Za-z0-9_]+)\s*=') { $type = 'country'; $name = $Matches[1] }
                $stack.Add(@{ type = $type; name = $name })
                for ($k = 1; $k -lt $delta; $k++) { $stack.Add(@{ type = 'generic'; name = $null }) }
            } elseif ($delta -le -1) {
                for ($k = 0; $k -lt [math]::Abs($delta); $k++) { if ($stack.Count -gt 0) { $stack.RemoveAt($stack.Count - 1) } }
            }
            $out.Add($line); $i++
        }
    }
    return ,$out.ToArray()
}
