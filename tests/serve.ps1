# Local static file server for tests (loopback only).
# Used to:
#   1) open tests/test.html in a browser to run assertions;
#   2) open http://127.0.0.1:<Port>/GitHub-<name>.user.js to trigger the Tampermonkey install page.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File tests\serve.ps1 [-Port 8787]
param(
  [int]$Port = 8787,
  [string]$Root = ''
)

$ErrorActionPreference = 'Stop'
if (-not $Root) { $Root = Split-Path -Parent $PSScriptRoot }
$Root = [System.IO.Path]::GetFullPath($Root)

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.md'   = 'text/plain; charset=utf-8'
  '.txt'  = 'text/plain; charset=utf-8'
  '.png'  = 'image/png'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()
Write-Host ("[serve] listening on http://127.0.0.1:{0}/  root: {1}" -f $Port, $Root)

while ($listener.IsListening) {
  $ctx = $null
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response

    # CORS headers (needed when an https page fetches the script for injection tests)
    $res.Headers.Add('Access-Control-Allow-Origin', '*')
    $res.Headers.Add('Access-Control-Allow-Methods', 'GET, OPTIONS')
    $res.Headers.Add('Access-Control-Allow-Headers', '*')
    $res.Headers.Add('Access-Control-Allow-Private-Network', 'true')

    if ($req.HttpMethod -eq 'OPTIONS') {
      $res.StatusCode = 204
      $res.OutputStream.Close()
      continue
    }

    $rel = [uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrEmpty($rel)) { $rel = 'tests/demo.html' }
    $rel = $rel -replace '/', '\'
    $full = [System.IO.Path]::GetFullPath((Join-Path $Root $rel))

    if (-not $full.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $full -PathType Leaf)) {
      $res.StatusCode = 404
      $res.ContentType = 'text/plain; charset=utf-8'
      $bytes = [Text.Encoding]::UTF8.GetBytes('404 Not Found: ' + $rel)
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      Write-Host ('404  ' + $req.Url.AbsolutePath)
    } else {
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
      if ($full -like '*.user.js') { $res.ContentType = 'text/plain; charset=utf-8' }
      elseif ($mime.ContainsKey($ext)) { $res.ContentType = $mime[$ext] }
      else { $res.ContentType = 'application/octet-stream' }
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      Write-Host ('200  ' + $req.Url.AbsolutePath + '  (' + $bytes.Length + ' B)')
    }
    $res.OutputStream.Close()
  } catch {
    Write-Host ('[serve] request error: ' + $_.Exception.Message)
    if ($ctx) { try { $ctx.Response.Abort() } catch {} }
  }
}
