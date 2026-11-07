param([switch]$NoBrowser)
$ErrorActionPreference='Stop'
& node (Join-Path $PSScriptRoot 'infra\runtime.mjs') start
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$pannello = Join-Path (Split-Path $PSScriptRoot -Parent) 'avvia_pannello.py'
Start-Process -WindowStyle Hidden -FilePath (Get-Command python).Source -ArgumentList ('"' + $pannello + '"') -WorkingDirectory (Split-Path $PSScriptRoot -Parent)
if (-not $NoBrowser) { Start-Process 'http://127.0.0.1:4273/ishtar-lab/#/home' }
