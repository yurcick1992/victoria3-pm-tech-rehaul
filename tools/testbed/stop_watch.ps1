# wrapper so tools/testbed/launch_detached.ps1 can create the run-level stop watcher through WMI (no job object).
param([Parameter(Mandatory=$true)][string]$Session, [double]$Threshold = 1.3, [int]$Poll = 30)
& 'C:\Program Files\nodejs\node.exe' (Join-Path $PSScriptRoot 'stop_watch.mjs') $Session --threshold $Threshold --poll $Poll
