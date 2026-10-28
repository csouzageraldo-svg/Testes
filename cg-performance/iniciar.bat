@echo off
REM CG Performance - instalar, gerar build e iniciar (Windows)
cd /d "%~dp0"
node --version >nul 2>&1
if errorlevel 1 (
  echo Node.js nao encontrado. Instale a versao LTS em https://nodejs.org
  pause
  exit /b 1
)
if not exist node_modules call npm install
call npm run build
start "" http://localhost:8787
call npm start
pause
