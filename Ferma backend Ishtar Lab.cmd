@echo off
cd /d "%~dp0"
node backend\infra\runtime.mjs stop
if errorlevel 1 pause
