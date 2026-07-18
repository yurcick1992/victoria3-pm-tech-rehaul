<#
  Shared parsing for the 1836 start tools (convert_history.ps1, extract_start.ps1).
  Dot-source this file:  . (Join-Path $PSScriptRoot 'history_lib.ps1')
#>

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
