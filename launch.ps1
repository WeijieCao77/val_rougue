$ErrorActionPreference = 'Stop'
$demoRoot = $PSScriptRoot
$demoUrl = 'http://127.0.0.1:4177'
$running = $false
try {
    $response = Invoke-WebRequest -Uri $demoUrl -UseBasicParsing -TimeoutSec 2
    $running = $response.Content -match 'peak-season-demo'
    if (-not $running) { throw 'Port 4177 is occupied by another application.' }
} catch {
    if ($_.Exception.Message -like '*occupied*') { throw }
}
if (-not $running) {
    $node = (Get-Command node -ErrorAction Stop).Source
    $env:PORT = '4177'
    $null = New-Item -ItemType Directory -Path (Join-Path $demoRoot 'reports') -Force
    Start-Process -FilePath $node -ArgumentList 'server.mjs' -WorkingDirectory $demoRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $demoRoot 'reports/server.log') -RedirectStandardError (Join-Path $demoRoot 'reports/server-error.log')
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        Start-Sleep -Milliseconds 200
        try { $null = Invoke-WebRequest -Uri $demoUrl -UseBasicParsing -TimeoutSec 1; $running = $true; break } catch {}
    }
    if (-not $running) { throw 'Demo did not start. See reports/server-error.log.' }
}
Start-Process $demoUrl
