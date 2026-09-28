<#
.SYNOPSIS
  Off-site copy of the newest server database snapshot (see docs/BACKUP-AND-MONITORING.md).

.DESCRIPTION
  Downloads GET /api/admin/backup/latest (gzip) with "Authorization: Bearer <token>",
  saves it as <Destination>\online-YYYYMMDD.db.gz (local date; a second pull on the same
  day replaces that day's file), checks the gzip magic bytes, keeps the newest -Keep
  files and exits with code 1 on any failure. Windows PowerShell 5.1 compatible.

  The token is read from -TokenFile, else $env:VAL_ADMIN_TOKEN, else $env:ADMIN_TOKEN.
  It is never printed and must not be stored in the repository.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tools\pull-backup.ps1 -Destination D:\val-backups -TokenFile $HOME\val-admin-token.txt
#>
param(
  [Parameter(Mandatory = $true)][string]$Destination,
  [string]$TokenFile = '',
  [string]$Url = 'https://valrougue-production.up.railway.app',
  [int]$Keep = 30
)

$ErrorActionPreference = 'Stop'
$tmp = $null
try {
  if ($TokenFile) {
    if (-not (Test-Path -LiteralPath $TokenFile)) { throw "Token file not found: $TokenFile" }
    $token = (Get-Content -LiteralPath $TokenFile -Raw).Trim()
  } elseif ($env:VAL_ADMIN_TOKEN) {
    $token = $env:VAL_ADMIN_TOKEN.Trim()
  } elseif ($env:ADMIN_TOKEN) {
    $token = $env:ADMIN_TOKEN.Trim()
  } else {
    throw 'No token: pass -TokenFile or set VAL_ADMIN_TOKEN / ADMIN_TOKEN'
  }
  if (-not $token) { throw 'Token is empty' }

  if (-not (Test-Path -LiteralPath $Destination)) { New-Item -ItemType Directory -Path $Destination | Out-Null }
  $name = 'online-' + (Get-Date -Format 'yyyyMMdd') + '.db.gz'
  $final = Join-Path $Destination $name
  $tmp = $final + '.part'

  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  $endpoint = $Url.TrimEnd('/') + '/api/admin/backup/latest'
  $ProgressPreference = 'SilentlyContinue'
  Invoke-WebRequest -Uri $endpoint -Headers @{ Authorization = "Bearer $token" } -OutFile $tmp -UseBasicParsing -TimeoutSec 300

  $info = Get-Item -LiteralPath $tmp
  if ($info.Length -lt 20) { throw "Downloaded file too small ($($info.Length) bytes)" }
  $fs = [IO.File]::OpenRead($tmp)
  try { $b1 = $fs.ReadByte(); $b2 = $fs.ReadByte() } finally { $fs.Dispose() }
  if ($b1 -ne 0x1f -or $b2 -ne 0x8b) { throw 'Downloaded file is not gzip' }

  # Full decompression check: the stream must inflate to the end and start with the SQLite header.
  $in = [IO.File]::OpenRead($tmp)
  try {
    $gz = New-Object IO.Compression.GZipStream($in, [IO.Compression.CompressionMode]::Decompress)
    $buf = New-Object byte[] 65536
    $total = 0
    $head = $null
    while (($n = $gz.Read($buf, 0, $buf.Length)) -gt 0) {
      if ($null -eq $head) { $head = [Text.Encoding]::ASCII.GetString($buf, 0, [Math]::Min(15, $n)) }
      $total += $n
    }
    $gz.Dispose()
  } finally { $in.Dispose() }
  if ($head -ne 'SQLite format 3') { throw 'Decompressed file is not an SQLite database' }

  Move-Item -LiteralPath $tmp -Destination $final -Force
  $tmp = $null

  $files = @(Get-ChildItem -LiteralPath $Destination -Filter 'online-*.db.gz' | Where-Object { $_.Name -match '^online-\d{8}\.db\.gz$' } | Sort-Object Name -Descending)
  $removed = 0
  if ($files.Count -gt $Keep) {
    $files | Select-Object -Skip $Keep | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force; $removed++ }
  }
  Write-Output ("Saved {0} ({1:N1} KB gzip, {2:N1} KB raw); kept {3}, removed {4}" -f $final, ($info.Length / 1KB), ($total / 1KB), [Math]::Min($files.Count, $Keep), $removed)
  exit 0
} catch {
  if ($tmp -and (Test-Path -LiteralPath $tmp)) { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }
  [Console]::Error.WriteLine("Backup pull failed: " + $_.Exception.Message)
  exit 1
}
