@echo off
setlocal
title Ishtar Lab
cd /d "%~dp0"
echo Avvio di Ishtar Lab. Attendi la preparazione dei servizi...
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js non trovato. Controlla l'installazione di Ishtar Lab.
  pause
  exit /b 1
)
node "%~dp0tools\apri-ishtar-lab.mjs" %*
if errorlevel 1 (
  echo.
  echo Avvio non riuscito. Leggi il messaggio qui sopra.
  pause
  exit /b 1
)
endlocal
