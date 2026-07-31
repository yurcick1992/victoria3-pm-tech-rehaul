<#
  rescue_ring.ps1 - snapshot the game's rotating debug ring while a run is in progress.

  STOPGAP for the mirror bug found 2026-07-31: run_observer.ps1's Read-Tail assumes at most ONE
  rotation between polls (it reads <name>.1.<ext> and resets Pos). At high telemetry volume the
  game rotates the 5 x 512 KB ring several times between polls, so whole segments are lost - a
  probe run emitted 1046 GDP lines and the mirror captured 0.

  This copies every debug*.log every -IntervalSeconds into <Out>\snap_<timestamp>\, so no segment
  can age out unseen. Reassemble afterwards with -Merge, which concatenates every snapshot and
  de-duplicates lines while preserving first-seen order.

  Usage:
    rescue_ring.ps1 -Out <dir> [-IntervalSeconds 45] [-MaxMinutes 60]
    rescue_ring.ps1 -Out <dir> -Merge          # -> <Out>\debug_merged.log
#>
param(
    [Parameter(Mandatory=$true)][string]$Out,
    [int]$IntervalSeconds = 45,
    [int]$MaxMinutes = 60,
    [switch]$Merge
)
$ErrorActionPreference = 'Stop'
$logDir = Join-Path $env:USERPROFILE 'Documents\Paradox Interactive\Victoria 3\logs'

if ($Merge) {
    $seen = New-Object 'System.Collections.Generic.HashSet[string]'
    $outFile = Join-Path $Out 'debug_merged.log'
    $w = New-Object System.IO.StreamWriter($outFile, $false, (New-Object System.Text.UTF8Encoding($false)))
    # Oldest snapshot first, and within a snapshot the highest segment index is the oldest content.
    foreach ($snap in (Get-ChildItem $Out -Directory -Filter 'snap_*' | Sort-Object Name)) {
        $files = Get-ChildItem $snap.FullName -Filter 'debug*.log' | Sort-Object {
            if ($_.Name -match 'debug\.(\d+)\.log') { -[int]$Matches[1] } else { 0 }
        }
        foreach ($f in $files) {
            foreach ($line in [System.IO.File]::ReadLines($f.FullName)) {
                if ($line.Length -gt 0 -and $seen.Add($line)) { $w.WriteLine($line) }
            }
        }
    }
    $w.Flush(); $w.Dispose()
    Write-Output ("merged {0} unique lines -> {1}" -f $seen.Count, $outFile)
    return
}

New-Item -ItemType Directory -Force -Path $Out | Out-Null
$deadline = (Get-Date).AddMinutes($MaxMinutes)
$n = 0
while ((Get-Date) -lt $deadline) {
    if (-not (Get-Process victoria3 -ErrorAction SilentlyContinue)) {
        Start-Sleep -Seconds 3   # let the game flush its final writes
        $dst = Join-Path $Out ("snap_{0:yyyyMMdd_HHmmss}_final" -f (Get-Date))
        New-Item -ItemType Directory -Force -Path $dst | Out-Null
        Get-ChildItem $logDir -Filter 'debug*.log' | ForEach-Object {
            Copy-Item $_.FullName (Join-Path $dst $_.Name) -ErrorAction SilentlyContinue
        }
        Write-Output "game exited - final snapshot taken, stopping"
        break
    }
    $dst = Join-Path $Out ("snap_{0:yyyyMMdd_HHmmss}" -f (Get-Date))
    New-Item -ItemType Directory -Force -Path $dst | Out-Null
    Get-ChildItem $logDir -Filter 'debug*.log' | ForEach-Object {
        Copy-Item $_.FullName (Join-Path $dst $_.Name) -ErrorAction SilentlyContinue
    }
    $n++
    Write-Output ("snapshot {0} at {1:HH:mm:ss}" -f $n, (Get-Date))
    Start-Sleep -Seconds $IntervalSeconds
}
