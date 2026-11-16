@echo off
title BLIND WAR - Serveur Local et Reseau P2P
cd /d "%~dp0"
set "NODE_DIR=%LOCALAPPDATA%\Programs\nodejs"
set "PATH=%NODE_DIR%;%PATH%"

echo ============================================================================
echo  DEMARRAGE DU SERVEUR BLIND WAR (Port 3001 + Reseau P2P Decentralise)
echo ============================================================================

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1

if not exist "node_modules\tsx\dist\cli.mjs" (
  echo Installation des dependances...
  call "%NODE_DIR%\npm.cmd" install
)

if not exist "dist\client\index.html" (
  echo Compilation du client...
  call "%NODE_DIR%\npm.cmd" run build
)

echo Ouverture de http://localhost:3001 dans votre navigateur...
start "" "http://localhost:3001"
echo.
echo Le serveur est ACTIF. Laissez cette fenetre ouverte pendant que vous jouez.
echo Vos amis peuvent ouvrir BLIND-WAR-JOUER.html et jouer avec vous.
echo.
"%NODE_DIR%\node.exe" "node_modules\tsx\dist\cli.mjs" "server\src\index.ts"
echo.
echo Le serveur s'est arrete.
pause
