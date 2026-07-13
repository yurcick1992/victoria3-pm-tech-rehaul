<#
  PM & Tech Rehaul - balance UI server.
  Serves ui/ at http://localhost:8777 and exposes POST /api/build which writes the posted config
  to config/mod_config.json and runs tools/build.ps1 (regenerate + convert + lint + deploy).
  This makes the editor a self-contained, Claude-less iteration loop: edit -> Build now -> test in game.

  Usage:  powershell -ExecutionPolicy Bypass -File tools\ui.ps1   (then it opens the browser)
  Stop with Ctrl+C.
#>
param([int]$Port = 8777, [switch]$NoOpen)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$uiDir = Join-Path $repo 'ui'

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "PM & Tech Rehaul UI at http://localhost:$Port/  (Ctrl+C to stop)"
if (-not $NoOpen) { Start-Process "http://localhost:$Port/" }

function Send([System.Net.HttpListenerResponse]$resp, [int]$code, [string]$ctype, [byte[]]$bytes) {
    $resp.StatusCode = $code; $resp.ContentType = $ctype
    $resp.OutputStream.Write($bytes, 0, $bytes.Length); $resp.Close()
}
$enc = [System.Text.Encoding]::UTF8

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request; $resp = $ctx.Response
    try {
        $path = $req.Url.LocalPath
        if ($req.HttpMethod -eq 'POST' -and $path -eq '/api/build') {
            $body = (New-Object System.IO.StreamReader($req.InputStream, $enc)).ReadToEnd()
            # validate + write config, then build
            $null = $body | ConvertFrom-Json
            [System.IO.File]::WriteAllText((Join-Path $repo 'config\mod_config.json'), $body, (New-Object System.Text.UTF8Encoding($false)))
            $out = & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'build.ps1') 2>&1 | Out-String
            Send $resp 200 'text/plain; charset=utf-8' ($enc.GetBytes($out))
            continue
        }
        # static files from ui/
        $rel = $path.TrimStart('/'); if ($rel -eq '') { $rel = 'builder.html' }
        $f = Join-Path $uiDir $rel
        if ((Test-Path $f -PathType Leaf) -and ((Resolve-Path $f).Path).StartsWith((Resolve-Path $uiDir).Path)) {
            $ct = if ($f -match '\.html$') { 'text/html; charset=utf-8' } elseif ($f -match '\.js$') { 'application/javascript; charset=utf-8' } elseif ($f -match '\.css$') { 'text/css' } else { 'application/octet-stream' }
            Send $resp 200 $ct ([System.IO.File]::ReadAllBytes($f))
        } else {
            Send $resp 404 'text/plain' ($enc.GetBytes('not found'))
        }
    } catch {
        try { Send $resp 500 'text/plain; charset=utf-8' ($enc.GetBytes("error: $($_.Exception.Message)")) } catch {}
    }
}
