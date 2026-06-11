@echo off
REM start-all.bat  launch the whole stack on Windows: server (3000), client
REM (3001), bridge. Installs deps on first run. Server and client open in their
REM own console windows; the bridge runs here. Ctrl+C stops the bridge, then
REM this script kills the server/client windows.
REM
REM     start-all.bat
REM
REM Env overrides (set before running):
REM   SERVER_PORT=3000  CLIENT_PORT=3001   change ports
REM   NO_BRIDGE=1                          skip the bridge
REM   BRIDGE_ARGS=--verbose                extra args forwarded to the bridge
setlocal enabledelayedexpansion
cd /d "%~dp0"

if "%SERVER_PORT%"=="" set SERVER_PORT=3000
if "%CLIENT_PORT%"=="" set CLIENT_PORT=3001

REM --- LAN IP (first IPv4 that isn't a loopback) ---
set LAN_IP=localhost
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
  set ip=%%a
  set ip=!ip: =!
  if not "!ip:~0,4!"=="127." if "!LAN_IP!"=="localhost" set LAN_IP=!ip!
)

REM --- deps (first run only) ---
if not exist "server\node_modules" (
  echo installing server deps...
  pushd server && call npm install && popd
)
if not exist "client\node_modules" (
  echo installing client deps...
  pushd client && call npm install && popd
)

REM --- server + client, each in its own window ---
echo starting server on :%SERVER_PORT%...
start "vc-server" /d "%~dp0server" cmd /c "npx next dev -H 0.0.0.0 -p %SERVER_PORT%"
echo starting client on :%CLIENT_PORT%...
start "vc-client" /d "%~dp0client" cmd /c "npx next dev -H 0.0.0.0 -p %CLIENT_PORT%"

echo.
echo ────────────────────────────────────────────────────────────
echo   Monitor:    http://localhost:%SERVER_PORT%
echo   Receiver:   http://localhost:%SERVER_PORT%/receive   (Direct/WebRTC)
echo   Controller: http://%LAN_IP%:%CLIENT_PORT%            (open on your phone)
echo               set the server URL to http://%LAN_IP%:%SERVER_PORT%
echo   Ctrl+C here stops the bridge and the server/client windows.
echo ────────────────────────────────────────────────────────────
echo.

if "%NO_BRIDGE%"=="1" (
  echo NO_BRIDGE=1 - bridge skipped. Close the server/client windows to stop.
  pause
  goto :cleanup
)

REM --- wait for the server, then run the bridge in this window ---
echo waiting for server...
for /l %%i in (1,1,120) do (
  curl -sf -o NUL "http://localhost:%SERVER_PORT%/api/input" 2>NUL && goto :bridge
  timeout /t 1 /nobreak >NUL
)
echo server did not come up - check the vc-server window.
goto :cleanup

:bridge
echo starting bridge...
call bridge\start.bat --server "http://localhost:%SERVER_PORT%" %BRIDGE_ARGS%

:cleanup
echo stopping server/client...
taskkill /fi "WINDOWTITLE eq vc-server*" /t /f >NUL 2>&1
taskkill /fi "WINDOWTITLE eq vc-client*" /t /f >NUL 2>&1
endlocal
