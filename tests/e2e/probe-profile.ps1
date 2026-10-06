# Profile-page diagnostic probe for the GitHub Chinese userscript.
# Loads a real GitHub page, injects the userscript, then dumps every remaining
# English text node with a classification (dictionary gap vs timing miss).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File tests\e2e\probe-profile.ps1 [-Url https://github.com/cddd-yin]
param(
  [string]$Url = 'https://github.com/cddd-yin',
  [int]$Port = 9226,
  [int]$LoadTimeoutSec = 90,
  [int]$SettleSeconds = 10
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$srcFile = Get-ChildItem -Path $root -Filter '*.user.js' | Select-Object -First 1
if (-not $srcFile) { throw 'userscript file (*.user.js) not found in project root' }
$probeFile = Join-Path $PSScriptRoot 'probe.js'
$src = [System.IO.File]::ReadAllText($srcFile.FullName, [System.Text.Encoding]::UTF8)
$probe = [System.IO.File]::ReadAllText($probeFile, [System.Text.Encoding]::UTF8)

$outDir = Join-Path (Split-Path -Parent $PSScriptRoot) '_probe'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$work = Join-Path $env:TEMP 'opencode\ghzh-probe'
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
  $buffer = New-Object byte[] 8388608
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
  param([System.Net.WebSockets.ClientWebSocket]$Ws, [int]$Id, [string]$Expr, [bool]$Await = $false)
  $params = @{ expression = $Expr; returnByValue = $true }
  if ($Await) { $params.awaitPromise = $true }
  $payload = @{ id = $Id; method = 'Runtime.evaluate'; params = $params } | ConvertTo-Json -Depth 8 -Compress
  return Invoke-Cdp -Ws $Ws -Payload $payload
}

function Save-Shot {
  param([System.Net.WebSockets.ClientWebSocket]$Ws, [int]$Id, [string]$Path)
  $payload = '{"id":' + $Id + ',"method":"Page.captureScreenshot","params":{"format":"png"}}'
  $shot = Invoke-Cdp -Ws $Ws -Payload $payload
  if ($shot.result.data) {
    [IO.File]::WriteAllBytes($Path, [Convert]::FromBase64String($shot.result.data))
    return $true
  }
  return $false
}

$result = [ordered]@{ ok = $false }
try {
  # 1. wait for CDP
  $ver = $null
  for ($i = 0; $i -lt 60; $i++) {
    try { $ver = Invoke-RestMethod "http://127.0.0.1:$Port/json/version" -TimeoutSec 3; break } catch { Start-Sleep -Milliseconds 500 }
  }
  if (-not $ver) { throw 'CDP endpoint not reachable' }

  # 2. open the page
  $tab = Invoke-RestMethod -Method Put "http://127.0.0.1:$Port/json/new?$Url"
  $ws = [System.Net.WebSockets.ClientWebSocket]::new()
  $ws.ConnectAsync([Uri]$tab.webSocketDebuggerUrl, [Threading.CancellationToken]::None).Wait() | Out-Null

  # 3. wait until the page is usable
  $state = ''
  $deadline = (Get-Date).AddSeconds($LoadTimeoutSec)
  while ((Get-Date) -lt $deadline) {
    $eval = Eval-Expr -Ws $ws -Id 1 -Expr 'document.readyState + "|" + location.href + "|" + (document.body ? document.body.innerText.length : 0)'
    $state = [string]$eval.result.result.value
    $parts = $state.Split('|')
    if ($parts.Count -ge 3 -and $parts[0] -ne 'loading' -and $parts[1] -like 'https://github.com/*' -and $parts[2] -match '^\d+$' -and [int]$parts[2] -gt 500) { break }
    Start-Sleep -Milliseconds 700
  }
  $parts = $state.Split('|')
  if (-not ($parts.Count -ge 3 -and $parts[0] -ne 'loading' -and $parts[1] -like 'https://github.com/*' -and $parts[2] -match '^\d+$' -and [int]$parts[2] -gt 500)) { throw ('page did not load: ' + $state) }

  # 4. screenshot before injection
  $beforeShot = Join-Path $outDir 'page-before.png'
  [void](Save-Shot -Ws $ws -Id 2 -Path $beforeShot)

  # 5. inject the userscript
  $injectExpr = '(function(){ try { if (!window.__ghzh) { ' + $src + ' } } catch (e) { return "err:" + (e && e.message); } return window.__ghzh ? "injected" : "no-ghzh"; })()'
  $inj = Eval-Expr -Ws $ws -Id 3 -Expr $injectExpr
  $injVal = [string]$inj.result.result.value

  # 6. wait until some Chinese shows up (or timeout)
  $zh = $false
  $deadline = (Get-Date).AddSeconds(30)
  while ((Get-Date) -lt $deadline) {
    $eval = Eval-Expr -Ws $ws -Id 4 -Expr 'document.body.innerText.indexOf("\u5173\u6CE8") !== -1 || document.body.innerText.indexOf("\u6982\u89C8") !== -1'
    if ($eval.result.result.value -eq $true) { $zh = $true; break }
    Start-Sleep -Milliseconds 500
  }

  # 7. let staged rescans (1.2s / 3.5s / 8s) finish
  Start-Sleep -Seconds $SettleSeconds

  # 8. run the probe
  $chk = Eval-Expr -Ws $ws -Id 5 -Expr $probe -Await $true
  $report = [string]$chk.result.result.value
  $reportFile = Join-Path $outDir 'probe-report.json'
  [IO.File]::WriteAllText($reportFile, $report, (New-Object System.Text.UTF8Encoding($false)))

  # 9. screenshot after
  $afterShot = Join-Path $outDir 'page-after.png'
  [void](Save-Shot -Ws $ws -Id 6 -Path $afterShot)

  # 10. summarize
  $parsed = $report | ConvertFrom-Json
  $result['ok'] = $true
  $result['inject'] = $injVal
  $result['zhSeen'] = $zh
  $result['version'] = $parsed.version
  $result['countsA'] = $parsed.countsA
  $result['recoveredByForcedRescan'] = $parsed.recoveredByForcedRescan
  $result['reportFile'] = $reportFile
  $result['beforeShot'] = $beforeShot
  $result['afterShot'] = $afterShot

  # 11. cleanup
  try { Invoke-RestMethod -Method Put "http://127.0.0.1:$Port/json/close/$($tab.id)" | Out-Null } catch {}
  $ws.Dispose()
} catch {
  $result['ok'] = $false
  $result['error'] = $_.Exception.Message
} finally {
  if ($proc) { cmd /c "taskkill /PID $($proc.Id) /T /F >nul 2>nul" }
}

$result | ConvertTo-Json -Depth 6
