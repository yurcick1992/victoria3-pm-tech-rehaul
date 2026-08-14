# probe_ctd_repro.ps1 - deterministic repro driver for the 1.13.10 sway stack overflow (FINDINGS F56).
#
# Loads an archived poisoned autosave via -continuelastsave and classifies the outcome:
#   CRASH_STACK_OVERFLOW  a new crash dump with C00000FD appeared
#   CRASH_OTHER           a new dump with a different exception code
#   CLEAN_EXIT            the game self-quit (reached -run_until) with no new dump
#   TIMEOUT               still running at the deadline (killed)
#
# Variants: -Variant plain   -> mod under test only (expect CRASH_STACK_OVERFLOW on a poisoned save)
#           -Variant nosway  -> mod + the no-AI-sway defines overlay (mechanism test: expect CLEAN_EXIT)
#
# SAFETY: refuses to run while victoria3.exe is alive, and refuses unless the newest session under
# tools\testbed\sessions is finished (SCHEDULE DONE / stopped) - a quiet process is NOT proof the other
# batch is done (it could be mid-resume or between runs), so -ForceSessionCheck:$false exists but the
# default check must only be overridden deliberately, with eyes on the other session's window.
param(
    [ValidateSet('plain','nosway')] [string]$Variant = 'plain',
    [string]$Save = "C:\claude-code\victoria 3 PM and tech rehaul\tools\testbed\sessions\20260813_083557_vanilla-vs-mod-n4\run008_mod\saves\0009_20260814_004516_autosave.v3",
    [string]$UntilDate = "1846.1.1",   # for the run004 save use 1852.1.1
    [int]$TimeoutMinutes = 12,
    [bool]$ForceSessionCheck = $true
)
$ErrorActionPreference = 'Stop'
$Doc      = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Paradox Interactive\Victoria 3'
$SaveDir  = Join-Path $Doc 'save games'
$CrashDir = Join-Path $Doc 'crashes'
$Exe      = "C:\Program Files (x86)\Steam\steamapps\common\Victoria 3\binaries\victoria3.exe"
$MainMod  = Join-Path $Doc 'mod\pm_tech_rehaul'
$NoswayMod= Join-Path $PSScriptRoot 'nosway_mod'
$Stamp    = Get-Date -Format 'yyyyMMdd_HHmmss'
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Log([string]$m) { Write-Host ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m) }

# ---- safety gates ----
if (Get-Process victoria3 -ErrorAction SilentlyContinue) { throw "victoria3.exe is running - refusing." }
if ($ForceSessionCheck) {
    $newest = Get-ChildItem "C:\claude-code\victoria 3 PM and tech rehaul\tools\testbed\sessions" -Directory |
        Where-Object { $_.Name -match '^\d{8}_' } | Sort-Object Name -Descending | Select-Object -First 1
    $slog = Join-Path $newest.FullName 'session.log'
    $done = $false
    if (Test-Path $slog) {
        $tail = Get-Content $slog -Tail 30
        if ($tail -match 'SCHEDULE DONE|SESSION DONE|stopped by user|fatal') { $done = $true }
    }
    if (-not $done) { throw "newest session $($newest.Name) has no completion marker in session.log - the other batch may still be running (a dead process is not proof). Pass -ForceSessionCheck:`$false only after confirming by eye." }
}
if (-not (Test-Path $Save)) { throw "save not found: $Save" }
if (-not (Test-Path $MainMod)) { throw "deployed mod not found: $MainMod" }
if ($Variant -eq 'nosway' -and -not (Test-Path "$NoswayMod\common\defines\zz_ctd_probe_nosway.txt")) { throw "nosway overlay missing" }

# ---- record pre-state ----
$dumpsBefore = @(Get-ChildItem $CrashDir -Directory -ErrorAction SilentlyContinue | ForEach-Object Name)
$backup = Join-Path $SaveDir ("_probe_backup_$Stamp")
New-Item -ItemType Directory -Force $backup | Out-Null

# back up settings the game rewrites + every existing save, then plant the poisoned one
foreach ($f in @('content_load.json','pdx_settings.json')) {
    $p = Join-Path $Doc $f
    if (Test-Path $p) { Copy-Item $p (Join-Path $backup $f) }
}
Get-ChildItem $SaveDir -Filter '*.v3' -ErrorAction SilentlyContinue | Move-Item -Destination $backup
Copy-Item $Save (Join-Path $SaveDir 'autosave.v3')
(Get-Item (Join-Path $SaveDir 'autosave.v3')).LastWriteTime = Get-Date   # newest-save-wins

# ---- content_load.json ----
$mods = @($MainMod)
if ($Variant -eq 'nosway') { $mods += $NoswayMod }
$entries = ($mods | ForEach-Object { '{"path":"' + ($_ -replace '\\','/') + '"}' }) -join ','
[System.IO.File]::WriteAllText((Join-Path $Doc 'content_load.json'), '{"enabledMods":[' + $entries + '],"disabledDLC":[],"enabledUGC":[]}', $Utf8NoBom)
Log "variant=$Variant mods=[$($mods -join '; ')]"
Log "planted $(Split-Path $Save -Leaf) as autosave.v3; run_until=$UntilDate"

# ---- launch ----
$args = @('-gdpr-compliant','-handsoff','-disable_renderframeifneeded','-continuelastsave',"-run_until=$UntilDate")
$p = Start-Process -FilePath $Exe -ArgumentList $args -PassThru
Log "launched pid $($p.Id); waiting up to $TimeoutMinutes min"
$deadline = (Get-Date).AddMinutes($TimeoutMinutes)
$outcome = 'TIMEOUT'
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 10
    if ($p.HasExited) { break }
}
if (-not $p.HasExited) { Log "deadline hit - killing"; Stop-Process -Id $p.Id -Force; Start-Sleep -Seconds 5 }

# ---- classify ----
Start-Sleep -Seconds 5   # give the crash reporter time to finish writing
$dumpsAfter = @(Get-ChildItem $CrashDir -Directory -ErrorAction SilentlyContinue | ForEach-Object Name)
$newDumps = $dumpsAfter | Where-Object { $dumpsBefore -notcontains $_ }
if ($newDumps) {
    foreach ($d in $newDumps) {
        $exc = Get-Content (Join-Path $CrashDir "$d\exception.txt") -TotalCount 8 -ErrorAction SilentlyContinue | Where-Object { $_ -match 'Unhandled Exception' }
        Log "NEW DUMP $d : $exc"
        if ($exc -match 'C00000FD') { $outcome = 'CRASH_STACK_OVERFLOW' } elseif ($outcome -ne 'CRASH_STACK_OVERFLOW') { $outcome = 'CRASH_OTHER' }
    }
} elseif ($p.HasExited -and $outcome -eq 'TIMEOUT') {
    $outcome = 'CLEAN_EXIT'
}

# ---- restore ----
Get-ChildItem $SaveDir -Filter '*.v3' | Remove-Item -Force
Get-ChildItem $backup -Filter '*.v3' | Move-Item -Destination $SaveDir
foreach ($f in @('content_load.json','pdx_settings.json')) {
    $b = Join-Path $backup $f
    if (Test-Path $b) { Copy-Item $b (Join-Path $Doc $f) -Force }
}
Log "restored saves + settings (backup kept at $backup)"
Log "OUTCOME: $outcome  (variant=$Variant, save=$(Split-Path $Save -Leaf))"
exit 0
