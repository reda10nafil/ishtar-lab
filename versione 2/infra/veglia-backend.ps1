# Veglia il backend mentre si lavora: lo riavvia solo se è davvero bloccato.
# `medusa develop` su Windows può bloccarsi quando un file cambia mentre il server parte:
# ripete un taskkill fallito e non torna più su da solo. Con il PC carico l'avvio può durare
# diversi minuti, quindi la sola attesa non basta: un riavvio troppo presto non finirebbe mai.
# Tocca solo il backend di questo progetto. Uso: pwsh -File infra/veglia-backend.ps1
$radice = Split-Path $PSScriptRoot
$api = Join-Path $radice 'piattaforma\packages\api'
$log = Join-Path $radice '.log'
$bun = (Get-Command bun).Source
$intervallo = 20
$limiteFermo = 600

function Attivo {
  try {
    Invoke-WebRequest -UseBasicParsing -TimeoutSec 6 'http://127.0.0.1:9100/health' | Out-Null
    return $true
  } catch {
    return $false
  }
}

function ProcessiDelProgetto {
  $tutti = Get-CimInstance Win32_Process
  $server = @($tutti | Where-Object { $_.CommandLine -like '*pannello di amministrazione*medusa*' -and $_.Name -eq 'node.exe' })
  $padri = @($tutti | Where-Object { $_.Name -eq 'bun.exe' -and ($server.ParentProcessId -contains $_.ProcessId) })
  return @($server) + @($padri)
}

function Bloccato {
  $righe = Get-Content "$log\backend.log", "$log\backend-errori.log" -Tail 12 -ErrorAction SilentlyContinue
  return [bool]($righe | Select-String -SimpleMatch 'taskkill' -Quiet)
}

function Riavvia {
  foreach ($processo in (ProcessiDelProgetto)) {
    taskkill /T /F /PID $processo.ProcessId 2>$null | Out-Null
  }
  Start-Sleep -Seconds 2
  Start-Process -WindowStyle Hidden -FilePath $bun -ArgumentList 'x', 'medusa', 'develop', '-H', '127.0.0.1', '-p', '9100' -WorkingDirectory $api `
    -RedirectStandardOutput "$log\backend.log" -RedirectStandardError "$log\backend-errori.log"
  Write-Host "$(Get-Date -Format 'HH:mm:ss') backend riavviato"
}

$fermoDa = $null
while ($true) {
  Start-Sleep -Seconds $intervallo
  if (Attivo) {
    $fermoDa = $null
    continue
  }
  if (-not $fermoDa) { $fermoDa = Get-Date }
  $durata = ((Get-Date) - $fermoDa).TotalSeconds
  $assente = (ProcessiDelProgetto).Count -eq 0
  if ($assente -or ($durata -ge 60 -and (Bloccato)) -or $durata -ge $limiteFermo) {
    Riavvia
    $fermoDa = Get-Date
  }
}
