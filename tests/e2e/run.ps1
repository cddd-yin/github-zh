# Fully automated E2E test for the GitHub Chinese userscript.
#
# What it does:
#   1. starts a headless Chrome with a dedicated profile and a CDP port;
#   2. opens the target GitHub page in a new tab;
#   3. samples the README before injection;
#   4. injects the userscript (Runtime.evaluate; bypasses page CSP);
#   5. runs checks.js (probe nodes, nav counts, toggle on/off, localStorage cleanup);
#   6. captures a screenshot and prints a JSON report.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File tests\e2e\run.ps1 [-Url https://github.com/nodejs/node] [-ShotPath .\shot.png]
param(
  [string]$Url = 'https://github.com/nodejs/node',
  [int]$Port = 9223,
  [int]$LoadTimeoutSec = 90,
  [string]$ShotPath = ''
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$srcFile = Get-ChildItem -Path $root -Filter '*.user.js' | Select-Object -First 1
if (-not $srcFile) { throw 'userscript file (*.user.js) not found in project root' }
$checksFile = Join-Path $PSScriptRoot 'checks.js'
$src = [System.IO.File]::ReadAllText($srcFile.FullName, [System.Text.Encoding]::UTF8)
$checks = [System.IO.File]::ReadAllText($checksFile, [System.Text.Encoding]::UTF8)

$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$work = Join-Path $env:TEMP 'opencode\ghzh-e2e'
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
  param([System.Net.WebSockets.ClientWebSocket]$Ws, [int]$Id, [string]$Expr, [bool]$Await = $false)
  $params = @{ expression = $Expr; returnByValue = $true }
  if ($Await) { $params.awaitPromise = $true }
  $payload = @{ id = $Id; method = 'Runtime.evaluate'; params = $params } | ConvertTo-Json -Depth 8 -Compress
  return Invoke-Cdp -Ws $Ws -Payload $payload
}

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

  # 3. wait for the page to be usable (GitHub 页面经常迟迟不触发 load，容忍 interactive)
  $state = ''
  $deadline = (Get-Date).AddSeconds($LoadTimeoutSec)
  while ((Get-Date) -lt $deadline) {
    $eval = Eval-Expr -Ws $ws -Id 1 -Expr 'document.readyState + "|" + location.href + "|" + (document.body ? document.body.innerText.length : 0)'
    $state = [string]$eval.result.result.value
    $parts = $state.Split('|')
    if ($parts.Count -ge 3 -and $parts[0] -ne 'loading' -and $parts[1] -like 'https://github.com/*' -and $parts[2] -match '^\d+$' -and [int]$parts[2] -gt 3000) { break }
    Start-Sleep -Milliseconds 700
  }
  $parts = $state.Split('|')
  if (-not ($parts.Count -ge 3 -and $parts[0] -ne 'loading' -and $parts[1] -like 'https://github.com/*' -and $parts[2] -match '^\d+$' -and [int]$parts[2] -gt 3000)) { throw ('page did not load: ' + $state) }

  # 4. sample README before injection
  $beforeExpr = 'var mb = document.querySelector("." + "markdown-body"); window.__ghzhBefore = JSON.stringify({ len: mb ? mb.innerText.length : -1, head: mb ? mb.innerText.slice(0, 200) : null }); "ok"'
  [void](Eval-Expr -Ws $ws -Id 2 -Expr $beforeExpr)

  # 5. inject the userscript
  $injectExpr = '(function(){ try { if (!window.__ghzh) { ' + $src + ' } } catch (e) { return "err:" + (e && e.message); } return window.__ghzh ? "injected" : "no-ghzh"; })()'
  $inj = Eval-Expr -Ws $ws -Id 3 -Expr $injectExpr
  $injVal = [string]$inj.result.result.value

  # 6. wait until a translation shows up
  $zh = $false
  $deadline = (Get-Date).AddSeconds(25)
  while ((Get-Date) -lt $deadline) {
    $eval = Eval-Expr -Ws $ws -Id 4 -Expr 'document.body.innerText.indexOf("\u8bae\u9898") !== -1'
    if ($eval.result.result.value -eq $true) { $zh = $true; break }
    Start-Sleep -Milliseconds 500
  }

  # 7. run checks
  $chk = Eval-Expr -Ws $ws -Id 5 -Expr $checks -Await $true
  $report = [string]$chk.result.result.value

  # 8. screenshot
  $shotPayload = '{"id":6,"method":"Page.captureScreenshot","params":{"format":"png"}}'
  $shot = Invoke-Cdp -Ws $ws -Payload $shotPayload
  $shotSaved = ''
  if ($shot.result.data) {
    $shotFile = Join-Path $work 'screenshot.png'
    [IO.File]::WriteAllBytes($shotFile, [Convert]::FromBase64String($shot.result.data))
    if ($ShotPath) { Copy-Item $shotFile $ShotPath -Force; $shotSaved = $ShotPath } else { $shotSaved = $shotFile }
  }

  # 9. cleanup
  try { Invoke-RestMethod -Method Put "http://127.0.0.1:$Port/json/close/$($tab.id)" | Out-Null } catch {}
  $ws.Dispose()

  [ordered]@{ ok = $true; inject = $injVal; zhSeen = $zh; screenshot = $shotSaved; report = $report } | ConvertTo-Json -Depth 6
} catch {
  [ordered]@{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Depth 6
} finally {
  if ($proc) { cmd /c "taskkill /PID $($proc.Id) /T /F >nul 2>nul" }
}
