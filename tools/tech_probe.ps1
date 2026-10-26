# TECH PROBE - a local mod for looking at rungs and methods in game: the canon, with technologies granted to the player at the start.
#
#   powershell -ExecutionPolicy Bypass -File tools\tech_probe.ps1                            # every technology (slow start: see make_tech_probe.mjs)
#   powershell -ExecutionPolicy Bypass -File tools\tech_probe.ps1 -Techs electric_railway    # those technologies and their prerequisites
#
# Builds the canon into mod_probe_alltech\ (build.ps1 -SaveTo: gitignored, never deployed by the build), patches it with make_tech_probe.mjs
# (the grant on_action and its own metadata id) and copies it to Documents\Paradox Interactive\Victoria 3\mod\pm_tech_rehaul_probe_alltech.
# In the launcher: the probe ON, the real mod OFF (they share every file), a NEW game. Local only, never shipped, never measured.
param([string]$Techs = '')
$ErrorActionPreference = 'Stop'
if (Get-Process victoria3 -ErrorAction SilentlyContinue) { throw "Victoria 3 is running - close it before deploying a probe" }
$repo = Split-Path $PSScriptRoot -Parent
& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'build.ps1') -SaveTo probe_alltech
if ($LASTEXITCODE -ne 0) { throw "build.ps1 -SaveTo probe_alltech failed (exit $LASTEXITCODE)" }
$built = Join-Path $repo 'mod_probe_alltech'
$nodeArgs = @((Join-Path $PSScriptRoot 'make_tech_probe.mjs'), $built)
if ($Techs) { $nodeArgs += @('--techs', $Techs) }
& node @nodeArgs
if ($LASTEXITCODE -ne 0) { throw "make_tech_probe.mjs failed (exit $LASTEXITCODE)" }
$dest = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Paradox Interactive\Victoria 3\mod\pm_tech_rehaul_probe_alltech'
& robocopy $built $dest /MIR /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy to $dest failed (exit $LASTEXITCODE)" }
Write-Output "Probe deployed -> $dest (turn the real mod off in the playset; start a new game)"
exit 0
