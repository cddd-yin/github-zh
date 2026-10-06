# Headless runner for tests/test.html (unit assertions).
#
# Assumes the local static server from tests\serve.ps1 is already running.
# Launches headless Chrome, opens the test page, polls window.__ghzhTest and
# prints a compact JSON summary (failed case names included).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File tests\e2e\run-unit.ps1 [-Url http://127.0.0.1:8787/tests/test.html]
param(
  [string]$Url = 'http://127.0.0.1:8787/tests/test.html',
  [int]$Port = 9227,
  [int]$TimeoutSec = 45
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$work = Join-Path $env:TEMP 'opencode\ghzh-unit'
if (Test-Path $work) { Remove-Item $work -Recurse -Force }
New-Item -ItemType Directory -Path $work | Out-Null
$profile = Join-Path $work 'profile'

$proc = Start-Process -FilePath $chrome -ArgumentList @(
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  "--remote-debugging-port=$Port", "--user-data-dir=$profile", 'about:blank'
) -PassThru -WindowStyle Hidden

function Invoke-Cdp {
  param([System.Net.WebSockets.ClientWebSocket]$Ws, [string]$Payload)
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Payload)
  $Ws.SendAsync([ArraySegment[byte]]::new($bytes), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).Wait() | Out-Null
  $buffer = New-Object byte[] 4194304
  while ($true) {
    $sb = [System.Text.StringBuilder]::new()
    do {
      $r = $Ws.ReceiveAsync([ArraySegment[byte]]::new($buffer), [Threading.CancellationToken]::None).Result
      [void]$sb.Append([System.Text.Encoding]::UTF8.GetString($buffer, 0, $r.Count))
    } while (-not $r.EndOfMessage)
    $obj = $sb.ToString() | ConvertFrom-Json
    if ($obj.id) { return $obj }
  }
}

function Eval-Expr {
  param([System.Net.WebSockets.ClientWebSocket]$Ws, [int]$Id, [string]$Expr)
  $payload = @{ id = $Id; method = 'Runtime.evaluate'; params = @{ expression = $Expr; returnByValue = $true } } | ConvertTo-Json -Depth 8 -Compress
  return Invoke-Cdp -Ws $Ws -Payload $payload
}

$result = [ordered]@{ ok = $false }
try {
  $ver = $null
  for ($i = 0; $i -lt 60; $i++) {
    try { $ver = Invoke-RestMethod "http://127.0.0.1:$Port/json/version" -TimeoutSec 3; break } catch { Start-Sleep -Milliseconds 500 }
  }
  if (-not $ver) { throw 'CDP endpoint not reachable' }

  $tab = Invoke-RestMethod -Method Put "http://127.0.0.1:$Port/json/new?$Url"
  $ws = [System.Net.WebSockets.ClientWebSocket]::new()
  $ws.ConnectAsync([Uri]$tab.webSocketDebuggerUrl, [Threading.CancellationToken]::None).Wait() | Out-Null

  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $json = $null
  while ((Get-Date) -lt $deadline) {
    $eval = Eval-Expr -Ws $ws -Id 1 -Expr 'window.__ghzhTest ? JSON.stringify(window.__ghzhTest) : ""'
    $raw = [string]$eval.result.result.value
    if ($raw) { $json = $raw | ConvertFrom-Json; break }
    Start-Sleep -Milliseconds 500
  }

  if ($json) {
    $failedNames = @($json.results | Where-Object { -not $_.ok } | ForEach-Object { $_.name })
    $result['ok'] = ($json.failed -eq 0)
    $result['total'] = $json.total
    $result['passed'] = $json.passed
    $result['failed'] = $json.failed
    if ($failedNames.Count -gt 0) { $result['failedNames'] = $failedNames }
  } else {
    $result['error'] = 'window.__ghzhTest not found (script failed to load or tests did not run)'
  }

  try { Invoke-RestMethod -Method Put "http://127.0.0.1:$Port/json/close/$($tab.id)" | Out-Null } catch {}
  $ws.Dispose()
} catch {
  $result['ok'] = $false
  $result['error'] = $_.Exception.Message
} finally {
  if ($proc) { cmd /c "taskkill /PID $($proc.Id) /T /F >nul 2>nul" }
}

$result | ConvertTo-Json -Depth 6
