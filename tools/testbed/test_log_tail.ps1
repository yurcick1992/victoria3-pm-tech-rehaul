# THE LOG-MIRROR TAIL, SIMULATED (landmine L28, 2026-10-21): loads New-Tail / Read-Tail and their helpers from run_observer.ps1
# through its AST and runs five cases against a temp log - growth, one rotation, two rotations between polls, a rotation after a
# signature taken from a file under 120 bytes, an empty new file. PASS = the mirror holds every written line exactly once, in order.
# Run it after ANY change to the tail, before a batch:  powershell -ExecutionPolicy Bypass -File tools\testbed\test_log_tail.ps1
# (-Observer <path> scores another copy: the pre-2026-10-21 observer mirrors 15 lines for 9 in the short-signature case).
param([string]$Observer = (Join-Path $PSScriptRoot 'run_observer.ps1'))
$ErrorActionPreference = 'Stop'
# load ONLY the tail functions from the observer, through its AST
$ast = [System.Management.Automation.Language.Parser]::ParseFile($Observer, [ref]$null, [ref]$null)
$want = 'New-Tail','Get-SegmentSig','Get-TrueLength','Test-SameSegment','Close-Tail','Read-Chunk','Add-TailChunk','Read-Tail'
foreach ($f in $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $true)) {
    if ($want -contains $f.Name) { . ([scriptblock]::Create($f.Extent.Text)) }
}
$fails = 0
function Check($name, $cond) { if ($cond) { "  PASS $name" } else { "  FAIL $name"; $script:fails++ } }
$enc = New-Object System.Text.UTF8Encoding($false)
function Append($p, [string[]]$ls) { [IO.File]::AppendAllText($p, (($ls -join "`r`n") + "`r`n"), $enc) }
function Body($mirror) { @(Get-Content $mirror | Where-Object { $_ -notlike '--- harness:*' }) }
$n = 0
function L([int]$k, [int]$w = 60) { $script:n++; ("[12:00:{0:00}][file.cpp:{1}]: line {2} " -f ($k % 60), $k, $script:n) + ('x' * $w) }

foreach ($case in 'growth', 'rotation', 'multi', 'shortsig', 'emptynew') {
    $dir = Join-Path $env:TEMP ("tailtest_" + [guid]::NewGuid().ToString('N')); $null = New-Item -ItemType Directory $dir
    $log = Join-Path $dir 'error.log'; $mir = Join-Path $dir 'mirror.log'
    $all = New-Object System.Collections.Generic.List[string]
    if ($case -eq 'shortsig') { $l0 = '[12:00:00] a'; [IO.File]::WriteAllText($log, "$l0`r`n", $enc); $all.Add($l0) } else { $null = New-Item -ItemType File $log }
    $t = New-Tail -Path $log -Mirror $mir
    $t.Pos = 0L   # the run's own log: read from the start
    $null = Read-Tail $t
    1..5 | ForEach-Object { $x = L $_; Append $log @($x); $all.Add($x) }
    $null = Read-Tail $t
    switch ($case) {
        'rotation' { $x = L 99; Append $log @($x); $all.Add($x)                    # unread tail of the old file
                     Move-Item $log (Join-Path $dir 'error.1.log'); $y = L 7; Append $log @($y); $all.Add($y) }
        'multi'    { $x = L 98; Append $log @($x); $all.Add($x); Move-Item $log (Join-Path $dir 'error.1.log')
                     $y = L 97; Append $log @($y); $all.Add($y); Move-Item (Join-Path $dir 'error.1.log') (Join-Path $dir 'error.2.log')
                     Move-Item $log (Join-Path $dir 'error.1.log'); $z = L 96; Append $log @($z); $all.Add($z) }
        'shortsig' { $x = L 95 400; Append $log @($x); $all.Add($x)                # grows past 120 bytes unread, then rotates
                     Move-Item $log (Join-Path $dir 'error.1.log'); $y = 'b'; Append $log @($y); $all.Add($y) }
        'emptynew' { $x = L 94; Append $log @($x); $all.Add($x); Move-Item $log (Join-Path $dir 'error.1.log'); $null = New-Item -ItemType File $log }
    }
    1..3 | ForEach-Object { $null = Read-Tail $t }
    $more = L 50; Append $log @($more); $all.Add($more)
    1..3 | ForEach-Object { $null = Read-Tail $t }
    if ($t.Buf) { $t.Writer.WriteLine($t.Buf) }
    Close-Tail $t
    $got = Body $mir
    "$case : wrote $($all.Count) lines, mirrored $($got.Count)"
    Check "$case every line once, in order" (($got -join "`n") -ceq ($all -join "`n"))
    Remove-Item -Recurse -Force $dir
}
Check 'Test-SameSegment prefix true / mismatch false / empty false' ((Test-SameSegment 'abc' 'abcdef') -and -not (Test-SameSegment 'abd' 'abcdef') -and -not (Test-SameSegment '' 'x'))
if ($fails) { "FAILED: $fails"; exit 1 } else { "ALL PASSED" }
