<#
  run_observer.ps1 - automated Victoria 3 observer runs for balance telemetry (MVP).

  Launches Victoria 3 WITHOUT the Paradox launcher, straight into a hands-off observer
  game, runs it to a date, harvests one metric (per-market buy/sell orders), quits, and
  repeats N times. Fully deterministic - no agent in the loop.

  COST / PERMISSION: a run costs ~40 s of load plus ~1 min per in-game year and takes over the
  machine. Claude must NOT start a session without the user's explicit go-ahead, must state the
  batch as "<count> x <span>" when proposing one, and must ask for every foreseeable run - both
  sides of a fork included - in a SINGLE request, because batches are typically left running
  overnight. See CLAUDE.md -> Working conventions.

  How it works (all of this is verified against V3 1.13.9, see MODDING_NOTES -> Automated runs):
    * binaries\victoria3.exe -handsoff              auto-starts an observer game at the 1836
                                                    bookmark, no launcher, no lobby, no input
    * -run_until=<date>                             the game plays to that date and EXITS by itself
    * -disable_renderframeifneeded                  "sacrifice sub-tick rendering for tick speed"
    * mods are enabled by writing content_load.json (NOT dlc_load.json - that file is gone in 1.13)
    * the metric is collected by a throwaway instrumentation mod this script generates, which
      uses the `debug_log` effect - works WITHOUT debug mode - and lands in logs\debug.log

  Output (one folder per session, one subfolder per run):
    tools\testbed\runs\<stamp>\session.log / session.json / markets_all.tsv
    tools\testbed\runs\<stamp>\run01\meta.json / markets.tsv / harness.log
    tools\testbed\runs\<stamp>\run01\logs_live\*   <- AUTHORITATIVE: written continuously as the
                                                     run happens, one complete file per log, per run
    tools\testbed\runs\<stamp>\run01\logs\*        <- snapshot of the game's log folder at exit

  Why logs_live exists: the game's own logs are a rotating ring (5 x 512 KB) and it rotates them
  again at every launch, so (a) a long run throws its own early game away before it ends -
  dedicated_server.log alone fills a slot per ~5 in-game years - and (b) the end-of-run snapshot
  mixes runs, because a previous run's log is still sitting in the ring. Mirroring as we go fixes
  both. Only the growing logs are mirrored; the rest are static and the snapshot is enough.

  Usage:
    powershell -ExecutionPolicy Bypass -File tools\testbed\run_observer.ps1
    powershell -ExecutionPolicy Bypass -File tools\testbed\run_observer.ps1 -Runs 3 -DumpDate 1840.1.1 -UntilDate 1841.1.1
#>
[CmdletBinding()]
param(
    # how many observer runs to do
    [int]      $Runs = 3,
    # in-game date the metric is dumped on (must be the 1st of a month - on_monthly_pulse)
    [string]   $DumpDate = "1840.1.1",
    # in-game date the game quits itself on
    [string]   $UntilDate = "1841.1.1",
    # country tags whose markets we dump
    [string[]] $Tags = @("GBR", "FRA"),
    [string]   $Game = $(if ($env:VIC3_GAME) { $env:VIC3_GAME } else { "C:\Program Files (x86)\Steam\steamapps\common\Victoria 3\game" }),
    # the deployed mod under test; default = what build.ps1 deploys
    [string]   $ModPath = "",
    [string]   $OutRoot = "",
    # hard watchdog: kill the process if a single run exceeds this
    [int]      $TimeoutMinutes = 45,
    # leave content_load.json / pdx_settings.json as the harness set them
    [switch]   $NoRestore,
    # keep the generated instrumentation mod on disk after the session
    [switch]   $KeepInstrument
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

# ---------------------------------------------------------------- paths ----

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Doc      = Join-Path $env:USERPROFILE "Documents\Paradox Interactive\Victoria 3"
$Binaries = Join-Path (Split-Path -Parent $Game) "binaries"
$Exe      = Join-Path $Binaries "victoria3.exe"
$LogDir   = Join-Path $Doc "logs"
$SaveDir  = Join-Path $Doc "save games"
$InstrDir = Join-Path $Doc "mod\v3_testbed_instr"

if (-not $ModPath) { $ModPath = Join-Path $Doc "mod\pm_tech_rehaul" }
if (-not $OutRoot) { $OutRoot = Join-Path $PSScriptRoot "runs" }

foreach ($p in @($Exe, $ModPath)) {
    if (-not (Test-Path $p)) { throw "not found: $p" }
}

$Stamp      = Get-Date -Format "yyyyMMdd_HHmmss"
$SessionDir = Join-Path $OutRoot $Stamp
$null = New-Item -ItemType Directory -Force -Path $SessionDir
$SessionLog = Join-Path $SessionDir "session.log"

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$Utf8Bom   = New-Object System.Text.UTF8Encoding($true)

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $line = "[{0}] [{1}] {2}" -f (Get-Date -Format "HH:mm:ss"), $Level, $Message
    Write-Host $line
    Add-Content -Path $SessionLog -Value $line -Encoding utf8
}

# ------------------------------------------------- instrumentation mod ----
# A separate, throwaway mod - deliberately NOT part of mod/, so build.ps1 never has to
# know about it and there is nothing to strip out of the shipped mod later.

function Write-InstrumentMod {
    # $Token stamps every emitted line. It is regenerated per run, which is what makes the
    # harvest safe: consecutive runs share one logs\ folder and the game rotates debug.log at
    # startup, so the previous run's lines are physically reachable from this run's files.
    # Filtering on the token (not on file mtimes, which are seconds apart) is what keeps them out.
    param([string]$Dir, [string]$Date, [string[]]$Tags, [string]$Token)

    # 1840.1.1 -> the following month, so the trigger window is exactly one monthly pulse
    $parts = $Date.Split('.')
    $y = [int]$parts[0]; $m = [int]$parts[1]
    $nm = $m + 1; $ny = $y
    if ($nm -gt 12) { $nm = 1; $ny = $y + 1 }
    $nextDate = "{0}.{1}.1" -f $ny, $nm

    $null = New-Item -ItemType Directory -Force -Path (Join-Path $Dir ".metadata")
    $null = New-Item -ItemType Directory -Force -Path (Join-Path $Dir "common\on_actions")

    $meta = @"
{
	"name" : "V3 Testbed Instrumentation",
	"id" : "com.yurcick.v3_testbed_instr",
	"version" : "0.1.0",
	"game_id" : "victoria3",
	"supported_game_version" : "1.13.9",
	"short_description" : "Generated by tools/testbed/run_observer.ps1 - telemetry only, never shipped.",
	"tags" : ["Gameplay"],
	"relationships" : [],
	"game_custom_data" : {
		"multiplayer_synchronized" : true
	}
}
"@
    [System.IO.File]::WriteAllText((Join-Path $Dir ".metadata\metadata.json"), $meta, $Utf8NoBom)

    # One block per tag. Every value below uses a datafunction verified to resolve in 1.13.9 -
    # ONE bad function makes the whole debug_log line vanish, so do not add unverified ones.
    $blocks = ""
    foreach ($tag in $Tags) {
        $blocks += @"

		# ---- $tag ----
		if = {
			limit = { exists = c:$tag }
			c:$tag = {
				if = {
					limit = { exists = market_capital.market }
					market_capital.market = {
						debug_log = "V3TB|$Token|MARKET|$tag|[THIS.GetMarket.GetNameNoFormatting]"
						every_market_goods = {
							debug_log = "V3TB|$Token|G|$tag|[THIS.GetMarketGoods.GetGoods.GetKey]|[THIS.GetMarketGoods.GetGoods.GetMarketBuyOrders|2]|[THIS.GetMarketGoods.GetGoods.GetMarketSellOrders|2]|[THIS.GetMarketGoods.GetGoods.GetMarketPrice|2]"
						}
					}
				}
				else = { debug_log = "V3TB|$Token|MARKET_NOT_FOUND|$tag|country exists but has no market" }
			}
		}
		else = { debug_log = "V3TB|$Token|MARKET_NOT_FOUND|$tag|no such country" }
"@
    }

    $onaction = @"
# AUTO-GENERATED by tools/testbed/run_observer.ps1 - throwaway telemetry mod, do not edit.
# Dump date: $Date   tags: $($Tags -join ', ')   run token: $Token

on_game_started_after_lobby = {
	on_actions = { v3tb_boot }
}

on_monthly_pulse = {
	on_actions = { v3tb_dump }
}

v3tb_boot = {
	effect = {
		debug_log = "V3TB|$Token|BOOT|[TimeKeeper.GetCurrentDate.GetString]"
	}
}

v3tb_dump = {
	# on_monthly_pulse fires on the 1st of every month, so this window is hit exactly once
	trigger = {
		game_date >= "$Date"
		NOT = { game_date >= "$nextDate" }
	}
	effect = {
		debug_log = "V3TB|$Token|BEGIN|[TimeKeeper.GetCurrentDate.GetString]"
$blocks
		debug_log = "V3TB|$Token|END|[TimeKeeper.GetCurrentDate.GetString]"
	}
}
"@
    # the game warns unless script files are utf8-BOM
    [System.IO.File]::WriteAllText((Join-Path $Dir "common\on_actions\zzz_v3tb_dump.txt"), $onaction, $Utf8Bom)
}

# ------------------------------------------------------------ log tail ----
# Reads a growing log while the game holds it open, and survives the game's own
# rotation (debug.log -> debug.1.log) by restarting when the file shrinks.

function New-Tail {
    # Start at the CURRENT end of file: at this point the log still holds the previous
    # run's content, which the game rotates away a second later (we detect the shrink
    # and restart at 0, so nothing from this run is missed).
    #
    # $Mirror opens a continuous copy. This is what makes long runs viable: the game's own
    # logs are a 5 x 512 KB rotating ring, and dedicated_server.log alone fills one slot per
    # 5 in-game years - a full-length campaign would have thrown its early game away long
    # before the run ends. The mirror is written as the run happens, so it never rotates,
    # and it holds exactly one run (unlike the copied ring, which mixes runs).
    param([string]$Path, [string]$Mirror = "")
    $len = 0L
    if (Test-Path $Path) { $len = (Get-Item $Path).Length }
    $writer = $null
    if ($Mirror) {
        $writer = New-Object System.IO.StreamWriter($Mirror, $false, (New-Object System.Text.UTF8Encoding($false)))
        $writer.AutoFlush = $true   # survive a harness crash mid-run
    }
    return @{ Path = $Path; Pos = $len; Buf = ""; Writer = $writer; Lines = 0L }
}

function Close-Tail {
    param($State)
    if ($State.Writer) { $State.Writer.Flush(); $State.Writer.Dispose(); $State.Writer = $null }
}

function Read-Chunk {
    # Read $Path from $From to EOF. Returns "" on any failure (log momentarily locked).
    param([string]$Path, [long]$From)
    if (-not (Test-Path $Path)) { return "" }
    $share = [System.IO.FileShare]::ReadWrite -bor [System.IO.FileShare]::Delete
    $fs = $null
    try {
        $fs = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, $share)
        if ($fs.Length -le $From) { return "" }
        $null  = $fs.Seek($From, [System.IO.SeekOrigin]::Begin)
        $count = [int]($fs.Length - $From)
        $bytes = New-Object byte[] $count
        $read  = $fs.Read($bytes, 0, $count)
        return [System.Text.Encoding]::UTF8.GetString($bytes, 0, $read)
    } catch {
        return ""
    } finally {
        if ($fs) { $fs.Dispose() }
    }
}

function Add-TailChunk {
    # Split a chunk into complete lines, emit + mirror them, keep any trailing partial.
    param($State, [string]$Text, $Lines)
    if (-not $Text) { return }
    $parts = ($State.Buf + $Text) -split "`r?`n"
    for ($i = 0; $i -lt $parts.Count - 1; $i++) {
        $null = $Lines.Add($parts[$i])
        if ($State.Writer) { $State.Writer.WriteLine($parts[$i]); $State.Lines++ }
    }
    $State.Buf = $parts[$parts.Count - 1]
}

function Read-Tail {
    param($State)
    $lines = New-Object System.Collections.Generic.List[string]
    if (-not (Test-Path $State.Path)) { return $lines }
    $len = -1L
    try { $len = (Get-Item $State.Path -ErrorAction Stop).Length } catch { return $lines }

    if ($len -lt $State.Pos) {
        # The game rotated this log out from under us. Everything we had not read yet is now
        # in <name>.1.<ext> - so read the remainder of THAT before moving on. Without this the
        # bytes written since the last poll are simply gone, and a burst of debug_log output can
        # itself be what triggers the rotation (measured: 68 of an 89-line dump lost this way).
        $rot = Join-Path (Split-Path -Parent $State.Path) `
                         ("{0}.1{1}" -f [IO.Path]::GetFileNameWithoutExtension($State.Path), [IO.Path]::GetExtension($State.Path))
        $recovered = Read-Chunk $rot $State.Pos
        Add-TailChunk $State $recovered $lines
        if ($State.Buf) {   # rotated file is finished: no partial line can still be growing
            $null = $lines.Add($State.Buf)
            if ($State.Writer) { $State.Writer.WriteLine($State.Buf); $State.Lines++ }
        }
        $State.Pos = 0L; $State.Buf = ""
        if ($State.Writer) {
            # NOTE: build the string first - inside a method call's parens a comma is an
            # ARGUMENT separator, so an inline `-f a, b, c` would hand -f only its first value
            $seam = "--- harness: source log rotated at {0}, recovered {1} chars from {2} ---" -f `
                    (Get-Date -Format "HH:mm:ss"), $recovered.Length, (Split-Path -Leaf $rot)
            $State.Writer.WriteLine($seam)
        }
    }

    if ($len -gt $State.Pos) {
        $text = Read-Chunk $State.Path $State.Pos
        if ($text) {
            $State.Pos = $State.Pos + [System.Text.Encoding]::UTF8.GetByteCount($text)
            Add-TailChunk $State $text $lines
        }
    }
    return $lines
}

# ------------------------------------------------------------- helpers ----

function Get-V3tbPayload {
    param([string]$Line)
    $i = $Line.IndexOf("V3TB|")
    if ($i -lt 0) { return $null }
    return $Line.Substring($i)
}

function Set-ContentLoad {
    param([string[]]$ModDirs)
    $entries = @()
    foreach ($d in $ModDirs) { $entries += ('{"path":"' + ($d -replace '\\', '/') + '"}') }
    $json = '{"enabledMods":[' + ($entries -join ',') + '],"disabledDLC":[],"enabledUGC":[]}'
    [System.IO.File]::WriteAllText((Join-Path $Doc "content_load.json"), $json, $Utf8NoBom)
    return $json
}

function Set-JsonSetting {
    # The game REWRITES pdx_settings.json on exit and drops keys it considers default,
    # so never assume a category or key is still there.
    param($Root, [string]$Category, [string]$Key, $Value)
    # (an empty category is an empty PSObject, so .Properties.Name would trip StrictMode)
    $rootNames = @($Root.PSObject.Properties | ForEach-Object { $_.Name })
    if ($rootNames -notcontains $Category) {
        $Root | Add-Member -NotePropertyName $Category -NotePropertyValue (New-Object PSObject)
    }
    $cat = $Root.$Category
    $catNames = @($cat.PSObject.Properties | ForEach-Object { $_.Name })
    if ($catNames -notcontains $Key) {
        $cat | Add-Member -NotePropertyName $Key -NotePropertyValue $Value
    } else {
        $cat.$Key = $Value
    }
}

function Set-RunSettings {
    # windowed so a run cannot hijack the desktop; english so logged strings stay stable
    $f = Join-Path $Doc "pdx_settings.json"
    $s = Get-Content $f -Raw | ConvertFrom-Json
    Set-JsonSetting $s "Graphics" "display_mode" "windowed"
    Set-JsonSetting $s "System"   "language"     "l_english"
    Set-JsonSetting $s "game"     "save_on_exit" $false
    # autosaves are pure cost here (~14 MB and a stall every other in-game month) and they
    # clobber the player's own autosave slots
    Set-JsonSetting $s "game"     "autosave"     "never"
    [System.IO.File]::WriteAllText($f, ($s | ConvertTo-Json -Depth 12 -Compress), $Utf8NoBom)
}

# ============================================================== session ====

$backupDir = Join-Path $SessionDir "_settings_backup"
$null = New-Item -ItemType Directory -Force -Path $backupDir
foreach ($f in @("content_load.json", "pdx_settings.json")) {
    $src = Join-Path $Doc $f
    if (Test-Path $src) { Copy-Item $src (Join-Path $backupDir $f) -Force }
}

$session = [ordered]@{
    stamp = $Stamp; runs_requested = $Runs; dump_date = $DumpDate; until_date = $UntilDate
    tags = $Tags; mod_path = $ModPath; exe = $Exe; runs = @()
}
$allRows = New-Object System.Collections.Generic.List[string]

try {
    # An already-running game would fight this session for the same log files (and CPU). That
    # happens when a previous harness run died and orphaned its game. Refuse rather than kill:
    # the process might be a game the user is actually playing.
    $running = @(Get-Process victoria3 -ErrorAction SilentlyContinue)
    if ($running.Count -gt 0) {
        throw "Victoria 3 is already running (PID $($running[0].Id)). Close it first - a second instance would write to the same logs\ folder and corrupt this session's harvest."
    }

    Write-Log "session $Stamp -> $SessionDir"
    Write-Log "mod under test: $ModPath"
    Write-Log "plan: $Runs run(s), dump $($Tags -join '+') markets on $DumpDate, quit at $UntilDate"

    $cl = Set-ContentLoad -ModDirs @($ModPath, $InstrDir)
    Write-Log "content_load.json = $cl"
    Set-RunSettings
    Write-Log "pdx_settings.json: display_mode=windowed, language=l_english"

    $gameArgs = @("-gdpr-compliant", "-handsoff", "-disable_renderframeifneeded", "-run_until=$UntilDate")
    Write-Log "args: $($gameArgs -join ' ')"

    for ($run = 1; $run -le $Runs; $run++) {
        $runDir = Join-Path $SessionDir ("run{0:d2}" -f $run)
        $null = New-Item -ItemType Directory -Force -Path (Join-Path $runDir "logs")
        $harnessLog = Join-Path $runDir "harness.log"

        $runStart = Get-Date
        $savesBefore = @(Get-ChildItem $SaveDir -Filter "autosave*.v3" -ErrorAction SilentlyContinue |
                         Where-Object { $_.LastWriteTime -ge $runStart }).Count

        $token = "{0}r{1:d2}" -f $Stamp, $run
        Write-InstrumentMod -Dir $InstrDir -Date $DumpDate -Tags $Tags -Token $token
        Write-Log "run $run/$Runs starting (token $token)"
        $proc = Start-Process -FilePath $Exe -ArgumentList $gameArgs -WorkingDirectory $Binaries -PassThru

        # continuous mirrors: the only complete, single-run copy of the logs that grow
        $liveDir = Join-Path $runDir "logs_live"
        $null = New-Item -ItemType Directory -Force -Path $liveDir
        $tailDebug = New-Tail (Join-Path $LogDir "debug.log")             (Join-Path $liveDir "debug.log")
        $tailTick  = New-Tail (Join-Path $LogDir "dedicated_server.log")  (Join-Path $liveDir "dedicated_server.log")
        $tailError = New-Tail (Join-Path $LogDir "error.log")             (Join-Path $liveDir "error.log")
        $streamed  = New-Object System.Collections.Generic.List[string]
        $lastTick = ""; $lastReport = Get-Date; $timedOut = $false
        $modLoaded = $false; $modInit = $false

        while ($true) {
            $alive = $null -ne (Get-Process -Id $proc.Id -ErrorAction SilentlyContinue)

            foreach ($line in (Read-Tail $tailDebug)) {
                $payload = Get-V3tbPayload $line
                if ($payload -and $payload.StartsWith("V3TB|$token|")) {
                    $null = $streamed.Add($payload)
                    if ($payload -match "\|(BEGIN|MARKET|MARKET_NOT_FOUND)\|") { Write-Log "  $payload" }
                }
                if ($line -match "successfully matched game version") { $modLoaded = $true }
                if ($line -match "PM_TECH_REHAUL: init OK")           { $modInit = $true }
            }
            foreach ($line in (Read-Tail $tailTick)) {
                if ($line -match "Processing Tick: ([0-9]+\.[0-9]+\.[0-9]+)") { $lastTick = $Matches[1] }
            }
            $null = Read-Tail $tailError   # mirrored only; nothing to react to live

            $elapsed = ((Get-Date) - $runStart).TotalSeconds
            if (((Get-Date) - $lastReport).TotalSeconds -ge 20) {
                Write-Log ("  ...{0,4:N0}s  in-game {1}" -f $elapsed, $(if ($lastTick) { $lastTick } else { "loading" }))
                $lastReport = Get-Date
            }
            if (-not $alive) { break }
            if ($elapsed -gt ($TimeoutMinutes * 60)) {
                Write-Log "run $run exceeded ${TimeoutMinutes}m - terminating the game process" "WARN"
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                $timedOut = $true
                Start-Sleep -Seconds 3
                break
            }
            Start-Sleep -Milliseconds 800
        }

        # drain whatever the game wrote between the last poll and its exit, then close
        foreach ($line in (Read-Tail $tailDebug)) {
            $payload = Get-V3tbPayload $line
            if ($payload -and $payload.StartsWith("V3TB|$token|")) { $null = $streamed.Add($payload) }
            if ($line -match "successfully matched game version") { $modLoaded = $true }
            if ($line -match "PM_TECH_REHAUL: init OK")           { $modInit = $true }
        }
        $null = Read-Tail $tailTick
        $null = Read-Tail $tailError
        $mirrored = [ordered]@{ "debug.log" = $tailDebug.Lines; "dedicated_server.log" = $tailTick.Lines; "error.log" = $tailError.Lines }
        Close-Tail $tailDebug; Close-Tail $tailTick; Close-Tail $tailError

        $runEnd  = Get-Date
        $wallSec = [math]::Round(($runEnd - $runStart).TotalSeconds, 1)
        Write-Log ("run $run finished: {0}s wall, in-game {1}, exit {2}" -f $wallSec, $lastTick, $(if ($timedOut) { "KILLED" } else { "self-quit" }))

        # ---- collect the game's own logs (only files this run actually touched) ----
        $copied = @()
        foreach ($f in (Get-ChildItem $LogDir -File -ErrorAction SilentlyContinue)) {
            if ($f.LastWriteTime -ge $runStart.AddSeconds(-2)) {
                Copy-Item $f.FullName (Join-Path $runDir "logs\$($f.Name)") -Force
                $copied += $f.Name
            }
        }

        # ---- V3TB harvest ----
        # The continuous mirror is authoritative (complete, single-run). The copied ring and the
        # in-memory stream are then folded in as belt and braces - they can only add a line the
        # mirror somehow missed, never reorder or duplicate one.
        $final = New-Object System.Collections.Generic.List[string]
        $foreign = 0
        $sources = @(Join-Path $liveDir "debug.log")
        $sources += @(Get-ChildItem (Join-Path $runDir "logs") -Filter "debug*.log" -ErrorAction SilentlyContinue |
                      Sort-Object { if ($_.Name -match "debug\.([0-9]+)\.log") { -[int]$Matches[1] } else { 0 } } |
                      ForEach-Object { $_.FullName })
        foreach ($src in $sources) {
            foreach ($line in (Get-Content $src -ErrorAction SilentlyContinue)) {
                $payload = Get-V3tbPayload $line
                if ($payload) {
                    if (-not $payload.StartsWith("V3TB|$token|")) { $foreign++ }   # an earlier run's, via the rotated log
                    elseif (-not $final.Contains($payload)) { $null = $final.Add($payload) }
                }
            }
        }
        foreach ($l in $streamed) { if (-not $final.Contains($l)) { $null = $final.Add($l) } }
        [System.IO.File]::WriteAllLines($harnessLog, [string[]]$final, $Utf8NoBom)

        # ---- parse -> markets.tsv ----
        $rows = New-Object System.Collections.Generic.List[string]
        $markets = @{}; $notFound = @{}; $ingameDate = ""
        $sawEnd = $false   # judged from the harvest, not the live stream (a poll can miss the tail)
        # payload layout: V3TB | <token> | <kind> | ...
        foreach ($p in $final) {
            $f = $p.Split('|')
            if ($f.Count -lt 3) { continue }
            if ($f[2] -eq "END") { $sawEnd = $true }
            if ($f[2] -eq "BEGIN" -and $f.Count -ge 4) { $ingameDate = $f[3] }
            elseif ($f[2] -eq "MARKET" -and $f.Count -ge 5) { $markets[$f[3]] = $f[4] }
            elseif ($f[2] -eq "MARKET_NOT_FOUND" -and $f.Count -ge 5) { $notFound[$f[3]] = $f[4] }
            elseif ($f[2] -eq "G" -and $f.Count -ge 8) {
                $mk = ""; if ($markets.ContainsKey($f[3])) { $mk = $markets[$f[3]] }
                $null = $rows.Add(("{0}`t{1}`t{2}`t{3}`t{4}`t{5}`t{6}`t{7}`t{8}" -f `
                    $run, $DumpDate, $f[3], $mk, $f[4], $f[5], $f[6], $f[7], "ok"))
            }
        }
        foreach ($tag in $Tags) {
            if ($notFound.ContainsKey($tag)) {
                $null = $rows.Add(("{0}`t{1}`t{2}`t`t`t`t`t`t{3}" -f $run, $DumpDate, $tag, "MARKET_NOT_FOUND: $($notFound[$tag])"))
                Write-Log "  $tag -> MARKET NOT FOUND ($($notFound[$tag]))" "WARN"
            }
        }
        $header = "run`tdump_date`ttag`tmarket`tgood`tbuy_orders`tsell_orders`tprice`tstatus"
        [System.IO.File]::WriteAllLines((Join-Path $runDir "markets.tsv"), [string[]](@($header) + $rows), $Utf8NoBom)
        foreach ($r in $rows) { $null = $allRows.Add($r) }

        $errorLines = $mirrored["error.log"]   # from the mirror: the copied ring can be short
        $savesAfter = @(Get-ChildItem $SaveDir -Filter "autosave*.v3" -ErrorAction SilentlyContinue |
                        Where-Object { $_.LastWriteTime -ge $runStart }).Count

        $meta = [ordered]@{
            run = $run; token = $token; started = $runStart.ToString("s"); ended = $runEnd.ToString("s")
            wall_seconds = $wallSec; args = $gameArgs; dump_date = $DumpDate; until_date = $UntilDate
            reached_ingame_date = $lastTick; self_quit = (-not $timedOut); timed_out = $timedOut
            mod_loaded = $modLoaded; mod_init_marker = $modInit
            dump_complete = $sawEnd; dump_date_ingame = $ingameDate
            goods_rows = $rows.Count; markets = $markets; markets_not_found = $notFound
            error_log_lines = $errorLines; autosaves_written = $savesAfter - $savesBefore
            foreign_token_lines_skipped = $foreign
            mirrored_lines = $mirrored; logs_copied = $copied
        }
        [System.IO.File]::WriteAllText((Join-Path $runDir "meta.json"), ($meta | ConvertTo-Json -Depth 8), $Utf8NoBom)
        $session.runs += $meta

        Write-Log ("run ${run}: {0} goods rows, dump_complete={1}, mod_loaded={2}, error.log {3} lines" -f $rows.Count, $sawEnd, $modLoaded, $errorLines)
        Write-Log ("  mirrored live: debug {0} lines, ticks {1}, errors {2} -> logs_live\" -f $mirrored["debug.log"], $mirrored["dedicated_server.log"], $errorLines)
    }

    $header = "run`tdump_date`ttag`tmarket`tgood`tbuy_orders`tsell_orders`tprice`tstatus"
    [System.IO.File]::WriteAllLines((Join-Path $SessionDir "markets_all.tsv"), [string[]](@($header) + $allRows), $Utf8NoBom)
    [System.IO.File]::WriteAllText((Join-Path $SessionDir "session.json"), ($session | ConvertTo-Json -Depth 10), $Utf8NoBom)

    Write-Log "SESSION DONE: $($session.runs.Count) run(s), $($allRows.Count) rows -> $SessionDir"
}
finally {
    if (-not $NoRestore) {
        foreach ($f in @("content_load.json", "pdx_settings.json")) {
            $b = Join-Path $backupDir $f
            if (Test-Path $b) { Copy-Item $b (Join-Path $Doc $f) -Force }
        }
        Write-Log "restored content_load.json + pdx_settings.json"
    }
    if ((-not $KeepInstrument) -and (Test-Path $InstrDir)) {
        Remove-Item $InstrDir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Log "removed instrumentation mod"
    }
}
