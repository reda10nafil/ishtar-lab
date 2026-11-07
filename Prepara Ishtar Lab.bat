@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Installare Node.js prima della preparazione.
  pause
  exit /b 1
)
node "%~dp0tools\prepara-installazione.mjs" %*
if errorlevel 1 (
  echo Preparazione non completata. Leggere il messaggio sopra.
  pause
  exit /b 1
)
echo Preparazione completata. Aprire Avvia Ishtar Lab.bat.
if not "%~1"=="--check" pause
