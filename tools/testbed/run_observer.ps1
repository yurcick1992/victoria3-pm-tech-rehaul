<#
  run_observer.ps1 - the GAME driver: launch, supervise, harvest, crash-resume.

  NOT THE MEASUREMENT ENTRY POINT. All measurement goes through
  tools\testbed\run_schedule.ps1, which owns "schedule -> build each run's mod -> run it ->
  harvest" and the record of what was built and why. This script is what the scheduler calls,
  and a hand invocation is a DIAGNOSTIC (a post-patch smoke test), not an experiment: it has no
  build step, so it can only run a mod someone else already built.

  Launches Victoria 3 WITHOUT the Paradox launcher, straight into a hands-off observer game, runs
  it to a date, harvests the telemetry that mod emits, quits. Fully deterministic - no agent in
  the loop.

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

  TELEMETRY COMES FROM THE MOD UNDER TEST, always. build.ps1 bakes it in from the single generator
  tools\telemetry_lib.ps1 (`-Telemetry <spec>`), so the vanilla control arm (`build.ps1
  -ControlOnly`) and every modded arm instrument IDENTICALLY - which is the only thing that makes a
  control a control. This script used to be able to generate its own instrumentation mod instead;
  that second generator was removed, because it had already drifted (its market line stopped at
  price - no imports/exports/production - and it emitted no events at all).

  Output - ONE results root, tools\testbed\sessions\:
    sessions\<stamp>\session.log / session.json / markets_all.tsv    (multi-run session)
    sessions\<stamp>\runNN\meta.json / markets.tsv / events.tsv / harness.log
    sessions\<stamp>\runNN\logs_live\*   <- AUTHORITATIVE: written continuously as the run happens,
                                            one complete file per log, per run
    sessions\<stamp>\runNN\logs\*        <- snapshot of the game's log folder at exit
  With -FlatOut (how the scheduler calls this) there is exactly ONE run, so the runNN level and the
  session-level aggregates collapse away: everything above lands directly in -OutRoot.

  Why logs_live exists: the game's own logs are a rotating ring (5 x 512 KB) and it rotates them
  again at every launch, so (a) a long run throws its own early game away before it ends -
  dedicated_server.log alone fills a slot per ~5 in-game years - and (b) the end-of-run snapshot
  mixes runs, because a previous run's log is still sitting in the ring. Mirroring as we go fixes
  both. Only the growing logs are mirrored; the rest are static and the snapshot is enough.

  Usage (measurement: use run_schedule.ps1 instead):
    powershell -ExecutionPolicy Bypass -File tools\testbed\run_observer.ps1 -Runs 1 -DumpDates 1836.3.1 -UntilDate 1836.4.1
#>
[CmdletBinding()]
param(
    # how many observer runs to do
    [int]      $Runs = 3,
    # in-game dates the metric is dumped on. Each MUST be the 1st of a month (on_monthly_pulse).
    # Several dates cost nothing but a few log lines and are cheap insurance: if a long run is
    # cut short, the earlier dumps still landed.
    [string[]] $DumpDates = @("1840.1.1"),
    # in-game date the game quits itself on
    [string]   $UntilDate = "1841.1.1",
    # country tags whose markets we dump
    [string[]] $Tags = @("GBR", "FRA"),
    [string]   $Game = $(if ($env:VIC3_GAME) { $env:VIC3_GAME } else { "C:\Program Files (x86)\Steam\steamapps\common\Victoria 3\game" }),
    # the mod under test; default = what build.ps1 deploys. Any absolute path works, so an
    # alternate build (build.ps1 -SaveTo <name> -> mod_<name>\) can be run without deploying it.
    # It MUST carry telemetry (build.ps1 -Telemetry/-TelemetryOn), including the vanilla control
    # arm, which is a real mod built by build.ps1 -ControlOnly.
    [string]   $ModPath = "",
    # the config the mod under test was built from; recorded (with its hash) in build_state.json
    [string]   $BuildConfig = "",
    # short label for this batch, e.g. "vanilla-baseline"
    [string]   $Label = "",
    # path to a JSON file whose contents become build_state.json's "agentic" block
    [string]   $Notes = "",
    [string]   $OutRoot = "",
    # Write straight into -OutRoot instead of creating a timestamped subfolder under it, AND
    # collapse the single run's own folder + session-level aggregates into it. The scheduler owns
    # the folder naming and always runs exactly one run per invocation, so without this a scheduled
    # run nests three deep (run001_setup\<stamp>\run01\) and duplicates its own results one level up
    # (markets_all.tsv == run01\markets.tsv, session.json == run01\meta.json).
    [switch]   $FlatOut,
    # Session id. The scheduler passes ITS stamp so one run has ONE identity across
    # build_state.json, session.json, the folder name and the telemetry token.
    [string]   $Stamp = "",
    # How often the game autosaves - the ONLY way to make a crash resumable, since no script
    # effect can save the game. Values are the engine's own (exe: SETTING_AUTOSAVE / OPTION_*);
    # note "halfyear" has no underscore while "five_year" does.
    # WARNING: this OVERWRITES the player's own autosave*.v3 slots. See MODDING_NOTES.
    [ValidateSet("never", "monthly", "quarteryear", "halfyear", "five_year", "yearly")]
    [string]   $AutosaveInterval = "five_year",
    # How many times a single run may be resumed from its last autosave after an abnormal exit.
    # 0 disables resuming (an abnormal exit then just ends the run).
    [int]      $MaxResumes = 5,
    # On an abnormal exit with NO crash artifact, wait this long for a keypress before deciding
    # it was a crash rather than you. Any key = you did it = stop the batch.
    [int]      $StopGraceSeconds = 60,
    # must match the token the builder stamped into the mod's telemetry
    [string]   $TelemetryToken = "",
    # hard watchdog: kill the process if a single run exceeds this
    [int]      $TimeoutMinutes = 45,
    # leave content_load.json / pdx_settings.json as the harness set them
    [switch]   $NoRestore
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

if (-not $ModPath) { $ModPath = Join-Path $Doc "mod\pm_tech_rehaul" }
if (-not $OutRoot) { $OutRoot = Join-Path $PSScriptRoot "sessions" }   # ONE results root

foreach ($p in @($Exe, $ModPath)) {
    if (-not (Test-Path $p)) { throw "not found: $p" }
}
# Telemetry lives in the mod under test - there is no fallback generator here any more, so a mod
# without it would run for the full span and harvest nothing. Fail before burning the game time.
$TelemetryFile = Join-Path $ModPath "common\on_actions\zzz_v3tb_telemetry.txt"
if (-not (Test-Path $TelemetryFile)) {
    throw "the mod under test carries no telemetry: $TelemetryFile is missing. Build it with build.ps1 -Telemetry <spec.json> (or -TelemetryOn), or -ControlOnly for the vanilla control arm."
}
if ($FlatOut -and $Runs -ne 1) { throw "-FlatOut writes ONE run straight into -OutRoot; use -Runs 1 (the scheduler always does)." }
# `powershell -File script.ps1 -DumpDates a,b` hands the whole "a,b" over as ONE string (-File
# does not parse arrays, unlike -Command), so accept both forms.
$DumpDates = @($DumpDates | ForEach-Object { $_ -split ',' } | Where-Object { $_ })
$Tags      = @($Tags      | ForEach-Object { $_ -split ',' } | Where-Object { $_ })

foreach ($d in $DumpDates) {
    if ($d -notmatch '^\d{3,4}\.\d{1,2}\.1$') { throw "dump date '$d' must be the 1st of a month (on_monthly_pulse fires then), e.g. 1886.1.1" }
}

if (-not $Stamp) { $Stamp = Get-Date -Format "yyyyMMdd_HHmmss" }
$SessionDir = $(if ($FlatOut) { $OutRoot } else { Join-Path $OutRoot $Stamp })
$null = New-Item -ItemType Directory -Force -Path $SessionDir
# under -FlatOut this file sits next to the run's own artifacts, so name it for what it is
$SessionLog = Join-Path $SessionDir $(if ($FlatOut) { "run.log" } else { "session.log" })

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)   # harness output; game content is the builder's job

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $line = "[{0}] [{1}] {2}" -f (Get-Date -Format "HH:mm:ss"), $Level, $Message
    Write-Host $line
    Add-Content -Path $SessionLog -Value $line -Encoding utf8
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
    # $Append keeps one run in one mirror file across a crash resume.
    param([string]$Path, [string]$Mirror = "", [bool]$Append = $false)
    $len = 0L
    if (Test-Path $Path) { $len = (Get-Item $Path).Length }
    $writer = $null
    if ($Mirror) {
        $writer = New-Object System.IO.StreamWriter($Mirror, $Append, (New-Object System.Text.UTF8Encoding($false)))
        $writer.AutoFlush = $true   # survive a harness crash mid-run
    }
    # Sig/Seen support the multi-rotation drain in Read-Tail: a rotated segment never changes
    # again, so its first ~120 chars (which begin with a timestamp) identify it for good.
    return @{ Path = $Path; Pos = $len; Buf = ""; Writer = $writer; Lines = 0L
              Sig = (Get-SegmentSig $Path); Seen = (New-Object 'System.Collections.Generic.HashSet[string]')
              Lost = 0L
              # Seen2 de-duplicates V3TB lines across re-read segments; Dups counts what it caught.
              Seen2 = (New-Object 'System.Collections.Generic.HashSet[string]'); Dups = 0L }
}

function Get-SegmentSig {
    # First ~120 chars of a file, used as its identity. Empty string when unreadable.
    param([string]$Path)
    if (-not (Test-Path $Path)) { return "" }
    $share = [System.IO.FileShare]::ReadWrite -bor [System.IO.FileShare]::Delete
    $fs = $null
    try {
        $fs = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, $share)
        $n = [int][Math]::Min(120, $fs.Length)
        if ($n -le 0) { return "" }
        $b = New-Object byte[] $n
        $null = $fs.Read($b, 0, $n)
        return [System.Text.Encoding]::UTF8.GetString($b, 0, $n)
    } catch { return "" } finally { if ($fs) { $fs.Dispose() } }
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
    #
    # DE-DUPLICATES telemetry lines. The multi-rotation drain can re-read a segment in a narrow
    # window (measured 2026-08-01: 2202 duplicate lines in one run), which inflates every count
    # taken off the mirror. Only V3TB lines are tracked - they are what analysis consumes, and
    # bounding the set to them keeps memory sane. The game's own chatter is passed through
    # untouched, since duplicate engine log lines are harmless and tracking them all is not.
    param($State, [string]$Text, $Lines)
    if (-not $Text) { return }
    $parts = ($State.Buf + $Text) -split "`r?`n"
    for ($i = 0; $i -lt $parts.Count - 1; $i++) {
        $line = $parts[$i]
        # $null MUST be on the LEFT. `$hashset -ne $null` makes PowerShell treat the left operand as
        # a COLLECTION and FILTER it, returning the non-null elements - so an EMPTY set yields an
        # empty result, which is falsy, and the guard is false forever. That is exactly what happened:
        # the set started empty, the branch never ran, nothing was ever added, and the de-duplication
        # silently did nothing while reporting 0 (measured: 4244 duplicates reached the mirror anyway).
        if ($null -ne $State.Seen2 -and $line.Contains('V3TB|')) {
            $key = $line.Substring($line.IndexOf('V3TB|'))
            if (-not $State.Seen2.Add($key)) { $State.Dups++; continue }
            # Runaway guard: stop tracking rather than exhaust memory on a very long run.
            if ($State.Seen2.Count -gt 4000000) { $State.Seen2 = $null }
        }
        $null = $Lines.Add($line)
        if ($State.Writer) { $State.Writer.WriteLine($line); $State.Lines++ }
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
        # The game rotated this log out from under us. The ring is 5 x 512 KB and a SINGLE
        # telemetry dump can write ~450 KB, so more than one rotation can happen between polls -
        # the earlier "read <name>.1" fix handled exactly one and silently lost whole segments
        # beyond that (measured 2026-07-31: 1046 GDP lines emitted, 0 mirrored).
        #
        # So drain every segment we have not already consumed, OLDEST first (.5 -> .1): the one
        # matching our remembered signature is the file we were reading, so take it from Pos;
        # any other unseen segment appeared entirely after our last poll, so take all of it.
        $dir  = Split-Path -Parent $State.Path
        $base = [IO.Path]::GetFileNameWithoutExtension($State.Path)
        $ext  = [IO.Path]::GetExtension($State.Path)
        $recoveredChars = 0; $drained = @()
        for ($i = 5; $i -ge 1; $i--) {
            $rot = Join-Path $dir ("{0}.{1}{2}" -f $base, $i, $ext)
            if (-not (Test-Path $rot)) { continue }
            $sig = Get-SegmentSig $rot
            if (-not $sig) { continue }
            $from = 0L
            if ($sig -eq $State.Sig) { $from = $State.Pos }        # our file, continue where we left off
            elseif ($State.Seen.Contains($sig)) { continue }        # already drained on an earlier poll
            $chunk = Read-Chunk $rot $from
            if ($chunk) {
                Add-TailChunk $State $chunk $lines
                if ($State.Buf) {   # a rotated file is finished: no partial line can still grow
                    $null = $lines.Add($State.Buf)
                    if ($State.Writer) { $State.Writer.WriteLine($State.Buf); $State.Lines++ }
                    $State.Buf = ""
                }
                $recoveredChars += $chunk.Length
                $drained += "$base.$i$ext"
            }
            $null = $State.Seen.Add($sig)
        }
        $State.Pos = 0L; $State.Buf = ""
        $State.Sig = Get-SegmentSig $State.Path
        if ($State.Writer) {
            # NOTE: build the string first - inside a method call's parens a comma is an
            # ARGUMENT separator, so an inline `-f a, b, c` would hand -f only its first value
            $seam = "--- harness: source log rotated at {0}, recovered {1} chars from [{2}] ---" -f `
                    (Get-Date -Format "HH:mm:ss"), $recoveredChars, ($drained -join ', ')
            $State.Writer.WriteLine($seam)
        }
    }

    if ($len -gt $State.Pos) {
        if (-not $State.Sig) { $State.Sig = Get-SegmentSig $State.Path }
        $text = Read-Chunk $State.Path $State.Pos
        if ($text) {
            $State.Pos = $State.Pos + [System.Text.Encoding]::UTF8.GetByteCount($text)
            Add-TailChunk $State $text $lines
        }
    }
    return $lines
}

function Test-MirrorIntegrity {
    <#
      A silent 96% loss is worse than a crash. After a run, compare what we mirrored against what
      the game's own ring still holds: every V3TB line present in the ring MUST also be in the
      mirror (the mirror is a superset - it also holds segments the ring has since discarded).
      Returns the number of ring lines missing from the mirror; 0 is healthy.
    #>
    param([string]$MirrorPath, [string]$LogDir, [string]$Token)
    if (-not (Test-Path $MirrorPath)) { return -1 }
    $mine = New-Object 'System.Collections.Generic.HashSet[string]'
    foreach ($l in [System.IO.File]::ReadLines($MirrorPath)) {
        if ($l.Contains("V3TB|$Token|")) { $null = $mine.Add($l.Substring($l.IndexOf("V3TB|"))) }
    }
    $missing = 0
    foreach ($f in (Get-ChildItem $LogDir -Filter 'debug*.log' -ErrorAction SilentlyContinue)) {
        try {
            foreach ($l in [System.IO.File]::ReadLines($f.FullName)) {
                if ($l.Contains("V3TB|$Token|")) {
                    if (-not $mine.Contains($l.Substring($l.IndexOf("V3TB|")))) { $missing++ }
                }
            }
        } catch { }
    }
    return $missing
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
    # Autosaves are the ONLY way to make a crash resumable - no script effect can save the game.
    # They cost a stall and ~14-95 MB per write, and they OVERWRITE the player's autosave slots.
    Set-JsonSetting $s "game"     "autosave"     $AutosaveInterval
    [System.IO.File]::WriteAllText($f, ($s | ConvertTo-Json -Depth 12 -Compress), $Utf8NoBom)
}

# --------------------------------------------------------- build state ----
# One build_state.json per batch: what was under test, so a session's numbers stay
# interpretable months later. Deliberately a TREE with two halves:
#   deterministic - filled from the machine, never from a description. Grows as we learn
#                   which knobs matter; anything added here must be machine-read.
#   agentic       - free text supplied via -Notes/-Label. A stopgap while the parameter
#                   sweep is driven by hand; it explains what a build IS and why it ran.
# Read it as: deterministic answers "what exactly ran", agentic answers "what were we asking".

function Get-DirFingerprint {
    param([string]$Dir)
    if (-not $Dir -or -not (Test-Path $Dir)) { return $null }
    $files = @(Get-ChildItem $Dir -Recurse -File -ErrorAction SilentlyContinue)
    $bytes = 0L
    $sb = New-Object System.Text.StringBuilder
    foreach ($f in ($files | Sort-Object FullName)) {
        $bytes += $f.Length
        $null = $sb.Append($f.FullName.Substring($Dir.Length)).Append(':').Append($f.Length).Append(';')
    }
    $sha  = [System.Security.Cryptography.SHA256]::Create()
    $hash = ($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($sb.ToString())) |
             ForEach-Object { $_.ToString("x2") }) -join ""
    $sha.Dispose()
    return [ordered]@{ file_count = $files.Count; bytes = $bytes; layout_sha256 = $hash.Substring(0, 16) }
}

function Get-FileSha {
    param([string]$Path)
    if (-not $Path -or -not (Test-Path $Path)) { return $null }
    return (Get-FileHash $Path -Algorithm SHA256).Hash.Substring(0, 16).ToLower()
}

function Write-BuildState {
    $modMeta = $null
    if ($ModPath) {
        $mj = Join-Path $ModPath ".metadata\metadata.json"
        if (Test-Path $mj) {
            $m = Get-Content $mj -Raw -Encoding UTF8 | ConvertFrom-Json
            $modMeta = [ordered]@{
                name = $m.name; id = $m.id; version = $m.version
                supported_game_version = $m.supported_game_version
                replace_paths = $(if ($m.PSObject.Properties.Name -contains "replace_paths") { $m.replace_paths } else { @() })
            }
        }
    }

    $git = [ordered]@{ branch = ""; commit = ""; dirty = $null }
    try {
        Push-Location $RepoRoot
        $git.branch = (git rev-parse --abbrev-ref HEAD 2>$null)
        $git.commit = (git rev-parse --short HEAD 2>$null)
        $git.dirty  = @(git status --porcelain 2>$null).Count -gt 0
    } catch { } finally { Pop-Location -ErrorAction SilentlyContinue }

    $gameVersion = ""
    $ls = Join-Path (Split-Path -Parent $Game) "launcher\launcher-settings.json"
    if (Test-Path $ls) { $gameVersion = (Get-Content $ls -Raw -Encoding UTF8 | ConvertFrom-Json).rawVersion }

    $agentic = [ordered]@{
        label = $Label
        note  = "free-text for now; fill deterministically once the sweep driver exists"
    }
    if ($Notes) {
        if (-not (Test-Path $Notes)) { throw "notes file not found: $Notes" }
        $agentic = Get-Content $Notes -Raw -Encoding UTF8 | ConvertFrom-Json
    }

    $state = [ordered]@{
        schema_version = 1
        generated      = (Get-Date).ToString("s")
        session        = $Stamp
        deterministic  = [ordered]@{
            mod_under_test = $(if ($ModPath) { [ordered]@{
                                    path = $ModPath; metadata = $modMeta
                                    fingerprint = (Get-DirFingerprint $ModPath)
                                    built_from_config = $BuildConfig
                                    config_sha256 = (Get-FileSha $BuildConfig)
                                } } else { $null })
            repo    = $git
            game    = [ordered]@{ version = $gameVersion; exe = $Exe }
            harness = [ordered]@{
                script_sha256 = (Get-FileSha $PSCommandPath)
                runs = $Runs; dump_dates = $DumpDates; until_date = $UntilDate; tags = $Tags
                timeout_minutes = $TimeoutMinutes; autosave_interval = $AutosaveInterval
                max_resumes = $MaxResumes; stop_grace_seconds = $StopGraceSeconds
            }
            host = [ordered]@{ machine = $env:COMPUTERNAME; started = (Get-Date).ToString("s") }
        }
        agentic = $agentic
    }
    [System.IO.File]::WriteAllText((Join-Path $SessionDir "build_state.json"), ($state | ConvertTo-Json -Depth 12), $Utf8NoBom)
    return $state
}

# -------------------------------------------------- crash vs you, and stop ----
# An abnormal exit is either the game dying (resume it) or you killing it (stop the batch).
# Signals, in the order you actually use them:
#   1. a KEYPRESS, at any time while the game runs -> the PRIMARY control (Read-StopKey below:
#      p pause / r resume / s|q stop after this run / x|Esc stop now). Needs a real console.
#   2. a new crashes\victoria3_* dir -> unambiguous CTD (exception.txt + minidump.dmp). This is
#      the crash DISCRIMINATOR, not a stop request.
#   3. a keypress within the grace window -> you killed the game directly, with no minidump.
#   4. a STOP file -> the FALLBACK for headless invocation (no console => signals 1 and 3 cannot
#      work), and the way a keypress reaches a parent run_schedule.ps1 in another process.
# Exit codes are NOT used: Task Manager, Stop-Process and the game's own crash handler are not
# reliably distinguishable, whereas a minidump either exists or does not.

$StopFile      = Join-Path $SessionDir "STOP"
$GlobalStopFile = Join-Path $PSScriptRoot "STOP"   # tools\testbed\STOP - stops ANY session
$CrashDir      = Join-Path $Doc "crashes"

function Test-StopRequested {
    # Either file works. The global one is also how a keypress here propagates to a parent
    # batch driver running in another process.
    return ((Test-Path $StopFile) -or (Test-Path $GlobalStopFile))
}

$script:HasConsole = $true
try { $null = [Console]::KeyAvailable } catch { $script:HasConsole = $false }
# Say so ONCE, loudly, at startup. Redirecting stdout/stderr (Start-Process -RedirectStandardOutput
# / -NoNewWindow) is enough to make [Console]::KeyAvailable throw, which silently disables every
# key below - and until this warning existed a headless launch looked identical to an interactive
# one in the log, so a whole overnight batch could run with no stop control but the STOP file.
if (-not $script:HasConsole) {
    Write-Log "no interactive console - keypress control (p/r/s/q/x) is DISABLED for this session" "WARN"
    Write-Log "  the STOP file is the only stop channel: $(Join-Path $PSScriptRoot 'STOP')" "WARN"
    Write-Log "  to get the keys back, launch into its OWN window and do not redirect stdio" "WARN"
}

function Write-KeyLegend {
    # Printed at the start of every run: the keys are useless if you have to remember them, and
    # they are only live while the game is running.
    if (-not $script:HasConsole) { return }
    Write-Log "controls (press in THIS window, any time while the game runs):"
    Write-Log "  [p] pause   - suspends the watchdog + crash detection. Does NOT pause the GAME;"
    Write-Log "                pause that yourself. Paused time is not counted toward the timeout."
    Write-Log "  [r] resume  - if the game is still up, just resumes watching; if it has exited,"
    Write-Log "                resumes this run from its last autosave."
    Write-Log "  [s] or [q]  - stop AFTER this run finishes: the run completes and is harvested"
    Write-Log "                normally, then the batch ends. Nothing is lost."
    Write-Log "  [x] or ESC  - stop NOW: kills the game immediately. The current run is marked"
    Write-Log "                abandoned and its remaining dumps are lost."
}

function Read-StopKey {
    # Polled every cycle WHILE the game runs:
    #   p = pause   r = resume   s/q = stop after this run   x/Esc = stop now
    # Returns "" / "pause" / "resume" / "after" / "now".
    if (-not $script:HasConsole) { return "" }
    $verdict = ""
    while ([Console]::KeyAvailable) {
        $k = [Console]::ReadKey($true)
        switch ($k.Key) {
            "P"      { $verdict = "pause" }
            "R"      { $verdict = "resume" }
            "S"      { $verdict = "after" }
            "Q"      { $verdict = "after" }
            "X"      { $verdict = "now" }
            "Escape" { $verdict = "now" }
        }
    }
    return $verdict
}

function Set-GlobalStop {
    param([string]$Why)
    Set-Content -Path $GlobalStopFile -Value $Why -Encoding utf8   # seen by a parent batch driver
}

function Get-NewCrashDirs {
    param([datetime]$Since)
    if (-not (Test-Path $CrashDir)) { return @() }
    return @(Get-ChildItem $CrashDir -Directory -ErrorAction SilentlyContinue |
             Where-Object { $_.LastWriteTime -ge $Since })
}

function Test-OwnSaveIsNewest {
    # -continuelastsave loads the newest save ON THE MACHINE, not "this run's last save". If the
    # newest save predates this run it belongs to an earlier run or to the player, and resuming
    # would splice a foreign timeline into the data (measured: a resume once jumped FORWARD from
    # 1836.8 to 1837.1 and skipped a dump). So only resume when this run owns the newest save.
    param([datetime]$RunStart)
    $newest = Get-ChildItem $SaveDir -Filter *.v3 -ErrorAction SilentlyContinue |
              Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $newest) { return $null }
    if ($newest.LastWriteTime -lt $RunStart) { return $null }
    return $newest
}

function ConvertTo-DateNum {
    # "1886.1.1" / "1886.1.1.6" -> 18860101, for ordering. Returns 0 if unparseable.
    param([string]$D)
    if (-not $D) { return 0 }
    $p = $D.Split('.')
    if ($p.Count -lt 3) { return 0 }
    return ([int]$p[0]) * 10000 + ([int]$p[1]) * 100 + ([int]$p[2])
}

function Wait-ForUserVerdict {
    # Returns $true if a human is telling us to stop. Falls back to "no verdict" when there is
    # no interactive console at all (the overnight case), which is why the STOP file exists.
    param([int]$Seconds)
    $interactive = $true
    try { $null = [Console]::KeyAvailable } catch { $interactive = $false }
    if (-not $interactive) {
        Write-Log "  no interactive console - cannot ask; treating as a crash (drop a STOP file to end the batch)" "WARN"
        return $false
    }
    Write-Log "  press any key within ${Seconds}s if YOU stopped the game (no key = crash, will resume)" "WARN"
    while ([Console]::KeyAvailable) { $null = [Console]::ReadKey($true) }   # drain stale input
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-StopRequested) { return $true }
        if ([Console]::KeyAvailable) { $null = [Console]::ReadKey($true); return $true }
        Start-Sleep -Milliseconds 250
    }
    return $false
}

# ============================================================== session ====

$backupDir = Join-Path $SessionDir "_settings_backup"
$null = New-Item -ItemType Directory -Force -Path $backupDir
foreach ($f in @("content_load.json", "pdx_settings.json")) {
    $src = Join-Path $Doc $f
    if (Test-Path $src) { Copy-Item $src (Join-Path $backupDir $f) -Force }
}

$session = [ordered]@{
    stamp = $Stamp; runs_requested = $Runs; dump_dates = $DumpDates; until_date = $UntilDate
    tags = $Tags; mod_path = $ModPath; exe = $Exe; runs = @()
}
$allRows = New-Object System.Collections.Generic.List[string]
$script:FatalEarly = $false
$script:ExitCode = 0

try {
    # An already-running game would fight this session for the same log files (and CPU). That
    # happens when a previous harness run died and orphaned its game. Refuse rather than kill:
    # the process might be a game the user is actually playing.
    $running = @(Get-Process victoria3 -ErrorAction SilentlyContinue)
    if ($running.Count -gt 0) {
        throw "Victoria 3 is already running (PID $($running[0].Id)). Close it first - a second instance would write to the same logs\ folder and corrupt this session's harvest."
    }

    Write-Log "session $Stamp -> $SessionDir"
    $null = Write-BuildState
    Write-Log "build_state.json written$(if ($Label) { " (label: $Label)" })"
    Write-Log "mod under test: $ModPath"
    Write-Log "plan: $Runs run(s), dump $($Tags -join '+') markets on $($DumpDates -join ', '), quit at $UntilDate"

    $cl = Set-ContentLoad -ModDirs @($ModPath)
    Write-Log "content_load.json = $cl"
    Set-RunSettings
    Write-Log "pdx_settings.json: display_mode=windowed, language=l_english"

    $gameArgs = @("-gdpr-compliant", "-handsoff", "-disable_renderframeifneeded", "-run_until=$UntilDate")
    Write-Log "args: $($gameArgs -join ' ')"

    if ($script:HasConsole) { Write-Log "press [q] to stop after the current run, [x] to stop immediately" }
    $stopAfterRun = $false

    for ($run = 1; $run -le $Runs; $run++) {
        # -FlatOut = exactly one run, written straight into the session folder (no runNN level)
        $runDir = $(if ($FlatOut) { $SessionDir } else { Join-Path $SessionDir ("run{0:d2}" -f $run) })
        $null = New-Item -ItemType Directory -Force -Path (Join-Path $runDir "logs")
        $harnessLog = Join-Path $runDir "harness.log"

        $runStart = Get-Date
        $savesBefore = @(Get-ChildItem $SaveDir -Filter "autosave*.v3" -ErrorAction SilentlyContinue |
                         Where-Object { $_.LastWriteTime -ge $runStart }).Count

        # The token stamps every emitted line, which is what makes the harvest safe: consecutive runs
        # share one logs\ folder and the game rotates debug.log at startup, so a previous run's lines
        # are physically reachable from this run's files. It must MATCH what the builder baked into
        # the mod under test, so the scheduler passes it; a hand run derives one from the stamp.
        $token = $(if ($TelemetryToken) { $TelemetryToken } else { "{0}r{1:d2}" -f $Stamp, $run })
        Write-Log "telemetry: from the mod under test (token $token)"

        $liveDir = Join-Path $runDir "logs_live"
        $null = New-Item -ItemType Directory -Force -Path $liveDir
        $streamed = New-Object System.Collections.Generic.List[string]
        $lastTick = ""; $timedOut = $false; $modLoaded = $false; $modInit = $false
        $targetNum = ConvertTo-DateNum $UntilDate
        $attempt = 0; $resumes = 0; $abandoned = ""
        $attemptLog = @()
        $earlyDeaths = 0; $sameSaveTries = 0; $lastResumeSave = ""

        # ---- attempt loop: one pass per launch, extra passes are crash resumes ----
        while ($true) {
        $attempt++
        $attemptStart = Get-Date
        $launchArgs = $gameArgs
        if ($attempt -gt 1) { $launchArgs = @("-continuelastsave") + $gameArgs }
        $resumeFrom = $lastTick
        Write-Log $(if ($attempt -eq 1) { "run $run/$Runs starting (token $token)" }
                    else { "run $run resume attempt $attempt from the last autosave (was at $resumeFrom)" })
        Write-KeyLegend
        $proc = Start-Process -FilePath $Exe -ArgumentList $launchArgs -WorkingDirectory $Binaries -PassThru

        # Mirrors APPEND on a resume so one run stays one file.
        $app = ($attempt -gt 1)
        $tailDebug = New-Tail (Join-Path $LogDir "debug.log")             (Join-Path $liveDir "debug.log")             $app
        $tailTick  = New-Tail (Join-Path $LogDir "dedicated_server.log")  (Join-Path $liveDir "dedicated_server.log")  $app
        $tailError = New-Tail (Join-Path $LogDir "error.log")             (Join-Path $liveDir "error.log")             $app
        $lastReport = Get-Date
        $tickAtStart = $lastTick
        $firstTick = ""
        $paused = $false; $pauseStart = Get-Date; $pausedFor = 0.0

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
                if ($line -match "Processing Tick: ([0-9]+\.[0-9]+\.[0-9]+)") {
                    $lastTick = $Matches[1]
                    if (-not $firstTick) { $firstTick = $lastTick }
                }
            }
            $null = Read-Tail $tailError   # mirrored only; nothing to react to live

            # time spent paused must not count toward the watchdog
            $elapsed = ((Get-Date) - $runStart).TotalSeconds - $pausedFor
            if (((Get-Date) - $lastReport).TotalSeconds -ge 20) {
                Write-Log ("  ...{0,4:N0}s  in-game {1}" -f $elapsed, $(if ($lastTick) { $lastTick } else { "loading" }))
                $lastReport = Get-Date
            }
            $key = Read-StopKey
            if ($key -eq "pause" -and -not $paused) {
                $paused = $true; $pauseStart = Get-Date
                Write-Log "[p] PAUSED - watchdog and crash detection suspended. The GAME is still running; pause it yourself if you want it stopped. [r] to resume." "WARN"
                Write-KeyLegend
            }
            elseif ($key -eq "resume" -and $paused) {
                # your rule: if the game is still up you will unpause it yourself and we just
                # keep watching; if it is gone, resume that run from its last autosave.
                $paused = $false
                $pausedFor += ((Get-Date) - $pauseStart).TotalSeconds
                $stillUp = $null -ne (Get-Process -Id $proc.Id -ErrorAction SilentlyContinue)
                if ($stillUp) { Write-Log "[r] resumed - game still running, continuing to watch" }
                else { Write-Log "[r] resumed - game is gone; will resume this run from its last autosave" "WARN" }
            }
            if ($paused) { Start-Sleep -Milliseconds 400; continue }
            if ($key -eq "now") {
                Write-Log "[x/Esc] stopping NOW - closing the game; this run is abandoned" "WARN"
                Set-GlobalStop "stopped by keypress"
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                $timedOut = $true; $abandoned = "stopped by user (keypress)"
                Start-Sleep -Seconds 3
                break
            }
            if ($key -eq "after") {
                Write-Log "[s/q] will stop AFTER this run finishes - it completes and is harvested" "WARN"
                Set-GlobalStop "stop after current run"
                $stopAfterRun = $true
            }
            if (Test-StopRequested -and -not $stopAfterRun) {
                Write-Log "STOP requested - ending the batch and closing the game" "WARN"
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                $timedOut = $true; $abandoned = "stopped by user (STOP file)"
                Start-Sleep -Seconds 3
                break
            }
            if (-not $alive) { break }
            if ($elapsed -gt ($TimeoutMinutes * 60)) {
                Write-Log "run $run exceeded ${TimeoutMinutes}m - terminating the game process" "WARN"
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                $timedOut = $true; $abandoned = "watchdog timeout"
                Start-Sleep -Seconds 3
                break
            }
            # 200ms, not 800: a single market-goods dump writes ~0.93 MB (two ring segments) in one
            # tick, so a slow poll lets segments age out before the drain sees them. Measured at
            # 800ms: 3815 telemetry lines lost. Polling is cheap; losing a dump is not.
            Start-Sleep -Milliseconds 200
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

        # ---- did this attempt finish the run, and if not, whose fault was it? ----
        # @() at the CALL site: PowerShell unrolls a returned array, so an empty result would
        # arrive as $null and $null.Count throws under StrictMode
        $crashDirs = @(Get-NewCrashDirs $attemptStart)
        $reached   = (ConvertTo-DateNum $lastTick) -ge $targetNum
        $attemptLog += [ordered]@{
            attempt = $attempt; started = $attemptStart.ToString("s")
            seconds = [math]::Round(((Get-Date) - $attemptStart).TotalSeconds, 1)
            resumed_from = $(if ($attempt -gt 1) { $resumeFrom } else { "" })
            ended_at_ingame = $lastTick; reached_target = $reached
            crash_dirs = @($crashDirs | ForEach-Object { $_.Name })
        }

        if ($reached -or $timedOut) { break }

        # Where did a resume actually land? Two ways it can be wrong, both silent:
        #   ahead  - it loaded a newer save belonging to something else, skipping dumps
        #   at the start - the load failed and -handsoff began a FRESH 1836 game instead
        #                  (verified: a bad -loadsave path does exactly this)
        if ($attempt -gt 1) {
            $landed = ConvertTo-DateNum $firstTick
            $wanted = ConvertTo-DateNum $tickAtStart
            if ($landed -gt $wanted) {
                Write-Log "resume landed at $firstTick, AHEAD of $tickAtStart - foreign save, abandoning run $run" "WARN"
                $abandoned = "resume loaded a save ahead of the run"
                break
            }
            if ($wanted - $landed -gt 20000) {   # >2 in-game years back = not our autosave
                Write-Log "resume landed at $firstTick, far behind $tickAtStart - fresh game, abandoning run $run" "WARN"
                $abandoned = "resume started a fresh game"
                break
            }
            if ((ConvertTo-DateNum $lastTick) -le $wanted) {
                Write-Log "resume made no progress (still $lastTick) - abandoning run $run" "WARN"
                $abandoned = "resume made no progress"
                break
            }
        }
        if ($resumes -ge $MaxResumes) {
            Write-Log "run ${run}: $MaxResumes resume(s) already used - giving up at $lastTick" "WARN"
            $abandoned = "resume budget exhausted"
            break
        }

        if (Test-StopRequested) { $abandoned = "stopped by user (STOP file)"; break }

        $ownSave = Test-OwnSaveIsNewest $runStart
        if (-not $ownSave) {
            # Nothing to resume from: the run died before its first autosave (with five_year,
            # inside the first 5 in-game years). Repeated deaths this early are a broken-mod
            # signature, not bad luck - count them and let the scheduler abort everything.
            $earlyDeaths++
            Write-Log "run ${run}: died at $lastTick before any autosave existed (attempt $earlyDeaths of 3)" "WARN"
            if ($earlyDeaths -ge 3) {
                Write-Log "" "ALERT"
                Write-Log "*** THREE CRASHES BEFORE THE FIRST AUTOSAVE ***" "ALERT"
                Write-Log "*** The mod under test is almost certainly broken. Stopping the whole schedule. ***" "ALERT"
                $abandoned = "3 crashes before the first autosave - mod likely broken"
                $script:FatalEarly = $true
                break
            }
            Write-Log "restarting run $run from the beginning"
            $lastTick = ""; $streamed.Clear()
            continue
        }

        # Three consecutive resumes that all restart from the SAME save = the save itself is
        # poisoned; retrying it again would just loop.
        $saveKey = $ownSave.LastWriteTime.ToString("s")
        if ($saveKey -eq $lastResumeSave) { $sameSaveTries++ } else { $sameSaveTries = 1; $lastResumeSave = $saveKey }
        if ($sameSaveTries -ge 3) {
            Write-Log "run ${run}: 3 crashes from the same autosave - permanent failure, moving to the next run" "ALERT"
            $abandoned = "3 crashes from the same save"
            break
        }

        if ($crashDirs.Count -gt 0) {
            Write-Log "run ${run}: game CRASHED at $lastTick (crash dump: $($crashDirs[0].Name)) - resuming" "WARN"
        } else {
            Write-Log "run ${run}: game exited early at $lastTick with no crash dump" "WARN"
            if (Wait-ForUserVerdict $StopGraceSeconds) {
                Write-Log "  user confirmed - stopping the batch" "WARN"
                $abandoned = "stopped by user (keypress)"
                break
            }
            Write-Log "  no response - treating as a crash and resuming"
        }
        $resumes++
        }   # ---- end attempt loop ----

        $runEnd  = Get-Date
        $wallSec = [math]::Round(($runEnd - $runStart).TotalSeconds, 1)
        Write-Log ("run $run finished: {0}s wall over {1} attempt(s), in-game {2}, exit {3}" -f `
            $wallSec, $attempt, $lastTick, $(if ($abandoned) { $abandoned } elseif ($timedOut) { "KILLED" } else { "self-quit" }))

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
        $events = New-Object System.Collections.Generic.List[string]
        $markets = @{}; $notFound = @{}; $ingameDate = ""
        # payload layout: V3TB | <token> | <kind> | <dump date> | ...   (BOOT has no date)
        # LAST WINS per (date, tag, good): a crash resume rewinds to the last autosave, so a dump
        # date already passed can fire a SECOND time with different numbers. The later emission is
        # the one on the timeline that actually reached the end, so it is the one to keep.
        $dumpsSeen = @{}
        $byKey = New-Object System.Collections.Specialized.OrderedDictionary
        $reDumped = 0
        foreach ($p in $final) {
            $f = $p.Split('|')
            if ($f.Count -lt 4) { continue }
            $kind = $f[2]; $date = $f[3]
            if ($kind -eq "END") { $dumpsSeen[$date] = $true }
            elseif ($kind -eq "BEGIN") { $ingameDate = $f[4] }
            elseif ($kind -eq "MARKET" -and $f.Count -ge 6) { $markets["$date|$($f[4])"] = $f[5] }
            elseif ($kind -eq "MARKET_NOT_FOUND" -and $f.Count -ge 6) { $notFound["$date|$($f[4])"] = $f[5] }
            elseif ($kind -eq "G" -and $f.Count -ge 9) {
                # V3TB|tok|G|date|tag|good|buy|sell|price[|imports|exports|production]
                # imports/exports/production are present when the telemetry spec asks for them;
                # older logs stop at price, so treat the tail as optional rather than dropping it.
                $mk = ""; if ($markets.ContainsKey("$date|$($f[4])")) { $mk = $markets["$date|$($f[4])"] }
                $imp = $(if ($f.Count -ge 10) { $f[9] }  else { "" })
                $exp = $(if ($f.Count -ge 11) { $f[10] } else { "" })
                $prd = $(if ($f.Count -ge 12) { $f[11] } else { "" })
                $key = "$date|$($f[4])|$($f[5])"
                if ($byKey.Contains($key)) { $reDumped++ }
                $byKey[$key] = ("{0}`t{1}`t{2}`t{3}`t{4}`t{5}`t{6}`t{7}`t{8}`t{9}`t{10}`t{11}" -f `
                    $run, $date, $f[4], $mk, $f[5], $f[6], $f[7], $f[8], $imp, $exp, $prd, "ok")
            }
            elseif ($kind -eq "EV" -and $f.Count -ge 5) {
                $null = $events.Add(("{0}`t{1}`t{2}" -f $run, $f[3], (($f[4..($f.Count-1)]) -join "`t")))
            }
        }
        foreach ($k in $byKey.Keys) { $null = $rows.Add($byKey[$k]) }
        if ($reDumped -gt 0) { Write-Log "  $reDumped row(s) re-dumped after a resume - kept the later value" "WARN" }
        foreach ($k in $notFound.Keys) {
            $parts = $k.Split('|')
            $null = $rows.Add(("{0}`t{1}`t{2}`t`t`t`t`t`t`t`t`t{3}" -f $run, $parts[0], $parts[1], "MARKET_NOT_FOUND: $($notFound[$k])"))
            Write-Log "  $($parts[1]) at $($parts[0]) -> MARKET NOT FOUND ($($notFound[$k]))" "WARN"
        }
        $sawEnd = $true
        foreach ($d in $DumpDates) { if (-not $dumpsSeen.ContainsKey($d)) { $sawEnd = $false } }
        $header = "run`tdump_date`ttag`tmarket`tgood`tbuy_orders`tsell_orders`tprice`timports`texports`tproduction`tstatus"
        [System.IO.File]::WriteAllLines((Join-Path $runDir "markets.tsv"), [string[]](@($header) + $rows), $Utf8NoBom)
        foreach ($r in $rows) { $null = $allRows.Add($r) }

        # one-off events (bankruptcy/default entry, diplo plays, peace, capitulation) get their own
        # file: they are event-shaped, not a per-good grid, so they do not belong in markets.tsv
        if ($events.Count -gt 0) {
            $evHeader = "run`tkind`tfields..."
            [System.IO.File]::WriteAllLines((Join-Path $runDir "events.tsv"), [string[]](@($evHeader) + $events), $Utf8NoBom)
            Write-Log "  $($events.Count) one-off event(s) -> events.tsv"
        }

        $errorLines = $mirrored["error.log"]   # from the mirror: the copied ring can be short
        $savesAfter = @(Get-ChildItem $SaveDir -Filter "autosave*.v3" -ErrorAction SilentlyContinue |
                        Where-Object { $_.LastWriteTime -ge $runStart }).Count

        $meta = [ordered]@{
            run = $run; token = $token; started = $runStart.ToString("s"); ended = $runEnd.ToString("s")
            wall_seconds = $wallSec; args = $gameArgs; dump_dates = $DumpDates; until_date = $UntilDate
            reached_ingame_date = $lastTick; self_quit = ((-not $timedOut) -and (-not $abandoned)); timed_out = $timedOut
            attempts = $attempt; resumes = $resumes; abandoned_reason = $abandoned
            attempt_log = $attemptLog; autosave_interval = $AutosaveInterval
            mod_loaded = $modLoaded; mod_init_marker = $modInit
            dump_complete = $sawEnd; dumps_seen = @($dumpsSeen.Keys | Sort-Object); dump_date_ingame = $ingameDate
            goods_rows = $rows.Count; markets = $markets; markets_not_found = $notFound
            error_log_lines = $errorLines; autosaves_written = $savesAfter - $savesBefore
            foreign_token_lines_skipped = $foreign
            mirrored_lines = $mirrored; logs_copied = $copied
        }
        [System.IO.File]::WriteAllText((Join-Path $runDir "meta.json"), ($meta | ConvertTo-Json -Depth 8), $Utf8NoBom)
        $session.runs += $meta

        Write-Log ("run ${run}: {0} goods rows, dump_complete={1}, mod_loaded={2}, error.log {3} lines" -f $rows.Count, $sawEnd, $modLoaded, $errorLines)

        if ($stopAfterRun -or (Test-StopRequested)) {
            Write-Log "stopping after run $run of $Runs as requested" "WARN"
            break
        }
        Write-Log ("  mirrored live: debug {0} lines, ticks {1}, errors {2} -> logs_live\" -f $mirrored["debug.log"], $mirrored["dedicated_server.log"], $errorLines)
        # Loud integrity check: anything the game's ring still holds must be in the mirror too.
        $missed = Test-MirrorIntegrity (Join-Path $liveDir "debug.log") $LogDir $token
        if ($missed -gt 0) {
            Write-Log ("  MIRROR INCOMPLETE: {0} telemetry line(s) present in the game's ring but NOT mirrored" -f $missed) "WARN"
            Write-Log  "  the harvest for this run is missing data - do not treat it as complete" "WARN"
        } elseif ($missed -eq 0) {
            Write-Log "  mirror integrity OK (every telemetry line in the ring is in the mirror)"
        }
        if ($tailDebug.Dups -gt 0) {
            Write-Log ("  de-duplicated {0} re-read telemetry line(s) (multi-rotation drain)" -f $tailDebug.Dups)
        }
    }

    # Session-level aggregates only when there IS a session: with -FlatOut there is exactly one run,
    # so markets_all.tsv would be a byte copy of its markets.tsv and session.json a re-wrap of its
    # meta.json. The scheduler builds the real cross-run aggregate over its whole schedule instead.
    if (-not $FlatOut) {
        $header = "run`tdump_date`ttag`tmarket`tgood`tbuy_orders`tsell_orders`tprice`timports`texports`tproduction`tstatus"
        [System.IO.File]::WriteAllLines((Join-Path $SessionDir "markets_all.tsv"), [string[]](@($header) + $allRows), $Utf8NoBom)
        [System.IO.File]::WriteAllText((Join-Path $SessionDir "session.json"), ($session | ConvertTo-Json -Depth 10), $Utf8NoBom)
    }

    Write-Log "SESSION DONE: $($session.runs.Count) run(s), $($allRows.Count) rows -> $SessionDir"

    # exit codes the scheduler reads:  0 ok | 2 stopped by user | 3 fatal (mod likely broken)
    if ($script:FatalEarly)  { $script:ExitCode = 3 }
    elseif ($stopAfterRun -or (Test-StopRequested)) { $script:ExitCode = 2 }
}
finally {
    if (-not $NoRestore) {
        foreach ($f in @("content_load.json", "pdx_settings.json")) {
            $b = Join-Path $backupDir $f
            if (Test-Path $b) { Copy-Item $b (Join-Path $Doc $f) -Force }
        }
        Write-Log "restored content_load.json + pdx_settings.json"
    }
}

exit $script:ExitCode
