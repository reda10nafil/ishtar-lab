@echo off
cd /d "%~dp0"
python avvia_pannello.py --open
if errorlevel 1 pause
