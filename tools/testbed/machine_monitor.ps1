<#
.SYNOPSIS
  THE MACHINE-LOAD MONITOR (2026-10-06): an objective record of what the MACHINE was doing beside a running batch, so a
  wall-clock fluctuation can be attributed instead of guessed at. Written after run 3 of 20261005_154629_jex-n16 slowed
  3-4x from 1890 to 1903 with the same world size, and the only evidence was a hand snapshot taken an hour into it.

.DESCRIPTION
  Every -IntervalSeconds it appends one row to <session>\machine_load.tsv:
    - the GAME process: cores used since the last row, its CUMULATIVE CPU seconds (the discriminator: more game CPU per
      in-game year = the game did more work; more wall per in-game year at flat CPU = the game was starved or waiting),
      working set and private bytes;
    - every other process in two buckets: HARNESS (the batch's own helpers - scheduler, observer, archiver, harvester and its
      rakaly/node melts, watchers, this monitor) and OTHER (everything else, the agent's analysis scripts included), with
      the top three OTHER processes named;
    - machine counters: total busy cores, CPU clock as % of rated (throttling / turbo), available memory, hard page reads,
      disk busy %, GPU 3D utilisation (total and the game's own);
    - the run folder and the in-game date from the newest run's run.log (read with full sharing - landmine L29);
    - every -CanaryMinutes, a CANARY: a fixed single-threaded compute job, timed. Reported as ms per 1e7 iterations, so
      two monitors compare; a slower canary = a slower machine (heat, power plan, contention), whatever the game does.
      canary_cpu_ratio = CPU time / wall time of the canary: under ~0.9 means the canary waited for a core.
  It stops by itself when the session log says SCHEDULE DONE, after -MaxHours, or if the session folder disappears.
  It never touches the harness, the build or the game. run_schedule.ps1 starts it beside every session (since 2026-10-06;
  -NoMachineMonitor opts out), passing the session's full path; by hand, for a batch started without it:
    & 'tools\testbed\launch_detached.ps1' -File 'tools\testbed\machine_monitor.ps1' -ArgumentList '-Session','<stamp>' -Hidden
  -Session takes the session's name (under tools\testbed\sessions) or a full path. Read it with tools\testbed\ledger\machine_load.mjs.
  Cost, measured 2026-10-06: ~0.5 s of one core per sample (the process query) plus a ~1-2 s mostly-idle counter wait;
  the canary is ~0.3 s of one core every five minutes.
#>
param(
    [Parameter(Mandatory = $true)][string] $Session,
    [int]    $IntervalSeconds = 20,
    [int]    $CanaryMinutes = 5,
    [double] $MaxHours = 96,
    [string] $GameProcess = 'victoria3',
    [string] $OutFile = ''
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Session = $Session.TrimEnd('\', '/')
if ([System.IO.Path]::IsPathRooted($Session)) { $sessDir = $Session }   # the scheduler passes the full path (it may use another -OutRoot)
else { $sessDir = Join-Path $repo "tools\testbed\sessions\$(Split-Path -Leaf $Session)" }
$Session = Split-Path -Leaf $sessDir
if (-not (Test-Path -LiteralPath $sessDir)) { Write-Host "machine_monitor: no such session: $sessDir"; exit 2 }
$out = $(if ($OutFile) { $OutFile } else { Join-Path $sessDir 'machine_load.tsv' })
$log = [System.IO.Path]::ChangeExtension($out, '.log')
$nCpu = [Environment]::ProcessorCount

function Log([string]$m) { for ($i = 0; $i -lt 5; $i++) { try { Add-Content -LiteralPath $log -Value ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m); return } catch { Start-Sleep -Milliseconds 200 } } }
function Append([string]$line) { for ($i = 0; $i -lt 10; $i++) { try { Add-Content -LiteralPath $out -Value $line; return } catch { Start-Sleep -Milliseconds 300 } }; Log "WARN could not append a row" }

# Read the end of a file another process holds open, sharing everything (the observer writes run.log every tick).
function Read-Tail([string]$path, [int]$bytes = 4096) {
    try {
        $fs = [System.IO.File]::Open($path, 'Open', 'Read', [System.IO.FileShare]::ReadWrite -bor [System.IO.FileShare]::Delete)
        try {
            if ($fs.Length -gt $bytes) { [void]$fs.Seek(-$bytes, 'End') }
            $sr = New-Object System.IO.StreamReader($fs)
            return $sr.ReadToEnd()
        } finally { $fs.Dispose() }
    } catch { return '' }
}

Add-Type -TypeDefinition @'
public static class V3tbCanary {
    public static double Spin(long n) {
        double x = 1.0;
        for (long i = 0; i < n; i++) { x = x * 1.0000001 + 0.0000001; if (x > 2.0) x -= 1.0; }
        return x;
    }
}
// logical processor index -> EfficiencyClass (higher = a faster core; on a hybrid Intel part the P-cores read 1, the E-cores 0)
public static class V3tbCores {
    [System.Runtime.InteropServices.DllImport("kernel32.dll", SetLastError = true)]
    static extern bool GetLogicalProcessorInformationEx(int rel, System.IntPtr buf, ref int len);
    public static int[] Classes() {
        int len = 0; GetLogicalProcessorInformationEx(0, System.IntPtr.Zero, ref len);
        System.IntPtr buf = System.Runtime.InteropServices.Marshal.AllocHGlobal(len);
        try {
            int[] cls = new int[System.Environment.ProcessorCount]; for (int i = 0; i < cls.Length; i++) cls[i] = -1;
            if (!GetLogicalProcessorInformationEx(0, buf, ref len)) return cls;
            int off = 0;
            while (off < len) {
                System.IntPtr p = System.IntPtr.Add(buf, off);
                int size = System.Runtime.InteropServices.Marshal.ReadInt32(p, 4);
                byte eff = System.Runtime.InteropServices.Marshal.ReadByte(p, 9);
                long mask = System.Runtime.InteropServices.Marshal.ReadInt64(p, 32);   // group 0 only
                for (int b = 0; b < 64 && b < cls.Length; b++) if (((mask >> b) & 1L) != 0) cls[b] = eff;
                off += size;
            }
            return cls;
        } finally { System.Runtime.InteropServices.Marshal.FreeHGlobal(buf); }
    }
}
'@
# Hybrid CPU (this machine: an i5-14600K, P-cores = logical 0-11, E-cores = 12-19): Windows can move a process it judges to be
# in the background onto the E-cores, which slows it while the total clock reading stays healthy - one hypothesis for run 3 of
# 20261005_154629 (the game 3-4x slower 1890-1903 on ~3.9 cores against ~7 normally; the harvester's REAL melts stayed at 6-13 s,
# so the machine as a whole was not slower - the game, or the game alone, was).
# So every row also carries busy cores and mean clock per core class.
$coreCls = [V3tbCores]::Classes()
$topCls = ($coreCls | Measure-Object -Maximum).Maximum
$me = [System.Diagnostics.Process]::GetCurrentProcess()
function Invoke-Canary([long]$n) {
    $me.Refresh(); $c0 = $me.TotalProcessorTime.TotalMilliseconds
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    [void][V3tbCanary]::Spin($n)
    $wall = $sw.Elapsed.TotalMilliseconds
    $me.Refresh(); $cpu = $me.TotalProcessorTime.TotalMilliseconds - $c0
    return @{ wall = $wall; ratio = $(if ($wall -gt 0) { $cpu / $wall } else { 0 }) }
}
# calibrate N to ~300 ms once; rows report ms per 1e7 iterations, so N itself never matters to a reader
[void][V3tbCanary]::Spin(1000000)
$probe = Invoke-Canary 20000000
$canaryN = [long][math]::Max(1000000, 20000000 * 300 / [math]::Max(1.0, $probe.wall))

$harnessRx = 'run_schedule|run_observer|archive_autosaves|harvest_saves|save_state_summary|rakaly|machine_monitor|stop_watch|wait_for_session|no_new_runs_at'
$cols = 'ts', 'run', 'ingame', 'game_pid', 'game_cores', 'game_cpu_s', 'game_ws_mb', 'game_priv_mb', 'harness_cores', 'other_cores',
        'busy_cores', 'cpu_perf_pct', 'avail_mb', 'pages_in_s', 'disk_busy_pct', 'gpu_pct', 'game_gpu_pct', 'canary_ms_1e7', 'canary_cpu_ratio',
        'top_other', 'sample_ms', 'p_busy_cores', 'e_busy_cores', 'p_perf_pct', 'e_perf_pct', 'commit_gb', 'commit_limit_gb', 'trans_faults_s', 'game_faults_s'
# a header is (re)written whenever the file's last header is not this one, so a reader can follow a column change mid-file
$lastHead = $(if (Test-Path -LiteralPath $out) { (Get-Content -LiteralPath $out -ErrorAction SilentlyContinue | Where-Object { $_.StartsWith("ts`t") } | Select-Object -Last 1) } else { $null })
if ($lastHead -ne ($cols -join "`t")) { Append ($cols -join "`t") }
Log "start: session $Session, interval ${IntervalSeconds}s, canary every ${CanaryMinutes} min (N=$canaryN, probe $([math]::Round($probe.wall)) ms per 2e7), $nCpu logical CPUs, core classes $($coreCls -join ''), pid $PID -> $out"

$prev = @{}; $prevT = $null
$t0 = Get-Date; $nextCanary = $t0; $k = 0
$f1 = { param($x) if ($null -eq $x) { '' } else { [math]::Round([double]$x, 2).ToString([Globalization.CultureInfo]::InvariantCulture) } }
while ($true) {
    $k++
    $tick = $t0.AddSeconds($k * $IntervalSeconds)
    $wait = ($tick - (Get-Date)).TotalMilliseconds
    if ($wait -gt 0) { Start-Sleep -Milliseconds ([int]$wait) }
    if (-not (Test-Path -LiteralPath $sessDir)) { Log 'session folder gone - exit'; break }
    if ((Read-Tail (Join-Path $sessDir 'session.log') 2048) -match 'SCHEDULE DONE') { Log 'SCHEDULE DONE - exit'; break }
    if (((Get-Date) - $t0).TotalHours -gt $MaxHours) { Log "MaxHours $MaxHours reached - exit"; break }
    try {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $now = Get-Date
        $procs = Get-CimInstance Win32_Process -Property ProcessId, Name, CommandLine, KernelModeTime, UserModeTime, WorkingSetSize, PrivatePageCount
        $dt = $(if ($prevT) { ($now - $prevT).TotalSeconds } else { 0 })
        $cur = @{}; $game = $null; $gCores = $null; $hCores = 0.0; $oCores = 0.0; $others = @{}
        foreach ($p in $procs) {
            if ($p.ProcessId -eq 0) { continue }   # the idle process: its "CPU" is idle time
            $key = "$($p.ProcessId)|$($p.Name)"
            $ticks = [double]$p.KernelModeTime + [double]$p.UserModeTime
            $cur[$key] = $ticks
            $cores = $(if ($dt -gt 0 -and $prev.ContainsKey($key)) { [math]::Max(0.0, ($ticks - $prev[$key]) / ($dt * 1e7)) } else { $null })
            if ($p.Name -like "$GameProcess*") {
                if (-not $game -or $ticks -gt $game.ticks) { $game = @{ pid = $p.ProcessId; ticks = $ticks; ws = $p.WorkingSetSize; priv = $p.PrivatePageCount }; $gCores = $cores }
            } elseif ($p.ProcessId -eq $PID -or ($p.CommandLine -and $p.CommandLine -match $harnessRx)) {
                if ($cores) { $hCores += $cores }
            } elseif ($cores) {
                $oCores += $cores; $others[$p.Name] = [double]$others[$p.Name] + $cores
            }
        }
        $prev = $cur; $prevT = $now
        # !! the WMI performance CLASSES, never Get-Counter: counter PATHS are localised, and a process created through
        # launch_detached gets the system's UI language (ru-RU here) where the agent's shell has en-US, so English paths
        # returned nothing at all in the detached monitor (2026-10-06) while working in every interactive test.
        $perf = $null; $busy = $null; $avail = $null; $pin = $null; $disk = $null; $gpu = 0.0; $ggpu = 0.0
        $q = { param($cls, $flt) try { if ($flt) { Get-CimInstance $cls -Filter $flt -ErrorAction Stop } else { Get-CimInstance $cls -ErrorAction Stop } } catch { $null } }
        $x = & $q 'Win32_PerfFormattedData_PerfOS_Processor' "Name='_Total'"; if ($x) { $busy = [double]$x.PercentProcessorTime * $nCpu / 100 }
        $pB = 0.0; $eB = 0.0; $pP = @(); $eP = @()
        foreach ($x in @(& $q 'Win32_PerfFormattedData_Counters_ProcessorInformation' $null)) {
            if (-not $x) { continue }
            if ($x.Name -eq '_Total') { $perf = [double]$x.PercentProcessorPerformance; continue }
            if ($x.Name -notmatch '^0,(\d+)$') { continue }
            $i = [int]$Matches[1]; if ($i -ge $coreCls.Count) { continue }
            if ($coreCls[$i] -eq $topCls) { $pB += [double]$x.PercentProcessorTime / 100; $pP += [double]$x.PercentProcessorPerformance }
            else { $eB += [double]$x.PercentProcessorTime / 100; $eP += [double]$x.PercentProcessorPerformance }
        }
        $cm = $null; $cl = $null; $tf = $null; $gf = $null
        $x = & $q 'Win32_PerfFormattedData_PerfOS_Memory' $null; if ($x) { $avail = [double]$x.AvailableMBytes; $pin = [double]$x.PagesInputPersec; $cm = [double]$x.CommittedBytes / 1GB; $cl = [double]$x.CommitLimit / 1GB; $tf = [double]$x.TransitionFaultsPersec }
        if ($game) { $x = & $q 'Win32_PerfFormattedData_PerfProc_Process' "IDProcess=$($game.pid)"; if ($x) { $gf = [double]@($x)[0].PageFaultsPersec } }
        $x = & $q 'Win32_PerfFormattedData_PerfDisk_PhysicalDisk' "Name='_Total'"; if ($x) { $disk = 100 - [double]$x.PercentIdleTime }
        foreach ($e in @(& $q 'Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine' "Name LIKE '%engtype_3D'")) {
            if (-not $e) { continue }
            $v = [double]$e.UtilizationPercentage; $gpu += $v
            if ($game -and $e.Name.Contains("pid_$($game.pid)_")) { $ggpu += $v }
        }
        $canMs = $null; $canR = $null
        if ($now -ge $nextCanary) { $cr = Invoke-Canary $canaryN; $canMs = $cr.wall * 1e7 / $canaryN; $canR = $cr.ratio; $nextCanary = $now.AddMinutes($CanaryMinutes) }
        $runDir = Get-ChildItem -LiteralPath $sessDir -Directory -Filter 'run*' -ErrorAction SilentlyContinue | Sort-Object Name | Select-Object -Last 1
        $ingame = ''
        if ($runDir) {
            $ms = [regex]::Matches((Read-Tail (Join-Path $runDir.FullName 'run.log') 6144), 'in-game (\d{4}\.\d{1,2}\.\d{1,2})')
            if ($ms.Count) { $ingame = $ms[$ms.Count - 1].Groups[1].Value }
        }
        $top = ($others.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 3 | ForEach-Object { '{0}:{1}' -f $_.Key, (& $f1 $_.Value) }) -join ';'
        $row = @(
            $now.ToString('yyyy-MM-dd HH:mm:ss'), $(if ($runDir) { $runDir.Name } else { '' }), $ingame,
            $(if ($game) { $game.pid } else { '' }), (& $f1 $gCores), $(if ($game) { & $f1 ($game.ticks / 1e7) } else { '' }),
            $(if ($game) { & $f1 ($game.ws / 1MB) } else { '' }), $(if ($game) { & $f1 ([double]$game.priv / 1MB) } else { '' }),
            (& $f1 $hCores), (& $f1 $oCores), (& $f1 $busy), (& $f1 $perf), (& $f1 $avail), (& $f1 $pin), (& $f1 $disk),
            (& $f1 $gpu), (& $f1 $ggpu), (& $f1 $canMs), (& $f1 $canR), $top, [math]::Round($sw.Elapsed.TotalMilliseconds),
            (& $f1 $pB), $(if ($eP.Count) { & $f1 $eB } else { '' }),
            $(if ($pP.Count) { & $f1 (($pP | Measure-Object -Average).Average) } else { '' }), $(if ($eP.Count) { & $f1 (($eP | Measure-Object -Average).Average) } else { '' }),
            (& $f1 $cm), (& $f1 $cl), (& $f1 $tf), (& $f1 $gf)
        )
        Append ($row -join "`t")
    } catch { Log "WARN sample failed: $($_.Exception.Message)" }
}
