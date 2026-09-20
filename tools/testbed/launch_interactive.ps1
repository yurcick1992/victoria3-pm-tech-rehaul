<#
  LAUNCH THE GAME FOR A HUMAN TO LOOK AT — not a measurement run.

  Written 2026-09-20 so the user could read a building's panel and have the same building read out of the
  autosave (FINDINGS F152 §9: the wage/profit accounting could not be settled by inference and the save
  carries `salary_rate`, `goods_sales` and `goods_cost` per building).

  It is deliberately NOT run_observer.ps1: that plays headless to a date and quits, which is the opposite of
  what a person looking at the UI needs. What it shares with the observer is the care about state that is
  not ours:

    * BACKS UP content_load.json, pdx_settings.json and every autosave slot before touching anything.
      ⚠ A new game OVERWRITES the engine's autosave*.v3 ring. Those slots are often the last testbed run's,
      and sometimes a person's own game. Never start a game for someone without copying them first.
    * Sets autosave to `monthly` so the first one lands at 1836.2.1 — seconds of play, and the same date
      `extract_measured.ps1` reads, because day 0 is economically unfinished (F14: construction spend is
      exactly £0 before the sector has ticked).
    * Windowed, English — so it cannot hijack the desktop and logged strings stay stable.
    * -Restore puts all of it back.

  usage:  powershell -File tools\testbed\launch_interactive.ps1 [-WithMod] [-Autosave monthly]
          powershell -File tools\testbed\launch_interactive.ps1 -Restore
#>
[CmdletBinding()]
param(
    [switch] $WithMod,                       # default is VANILLA — an engine question belongs on the vanilla arm
    [string] $Autosave = "monthly",          # never / monthly / quarteryear / halfyear / yearly / five_year
    [switch] $Restore,
    [string] $Game = "C:\Program Files (x86)\Steam\steamapps\common\Victoria 3\game"
)
$ErrorActionPreference = "Stop"

$Doc      = Join-Path $env:USERPROFILE "Documents\Paradox Interactive\Victoria 3"
$Binaries = Join-Path (Split-Path -Parent $Game) "binaries"
$Exe      = Join-Path $Binaries "victoria3.exe"
$SaveDir  = Join-Path $Doc "save games"
$BackupRoot = Join-Path $Doc "_interactive_backup"
$Utf8NoBom  = New-Object System.Text.UTF8Encoding($false)

function Restore-All {
    if (-not (Test-Path $BackupRoot)) { Write-Host "no backup found at $BackupRoot"; return }
    $latest = Get-ChildItem $BackupRoot -Directory | Sort-Object Name -Descending | Select-Object -First 1
    if (-not $latest) { Write-Host "no backup found"; return }
    Write-Host "restoring from $($latest.FullName)"
    foreach ($f in @("content_load.json", "pdx_settings.json")) {
        $src = Join-Path $latest.FullName $f
        if (Test-Path $src) { Copy-Item $src (Join-Path $Doc $f) -Force; Write-Host "  restored $f" }
    }
    $sv = Join-Path $latest.FullName "saves"
    if (Test-Path $sv) {
        foreach ($f in Get-ChildItem $sv -Filter 'autosave*.v3') {
            Copy-Item $f.FullName (Join-Path $SaveDir $f.Name) -Force
            Write-Host "  restored $($f.Name)"
        }
    }
    Write-Host "done."
}

if ($Restore) { Restore-All; exit 0 }

if (-not (Test-Path $Exe)) { throw "victoria3.exe not found at $Exe" }
if (Get-Process victoria3 -ErrorAction SilentlyContinue) { throw "Victoria 3 is already running - close it first" }

# ---- back everything up, before anything is written
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$bk = Join-Path $BackupRoot $stamp
New-Item -ItemType Directory -Force -Path (Join-Path $bk "saves") | Out-Null
foreach ($f in @("content_load.json", "pdx_settings.json")) {
    $src = Join-Path $Doc $f
    if (Test-Path $src) { Copy-Item $src (Join-Path $bk $f) -Force }
}
$slots = @(Get-ChildItem $SaveDir -Filter 'autosave*.v3' -ErrorAction SilentlyContinue)
foreach ($f in $slots) { Copy-Item $f.FullName (Join-Path $bk "saves\$($f.Name)") -Force }
Write-Host "backed up $($slots.Count) autosave slot(s) + settings -> $bk"

# ---- the mod state
$entries = @()
if ($WithMod) { $entries += ('{"path":"' + ((Join-Path $Doc "mod\pm_tech_rehaul") -replace '\\', '/') + '"}') }
$json = '{"enabledMods":[' + ($entries -join ',') + '],"disabledDLC":[],"enabledUGC":[]}'
[System.IO.File]::WriteAllText((Join-Path $Doc "content_load.json"), $json, $Utf8NoBom)
Write-Host ("mods enabled: " + $(if ($WithMod) { "pm_tech_rehaul (the canon)" } else { "NONE - pure vanilla" }))

# ---- settings. The game rewrites this file on exit and drops defaults, so never assume a key is there.
function Set-JsonSetting {
    param($Root, [string]$Category, [string]$Key, $Value)
    $rootNames = @($Root.PSObject.Properties | ForEach-Object { $_.Name })
    if ($rootNames -notcontains $Category) { $Root | Add-Member -NotePropertyName $Category -NotePropertyValue (New-Object PSObject) }
    $cat = $Root.$Category
    $catNames = @($cat.PSObject.Properties | ForEach-Object { $_.Name })
    if ($catNames -notcontains $Key) { $cat | Add-Member -NotePropertyName $Key -NotePropertyValue $Value }
    else { $cat.$Key = $Value }
}
$sf = Join-Path $Doc "pdx_settings.json"
$s = Get-Content $sf -Raw | ConvertFrom-Json
Set-JsonSetting $s "Graphics" "display_mode" "windowed"
Set-JsonSetting $s "System"   "language"     "l_english"
Set-JsonSetting $s "game"     "autosave"     $Autosave
[System.IO.File]::WriteAllText($sf, ($s | ConvertTo-Json -Depth 12 -Compress), $Utf8NoBom)
Write-Host "autosave = $Autosave (first one lands 1836.2.1), windowed, english"

Start-Process -FilePath $Exe -WorkingDirectory $Binaries
Write-Host ""
Write-Host "LAUNCHED. Single Player -> 1836 bookmark -> pick a country -> play."
Write-Host "The autosave will be: $SaveDir\autosave.v3"
Write-Host ""
Write-Host "When you are done:  powershell -File tools\testbed\launch_interactive.ps1 -Restore"
