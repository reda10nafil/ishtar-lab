# Ferma Ishtar Lab. I dati restano nei volumi Docker. Postiz, ChatbotX e n8n non vengono toccati.
foreach ($porta in 5180, 7000, 7001, 9100, 59700) {
  Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
  }
}
Push-Location (Join-Path $PSScriptRoot 'infra')
docker compose stop
Pop-Location
Write-Host 'Ishtar Lab fermato.'
