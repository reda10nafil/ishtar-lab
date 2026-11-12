# Avvia Ishtar Lab (l'app di Multi Outfit): servizi Docker, backend, console e servizio di prova.
# Uso: powershell -ExecutionPolicy Bypass -File avvia.ps1
$ErrorActionPreference = 'Stop'
$radice = $PSScriptRoot
$log = Join-Path $radice '.log'
New-Item -ItemType Directory -Force -Path $log | Out-Null

# Controllo via HTTP: Get-NetTCPConnection su questo PC risponde vuoto anche con il servizio attivo.
function Attivo([string]$url) {
  try {
    Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 $url | Out-Null
    return $true
  } catch {
    # Una risposta di errore arriva comunque da un servizio acceso.
    return [bool]$_.Exception.Response
  }
}

function Attendi([string]$nome, [string]$url, [int]$secondi) {
  $limite = (Get-Date).AddSeconds($secondi)
  while ((Get-Date) -lt $limite) {
    try {
      if ((Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 $url).StatusCode -eq 200) {
        Write-Host "OK  $nome"
        return
      }
    } catch { }
    Start-Sleep -Seconds 2
  }
  throw "$nome non risponde: controlla i log in $log"
}

docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Avvio di Docker Desktop...'
  Start-Process -FilePath 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
  $limite = (Get-Date).AddSeconds(150)
  do {
    Start-Sleep -Seconds 4
    docker info *> $null
  } while ($LASTEXITCODE -ne 0 -and (Get-Date) -lt $limite)
  if ($LASTEXITCODE -ne 0) { throw 'Docker non si avvia' }
}

Push-Location (Join-Path $radice 'infra')
docker compose up -d --wait postgres redis mailpit
docker compose up -d storage
Pop-Location

$bun = (Get-Command bun).Source
$node = (Get-Command node).Source
$api = Join-Path $radice 'piattaforma\packages\api'
$console = Join-Path $radice 'piattaforma\apps\console'

if (-not (Attivo 'http://127.0.0.1:59700/')) {
  Start-Process -WindowStyle Hidden -FilePath $node -ArgumentList '"infra\servizio-prova.mjs"' -WorkingDirectory $radice `
    -RedirectStandardOutput "$log\prova.log" -RedirectStandardError "$log\prova-errori.log"
}
if (-not (Attivo 'http://127.0.0.1:9100/health')) {
  Start-Process -WindowStyle Hidden -FilePath $bun -ArgumentList 'x', 'medusa', 'develop', '-H', '127.0.0.1', '-p', '9100' -WorkingDirectory $api `
    -RedirectStandardOutput "$log\backend.log" -RedirectStandardError "$log\backend-errori.log"
}
if (-not (Attivo 'http://localhost:5180/')) {
  Start-Process -WindowStyle Hidden -FilePath $bun -ArgumentList 'x', 'vite' -WorkingDirectory $console `
    -RedirectStandardOutput "$log\console.log" -RedirectStandardError "$log\console-errori.log"
}

Attendi 'Backend' 'http://127.0.0.1:9100/health' 150
Attendi 'Console' 'http://localhost:5180/' 60

Write-Host ''
Write-Host 'Ishtar Lab e pronto.'
Write-Host '  Console:        http://localhost:5180'
Write-Host '  Email di prova: http://127.0.0.1:58500'
Write-Host "  Accesso:        vedi $radice\.credenziali-locali.env"
if ($args -notcontains '-NoBrowser') { Start-Process 'http://localhost:5180' }
