<#
.SYNOPSIS
  Start a harness script OUTSIDE every job object of the caller, so it survives the caller's death.

.DESCRIPTION
  THE PROBLEM (landmine L30, found 2026-09-13). The agent's tool shells run inside the desktop app's job
  objects: measured, the shell's own job carries KILL_ON_JOB_CLOSE | BREAKAWAY_OK | SILENT_BREAKAWAY_OK |
  DIE_ON_UNHANDLED_EXCEPTION, and a child started with Start-Process (the way every batch had been launched)
  silently breaks away from that job only to land in a SECOND job of the app's (BREAKAWAY_OK alone). When the
  app restarted for a re-auth at 18:45:29 on 2026-09-10 it tore its jobs down and the whole tree it owned -
  scheduler, observer, game, autosave archiver, save harvester - died in the same second, ten months short of
  run 1's end (session 20260910_151220_canon-flat-in12-n30). The OS stayed up for eight more hours: nothing
  else was wrong. A batch that is meant to outlive the agent must not be a descendant of the agent's process
  tree in any job it owns.

  THE FIX. Win32_Process.Create makes the WMI provider host (WmiPrvSE, in no job of ours) the creating process,
  so the child belongs to NO job object at all - measured 2026-09-13: IsProcessInJob = false, a real console
  (KeyAvailable readable, 120x30), session 1, the working directory honoured. The two obvious alternatives were
  measured too and rejected: a Task Scheduler task and CreateProcess(CREATE_BREAKAWAY_FROM_JOB) both ran the
  child inside a job (limit flags 0, owner unknown), which is exactly the trust this script exists to remove.

  THE PROOF is built in: after the launch it opens the child and asks the kernel whether it is in a job; if it
  is, the child is killed and the script exits non-zero. A launch that cannot be verified is not a launch.

.PARAMETER File
  The .ps1 to run, relative to the repo root or absolute.
.PARAMETER ArgumentList
  Its arguments, one element each (elements with spaces are quoted for you).
.PARAMETER WorkingDirectory
  Defaults to the repo root (every harness script resolves paths from there).
.PARAMETER Hidden
  No console window - for the archiver / harvester. Default: a normal, visible console window, which is
  what the scheduler's p/r/s/x keys need and where a human reads the end of a batch.
.PARAMETER NoExit
  Keep the window open after the script ends (the scheduler / observer are launched this way).

.EXAMPLE
  # a batch (the ONLY sanctioned way to launch one from the agent since 2026-09-13) - CALL THIS SCRIPT DIRECTLY from a
  # PowerShell prompt or the agent's PowerShell tool, so -ArgumentList arrives as a real array:
  & 'tools\testbed\launch_detached.ps1' -File 'tools\testbed\run_schedule.ps1' -ArgumentList '-Schedule','tools\testbed\schedules\x.json' -NoExit
  # NOT  powershell -ExecutionPolicy Bypass -File tools\testbed\launch_detached.ps1 -File ... -ArgumentList '-Schedule','x.json' -NoExit
  # (2026-09-13 14:33): through that wrapper -File mode flattens the array into ONE token, "-Schedule,x.json"; the scheduler
  # never binds its parameter, the -NoExit window sits idle on the error, and this script still reports success - its
  # proof is only that the child is alive and job-free, not that the child parsed its arguments. Proven with a scratch echo
  # script: the wrapper delivers "Schedule=[<unbound>]", the direct call "Schedule=[x.json]". After any launch, a session
  # folder must appear under tools\testbed\sessions within a minute.
#>
param(
    [Parameter(Mandatory = $true)][string] $File,
    [string[]] $ArgumentList = @(),
    [string]   $WorkingDirectory = "",
    [switch]   $Hidden,
    [switch]   $NoExit,
    [int]      $VerifySeconds = 4
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not $WorkingDirectory) { $WorkingDirectory = $repo }
$script = $(if ([System.IO.Path]::IsPathRooted($File)) { $File } else { Join-Path $repo $File })
if (-not (Test-Path -LiteralPath $script)) { throw "launch_detached: script not found: $script" }
$ps = Join-Path $PSHOME 'powershell.exe'

function Quote-Arg([string]$s) { if ($s -match '[\s"]') { '"' + ($s -replace '"', '\"') + '"' } else { $s } }
$parts = @((Quote-Arg $ps), '-ExecutionPolicy', 'Bypass')
if ($NoExit) { $parts += '-NoExit' }
$parts += @('-File', (Quote-Arg $script))
foreach ($a in $ArgumentList) { $parts += (Quote-Arg $a) }
$cmd = $parts -join ' '

$startup = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]$(if ($Hidden) { 0 } else { 1 }) }
$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd; CurrentDirectory = $WorkingDirectory; ProcessStartupInformation = $startup }
if ($r.ReturnValue -ne 0) { throw "launch_detached: Win32_Process.Create returned $($r.ReturnValue) for: $cmd" }
$childPid = [int]$r.ProcessId
Start-Sleep -Seconds $VerifySeconds

# ---- verify: alive, and in NO job object (the whole point) ----
Add-Type -Name JobProbe -Namespace V3TB -ErrorAction SilentlyContinue -MemberDefinition @'
[DllImport("kernel32.dll", SetLastError=true)] public static extern bool IsProcessInJob(IntPtr hProcess, IntPtr hJob, out bool result);
[DllImport("kernel32.dll", SetLastError=true)] public static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
[DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
'@
$alive = Get-Process -Id $childPid -ErrorAction SilentlyContinue
if (-not $alive) { throw "launch_detached: pid $childPid exited within $VerifySeconds s - a bad argument? command was: $cmd" }
$h = [V3TB.JobProbe]::OpenProcess(0x1000, $false, $childPid)    # PROCESS_QUERY_LIMITED_INFORMATION
if ($h -eq [IntPtr]::Zero) { throw "launch_detached: cannot open pid $childPid to verify its job membership (err $([Runtime.InteropServices.Marshal]::GetLastWin32Error()))" }
$inJob = $false
[void][V3TB.JobProbe]::IsProcessInJob($h, [IntPtr]::Zero, [ref]$inJob)
[void][V3TB.JobProbe]::CloseHandle($h)
if ($inJob) {
    Stop-Process -Id $childPid -Force -ErrorAction SilentlyContinue
    throw "launch_detached: pid $childPid landed INSIDE a job object - it would die with that job's owner, so it was killed. Launch from a plain user console instead, and report this: the WMI route was measured job-free on 2026-09-13."
}
$parentPid = (Get-CimInstance Win32_Process -Filter "ProcessId=$childPid").ParentProcessId
$parentName = try { (Get-Process -Id $parentPid -ErrorAction Stop).ProcessName } catch { '?' }
Write-Output ("launch_detached: pid {0} running outside any job object (parent {1} {2}, cwd {3})" -f $childPid, $parentName, $parentPid, $WorkingDirectory)
Write-Output ("  {0}" -f $cmd)
