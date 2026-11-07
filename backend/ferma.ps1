$ErrorActionPreference='Stop'
& node (Join-Path $PSScriptRoot 'infra\runtime.mjs') stop
exit $LASTEXITCODE
