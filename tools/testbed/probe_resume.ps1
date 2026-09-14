<#
.SYNOPSIS
  THE RESUME PROBE (diagnostic, 2026-09-14) - what does the engine do with the continue pointer's target?
.DESCRIPTION
  Launches victoria3.exe -continuelastsave -handsoff with a mod folder, exactly as run_observer.ps1's resume path does, and reports:
    LOAD FAILED   debug.log carries "Could not load save game [<title>]" (then -handsoff begins a fresh 1836 game)
    FRESH 1836    the first fresh tick in dedicated_server.log is in 1836 with no such line (a silent failed load)
    LOADED <date> the first fresh tick is past 1836 - the pointer's target loaded
  -Restore <file> first copies a .v3 into the save folder as -RestoreAs (default autosave.v3, the pointer's usual title) and removes it
  afterwards; content_load.json / pdx_settings.json are backed up and restored like the observer does. Needs the game idle.
  Written for the 20260914_173832 run-2 failure (a CTD during the autosave write; HANDOVER "THE RESUME FIX"): P0 = no -Restore
  (reproduce), P1 = -Restore <the archived last good save> (the pointer theory).
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File tools\testbed\probe_resume.ps1 -ModDir "C:\...\mod_probe"
  powershell -ExecutionPolicy Bypass -File tools\testbed\probe_resume.ps1 -ModDir "C:\...\mod_probe" -Restore "C:\...\0021_..._autosave.v3"
#>
param(
    [Parameter(Mandatory = $true)][string] $ModDir,
    [string] $Restore = "",
    [string] $RestoreAs = "autosave.v3",
    [int]    $TimeoutSeconds = 180,
    [string] $Game = $(if ($env:VIC3_GAME) { $env:VIC3_GAME } else { "C:\Program Files (x86)\Steam\steamapps\common\Victoria 3\game" })
)
$ErrorActionPreference = 'Stop'
$Doc      = Join-Path $env:USERPROFILE "Documents\Paradox Interactive\Victoria 3"
$Binaries = Join-Path (Split-Path -Parent $Game) "binaries"
$Exe      = Join-Path $Binaries "victoria3.exe"
$LogDir   = Join-Path $Doc "logs"
$SaveDir  = Join-Path $Doc "save games"
if (-not (Test-Path $Exe)) { throw "no exe at $Exe" }
if (-not (Test-Path (Join-Path $ModDir ".metadata\metadata.json"))) { throw "not a mod folder: $ModDir" }
if (Get-Process victoria3 -ErrorAction SilentlyContinue) { throw "victoria3.exe is running - the probe needs the game idle" }
function DateNum([string]$d) { $p = $d.Split('.'); if ($p.Count -lt 3) { return 0 }; return [int]$p[0] * 10000 + [int]$p[1] * 100 + [int]$p[2] }
function FreshLines([string]$path, [datetime]$since) {
    # every line stamped [HH:MM:SS] at or after $since, wrap-safe (the ring rotates at launch; a stale line is older than the attempt)
    if (-not (Test-Path $path)) { return @() }
    $s0 = $since.Hour * 3600 + $since.Minute * 60 + $since.Second
    $out = New-Object System.Collections.Generic.List[string]
    foreach ($l in [System.IO.File]::ReadAllLines($path)) {
        if ($l -match '^\[(\d{2}):(\d{2}):(\d{2})\]') {
            $gap = ([int]$Matches[1] * 3600 + [int]$Matches[2] * 60 + [int]$Matches[3]) - $s0
            if ($gap -gt 43200) { $gap -= 86400 } elseif ($gap -le -43200) { $gap += 86400 }
            if ($gap -ge 0) { $out.Add($l) }
        }
    }
    return $out
}
$bk = Join-Path $env:TEMP ("v3_probe_settings_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
New-Item -ItemType Directory -Force -Path $bk | Out-Null
foreach ($f in @("content_load.json", "pdx_settings.json")) { $p = Join-Path $Doc $f; if (Test-Path $p) { Copy-Item -LiteralPath $p -Destination (Join-Path $bk $f) -Force } }
$proc = $null; $restoredPath = ""
try {
    $cg = Join-Path $Doc "continue_game.json"
    if (Test-Path $cg) { $ptr = Get-Content -LiteralPath $cg -Raw | ConvertFrom-Json; Write-Host ("pointer: title=" + $ptr.title + "  date=" + $ptr.date) } else { Write-Host "pointer: none" }
    Get-ChildItem $SaveDir -Filter 'autosave*.v3' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending |
        ForEach-Object { Write-Host ("  slot {0,-20} {1,12:N0} B  {2:yyyy-MM-dd HH:mm:ss}" -f $_.Name, $_.Length, $_.LastWriteTime) }
    if ($Restore) {
        if (-not (Test-Path -LiteralPath $Restore)) { throw "no such file: $Restore" }
        $restoredPath = Join-Path $SaveDir $RestoreAs
        Copy-Item -LiteralPath $Restore -Destination $restoredPath -Force
        Write-Host ("restored {0} ({1:N0} B) -> {2}" -f $Restore, (Get-Item -LiteralPath $Restore).Length, $RestoreAs)
    }
    $json = '{"enabledMods":[{"path":"' + ($ModDir -replace '\', '/') + '"}],"disabledDLC":[],"enabledUGC":[]}'
    [System.IO.File]::WriteAllText((Join-Path $Doc "content_load.json"), $json, (New-Object System.Text.UTF8Encoding $false))
    $t0 = Get-Date
    $args = @("-continuelastsave", "-gdpr-compliant", "-handsoff", "-disable_renderframeifneeded")
    $proc = Start-Process -FilePath $Exe -ArgumentList $args -WorkingDirectory $Binaries -PassThru
    Write-Host ("launched pid {0} at {1:HH:mm:ss}: victoria3.exe {2}" -f $proc.Id, $t0, ($args -join ' '))
    $verdict = ""
    while (-not $verdict -and ((Get-Date) - $t0).TotalSeconds -lt $TimeoutSeconds) {
        Start-Sleep -Seconds 3
        foreach ($l in (FreshLines (Join-Path $LogDir "debug.log") $t0)) {
            if ($l -match 'Could not load save game \[([^\]]*)\]') { $verdict = "LOAD FAILED - the engine could not load save game [$($Matches[1])]  ($l)"; break }
        }
        if ($verdict) { break }
        foreach ($l in (FreshLines (Join-Path $LogDir "dedicated_server.log") $t0)) {
            if ($l -match '(\d{4}\.\d{1,2}\.\d{1,2})') {
                $d = $Matches[1]
                if ((DateNum $d) -ge 18370101) { $verdict = "LOADED - first fresh tick $d  ($l)" } else { $verdict = "FRESH 1836 - first fresh tick $d, no 'could not load' line yet  ($l)" }
                break
            }
        }
        if (-not $verdict -and $proc.HasExited) { $verdict = "GAME EXITED (code $($proc.ExitCode)) before any tick" }
    }
    if (-not $verdict) { $verdict = "TIMEOUT after $TimeoutSeconds s with no verdict" }
    Write-Host ("VERDICT: " + $verdict)
} finally {
    if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force; Start-Sleep -Seconds 4; Write-Host "game killed" }
    foreach ($f in @("content_load.json", "pdx_settings.json")) { $b = Join-Path $bk $f; if (Test-Path $b) { Copy-Item -LiteralPath $b -Destination (Join-Path $Doc $f) -Force } }
    if ($restoredPath -and (Test-Path -LiteralPath $restoredPath)) { Remove-Item -LiteralPath $restoredPath -Force; Write-Host "removed the restored $RestoreAs" }
    Write-Host "settings restored from $bk"
}
